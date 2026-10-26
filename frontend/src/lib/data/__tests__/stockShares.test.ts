import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { marketCapText, marketCapUsd, outsideShareBand, recentInstantFrames, shareCountChange, sharesHistory } from '../stockShares'
import { perShareFrom, stockFigures, peText, yieldText } from '../stockPerShare'

// D170 (2026-10-25). Fixtures are the SEC cover figures as they read that day.

const c = (val: number, end: string, accn = 'a') => ({ val, end, accn })
const honeywell = [c(634_887_208, '2025-09-30'), c(635_675_701, '2026-01-23'), c(633_653_119, '2026-03-31'), c(316_940_010, '2026-06-30'), c(317_358_518, '2026-09-30')]
const booking = [c(32_233_815, '2025-10-20'), c(31_673_346, '2026-02-10'), c(774_878_436, '2026-04-20'), c(751_380_500, '2026-07-27')]
const apple = [c(14_840_390_000, '2026-01-16'), c(14_594_180_000, '2026-07-17')]
const f = (val: number, end: string) => ({ val, end })

describe('recentInstantFrames', () => {
  it('lists the current quarter and the nine before, across a year boundary', () => {
    const p = recentInstantFrames(new Date('2026-10-25'))
    expect(p).toHaveLength(10)
    expect(p.slice(0, 5)).toEqual(['CY2026Q4I', 'CY2026Q3I', 'CY2026Q2I', 'CY2026Q1I', 'CY2025Q4I'])
    expect(p[9]).toBe('CY2024Q3I')
  })
})

describe('sharesHistory', () => {
  it('sorts oldest first, drops unusable rows, and keeps the later filing for a date', () => {
    const h = sharesHistory([c(2, '2026-06-30', '0001'), c(1, '2026-01-01'), c(0, '2026-02-01'), c(3, '2026-06-30', '0002'), c(5, 'bad')])
    expect(h.map((x) => x.val)).toEqual([1, 3])
  })
})

describe('shareCountChange', () => {
  it('finds a reverse split (Honeywell, 1-for-2) and a split (Booking, 25-for-1) since FY2025', () => {
    expect(outsideShareBand(shareCountChange(honeywell, '2025-12-31'))).toBe(true)
    expect(shareCountChange(booking, '2025-12-31')).toBeCloseTo(23.72, 2)
    expect(outsideShareBand(shareCountChange(booking, '2025-12-31'))).toBe(true)
  })

  it('leaves buybacks inside the band (Apple)', () => {
    const r = shareCountChange(apple, '2025-09-27')
    expect(r).toBeCloseTo(0.983, 3)
    expect(outsideShareBand(r)).toBe(false)
  })

  it('withholds nothing without a cover after the fiscal year to compare with', () => {
    expect(shareCountChange(apple, '2026-09-26')).toBeNull()
    expect(outsideShareBand(null)).toBe(false)
  })
})

describe('market cap', () => {
  it('is the latest cover count × the live price, and nothing without either', () => {
    expect(marketCapUsd(apple[1], 262)).toBeCloseTo(3.8237e12, -9)
    expect(marketCapUsd(apple[1], null)).toBeNull()
    expect(marketCapUsd(null, 262)).toBeNull()
    expect(marketCapText(apple[1], 262).value).toBe('$3.82T')
    expect(marketCapText(apple[1], 262).explain).toContain('as of 2026-07-17')
    expect(marketCapText(apple[1], null)).toMatchObject({ value: '—' })
    expect(marketCapText(null, 262).explain).toContain('more than one class')
  })
})

describe('per-share figures after a split (D170)', () => {
  it('withholds Booking’s P/E and yield rather than setting old-share earnings over a new-share price', () => {
    const ps = perShareFrom({ epsDiluted: f(165.57, '2025-12-31'), dpsDeclared: f(38.4, '2025-12-31') }, false, booking)
    const fig = stockFigures(ps, 226)
    expect(fig).toMatchObject({ pe: null, peState: 'split', dividendYieldPct: null })
    expect(peText(fig).explain).toContain('split')
    expect(yieldText(fig).explain).toContain('split')
    expect(ps.shares?.val).toBe(751_380_500)
  })

  it('still works the figures out where the count only drifted', () => {
    const ps = perShareFrom({ epsDiluted: f(7.46, '2025-09-27'), dpsDeclared: f(1.02, '2025-09-27') }, false, apple)
    expect(stockFigures(ps, 255)).toMatchObject({ peState: 'shown', pe: 34.18 })
  })

  it('says a missing P/E is for want of a live price, not of an earnings figure', () => {
    const fig = stockFigures(perShareFrom({ epsDiluted: f(7.46, '2025-09-27'), dpsDeclared: f(1.02, '2025-09-27') }), null)
    expect(peText(fig).explain).toContain('No live price')
    expect(yieldText(fig).explain).toContain('No live price')
  })
})

describe('no page uses the catalog’s hand-typed price, market cap or beta (D170)', () => {
  // A new reader of one of these on a stock would show a 2026-07-07 figure: Netflix's
  // pre-split $1,100 gave the outlier scan a P/E of 435. Work it out against a live quote
  // (stockFigures, marketCapUsd) or from prices (stockBeta), or list the file here with why.
  const allowed: Record<string, Record<string, string>> = {
    marketCapB: {
      'src/lib/data/equityCatalog.ts': 'defines the field, kept as a record',
      'src/lib/risk/ratingInputs.ts': 'the hidden ratings (T-420): methodology v1 names the catalog figure, and changing it is a methodology revision for counsel (D4)',
    },
    referencePrice: {
      'src/lib/data/equityCatalog.ts': 'defines the field, kept as a record',
      'src/lib/data/fundCatalog.ts': 'a fund’s own reference price, still shown tagged “ref”',
      'src/lib/api/live/marketData.ts': 'reference quote rows for funds only',
      'src/app/live-data/fund-universe/route.ts': 'funds',
      'src/app/(dashboard)/funds/FundsClient.tsx': 'funds',
      'src/app/(dashboard)/funds/[symbol]/page.tsx': 'funds',
    },
    '.beta': {
      'src/app/(dashboard)/compare/page.tsx': 'the beta Compare works out (betaVsBenchmark)',
      'src/components/markets/StockBetaCard.tsx': 'the beta worked out from prices (stockBetaFrom)',
      'src/lib/risk/profiles/equity.ts': 'a scoring input no caller passes (ratings switched off, D64)',
      'src/lib/data/instruments.ts': 'risk tiers, switched off (D64); its comment says to rebuild on stockBeta first',
    },
  }
  const patterns: Record<string, RegExp> = { marketCapB: /\bmarketCapB\b/, referencePrice: /\breferencePrice\b/, '.beta': /\.beta\b/ }
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p)
    return /[.]tsx?$/.test(n) ? [p] : []
  })
  const root = process.cwd()
  const files = walk(join(root, 'src')).map((p) => ({ rel: relative(root, p).split(sep).join('/'), src: readFileSync(p, 'utf8') }))

  for (const [field, re] of Object.entries(patterns)) {
    it(`reads ${field} only where listed, with the reason`, () => {
      const found = files.filter((f) => re.test(f.src)).map((f) => f.rel)
      expect(found.length).toBeGreaterThan(0)
      for (const file of found) expect(Object.keys(allowed[field]), `${file} reads ${field}`).toContain(file)
    })
  }

  it('gives a stock no reference quote', () => {
    const src = files.find((f) => f.rel === 'src/lib/api/live/marketData.ts')!.src
    expect(src).not.toMatch(/getEquity\([^)]*\)\?\.referencePrice/)
  })
})
