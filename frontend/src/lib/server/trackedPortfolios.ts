import 'server-only'

import { NextResponse } from 'next/server'
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import {
  instrumentCrypto, instruments, portfolios, trackedPortfolios, tradeCancellations, tradeTransactions,
  type AssetClass,
} from '@/lib/db/schema'
import { clientKeyFor, resolveInstruments } from './instrumentResolve'
import type { NewTrade, StoredCancellation, StoredTrade } from '@/lib/data/tradeLedger'

// ─── Tracked portfolio persistence (T-027 step 2, owner decision D65) ────────
// Shared by the routes under /api/user/tracked-portfolios, and by the what-if
// portfolio routes, which must leave tracked portfolios alone. Route files can
// only export HTTP methods, so the queries live here.
//
// Every query is scoped to the user, as in portfolioPersistence.ts: another
// user's portfolio or trade behaves exactly like a missing one.
//
// Migration 0005 adds the tables this reads. Until it is applied, the two
// helpers the what-if routes use answer as if no portfolio were tracked (none
// can be), and the tracked routes answer 503 with what to run.

export function dbUnavailable() {
  return NextResponse.json(
    { ok: false, error: 'Database is not configured — run `npm run db:status` and set DATABASE_URL in frontend/.env.local.' },
    { status: 503 },
  )
}

export function notMigrated() {
  return NextResponse.json(
    { ok: false, error: 'Tracked portfolios need a database update that has not been applied yet. Run `npm run db:migrate` in frontend/, then reload.' },
    { status: 503 },
  )
}

/** The ids of this user's tracked portfolios. Empty before migration 0005, when none can exist. */
export async function trackedPortfolioIds(userId: string): Promise<Set<string>> {
  try {
    const rows = await db.select({ id: trackedPortfolios.portfolioId }).from(trackedPortfolios)
      .where(eq(trackedPortfolios.userId, userId))
    return new Set(rows.map((r) => r.id))
  } catch (e) {
    if (isSchemaBehindError(e)) return new Set()
    throw e
  }
}

/** Whether this user's portfolio is a tracked one. False before migration 0005, when none can be. */
export async function isTrackedPortfolio(userId: string, portfolioId: string): Promise<boolean> {
  try {
    const [row] = await db.select({ id: trackedPortfolios.portfolioId }).from(trackedPortfolios)
      .where(and(eq(trackedPortfolios.portfolioId, portfolioId), eq(trackedPortfolios.userId, userId)))
      .limit(1)
    return !!row
  } catch (e) {
    if (isSchemaBehindError(e)) return false
    throw e
  }
}

export interface TrackedPortfolioSummary {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  /** Trades that still count; cancelled ones are left out. */
  tradeCount: number
}

const summaryColumns = {
  id: portfolios.id,
  name: portfolios.name,
  description: portfolios.description,
  createdAt: portfolios.createdAt,
  updatedAt: portfolios.updatedAt,
}

type SummaryRow = { id: string; name: string; description: string; createdAt: Date; updatedAt: Date }

const toSummary = (p: SummaryRow, tradeCount: number): TrackedPortfolioSummary => ({
  id: p.id, name: p.name, description: p.description,
  createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), tradeCount,
})

/** This user's tracked portfolio, or null. */
export async function ownedTrackedPortfolio(userId: string, portfolioId: string): Promise<SummaryRow | null> {
  const [row] = await db.select(summaryColumns).from(trackedPortfolios)
    .innerJoin(portfolios, eq(portfolios.id, trackedPortfolios.portfolioId))
    .where(and(
      eq(trackedPortfolios.portfolioId, portfolioId),
      eq(trackedPortfolios.userId, userId),
      eq(portfolios.userId, userId),
    ))
    .limit(1)
  return row ?? null
}

/** Trades that still count, per portfolio. */
async function activeTradeCounts(userId: string, portfolioIds: string[]): Promise<Map<string, number>> {
  if (portfolioIds.length === 0) return new Map()
  const rows = await db.select({ portfolioId: tradeTransactions.portfolioId, n: count() })
    .from(tradeTransactions)
    .leftJoin(tradeCancellations, eq(tradeCancellations.tradeId, tradeTransactions.id))
    .where(and(
      eq(tradeTransactions.userId, userId),
      inArray(tradeTransactions.portfolioId, portfolioIds),
      isNull(tradeCancellations.tradeId),
    ))
    .groupBy(tradeTransactions.portfolioId)
  return new Map(rows.map((r) => [r.portfolioId, r.n]))
}

