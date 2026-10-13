import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// Who may ask /live-data/ohlcv for closing prices (T-423, D103).
//
// `closes=1` gets DefiLlama's prices in the candle shape: open, high and low are
// the close, and volume is 0. A reader of highs, lows or volume fed that computes
// zero ranges and no volume without any error, which is why CLAUDE.md says to add
// it nowhere else. This test is what makes that a rule rather than a request:
// every file asking for closes must be listed here with why it is safe, and the
// two that also hold full-candle code (the scanner and the grid) must call it in
// its closes-only form.

const SRC = join(__dirname, '..', '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

/** Source with comments removed, so a file that only DESCRIBES `closes=1` is not counted as asking. */
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const rel = (file: string) => relative(SRC, file).split(sep).join('/')

const READERS: Record<string, string> = {
  'lib/technicals/sweep.ts': 'defines SWEEP_WANTS; the Coins screener computes RSI, averages and volatility from closes',
  'components/assets/CycleContext.tsx': 'Pi Cycle compares two moving averages of the close',
  'hooks/useCryptoChartSeries.ts': 'asks for closes only where candles are missing or 4-day, and returns closeOnly so the chart offers only the closes-only indicators',
  'app/(dashboard)/scanner/page.tsx': "runs detectSetups and computeSignalSummary with 'close'",
  'components/analytics/technical/MultiTimeframeGrid.tsx': "runs computeSignalSummary with 'close'",
  'lib/data/dataSources.ts': 'describes the parameter in the ohlcv entry’s notes; fetches nothing',
  'lib/agents/tools.ts': 'get_price_history asks for closes only when candles fail, and then reports highestClose and lowestClose, never a high or low',
}

// `source=defillama` reaches the same prices without `closes=1`, so it counts as asking too.
const askers = walk(SRC).filter((f) => /closes=1|SWEEP_WANTS|source=defillama/.test(code(f))).map(rel).sort()

describe('closes=1 readers', () => {
  it('every file asking for closing prices is a known closes-only reader', () => {
    expect(askers).toEqual(Object.keys(READERS).sort())
  })

  it.each([
    ['app/(dashboard)/scanner/page.tsx', ['detectSetups', 'computeSignalSummary']],
    ['components/analytics/technical/MultiTimeframeGrid.tsx', ['computeSignalSummary']],
  ] as const)("%s reads closes in their closes-only form", (file, fns) => {
    const src = code(join(SRC, file))
    // Every chart-route request carries the closes parameter…
    const requests = [...src.matchAll(/`\/live-data\/ohlcv\?[^`]*`/g)].map((m) => m[0])
    expect(requests.length, 'ohlcv requests').toBeGreaterThan(0)
    for (const r of requests) expect(r, r).toContain('${SWEEP_WANTS}')
    // …and every reading of them passes 'close'.
    for (const fn of fns) {
      const calls = [...src.matchAll(new RegExp(`${fn}\\(([^)]*)\\)`, 'g'))].map((m) => m[1])
      expect(calls.length, `${fn} calls`).toBeGreaterThan(0)
      for (const args of calls) expect(args, `${fn}(${args})`).toMatch(/,\s*'close'\s*$/)
    }
  })
})
