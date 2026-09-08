import { describe, it, expect, vi } from 'vitest'
import { computeTechnicals, realisedVolatilityPct, sweepTechnicals } from '../sweep'
import type { OhlcvCandle } from '@/lib/utils/indicators'

const candles = (closes: number[]): OhlcvCandle[] =>
  closes.map((c, i) => ({ time: i, open: c, high: c, low: c, close: c, volume: 0 }))

/** n closes rising by 1 — a clean uptrend, so price sits above every average. */
const rising = (n: number) => candles(Array.from({ length: n }, (_, i) => 100 + i))

describe('computeTechnicals', () => {
  it('returns all-null for an empty series rather than zeros', () => {
    expect(computeTechnicals([])).toEqual({ rsi14: null, vsSma50Pct: null, vsSma200Pct: null, realisedVol30dPct: null })
  })

  it('withholds the 200-day average when history is shorter than 200 candles', () => {
    // The bug this forbids: a 60-candle coin reported as "0% from its SMA200"
    // would sort into the middle of the pack on a filter it cannot answer.
    const t = computeTechnicals(rising(60))
    expect(t.vsSma50Pct).not.toBeNull()
    expect(t.vsSma200Pct).toBeNull()
  })

  it('withholds the 50-day average when history is shorter than 50 candles', () => {
    const t = computeTechnicals(rising(30))
    expect(t.vsSma50Pct).toBeNull()
  })

  it('computes both averages once there is enough history', () => {
    const t = computeTechnicals(rising(250))
    expect(t.vsSma50Pct).not.toBeNull()
    expect(t.vsSma200Pct).not.toBeNull()
  })

  it('puts price above its averages in an uptrend, and further above the longer one', () => {
    // A directional assertion, not just non-null: a sign flip here would make
    // every "price below its 50-day average" filter select the wrong coins.
    const t = computeTechnicals(rising(250))
    expect(t.vsSma50Pct!).toBeGreaterThan(0)
    expect(t.vsSma200Pct!).toBeGreaterThan(t.vsSma50Pct!)
  })

  it('puts price below its averages in a downtrend', () => {
    const falling = candles(Array.from({ length: 250 }, (_, i) => 500 - i))
    const t = computeTechnicals(falling)
    expect(t.vsSma50Pct!).toBeLessThan(0)
    expect(t.vsSma200Pct!).toBeLessThan(0)
  })

  it('reports RSI in range for a monotonic series', () => {
    const t = computeTechnicals(rising(250))
    expect(t.rsi14).not.toBeNull()
    expect(t.rsi14!).toBeGreaterThan(50)
    expect(t.rsi14!).toBeLessThanOrEqual(100)
  })
})

describe('sweepTechnicals', () => {
  const okResponse = (n: number) => ({
    ok: true,
    json: async () => ({ ok: true, candles: rising(n) }),
  })

  it('omits a coin whose fetch fails instead of giving it a neutral value', async () => {
    // The whole reason the screener can call a gap "not tested": a failed coin
    // must be ABSENT, never filled in with a 0 or an RSI of 50, or the filter
    // silently passes or fails something nobody measured.
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('btc') ? okResponse(250) : Promise.reject(new Error('429')),
    ) as unknown as typeof fetch

    const out = await sweepTechnicals(['btc', 'eth'], { fetchImpl, concurrency: 2 })
    expect(out.has('btc')).toBe(true)
    expect(out.has('eth')).toBe(false)
  })

  it('omits a coin the route answers with ok:false', async () => {
    const fetchImpl = (async () => ({
      ok: true, json: async () => ({ ok: false, candles: [] }),
    })) as unknown as typeof fetch
    const out = await sweepTechnicals(['btc'], { fetchImpl })
    expect(out.size).toBe(0)
  })

  it('reports progress for every coin, failures included', async () => {
    // Progress must count attempts, not successes, or the indicator stalls
    // short of the total on a partial sweep and reads as a hang.
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('a') ? okResponse(250) : Promise.reject(new Error('nope')),
    ) as unknown as typeof fetch
    const seen: number[] = []
    await sweepTechnicals(['a', 'b', 'c'], {
      fetchImpl, concurrency: 1, onProgress: d => seen.push(d),
    })
    expect(seen).toEqual([1, 2, 3])
  })

  it('makes exactly one request per coin', async () => {
    const fetchImpl = vi.fn(async () => okResponse(250)) as unknown as typeof fetch
    await sweepTechnicals(['a', 'b', 'c', 'd'], { fetchImpl })
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(4)
  })
})