export async function listTrackedPortfolios(userId: string): Promise<TrackedPortfolioSummary[]> {
  const rows = await db.select(summaryColumns).from(trackedPortfolios)
    .innerJoin(portfolios, eq(portfolios.id, trackedPortfolios.portfolioId))
    .where(and(eq(trackedPortfolios.userId, userId), eq(portfolios.userId, userId)))
    .orderBy(desc(portfolios.createdAt))
  const counts = await activeTradeCounts(userId, rows.map((r) => r.id))
  return rows.map((r) => toSummary(r, counts.get(r.id) ?? 0))
}

/**
 * A new tracked portfolio: the portfolio row and its marker, together or not
 * at all. It has no starting capital, because its value comes from its trades.
 */
export async function createTrackedPortfolio(
  userId: string,
  v: { id?: string; name?: string; description?: string },
): Promise<TrackedPortfolioSummary> {
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(portfolios).values({
      ...(v.id ? { id: v.id } : {}),
      userId,
      name: v.name ?? '',
      description: v.description ?? '',
      startingCapital: null,
    }).returning(summaryColumns)
    await tx.insert(trackedPortfolios).values({ portfolioId: p.id, userId })
    return toSummary(p, 0)
  })
}

export async function renameTrackedPortfolio(
  userId: string,
  portfolioId: string,
  v: { name?: string; description?: string },
): Promise<TrackedPortfolioSummary | null> {
  if (!(await ownedTrackedPortfolio(userId, portfolioId))) return null
  const [p] = await db.update(portfolios)
    .set({
      ...(v.name !== undefined ? { name: v.name } : {}),
      ...(v.description !== undefined ? { description: v.description } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning(summaryColumns)
  if (!p) return null
  const counts = await activeTradeCounts(userId, [p.id])
  return toSummary(p, counts.get(p.id) ?? 0)
}

/**
 * Removes a tracked portfolio at its owner's request, and with it its trades
 * and their cancellations (the foreign keys cascade). It never touches a
 * what-if portfolio: the WHERE only matches ids that carry the marker.
 */
export async function deleteTrackedPortfolio(userId: string, portfolioId: string): Promise<boolean> {
  const deleted = await db.delete(portfolios)
    .where(and(
      eq(portfolios.id, portfolioId),
      eq(portfolios.userId, userId),
      inArray(portfolios.id, db.select({ id: trackedPortfolios.portfolioId }).from(trackedPortfolios)
        .where(eq(trackedPortfolios.userId, userId))),
    ))
    .returning({ id: portfolios.id })
  return deleted.length > 0
}

// ─── Trades ──────────────────────────────────────────────────────────────────

const tradeColumns = {
  id: tradeTransactions.id,
  side: tradeTransactions.side,
  quantity: tradeTransactions.quantity,
  pricePerUnit: tradeTransactions.pricePerUnit,
  feeUsd: tradeTransactions.feeUsd,
  executedAt: tradeTransactions.executedAt,
  opening: tradeTransactions.opening,
  note: tradeTransactions.note,
  createdAt: tradeTransactions.createdAt,
  symbol: instruments.symbol,
  name: instruments.name,
  assetClass: instruments.assetClass,
  coingeckoId: instrumentCrypto.coingeckoId,
}

type TradeRow = {
  id: string; side: StoredTrade['side']; quantity: string; pricePerUnit: string; feeUsd: string
  executedAt: Date | null; opening: boolean; note: string | null; createdAt: Date
  symbol: string; name: string; assetClass: AssetClass; coingeckoId: string | null
}

const toStored = (r: TradeRow): StoredTrade => ({
  id: r.id,
  instrumentKey: clientKeyFor(r.assetClass, r.symbol, r.coingeckoId),
  symbol: r.symbol,
  name: r.name,
  side: r.side,
  quantity: r.quantity,
  pricePerUnit: r.pricePerUnit,
  feeUsd: r.feeUsd,
  executedAt: r.executedAt,
  opening: r.opening,
  note: r.note,
  createdAt: r.createdAt,
})

/** Every trade in the portfolio, cancelled ones included, and the cancellations. */
export async function loadTrades(userId: string, portfolioId: string): Promise<{ trades: StoredTrade[]; cancellations: StoredCancellation[] }> {
  const rows = await db.select(tradeColumns).from(tradeTransactions)
    .innerJoin(instruments, eq(instruments.id, tradeTransactions.instrumentId))
    .leftJoin(instrumentCrypto, eq(instrumentCrypto.instrumentId, instruments.id))
    .where(and(eq(tradeTransactions.portfolioId, portfolioId), eq(tradeTransactions.userId, userId)))
    .orderBy(sql`${tradeTransactions.executedAt} asc nulls first`, asc(tradeTransactions.createdAt))
  const cancellations = await db.select({
    tradeId: tradeCancellations.tradeId, reason: tradeCancellations.reason, createdAt: tradeCancellations.createdAt,
  }).from(tradeCancellations)
    .innerJoin(tradeTransactions, eq(tradeTransactions.id, tradeCancellations.tradeId))
    .where(and(eq(tradeTransactions.portfolioId, portfolioId), eq(tradeCancellations.userId, userId)))
  return { trades: rows.map(toStored), cancellations }
}

/** Every trade row in the portfolio, cancelled ones included: the table only grows. */
export async function countTrades(userId: string, portfolioId: string): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(tradeTransactions)
    .where(and(eq(tradeTransactions.portfolioId, portfolioId), eq(tradeTransactions.userId, userId)))
  return n
}

/** The instrument row for a key, created the first time anything holds it. */
export async function resolveTradeInstrument(t: NewTrade): Promise<string> {
  const ids = await resolveInstruments([{ key: t.instrumentKey, symbol: t.instrumentKey, name: t.nameHint || t.instrumentKey }])
  return ids.get(t.instrumentKey)!
}

/** Whether this holding already has a starting position that has not been cancelled. */
export async function hasStartingPosition(userId: string, portfolioId: string, instrumentId: string): Promise<boolean> {
  const [row] = await db.select({ id: tradeTransactions.id }).from(tradeTransactions)
    .leftJoin(tradeCancellations, eq(tradeCancellations.tradeId, tradeTransactions.id))
    .where(and(
      eq(tradeTransactions.portfolioId, portfolioId),
      eq(tradeTransactions.userId, userId),
      eq(tradeTransactions.instrumentId, instrumentId),
      eq(tradeTransactions.opening, true),
      isNull(tradeCancellations.tradeId),
    ))
    .limit(1)
  return !!row
}

export async function insertTrade(userId: string, portfolioId: string, instrumentId: string, t: NewTrade): Promise<StoredTrade> {
  const [{ id }] = await db.insert(tradeTransactions).values({
    userId,
    portfolioId,
    instrumentId,
    side: t.side,
    quantity: t.quantity,
    pricePerUnit: t.pricePerUnit,
    feeUsd: t.feeUsd,
    executedAt: t.executedAt,
    opening: t.opening,
    note: t.note,
  }).returning({ id: tradeTransactions.id })
  const [row] = await db.select(tradeColumns).from(tradeTransactions)
    .innerJoin(instruments, eq(instruments.id, tradeTransactions.instrumentId))
    .leftJoin(instrumentCrypto, eq(instrumentCrypto.instrumentId, instruments.id))
    .where(eq(tradeTransactions.id, id))
    .limit(1)
  return toStored(row)
}

/**
 * Cancels one trade in this user's portfolio. Nothing is changed or removed:
 * a row is added that names the trade, and a trade can be cancelled once.
 */
export async function cancelTrade(
  userId: string,
  portfolioId: string,
  tradeId: string,
  reason: string,
): Promise<{ status: 'cancelled'; cancellation: StoredCancellation } | { status: 'not-found' } | { status: 'already-cancelled' }> {
  const [trade] = await db.select({ id: tradeTransactions.id }).from(tradeTransactions)
    .where(and(
      eq(tradeTransactions.id, tradeId),
      eq(tradeTransactions.portfolioId, portfolioId),
      eq(tradeTransactions.userId, userId),
    ))
    .limit(1)
  if (!trade) return { status: 'not-found' }
  const [row] = await db.insert(tradeCancellations).values({ tradeId, userId, reason })
    .onConflictDoNothing({ target: tradeCancellations.tradeId })
    .returning({ tradeId: tradeCancellations.tradeId, reason: tradeCancellations.reason, createdAt: tradeCancellations.createdAt })
  if (!row) return { status: 'already-cancelled' }
  return { status: 'cancelled', cancellation: row }
}
