import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PAR_MATURITIES, REAL_MATURITIES, breakeven, buildYieldHistory, closingCandles, expectedInflationTable,
  intervalFor, isParMaturity, parLabelFor, rangeStart, yearsFor, type DatedCurve,
} from '../yieldHistory'
import { RATES_CATALOG } from '../ratesCatalog'
import { parseCurveFile, parseEntry } from '@/lib/server/treasuryCurve'

// T-446 (D202): Treasury yield history from the official daily curve, and the
// bond market's expected inflation, ordinary minus real yield on the same day.

const NOW = new Date('2026-11-07T12:00:00Z')
const day = (date: string, points: Record<string, number>): DatedCurve => ({
  date, points: Object.entries(points).map(([label, yieldPct]) => ({ label, yieldPct })),
})

describe('which years and days a range covers', () => {
  it('counts back from the end date and asks for every calendar year in between', () => {
    expect(rangeStart('1mo', NOW)).toBe('2026-10-07')
    expect(rangeStart('1y', NOW)).toBe('2025-11-07')
    expect(yearsFor('3mo', NOW)).toEqual([2026])
    expect(yearsFor('1y', NOW)).toEqual([2025, 2026])
    expect(yearsFor('10y', NOW)).toEqual(Array.from({ length: 11 }, (_, i) => 2016 + i))
    // Early January: a one-month range still needs December's file.
    expect(yearsFor('1mo', new Date('2026-01-05T12:00:00Z'))).toEqual([2025, 2026])
  })

  it('keeps daily readings up to a year and weekly ones beyond', () => {
    expect(['1mo', '3mo', '6mo', '1y'].map((r) => intervalFor(r as '1y'))).toEqual(['daily', 'daily', 'daily', 'daily'])
    expect(intervalFor('5y')).toBe('weekly')
    expect(intervalFor('10y')).toBe('weekly')
  })
})

describe('a maturity’s history', () => {
  const nominal = [
    day('2026-11-03', { '10Y': 4.10, '2Y': 3.6 }),
    day('2026-11-02', { '10Y': 4.05, '2Y': 3.5 }),
    day('2026-11-04', { '2Y': 3.7 }),
    day('2026-11-05', { '10Y': 4.20 }),
  ]
  const real = [day('2026-11-02', { '10Y': 1.80 }), day('2026-11-05', { '10Y': 1.85 })]

  it('reads each day the curve has the maturity, oldest first, with expected inflation only where both were published', () => {
    expect(buildYieldHistory('10Y', nominal, real, '2026-11-01', 'daily')).toEqual([
      { date: '2026-11-02', yieldPct: 4.05, realPct: 1.80, breakevenPct: 2.25 },
      { date: '2026-11-03', yieldPct: 4.10 },
      { date: '2026-11-05', yieldPct: 4.20, realPct: 1.85, breakevenPct: 2.35 },
    ])
    // Mutation: subtract the wrong way, or round differently, and this fails.
    expect(breakeven(4.33, 1.89)).toBe(2.44)
  })

  it('starts at the range’s first day and never repeats a date', () => {
    const twice = [...nominal, day('2026-11-03', { '10Y': 9.99 })]
    const h = buildYieldHistory('10Y', twice, [], '2026-11-03', 'daily')
    expect(h.map((p) => p.date)).toEqual(['2026-11-03', '2026-11-05'])
  })

  it('keeps each week’s last reading over a long span', () => {
    const days = ['2026-10-26', '2026-10-27', '2026-10-30', '2026-11-02', '2026-11-06'].map((d, i) => day(d, { '10Y': 4 + i / 10 }))
    expect(buildYieldHistory('10Y', days, [], '2026-01-01', 'weekly').map((p) => p.date)).toEqual(['2026-10-30', '2026-11-06'])
  })

  it('turns the history into closing-only candles: one figure a day, no range, no volume', () => {
    const [c] = closingCandles([{ date: '2026-11-05', yieldPct: 4.2 }])
    expect(c).toEqual({ time: Date.UTC(2026, 10, 5) / 1000, open: 4.2, high: 4.2, low: 4.2, close: 4.2, volume: 0 })
  })
})

