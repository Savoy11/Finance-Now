// ─── Tracked portfolios: trade input and the ledger view (T-027 step 2) ─────
//
// The pure half of the trade routes under /api/user/tracked-portfolios: what a
// trade must look like before it is saved, which instruments a tracked
// portfolio can hold, and how saved trades become the view the routes return.
// The routes add ownership, storage and instrument lookup and nothing else, so
// every rule here is tested (__tests__/tradeLedger.test.ts).
//
// Owner decision D65 (2026-10-04): a tracked portfolio is a new kind of
// portfolio, separate from the what-if ones; anything already owned is entered
// once as a starting position; gains are FIFO, not adjusted for tax rules.

import type { TradeSide } from '@/lib/db/schema/invest'
import { CLASS_LABELS, INSTRUMENT_BY_KEY, isSecurityKey, type InstrumentClass } from './instruments'
import {
  COST_BASIS_METHOD, LEDGER_SIDES, REALIZED_METHOD_LABEL, computeCostBasis, differenceUsd, sumUsd,
  toCents, tradeProblem, valueAtPrice,
  type CostBasis, type LedgerIssue, type LedgerTrade,
} from './costBasis'

/** The most trades one portfolio keeps. Recording past it is refused; nothing is ever removed to make room. */
export const MAX_TRADES_PER_PORTFOLIO = 10_000
export const MAX_NAME_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_NOTE_LENGTH = 500
export const MAX_REASON_LENGTH = 300

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The same two key shapes the Portfolios page uses: a CoinGecko id, or 'sec:' and a ticker. */
const COIN_KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const SECURITY_KEY_RE = /^sec:[A-Za-z0-9.^=-]{1,20}$/

/**
 * What the columns can hold: numeric(38,18) units, numeric(20,8) prices,
 * numeric(20,2) fees. Checked here so an oversized amount is a 400 with a
 * reason, never a database error.
 */
const AMOUNT_LIMITS = {
  quantity: { decimals: 18, wholeDigits: 20, label: 'quantity' },
  pricePerUnit: { decimals: 8, wholeDigits: 12, label: 'price' },
  feeUsd: { decimals: 2, wholeDigits: 18, label: 'fee' },
} as const

/** Earliest date a trade may carry. A typo such as year 0026 is refused rather than sorted to the front. */
const EARLIEST_TRADE = Date.UTC(1900, 0, 1)
/** A trade dated up to a day ahead is allowed, for time zones; later than that is a mistake. */
const FUTURE_ALLOWANCE_MS = 24 * 60 * 60 * 1000

/**
 * The classes a tracked portfolio can hold. The lot engine works in US dollars
 * per unit, which is how coins, stocks and funds are priced. Commodities are
 * futures quoted in cents or dollars per contract unit, currencies are
 * exchange rates, and rates are yields or futures points, so their figures
 * would not mean what the engine assumes.
 */
export const TRACKABLE_CLASSES: ReadonlySet<InstrumentClass> = new Set(['crypto', 'equity', 'etf', 'mutual'])

/** Whether an instrument key can go in a tracked portfolio, and if not, why. */
export function trackableInstrument(key: string): { ok: true } | { ok: false; reason: string } {
  if (!COIN_KEY_RE.test(key) && !SECURITY_KEY_RE.test(key)) {
    return { ok: false, reason: `"${key}" is not an instrument key (a coin id such as "bitcoin", or "sec:" and a ticker such as "sec:VTI").` }
  }
  const known = INSTRUMENT_BY_KEY[key]
  // Keys the catalog does not know are classed as the instrument resolver
  // classes them: a security key is a stock, anything else a coin.
  const cls: InstrumentClass = known?.class ?? (isSecurityKey(key) ? 'equity' : 'crypto')
  if (TRACKABLE_CLASSES.has(cls)) return { ok: true }
  return {
    ok: false,
    reason: `${known?.name ?? key} is a ${CLASS_LABELS[cls].toLowerCase()} instrument. Trade history covers coins, stocks and funds, which are priced in dollars per unit; this one is quoted another way.`,
  }
}

