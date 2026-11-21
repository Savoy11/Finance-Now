// ─── Tracked portfolios: every sale, with the purchases it used up (T-460) ──
//
// The Realized tile is one total. The lot engine (costBasis.ts) already matches
// each part of a sale to the lot it used up; this lays those matches out by
// calendar year, so a reader can check them against a broker's year-end
// statement, and the same list goes into a spreadsheet (userExport.ts, salesCsv).
//
// Owner decision D222 (2026-11-10): each sale shows its buy and sell dates and
// the days held, and nothing more. No "held more than a year" mark, no short- or
// long-term label, no tax figure or rate. Gains are FIFO and plain
// (REALIZED_METHOD_LABEL, D65), so this is a record, not a tax form.
//
// Dates are the day as entered. The trade form sends a day, which is stored as
// midnight UTC, so every date here is read in UTC, as formatTradeDate shows it.
//
// Pure, with `now` injectable (it decides which year is still in progress), and
// tested (__tests__/salesList.test.ts).

import { sumUsd, type CostBasis } from './costBasis'
import type { LedgerView, TradeView } from './tradeLedger'

/** How the units left: sold, or a fraction of a unit paid out in cash on a split (T-421). */
export type SoldHow = 'sale' | 'split-cash'

/** How the units sold had arrived. */
export type BoughtHow = 'buy' | 'starting-position' | 'transfer-in' | 'income-units'

export const SOLD_HOW_LABELS: Record<SoldHow, string> = {
  sale: 'Sale',
  'split-cash': 'Cash for a fraction on a split',
}

export const BOUGHT_HOW_LABELS: Record<BoughtHow, string> = {
  buy: 'Bought',
  'starting-position': 'Starting position',
  'transfer-in': 'Transferred in',
  'income-units': 'Received as income',
}

/** One purchase (lot) a sale used up, or the part of one it used. */
export interface SalePart {
  /** The trade that opened the lot. */
  lotId: string
  boughtHow: BoughtHow
  /** "YYYY-MM-DD", the day as entered; null for a starting position given no date. */
  boughtOn: string | null
  /**
   * Whole days from boughtOn to the sale. Null with no boughtOn, and null when the
   * sale is dated before it: a starting position is the oldest lot whatever its date
   * (D65), so a sale entered before that date still uses it up.
   */
  daysHeld: number | null
  /** The sale is dated before boughtOn (see daysHeld). */
  soldBeforeBought: boolean
  /** Units, in the units held at the sale (after any split since the purchase). */
  quantity: string
  costUsd: string
  /** This part's share of the sale's proceeds after its fee. */
  proceedsUsd: string
  gainUsd: string
  /** The cost is the average entered for a starting position (D65). */
  fromStartingPosition: boolean
}

export interface SaleEntry {
  saleId: string
  instrumentKey: string
  symbol: string
  name: string
  soldHow: SoldHow
  /** "YYYY-MM-DD", the day as entered. */
  soldOn: string
  /** Oldest first, the order FIFO uses them up in. */
  parts: SalePart[]
  /** Units sold that no purchase covered: no cost is assumed, so they are left out of every gain. */
  unmatched: { quantity: string; proceedsUsd: string } | null
  /** The parts' totals; the unmatched units are not in them. */
  costUsd: string
  proceedsUsd: string
  gainUsd: string
}

/** Units moved out without being sold: not a sale, so listed apart and in no total. */
export interface MovedOut {
  tradeId: string
  instrumentKey: string
  symbol: string
  name: string
  movedOn: string
  quantity: string
  /** The cost that left with the units. */
  costUsd: string
}

export interface SalesYear {
  year: number
  /** The year `now` is in: its totals are so far. */
  inProgress: boolean
  /** Oldest first. */
  sales: SaleEntry[]
  movedOut: MovedOut[]
  /** Sums of the sales' matched parts, so proceeds less cost is the gain. */
  costUsd: string
  proceedsUsd: string
  gainUsd: string
  /** Proceeds of units no purchase covered, left out of the three above. */
  unmatchedProceedsUsd: string
}

