import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_METHODS } from '../dataMethods'
import { LEGAL_PATHS } from '../links'
import { YIELD_KIND_NAMES, FUND_CATALOG, FUND_FEES_LAST_VERIFIED, YIELD_CHECK_AFTER_DAYS, YIELD_SHOWN_FOR_DAYS } from '@/lib/data/fundCatalog'
import { STAKING_PROVIDERS, STAKING_DATA_LAST_VERIFIED } from '@/lib/data/stakingProviders'

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

  it('states the yield rule the fund pages follow (D166), with the windows they use', () => {
    const t = text('fund-yields')
    expect(t).toMatch(/link beside it to the fund’s own page/)
    expect(t).toMatch(/only where the fund’s own website allows/)
    expect(t).toMatch(/may have changed since/)
    expect(t).toContain(`${YIELD_CHECK_AFTER_DAYS} days`)
    expect(t).toContain(`${YIELD_SHOWN_FOR_DAYS} days`)
    expect(text('rechecks')).toMatch(/each quarter/)
  })

  it('states the liquid lock-up rule the staking catalog follows (D162)', () => {
    // The catalog side is held by stakingProviders.test.ts; this holds the page to it.
    expect(text('staking-terms')).toMatch(/liquid staking[^.]*0 days/i)
    const liquid = STAKING_PROVIDERS.filter((p) => !p.defunct).flatMap((p) => Object.values(p.assets).filter((a) => a?.liquid))
    expect(liquid.every((a) => a!.lockupDays === 0)).toBe(true)
  })
})
