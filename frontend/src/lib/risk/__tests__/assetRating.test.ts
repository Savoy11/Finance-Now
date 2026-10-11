import { describe, expect, it } from 'vitest'
import {
  annualisedVolatility,
  applyStability,
  classForScore,
  maxDrawdownFraction,
  rateAsset,
  topOfClass,
  type AssetRatingInputs,
} from '../assetRating'
import { METHODOLOGY_V1 as M, PRICE_CURVES } from '../methodology/v1'
import { piecewise } from '../normalize'
import { euCalibratedCurves, priipsBandClass, typicalDrawdown } from '../../../../scripts/lib/ratingValidation'

const NOW = new Date('2026-10-09T00:00:00Z')
const flat = (n: number, p = 100) => Array.from({ length: n }, () => p)
/** Log returns alternating +a, −a: a known volatility and a drawdown of 1 − e^−a. */
const zigzag = (n: number, a: number) => Array.from({ length: n }, (_, i) => (i % 2 ? 100 * Math.exp(a) : 100))

function stock(over: Partial<AssetRatingInputs> = {}): AssetRatingInputs {
  return {
    kind: 'stock',
    closes: flat(260),
    volumes: flat(260, 1e6), // × $100 = $100M a day
    marketCapUsd: 3e12,
    sector: 'technology',
    fundamentals: { longTermDebt: 50, shareholdersEquity: 100, netIncome: 20, revenue: 100, periodEnd: '2026-06-30' },
    ...over,
  }
}

