// ─── Trade cost basis (T-027) ────────────────────────────────────────────────
//
// Turns one holding's recorded trades into lots: what is still held and what it
// cost, and the gain or loss on everything sold. Owner decisions D12 and D65:
//
//   - FIFO for every portfolio. A sale uses up the oldest units first. There is
//     one method, and every surface that prints a realized figure names it with
//     REALIZED_METHOD_LABEL. Trades are kept as they were made, so a second
//     method could be added later without changing anything saved.
//   - Something already owned when recording begins is entered once, as a
//     starting position: how many, the average price paid, and the date if
//     known. It is the oldest lot, so FIFO sells it first, and a gain made from
//     it is marked as resting on the average the user entered.
//   - Plain gains and losses, not adjusted for tax rules. A loss followed by a
//     repurchase stays a loss here (no wash-sale adjustment), and nothing is
//     split into short and long term. Tax-adjusted figures wait on D4's review.
//
// The arithmetic is exact. The database returns quantities (18 decimals),
// prices (8) and fees (2) as strings so that nothing loses precision in
// JavaScript (lib/db/schema/invest.ts), and this file keeps that promise:
// every figure is a scaled BigInt until it is written back out as a decimal
// string. Two things round, and both say how: the average cost per unit, to
// the 8 decimals the holdings column stores, and toCents(), for display.
//
// Pure, with the clock injectable, so every rule above is tested
// (__tests__/costBasis.test.ts). The trade routes under
// /api/user/tracked-portfolios call it through lib/data/tradeLedger.ts; the
// screen for entering trades is T-027's step three.

import type { TradeSide } from '@/lib/db/schema/invest'

export const COST_BASIS_METHOD = 'fifo' as const

/** Printed beside every realized gain or loss (D65). */
export const REALIZED_METHOD_LABEL = 'FIFO (oldest units sold first), not adjusted for tax rules'

/**
 * One trade. A row of trade_transactions goes straight in. Every trade passed in
 * one call must belong to one holding (one instrument in one portfolio): lots
 * never mix instruments, and each portfolio keeps its own.
 */
export interface LedgerTrade {
  id: string
  side: TradeSide
  /** Units: a positive decimal string. */
  quantity: string
  /** US dollars per unit. On a transfer in, the cost the units carry; ignored on a transfer out. */
  pricePerUnit: string
  feeUsd: string
  /** Null only on a starting position whose date was not given. */
  executedAt: Date | string | null
  /** A starting position (D65), recorded as a transfer in. */
  opening?: boolean
}

export interface OpenLot {
  /** The trade that opened the lot. */
  tradeId: string
  /** ISO time, or null for a starting position given no date. */
  acquiredAt: string | null
  /** Entered by hand as a starting position, so its cost is the average the user gave. */
  startingPosition: boolean
  /** Units still held. */
  quantity: string
  /** What those units cost, fees included. */
  costUsd: string
}

/** Part of a sale, matched to the lot it used up. */
export interface SaleMatch {
  saleId: string
  lotId: string
  quantity: string
  /** This part's share of the sale's proceeds after the sale's fee. */
  proceedsUsd: string
  costUsd: string
  gainUsd: string
  /** Rests on a starting position's entered average (D65). */
  fromStartingPosition: boolean
}

/** Units sold that no lot covered: a purchase is missing, or the sale was short. */
export interface UnmatchedSale {
  saleId: string
  quantity: string
  proceedsUsd: string
}

/** Units moved out of the portfolio without being sold. */
export interface TransferOut {
  tradeId: string
  /** Units that were held and left. */
  quantity: string
  /** The cost that left with them. Nothing was sold, so this is not a gain or a loss. */
  costUsd: string
  /** Reported here, and not counted in any lot or gain. */
  feeUsd: string
}

export type LedgerIssueCode =
  | 'invalid-trade'
  | 'sold-more-than-held'
  | 'moved-more-than-held'
  | 'second-starting-position'
  | 'dated-before-starting-position'
  | 'future-date'

export interface LedgerIssue {
  code: LedgerIssueCode
  tradeId: string
  /** Plain words, for the screen. */
  message: string
}

