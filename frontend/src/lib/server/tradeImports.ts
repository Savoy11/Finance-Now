import 'server-only'

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  tradeCancellations, tradeImportLayouts, tradeImportRows, tradeImports, tradeIncome, tradeTransactions,
} from '@/lib/db/schema'
import { MAX_TRADES_PER_PORTFOLIO, type NewTrade } from '@/lib/data/tradeLedger'
import {
  classifyImport, importCancelReason, looseIdentity, readLayout, rowsToSave,
  type ExistingForImport, type ImportLayout, type ImportRequest, type ImportRowStatus,
} from '@/lib/data/tradeImport'
import { countTrades, loadTrades, portfolioSaveLock, type Queryable } from './trackedPortfolios'
import { resolveInstruments } from './instrumentResolve'

// ─── Importing trades from a file: persistence (T-447, owner decision D200) ──
// The routes under /api/user/tracked-portfolios/[id]/imports use these. The
// rules (what a row must be, which rows are repeats) are pure, in
// lib/data/tradeImport.ts; this file reads and writes, scoped to the user as
// every tracked-portfolio query is.
//
// Migration 0010 adds the three tables. Until it is applied, importing answers
// 503 with what to run, and every other trade route is unaffected. A file with
// cash income rows (T-451) also needs migration 0011's trade_income.
//
// Nothing here changes or removes a trade. An import adds trades; cancelling an
// import adds a cancellation row for each of its trades.

export function notMigratedForImports() {
  return NextResponse.json(
    { ok: false, error: 'Importing trades needs a database update that has not been applied yet. Run `npm run db:migrate` in frontend/, then try again. Nothing was saved.' },
    { status: 503 },
  )
}

/** What the database holds for the portfolio, as the import compares against it. */
async function existingForImport(userId: string, portfolioId: string, q: Queryable) {
  const ledger = await loadTrades(userId, portfolioId, q)
  const cancelled = new Set(ledger.cancellations.map((c) => c.tradeId))
  const imported = await q.select({ tradeId: tradeImportRows.tradeId, fingerprint: tradeImportRows.fingerprint })
    .from(tradeImportRows)
    .where(and(eq(tradeImportRows.portfolioId, portfolioId), eq(tradeImportRows.userId, userId)))
  const importedIds = new Set(imported.map((r) => r.tradeId))
  const typedTrades = new Map<string, number>()
  for (const t of ledger.trades) {
    if (cancelled.has(t.id) || importedIds.has(t.id) || t.opening || t.side === 'split') continue
    const key = looseIdentity(t)
    typedTrades.set(key, (typedTrades.get(key) ?? 0) + 1)
  }
  const existing: ExistingForImport = {
    importedFingerprints: new Set(imported.filter((r) => !cancelled.has(r.tradeId)).map((r) => r.fingerprint)),
    typedTrades,
  }
  return { ledger, existing }
}

export interface ImportCheck {
  rows: Array<{ line: number; status: ImportRowStatus }>
  /** Rows this import would save. */
  toSave: number
  /** Trade rows the portfolio already has, and the most it keeps. */
  capacity: { existing: number; max: number }
}

/** What an import would do, without saving anything. */
export async function checkImport(userId: string, portfolioId: string, req: ImportRequest) {
  const { ledger, existing } = await existingForImport(userId, portfolioId, db)
  const statuses = classifyImport(req.rows, existing)
  const toSave = rowsToSave(statuses, req.include)
  const check: ImportCheck = {
    rows: statuses.map(({ line, status }) => ({ line, status })),
    toSave: toSave.length,
    capacity: { existing: await countTrades(userId, portfolioId), max: MAX_TRADES_PER_PORTFOLIO },
  }
  return { check, ledger, saveLines: new Set(toSave.map((s) => s.line)) }
}

export type SaveResult =
  | { status: 'saved'; importId: string; saved: number; skippedRepeats: number; heldBack: number }
  | { status: 'nothing-to-save'; skippedRepeats: number; heldBack: number }
  | { status: 'over-capacity'; existing: number; adding: number }

/** Inserts in batches, so a long file stays under the database's limit on values in one statement. */
async function insertInBatches<T>(rows: T[], size: number, insert: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size))
}

