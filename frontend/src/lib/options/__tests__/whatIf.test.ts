import { describe, expect, it } from 'vitest'
import { blackScholes, positionGreeks, type GreeksMarket } from '../greeks'
import { payoffAtExpiry, type CalcLeg, type CalcPosition } from '../payoff'
import {
  modelPnlAt, modelPnlNow, PRICE_MOVE_MAX_PCT, shiftedVols, VOL_FLOOR_PTS, VOL_SHIFT_MAX_PTS,
  volShiftBounds, whatIf,
} from '../whatIf'

// The "what if" sliders on the Options Calculator (T-062, D216, 2026-11-09).

const leg = (side: CalcLeg['side'], type: CalcLeg['type'], strike: number, premium: number, contracts = 1): CalcLeg =>
  ({ side, type, strike, premium, contracts })

// The textbook case the Greeks tests use: S = K = 100, one year, 5%, no dividend.
const M: GreeksMarket = { spot: 100, daysToExpiry: 365, ratePct: 5, dividendYieldPct: 0 }
const bs = (type: 'call' | 'put', spot: number, volPct: number, days = 365) =>
  blackScholes({ type, spot, strike: 100, years: days / 365, rate: 0.05, dividendYield: 0, volatility: volPct / 100 }).price

describe('model profit or loss now', () => {
  it('is 0 when the premium paid is the model price', () => {
    const callPrice = bs('call', 100, 20) // 10.4506
    const p: CalcPosition = { legs: [leg('long', 'call', 100, callPrice)] }
    expect(modelPnlNow(p, [20], M)).toBeCloseTo(0, 6)
  })

  it('shows the gap when the premium differs from the model price', () => {
    const p: CalcPosition = { legs: [leg('long', 'call', 100, 9)] }
    expect(modelPnlNow(p, [20], M)).toBeCloseTo((bs('call', 100, 20) - 9) * 100, 6)
  })

  it('a short leg gains what a long one loses', () => {
    const long = modelPnlNow({ legs: [leg('long', 'put', 100, 5)] }, [25], M)
    const short = modelPnlNow({ legs: [leg('short', 'put', 100, 5)] }, [25], M)
    expect(short).toBeCloseTo(-long, 9)
  })

  it('counts shares at the price, less their cost', () => {
    const p: CalcPosition = { legs: [], shares: 100, shareCost: 90 }
    expect(modelPnlNow(p, [], M)).toBe(1000)
  })

  it('at expiry is the payoff at expiry', () => {
    const p: CalcPosition = { legs: [leg('long', 'call', 100, 4)] }
    expect(modelPnlNow(p, [20], { ...M, spot: 112, daysToExpiry: 0 })).toBe(payoffAtExpiry(p, 112))
  })

  it('needs one volatility per leg', () => {
    expect(() => modelPnlNow({ legs: [leg('long', 'call', 100, 4)] }, [], M)).toThrow()
  })
})

describe('what if the price or volatility moved', () => {
  it('a synthetic long stock moves dollar for dollar, whatever the volatility', () => {
    // Long call + short put at one strike is worth S − K·e^(−rT): its change is exactly the
    // stock's change, and volatility drops out. An exact check on the model, independent of σ.
    const p: CalcPosition = { legs: [leg('long', 'call', 100, 10), leg('short', 'put', 100, 6)] }
    // Both legs at one volatility, since parity pairs a call and a put at the same σ.
    const r = whatIf(p, [25, 25], M, { priceMovePct: 10, volShiftPts: 15 })
    expect(r.spot).toBeCloseTo(110, 9)
    expect(r.changeFromNow).toBeCloseTo(1000, 6) // $10 × 100 shares
    expect(r.greeks.delta).toBeCloseTo(100, 6)
  })

  it('a price move alone changes a long call by its model values', () => {
    const p: CalcPosition = { legs: [leg('long', 'call', 100, 10.45)] }
    const r = whatIf(p, [20], M, { priceMovePct: -10, volShiftPts: 0 })
    expect(r.changeFromNow).toBeCloseTo((bs('call', 90, 20) - bs('call', 100, 20)) * 100, 6)
    expect(r.pnlAtExpiry).toBe(payoffAtExpiry(p, 90))
  })

  it('a volatility rise lifts a long option by about vega a point', () => {
    const p: CalcPosition = { legs: [leg('long', 'call', 100, 10.45)] }
    const vega = positionGreeks(p, [20], M).vegaPerPoint
    const r = whatIf(p, [20], M, { priceMovePct: 0, volShiftPts: 1 })
    expect(r.changeFromNow).toBeGreaterThan(0)
    expect(r.changeFromNow).toBeCloseTo(vega, 0) // within 50 cents over one point
    expect(r.volatilityPct).toEqual([21])
  })

  it('no move is no change', () => {
    const p: CalcPosition = { legs: [leg('short', 'call', 105, 3), leg('long', 'call', 110, 1)] }
    const r = whatIf(p, [22, 21], M, { priceMovePct: 0, volShiftPts: 0 })
    expect(r.changeFromNow).toBe(0)
    expect(r.greeks).toEqual(positionGreeks(p, [22, 21], M))
  })

  it('refuses a position with no time left, as the Greeks do', () => {
    expect(() => whatIf({ legs: [leg('long', 'call', 100, 4)] }, [20], { ...M, daysToExpiry: 0 },
      { priceMovePct: 0, volShiftPts: 0 })).toThrow(RangeError)
  })
})