describe('expected inflation by maturity', () => {
  it('takes both curves from the newest day they share, never mixing two days', () => {
    // The real curve is a day behind: the table uses 11-05 for both, not 11-06's ordinary yields.
    const t = expectedInflationTable(
      [day('2026-11-05', { '5Y': 4.0, '10Y': 4.3 }), day('2026-11-06', { '5Y': 9, '10Y': 9 })],
      [day('2026-11-05', { '5Y': 1.6, '10Y': 1.9, '30Y': 2.1 })],
    )
    expect(t).toEqual({
      date: '2026-11-05',
      rows: [
        { label: '5Y', yieldPct: 4.0, realPct: 1.6, breakevenPct: 2.4 },
        { label: '10Y', yieldPct: 4.3, realPct: 1.9, breakevenPct: 2.4 },
      ],
    })
    expect(expectedInflationTable([day('2026-11-06', { '10Y': 4 })], [day('2026-11-05', { '10Y': 2 })])).toBeNull()
  })

  it('exists only where the Treasury publishes a real yield', () => {
    expect(REAL_MATURITIES).toEqual(['5Y', '7Y', '10Y', '20Y', '30Y'])
    for (const m of REAL_MATURITIES) expect(isParMaturity(m)).toBe(true)
  })
})

describe('reading the Treasury’s files', () => {
  const realEntry = `<entry><content><m:properties>
    <d:NEW_DATE m:type="Edm.DateTime">2026-11-06T00:00:00</d:NEW_DATE>
    <d:TC_5YEAR m:type="Edm.Double">2.35</d:TC_5YEAR>
    <d:TC_7YEAR m:type="Edm.Double">2.48</d:TC_7YEAR>
    <d:TC_10YEAR m:type="Edm.Double">2.63</d:TC_10YEAR>
    <d:TC_20YEAR m:type="Edm.Double">2.91</d:TC_20YEAR>
    <d:TC_30YEAR m:type="Edm.Double">3.07</d:TC_30YEAR>
  </m:properties></content></entry>`

  it('reads the real curve’s five maturities, as the file of 2026-11-06 wrote them', () => {
    expect(parseEntry(realEntry, 'real')).toEqual({
      date: '2026-11-06',
      points: [
        { label: '5Y', years: 5, yieldPct: 2.35 }, { label: '7Y', years: 7, yieldPct: 2.48 },
        { label: '10Y', years: 10, yieldPct: 2.63 }, { label: '20Y', years: 20, yieldPct: 2.91 },
        { label: '30Y', years: 30, yieldPct: 3.07 },
      ],
    })
    expect(parseCurveFile(`<feed>${realEntry}${realEntry.replace('2026-11-06', '2026-11-05')}</feed>`, 'real').map((s) => s.date))
      .toEqual(['2026-11-05', '2026-11-06'])
  })

  it('still refuses a par row missing its long end', () => {
    expect(parseEntry(realEntry, 'par')).toBeNull()
  })
})

describe('the pages and tools read the curve’s history', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../../..', p), 'utf8')

  it('maps every yield index to a maturity the curve publishes', () => {
    for (const r of RATES_CATALOG.filter((x) => x.quoteBasis === 'pct')) expect(parLabelFor(r.maturityYears), r.symbol).not.toBeNull()
    expect(PAR_MATURITIES).toHaveLength(13)
  })

  it('charts a yield page from the curve, never the quote ladder', () => {
    // Mutation: put PriceChartCard back for yields and this fails.
    const detail = read('src/app/(dashboard)/macro/rates/[slug]/RatesDetailClient.tsx')
    expect(detail).toMatch(/isYield && parLabelFor\(entry\.maturityYears\)\s*\?\s*<YieldHistoryCard/)
  })

  it('shows expected inflation on Bonds & Rates and hands it to the agent', () => {
    expect(read('src/app/(dashboard)/macro/rates/RatesClient.tsx')).toMatch(/curve\.expectedInflation\.rows\.map/)
    expect(read('src/lib/agents/tools.ts')).toMatch(/expectedInflation: data\.expectedInflation/)
  })

  it('draws a yield on the TA page as a line with closes-only indicators and no patterns', () => {
    const ta = read('src/app/(dashboard)/macro/technical-analysis/page.tsx')
    expect(ta).toContain('const CLOSES_INDICATORS = indicatorsFor(false, false)')
    expect(ta).toContain("computeSignalSummary(candles, closesOnly ? 'close' : 'ohlc')")
    expect(ta).toContain('candles.length >= 30 && !closesOnly ? detectPatterns(candles) : []')
  })
})
