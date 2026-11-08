import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_METHODS } from '../dataMethods'
import { LEGAL_PATHS } from '../links'
import { YIELD_KIND_NAMES, FUND_CATALOG, FUND_FEES_LAST_VERIFIED, YIELD_CHECK_AFTER_DAYS, YIELD_SHOWN_FOR_DAYS } from '@/lib/data/fundCatalog'
import { STAKING_PROVIDERS, STAKING_DATA_LAST_VERIFIED } from '@/lib/data/stakingProviders'
import { META_AS_OF, MONITORED_STABLECOINS, getStablecoinMetaProvenance } from '@/lib/data/stablecoinMeta'
import { BOND_PROFILE_MIN_PCT, MATURITY_BUCKETS } from '@/lib/utils/fundExposure'

// The page that tells readers how the figures are worked out (D163) is only worth having while
// it says what the code does. These hold the parts a later change could quietly falsify.
const section = (id: string) => {
  const s = DATA_METHODS.find((x) => x.id === id)
  if (!s) throw new Error(`no section ${id}`)
  return s
}
const text = (id: string) => [...section(id).paragraphs, ...(section(id).items ?? []).map((i) => `${i.term}: ${i.text}`)].join(' ')

describe('how our figures are worked out (D163)', () => {
  it('is a public page beside About & Legal', () => {
    const file = path.join(process.cwd(), 'src/app/(legal)', LEGAL_PATHS.dataMethods, 'page.tsx')
    expect(fs.existsSync(file), file).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toContain('DATA_METHODS')
  })

  it('gives every section its own anchor and a real date where it has one', () => {
    const ids = DATA_METHODS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of DATA_METHODS) {
      expect(s.paragraphs.length, s.id).toBeGreaterThan(0)
      if (s.decided) expect(Number.isNaN(Date.parse(s.decided)), s.id).toBe(false)
    }
  })

  it('names every kind of fund yield the catalog can hold, by the name the pages use', () => {
    const terms = (section('fund-yields').items ?? []).map((i) => i.term)
    expect(terms.sort()).toEqual(Object.values(YIELD_KIND_NAMES).map((n) => n.label).sort())
  })

  it('takes its counts and dates from the catalogs, never typed', () => {
    expect(text('staking-terms')).toContain(String(STAKING_PROVIDERS.filter((p) => !p.defunct).length))
    expect(text('staking-terms')).toContain(STAKING_DATA_LAST_VERIFIED)
    expect(text('fund-costs')).toContain(String(FUND_CATALOG.length))
    expect(text('fund-costs')).toContain(FUND_FEES_LAST_VERIFIED)
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/legal/dataMethods.ts'), 'utf8')
    expect(src).not.toMatch(/for \d+ providers|all \d+ funds/)
  })

  it('states how a fund’s countries, currencies and bond splits are worked out (T-455)', () => {
    const t = text('fund-countries')
    expect(t).toMatch(/where the issuer is based, not where a company sells/)
    expect(t).toMatch(/left out rather than guessed/)
    expect(t).toMatch(/Nothing is rescaled to 100%/)
    expect(t).toContain(`at least ${BOND_PROFILE_MIN_PCT}% of its net assets`)
    for (const b of MATURITY_BUCKETS) expect(t).toContain(b.label.toLowerCase())
    expect(t).toContain('US Treasury')
    expect(t).toMatch(/no credit ratings/)
    expect(t).toMatch(/held directly are left out/)
  })

  it('states how expected inflation is worked out (D202)', () => {
    const t = text('treasury-yields')
    expect(t).toMatch(/ordinary par yield minus the Treasury’s inflation-protected \(real\) par yield at the same maturity, both from the same day/)
    expect(t).toMatch(/not a forecast of ours/)
    expect(t).toMatch(/only what reads closing figures/)
  })

  it('states how a currency pair is worked out from the ECB’s euro rates (D203)', () => {
    const t = text('currency-pairs')
    expect(t).toMatch(/live quote where our quote source has one/)
    expect(t).toMatch(/second currency per euro divided by the first currency per euro/)
    expect(t).toMatch(/for information only/)
    expect(t).toMatch(/since the Bank’s previous working day/)
    expect(t).toMatch(/only what reads closing figures/)
  })

  it('states how the supply figures are worked out, and that a fall rings no alert (D204)', () => {
    expect(text('stablecoin-reserves')).toMatch(/no alert rings on a fall/)
    expect(text('coin-supply')).toMatch(/circulating supply divided by maximum supply/)
    expect(text('fund-assets')).toMatch(/fund net assets, all share classes/)
  })

  it('states how tracked-portfolio income is counted (D201)', () => {
    const t = text('tracked-gains-income')
    expect(t).toMatch(/first in, first out/)
    expect(t).toMatch(/no tax rule is applied/)
    expect(t).toMatch(/value on the day, as you enter it, and that value is also what they cost/)
    expect(t).toMatch(/shown apart from the gains/)
  })

  it('states the yield rule the fund pages follow (D166), with the windows they use', () => {
    const t = text('fund-yields')
    expect(t).toMatch(/link beside it to the fund’s own page/)
    expect(t).toMatch(/only where the fund’s own website allows/)
    expect(t).toMatch(/may have changed since/)
    expect(t).toContain(`${YIELD_CHECK_AFTER_DAYS} days`)
    expect(t).toContain(`${YIELD_SHOWN_FOR_DAYS} days`)
    expect(text('rechecks')).toMatch(/each quarter/)
  })

  it('states the stock P/E and yield rule (D167)', () => {
    const t = text('stock-pe-yield')
    expect(t).toMatch(/SEC annual report/)
    expect(t).toMatch(/same fiscal year/)
    expect(t).toMatch(/link beside each figure opens the company’s SEC filings/)
  })

  it('states where the stablecoin reserve figures come from (D190, D192)', () => {
    // #467 changed how these figures are worked out without this page, and several came
    // from news and tracker sites quoting the issuers' reports, while the re-check section
    // said "never from another site's copy". The owner chose to say so (D192).
    const t = text('stablecoin-reserves')
    expect(t).toContain(String(MONITORED_STABLECOINS.length))
    expect(t).toContain(META_AS_OF)
    expect(t).toMatch(/never by its ticker/)
    expect(t).toMatch(/quoting that report/)
    expect(t).toMatch(/“not disclosed”/)
    expect(t).toMatch(/alert bell checks frxUSD/)
    expect(text('rechecks')).not.toMatch(/never from another site/)
    expect(text('rechecks')).toMatch(/section above says so/)
    // The notice on the Reserve Monitor itself says the same.
    expect(getStablecoinMetaProvenance().source).toMatch(/news and stablecoin trackers/)
  })

  it('states the liquid lock-up rule the staking catalog follows (D162)', () => {
    // The catalog side is held by stakingProviders.test.ts; this holds the page to it.
    expect(text('staking-terms')).toMatch(/liquid staking[^.]*0 days/i)
    const liquid = STAKING_PROVIDERS.filter((p) => !p.defunct).flatMap((p) => Object.values(p.assets).filter((a) => a?.liquid))
    expect(liquid.every((a) => a!.lockupDays === 0)).toBe(true)
  })
})