export interface SalesList {
  /** Newest year first. */
  years: SalesYear[]
  /** Every sale's gain: equal to the holdings' realized total. */
  gainUsd: string
  /** How many sales, across every year. */
  saleCount: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The day as entered, "YYYY-MM-DD". */
function dayOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

function boughtHow(t: TradeView | undefined): BoughtHow {
  if (!t) return 'buy'
  if (t.opening) return 'starting-position'
  if (t.side === 'transfer_in') return 'transfer-in'
  if (t.side === 'income_units') return 'income-units'
  return 'buy'
}

/**
 * One holding's sales from its FIFO result. `trades` must hold every trade the
 * result was worked from; a sale or lot it cannot find is left out rather than
 * dated by guess.
 */
export function holdingSales(
  holding: { instrumentKey: string; symbol: string; name: string; basis: CostBasis },
  trades: ReadonlyMap<string, TradeView>,
): { sales: SaleEntry[]; movedOut: MovedOut[] } {
  const bySale = new Map<string, SaleEntry>()
  const entry = (saleId: string): SaleEntry | null => {
    const existing = bySale.get(saleId)
    if (existing) return existing
    const t = trades.get(saleId)
    if (!t?.executedAt) return null
    const e: SaleEntry = {
      saleId,
      instrumentKey: holding.instrumentKey,
      symbol: holding.symbol,
      name: holding.name,
      soldHow: t.side === 'split' ? 'split-cash' : 'sale',
      soldOn: dayOf(t.executedAt),
      parts: [],
      unmatched: null,
      costUsd: '0',
      proceedsUsd: '0',
      gainUsd: '0',
    }
    bySale.set(saleId, e)
    return e
  }

  for (const m of holding.basis.sales) {
    const e = entry(m.saleId)
    if (!e) continue
    const lot = trades.get(m.lotId)
    const boughtOn = lot?.executedAt ? dayOf(lot.executedAt) : null
    const days = boughtOn === null ? null : daysBetween(boughtOn, e.soldOn)
    e.parts.push({
      lotId: m.lotId,
      boughtHow: boughtHow(lot),
      boughtOn,
      daysHeld: days !== null && days >= 0 ? days : null,
      soldBeforeBought: days !== null && days < 0,
      quantity: m.quantity,
      costUsd: m.costUsd,
      proceedsUsd: m.proceedsUsd,
      gainUsd: m.gainUsd,
      fromStartingPosition: m.fromStartingPosition,
    })
  }
  for (const u of holding.basis.unmatched) {
    const e = entry(u.saleId)
    if (e) e.unmatched = { quantity: u.quantity, proceedsUsd: u.proceedsUsd }
  }
  for (const e of bySale.values()) {
    e.costUsd = sumUsd(e.parts.map((p) => p.costUsd))
    e.proceedsUsd = sumUsd(e.parts.map((p) => p.proceedsUsd))
    e.gainUsd = sumUsd(e.parts.map((p) => p.gainUsd))
  }

  const movedOut: MovedOut[] = []
  for (const o of holding.basis.transfersOut) {
    const t = trades.get(o.tradeId)
    if (!t?.executedAt) continue
    movedOut.push({
      tradeId: o.tradeId, instrumentKey: holding.instrumentKey, symbol: holding.symbol, name: holding.name,
      movedOn: dayOf(t.executedAt), quantity: o.quantity, costUsd: o.costUsd,
    })
  }
  return { sales: [...bySale.values()], movedOut }
}

/**
 * Every sale in a tracked portfolio, by calendar year (newest first), each with
 * the purchases it used up. Within a year, oldest first; a tie goes by the order
 * the trades are listed in.
 */
export function buildSalesList(view: Pick<LedgerView, 'trades' | 'holdings'>, now: Date = new Date()): SalesList {
  const trades = new Map(view.trades.map((t) => [t.id, t] as const))
  const order = new Map(view.trades.map((t, i) => [t.id, i] as const))
  const sales: SaleEntry[] = []
  const movedOut: MovedOut[] = []
  for (const h of view.holdings) {
    const r = holdingSales(h, trades)
    sales.push(...r.sales)
    movedOut.push(...r.movedOut)
  }

  const rank = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER
  sales.sort((a, b) => a.soldOn.localeCompare(b.soldOn) || rank(a.saleId) - rank(b.saleId))
  movedOut.sort((a, b) => a.movedOn.localeCompare(b.movedOn) || rank(a.tradeId) - rank(b.tradeId))

  const thisYear = now.getUTCFullYear()
  const years = new Map<number, SalesYear>()
  const yearOf = (day: string) => {
    const y = Number(day.slice(0, 4))
    let g = years.get(y)
    if (!g) {
      g = { year: y, inProgress: y === thisYear, sales: [], movedOut: [], costUsd: '0', proceedsUsd: '0', gainUsd: '0', unmatchedProceedsUsd: '0' }
      years.set(y, g)
    }
    return g
  }
  for (const s of sales) yearOf(s.soldOn).sales.push(s)
  for (const o of movedOut) yearOf(o.movedOn).movedOut.push(o)
  for (const g of years.values()) {
    g.costUsd = sumUsd(g.sales.map((s) => s.costUsd))
    g.proceedsUsd = sumUsd(g.sales.map((s) => s.proceedsUsd))
    g.gainUsd = sumUsd(g.sales.map((s) => s.gainUsd))
    g.unmatchedProceedsUsd = sumUsd(g.sales.flatMap((s) => (s.unmatched ? [s.unmatched.proceedsUsd] : [])))
  }

  return {
    years: [...years.values()].sort((a, b) => b.year - a.year),
    gainUsd: sumUsd(sales.map((s) => s.gainUsd)),
    saleCount: sales.length,
  }
}
