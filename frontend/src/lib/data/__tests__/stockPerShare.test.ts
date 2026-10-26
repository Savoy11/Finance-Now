import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { perShareFrom, stockFigures, stockFiguresLink, peText, yieldText } from '../stockPerShare'
import { fetchStockPerShare } from '@/lib/server/stockPerShare'

// D167 (owner, 2026-10-25): a stock's P/E and dividend yield are worked out from its SEC
// annual report, with a link to its SEC filings beside each. The fixtures below are the
// figures the SEC's bulk data gave on 2026-10-25 for the cases that shaped the two guards.

const f = (val: number, end: string) => ({ val, end })

describe('the per-share rules', () => {
  it('pairs a dividend with the earnings of the same fiscal year (Apple, FY to 2025-09-27)', () => {
    const ps = perShareFrom({ epsDiluted: f(7.46, '2025-09-27'), dpsDeclared: f(1.02, '2025-09-27') })
    expect(ps).toEqual({ eps: { val: 7.46, end: '2025-09-27', basis: 'diluted' }, dps: f(1.02, '2025-09-27'), dividend: 'paid', asOf: '2025-09-27', shares: null, shareChange: null })
    expect(stockFigures(ps, 255)).toMatchObject({ pe: 34.18, peState: 'shown', dividendYieldPct: 0.4, dividend: 'paid' })
  })

  it('takes a dividend paid where none is declared (Coca-Cola)', () => {
    expect(perShareFrom({ epsDiluted: f(3.04, '2025-12-31'), dpsPaid: f(2.04, '2025-12-31') }).dividend).toBe('paid')
  })

  it('reports no dividend when the last one is for an earlier year (Intel, suspended in 2024)', () => {
    const ps = perShareFrom({ epsDiluted: f(-0.06, '2025-12-27'), dpsDeclared: f(0.38, '2024-12-28') })
    expect(ps.dividend).toBe('none')
    const fig = stockFigures(ps, 20)
    expect(fig).toMatchObject({ pe: null, peState: 'loss', dividendYieldPct: null })
    expect(peText(fig).value).toBe('Loss')
    expect(yieldText(fig).value).toBe('None')
  })

  it('shows no dividend at all without an earnings year to check it against (Visa: one quarter’s $0.59)', () => {
    const ps = perShareFrom({ dpsDeclared: f(0.59, '2025-09-30'), dpsPaid: f(0.59, '2025-09-30') })
    expect(ps).toMatchObject({ eps: null, dps: null, dividend: 'unknown' })
    expect(yieldText(stockFigures(ps, 340)).value).toBe('—')
  })

  it('never calls a missing figure "none" for a company that may pay (Salesforce, Disney)', () => {
    expect(perShareFrom({ epsDiluted: f(7.8, '2026-01-31') }).dividend).toBe('unknown')
    // …but does for one the catalog records as paying none (Amazon).
    expect(perShareFrom({ epsDiluted: f(5.5, '2025-12-31') }, true).dividend).toBe('none')
  })

  it('prefers diluted earnings, and basic only where diluted is older or missing', () => {
    expect(perShareFrom({ epsDiluted: f(2, '2025-12-31'), epsBasic: f(2.1, '2025-12-31') }).eps?.basis).toBe('diluted')
    expect(perShareFrom({ epsDiluted: f(2, '2024-12-31'), epsBasic: f(2.1, '2025-12-31') }).eps).toMatchObject({ basis: 'basic', val: 2.1 })
  })

  it('needs a usable price, and refuses a multiple in the thousands', () => {
    const ps = perShareFrom({ epsDiluted: f(0.01, '2025-12-31'), dpsDeclared: f(1, '2025-12-31') })
    expect(stockFigures(ps, 500)).toMatchObject({ pe: null, peState: 'unknown' })
    expect(stockFigures(ps, null)).toMatchObject({ pe: null, dividendYieldPct: null })
    expect(stockFigures(null, 100)).toMatchObject({ peState: 'unknown', dividend: 'unknown' })
  })

  it('links the company’s annual reports on EDGAR', () => {
    const link = stockFiguresLink('BRK-B')
    expect(link.href).toMatch(/^https:\/\/www\.sec\.gov\/cgi-bin\/browse-edgar\?/)
    expect(link.href).toContain('CIK=BRK-B')
    expect(link.href).toContain('type=10-K')
  })

  it('dates what it shows', () => {
    const fig = stockFigures(perShareFrom({ epsDiluted: f(7.46, '2025-09-27'), dpsDeclared: f(1.02, '2025-09-27') }), 255)
    expect(peText(fig).explain).toContain('the fiscal year ended 2025-09-27')
    expect(yieldText(fig).explain).toContain('the fiscal year ended 2025-09-27')
  })
})

