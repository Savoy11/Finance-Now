// ─── Tracked portfolios, read by the rest of the app (T-453, D207, D208) ─────
//
// Since T-447 and T-451 a tracked portfolio holds real history: imported trades and
// income. Everything else that speaks about "your portfolio" read only the what-if
// portfolios. This file turns a tracked portfolio's ledger into what those features
// need, so they read the real one too:
//
//   · trackedBriefSymbols: the tickers the Daily Brief is grounded in. Tickers only,
//     never units or costs, as the draft Privacy Policy says of the Brief.
//   · trackedClassSplit and trackedLookThroughPositions: how the money splits across
//     coins, stocks and funds, and what the funds hold, by live value.
//   · actualWeightsFromTracked: the weights the Portfolio Builder's drift check
//     compares a plan with (the owner allowed it on real money, D208).
//   · portfolioReturn: what the money has earned per year, once the portfolio is a
//     year old, and the plain total return before that (owner, D208).
//
// Every figure is worked out from live values only. A holding with no live price is
// left out and named, never valued at its cost, as on the tracked portfolio's page.
// Pure, with the clock injectable (__tests__/trackedPortfolioViews.test.ts).

import { differenceUsd, sumUsd, valueAtPrice } from './costBasis'
import { CLASS_LABELS, INSTRUMENT_BY_KEY, isSecurityKey, type InstrumentClass } from './instruments'
import { CATEGORY_META } from './portfolioCoins'
import { CLASS_SLICE_COLORS } from './portfolioUtils'
import type { ActualWeights } from './portfolioBuilder'
import type { LookThroughPosition } from './lookThrough'
import type { HoldingValue, LedgerTotals, LedgerView, TradeView } from './tradeLedger'

const held = (h: HoldingValue) => h.quantityHeld !== '0'
const priced = (h: HoldingValue): h is HoldingValue & { valueUsd: string } => held(h) && h.valueUsd !== null
const num = (usd: string) => Number(usd)
const round1 = (n: number) => Math.round(n * 10) / 10

/** What the app knows of an instrument's class: the catalog's, else coin or security by its key. */
function classOf(key: string): InstrumentClass | null {
  return INSTRUMENT_BY_KEY[key]?.class ?? (isSecurityKey(key) ? null : 'crypto')
}

// ─── (a) The Daily Brief's tickers ───────────────────────────────────────────

/**
 * "BTC (crypto)", "VOO (etf)": one per holding still held, the form the Brief already sends for
 * what-if portfolios and watchlists. A security outside the catalog is "(stock or fund)", since
 * the app does not know which.
 */
export function trackedBriefSymbols(view: LedgerView): string[] {
  return view.holdings
    .filter((h) => Number(h.basis.quantityHeld) > 0)
    .map((h) => `${h.symbol} (${classOf(h.instrumentKey) ?? 'stock or fund'})`)
}

// ─── (b) How the money splits, and what the funds hold ───────────────────────

export interface ClassSlice {
  key: string
  label: string
  color: string
  /** Share of the priced holdings' live value, 0–100. */
  pct: number
  valueUsd: number
}

export interface TrackedSplit {
  slices: ClassSlice[]
  /** Live value of the priced holdings: what every share is of. */
  valueUsd: number
  /** Symbols held with no live price, left out of every share. */
  unpriced: string[]
}

const OTHER_SECURITY = { label: 'Stocks and funds outside the catalog', color: '#64748b' }

/**
 * Coins by their category, everything else by class, as the what-if Analysis tab splits a
 * portfolio, but by live value rather than target allocation.
 */
