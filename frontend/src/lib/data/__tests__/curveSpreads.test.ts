import { describe, expect, it } from 'vitest'
import {
  MAX_READING_GAP_DAYS, dailySpreads, gapNow, invertedStretches, shadeRanges, spreadsOfCurve,
  type CurveLike, type SpreadPoint,
} from '../curveSpreads'

// T-464: the gaps between short and long Treasury yields over time. Facts only: each day's
// 10Y − 2Y and 10Y − 3M, the stretches below zero, and where each stands now.

const curve = (date: string, y2: number | null, y10: number | null, m3: number | null = 4): CurveLike => ({
  date,
  points: [
    ...(m3 == null ? [] : [{ label: '3M', yieldPct: m3 }]),
    ...(y2 == null ? [] : [{ label: '2Y', yieldPct: y2 }]),
    ...(y10 == null ? [] : [{ label: '10Y', yieldPct: y10 }]),
  ],
})

/** Business-day-ish dates: one a day from `start`, `n` of them. */
const days = (start: string, n: number) => Array.from({ length: n }, (_, i) =>
  new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))

const series = (start: string, values: number[]): SpreadPoint[] =>
  days(start, values.length).map((date, i) => ({ date, spread2s10s: values[i] }))

describe('spreadsOfCurve', () => {
  it('is the 10-year minus the 2-year and minus the 3-month, to hundredths', () => {
    expect(spreadsOfCurve(curve('2026-01-02', 4.1, 4.55, 4.333))).toEqual({ spread2s10s: 0.45, spread3m10y: 0.22 })
  })

  it('leaves a gap out when the curve lacks one of its maturities', () => {
    expect(spreadsOfCurve(curve('2026-01-02', null, 4.5, 4.2))).toEqual({ spread2s10s: undefined, spread3m10y: 0.3 })
  })
})

describe('dailySpreads', () => {
  it('is oldest first, one per date, from the given day, and skips a day with neither gap', () => {
    const out = dailySpreads([
      curve('2026-01-05', 4, 4.5), curve('2026-01-02', 4, 4.4), curve('2026-01-05', 9, 9),
      curve('2026-01-06', null, 4.5, null), curve('2025-12-31', 4, 4.3),
    ], '2026-01-01')
    expect(out.map((p) => [p.date, p.spread2s10s])).toEqual([['2026-01-02', 0.4], ['2026-01-05', 0.5]])
  })
})

describe('invertedStretches', () => {
  it('finds each run below zero, with its readings and its lowest point', () => {
    const s = invertedStretches(series('2026-01-01', [0.2, -0.1, -0.3, -0.2, 0.1, -0.05, 0.3]), 'spread2s10s')
    expect(s).toEqual([
      { start: '2026-01-02', end: '2026-01-04', startKnown: true, endKnown: true, ongoing: false, readings: 3, deepest: -0.3, deepestOn: '2026-01-03' },
      { start: '2026-01-06', end: '2026-01-06', startKnown: true, endKnown: true, ongoing: false, readings: 1, deepest: -0.05, deepestOn: '2026-01-06' },
    ])
  })

  it('does not count exactly zero as below zero', () => {
    expect(invertedStretches(series('2026-01-01', [0.1, 0, 0, 0.2]), 'spread2s10s')).toEqual([])
  })

  it('marks a run still going at the latest reading, and one that began at the first reading read', () => {
    const s = invertedStretches(series('2026-01-01', [-0.2, -0.1, 0.1, -0.4, -0.5]), 'spread2s10s')
    expect(s[0]).toMatchObject({ start: '2026-01-01', startKnown: false, ongoing: false })
    expect(s[1]).toMatchObject({ start: '2026-01-04', startKnown: true, ongoing: true, deepest: -0.5 })
  })

  it('skips a day without that gap rather than ending the run there', () => {
    const pts: SpreadPoint[] = [
      { date: '2026-01-01', spread2s10s: 0.1 },
      { date: '2026-01-02', spread2s10s: -0.1 },
      { date: '2026-01-03', spread3m10y: 0.4 },
      { date: '2026-01-04', spread2s10s: -0.2 },
    ]
    expect(invertedStretches(pts, 'spread2s10s')).toEqual([
      expect.objectContaining({ start: '2026-01-02', end: '2026-01-04', readings: 2, ongoing: true }),
    ])
  })

  it('never carries a run across a gap in the readings (a year that could not be read)', () => {
    // Mutation: drop the gap rule and the two runs join into one, from January to March.
    const pts: SpreadPoint[] = [
      { date: '2026-01-01', spread2s10s: 0.1 },
      { date: '2026-01-02', spread2s10s: -0.1 },
      { date: '2026-01-05', spread2s10s: -0.2 },
      { date: '2026-03-02', spread2s10s: -0.3 },
      { date: '2026-03-03', spread2s10s: 0.2 },
    ]
    expect(MAX_READING_GAP_DAYS).toBeLessThan(57)
    expect(invertedStretches(pts, 'spread2s10s')).toEqual([
      expect.objectContaining({ start: '2026-01-02', end: '2026-01-05', startKnown: true, endKnown: false }),
      expect.objectContaining({ start: '2026-03-02', end: '2026-03-02', startKnown: false, endKnown: true }),
    ])
  })

  it('carries a run over a long weekend', () => {
    const pts: SpreadPoint[] = [
      { date: '2026-01-02', spread2s10s: -0.1 },
      { date: '2026-01-06', spread2s10s: -0.2 },
    ]
    expect(invertedStretches(pts, 'spread2s10s')).toHaveLength(1)
  })
})

