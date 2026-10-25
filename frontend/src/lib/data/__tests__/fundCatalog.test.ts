import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  computeFeeDrag, fundSalesCharge, fundTradingRestriction, fundAssetsFact, fundYieldFact,
  getFundFeeProvenance, fundFeesAgeDays, fundFeesAreStale, FUND_FEES_LAST_VERIFIED, FUND_FEES_STALE_AFTER_DAYS,
  getFundFiguresProvenance, fundFiguresAgeDays, fundFiguresAreStale, FUND_FIGURES_COMPILED_ON, FUND_FIGURES_STALE_AFTER_DAYS,
  FUND_CATALOG, YIELD_KIND_NAMES, FUND_SITES_ALLOWED, fundShownYield, fundSiteAllowsFigures, siteDomain,
  YIELD_CHECK_AFTER_DAYS, YIELD_SHOWN_FOR_DAYS,
} from '../fundCatalog'

// W4-C9: computeFeeDrag drives a 30-year dollar projection on every fund detail
// page and had no tests. W4-C7: the expense ratios it runs on are hand-maintained
// and had no provenance machinery.

const FEES_VERIFIED = new Date(FUND_FEES_LAST_VERIFIED)
const FIGURES_COMPILED = new Date(FUND_FIGURES_COMPILED_ON)
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

describe('computeFeeDrag', () => {
  it('returns one point per year', () => {
    expect(computeFeeDrag(10_000, 0.5, 30)).toHaveLength(30)
    expect(computeFeeDrag(10_000, 0.5, 1)).toHaveLength(1)
  })

  it('returns nothing for a zero-year horizon', () => {
    expect(computeFeeDrag(10_000, 0.5, 0)).toEqual([])
  })

  it('compounds one year correctly against the benchmark', () => {
    // 10,000 × 1.07 × (1 − 0.01) = 10,593 with a 1% ER.
    // 10,000 × 1.07 × (1 − 0.0003) = 10,696.79 at the 0.03% benchmark.
    const [year1] = computeFeeDrag(10_000, 1, 1, 7, 0.03)
    expect(year1.year).toBe(1)
    expect(year1.withFee).toBe(10_593)
    expect(year1.withBenchmarkFee).toBe(10_697)
    expect(year1.feesPaid).toBe(104)
  })

  it('charges no drag when the fund matches the benchmark', () => {
    const series = computeFeeDrag(10_000, 0.03, 30, 7, 0.03)
    for (const p of series) {
      expect(p.feesPaid).toBe(0)
      expect(p.withFee).toBe(p.withBenchmarkFee)
    }
  })

  it('compounds the gap — drag grows faster than linearly', () => {
    const series = computeFeeDrag(10_000, 0.75, 30)
    const y10 = series[9].feesPaid
    const y20 = series[19].feesPaid
    const y30 = series[29].feesPaid
    expect(y20).toBeGreaterThan(y10 * 2)
    expect(y30).toBeGreaterThan(y20 * 1.5)
  })

  it('grows the balance monotonically at a positive return', () => {
    const series = computeFeeDrag(10_000, 0.5, 20, 7)
    for (let i = 1; i < series.length; i++) {
      expect(series[i].withFee).toBeGreaterThan(series[i - 1].withFee)
    }
  })

  it('still charges drag when the gross return is zero', () => {
    // The fee comes off the balance regardless of performance — a cheaper fund
    // simply loses less. Presenting no drag in a flat market would be wrong.
    const series = computeFeeDrag(10_000, 1, 10, 0)
    expect(series[9].withFee).toBeLessThan(10_000)
    expect(series[9].feesPaid).toBeGreaterThan(0)
  })

  it('handles a zero principal without producing NaN', () => {
    for (const p of computeFeeDrag(0, 0.5, 10)) {
      expect(p.withFee).toBe(0)
      expect(p.feesPaid).toBe(0)
    }
  })

  it('is defined for every fund in the catalog', () => {
    for (const fund of FUND_CATALOG) {
      const series = computeFeeDrag(10_000, fund.expenseRatioPct, 30)
      const final = series[series.length - 1]
      expect(Number.isFinite(final.withFee)).toBe(true)
      expect(Number.isFinite(final.feesPaid)).toBe(true)
    }
  })

  it('reports a negative drag for a fund cheaper than the benchmark', () => {
    // FXAIX is 0.015% against a 0.03% benchmark. The sign is correct and
    // meaningful — it is a saving — but the UI used to clamp the amount to zero
    // while keeping the minus sign, rendering "−$0 (−0.3%)". The Fee Drag card
    // now labels this case as a saving instead.
    const cheap = FUND_CATALOG.filter((f) => f.expenseRatioPct < 0.03)
    expect(cheap.length).toBeGreaterThan(0)
    for (const fund of cheap) {
      const series = computeFeeDrag(10_000, fund.expenseRatioPct, 30)
      expect(series[series.length - 1].feesPaid).toBeLessThan(0)
    }
  })
})

