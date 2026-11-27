import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BENCHMARK_CHOICES, benchmarkMethodNote, benchmarkShownFigure, benchmarkWithheldWords,
  replayAgainstBenchmark, type BenchmarkClose, type BenchmarkReplay,
} from '../benchmarkCompare'
import type { MoneyFlow } from '../trackedPortfolioViews'

// T-473 (D245): the user's own dated cash flows replayed into one index fund.
// Hand-computed cases drive the arithmetic; the wording tests hold the shape
// the owner approved — two figures, the method, and NO verdict word (counsel
// question A16 reviews that shape before launch).

const flow = (date: string | null, amountUsd: string, direction: 'in' | 'out'): MoneyFlow => ({ date, amountUsd, direction })
const closes = (...rows: Array<[string, number]>): BenchmarkClose[] => rows.map(([date, close]) => ({ date, close }))
const NOW = new Date('2026-01-01T00:00:00Z')

describe('replayAgainstBenchmark', () => {
  it('a deposit buys at the closing price ON OR AFTER its date — a weekend flow waits for Monday', () => {
    const r = replayAgainstBenchmark(
      [flow('2026-01-03', '1000', 'in')], // a Saturday
      closes(['2026-01-02', 100], ['2026-01-05', 110], ['2026-01-30', 120]),
      'splits-and-dividends', 'VOO', NOW,
    )
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    // 1000 / 110 = 9.0909… units × 120 = 1090.909…
    expect(r.valueUsd).toBeCloseTo(1090.909, 2)
    expect(r.totalPct).toBeCloseTo(9.0909, 3)
    expect(r.since).toBe('2026-01-03')
    expect(r.asOf).toBe('2026-01-30')
  })

  it('a withdrawal sells units at its date’s close, and the total return counts it', () => {
    const r = replayAgainstBenchmark(
      [flow('2026-01-02', '1000', 'in'), flow('2026-01-05', '550', 'out')],
      closes(['2026-01-02', 100], ['2026-01-05', 110], ['2026-01-30', 120]),
      'splits-and-dividends', 'VOO', NOW,
    )
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    // 10 units bought; 550/110 = 5 sold; 5 × 120 = 600 held.
    expect(r.valueUsd).toBeCloseTo(600, 6)
    // (600 + 550 − 1000) / 1000 = 15%
    expect(r.totalPct).toBeCloseTo(15, 6)
    expect(r.takenOutUsd).toBe(550)
  })

  it('the yearly rate is the same solver on the same dates — a clean 2-year double-digit case', () => {
    // 2024-01-02 → 2026-01-01 is exactly 730 days = 2.0 of the solver's years;
    // 100 → 121 over that span is 10% a year.
    const r = replayAgainstBenchmark(
      [flow('2024-01-02', '1000', 'in')],
      closes(['2024-01-02', 100], ['2025-12-31', 121]),
      'splits-and-dividends', 'SPY', NOW,
    )
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.valueUsd).toBeCloseTo(1210, 6)
    expect(r.ratePct).toBeCloseTo(10.0, 2)
  })

  it('money in before the history starts is withheld with both dates — never guessed backwards', () => {
    const r = replayAgainstBenchmark(
      [flow('2020-06-01', '1000', 'in')],
      closes(['2021-01-04', 100], ['2026-01-30', 120]),
      'splits-and-dividends', 'VOO', NOW,
    )
    expect(r).toMatchObject({ kind: 'none', why: 'history-short', historyStart: '2021-01-04', firstFlow: '2020-06-01' })
  })

  it('closes without the fund’s payouts are refused, naming the basis', () => {
    for (const basis of ['splits', 'unadjusted'] as const) {
      const r = replayAgainstBenchmark(
        [flow('2026-01-02', '1000', 'in')],
        closes(['2026-01-02', 100], ['2026-01-30', 120]),
        basis, 'VOO', NOW,
      )
      expect(r).toMatchObject({ kind: 'none', why: 'basis', basis })
    }
  })

  it('an undated flow withholds — its money cannot be placed on the history', () => {
    const r = replayAgainstBenchmark(
      [flow(null, '1000', 'in'), flow('2026-01-02', '500', 'in')],
      closes(['2026-01-02', 100], ['2026-01-30', 120]),
      'splits-and-dividends', 'VOO', NOW,
    )
    expect(r).toMatchObject({ kind: 'none', why: 'undated-flow' })
  })

  it('taking out more than the path would have held refuses the counterfactual, dated', () => {
    const r = replayAgainstBenchmark(
      [flow('2026-01-02', '100', 'in'), flow('2026-01-05', '200', 'out')],
      closes(['2026-01-02', 100], ['2026-01-05', 110], ['2026-01-30', 120]),
      'splits-and-dividends', 'VOO', NOW,
    )
    expect(r).toMatchObject({ kind: 'none', why: 'withdrawal-exceeds', onDate: '2026-01-05' })
  })

  it('nothing put in, or no closes at all, reads as its own reason', () => {
    expect(replayAgainstBenchmark([flow('2026-01-02', '10', 'out')], closes(['2026-01-02', 100]), 'splits-and-dividends', 'VOO', NOW))
      .toMatchObject({ kind: 'none', why: 'no-flows' })
    expect(replayAgainstBenchmark([flow('2026-01-02', '10', 'in')], [], 'splits-and-dividends', 'VOO', NOW))
      .toMatchObject({ kind: 'none', why: 'no-closes' })
  })

  it('every withheld kind has plain words, and the method note says the rules', () => {
    const kinds: Array<Exclude<BenchmarkReplay, { kind: 'ok' }>> = [
      { kind: 'none', why: 'no-flows' },
      { kind: 'none', why: 'undated-flow' },
      { kind: 'none', why: 'basis', basis: 'splits' },
      { kind: 'none', why: 'no-closes' },
      { kind: 'none', why: 'history-short', historyStart: '2021-01-04', firstFlow: '2020-06-01' },
      { kind: 'none', why: 'withdrawal-exceeds', onDate: '2026-01-05' },
    ]
    for (const k of kinds) expect(benchmarkWithheldWords(k).length).toBeGreaterThan(20)
    const note = benchmarkMethodNote('VOO', '2026-01-30')
    expect(note).toContain('VOO')
    expect(note).toContain('2026-01-30')
    expect(note).toContain('dividend-adjusted')
    expect(note).toContain('does not say what you should have done')
  })
})

