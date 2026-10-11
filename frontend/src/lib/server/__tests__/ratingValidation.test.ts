import { describe, expect, it } from 'vitest'
import {
  PRIIPS_EDGES, countChanges, euCalibratedCurves, mean, median, mondays, monthlySamples, priipsBandClass, quarterStarts,
  ranks, spearman, typicalDrawdown, withPatch,
} from '../../../../scripts/lib/ratingValidation'
import { METHODOLOGY_V1 as M } from '@/lib/risk/methodology/v1'
import { classForScore, rateAsset } from '@/lib/risk/assetRating'
import { piecewise } from '@/lib/risk/normalize'

// The helpers behind scripts/validate-ratings.ts (T-420 item 7). Their numbers decide the
// owner's choice of weights and curves, so each is checked against a hand-worked answer.

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (x: Date) => x.toISOString().slice(0, 10)

describe('statistics', () => {
  it('mean and median, and nothing from nothing', () => {
    expect(mean([1, 2, 6])).toBe(3)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
  })

  it('ties share the average of the ranks they span', () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(ranks([3, 1, 2])).toEqual([3, 1, 2])
  })

  it('Spearman: perfect, reversed, a worked case with a tie, and too little to say', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1)
    expect(spearman([1, 2, 3, 4], [9, 7, 5, 1])).toBeCloseTo(-1)
    // Ranks x = [1,2,3,4,5], y = [2,1,4,3,5] → ρ = 1 − 6·4/(5·24) = 0.8
    expect(spearman([10, 20, 30, 40, 50], [2, 1, 4, 3, 5])).toBeCloseTo(0.8)
    // With a tie the Pearson-on-ranks form is used: y ranks [1, 2.5, 2.5, 4]
    expect(spearman([1, 2, 3, 4], [1, 5, 5, 9])).toBeCloseTo(0.9487, 3)
    expect(spearman([1, 2], [3, 4])).toBeNull()
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull()
    expect(() => spearman([1, 2, 3], [1, 2])).toThrow(RangeError)
  })
})

describe('the PRIIPs band (survey §1.1)', () => {
  it('maps plain volatility onto the seven classes, edges inclusive upward', () => {
    expect(priipsBandClass(0.004)).toBe(1)
    expect(priipsBandClass(0.005)).toBe(2)
    expect(priipsBandClass(0.248)).toBe(5)
    expect(priipsBandClass(0.3)).toBe(6)
    expect(priipsBandClass(0.44)).toBe(6)
    expect(priipsBandClass(0.8)).toBe(7)
    expect(priipsBandClass(1.5)).toBe(7)
  })
})

describe('variant B: price curves tuned to the PRIIPs bands', () => {
  const eu = euCalibratedCurves(M.classes.map((c) => c.min))
  const classOf = (score: number) => classForScore(score).cls

  it('puts volatility in the class PRIIPs gives it, on both sides of every band edge', () => {
    PRIIPS_EDGES.forEach((edge) => {
      for (const v of [edge * 0.95, edge * 1.02]) {
        expect(classOf(piecewise(v, eu.volatility)), `volatility ${v}`).toBe(priipsBandClass(v))
      }
    })
    expect(classOf(piecewise(0.001, eu.volatility))).toBe(1)
    expect(classOf(piecewise(2, eu.volatility))).toBe(7)
  })

  it('places the drawdown boundaries at the fall a random walk at each edge typically shows in a year', () => {
    expect(typicalDrawdown(0.2)).toBeCloseTo(1 - Math.exp(-0.2 * Math.sqrt(Math.PI / 2)), 10)
    expect(typicalDrawdown(0.2)).toBeCloseTo(0.222, 3)
    expect(typicalDrawdown(0.8)).toBeCloseTo(0.633, 3)
    expect(eu.drawdown.map(([, s]) => s)).toEqual(eu.volatility.map(([, s]) => s))
    eu.volatility.forEach(([sigma], i) => expect(eu.drawdown[i][0]).toBeCloseTo(typicalDrawdown(sigma), 12))
  })

  it('both curves rise in value and fall in score, as the engine’s interpolation needs', () => {
    for (const curve of [eu.volatility, eu.drawdown]) {
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i][0]).toBeGreaterThan(curve[i - 1][0])
        expect(curve[i][1]).toBeLessThan(curve[i - 1][1])
      }
    }
    expect(() => euCalibratedCurves([86, 72])).toThrow(RangeError)
  })
})

describe('dates', () => {
  it('quarter starts inside the span, the first one included when the span opens on it', () => {
    expect(quarterStarts(d('2024-02-15'), d('2025-01-01')).map(iso)).toEqual(['2024-04-01', '2024-07-01', '2024-10-01', '2025-01-01'])
    expect(quarterStarts(d('2024-04-01'), d('2024-06-30')).map(iso)).toEqual(['2024-04-01'])
    expect(quarterStarts(d('2024-11-02'), d('2025-04-01')).map(iso)).toEqual(['2025-01-01', '2025-04-01'])
  })

  it('Mondays inside the span', () => {
    expect(mondays(d('2026-10-07'), d('2026-10-20')).map(iso)).toEqual(['2026-10-12', '2026-10-19'])
    expect(mondays(d('2026-10-05'), d('2026-10-05')).map(iso)).toEqual(['2026-10-05'])
  })

  it('monthly samples take each month’s first value, and changes are counted between neighbours', () => {
    const dates = [d('2026-01-05'), d('2026-01-12'), d('2026-02-02'), d('2026-02-09'), d('2026-03-02')]
    expect(monthlySamples(dates, [4, 5, 5, 6, 4])).toEqual([4, 5, 4])
    expect(countChanges([4, 5, 4])).toBe(2)
    expect(countChanges([3, 3, 3])).toBe(0)
  })
})

describe('trying a variant of the method', () => {
  it('patches in place for the run, then restores every value, even when the run throws', () => {
    const m = { a: 1, nested: { list: [[1, 2], [3, 4]] as number[][], n: 5 } }
    const seen = withPatch(m, (x) => { x.a = 9; x.nested.list = [[0, 0]]; x.nested.n = 7 }, () => JSON.stringify(m))
    expect(seen).toBe('{"a":9,"nested":{"list":[[0,0]],"n":7}}')
    expect(m).toEqual({ a: 1, nested: { list: [[1, 2], [3, 4]], n: 5 } })
    expect(() => withPatch(m, (x) => { x.a = 2 }, () => { throw new Error('boom') })).toThrow('boom')
    expect(m.a).toBe(1)
  })

  it('the engine sees the patch while it runs, and the baseline is back afterwards', () => {
    // A coin whose price falls hard but trades deeply: the cap rule lifts it one class.
    const closes = Array.from({ length: 365 }, (_, i) => 100 * Math.exp(-1.9 * i / 364) * (1 + 0.08 * (i % 2 ? -1 : 1)))
    const inputs = { kind: 'crypto' as const, closes, dollarVolumes: Array(30).fill(3e10), marketCapUsd: 1e12 }
    const before = rateAsset(inputs)
    const during = withPatch(M, (m) => { (m as unknown as { capClassesAboveCore: number }).capClassesAboveCore = 0 }, () => rateAsset(inputs))
    const after = rateAsset(inputs)
    if (!before.rated || !during.rated || !after.rated) throw new Error('fixture not rated')
    expect(during.cls).toBeGreaterThan(before.cls) // no lift → a higher class
    expect(after).toEqual(before)
    expect(M.capClassesAboveCore).toBe(1)
  })
})
