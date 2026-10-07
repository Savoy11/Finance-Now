import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  chartRange, netPremiumUsd, payoffAtExpiry, payoffSeries, summarizePayoff,
  type CalcLeg, type CalcPosition,
} from '../payoff'
import { blackScholes, normCdf, positionGreeks } from '../greeks'

const leg = (side: CalcLeg['side'], type: CalcLeg['type'], strike: number, premium: number, contracts = 1): CalcLeg =>
  ({ side, type, strike, premium, contracts })

describe('payoff at expiry — worked by hand for each common structure', () => {
  it('long call: pays the premium, loses at most that, gains without limit', () => {
    const p: CalcPosition = { legs: [leg('long', 'call', 100, 5)] }
    const s = summarizePayoff(p)
    expect(s.netPremiumUsd).toBe(-500)
    expect(s.maxLossUsd).toBe(500)
    expect(s.maxGainUsd).toBe('unlimited')
    expect(s.breakevens).toEqual([105])
    expect(payoffAtExpiry(p, 120)).toBe(1500)
  })

  it('short put: keeps the premium, loses down to a zero price', () => {
    const s = summarizePayoff({ legs: [leg('short', 'put', 95, 2)] })
    expect(s.netPremiumUsd).toBe(200)
    expect(s.maxGainUsd).toBe(200)
    expect(s.maxLossUsd).toBe(9300) // (95 − 2) × 100, at a price of 0
    expect(s.breakevens).toEqual([93])
  })

  it('short call alone: loss is unlimited', () => {
    const s = summarizePayoff({ legs: [leg('short', 'call', 110, 1.5)] })
    expect(s.maxLossUsd).toBe('unlimited')
    expect(s.maxGainUsd).toBe(150)
    expect(s.breakevens).toEqual([111.5])
  })

  it('bull call spread: debit is the most it can lose, width less debit the most it can gain', () => {
    const s = summarizePayoff({ legs: [leg('long', 'call', 100, 3), leg('short', 'call', 105, 1)] })
    expect(s.netPremiumUsd).toBe(-200)
    expect(s.maxLossUsd).toBe(200)
    expect(s.maxGainUsd).toBe(300)
    expect(s.breakevens).toEqual([102])
  })

  it('iron condor: two breakevens, both sides capped', () => {
    const s = summarizePayoff({
      legs: [
        leg('long', 'put', 90, 0.5), leg('short', 'put', 95, 1.5),
        leg('short', 'call', 105, 1.5), leg('long', 'call', 110, 0.5),
      ],
    })
    expect(s.netPremiumUsd).toBe(200)
    expect(s.maxGainUsd).toBe(200)
    expect(s.maxLossUsd).toBe(300) // wing width 5 × 100, less the 200 credit
    expect(s.breakevens).toEqual([93, 107])
  })

  it('covered call: shares count in the payoff and cap the upside', () => {
    const p: CalcPosition = { legs: [leg('short', 'call', 105, 2)], shares: 100, shareCost: 100 }
    const s = summarizePayoff(p)
    expect(s.netPremiumUsd).toBe(200) // shares are not premium
    expect(s.maxGainUsd).toBe(700) // (105 − 100 + 2) × 100
    expect(s.maxLossUsd).toBe(9800) // shares to 0, less the premium kept
    expect(s.breakevens).toEqual([98])
  })

  it('long straddle: loses most at the strike, breakevens either side', () => {
    const s = summarizePayoff({ legs: [leg('long', 'call', 100, 4), leg('long', 'put', 100, 3)] })
    expect(s.maxLossUsd).toBe(700)
    expect(s.maxGainUsd).toBe('unlimited')
    expect(s.breakevens).toEqual([93, 107])
  })

  it('a short position in the stock with a long call above has a capped loss', () => {
    const s = summarizePayoff({ legs: [leg('long', 'call', 110, 2)], shares: -100, shareCost: 100 })
    expect(s.maxLossUsd).toBe(1200) // (110 − 100 + 2) × 100
    expect(s.maxGainUsd).toBe(9800) // stock to 0, less the call's cost
  })

  it('contracts and the multiplier scale everything', () => {
    const one = summarizePayoff({ legs: [leg('long', 'call', 100, 5)] })
    const three = summarizePayoff({ legs: [leg('long', 'call', 100, 5, 3)] })
    const mini = summarizePayoff({ legs: [leg('long', 'call', 100, 5)], multiplier: 10 })
    expect(three.maxLossUsd).toBe(1500)
    expect(mini.maxLossUsd).toBe(50)
    expect(three.breakevens).toEqual(one.breakevens)
  })

  it('net premium sign: credit positive, debit negative', () => {
    expect(netPremiumUsd({ legs: [leg('short', 'put', 50, 1)] })).toBe(100)
    expect(netPremiumUsd({ legs: [leg('long', 'put', 50, 1)] })).toBe(-100)
  })
})