// D117 (2026-10-14): one date became two. The expense ratios are checked against filings
// and computed on; the assets and yields are approximate. Each clock must run off its own
// date, so each is tested against its own anchor.
describe.each([
  ['fees', FEES_VERIFIED, FUND_FEES_STALE_AFTER_DAYS, fundFeesAgeDays, fundFeesAreStale, getFundFeeProvenance],
  ['figures', FIGURES_COMPILED, FUND_FIGURES_STALE_AFTER_DAYS, fundFiguresAgeDays, fundFiguresAreStale, getFundFiguresProvenance],
] as const)('fund %s provenance', (_name, anchor, windowDays, ageDays, isStale, provenance) => {
  it('reports age from its own date', () => {
    expect(ageDays(anchor)).toBe(0)
    expect(ageDays(plusDays(anchor, 45))).toBe(45)
  })

  it('goes stale only past its window', () => {
    expect(isStale(plusDays(anchor, windowDays))).toBe(false)
    expect(isStale(plusDays(anchor, windowDays + 1))).toBe(true)
  })

  it('steps confidence down with age', () => {
    expect(provenance(plusDays(anchor, 10)).confidence).toBe('high')
    expect(provenance(plusDays(anchor, 60)).confidence).toBe('high')
    expect(provenance(plusDays(anchor, 61)).confidence).toBe('medium')
    expect(provenance(plusDays(anchor, windowDays)).confidence).toBe('medium')
    expect(provenance(plusDays(anchor, windowDays + 1)).confidence).toBe('low')
  })

  it('accepts an injectable now, so the notice is testable', () => {
    // The whole point of the pattern: no test may depend on the wall clock.
    expect(provenance(plusDays(anchor, 500)).stale).toBe(true)
    expect(provenance(anchor).stale).toBe(false)
    expect(provenance(plusDays(anchor, 30)).source).toMatch(/\S/)
  })
})

describe('the two fund dates say different things (D117)', () => {
  it('the fee date is a verification date', () => {
    expect(getFundFeeProvenance(plusDays(FEES_VERIFIED, 30))).toMatchObject({ verifiedAt: FUND_FEES_LAST_VERIFIED, ageDays: 30 })
  })

  it('the figures date is NOT called a verification date', () => {
    // Approximate figures under a "verified" label would be the fabricated freshness the
    // provenance rule exists to prevent.
    const p = getFundFiguresProvenance(plusDays(FIGURES_COMPILED, 30))
    expect(p).toMatchObject({ compiledOn: FUND_FIGURES_COMPILED_ON, ageDays: 30 })
    expect(p).not.toHaveProperty('verifiedAt')
  })
})

// D114/D115 (2026-10-14): asset figures read from SEC filings carry their period end and
// the filing's accession, so each can be re-checked.
describe('filed asset figures', () => {
  const filed = FUND_CATALOG.filter((f) => f.aumAsOf !== undefined)
  const ACCESSION = /^\d{10}-\d{2}-\d{6}$/

  it('every filed figure has a real date and an accession', () => {
    expect(filed.length).toBeGreaterThan(0)
    for (const f of filed) {
      expect(f.aumAsOf, f.symbol).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(f.aumAsOf!).getTime()), `${f.symbol} ${f.aumAsOf}`).toBe(false)
      expect(f.aumSource, `${f.symbol} has a date but no accession`).toMatch(ACCESSION)
    }
  })

  it('an accession never appears without its date', () => {
    for (const f of FUND_CATALOG.filter((x) => x.aumSource !== undefined)) {
      expect(f.aumAsOf, `${f.symbol} cites a filing but gives no date`).toBeDefined()
    }
  })

  it('a fair-value figure is always a filed one', () => {
    for (const f of FUND_CATALOG.filter((x) => x.aumBasis === 'holdings-fair-value')) {
      expect(f.aumAsOf, f.symbol).toBeDefined()
    }
  })

  it('every mutual fund carries the whole fund from its filing (D115)', () => {
    const mutual = FUND_CATALOG.filter((f) => f.type === 'mutual')
    expect(mutual.length).toBeGreaterThan(0)
    for (const f of mutual) expect(f.aumAsOf, `${f.symbol} has no filed whole-fund figure`).toBeDefined()
  })
})