describe('realisedVolatilityPct', () => {
  const flat = Array(40).fill(100)

  it('returns null below a full window rather than 0', () => {
    // 0% would sort a coin nobody measured to the calm end of the screener.
    expect(realisedVolatilityPct(Array(29).fill(100))).toBeNull()
    expect(realisedVolatilityPct([])).toBeNull()
    expect(realisedVolatilityPct(Array(30).fill(100))).not.toBeNull()
  })

  it('is 0 for a genuinely motionless series — measured, not missing', () => {
    expect(realisedVolatilityPct(flat)).toBe(0)
  })

  it('annualises over 365 days, not 252 — crypto trades every day', () => {
    // A series alternating ±1% has a known daily stdev; the only thing under
    // test here is the annualisation factor, so compare the two conventions.
    const closes = [100]
    for (let i = 1; i < 31; i++) closes.push(closes[i - 1] * (i % 2 === 0 ? 1.01 : 0.99))
    const crypto = realisedVolatilityPct(closes, 30, 365)!
    const equity = realisedVolatilityPct(closes, 30, 252)!
    expect(crypto / equity).toBeCloseTo(Math.sqrt(365 / 252), 6)
    // Using the equity convention would understate it by about a fifth.
    expect(equity).toBeLessThan(crypto)
  })

  it('scales with the size of the moves', () => {
    const build = (pct: number) => {
      const out = [100]
      for (let i = 1; i < 31; i++) out.push(out[i - 1] * (i % 2 === 0 ? 1 + pct : 1 - pct))
      return out
    }
    const calm = realisedVolatilityPct(build(0.005))!
    const wild = realisedVolatilityPct(build(0.05))!
    expect(wild).toBeGreaterThan(calm * 5)
  })

  it('is scale-invariant — a $1 coin and a $50,000 coin moving alike agree', () => {
    const pattern = (base: number) => {
      const out = [base]
      for (let i = 1; i < 31; i++) out.push(out[i - 1] * (i % 3 === 0 ? 1.02 : 0.995))
      return out
    }
    const cheap = realisedVolatilityPct(pattern(1))!
    const dear = realisedVolatilityPct(pattern(50_000))!
    expect(cheap).toBeCloseTo(dear, 8)
  })

  it('refuses a window containing a non-positive or non-finite close', () => {
    // A log return is undefined there. One bad tick must not read as a flat day.
    const withZero = [...Array(29).fill(100), 0]
    expect(realisedVolatilityPct(withZero)).toBeNull()
    const withNaN = [...Array(29).fill(100), NaN]
    expect(realisedVolatilityPct(withNaN)).toBeNull()
    const negative = [...Array(29).fill(100), -5]
    expect(realisedVolatilityPct(negative)).toBeNull()
  })

  it('only looks at the last `window` closes', () => {
    const calmThenSame = [...Array(200).fill(50), ...Array(30).fill(100)]
    expect(realisedVolatilityPct(calmThenSame)).toBe(0)
  })

  it('uses the sample standard deviation (n−1)', () => {
    // Hand-computed: two distinct log returns repeated, so the n vs n−1 choice
    // is visible rather than a rounding difference.
    const closes = [100]
    for (let i = 1; i < 31; i++) closes.push(closes[i - 1] * (i % 2 === 0 ? 1.02 : 1.0))
    const rets: number[] = []
    for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]))
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const sample = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1))
    expect(realisedVolatilityPct(closes)).toBeCloseTo(sample * Math.sqrt(365) * 100, 8)
  })
})

describe('computeTechnicals — realised volatility field', () => {
  const candles = (closes: number[]) =>
    closes.map((c, i) => ({ time: 1_700_000_000 + i * 86_400, open: c, high: c, low: c, close: c, volume: 1 }))

  it('reports the figure once there is a full window', () => {
    const rising = Array.from({ length: 60 }, (_, i) => 100 * 1.01 ** i)
    expect(computeTechnicals(candles(rising)).realisedVol30dPct).not.toBeNull()
  })

  it('is null on a short series, alongside the other short-history nulls', () => {
    const short = computeTechnicals(candles(Array.from({ length: 20 }, (_, i) => 100 + i)))
    expect(short.realisedVol30dPct).toBeNull()
    expect(short.vsSma200Pct).toBeNull()
  })

  it('is null for an empty series', () => {
    expect(computeTechnicals([]).realisedVol30dPct).toBeNull()
  })
})