describe('methodology v1 is internally consistent', () => {
  it('weights sum to 1 for each asset class', () => {
    for (const m of [M.crypto, M.stock]) {
      expect(m.dimensions.reduce((a, d) => a + d.weight, 0)).toBeCloseTo(1, 10)
    }
  })

  it('classes run 1..7 with descending, contiguous floors from 0', () => {
    expect(M.classes.map((c) => c.cls)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (let i = 1; i < M.classes.length; i++) expect(M.classes[i].min).toBeLessThan(M.classes[i - 1].min)
    expect(M.classes[M.classes.length - 1].min).toBe(0)
  })

  it('every curve is sorted by input, as piecewise() requires', () => {
    for (const curves of [M.crypto.curves, M.stock.curves]) {
      for (const pts of Object.values(curves)) {
        for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThan(pts[i - 1][0])
      }
    }
  })

  it('no suitability or advice words in the copy (memo §6 item 5)', () => {
    const copy = [
      M.heading,
      ...M.classes.map((c) => c.label),
      ...[...M.crypto.dimensions, ...M.stock.dimensions].flatMap((d) => [d.label, d.description]),
    ].join(' ').toLowerCase()
    for (const w of ['conservative', 'aggressive', 'suitable', 'safe', 'recommend']) {
      expect(copy).not.toContain(w)
    }
  })
})

describe('price curves from the EU PRIIPs bands, and no lift (D97)', () => {
  const eu = euCalibratedCurves(M.classes.map((c) => c.min))

  it('coins and stocks share one set of volatility and drawdown curves', () => {
    for (const key of ['volatility', 'drawdown'] as const) {
      expect(M.crypto.curves[key], `crypto ${key}`).toEqual(PRICE_CURVES[key])
      expect(M.stock.curves[key], `stock ${key}`).toEqual(PRICE_CURVES[key])
    }
  })

  it('the written-out points are the ones the bands give, drawdown to 0.01%', () => {
    expect(PRICE_CURVES.volatility).toEqual(eu.volatility)
    expect(PRICE_CURVES.drawdown.map(([, s]) => s)).toEqual(eu.drawdown.map(([, s]) => s))
    PRICE_CURVES.drawdown.forEach(([x], i) => expect(x, `drawdown point ${i + 1}`).toBeCloseTo(eu.drawdown[i][0], 4))
  })

  it('volatility alone, and the typical fall at that volatility, land in the PRIIPs class', () => {
    for (const v of [0.003, 0.03, 0.08, 0.15, 0.25, 0.5, 1, 2]) {
      expect(classForScore(piecewise(v, PRICE_CURVES.volatility)).cls, `volatility ${v}`).toBe(priipsBandClass(v))
      expect(classForScore(piecewise(typicalDrawdown(v), PRICE_CURVES.drawdown)).cls, `fall at ${v}`).toBe(priipsBandClass(v))
    }
  })

  it('the other parts cannot lift the class', () => {
    expect(M.capClassesAboveCore).toBe(0)
  })
})

describe('building blocks', () => {
  it('classForScore and topOfClass follow the class table', () => {
    expect(classForScore(100)).toEqual({ cls: 1, label: 'Very low' })
    expect(classForScore(86).cls).toBe(1)
    expect(classForScore(85.9).cls).toBe(2)
    expect(classForScore(44).label).toBe('Moderate')
    expect(classForScore(0).cls).toBe(7)
    expect(topOfClass(1)).toBe(100)
    expect(topOfClass(4)).toBe(57)
    expect(topOfClass(7)).toBe(14)
  })

  it('volatility and drawdown match the definitions', () => {
    expect(annualisedVolatility(flat(30), 252)).toBe(0)
    const a = 0.02
    const n = 101 // 100 returns, mean 0
    const expected = a * Math.sqrt(100 / 99) * Math.sqrt(252)
    expect(annualisedVolatility(zigzag(n, a), 252)).toBeCloseTo(expected, 10)
    expect(maxDrawdownFraction([100, 120, 60, 90])).toBeCloseTo(0.5, 10)
  })
})

describe('stocks', () => {
  it('rates a large, steady, profitable company — every sub-score worked by hand', () => {
    const r = rateAsset(stock(), NOW)
    expect(r.rated).toBe(true)
    if (!r.rated) return
    const sub = Object.fromEntries(r.dimensions.map((d) => [d.key, d.subScore]))
    expect(sub.volatility).toBe(100) // 0 volatility: the price curve's first point
    expect(sub.drawdown).toBe(100) // no fall: likewise
    expect(sub.liquidity).toBeCloseTo(90.9, 1) // $100M: 90 + (5e7 / 4.5e8) × 8
    expect(sub.size).toBe(95)
    expect(sub.fundamentals).toBe(88) // D/E 0.5 → 86; margin 20% → 90
    // 0.25×100 + 0.2×100 + 0.2×90.89 + 0.15×95 + 0.2×88 = 95.03
    expect(r.score).toBeCloseTo(95.0, 1)
    expect(r.cls).toBe(1)
    expect(r.label).toBe('Very low')
    expect(r.capped).toBe(false)
  })

  it('leaves financial companies out of fundamentals and renormalises', () => {
    const r = rateAsset(stock({ sector: 'Financials' }), NOW)
    expect(r.rated).toBe(true)
    if (!r.rated) return
    const f = r.dimensions.find((d) => d.key === 'fundamentals')!
    expect(f.subScore).toBeNull()
    expect(f.note).toMatch(/not applied to financial companies/i)
    const sum = r.dimensions.reduce((a, d) => a + (d.effectiveWeight ?? 0), 0)
    expect(sum).toBeCloseTo(1, 3)
  })

  it('negative equity scores that half at the fixed value, with the reason', () => {
    const r = rateAsset(stock({ fundamentals: { longTermDebt: 50, shareholdersEquity: -10, netIncome: 20, revenue: 100, periodEnd: '2026-06-30' } }), NOW)
    if (!r.rated) throw new Error('expected a rating')
    const f = r.dimensions.find((d) => d.key === 'fundamentals')!
    expect(f.subScore).toBe((M.negativeEquityScore + 90) / 2)
    expect(f.note).toMatch(/negative/)
  })

  it('a filing older than the limit leaves fundamentals missing, and the rest still rates', () => {
    const r = rateAsset(stock({ fundamentals: { longTermDebt: 1, shareholdersEquity: 10, netIncome: 1, revenue: 10, periodEnd: '2025-01-31' } }), NOW)
    expect(r.rated).toBe(true)
    const f = r.dimensions.find((d) => d.key === 'fundamentals')!
    expect(f.subScore).toBeNull()
    expect(f.note).toMatch(/within 15 months/)
  })

  it('below the coverage floor, nothing is rated', () => {
    const r = rateAsset(stock({ volumes: [], marketCapUsd: null, fundamentals: null }), NOW)
    expect(r).toMatchObject({ rated: false, reason: 'Not enough data to rate this asset.' })
  })

  it('the other parts still lower the class: a calm price on a small, thinly traded, loss-making company', () => {
    const r = rateAsset(stock({
      volumes: flat(260, 1e3), // × $100 = $100K a day → 10
      marketCapUsd: 1e8, // → 16
      fundamentals: { longTermDebt: 500, shareholdersEquity: 100, netIncome: -20, revenue: 100, periodEnd: '2026-06-30' }, // → 19.8
    }), NOW)
    if (!r.rated) throw new Error('expected a rating')
    expect(r.coreCls).toBe(1)
    // 0.25×100 + 0.2×100 + 0.2×10 + 0.15×16 + 0.2×19.8 = 53.36
    expect(r.score).toBeCloseTo(53.4, 1)
    expect(r.cls).toBe(4)
    expect(r.capped).toBe(false)
  })

  it('under a year of prices, nothing is rated', () => {
    const r = rateAsset(stock({ closes: flat(200), volumes: flat(200, 1e6) }), NOW)
    expect(r).toMatchObject({ rated: false })
    if (r.rated) return
    expect(r.reason).toMatch(/one year/)
  })
})

describe('crypto', () => {
  it('the cap rule stops size and liquidity lifting a volatile coin above its price class (D97)', () => {
    const r = rateAsset({
      kind: 'crypto',
      closes: zigzag(366, 1.2 / Math.sqrt(365)), // ~120% annualised volatility, a 6% largest fall
      dollarVolumes: flat(366, 5e10),
      marketCapUsd: 1e12,
    }, NOW)
    if (!r.rated) throw new Error('expected a rating')
    // Price alone: 0.6×7.2 + 0.4×71.5 = 32.9, class 5. With liquidity 90 and scale 95 the
    // weighted score would be 62.7, class 3; with no lift it stops at the top of class 5.
    expect(r.coreScore).toBeCloseTo(32.9, 1)
    expect(r.coreCls).toBe(5)
    expect(r.capped).toBe(true)
    expect(r.score).toBe(topOfClass(5))
    expect(r.cls).toBe(5)
  })

  it('turnover earns nothing above 5%, and thin volume caps liquidity', () => {
    const base = { kind: 'crypto' as const, closes: flat(366), marketCapUsd: 1e8 }
    const r = rateAsset({ ...base, dollarVolumes: flat(366, 5e6) }, NOW) // turnover 5% but only $5M
    if (!r.rated) throw new Error('expected a rating')
    const liq = r.dimensions.find((d) => d.key === 'liquidity')!
    expect(liq.subScore).toBe(M.cryptoThinVolumeCap)
    expect(liq.note).toMatch(/Capped/)
    const r2 = rateAsset({ ...base, dollarVolumes: flat(366, 5e7) }, NOW) // turnover 50%, $50M
    if (!r2.rated) throw new Error('expected a rating')
    // turnover saturates at 90; dollar volume $50M sits below it, so liquidity is 90
    expect(r2.dimensions.find((d) => d.key === 'liquidity')!.subScore).toBe(90)
  })

  it('reports 90-day volatility beside the rating without scoring it', () => {
    const r = rateAsset({ kind: 'crypto', closes: flat(366), dollarVolumes: flat(366, 1e9), marketCapUsd: 1e10 }, NOW)
    if (!r.rated) throw new Error('expected a rating')
    expect(r.recentVolatility).toBe(0)
    expect(r.dimensions.map((d) => d.key)).not.toContain('recentVolatility')
  })
})

describe('stability rule', () => {
  const weeks = (cls: 1 | 2 | 3 | 4 | 5 | 6 | 7, n: number) => Array.from({ length: n }, () => cls)

  it('a new rating starts at its current class', () => {
    expect(applyStability(null, [5])).toEqual({ shownCls: 5, currentCls: 5, held: false })
  })

  it('holds the shown class until every reading in the window is outside it', () => {
    const r = applyStability(4, [...weeks(5, M.stabilityWeeks - 1)])
    expect(r).toEqual({ shownCls: 4, currentCls: 5, held: true })
    const one = applyStability(4, [...weeks(5, M.stabilityWeeks - 1), 4])
    expect(one.shownCls).toBe(4)
  })

  it('a single reading back in the shown class resets the clock', () => {
    const r = applyStability(4, [...weeks(5, 8), 4, ...weeks(5, M.stabilityWeeks - 1)])
    expect(r.shownCls).toBe(4)
  })

  it('moves to the class matched most often once the window is all outside', () => {
    const r = applyStability(4, [...weeks(6, 10), ...weeks(5, M.stabilityWeeks - 10)])
    expect(r).toEqual({ shownCls: 6, currentCls: 5, held: true })
    const s = applyStability(4, weeks(5, M.stabilityWeeks))
    expect(s).toEqual({ shownCls: 5, currentCls: 5, held: false })
  })
})