describe('gapNow', () => {
  it('says how long a gap still below zero has been', () => {
    const now = gapNow(series('2026-01-01', [0.2, -0.1, -0.3]), 'spread2s10s')
    expect(now).toMatchObject({ date: '2026-01-03', value: -0.3, inverted: true, stretch: { start: '2026-01-02', ongoing: true } })
  })

  it('gives the most recent stretch when the gap is above zero now', () => {
    const now = gapNow(series('2026-01-01', [-0.1, -0.3, 0.2, 0.4]), 'spread2s10s')
    expect(now).toMatchObject({ value: 0.4, inverted: false, stretch: { start: '2026-01-01', end: '2026-01-02', ongoing: false } })
  })

  it('reads the latest stretch, not the first, when there were several', () => {
    // Mutation: take the first stretch and a curve last below zero last week reads as two years ago.
    const now = gapNow(series('2026-01-01', [-0.6, -0.5, 0.2, -0.1, 0.3]), 'spread2s10s')
    expect(now?.stretch).toMatchObject({ start: '2026-01-04', end: '2026-01-04', deepest: -0.1 })
  })

  it('has no stretch when the gap was never below zero, and nothing without readings', () => {
    expect(gapNow(series('2026-01-01', [0.2, 0.3]), 'spread2s10s')).toEqual({ date: '2026-01-02', value: 0.3, inverted: false })
    expect(gapNow([], 'spread2s10s')).toBeNull()
  })
})

describe('shadeRanges', () => {
  const s = (start: string, end: string) => ({ start, end, startKnown: true, endKnown: true, ongoing: false, readings: 1, deepest: -0.1, deepestOn: start })

  it('shades from the first to the last chart date inside each stretch', () => {
    const dates = ['2026-01-02', '2026-01-09', '2026-01-16', '2026-01-23']
    expect(shadeRanges(dates, [s('2026-01-05', '2026-01-20')])).toEqual([{ x1: '2026-01-09', x2: '2026-01-16' }])
  })

  it('still shows a stretch shorter than the weekly spacing, at the next chart date', () => {
    const dates = ['2026-01-02', '2026-01-09', '2026-01-16']
    expect(shadeRanges(dates, [s('2026-01-05', '2026-01-06')])).toEqual([{ x1: '2026-01-09', x2: '2026-01-09' }])
    expect(shadeRanges(dates, [s('2025-11-05', '2025-11-06')])).toEqual([])
  })
})