describe('the volatility slider never reaches 0', () => {
  it('runs the full range when every leg has room', () => {
    expect(volShiftBounds([40, 55])).toEqual({ min: -VOL_SHIFT_MAX_PTS, max: VOL_SHIFT_MAX_PTS })
  })

  it('stops where the lowest leg would fall under the floor', () => {
    expect(volShiftBounds([20, 35])).toEqual({ min: VOL_FLOOR_PTS - 20, max: VOL_SHIFT_MAX_PTS })
    expect(() => shiftedVols([20, 35], VOL_FLOOR_PTS - 20)).not.toThrow()
    expect(shiftedVols([20, 35], VOL_FLOOR_PTS - 20)[0]).toBe(VOL_FLOOR_PTS)
  })

  it('a fractional volatility still leaves the lowest leg at the floor or above', () => {
    const { min } = volShiftBounds([12.4])
    expect(12.4 + min).toBeGreaterThanOrEqual(VOL_FLOOR_PTS)
  })

  it('refuses a shift to 0 or below', () => {
    expect(() => shiftedVols([10], -10)).toThrow(RangeError)
  })

  it('has nothing to move with no legs', () => {
    expect(volShiftBounds([])).toEqual({ min: 0, max: 0 })
  })

  it('the price slider stays above 0', () => {
    expect(PRICE_MOVE_MAX_PCT).toBeLessThan(100)
  })
})

describe('the chart\'s "today" line', () => {
  it('is the model value at each price, and reaches a price of 0', () => {
    const p: CalcPosition = { legs: [leg('long', 'put', 100, 7)] }
    const line = modelPnlAt(p, [20], M, [0, 100, 150])
    expect(line[1]).toBeCloseTo(modelPnlNow(p, [20], M), 9)
    // At a price of 0 the put is worth the discounted strike: 100 × e^(−0.05) per share.
    expect(line[0]).toBeCloseTo((100 * Math.exp(-0.05) - 7) * 100, 2)
    expect(Number.isFinite(line[2])).toBe(true)
  })
})

// Code review 2026-11-10 (D221): three changes to whatIf() went unnoticed by the tests above.
describe('what the "What if" card reports is worked out at the moved price and volatility', () => {
  const p: CalcPosition = { legs: [leg('long', 'call', 100, 5)] }

  it('the expiry figure is at the moved price, not the price entered', () => {
    const r = whatIf(p, [20], M, { priceMovePct: 10, volShiftPts: 0 })
    expect(r.pnlAtExpiry).toBeCloseTo(payoffAtExpiry(p, 110), 6) // +$500
    expect(r.pnlAtExpiry).not.toBeCloseTo(payoffAtExpiry(p, 100), 0) // −$500
  })

  it('the Greeks are at the moved price and volatility', () => {
    const r = whatIf(p, [20], M, { priceMovePct: 10, volShiftPts: 5 })
    expect(r.greeks).toEqual(positionGreeks(p, [25], { ...M, spot: 110 }))
    expect(r.greeks.delta).not.toBeCloseTo(positionGreeks(p, [20], M).delta, 1)
  })

  it('the model carries the dividend yield entered', () => {
    const q: GreeksMarket = { ...M, dividendYieldPct: 3 }
    const value = blackScholes({ type: 'call', spot: 100, strike: 100, years: 1, rate: 0.05, dividendYield: 0.03, volatility: 0.2 }).price
    expect(modelPnlNow({ legs: [leg('long', 'call', 100, 0)] }, [20], q)).toBeCloseTo(value * 100, 9)
    expect(modelPnlNow({ legs: [leg('long', 'call', 100, 0)] }, [20], q))
      .not.toBeCloseTo(modelPnlNow({ legs: [leg('long', 'call', 100, 0)] }, [20], M), 0)
  })
})