/**
 * Saves an import: the trades, the record of the import, which trades it
 * saved, and the layout to remember, together or not at all. The repeat check
 * runs again inside the transaction, under a lock on the portfolio, so the
 * same file sent twice at once is still saved once.
 */
export async function saveImport(userId: string, portfolioId: string, req: ImportRequest): Promise<SaveResult> {
  // Instrument rows are shared and harmless to create ahead: resolve them first, outside the transaction.
  const byKey = new Map<string, NewTrade>()
  for (const r of req.rows) if (!byKey.has(r.trade.instrumentKey)) byKey.set(r.trade.instrumentKey, r.trade)
  const instrumentIds = await resolveInstruments([...byKey.values()].map((t) => ({
    key: t.instrumentKey, symbol: t.instrumentKey, name: t.nameHint || t.instrumentKey,
  })))

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${portfolioSaveLock(portfolioId)}))`)
    const { existing } = await existingForImport(userId, portfolioId, tx)
    const statuses = classifyImport(req.rows, existing)
    const toSave = rowsToSave(statuses, req.include)
    const skippedRepeats = statuses.filter((s) => s.status === 'already-imported').length
    const heldBack = statuses.filter((s) => s.status === 'looks-recorded').length - toSave.filter((s) => s.status === 'looks-recorded').length
    if (toSave.length === 0) return { status: 'nothing-to-save', skippedRepeats, heldBack }

    const existingCount = await countTrades(userId, portfolioId, tx)
    if (existingCount + toSave.length > MAX_TRADES_PER_PORTFOLIO) {
      return { status: 'over-capacity', existing: existingCount, adding: toSave.length }
    }

    const [imp] = await tx.insert(tradeImports).values({
      userId, portfolioId, fileName: req.fileName, headerSignature: req.headerSignature,
      rowsSent: req.rows.length, skippedRepeats,
    }).returning({ id: tradeImports.id })

    // Recorded oldest first, so trades on one day list in the order they were made. Many
    // brokers list the newest first; such a file's same-day rows are read from the bottom up.
    const byLine = new Map(req.rows.map((r) => [r.line, r.trade]))
    const dated = req.rows.map((r) => r.trade.executedAt?.getTime() ?? 0)
    const newestFirst = dated.length > 1 && dated[0] > dated[dated.length - 1]
    const ordered = toSave
      .map((s) => ({ ...s, trade: byLine.get(s.line)! }))
      .sort((a, b) => (a.trade.executedAt?.getTime() ?? 0) - (b.trade.executedAt?.getTime() ?? 0)
        || (newestFirst ? b.line - a.line : a.line - b.line))
    const base = Date.now()
    const withIds = ordered.map((s, i) => ({ ...s, id: randomUUID(), createdAt: new Date(base + i) }))

    await insertInBatches(withIds, 1000, (batch) => tx.insert(tradeTransactions).values(batch.map((s) => ({
      id: s.id,
      userId,
      portfolioId,
      instrumentId: instrumentIds.get(s.trade.instrumentKey)!,
      side: s.trade.side,
      quantity: s.trade.quantity,
      pricePerUnit: s.trade.pricePerUnit,
      feeUsd: s.trade.feeUsd,
      executedAt: s.trade.executedAt,
      opening: false,
      note: s.trade.note,
      createdAt: s.createdAt,
    }))))
    // Cash income's amount and kind (T-451), as recording one trade writes them.
    const income = withIds.filter((s) => s.trade.income)
    await insertInBatches(income, 1000, (batch) => tx.insert(tradeIncome).values(batch.map((s) => ({
      tradeId: s.id, userId, amountUsd: s.trade.income!.amountUsd, kind: s.trade.income!.kind,
    }))))
    await insertInBatches(withIds, 1000, (batch) => tx.insert(tradeImportRows).values(batch.map((s) => ({
      tradeId: s.id, userId, importId: imp.id, portfolioId, line: s.line, fingerprint: s.fingerprint,
    }))))

    if (req.layout && req.headerSignature) {
      await tx.insert(tradeImportLayouts)
        .values({ userId, headerSignature: req.headerSignature, layout: req.layout })
        .onConflictDoUpdate({
          target: [tradeImportLayouts.userId, tradeImportLayouts.headerSignature],
          set: { layout: req.layout, updatedAt: new Date() },
        })
    }
    return { status: 'saved', importId: imp.id, saved: withIds.length, skippedRepeats, heldBack }
  })
}

export interface ImportSummary {
  id: string
  fileName: string
  createdAt: string
  /** Trades it saved. */
  saved: number
  /** Of those, how many are cancelled now. */
  cancelled: number
  skippedRepeats: number
  rowsSent: number
}

/** This portfolio's imports, newest first, with how many of each one's trades are cancelled. */
export async function listImports(userId: string, portfolioId: string): Promise<ImportSummary[]> {
  const imports = await db.select().from(tradeImports)
    .where(and(eq(tradeImports.portfolioId, portfolioId), eq(tradeImports.userId, userId)))
    .orderBy(desc(tradeImports.createdAt))
  if (imports.length === 0) return []
  const ids = imports.map((i) => i.id)
  const saved = await db.select({ importId: tradeImportRows.importId, n: count() }).from(tradeImportRows)
    .where(and(inArray(tradeImportRows.importId, ids), eq(tradeImportRows.userId, userId)))
    .groupBy(tradeImportRows.importId)
  const cancelled = await db.select({ importId: tradeImportRows.importId, n: count() }).from(tradeImportRows)
    .innerJoin(tradeCancellations, eq(tradeCancellations.tradeId, tradeImportRows.tradeId))
    .where(and(inArray(tradeImportRows.importId, ids), eq(tradeImportRows.userId, userId)))
    .groupBy(tradeImportRows.importId)
  const savedBy = new Map(saved.map((r) => [r.importId, r.n]))
  const cancelledBy = new Map(cancelled.map((r) => [r.importId, r.n]))
  return imports.map((i) => ({
    id: i.id,
    fileName: i.fileName,
    createdAt: i.createdAt.toISOString(),
    saved: savedBy.get(i.id) ?? 0,
    cancelled: cancelledBy.get(i.id) ?? 0,
    skippedRepeats: i.skippedRepeats,
    rowsSent: i.rowsSent,
  }))
}

/** The layouts this person has saved, by the file's column names. A malformed one is left out. */
export async function listLayouts(userId: string): Promise<Array<{ headerSignature: string; layout: ImportLayout; updatedAt: string }>> {
  const rows = await db.select().from(tradeImportLayouts).where(eq(tradeImportLayouts.userId, userId))
  return rows.flatMap((r) => {
    const layout = readLayout(r.layout)
    return layout ? [{ headerSignature: r.headerSignature, layout, updatedAt: r.updatedAt.toISOString() }] : []
  })
}

/**
 * Cancels a whole import: a cancellation row for each of its trades that is
 * not cancelled already, in one transaction. Nothing is changed or removed,
 * and the trades stay listed as cancelled.
 */
export async function cancelImport(
  userId: string,
  portfolioId: string,
  importId: string,
  reason: string,
): Promise<{ status: 'not-found' } | { status: 'cancelled'; cancelled: number; alreadyCancelled: number }> {
  const [imp] = await db.select({ id: tradeImports.id, fileName: tradeImports.fileName }).from(tradeImports)
    .where(and(eq(tradeImports.id, importId), eq(tradeImports.portfolioId, portfolioId), eq(tradeImports.userId, userId)))
    .limit(1)
  if (!imp) return { status: 'not-found' }
  const fullReason = importCancelReason(imp.fileName, reason)
  return db.transaction(async (tx) => {
    const trades = await tx.select({ tradeId: tradeImportRows.tradeId }).from(tradeImportRows)
      .where(and(eq(tradeImportRows.importId, importId), eq(tradeImportRows.userId, userId)))
    let cancelled = 0
    await insertInBatches(trades, 1000, async (batch) => {
      const rows = await tx.insert(tradeCancellations)
        .values(batch.map((t) => ({ tradeId: t.tradeId, userId, reason: fullReason })))
        .onConflictDoNothing({ target: tradeCancellations.tradeId })
        .returning({ tradeId: tradeCancellations.tradeId })
      cancelled += rows.length
    })
    return { status: 'cancelled', cancelled, alreadyCancelled: trades.length - cancelled }
  })
}