describe('fundAssetsFact', () => {
  const usd = (n: number) => `$${n / 1e9}B`
  const base = { type: 'etf' as const, aumB: 2, aumAsOf: undefined, aumSource: undefined, aumBasis: undefined }

  it('marks an undated figure as approximate', () => {
    expect(fundAssetsFact(base, usd)).toMatchObject({ label: 'AUM', value: '≈ $2B' })
  })

  it('shows a filed figure with its date and names the filing', () => {
    const fact = fundAssetsFact({ ...base, aumAsOf: '2026-06-30', aumSource: '0000000000-26-000001' }, usd)
    expect(fact.value).toBe('$2B · 2026-06-30')
    expect(fact.explain).toContain('0000000000-26-000001')
  })

  it('labels a mutual fund as the whole fund', () => {
    const fact = fundAssetsFact({ ...base, type: 'mutual', aumAsOf: '2026-06-30', aumSource: '0000000000-26-000001' }, usd)
    expect(fact.label).toBe('Fund net assets (all share classes)')
  })

  it('never calls holdings at fair value net assets', () => {
    const fact = fundAssetsFact({ ...base, aumAsOf: '2026-06-30', aumSource: '0000000000-26-000001', aumBasis: 'holdings-fair-value' }, usd)
    expect(fact.label).toBe('Holdings at fair value')
    expect(fact.explain).toMatch(/not the same figure/)
  })
})

// T-440 (2026-10-21): figures read from the fund's own page carry the date and kind the page
// gave and the page's address, so each can be re-read; a 30-day SEC yield is never shown as a
// 12-month one.
describe('figures read from the fund’s own page', () => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  const host = (u: string) => new URL(u).hostname.replace(/^www\./, '').split('.').slice(-2).join('.')
  const read = FUND_CATALOG.filter((f) => f.yieldRead || f.aumRead)
  // The owner's rulings: D141 (four), D146 (vaneck.com), D151 (direxion.com), D165 (teucrium.com).
  const D141_ALLOWED = ['vanguard.com', 'ssga.com', 'sectorspdrs.com', 'proshares.com', 'vaneck.com', 'direxion.com', 'teucrium.com']

  it('every reading has a real date, a kind, and the issuer’s own page as its source', () => {
    expect(read.length).toBeGreaterThan(0)
    for (const f of read) {
      for (const r of [f.yieldRead, f.aumRead].filter((x) => x !== undefined)) {
        expect(r!.asOf, f.symbol).toMatch(ISO)
        expect(Number.isNaN(new Date(r!.asOf).getTime()), `${f.symbol} ${r!.asOf}`).toBe(false)
        expect(r!.asOf >= '2026-01-01', `${f.symbol} ${r!.asOf}`).toBe(true)
        expect(r!.source, f.symbol).toMatch(/^https:\/\//)
        // Only a site the owner ruled Allowed (D141) may be read by a script. A link may
        // redirect between them (sectorspdrs.com to ssga.com): the source is where the page was.
        expect(D141_ALLOWED, `${f.symbol} ${r!.source}`).toContain(host(r!.source))
      }
      if (f.yieldRead) {
        expect(Object.keys(YIELD_KIND_NAMES), f.symbol).toContain(f.yieldRead.kind)
        expect(f.yieldPct, `${f.symbol} dates a yield it does not have`).not.toBeNull()
      }
    }
  })

  it('never dates a filed asset figure a second way', () => {
    for (const f of FUND_CATALOG.filter((x) => x.aumRead)) expect(f.aumAsOf, f.symbol).toBeUndefined()
  })

  // An allowed site, so these test the labels; D166's rule has its own tests below.
  const ALLOWED = { website: 'https://investor.vanguard.com/x', issuer: 'Vanguard' }
  const NOW = new Date('2026-10-25')

  it('labels a SEC yield as one, dates a read yield, and shows none it has not read', () => {
    expect(fundYieldFact({ ...ALLOWED, yieldPct: 1.2 }, NOW)).toMatchObject({ label: 'Distribution Yield', value: 'See fund’s page', kind: 'trailing', asOf: null, shown: false })
    const sec = fundYieldFact({ ...ALLOWED, yieldPct: 5.11, yieldRead: { asOf: '2026-10-19', kind: 'sec', source: 'https://x.test' } }, NOW)
    expect(sec).toMatchObject({ label: '30-Day SEC Yield', short: 'SEC', value: '5.11% · 2026-10-19', kind: 'sec', shown: true })
    expect(sec.explain).toMatch(/not what the fund paid out over the past year/)
    expect(fundYieldFact({ ...ALLOWED, yieldPct: 3.66, yieldRead: { asOf: '2026-10-20', kind: 'trailing', source: 'https://x.test' } }, NOW).value).toBe('3.66% · 2026-10-20')
    expect(fundYieldFact({ ...ALLOWED, yieldPct: null }, NOW).value).toBe('—')
  })

  it('names an adjusted effective yield as one, never as a 12-month or SEC yield (D150)', () => {
    const eff = fundYieldFact({ ...ALLOWED, yieldPct: 2.89, yieldRead: { asOf: '2026-09-30', kind: 'effective', source: 'https://x.test' } }, NOW)
    expect(eff).toMatchObject({ label: 'Adjusted Effective Yield', short: 'Adj. eff.', words: 'Adjusted effective', value: '2.89% · 2026-09-30', kind: 'effective' })
    expect(eff.explain).toMatch(/adjusted effective yield, on 2026-09-30/)
    expect(eff.explain).toMatch(/neither what the fund paid out over the past year nor a 30-day SEC yield/)
    // No two kinds share a name, on any surface: a reader can always tell them apart.
    for (const part of ['label', 'short', 'words'] as const) {
      const names = Object.values(YIELD_KIND_NAMES).map((n) => n[part])
      expect(new Set(names).size, part).toBe(names.length)
    }
  })

  it('names a yield’s kind on every surface through YIELD_KIND_NAMES, never by testing for one kind', () => {
    // A surface written as `kind === 'sec' ? 'SEC' : …` showed a third kind as a 12-month yield.
    for (const file of ['../../../app/(dashboard)/funds/FundsClient.tsx', '../../../components/markets/FundFactsSection.tsx', '../../../app/(dashboard)/compare/page.tsx']) {
      const src = readFileSync(join(__dirname, file), 'utf8')
      expect(src, file).not.toMatch(/kind\s*===\s*'sec'/)
    }
  })

  it('shows a page-read asset figure with its date', () => {
    const fact = fundAssetsFact({ type: 'etf', aumB: 2, aumRead: { asOf: '2026-09-30', source: 'https://x.test' } }, (n) => `$${n / 1e9}B`)
    expect(fact).toMatchObject({ label: 'AUM', value: '$2B · 2026-09-30' })
    expect(fact.explain).toMatch(/fund’s own page/)
  })

  it('never shows a yield as TTM or bare outside fundYieldFact', () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    expect(read('src/components/markets/FundFactsSection.tsx')).not.toMatch(/Yield \(TTM\)/)
    expect(read('src/app/(dashboard)/funds/[symbol]/page.tsx')).not.toMatch(/label: 'Distribution Yield'/)
  })
})

