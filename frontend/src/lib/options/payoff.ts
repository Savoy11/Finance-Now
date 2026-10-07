/**
 * Options Calculator — payoff at expiry (T-420 item 4, D93).
 *
 * Arithmetic on a position the user enters: what it is worth at expiry for
 * each price of the underlying, its maximum gain and loss, and its
 * breakevens. No grade, no score and no "safer": D92 and the risk-ratings memo
 * (§5.8) put the graded scorer off and allow this calculator in its place.
 *
 * Every figure comes from the user. Finance Now carries no options chain (no
 * source it may use publishes one: docs/assessments/P2-O1-options-data.md),
 * so a premium here is what the user typed from their broker, never inferred.
 *
 * Conventions:
 *   • Premiums are per share, as chains quote them; a contract covers
 *     `multiplier` shares (100 for US equity options).
 *   • Long pays the premium, short receives it.
 *   • A stock position is optional (`shares`, negative for short), valued
 *     against the price the user paid for it.
 *   • P/L at expiry only. The underlying cannot go below 0, so the lowest
 *     price examined is 0; above the highest strike the position is a
 *     straight line, so its slope there decides whether gain or loss is
 *     unlimited.
 */

export type OptionSide = 'long' | 'short'
export type OptionType = 'call' | 'put'

export interface CalcLeg {
  side: OptionSide
  type: OptionType
  strike: number
  /** Per share, as quoted on the chain. */
  premium: number
  /** Number of contracts, above 0. */
  contracts: number
}

export interface CalcPosition {
  legs: CalcLeg[]
  /** Shares held alongside the options; negative for a short position. */
  shares?: number
  /** Price per share paid (or received, for a short) for `shares`. */
  shareCost?: number
  /** Shares per contract. Defaults to 100. */
  multiplier?: number
}

export const DEFAULT_MULTIPLIER = 100

const sign = (side: OptionSide) => (side === 'long' ? 1 : -1)
const mult = (p: CalcPosition) => p.multiplier ?? DEFAULT_MULTIPLIER

/** Intrinsic value per share of one option at expiry. */
export function intrinsic(type: OptionType, strike: number, price: number): number {
  return type === 'call' ? Math.max(price - strike, 0) : Math.max(strike - price, 0)
}

/**
 * Cash at opening, in dollars: positive is a net credit (received), negative
 * a net debit (paid). Shares are not included; their cost is in `shareCost`.
 */
export function netPremiumUsd(p: CalcPosition): number {
  return p.legs.reduce((sum, l) => sum - sign(l.side) * l.premium * l.contracts * mult(p), 0)
}

/** Profit or loss in dollars at expiry if the underlying closes at `price`. */
export function payoffAtExpiry(p: CalcPosition, price: number): number {
  const m = mult(p)
  let total = 0
  for (const l of p.legs) {
    total += sign(l.side) * (intrinsic(l.type, l.strike, price) - l.premium) * l.contracts * m
  }
  if (p.shares) total += p.shares * (price - (p.shareCost ?? 0))
  return total
}

/** The dollar change in P/L per $1 rise in the underlying, above every strike. */
export function slopeAboveStrikes(p: CalcPosition): number {
  const m = mult(p)
  const calls = p.legs.reduce((s, l) => s + (l.type === 'call' ? sign(l.side) * l.contracts * m : 0), 0)
  return calls + (p.shares ?? 0)
}

export interface PayoffSummary {
  /** Net premium at opening: positive is a credit, negative a debit. */
  netPremiumUsd: number
  /** Largest profit at expiry, or 'unlimited' if it grows without bound. */
  maxGainUsd: number | 'unlimited'
  /** Largest loss at expiry as a positive number, or 'unlimited'. 0 if no price loses. */
  maxLossUsd: number | 'unlimited'
  /** Underlying prices at which the position neither gains nor loses at expiry, ascending. */
  breakevens: number[]
  /** The prices where the payoff line bends: 0 and each distinct strike. */
  kinks: number[]
}

const EPS = 1e-9
const round = (x: number) => Math.round(x * 1e6) / 1e6

export function summarizePayoff(p: CalcPosition): PayoffSummary {
  const strikes = [...new Set(p.legs.map((l) => l.strike))].sort((a, b) => a - b)
  const kinks = [0, ...strikes.filter((k) => k > 0)]
  const values = kinks.map((k) => payoffAtExpiry(p, k))
  const slope = slopeAboveStrikes(p)

  const best = Math.max(...values)
  const worst = Math.min(...values)
  const maxGainUsd: number | 'unlimited' = slope > EPS ? 'unlimited' : round(Math.max(best, 0))
  const maxLossUsd: number | 'unlimited' = slope < -EPS ? 'unlimited' : round(Math.max(-worst, 0))

  // Breakevens: where the piecewise-linear payoff crosses zero.
  const found: number[] = []
  const add = (x: number) => {
    if (x < 0) return
    if (!found.some((f) => Math.abs(f - x) < 1e-6)) found.push(x)
  }
  for (let i = 0; i < kinks.length; i++) {
    const a = kinks[i], va = values[i]
    if (Math.abs(va) < EPS) add(a)
    if (i + 1 < kinks.length) {
      const b = kinks[i + 1], vb = values[i + 1]
      if ((va < -EPS && vb > EPS) || (va > EPS && vb < -EPS)) add(a + (b - a) * (-va / (vb - va)))
    }
  }
  // Beyond the highest kink the line continues with `slope`.
  const last = kinks[kinks.length - 1], vLast = values[values.length - 1]
  if (Math.abs(slope) > EPS && Math.abs(vLast) > EPS) {
    const x = last - vLast / slope
    if (x > last) add(x)
  }

  return {
    netPremiumUsd: round(netPremiumUsd(p)),
    maxGainUsd,
    maxLossUsd,
    breakevens: found.sort((a, b) => a - b).map(round),
    kinks,
  }
}

export interface PayoffPoint {
  price: number
  pnl: number
}

/**
 * Points for a payoff chart from `lo` to `hi`, evenly spaced, with every
 * strike and breakeven inside the range added exactly, so the chart's corners
 * fall where the payoff actually bends.
 */
export function payoffSeries(p: CalcPosition, lo: number, hi: number, steps = 120): PayoffPoint[] {
  const from = Math.max(0, Math.min(lo, hi))
  const to = Math.max(lo, hi)
  const xs = new Set<number>()
  for (let i = 0; i <= steps; i++) xs.add(round(from + ((to - from) * i) / steps))
  const s = summarizePayoff(p)
  for (const x of [...s.kinks, ...s.breakevens]) if (x >= from && x <= to) xs.add(round(x))
  return [...xs].sort((a, b) => a - b).map((price) => ({ price, pnl: round(payoffAtExpiry(p, price)) }))
}

/**
 * A chart range wide enough to show every strike, every breakeven and the
 * current price, with a margin on each side.
 */
export function chartRange(p: CalcPosition, underlying: number): { lo: number; hi: number } {
  const s = summarizePayoff(p)
  const marks = [underlying, ...p.legs.map((l) => l.strike), ...s.breakevens].filter((x) => x > 0)
  const min = Math.min(...marks), max = Math.max(...marks)
  const pad = Math.max((max - min) * 0.35, underlying * 0.15)
  return { lo: Math.max(0, min - pad), hi: max + pad }
}
