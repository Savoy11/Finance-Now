import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// Coin Metrics' credit reaches the reader wherever its prices do (T-434, D108).
//
// Its licence (CC BY-NC 4.0) asks for a credit wherever the data is shown, and the
// owner chose to show it only where Coin Metrics actually served: the chart route
// sends it as `attributions` on those responses alone. So every file that asks for
// closing prices (the only requests Coin Metrics answers) must carry those
// attributions on to the page, or the credit silently goes missing. closesReaders.test.ts
// lists who may ask; this checks each one passes the credit on, so a new reader fails
// here until it does.

const SRC = join(__dirname, '..', '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

/** Source with comments removed, so a comment saying the right thing does not pass. */
const code = (file: string) =>
  readFileSync(join(SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const rel = (file: string) => relative(SRC, file).split(sep).join('/')
const files = walk(SRC).map(rel)

/** How each closes reader carries the credit on, as code that must be present. */
const CARRIES_CREDIT: Record<string, readonly string[]> = {
  'lib/technicals/sweep.ts': ['parseCredits(json.attributions)', 'onCredits?.(credits)'],
  'hooks/useCryptoChartSeries.ts': ['credits: parseCredits(data?.attributions)'],
  'components/assets/CycleContext.tsx': ['parseCredits(btcDaily.attributions)', '<RequiredCredits credits={piCycleCredits}'],
  'app/(dashboard)/scanner/page.tsx': ['parseCredits(json.attributions)', '<RequiredCredits credits={credits}'],
  'components/analytics/technical/MultiTimeframeGrid.tsx': ['parseCredits(json.attributions)', '<RequiredCredits credits={credits}'],
  // The assistant's tools credit an answer from a response's own `attributions` (D101).
  'lib/agents/tools.ts': ['(body as { attributions?: unknown }).attributions', 'await get(`${base}&closes=1`)'],
  // Describes the parameter; fetches nothing, so shows nothing.
  'lib/data/dataSources.ts': [],
}

describe('every closes reader carries Coin Metrics’ credit on', () => {
  const askers = files.filter((f) => /closes=1|SWEEP_WANTS|source=(defillama|coinmetrics)/.test(code(f))).sort()

  it('names every file that asks for closing prices', () => {
    expect(askers).toEqual(Object.keys(CARRIES_CREDIT).sort())
  })

  it.each(Object.entries(CARRIES_CREDIT))('%s passes the response’s credits on', (file, needles) => {
    const src = code(file)
    for (const needle of needles) expect(src, needle).toContain(needle)
    if (file === 'lib/data/dataSources.ts') expect(src).not.toMatch(/\bfetch\(/)
  })

  it('the closing-prices notice shows the credits it is given', () => {
    expect(code('components/charts/ClosingPricesNotice.tsx')).toContain('<RequiredCredits credits={credits}')
  })

  it('every chart drawn from useCryptoChartSeries hands its credits to the notice', () => {
    const charts = files.filter((f) => f !== 'hooks/useCryptoChartSeries.ts' && /useCryptoChartSeries\(/.test(code(f)))
    expect(charts.length).toBeGreaterThan(0)
    for (const file of charts) {
      const src = code(file)
      expect(src, `${file} takes credits from the hook`).toMatch(/const \{[^}]*\bcredits\b[^}]*\} = useCryptoChartSeries\(/)
      // Up to the self-closing `/>`, not the first `>`: a prop can hold an arrow function.
      const notices = [...src.matchAll(/<ClosingPricesNotice\b[\s\S]*?\/>/g)].map((m) => m[0])
      expect(notices.length, `${file} notices`).toBeGreaterThan(0)
      for (const n of notices) expect(n, file).toContain('credits={credits}')
    }
  })

  it('the Coins screener shows the credits its cached sweep carries', () => {
    // Kept in the query result, not component state, so a sweep served from the cache
    // still shows them: a cache hit runs no callback.
    expect(code('hooks/useTechnicalSweep.ts')).toContain('return { rows, credits }')
    expect(files.filter((f) => f !== 'hooks/useTechnicalSweep.ts' && /useTechnicalSweep\(/.test(code(f))))
      .toEqual(['hooks/useAssets.ts'])
    expect(code('hooks/useAssets.ts')).toContain('credits: sweep.credits')
    expect(code('app/(dashboard)/assets/AssetRegistryClient.tsx')).toContain('<RequiredCredits credits={technicalSweep.credits}')
  })

  it('RequiredCredits links the licence a credit names', () => {
    expect(code('components/ui/RequiredCredits.tsx')).toMatch(/a\.license\?\.href[\s\S]*href=\{a\.license\.href\}/)
  })
})