// ─── D166: a link beside every yield, a yield only where the fund's site allows ──
// Owner, 2026-10-25: a link to the fund's own page beside every yield; a yield shown only for
// funds whose site allows it, saying it may have changed; and a quarterly check of every shown
// figure. A missed check withholds the figure rather than leaving an old one up.
const NOW_D166 = new Date('2026-10-25')

describe('which yields are shown (D166)', () => {
  const read = { asOf: '2026-09-30', kind: 'sec' as const, source: 'https://investor.vanguard.com/x' }
  const vanguard = { website: 'https://investor.vanguard.com/x', issuer: 'Vanguard', yieldPct: 1.0, yieldRead: read }
  const asOf = new Date('2026-09-30')

  it('lists exactly the sites the owner ruled Allowed', () => {
    expect([...FUND_SITES_ALLOWED].sort()).toEqual(['direxion.com', 'proshares.com', 'sectorspdrs.com', 'ssga.com', 'teucrium.com', 'vaneck.com', 'vanguard.com'])
    expect(siteDomain('https://www.ishares.com/us/products/1')).toBe('ishares.com')
    expect(siteDomain('https://investor.vanguard.com/x')).toBe('vanguard.com')
  })

  it('shows a dated reading from an allowed site, and says it may have changed', () => {
    expect(fundShownYield(vanguard, plusDays(asOf, 10))).toMatchObject({ shown: true, pct: 1.0, asOf: '2026-09-30', due: false })
    const fact = fundYieldFact(vanguard, plusDays(asOf, 10))
    expect(fact.explain).toMatch(/may have changed since/)
    expect(fact.link).toMatchObject({ href: vanguard.website, text: 'Current yield' })
  })

  it('never shows a yield from a site whose terms do not allow it, even with a reading', () => {
    const ishares = { ...vanguard, website: 'https://www.ishares.com/us/products/1', issuer: 'BlackRock' }
    expect(fundShownYield(ishares, plusDays(asOf, 1))).toMatchObject({ shown: false, reason: 'site-not-allowed' })
    const fact = fundYieldFact(ishares, plusDays(asOf, 1))
    expect(fact).toMatchObject({ shown: false, value: 'See fund’s page' })
    expect(fact.value).not.toMatch(/[0-9]/)
    expect(fact.explain).toMatch(/BlackRock’s page for this fund has its current yield/)
  })

  it('falls due a quarter after its date and is withheld a month later', () => {
    expect(fundShownYield(vanguard, plusDays(asOf, YIELD_CHECK_AFTER_DAYS))).toMatchObject({ shown: true, due: false })
    expect(fundShownYield(vanguard, plusDays(asOf, YIELD_CHECK_AFTER_DAYS + 1))).toMatchObject({ shown: true, due: true })
    expect(fundShownYield(vanguard, plusDays(asOf, YIELD_SHOWN_FOR_DAYS))).toMatchObject({ shown: true })
    expect(fundShownYield(vanguard, plusDays(asOf, YIELD_SHOWN_FOR_DAYS + 1))).toMatchObject({ shown: false, reason: 'too-old' })
    expect(YIELD_SHOWN_FOR_DAYS).toBeGreaterThan(YIELD_CHECK_AFTER_DAYS)
  })

  it('gives every catalog fund a link to its own page', () => {
    for (const f of FUND_CATALOG) {
      const { link } = fundYieldFact(f, NOW_D166)
      expect(link.href, f.symbol).toBe(f.website)
      expect(link.href, f.symbol).toMatch(/^https:[/][/]/)
    }
  })

  it('shows no catalog yield from a site outside the rulings', () => {
    let shown = 0
    for (const f of FUND_CATALOG) {
      if (!fundShownYield(f, NOW_D166).shown) continue
      shown++
      expect(fundSiteAllowsFigures(f), f.symbol).toBe(true)
    }
    expect(shown).toBeGreaterThan(0)
  })

  it('reads a fund yield nowhere but through the rule', () => {
    // Every file that names `yieldPct`, and why it may. A new surface reading a fund's yieldPct
    // directly would show a yield the rule withholds: route it through fundShownYield or
    // fundYieldFact, then add it here with its reason.
    const allowed: Record<string, string> = {
      'src/lib/data/fundCatalog.ts': 'defines the field and the rule',
      'src/app/live-data/fund-universe/route.ts': 'serves fundShownYield as yieldPct',
      'src/app/(dashboard)/funds/FundsClient.tsx': 'reads the route’s yieldPct, already the shown one',
      'src/components/markets/FundFactsSection.tsx': 'tells a negligible yield from one not shown',
      'src/app/(dashboard)/compare/page.tsx': 'tells a negligible yield from one not shown',
      'src/lib/agents/tools.ts': 'passes yieldPct only when fundYieldFact says it is shown',
      'src/components/markets/TaxEquivalentYieldCard.tsx': 'the yield in its box',
      'src/lib/data/portfolioUtils.ts': 'a local name for fundShownYield or an equity’s yield',
      // The Treasury curve's points carry their own, unrelated yieldPct.
      'src/lib/server/treasuryCurve.ts': 'Treasury curve',
      'src/lib/utils/parBondDuration.ts': 'Treasury curve',
      'src/lib/data/ratesFromCurve.ts': 'Treasury curve',
      'src/app/api/v1/openapi.json/route.ts': 'Treasury curve',
      'src/app/(dashboard)/macro/rates/[slug]/RatesDetailClient.tsx': 'Treasury curve',
      'src/app/(dashboard)/macro/rates/RatesClient.tsx': 'Treasury curve',
    }
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p)
      return /[.]tsx?$/.test(n) ? [p] : []
    })
    const root = process.cwd()
    const found = walk(join(root, 'src'))
      .filter((p) => readFileSync(p, 'utf8').includes('yieldPct'))
      .map((p) => relative(root, p).split(sep).join('/'))
    expect(found.length).toBeGreaterThan(5)
    for (const f of found) expect(Object.keys(allowed), `${f} reads yieldPct; route it through fundShownYield`).toContain(f)
  })
})

