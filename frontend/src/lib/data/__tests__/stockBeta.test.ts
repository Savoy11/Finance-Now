import { describe, it, expect } from 'vitest'
import { stockBetaFrom } from '../stockBeta'

// D170 (2026-10-25): a stock's beta from a year of daily closes against SPY.

const DAY = 86_400_000
const t0 = Date.UTC(2025, 9, 27)
/** A benchmark that zig-zags, and a stock that moves `k` times as much each day. */
function pair(k: number, days = 60) {
  const bench = [{ t: t0, close: 100 }]
  const stock = [{ t: t0, close: 50 }]
  for (let i = 1; i < days; i++) {
    const r = (i % 2 ? 0.01 : -0.008) + (i % 7) * 0.0005
    bench.push({ t: t0 + i * DAY, close: bench[i - 1].close * (1 + r) })
    stock.push({ t: t0 + i * DAY, close: stock[i - 1].close * (1 + k * r) })
  }
  return { stock, bench }
}

describe('stockBetaFrom', () => {
  it('finds the slope of the stock’s daily returns on the benchmark’s', () => {
    const { stock, bench } = pair(1.5)
    const r = stockBetaFrom({ points: stock, basis: 'splits-and-dividends' }, { points: bench, basis: 'splits-and-dividends' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.beta).toBeCloseTo(1.5, 6)
      expect(r.rSquared).toBeCloseTo(1, 6)
      expect(r.overlap).toBe(59)
    }
  })

  it('refuses closes not adjusted for splits, which a split would swamp', () => {
    const { stock, bench } = pair(1)
    const r = stockBetaFrom({ points: stock, basis: 'unadjusted' }, { points: bench, basis: 'splits-and-dividends' })
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.reason).toContain('not adjusted for splits')
  })

  it('says why there is none without history, or with too little of it', () => {
    expect(stockBetaFrom(null, null)).toMatchObject({ ok: false })
    const { stock, bench } = pair(1, 10)
    const r = stockBetaFrom({ points: stock }, { points: bench })
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.reason).toContain('too few trading days')
  })
})
