/**
 * Options Calculator — Black-Scholes Greeks (T-420 item 4, D93).
 *
 * The Greeks of a position the user enters, from the implied volatility the
 * user enters. The model is the standard Black-Scholes-Merton formula for a
 * European option with a continuous dividend yield. US equity options are
 * American, so these are the usual approximation every broker's chain shows,
 * not an exact value for early exercise. That is stated on the page.
 *
 * Arithmetic only: the same inputs give anyone the same numbers. Nothing here
 * grades a trade (D92; memo §5.8).
 */

import { DEFAULT_MULTIPLIER, type CalcPosition, type OptionType } from './payoff'

/**
 * Standard normal cumulative distribution. Abramowitz & Stegun 26.2.17,
 * absolute error below 7.5e-8, ample for figures shown to four places.
 */
export function normCdf(x: number): number {
  if (x < 0) return 1 - normCdf(-x)
  const t = 1 / (1 + 0.2316419 * x)
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return 1 - normPdf(x) * poly
}

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export interface BsInputs {
  type: OptionType
  /** Underlying price. */
  spot: number
  strike: number
  /** Years to expiry, above 0. */
  years: number
  /** Risk-free rate as a decimal (0.05 = 5%). */
  rate: number
  /** Continuous dividend yield as a decimal. */
  dividendYield: number
  /** Implied volatility as a decimal (0.25 = 25%), above 0. */
  volatility: number
}

export interface BsResult {
  /** Theoretical value per share. */
  price: number
  /** Change in value per $1 rise in the underlying, per share. */
  delta: number
  /** Change in delta per $1 rise in the underlying, per share. */
  gamma: number
  /** Change in value per calendar day that passes, per share. */
  thetaPerDay: number
  /** Change in value per 1 percentage point rise in volatility, per share. */
  vegaPerPoint: number
}

export function blackScholes(i: BsInputs): BsResult {
  const { type, spot: S, strike: K, years: T, rate: r, dividendYield: q, volatility: v } = i
  if (!(S > 0) || !(K > 0) || !(T > 0) || !(v > 0)) {
    throw new Error('Black-Scholes needs a price, strike, time and volatility above 0')
  }
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r - q + (v * v) / 2) * T) / (v * sqrtT)
  const d2 = d1 - v * sqrtT
  const dq = Math.exp(-q * T), dr = Math.exp(-r * T)
  const pdf = normPdf(d1)

  const gamma = (dq * pdf) / (S * v * sqrtT)
  const vega = S * dq * pdf * sqrtT
  const common = -(S * dq * pdf * v) / (2 * sqrtT)

  if (type === 'call') {
    const price = S * dq * normCdf(d1) - K * dr * normCdf(d2)
    const theta = common - r * K * dr * normCdf(d2) + q * S * dq * normCdf(d1)
    return { price, delta: dq * normCdf(d1), gamma, thetaPerDay: theta / 365, vegaPerPoint: vega / 100 }
  }
  const price = K * dr * normCdf(-d2) - S * dq * normCdf(-d1)
  const theta = common + r * K * dr * normCdf(-d2) - q * S * dq * normCdf(-d1)
  return { price, delta: -dq * normCdf(-d1), gamma, thetaPerDay: theta / 365, vegaPerPoint: vega / 100 }
}

export interface PositionGreeks {
  /** Share-equivalents: the position moves like this many shares for a small move. */
  delta: number
  /** Change in `delta` per $1 rise in the underlying. */
  gamma: number
  /** Dollars gained (+) or lost (−) per calendar day, other things equal. */
  thetaPerDay: number
  /** Dollars gained or lost per 1 percentage point rise in volatility. */
  vegaPerPoint: number
}

export interface GreeksMarket {
  spot: number
  /** Days to expiry, above 0. */
  daysToExpiry: number
  /** Percent, e.g. 4.5. */
  ratePct: number
  /** Percent, e.g. 1.2. */
  dividendYieldPct: number
}

/**
 * Net Greeks of a position. `volatilityPct` holds each leg's implied
 * volatility in percent, in leg order. Shares add their count to delta.
 */
export function positionGreeks(p: CalcPosition, volatilityPct: number[], m: GreeksMarket): PositionGreeks {
  if (volatilityPct.length !== p.legs.length) throw new Error('one volatility per leg')
  const perContract = p.multiplier ?? DEFAULT_MULTIPLIER
  const out: PositionGreeks = { delta: p.shares ?? 0, gamma: 0, thetaPerDay: 0, vegaPerPoint: 0 }
  p.legs.forEach((l, idx) => {
    const g = blackScholes({
      type: l.type, spot: m.spot, strike: l.strike, years: m.daysToExpiry / 365,
      rate: m.ratePct / 100, dividendYield: m.dividendYieldPct / 100, volatility: volatilityPct[idx] / 100,
    })
    const n = (l.side === 'long' ? 1 : -1) * l.contracts * perContract
    out.delta += n * g.delta
    out.gamma += n * g.gamma
    out.thetaPerDay += n * g.thetaPerDay
    out.vegaPerPoint += n * g.vegaPerPoint
  })
  return out
}