// ─── Sales charges (loads) ────────────────────────────────────────────────────
// A load is the largest single cost on a fund detail page and, until 2026-09-03,
// the Fee Drag Analyzer modelled only the expense ratio. AGTHX showed a cost of
// 0.59%/yr while a real Class A purchase loses several percent on day one.
describe('fundSalesCharge', () => {
  it('reports no charge for ETFs', () => {
    expect(fundSalesCharge({ type: 'etf', issuer: 'Vanguard' })).toBeNull()
    expect(fundSalesCharge({ type: 'etf', issuer: 'Capital Group' })).toBeNull()
  })

  it('reports no charge for no-load mutual fund families', () => {
    expect(fundSalesCharge({ type: 'mutual', issuer: 'Vanguard' })).toBeNull()
    expect(fundSalesCharge({ type: 'mutual', issuer: 'Fidelity' })).toBeNull()
  })

  it('reports a front load for Capital Group — the issuer string the catalog actually uses', () => {
    // The regression this guards: MUTUAL_FUND_POLICY keyed only on 'American
    // Funds' while AGTHX is filed under issuer 'Capital Group', so the app's
    // only mention of this load never rendered.
    expect(fundSalesCharge({ type: 'mutual', issuer: 'Capital Group' })).toEqual({ kind: 'front' })
  })

  it('reports the charge WITHOUT a rate when none has been verified', () => {
    // Undefined maxPct means "applies, amount unverified" — never "no charge".
    const c = fundSalesCharge({ type: 'mutual', issuer: 'Capital Group' })!
    expect(c.kind).toBe('front')
    expect(c.maxPct).toBeUndefined()
  })

  it('lets a fund-specific charge override the issuer default', () => {
    const c = fundSalesCharge({
      type: 'mutual',
      issuer: 'Capital Group',
      salesCharge: { kind: 'front', maxPct: 3.5, source: 'prospectus', verifiedAt: '2026-09-03' },
    })
    expect(c).toMatchObject({ kind: 'front', maxPct: 3.5 })
  })
})