export interface CostBasis {
  method: typeof COST_BASIS_METHOD
  /** Oldest first: the order FIFO sells them in. */
  lots: OpenLot[]
  quantityHeld: string
  costHeldUsd: string
  /** Cost per unit of what is held, to 8 decimals (halves away from zero); null when nothing is held. */
  averageCostUsd: string | null
  sales: SaleMatch[]
  /** Sum of every SaleMatch gain. Unmatched units are left out: no cost is assumed for them. */
  realizedGainUsd: string
  /** The part of realizedGainUsd that rests on a starting position's entered average. */
  realizedFromStartingPositionUsd: string
  unmatched: UnmatchedSale[]
  transfersOut: TransferOut[]
  /** Rows left out (invalid-trade) and anything else the screen should point out. */
  issues: LedgerIssue[]
}

// ─── Exact decimals ──────────────────────────────────────────────────────────

const QTY_DP = 18
const PRICE_DP = 8
const FEE_DP = 2
/** A quantity times a price is exact at 26 decimals, so every dollar figure is kept there. */
const USD_DP = QTY_DP + PRICE_DP

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const pow10 = (n: number) => BigInt(`1${'0'.repeat(n)}`)
const FEE_TO_USD = pow10(USD_DP - FEE_DP)

/** A plain decimal string as a count of 10^-dp, or null if it is not one or needs more than dp decimals. */
function parseScaled(text: string, dp: number): bigint | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text.trim())
  if (!m) return null
  let frac = m[3] ?? ''
  if (frac.length > dp) {
    if (/[^0]/.test(frac.slice(dp))) return null
    frac = frac.slice(0, dp)
  }
  const v = BigInt(m[2] + frac.padEnd(dp, '0'))
  return m[1] === '-' ? -v : v
}