// ─── Input ───────────────────────────────────────────────────────────────────

export interface NewTrade {
  instrumentKey: string
  /** Shown for an instrument the catalog does not know; the catalog's own name wins. */
  nameHint: string
  side: TradeSide
  quantity: string
  pricePerUnit: string
  feeUsd: string
  executedAt: Date | null
  opening: boolean
  note: string | null
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = <T>(error: string): Parsed<T> => ({ ok: false, error })
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A decimal amount, as a string so that nothing is lost on the way in. */
function readAmount(raw: unknown, which: keyof typeof AMOUNT_LIMITS): Parsed<string> {
  const { decimals, wholeDigits, label } = AMOUNT_LIMITS[which]
  if (typeof raw !== 'string') return fail(`The ${label} must be sent as a decimal string, such as "0.5", so that no digits are lost.`)
  const text = raw.trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text)
  if (!m) return fail(`The ${label} "${raw}" is not a number of 0 or more written with digits and at most one decimal point.`)
  if ((m[2] ?? '').replace(/0+$/, '').length > decimals) return fail(`The ${label} "${raw}" has more than ${decimals} decimal places.`)
  if (m[1].replace(/^0+(?=\d)/, '').length > wholeDigits) return fail(`The ${label} "${raw}" is too large.`)
  if (which === 'quantity' && !/[1-9]/.test(text)) return fail('The quantity must be more than 0.')
  return { ok: true, value: text }
}

/**
 * A trade as the client sent it, checked and normalised, or the reason it is
 * refused. Anything the lot engine would leave out is refused here, so no saved
 * trade silently does nothing.
 */
export function parseTradeInput(body: unknown, now: Date = new Date()): Parsed<NewTrade> {
  if (!isObject(body)) return fail('Expected a trade as a JSON object.')

  const instrumentKey = typeof body.instrument === 'string' ? body.instrument.trim() : ''
  if (!instrumentKey) return fail('Every trade needs an instrument.')
  const trackable = trackableInstrument(instrumentKey)
  if (!trackable.ok) return fail(trackable.reason)

  const side = body.side
  if (typeof side !== 'string' || !(LEDGER_SIDES as string[]).includes(side)) {
    return fail(`The kind of trade must be one of: ${LEDGER_SIDES.join(', ')}.`)
  }

  const quantity = readAmount(body.quantity, 'quantity')
  if (!quantity.ok) return quantity
  const price = readAmount(body.pricePerUnit, 'pricePerUnit')
  if (!price.ok) return price
  const fee = body.feeUsd === undefined ? { ok: true as const, value: '0' } : readAmount(body.feeUsd, 'feeUsd')
  if (!fee.ok) return fee

  if (body.opening !== undefined && typeof body.opening !== 'boolean') return fail('"opening" must be true or false.')
  const opening = body.opening === true
  if (opening && side !== 'transfer_in') return fail('A starting position is recorded as a transfer in.')

  let executedAt: Date | null = null
  if (body.executedAt === undefined || body.executedAt === null || body.executedAt === '') {
    if (!opening) return fail('Every trade needs a date. Only a starting position may leave it out.')
  } else {
    if (typeof body.executedAt !== 'string') return fail('The date must be sent as an ISO date, such as "2026-03-14" or "2026-03-14T15:30:00Z".')
    executedAt = new Date(body.executedAt)
    if (Number.isNaN(executedAt.getTime())) return fail(`"${body.executedAt}" is not a date.`)
    if (executedAt.getTime() < EARLIEST_TRADE) return fail(`${body.executedAt} is earlier than 1900. Check the year.`)
    if (executedAt.getTime() > now.getTime() + FUTURE_ALLOWANCE_MS) return fail(`${body.executedAt} is in the future. A trade is recorded after it happens.`)
  }

  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return fail('A note must be text.')
  const noteText = typeof body.note === 'string' ? body.note.trim() : ''
  if (noteText.length > MAX_NOTE_LENGTH) return fail(`A note can be at most ${MAX_NOTE_LENGTH} characters.`)

  const trade: NewTrade = {
    instrumentKey,
    nameHint: typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LENGTH) : '',
    side: side as TradeSide,
    quantity: quantity.value,
    pricePerUnit: price.value,
    feeUsd: fee.value,
    executedAt,
    opening,
    note: noteText || null,
  }

  // The engine's own rules, last, so the two can never disagree about what counts.
  const problem = tradeProblem({ ...trade, id: 'new' })
  if (problem) return fail(problem)
  return { ok: true, value: trade }
}