describe('the AGTHX catalog entry', () => {
  it('is recognised as carrying a front-end load', () => {
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    expect(fundSalesCharge(agthx)).toMatchObject({ kind: 'front' })
  })

  it('mentions the load in its trading restriction text', () => {
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    expect(fundTradingRestriction(agthx)).toMatch(/sales load/i)
  })

  it('carries the VERIFIED front load, read from the filing on 2026-09-10', () => {
    // This test used to assert maxPct was UNDEFINED, guarding the
    // never-from-memory rule while the prospectus was unread. It has now been
    // read — not from memory, and not from a website: the rate comes from the
    // SEC's own Risk/Return Summary dataset for 2025q4, tag
    // MaximumSalesChargeImposedOnPurchasesOverOfferingPrice, on the 485BPOS
    // that Growth Fund of America files every October (CIK 44201, class
    // C000025064). `npm run fund-fees` with RR_QUARTER=2025q4 reproduces it.
    //
    // The rule it guarded is unchanged and still enforced catalog-wide by the
    // next test: a stated rate MUST carry source + verifiedAt.
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    expect(agthx.salesCharge?.maxPct).toBe(5.75)
    expect(agthx.salesCharge?.source).toMatch(/Risk.Return Summary/i)
    expect(agthx.salesCharge?.verifiedAt).toBe('2026-09-10')
  })

  it('now feeds the load into the projection, doubling the 10-year cost', () => {
    // The point of verifying it. An unverified load is disclosed in words and
    // EXCLUDED from the maths, so until today the Fee Drag Analyzer showed
    // AGTHX's cost as the expense ratio alone.
    //
    // Measured 2026-09-10 on $10k at 7% vs a 3bps benchmark:
    //   10y   $1,071 -> $2,137   (2.00x)
    //   30y  $11,700 -> $15,365  (1.31x)
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    const load = agthx.salesCharge!.maxPct!
    const cost = (years: number, l = 0) => {
      const pts = computeFeeDrag(10_000, agthx.expenseRatioPct, years, 7, 0.03, l)
      return pts[pts.length - 1].feesPaid
    }
    expect(cost(10, load) / cost(10)).toBeGreaterThan(1.9)
    expect(cost(10, load) / cost(10)).toBeLessThan(2.1)
  })

  it('shows a front load mattering MOST over a short horizon', () => {
    // The counter-intuitive half, and the reason the analyzer models the load
    // separately rather than folding it into an annual figure: a front load is
    // charged ONCE, so its share of total cost shrinks as expense-ratio
    // compounding takes over. It is worst for the investor who sells early —
    // the opposite of how an expense ratio behaves.
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    const load = agthx.salesCharge!.maxPct!
    const ratio = (years: number) => {
      const withL = computeFeeDrag(10_000, agthx.expenseRatioPct, years, 7, 0.03, load)
      const erOnly = computeFeeDrag(10_000, agthx.expenseRatioPct, years, 7, 0.03)
      return withL[withL.length - 1].feesPaid / erOnly[erOnly.length - 1].feesPaid
    }
    expect(ratio(10)).toBeGreaterThan(ratio(30))
  })
})