describe('payoff series for the chart', () => {
  const p: CalcPosition = { legs: [leg('long', 'call', 100, 3), leg('short', 'call', 105, 1)] }

  it('includes every strike and breakeven exactly, so the corners are real', () => {
    const pts = payoffSeries(p, 80, 120, 7).map((x) => x.price)
    for (const x of [100, 102, 105]) expect(pts).toContain(x)
  })

  it('never goes below a price of 0 and is sorted', () => {
    const pts = payoffSeries(p, -50, 20, 10)
    expect(pts[0].price).toBe(0)
    expect(pts.every((x, i) => i === 0 || x.price > pts[i - 1].price)).toBe(true)
  })

  it('chart range covers the price, strikes and breakevens', () => {
    const r = chartRange(p, 101)
    expect(r.lo).toBeLessThan(100)
    expect(r.hi).toBeGreaterThan(105)
  })
})

describe('Black-Scholes — the textbook case (S=K=100, 1 year, r=5%, σ=20%)', () => {
  const base = { spot: 100, strike: 100, years: 1, rate: 0.05, dividendYield: 0, volatility: 0.2 }

  it('normal distribution matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7)
    expect(normCdf(1.96)).toBeCloseTo(0.9750021, 6)
    expect(normCdf(-1)).toBeCloseTo(0.1586553, 6)
  })

  it('call and put prices', () => {
    expect(blackScholes({ ...base, type: 'call' }).price).toBeCloseTo(10.4506, 3)
    expect(blackScholes({ ...base, type: 'put' }).price).toBeCloseTo(5.5735, 3)
  })

  it('Greeks', () => {
    const c = blackScholes({ ...base, type: 'call' })
    const p = blackScholes({ ...base, type: 'put' })
    expect(c.delta).toBeCloseTo(0.6368, 4)
    expect(p.delta).toBeCloseTo(-0.3632, 4)
    expect(c.gamma).toBeCloseTo(0.018762, 5)
    expect(c.vegaPerPoint).toBeCloseTo(0.37524, 4)
    expect(c.thetaPerDay * 365).toBeCloseTo(-6.414, 2)
    expect(p.thetaPerDay * 365).toBeCloseTo(-1.658, 2)
  })

  it('put-call parity holds, with a dividend yield too', () => {
    const q = { ...base, dividendYield: 0.02, years: 0.5 }
    const c = blackScholes({ ...q, type: 'call' }).price
    const p = blackScholes({ ...q, type: 'put' }).price
    expect(c - p).toBeCloseTo(100 * Math.exp(-0.02 * 0.5) - 100 * Math.exp(-0.05 * 0.5), 6)
  })

  it('refuses zero time or volatility instead of returning a number', () => {
    expect(() => blackScholes({ ...base, type: 'call', years: 0 })).toThrow()
    expect(() => blackScholes({ ...base, type: 'call', volatility: 0 })).toThrow()
  })
})

describe('position Greeks', () => {
  const market = { spot: 100, daysToExpiry: 365, ratePct: 5, dividendYieldPct: 0 }

  it('one long call is 100 × the per-share Greeks', () => {
    const g = positionGreeks({ legs: [leg('long', 'call', 100, 10)] }, [20], market)
    expect(g.delta).toBeCloseTo(63.68, 1)
    expect(g.vegaPerPoint).toBeCloseTo(37.524, 2)
  })

  it('shares add to delta, short legs subtract', () => {
    const g = positionGreeks({ legs: [leg('short', 'call', 100, 10)], shares: 100, shareCost: 100 }, [20], market)
    expect(g.delta).toBeCloseTo(100 - 63.68, 1)
    expect(g.thetaPerDay).toBeGreaterThan(0) // the short call's decay is earned
  })

  it('needs one volatility per leg', () => {
    expect(() => positionGreeks({ legs: [leg('long', 'call', 100, 10)] }, [], market)).toThrow()
  })
})

describe('the calculator stays ungraded (D92, D93)', () => {
  const ROOT = path.resolve(__dirname, '../../../..')
  const files = [
    'src/lib/options/payoff.ts',
    'src/lib/options/greeks.ts',
    'src/app/(dashboard)/equities/options-calculator/page.tsx',
  ]

  it('nothing in it imports the risk engine', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
      expect(src, f).not.toMatch(/from ['"]@\/lib\/risk/)
      expect(src, f).not.toMatch(/from ['"]\.\.\/risk/)
    }
  })

  it('its results carry no score, grade or rating field', () => {
    const s = summarizePayoff({ legs: [leg('long', 'call', 100, 5)] })
    const keys = Object.keys(s).join(' ').toLowerCase()
    expect(keys).not.toMatch(/score|grade|rating|safe/)
  })
})