describe('benchmarkShownFigure — the card annualizes only while the return tile does (D208)', () => {
  // The asymmetry the 2026-11-26 audit measured: a 90-day path up 2.5%
  // annualizes to about +10.5% a year, beside a tile that (under a year,
  // D208) shows the plain +2.5% total. The shown figure must follow the tile.
  const under = replayAgainstBenchmark(
    [flow('2025-10-03', '1000', 'in')],
    closes(['2025-10-03', 100], ['2025-12-31', 102.5]),
    'splits-and-dividends', 'VOO', NOW,
  )

  it('a tile showing a plain total (under a year) gets the replay’s plain total, never the rate', () => {
    expect(under.kind).toBe('ok')
    if (under.kind !== 'ok') return
    // The solver DOES produce an annualized figure here — which is exactly
    // what must not be shown while the tile’s own figure is a total.
    expect(under.ratePct).not.toBeNull()
    expect(under.ratePct!).toBeGreaterThan(9)
    const shown = benchmarkShownFigure(under, 'total')
    expect(shown.perYear).toBe(false)
    expect(shown.pct).toBeCloseTo(2.5, 6)
  })

  it('a tile showing a yearly rate gets the replay’s yearly rate', () => {
    const r = replayAgainstBenchmark(
      [flow('2024-01-02', '1000', 'in')],
      closes(['2024-01-02', 100], ['2025-12-31', 121]),
      'splits-and-dividends', 'SPY', NOW,
    )
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    const shown = benchmarkShownFigure(r, 'yearly')
    expect(shown.perYear).toBe(true)
    expect(shown.pct).toBeCloseTo(10.0, 2)
  })

  it('a yearly tile beside a replay the solver could not rate falls back to the total', () => {
    expect(under.kind).toBe('ok')
    if (under.kind !== 'ok') return
    const shown = benchmarkShownFigure({ ...under, ratePct: null }, 'yearly')
    expect(shown.perYear).toBe(false)
    expect(shown.pct).toBeCloseTo(2.5, 6)
  })

  it('the card reads the figure through the helper, keyed on the tile’s kind', () => {
    const card = readFileSync(join(__dirname, '../../../', 'components/portfolio/tracked/BenchmarkCompareCard.tsx'), 'utf8')
    expect(card).toContain('benchmarkShownFigure(replay, earned.kind)')
    // The raw rate must not reach the JSX except through the helper.
    expect(card).not.toMatch(/replay\.ratePct/)
  })
})

describe('the shape the owner approved (A16): facts side by side, no verdict', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../../', p), 'utf8')
  const engine = read('lib/data/benchmarkCompare.ts')
  const card = read('components/portfolio/tracked/BenchmarkCompareCard.tsx')

  it('no verdict vocabulary anywhere in the engine or the card', () => {
    for (const src of [engine, card]) {
      expect(src).not.toMatch(/\bbeat\b|\bbeats\b|outperform|underperform|worse than|better than|\bwinning\b|\blosing\b/i)
    }
  })

  it('the card renders only when the portfolio’s own return shows a figure, and hands the engine the basis', () => {
    expect(card).toContain("if (earned.kind === 'none') return null")
    expect(card).toContain('c.basis')
    // The not-advice line is rendered, never pasted (the featureNotices rule).
    expect(card).toContain('<FeatureNotice feature="calculators"')
  })

  it('the detail page mounts it beside the return tile, after prices resolve', () => {
    const page = read('components/portfolio/tracked/TrackedPortfolioDetail.tsx')
    expect(page).toContain('<BenchmarkCompareCard trades={view.trades} earned={earned} />')
  })

  it('the benchmark list is short, fixed and broad — and the methods page carries the method (D163)', () => {
    expect(BENCHMARK_CHOICES.length).toBeLessThanOrEqual(4)
    const methods = read('lib/legal/dataMethods.ts')
    expect(methods).toContain('one broad index fund the reader picks')
    expect(methods).toContain('no word judges the difference')
  })

  it('the counsel brief carries the A16 question (the D237 pattern: built now, reviewed before launch)', () => {
    const brief = readFileSync(join(__dirname, '../../../../../docs/assessments/counsel-brief-2026-10-26.md'), 'utf8')
    expect(brief).toContain('| A16 |')
    expect(brief).toContain('T-473')
  })
})