describe('computeFeeDrag with a front load', () => {
  it('defaults to no load, so every existing call is unchanged', () => {
    expect(computeFeeDrag(10_000, 0.5, 10, 7, 0.03)).toEqual(computeFeeDrag(10_000, 0.5, 10, 7, 0.03, 0))
  })

  it('takes the load off the top — only the remainder compounds', () => {
    // 5.75% of 10,000 = 575 deducted at purchase. Year 1 with a 0% return and a
    // 0% ER must therefore be 9,425, not 10,000.
    const [y1] = computeFeeDrag(10_000, 0, 1, 0, 0, 5.75)
    expect(y1.withFee).toBe(9_425)
  })

  it('does NOT charge the load to the benchmark', () => {
    // The benchmark is a no-load index fund. Charging it too would cancel out
    // the difference the comparison exists to show.
    const [y1] = computeFeeDrag(10_000, 0, 1, 0, 0, 5.75)
    expect(y1.withBenchmarkFee).toBe(10_000)
    expect(y1.feesPaid).toBe(575)
  })

  it('opens a gap that GROWS with the horizon, unlike a one-off charge', () => {
    const s = computeFeeDrag(10_000, 0, 30, 7, 0, 5.75)
    const y1 = s[0].feesPaid
    const y30 = s[29].feesPaid
    expect(y30).toBeGreaterThan(y1 * 5)
  })

  it('roughly DOUBLES the ten-year cost vs the expense ratio alone', () => {
    // The reason this was worth fixing, stated as the arithmetic actually
    // shows it: on £10,000 at 0.59% ER over 10 years, the ER costs ~£1,071 and
    // a 5.75% load takes the total to ~£2,137. An earlier draft of this test
    // asserted "more than double" and failed at 1.995× — the load nearly
    // doubles the cost, which is claim enough without rounding it upward.
    const erOnly = computeFeeDrag(10_000, 0.59, 10, 7, 0.03, 0).at(-1)!.feesPaid
    const withLoad = computeFeeDrag(10_000, 0.59, 10, 7, 0.03, 5.75).at(-1)!.feesPaid
    expect(withLoad / erOnly).toBeGreaterThan(1.9)
    expect(withLoad - erOnly).toBeGreaterThan(1_000)
  })

  it('ignores a negative load rather than crediting the investor', () => {
    const [y1] = computeFeeDrag(10_000, 0, 1, 0, 0, -5)
    expect(y1.withFee).toBe(10_000)
  })
})

describe('catalog-wide sales-charge provenance', () => {
  it('every stated rate carries a source and a verification date', () => {
    // The never-from-memory rule, enforced. A rate with no provenance is
    // indistinguishable from a guess.
    for (const f of FUND_CATALOG) {
      if (f.salesCharge?.maxPct != null) {
        expect(f.salesCharge.source, `${f.symbol} states a load with no source`).toBeTruthy()
        expect(f.salesCharge.verifiedAt, `${f.symbol} states a load with no verifiedAt`).toBeTruthy()
      }
    }
  })

  it('no ETF claims a sales charge', () => {
    for (const f of FUND_CATALOG) {
      if (f.type === 'etf') expect(f.salesCharge, `${f.symbol}`).toBeUndefined()
    }
  })
})