export function trackedClassSplit(holdings: readonly HoldingValue[]): TrackedSplit {
  const map = new Map<string, { label: string; color: string; value: number }>()
  for (const h of holdings.filter(priced)) {
    const inst = INSTRUMENT_BY_KEY[h.instrumentKey]
    const cls = classOf(h.instrumentKey)
    let key: string
    let meta: { label: string; color: string }
    if (cls === 'crypto') {
      const cat = inst?.category
      key = `cat:${cat ?? 'other'}`
      meta = cat && CATEGORY_META[cat] ? CATEGORY_META[cat] : { label: 'Other coins', color: '#64748b' }
    } else if (cls) {
      key = `class:${cls}`
      meta = { label: CLASS_LABELS[cls], color: CLASS_SLICE_COLORS[cls as Exclude<InstrumentClass, 'crypto'>] ?? '#64748b' }
    } else {
      key = 'other-security'
      meta = OTHER_SECURITY
    }
    const s = map.get(key) ?? { ...meta, value: 0 }
    s.value += num(h.valueUsd)
    map.set(key, s)
  }
  const valueUsd = [...map.values()].reduce((s, x) => s + x.value, 0)
  const slices = [...map.entries()]
    .map(([key, s]) => ({ key, label: s.label, color: s.color, valueUsd: s.value, pct: valueUsd > 0 ? (s.value / valueUsd) * 100 : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd || a.label.localeCompare(b.label))
  return { slices, valueUsd, unpriced: holdings.filter((h) => held(h) && h.valueUsd === null).map((h) => h.symbol) }
}

/**
 * Each priced holding's share of live value, for computeLookThrough. A catalog ETF or mutual
 * fund is looked through; anything else is held directly. A security outside the catalog is
 * treated as held directly, since the app cannot tell whether it is a fund.
 */
export function trackedLookThroughPositions(holdings: readonly HoldingValue[]): {
  positions: LookThroughPosition[]
  funds: string[]
  unpriced: string[]
} {
  const p = holdings.filter(priced)
  const total = p.reduce((s, h) => s + num(h.valueUsd), 0)
  const positions = total > 0
    ? p.map((h) => {
        const cls = INSTRUMENT_BY_KEY[h.instrumentKey]?.class
        return { symbol: h.symbol.toUpperCase(), weightPct: (num(h.valueUsd) / total) * 100, isFund: cls === 'etf' || cls === 'mutual' }
      })
    : []
  return {
    positions,
    funds: positions.filter((x) => x.isFund).map((x) => x.symbol),
    unpriced: holdings.filter((h) => held(h) && h.valueUsd === null).map((h) => h.symbol),
  }
}

// ─── (c) The drift check's weights ───────────────────────────────────────────

/**
 * A tracked portfolio as the drift check reads a portfolio: each priced holding's share of
 * live value, by symbol. A holding with no live price is left out; how much is left out is
 * measured by what the holdings cost, the one figure every holding has.
 */
export function actualWeightsFromTracked(holdings: readonly HoldingValue[]): ActualWeights & { unpriced: string[] } {
  const p = holdings.filter(priced)
  const heldAll = holdings.filter(held)
  const valueUsd = p.reduce((s, h) => s + num(h.valueUsd), 0)
  const weights: Record<string, number> = {}
  if (valueUsd > 0) {
    for (const h of p) {
      const symbol = h.symbol.toUpperCase()
      weights[symbol] = round1((weights[symbol] ?? 0) + (num(h.valueUsd) / valueUsd) * 100)
    }
  }
  const costAll = heldAll.reduce((s, h) => s + num(h.costHeldUsd), 0)
  const costUnpriced = heldAll.filter((h) => h.valueUsd === null).reduce((s, h) => s + num(h.costHeldUsd), 0)
  const unpricedPct = costAll > 0 ? round1((costUnpriced / costAll) * 100) : 0
  return {
    weights,
    valueUsd: Math.round(valueUsd),
    pricedPct: round1(100 - unpricedPct),
    unpricedPct,
    noCostBasisPct: 0,
    unpriced: heldAll.filter((h) => h.valueUsd === null).map((h) => h.symbol),
  }
}

/**
 * What the drift check left out of a tracked portfolio, in words, or null when nothing was.
 *
 * Never hidden under a threshold (code audit 2026-11-09, D214). A holding is left out because it has
 * no live price, so how much it is worth now is not known; what it cost says nothing about that. A
 * Bitcoin bought for $400 years ago is 0.8% of a $50,400 cost basis and can be most of the
 * portfolio's value today. The check used to name nothing below 1% of cost and call the rest
 * "live value".
 */
export function trackedLeftOutNotice(unpriced: readonly string[]): string | null {
  const names = [...new Set(unpriced.map((s) => s.toUpperCase()))]
  if (names.length === 0) return null
  const shown = names.length <= 4 ? names : [...names.slice(0, 3), `${names.length - 3} more`]
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
  const one = names.length === 1
  return `Left out: ${list}, with no live price right now. What ${one ? 'it is' : 'they are'} worth is not known, so the weights and the buy and sell amounts below are worked out without ${one ? 'it' : 'them'}.`
}

// ─── (d) What the money has earned ───────────────────────────────────────────

/** The yearly figure shows once the first money put in is this many days old (owner, D208). */
export const YEARLY_AFTER_DAYS = 365

const DAY_MS = 86_400_000

/** One movement of money between the person and the portfolio. */
export interface MoneyFlow {
  /** ISO date, or null for an undated starting position. */
  date: string | null
  /** Dollars, positive: what was put in or taken out. */
  amountUsd: string
  direction: 'in' | 'out'
}

/**
 * The money the person put in and took out, from the trades that still count:
 *   · a buy, a transfer in and a starting position put in units × price, plus the fee
 *     (a transfer in and a starting position at the cost entered for them);
 *   · a sale takes out units × price, less the fee;
 *   · cash income takes out its amount (it is paid to the person, not kept in the portfolio);
 *   · units received as income and a split move no money: their effect is in what the
 *     holdings are worth now.
 * A transfer out has no figure (it moves units out at their cost, and the app does not know
 * what they were worth), so its presence is reported, not guessed.
 */
export function moneyFlows(trades: readonly TradeView[]): { flows: MoneyFlow[]; transferOut: boolean } {
  const flows: MoneyFlow[] = []
  let transferOut = false
  for (const t of trades) {
    if (t.cancelled) continue
    const gross = () => valueAtPrice(t.quantity, Number(t.pricePerUnit)) ?? '0'
    switch (t.side) {
      case 'buy':
      case 'transfer_in':
        flows.push({ date: t.executedAt, amountUsd: sumUsd([gross(), t.feeUsd]), direction: 'in' })
        break
      case 'sell':
        flows.push({ date: t.executedAt, amountUsd: differenceUsd(gross(), t.feeUsd), direction: 'out' })
        break
      case 'income':
        if (t.income) flows.push({ date: t.executedAt, amountUsd: t.income.amountUsd, direction: 'out' })
        break
      case 'transfer_out':
        transferOut = true
        break
      default:
        break // income_units, split: no money moves
    }
  }
  return { flows, transferOut }
}

/**
 * The yearly rate r at which the money put in, grown, equals the money taken out and the value
 * now: Σ amount × (1 + r)^(years before now) = 0, with money in negative. Found by bisection
 * between rates that bracket it; null when none does. A percent, e.g. 7.25.
 */
export function moneyWeightedRate(cashflows: ReadonlyArray<{ years: number; amount: number }>): number | null {
  if (!cashflows.some((c) => c.amount < 0) || !cashflows.some((c) => c.amount > 0)) return null
  const npv = (r: number) => cashflows.reduce((s, c) => s + c.amount * Math.pow(1 + r, c.years), 0)
  const points = [-0.9999, -0.99, -0.9, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 1, 2, 5, 10, 100]
  for (let i = 0; i < points.length - 1; i++) {
    let lo = points[i], hi = points[i + 1]
    let flo = npv(lo)
    const fhi = npv(hi)
    if (!Number.isFinite(flo) || !Number.isFinite(fhi)) continue
    if (flo === 0) return lo * 100
    if (flo * fhi > 0) continue
    for (let k = 0; k < 200 && hi - lo > 1e-10; k++) {
      const mid = (lo + hi) / 2
      const fm = npv(mid)
      if (fm === 0) return mid * 100
      if (fm * flo < 0) hi = mid
      else { lo = mid; flo = fm }
    }
    return ((lo + hi) / 2) * 100
  }
  return null
}

export type PortfolioReturn =
  | {
      kind: 'yearly'
      /** Percent a year, money-weighted. */
      ratePct: number
      /** The date of the first money put in. */
      since: string
      investedUsd: string
      takenOutUsd: string
      valueUsd: string
      gainUsd: string
    }
  | {
      kind: 'total'
      /** (value now + money taken out − money put in) ÷ money put in, percent. */
      pct: number
      why: 'under-a-year' | 'undated-start' | 'no-rate'
      since: string | null
      investedUsd: string
      takenOutUsd: string
      valueUsd: string
      gainUsd: string
    }
  | { kind: 'none'; why: 'nothing-put-in' | 'unpriced' | 'transfer-out'; unpriced?: string[] }

/**
 * What the money in a tracked portfolio has earned: money-weighted, per year, once the first
 * money put in is a year old; the plain total return before that, or where a date is missing.
 * Nothing at all while a holding has no live price (a figure leaving it out would be wrong, and
 * valuing it at cost is never done) or after a transfer out (see moneyFlows).
 */
export function portfolioReturn(
  trades: readonly TradeView[],
  totals: Pick<LedgerTotals, 'valueUsd' | 'unpriced'>,
  now: Date = new Date(),
): PortfolioReturn {
  const { flows, transferOut } = moneyFlows(trades)
  if (transferOut) return { kind: 'none', why: 'transfer-out' }
  if (totals.unpriced.length > 0) return { kind: 'none', why: 'unpriced', unpriced: [...totals.unpriced] }
  const ins = flows.filter((f) => f.direction === 'in')
  const outs = flows.filter((f) => f.direction === 'out')
  const investedUsd = sumUsd(ins.map((f) => f.amountUsd))
  if (!(Number(investedUsd) > 0)) return { kind: 'none', why: 'nothing-put-in' }
  const takenOutUsd = sumUsd(outs.map((f) => f.amountUsd))
  const valueUsd = totals.valueUsd
  const gainUsd = differenceUsd(sumUsd([valueUsd, takenOutUsd]), investedUsd)
  const totalPct = (Number(gainUsd) / Number(investedUsd)) * 100
  const base = { investedUsd, takenOutUsd, valueUsd, gainUsd }

  if (flows.some((f) => f.date === null)) return { kind: 'total', pct: totalPct, why: 'undated-start', since: null, ...base }
  const since = flows.map((f) => f.date as string).sort()[0]
  const ageDays = (now.getTime() - new Date(since).getTime()) / DAY_MS
  if (ageDays < YEARLY_AFTER_DAYS) return { kind: 'total', pct: totalPct, why: 'under-a-year', since: since.slice(0, 10), ...base }

  const years = (date: string) => Math.max(0, (now.getTime() - new Date(date).getTime()) / DAY_MS / 365)
  const cashflows = [
    ...flows.map((f) => ({ years: years(f.date as string), amount: (f.direction === 'in' ? -1 : 1) * Number(f.amountUsd) })),
    { years: 0, amount: Number(valueUsd) },
  ]
  const ratePct = moneyWeightedRate(cashflows)
  if (ratePct === null) return { kind: 'total', pct: totalPct, why: 'no-rate', since: since.slice(0, 10), ...base }
  return { kind: 'yearly', ratePct, since: since.slice(0, 10), ...base }
}

/** "+7.3% a year" / "−2.1%" with a true minus sign. */
export function formatReturnPct(pct: number): string {
  const r = Math.round(pct * 10) / 10
  if (r === 0) return '0.0%'
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}%`
}