/** A tracked portfolio as the client sent it: an optional id (so a store can be optimistic), a name and a description. */
export function parsePortfolioInput(body: unknown, { partial = false } = {}): Parsed<{ id?: string; name?: string; description?: string }> {
  if (!isObject(body)) return fail('Expected a portfolio as a JSON object.')
  const out: { id?: string; name?: string; description?: string } = {}
  if (body.id !== undefined) {
    if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) return fail('A portfolio id must be a UUID.')
    out.id = body.id
  }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return fail('A portfolio needs a name.')
    out.name = body.name.trim().slice(0, MAX_NAME_LENGTH)
  } else if (!partial) {
    return fail('A portfolio needs a name.')
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') return fail('A description must be text.')
    out.description = body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
  }
  if (partial && out.name === undefined && out.description === undefined) return fail('Nothing to change: send a name, a description or both.')
  return { ok: true, value: out }
}

/** Why a trade is being cancelled. Optional; kept with the cancellation. */
export function parseCancelInput(body: unknown): Parsed<{ reason: string }> {
  if (body === undefined || body === null) return { ok: true, value: { reason: '' } }
  if (!isObject(body)) return fail('Expected a JSON object.')
  if (body.reason !== undefined && body.reason !== null && typeof body.reason !== 'string') return fail('A reason must be text.')
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (reason.length > MAX_REASON_LENGTH) return fail(`A reason can be at most ${MAX_REASON_LENGTH} characters.`)
  return { ok: true, value: { reason } }
}

export const isUuid = (s: string) => UUID_RE.test(s)

// ─── The ledger view ─────────────────────────────────────────────────────────

/** A saved trade with its instrument, as the route reads it. */
export interface StoredTrade {
  id: string
  instrumentKey: string
  symbol: string
  name: string
  side: TradeSide
  quantity: string
  pricePerUnit: string
  feeUsd: string
  executedAt: Date | null
  opening: boolean
  note: string | null
  createdAt: Date
}

export interface StoredCancellation {
  tradeId: string
  reason: string
  createdAt: Date
}

export interface TradeView {
  id: string
  instrumentKey: string
  symbol: string
  name: string
  side: TradeSide
  quantity: string
  pricePerUnit: string
  feeUsd: string
  executedAt: string | null
  opening: boolean
  note: string | null
  createdAt: string
  /** Set once the trade is cancelled; a cancelled trade stays listed and counts for nothing. */
  cancelled: { at: string; reason: string } | null
}

export interface HoldingView {
  instrumentKey: string
  symbol: string
  name: string
  /** The FIFO lots, gains and issues for this one holding. */
  basis: CostBasis
}

export interface LedgerView {
  method: typeof COST_BASIS_METHOD
  /** Printed beside every realized figure (D65). */
  methodLabel: string
  /** Every trade, cancelled ones included, oldest first. */
  trades: TradeView[]
  /** One per instrument with any trade that counts, including ones sold to nothing, by symbol. */
  holdings: HoldingView[]
}

