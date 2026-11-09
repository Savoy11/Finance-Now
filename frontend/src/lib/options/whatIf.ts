/**
 * Options Calculator — "what if" sliders (T-062 on the calculator; owner decision D216, 2026-11-09).
 *
 * Move the underlying price or every leg's implied volatility and see what the
 * position would be worth if that happened now, by the same Black-Scholes-Merton
 * model the Greeks use, beside what it pays at expiry at that price.
 *
 * Arithmetic on the user's own figures, like the rest of the calculator: no grade,
 * no score, no "safer" (D92; memo §5.8). The model value of an option is not its
 * market price. If the premiums typed in differ from the model's price at the
 * volatilities typed in, the gap shows in `pnlNow`; `changeFromNow` leaves it out,
 * since it compares the model with itself.
 */

import { blackScholes, positionGreeks, type GreeksMarket, type PositionGreeks } from './greeks'
import { DEFAULT_MULTIPLIER, payoffAtExpiry, type CalcPosition } from './payoff'

/** The price slider runs this many percent either side of the price entered. */
export const PRICE_MOVE_MAX_PCT = 50
/** The volatility slider runs this many points either side of each leg's volatility. */
export const VOL_SHIFT_MAX_PTS = 30
/** The lowest volatility any leg may be shifted to, in points: the model needs one above 0. */
export const VOL_FLOOR_PTS = 1

/**
 * The volatility slider's range for these legs: up to VOL_SHIFT_MAX_PTS either way,
 * but never so far down that a leg's volatility falls under VOL_FLOOR_PTS.
 */
export function volShiftBounds(volatilityPct: number[]): { min: number; max: number } {
  if (volatilityPct.length === 0) return { min: 0, max: 0 }
  const lowest = Math.min(...volatilityPct)
  const min = Math.max(-VOL_SHIFT_MAX_PTS, Math.ceil(VOL_FLOOR_PTS - lowest))
  return { min: Math.min(0, min), max: VOL_SHIFT_MAX_PTS }
}

/** Each leg's volatility moved by the same number of points. Refuses one that would reach 0. */
export function shiftedVols(volatilityPct: number[], shiftPts: number): number[] {
  const out = volatilityPct.map((v) => v + shiftPts)
  if (out.some((v) => !(v > 0))) throw new RangeError('a volatility shifted to 0 or below has no model value')
  return out
}

/**
 * Profit or loss if the market were at `m` now: each leg at its model value less the
 * premium paid (or plus the premium received), and any shares at `m.spot` less their
 * cost. At expiry (no days left) it is the payoff at expiry, which the model reaches
 * in the limit.
 */
export function modelPnlNow(p: CalcPosition, volatilityPct: number[], m: GreeksMarket): number {
  if (volatilityPct.length !== p.legs.length) throw new Error('one volatility per leg')
  if (!(m.daysToExpiry > 0)) return payoffAtExpiry(p, m.spot)
  const perContract = p.multiplier ?? DEFAULT_MULTIPLIER
  let total = 0
  p.legs.forEach((l, i) => {
    const value = blackScholes({
      type: l.type, spot: m.spot, strike: l.strike, years: m.daysToExpiry / 365,
      rate: m.ratePct / 100, dividendYield: m.dividendYieldPct / 100, volatility: volatilityPct[i] / 100,
    }).price
    total += (l.side === 'long' ? 1 : -1) * (value - l.premium) * l.contracts * perContract
  })
  if (p.shares) total += p.shares * (m.spot - (p.shareCost ?? 0))
  return total
}

export interface WhatIfMove {
  /** Percent change in the underlying from the price entered, e.g. -10. */
  priceMovePct: number
  /** Points added to every leg's implied volatility, e.g. 5. */
  volShiftPts: number
}

export interface WhatIfResult {
  /** The underlying price the move gives. */
  spot: number
  /** Each leg's volatility after the shift, in percent. */
  volatilityPct: number[]
  /** Model profit or loss if this happened now, against what was paid. */
  pnlNow: number
  /** The model's change from the position as entered: the effect of the move alone. */
  changeFromNow: number
  /** Profit or loss at expiry if the underlying closed at `spot`. */
  pnlAtExpiry: number
  /** The position's Greeks at the moved price and volatility. */
  greeks: PositionGreeks
}

/**
 * The position after a move in price and volatility, now and at expiry. Needs time
 * left and a volatility on every leg, as the Greeks do.
 */
export function whatIf(p: CalcPosition, volatilityPct: number[], m: GreeksMarket, move: WhatIfMove): WhatIfResult {
  if (!(m.daysToExpiry > 0)) throw new RangeError('what-if needs time left before expiry')
  const spot = m.spot * (1 + move.priceMovePct / 100)
  if (!(spot > 0)) throw new RangeError('the moved price must stay above 0')
  const vols = shiftedVols(volatilityPct, move.volShiftPts)
  const moved: GreeksMarket = { ...m, spot }
  const pnlNow = modelPnlNow(p, vols, moved)
  return {
    spot,
    volatilityPct: vols,
    pnlNow,
    changeFromNow: pnlNow - modelPnlNow(p, volatilityPct, m),
    pnlAtExpiry: payoffAtExpiry(p, spot),
    greeks: positionGreeks(p, vols, moved),
  }
}

/**
 * The "today, by the model" line for the payoff chart: model profit or loss now at
 * each price, at the volatilities given (already shifted, if the slider moved them).
 */
export function modelPnlAt(p: CalcPosition, volatilityPct: number[], m: GreeksMarket, prices: number[]): number[] {
  // The chart starts at a price of 0, where the model needs a number above 0: a millionth
  // of a dollar gives the same value to the cent.
  return prices.map((price) => modelPnlNow(p, volatilityPct, { ...m, spot: Math.max(price, 1e-6) }))
}