describe('fee basis: the total a holder pays, not the management fee (D35, D37)', () => {
  // A commodity pool's MANAGEMENT fee was recorded as its expense ratio three times
  // before anyone noticed the pattern: USO, UNG and CPER (corrected 2026-09-10), then
  // the four Teucrium funds at 1.00 against totals over three times that (read
  // 2026-09-26, corrected under D35). Each filing states the management fee as one
  // line of a larger total, so the check is simple: the catalog must hold MORE than it.
  const MANAGEMENT_FEE: Record<string, number> = {
    USO: 0.45, UNG: 0.6, CPER: 0.65, CORN: 1, WEAT: 1, SOYB: 1, CANE: 1,
  }
  const holdsOnlyTheManagementFee = (er: number, mgmt: number) => er <= mgmt
  const row = (symbol: string) => {
    const f = FUND_CATALOG.find((x) => x.symbol === symbol)
    if (!f) throw new Error(`${symbol} is missing from the catalog`)
    return f
  }

  it('each of these pools records its total, which is above its management fee', () => {
    for (const [symbol, mgmt] of Object.entries(MANAGEMENT_FEE)) {
      const er = row(symbol).expenseRatioPct
      expect(holdsOnlyTheManagementFee(er, mgmt), `${symbol} records ${er}, only its management fee`).toBe(false)
    }
  })

  it('guards the guard: the rows as they stood before D35 fail it', () => {
    expect(holdsOnlyTheManagementFee(1, MANAGEMENT_FEE.CORN)).toBe(true)
    expect(holdsOnlyTheManagementFee(0.6, MANAGEMENT_FEE.UNG)).toBe(true)
  })

  it('holds the realized 2025 totals D35 approved, and each description names the year', () => {
    // A realized ratio moves with fund size (CANE ran 3.21–4.42% over three years), so a
    // figure without its year reads as a standing rate it is not.
    const d35: Record<string, number> = { CORN: 3.45, WEAT: 3.18, SOYB: 3.34, CANE: 4.27 }
    for (const [symbol, er] of Object.entries(d35)) {
      expect(row(symbol).expenseRatioPct, symbol).toBe(er)
      expect(row(symbol).description, `${symbol} does not name the year of its ratio`).toMatch(/\b2025\b/)
    }
  })

  it('holds PSLV at its 2025 management expense ratio, naming the year (D37)', () => {
    expect(row('PSLV').expenseRatioPct).toBe(0.56)
    expect(row('PSLV').description).toMatch(/\b2025\b/)
  })
})

describe('one waiver rule: the fee paid today, with the full fee stated (D36)', () => {
  // Before D36 the catalog recorded waived fees two ways — IBIT at its contractual rate,
  // SIVR and the D27 rows at the waived one — so rows that computeFeeDrag compares sat on
  // different bases. The rule now: record what an investor pays today, and state the full
  // fee in the description so a lapsed waiver can be seen and re-checked.
  const GROSS = /net of a (?:contractual |fee )?waiver \((\d+(?:\.\d+)?)% gross/i
  const grossStated = (description: string) => {
    const m = description.match(GROSS)
    return m ? Number(m[1]) : null
  }

  it('every row that mentions a waiver states its gross figure and records less than it', () => {
    const waived = FUND_CATALOG.filter((f) => /waiver/i.test(f.description))
    expect(waived.map((f) => f.symbol)).toContain('SIVR')
    for (const f of waived) {
      const gross = grossStated(f.description)
      expect(gross, `${f.symbol} mentions a waiver without its "(X% gross)" figure`).not.toBeNull()
      expect(f.expenseRatioPct, `${f.symbol} records the gross, not the fee paid today`).toBeLessThan(gross!)
    }
  })

  it('guards the guard: a waiver named without its gross figure is caught', () => {
    expect(grossStated('Expense ratio is net of a fee waiver.')).toBeNull()
    expect(grossStated('Expense ratio is net of a contractual waiver (0.31% gross).')).toBe(0.31)
  })
})

describe('a description that quotes its own fee agrees with its row (2026-09-30)', () => {
  // A fee typed into a description is a second copy of the row's number, and nothing
  // re-reads it when the row changes. D38 moved VUG 0.04 → 0.03 and its description kept
  // saying "at 4 bps" until this check found it. (VTEB's "MUB's twin at the same fee" was
  // the relative version — 0.03 against 0.05 since the re-root — and was reworded rather
  // than guarded: a comparison names another row, which a pattern cannot resolve.)
  const BPS = /\b(\d+(?:\.\d+)?)\s*bps\b/i
  const quotedBps = (description: string) => {
    const m = description.match(BPS)
    return m ? Number(m[1]) : null
  }
  const agrees = (quoted: number, expenseRatioPct: number) =>
    Math.abs(quoted - expenseRatioPct * 100) < 1e-9

  it('every "N bps" in a description equals that fund’s expense ratio', () => {
    const quoting = FUND_CATALOG.filter((f) => quotedBps(f.description) !== null)
    expect(quoting.map((f) => f.symbol)).toContain('VUG')
    for (const f of quoting) {
      const q = quotedBps(f.description)!
      expect(agrees(q, f.expenseRatioPct), `${f.symbol} says ${q} bps but records ${f.expenseRatioPct}%`).toBe(true)
    }
  })

  it('guards the guard: VUG as it stood before this fix fails it', () => {
    expect(agrees(quotedBps('Large-cap growth at 4 bps; tech-heavy tilt.')!, 0.03)).toBe(false)
    expect(agrees(quotedBps('S&P 500 at 1.5 bps — among the cheapest funds anywhere.')!, 0.015)).toBe(true)
  })
})