export function toTradeView(t: StoredTrade, cancellation?: StoredCancellation): TradeView {
  return {
    id: t.id,
    instrumentKey: t.instrumentKey,
    symbol: t.symbol,
    name: t.name,
    side: t.side,
    quantity: t.quantity,
    pricePerUnit: t.pricePerUnit,
    feeUsd: t.feeUsd,
    executedAt: t.executedAt ? t.executedAt.toISOString() : null,
    opening: t.opening,
    note: t.note,
    createdAt: t.createdAt.toISOString(),
    cancelled: cancellation ? { at: cancellation.createdAt.toISOString(), reason: cancellation.reason } : null,
  }
}

/** Oldest first; an undated starting position before everything; the order trades were recorded settles the rest. */
function byDate(a: StoredTrade, b: StoredTrade): number {
  const at = a.executedAt?.getTime() ?? null
  const bt = b.executedAt?.getTime() ?? null
  if (at !== bt) {
    if (at === null) return -1
    if (bt === null) return 1
    return at - bt
  }
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * Saved trades and cancellations as the routes return them: every trade listed,
 * and for each instrument the FIFO result over the trades that still count.
 */
export function buildLedgerView(trades: readonly StoredTrade[], cancellations: readonly StoredCancellation[], now: Date = new Date()): LedgerView {
  const cancelledBy = new Map(cancellations.map((c) => [c.tradeId, c]))
  const sorted = [...trades].sort(byDate)

  const groups = new Map<string, { symbol: string; name: string; trades: LedgerTrade[] }>()
  for (const t of sorted) {
    if (cancelledBy.has(t.id)) continue
    const g = groups.get(t.instrumentKey) ?? { symbol: t.symbol, name: t.name, trades: [] }
    g.trades.push({
      id: t.id, side: t.side, quantity: t.quantity, pricePerUnit: t.pricePerUnit,
      feeUsd: t.feeUsd, executedAt: t.executedAt, opening: t.opening,
    })
    groups.set(t.instrumentKey, g)
  }

  return {
    method: COST_BASIS_METHOD,
    methodLabel: REALIZED_METHOD_LABEL,
    trades: sorted.map((t) => toTradeView(t, cancelledBy.get(t.id))),
    holdings: [...groups.entries()]
      .map(([instrumentKey, g]) => ({ instrumentKey, symbol: g.symbol, name: g.name, basis: computeCostBasis(g.trades, now) }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.instrumentKey.localeCompare(b.instrumentKey)),
  }
}

// ─── Valuing it at live prices ───────────────────────────────────────────────

export interface HoldingValue {
  instrumentKey: string
  symbol: string
  name: string
  quantityHeld: string
  costHeldUsd: string
  averageCostUsd: string | null
  /** The live price used, or null when there is none. */
  priceUsd: number | null
  /** Units held times the live price; null with no live price. */
  valueUsd: string | null
  /** Value less what the units held cost; null with no live price. */
  unrealizedUsd: string | null
  realizedGainUsd: string
  realizedFromStartingPositionUsd: string
  issues: LedgerIssue[]
}

export interface LedgerTotals {
  /** What everything held cost. */
  costHeldUsd: string
  /** What the priced holdings cost: the figure value is compared against. */
  pricedCostUsd: string
  /** Priced holdings only. A holding with no live price is left out, never valued at cost. */
  valueUsd: string
  unrealizedUsd: string
  realizedGainUsd: string
  realizedFromStartingPositionUsd: string
  /** Holdings with units still held. */
  heldCount: number
  /** Of those, how many have a live price. */
  pricedCount: number
  /** Symbols held with no live price. */
  unpriced: string[]
}

const isHeld = (h: HoldingView) => h.basis.quantityHeld !== '0'

/**
 * Each holding at its live price, and the portfolio's totals. Prices are keyed
 * by instrument key, as fetchInstrumentPrices returns them. Value and unrealized
 * gain count priced holdings only, and the totals say how many that is.
 */
export function valueLedger(view: LedgerView, prices: Readonly<Record<string, number>>): { holdings: HoldingValue[]; totals: LedgerTotals } {
  const holdings: HoldingValue[] = view.holdings.map((h) => {
    const held = isHeld(h)
    const price = held ? prices[h.instrumentKey] ?? null : null
    const valueUsd = held ? valueAtPrice(h.basis.quantityHeld, price) : null
    return {
      instrumentKey: h.instrumentKey,
      symbol: h.symbol,
      name: h.name,
      quantityHeld: h.basis.quantityHeld,
      costHeldUsd: h.basis.costHeldUsd,
      averageCostUsd: h.basis.averageCostUsd,
      priceUsd: valueUsd === null ? null : price,
      valueUsd,
      unrealizedUsd: valueUsd === null ? null : differenceUsd(valueUsd, h.basis.costHeldUsd),
      realizedGainUsd: h.basis.realizedGainUsd,
      realizedFromStartingPositionUsd: h.basis.realizedFromStartingPositionUsd,
      issues: h.basis.issues,
    }
  })

  const held = holdings.filter((h) => h.quantityHeld !== '0')
  const priced = held.filter((h) => h.valueUsd !== null)
  const pricedCostUsd = sumUsd(priced.map((h) => h.costHeldUsd))
  const valueUsd = sumUsd(priced.map((h) => h.valueUsd as string))
  return {
    holdings,
    totals: {
      costHeldUsd: sumUsd(held.map((h) => h.costHeldUsd)),
      pricedCostUsd,
      valueUsd,
      unrealizedUsd: differenceUsd(valueUsd, pricedCostUsd),
      realizedGainUsd: sumUsd(holdings.map((h) => h.realizedGainUsd)),
      realizedFromStartingPositionUsd: sumUsd(holdings.map((h) => h.realizedFromStartingPositionUsd)),
      heldCount: held.length,
      pricedCount: priced.length,
      unpriced: held.filter((h) => h.valueUsd === null).map((h) => h.symbol),
    },
  }
}

// ─── Words and figures for the screen ────────────────────────────────────────

const group = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** An exact dollar figure as "$1,234.50" or "-$12.00", rounded to cents (halves away from zero). */
export function formatUsd(value: string): string {
  const cents = toCents(value)
  const neg = cents.startsWith('-')
  const [whole, frac] = (neg ? cents.slice(1) : cents).split('.')
  return `${neg ? '-' : ''}$${group(whole)}.${frac}`
}

/** A signed change, "+$1,234.50" or "-$12.00"; nothing is signed when it rounds to zero. */
export function formatUsdChange(value: string): string {
  const text = formatUsd(value)
  return text.startsWith('-') || text === '$0.00' ? text : `+${text}`
}

/** A price per unit: to the cent from $1 up, otherwise every decimal the column keeps (up to 8). */
export function formatUnitPrice(value: string): string {
  const [whole, frac = ''] = value.replace(/^-/, '').split('.')
  if (whole !== '0') return formatUsd(value)
  return `${value.startsWith('-') ? '-' : ''}$0.${(frac || '00').padEnd(2, '0')}`
}

/** A stored amount without the zeros its column pads it with: "10.50000000" is "10.5". A whole number is left alone. */
export function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}

/** A live price, which arrives as a number, the same way as formatUnitPrice. */
export function formatLivePrice(price: number): string {
  return formatUnitPrice(trimDecimal(price.toFixed(8)))
}

/** Units with thousands separators; the decimals stay exactly as given. */
export function formatUnits(value: string): string {
  const neg = value.startsWith('-')
  const [whole, frac] = (neg ? value.slice(1) : value).split('.')
  return `${neg ? '-' : ''}${group(whole)}${frac ? `.${frac}` : ''}`
}

/** What each kind of trade is called on the screen. A starting position is a transfer in marked as one. */
export function tradeKindLabel(t: { side: TradeSide; opening: boolean }): string {
  if (t.opening) return 'Starting position'
  return { buy: 'Buy', sell: 'Sell', transfer_in: 'Transfer in', transfer_out: 'Transfer out' }[t.side]
}

