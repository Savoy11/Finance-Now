import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FUND_CATALOG, fundSalesCharge, getFund } from '../fundCatalog'
import { feeImpact, DEFAULT_FEE_IMPACT_PARAMS } from '../feeImpact'

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf-8')

/**
 * Guards for the side-by-side fund comparison (S6 / T-069). The arithmetic it
 * shows is already covered by feeImpact.test.ts; what needs pinning here is the
 * set of things the table must NOT do.
 */
describe('fund comparison — the catalog has no duration or credit field', () => {
  it('no bond fund carries a duration or credit-rating field', () => {
    // The comparison table states outright that neither exists and shows the
    // tracked index instead. If a real duration field is ever added, that note
    // becomes wrong and this test is the reminder to replace it with the figure.
    const bonds = FUND_CATALOG.filter((f) => f.category === 'bond')
    expect(bonds.length).toBeGreaterThan(5)
    for (const f of bonds) {
      const keys = Object.keys(f)
      expect(keys, `${f.symbol} gained a duration-like field`).not.toContain('durationYears')
      expect(keys, `${f.symbol} gained a credit field`).not.toContain('creditQuality')
      expect(keys).not.toContain('effectiveDuration')
      expect(keys).not.toContain('avgCreditRating')
    }
  })

  it('the comparison table derives no duration of its own', () => {
    // The failure mode: parsing "1-3 Year" out of an index name into a number
    // the reader can then rank on. Showing the string is honest; turning it into
    // a figure is fabrication on a page built for comparison.
    const src = read('components/markets/FundFactsSection.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/durationYears|effectiveDuration|parseDuration/)
    // No EXTRACTION from the index name. Targeted at parsing rather than at
    // mentioning a year range: the component's own copy quotes "1-3 Year" and
    // "20+ Year" as examples of what a benchmark name states, which is the
    // honest thing to say and must not trip its own guard. The component needs
    // no numeric parsing at all — every figure it shows is already a number —
    // so forbidding these outright is precise rather than approximate.
    expect(src).not.toMatch(/indexTracked\s*\.\s*(match|exec|replace|split|slice|substring)/)
    expect(src).not.toMatch(/\b(parseFloat|parseInt)\s*\(/)
    expect(src).not.toMatch(/Number\s*\(\s*f\./)
  })

  it('bond funds do state their maturity mandate in the tracked index', () => {
    // Which is why showing the string is useful rather than a cop-out.
    const named = FUND_CATALOG.filter(
      (f) => f.category === 'bond' && f.indexTracked && /year|month|bill/i.test(f.indexTracked),
    )
    expect(named.length).toBeGreaterThan(3)
  })
})

describe('fund comparison — an unverified load is flagged, never silently priced', () => {
  it('a fund whose load rate is unverified reports unverifiedLoad', () => {
    const withUnverified = FUND_CATALOG.filter((f) => {
      const c = fundSalesCharge(f)
      return c && c.maxPct == null
    })
    // AGTHX is the live example this rule exists for.
    expect(withUnverified.length).toBeGreaterThan(0)
    for (const f of withUnverified) {
      const impact = feeImpact(f, DEFAULT_FEE_IMPACT_PARAMS)!
      expect(impact.unverifiedLoad, `${f.symbol} should flag its unverified load`).toBe(true)
      expect(impact.includesLoad, `${f.symbol} must not price an unverified load`).toBe(false)
    }
  })

  it('the table renders that flag rather than only the number', () => {
    const src = read('components/markets/FundFactsSection.tsx')
    expect(src).toContain('impact.unverifiedLoad')
    expect(src).toContain('true cost is higher')
  })

  it('a no-load fund is neither flagged nor load-priced', () => {
    const voo = getFund('VOO')!
    expect(fundSalesCharge(voo)).toBeFalsy()
    const impact = feeImpact(voo, DEFAULT_FEE_IMPACT_PARAMS)!
    expect(impact.unverifiedLoad).toBe(false)
    expect(impact.includesLoad).toBe(false)
  })
})

describe('fund comparison — renders only when there is something to compare', () => {
  it('requires two or more catalogued funds', () => {
    const src = read('components/markets/FundFactsSection.tsx')
    expect(src).toMatch(/funds\.length < 2/)
    expect(src).toContain('return null')
  })

  it('uses the same fee engine and assumptions as the detail page', () => {
    // Two implementations of one dollar figure is how two surfaces drift apart;
    // #147 made that a test for the registry and the same applies here.
    const src = read('components/markets/FundFactsSection.tsx')
    expect(src).toContain("from '@/lib/data/feeImpact'")
    expect(src).toContain('DEFAULT_FEE_IMPACT_PARAMS')
    expect(src).not.toMatch(/computeFeeDrag\(/)
  })
})