/** Back to a decimal string, trailing zeros dropped. */
function formatScaled(v: bigint, dp: number): string {
  const neg = v < ZERO
  const digits = (neg ? -v : v).toString().padStart(dp + 1, '0')
  const whole = digits.slice(0, digits.length - dp)
  const frac = digits.slice(digits.length - dp).replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`
}

/** n ÷ d to the nearest whole number, halves away from zero. d must be positive. */
function divRound(n: bigint, d: bigint): bigint {
  const q = n / d
  const r = n % d
  if ((r < ZERO ? -r : r) * TWO < d) return q
  return n < ZERO ? q - ONE : q + ONE
}

const usd = (v: bigint) => formatScaled(v, USD_DP)
const units = (v: bigint) => formatScaled(v, QTY_DP)

/**
 * A dollar figure from this file, rounded to cents (halves away from zero) with
 * both decimals shown. The figures above are exact; this is where a screen
 * rounds them.
 */
export function toCents(value: string): string {
  const v = parseScaled(value, USD_DP)
  if (v === null) throw new Error(`not a dollar figure: ${value}`)
  const cents = divRound(v, pow10(USD_DP - 2))
  const neg = cents < ZERO
  const digits = (neg ? -cents : cents).toString().padStart(3, '0')
  return `${neg ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`
}

/**
 * Units held times a live price, exact on the price as the database would
 * store it (8 decimals). Null for a price that is missing, negative or not a
 * number: a holding with no live price is left unvalued, never valued at cost.
 */
export function valueAtPrice(quantity: string, priceUsd: number | null | undefined): string | null {
  if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd < 0) return null
  const qty = parseScaled(quantity, QTY_DP)
  const price = parseScaled(priceUsd.toFixed(PRICE_DP), PRICE_DP)
  if (qty === null || price === null) return null
  return usd(qty * price)
}

function readUsd(value: string): bigint {
  const v = parseScaled(value, USD_DP)
  if (v === null) throw new Error(`not a dollar figure: ${value}`)
  return v
}

/** The exact sum of dollar figures from this file. */
export function sumUsd(values: readonly string[]): string {
  return usd(values.reduce((s, v) => s + readUsd(v), ZERO))
}

/** a − b, exactly. */
export function differenceUsd(a: string, b: string): string {
  return usd(readUsd(a) - readUsd(b))
}

// ─── Lots ────────────────────────────────────────────────────────────────────

/** What each kind of trade does to the lots. A side added to the table fails to compile here until it is placed. */
const EFFECT: Record<TradeSide, 'acquire' | 'dispose'> = {
  buy: 'acquire',
  sell: 'dispose',
  transfer_in: 'acquire',
  transfer_out: 'dispose',
}

/** Every kind of trade the ledger knows, in the table's order. */
export const LEDGER_SIDES = Object.keys(EFFECT) as TradeSide[]

interface Row {
  id: string
  side: TradeSide
  qty: bigint
  price: bigint
  fee: bigint
  /** Milliseconds since 1970, or null for an undated starting position. */
  at: number | null
  opening: boolean
}

interface Lot {
  tradeId: string
  acquiredAt: string | null
  startingPosition: boolean
  qty: bigint
  cost: bigint
}

/** The trade as exact numbers, or the reason it has to be left out. */
function readTrade(t: LedgerTrade): Row | string {
  if (!Object.prototype.hasOwnProperty.call(EFFECT, t.side)) return `Left out: "${t.side}" is not a kind of trade the ledger knows.`
  const qty = parseScaled(String(t.quantity), QTY_DP)
  if (qty === null || qty <= ZERO) return `Left out: the quantity "${t.quantity}" is not a positive number with at most ${QTY_DP} decimals.`
  const price = parseScaled(String(t.pricePerUnit), PRICE_DP)
  if (price === null || price < ZERO) return `Left out: the price "${t.pricePerUnit}" is not an amount of dollars (0 or more, at most ${PRICE_DP} decimals).`
  const fee = parseScaled(String(t.feeUsd), FEE_DP)
  if (fee === null || fee < ZERO) return `Left out: the fee "${t.feeUsd}" is not an amount of dollars (0 or more, at most ${FEE_DP} decimals).`
  const opening = t.opening === true
  if (opening && t.side !== 'transfer_in') return 'Left out: a starting position must be recorded as a transfer in.'
  let at: number | null = null
  if (t.executedAt === null) {
    if (!opening) return 'Left out: only a starting position may leave out its date.'
  } else {
    at = (t.executedAt instanceof Date ? t.executedAt : new Date(t.executedAt)).getTime()
    if (Number.isNaN(at)) return `Left out: "${String(t.executedAt)}" is not a date.`
  }
  return { id: t.id, side: t.side, qty, price, fee, at, opening }
}

/**
 * Why this trade would be left out of the lots, or null when it counts. The
 * trade routes refuse what the engine would skip, so a saved trade is never
 * one that silently does nothing.
 */
export function tradeProblem(t: LedgerTrade): string | null {
  const row = readTrade(t)
  return typeof row === 'string' ? row.replace(/^Left out: (.)/, (_, c: string) => c.toUpperCase()) : null
}

/**
 * The order FIFO works in: starting positions first (an undated one before any
 * dated one), then everything else by date. At the same moment a purchase
 * counts before a sale, since units cannot be sold before they arrive; the id
 * settles anything left, so the input's order never changes the answer.
 */
function compareRows(a: Row, b: Row): number {
  if (a.opening !== b.opening) return a.opening ? -1 : 1
  if (a.at !== b.at) {
    if (a.at === null) return -1
    if (b.at === null) return 1
    return a.at - b.at
  }
  const ea = EFFECT[a.side] === 'acquire' ? 0 : 1
  const eb = EFFECT[b.side] === 'acquire' ? 0 : 1
  if (ea !== eb) return ea - eb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Uses up `want` units from the oldest lots. A lot used in part gives up its
 * cost in proportion to the units taken, rounded down, and keeps the rest, so
 * the cost across all lots never gains or loses a fraction of a cent.
 */
function takeOldest(lots: Lot[], want: bigint): { parts: Array<{ lot: Lot; qty: bigint; cost: bigint }>; short: bigint } {
  const parts: Array<{ lot: Lot; qty: bigint; cost: bigint }> = []
  let left = want
  while (left > ZERO && lots.length > 0) {
    const lot = lots[0]
    if (lot.qty <= left) {
      parts.push({ lot, qty: lot.qty, cost: lot.cost })
      left -= lot.qty
      lots.shift()
    } else {
      const cost = (lot.cost * left) / lot.qty
      parts.push({ lot, qty: left, cost })
      lot.qty -= left
      lot.cost -= cost
      left = ZERO
    }
  }
  return { parts, short: left }
}

/**
 * One holding's trades, worked through FIFO. Rows that cannot be read are left
 * out and listed in `issues`; one bad row never blanks the rest.
 */
export function computeCostBasis(trades: readonly LedgerTrade[], now: Date = new Date()): CostBasis {
  const issues: LedgerIssue[] = []
  const rows: Row[] = []
  for (const t of trades) {
    const row = readTrade(t)
    if (typeof row === 'string') issues.push({ code: 'invalid-trade', tradeId: t.id, message: row })
    else rows.push(row)
  }
  rows.sort(compareRows)

  const starts = rows.filter((r) => r.opening)
  for (const r of starts.slice(1)) {
    issues.push({
      code: 'second-starting-position', tradeId: r.id,
      message: 'This holding already has a starting position. Both are kept, and FIFO sells the earlier one first.',
    })
  }
  const latestStart = starts.reduce<number | null>((m, r) => (r.at !== null && (m === null || r.at > m) ? r.at : m), null)
  for (const r of rows) {
    if (!r.opening && latestStart !== null && r.at !== null && r.at < latestStart) {
      issues.push({
        code: 'dated-before-starting-position', tradeId: r.id,
        message: 'Dated before the starting position. The starting position still counts as the oldest units, so FIFO sells it first.',
      })
    }
    if (r.at !== null && r.at > now.getTime()) {
      issues.push({ code: 'future-date', tradeId: r.id, message: 'Dated in the future. It is counted, but check the date.' })
    }
  }

  const lots: Lot[] = []
  const matches: Array<{ saleId: string; lot: Lot; qty: bigint; proceeds: bigint; cost: bigint }> = []
  const unmatched: UnmatchedSale[] = []
  const transfersOut: TransferOut[] = []

  for (const r of rows) {
    if (EFFECT[r.side] === 'acquire') {
      lots.push({
        tradeId: r.id,
        acquiredAt: r.at === null ? null : new Date(r.at).toISOString(),
        startingPosition: r.opening,
        qty: r.qty,
        cost: r.qty * r.price + r.fee * FEE_TO_USD,
      })
      continue
    }

    const { parts, short } = takeOldest(lots, r.qty)

    if (r.side === 'transfer_out') {
      transfersOut.push({
        tradeId: r.id,
        quantity: units(parts.reduce((s, p) => s + p.qty, ZERO)),
        costUsd: usd(parts.reduce((s, p) => s + p.cost, ZERO)),
        feeUsd: usd(r.fee * FEE_TO_USD),
      })
      if (short > ZERO) {
        issues.push({ code: 'moved-more-than-held', tradeId: r.id, message: `Moved out ${units(short)} more units than were held.` })
      }
      continue
    }

    // A sale's proceeds after its fee are shared across the lots it used, in
    // proportion to units. Each share is cut from what is still unshared, so
    // the last one is exactly what is left and the shares add up to the
    // proceeds to the last decimal.
    let restUsd = r.qty * r.price - r.fee * FEE_TO_USD
    let restQty = r.qty
    const share = (qty: bigint) => {
      const s = (restUsd * qty) / restQty
      restUsd -= s
      restQty -= qty
      return s
    }
    for (const p of parts) matches.push({ saleId: r.id, lot: p.lot, qty: p.qty, proceeds: share(p.qty), cost: p.cost })
    if (short > ZERO) {
      unmatched.push({ saleId: r.id, quantity: units(short), proceedsUsd: usd(share(short)) })
      issues.push({
        code: 'sold-more-than-held', tradeId: r.id,
        message: `Sold ${units(short)} more units than were held. No cost is assumed for them, so their proceeds are left out of the gain.`,
      })
    }
  }

  const quantityHeld = lots.reduce((s, l) => s + l.qty, ZERO)
  const costHeld = lots.reduce((s, l) => s + l.cost, ZERO)
  const gain = (m: { proceeds: bigint; cost: bigint }) => m.proceeds - m.cost

  return {
    method: COST_BASIS_METHOD,
    lots: lots.map((l) => ({
      tradeId: l.tradeId, acquiredAt: l.acquiredAt, startingPosition: l.startingPosition,
      quantity: units(l.qty), costUsd: usd(l.cost),
    })),
    quantityHeld: units(quantityHeld),
    costHeldUsd: usd(costHeld),
    // cost (26 decimals) ÷ quantity (18 decimals) is the price at 8 decimals.
    averageCostUsd: quantityHeld > ZERO ? formatScaled(divRound(costHeld, quantityHeld), PRICE_DP) : null,
    sales: matches.map((m) => ({
      saleId: m.saleId, lotId: m.lot.tradeId, quantity: units(m.qty),
      proceedsUsd: usd(m.proceeds), costUsd: usd(m.cost), gainUsd: usd(gain(m)),
      fromStartingPosition: m.lot.startingPosition,
    })),
    realizedGainUsd: usd(matches.reduce((s, m) => s + gain(m), ZERO)),
    realizedFromStartingPositionUsd: usd(matches.filter((m) => m.lot.startingPosition).reduce((s, m) => s + gain(m), ZERO)),
    unmatched,
    transfersOut,
    issues,
  }
}