describe('reading the SEC data', () => {
  afterEach(() => vi.unstubAllGlobals())

  const frames: Record<string, Array<{ cik: number; val: number; end: string }>> = {
    'EarningsPerShareDiluted/CY2025': [{ cik: 320193, val: 7.46, end: '2025-09-27' }],
    'EarningsPerShareDiluted/CY2024': [{ cik: 320193, val: 6.08, end: '2024-09-28' }],
    'CommonStockDividendsPerShareDeclared/CY2025': [{ cik: 320193, val: 1.02, end: '2025-09-27' }],
    'CommonStockDividendsPerShareDeclared/CY2024': [{ cik: 320193, val: 0.98, end: '2024-09-28' }],
  }
  const stub = (up: boolean) => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!up) throw new Error('network down')
    if (url.includes('company_tickers')) return new Response(JSON.stringify({ 0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' } }))
    if (url.includes('/dei/EntityCommonStockSharesOutstanding/shares/CY2026Q3I')) {
      return new Response(JSON.stringify({ data: [{ cik: 320193, val: 14_594_180_000, end: '2026-07-17', accn: '0000320193-26-000020' }] }))
    }
    const m = url.match(/us-gaap\/([A-Za-z]+)\/USD-per-shares\/(CY\d{4})\.json/)
    const rows = m ? frames[`${m[1]}/${m[2]}`] : undefined
    return rows ? new Response(JSON.stringify({ data: rows })) : new Response('{}', { status: 404 })
  }))

  it('keeps each company’s latest year across the frames, by ticker', async () => {
    stub(true)
    const { bySymbol, reached } = await fetchStockPerShare(['aapl', 'ZZZZ'], new Set(), new Date('2026-10-25'))
    expect(reached).toBe(true)
    expect(bySymbol.get('AAPL')).toMatchObject({ dividend: 'paid', asOf: '2025-09-27', eps: { val: 7.46 } })
    // D170: the cover-page share count rides along, with its date and filing.
    expect(bySymbol.get('AAPL')?.shares).toEqual({ val: 14_594_180_000, end: '2026-07-17', accn: '0000320193-26-000020' })
    expect(bySymbol.get('ZZZZ')).toMatchObject({ eps: null, dividend: 'unknown' })
  })

  it('says when the SEC could not be reached, and leaves every figure unknown', async () => {
    stub(false)
    const { bySymbol, reached } = await fetchStockPerShare(['AAPL'])
    expect(reached).toBe(false)
    expect(bySymbol.get('AAPL')).toMatchObject({ eps: null, dividend: 'unknown' })
  })
})

describe('no page shows the catalog’s hand-typed P/E or yield (D167)', () => {
  it('reads peRatio and dividendYieldPct only where listed, with the reason', () => {
    // A new reader of either field on a stock would show a hand-typed 2026-07-07 figure:
    // route it through the stock-universe route or stockFigures, then list it here.
    const allowed: Record<string, string> = {
      'src/lib/data/equityCatalog.ts': 'defines the fields, kept as a record',
      'src/lib/data/stockPerShare.ts': 'names the rule',
      'src/app/live-data/stock-universe/route.ts': 'reads dividendYieldPct === null only to mark non-payers; serves no figure under these names since D170',
      'src/app/(dashboard)/equities/EquitiesClient.tsx': 'filters and sorts on stockFigures’ values against live quotes (D170)',
      'src/app/live-data/stock-outliers/route.ts': 'screens on stockFigures’ values against live quotes (D170)',
      'src/lib/agents/tools.ts': 'returns stockFigures’ values under these names; reads dividendYieldPct === null only to mark non-payers',
      'src/app/(dashboard)/compare/page.tsx': 'works stockFigures out against the latest close (D170)',
      'src/components/markets/FinancialRatios.tsx': 'reads dividendYieldPct === null only to mark a non-payer',
      'src/lib/data/portfolioUtils.ts': 'names its parameter; stock yields come from SEC dividends per share',
      // Unrelated fields of the same name.
      'src/lib/options/greeks.ts': 'the options calculator’s typed-in dividend yield',
      'src/app/(dashboard)/equities/options-calculator/page.tsx': 'the options calculator’s typed-in dividend yield',
    }
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p)
      return /[.]tsx?$/.test(n) ? [p] : []
    })
    const root = process.cwd()
    const found = walk(join(root, 'src'))
      .filter((p) => /\bpeRatio\b|\bdividendYieldPct\b/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p).split(sep).join('/'))
    expect(found.length).toBeGreaterThan(5)
    for (const file of found) expect(Object.keys(allowed), `${file} reads peRatio or dividendYieldPct`).toContain(file)
  })

  it('serves no catalog figure from the route', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/live-data/stock-universe/route.ts'), 'utf8')
    expect(src).not.toMatch(/peRatio:\s*e\.peRatio|dividendYieldPct:\s*e\.dividendYieldPct|curated\?\.peRatio|curated\?\.dividendYieldPct/)
    expect(src).not.toMatch(/lastAnnualDividend\s*\//)
  })
})
