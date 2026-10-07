import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId } from '@/lib/auth/session'
import {
  MAX_TRADES_PER_PORTFOLIO, buildLedgerView, isUuid, parseTradeInput, toTradeView,
  type LedgerView, type TradeView,
} from '@/lib/data/tradeLedger'
import {
  countTrades, dbUnavailable, hasStartingPosition, insertTrade, loadTrades, notMigrated, notMigratedForSplits,
  ownedTrackedPortfolio, resolveTradeInstrument,
} from '@/lib/server/trackedPortfolios'

// A tracked portfolio's trades (T-027 step 2, owner decision D65).
//   GET  /api/user/tracked-portfolios/[id]/trades  → every trade, cancelled ones
//        included, and per holding the FIFO lots, gains and issues
//   POST /api/user/tracked-portfolios/[id]/trades  → record one trade
//        {instrument, side, quantity, pricePerUnit, feeUsd?, executedAt?,
//         opening?, note?, name?}, or a split (T-421):
//        {instrument, side: 'split', unitsAfter, unitsBefore, cashInLieuUsd?,
//         executedAt, note?, name?}
// Amounts travel as decimal strings, as the database stores them, so nothing
// is lost to floating point. A trade is never changed or removed; a mistake is
// cancelled (./[tradeId]/cancel) and the right trade recorded.

export const dynamic = 'force-dynamic'

export interface LedgerResponse extends Partial<LedgerView> {
  ok: boolean
  portfolio?: { id: string; name: string; description: string; createdAt: string; updatedAt: string }
  trade?: TradeView
  error?: string
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 })

  try {
    const portfolio = await ownedTrackedPortfolio(userId, id)
    if (!portfolio) return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    const { trades, cancellations } = await loadTrades(userId, id)
    return NextResponse.json<LedgerResponse>({
      ok: true,
      portfolio: {
        id: portfolio.id, name: portfolio.name, description: portfolio.description,
        createdAt: portfolio.createdAt.toISOString(), updatedAt: portfolio.updatedAt.toISOString(),
      },
      ...buildLedgerView(trades, cancellations),
    })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigrated()
    throw e
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
  }
  const parsed = parseTradeInput(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  const trade = parsed.value

  try {
    if (!(await ownedTrackedPortfolio(userId, id))) {
      return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    }
    if ((await countTrades(userId, id)) >= MAX_TRADES_PER_PORTFOLIO) {
      return NextResponse.json(
        { ok: false, error: `This portfolio already holds ${MAX_TRADES_PER_PORTFOLIO.toLocaleString('en-US')} trades, the most one portfolio keeps. Nothing was removed to make room.` },
        { status: 409 },
      )
    }
    const instrumentId = await resolveTradeInstrument(trade)
    if (trade.opening && (await hasStartingPosition(userId, id, instrumentId))) {
      return NextResponse.json(
        { ok: false, error: 'This holding already has a starting position. Cancel that one first if it is wrong.' },
        { status: 409 },
      )
    }
    const saved = await insertTrade(userId, id, instrumentId, trade)
    return NextResponse.json<LedgerResponse>({ ok: true, trade: toTradeView(saved) }, { status: 201 })
  } catch (e) {
    if (isSchemaBehindError(e)) return trade.split ? notMigratedForSplits() : notMigrated()
    throw e
  }
}
