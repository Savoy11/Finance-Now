import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SOURCE_TERMS, summaryPermitted, type SourceTermsEntry } from '../sourceTerms'

/**
 * T-247. The 2026-09-14/20 publisher readings produced a state the item's original
 * model had no slot for: two sources grant NO display permission at all, kept
 * `conditional` on an owner scope judgement (LEGAL-REVIEW §7). The per-source
 * switch is `whatMayBeDisplayed`; `summaryPermitted()` is its one enforcement
 * point and the three news routes call it. So resolving a source toward
 * headline-and-link is a one-field change — which is what this file pins.
 */

const fixture = (over: Partial<SourceTermsEntry> = {}): SourceTermsEntry => ({
  domain: 'pub.example', name: 'Pub', verdict: 'conditional', termsUrl: 'https://pub.example/terms',
  finding: 'fixture', review: 'seeded', reviewedAt: '2026-01-01', confidence: 'low', ...over,
})
const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('summaryPermitted()', () => {
  it('is false only for headline-link', () => {
    const entries = [fixture({ whatMayBeDisplayed: 'headline-link' })]
    expect(summaryPermitted('https://pub.example/story', entries)).toBe(false)
    expect(summaryPermitted('https://news.pub.example/story', entries)).toBe(false) // subdomain
  })
  it('is true for headline-link-summary, unclear, an unset field, and an unregistered host', () => {
    for (const grant of ['headline-link-summary', 'unclear', undefined] as const) {
      expect(summaryPermitted('https://pub.example/x', [fixture({ whatMayBeDisplayed: grant })]), String(grant)).toBe(true)
    }
    expect(summaryPermitted('https://nowhere.example/x', [fixture({ whatMayBeDisplayed: 'headline-link' })])).toBe(true)
    expect(summaryPermitted('not a url', [fixture({ whatMayBeDisplayed: 'headline-link' })])).toBe(true)
  })
  it('the most specific entry wins, in either direction', () => {
    const broad = fixture({ domain: 'pub.example', whatMayBeDisplayed: 'headline-link' })
    const narrow = fixture({ domain: 'feeds.pub.example', whatMayBeDisplayed: 'headline-link-summary' })
    expect(summaryPermitted('https://feeds.pub.example/x', [broad, narrow])).toBe(true)
    expect(summaryPermitted('https://www.pub.example/x', [broad, narrow])).toBe(false)
  })
})

describe('the registry records what each read publisher grants', () => {
  const entry = (d: string) => SOURCE_TERMS.find((e) => e.domain === d)!
  it("every publisher whose conditions say 'feed summary' carries headline-link-summary", () => {
    const withSummaryCondition = SOURCE_TERMS.filter((e) => (e.conditions ?? []).some((c) => /headline, link and feed summary/i.test(c)))
    expect(withSummaryCondition.length).toBeGreaterThanOrEqual(6)
    for (const e of withSummaryCondition) expect(e.whatMayBeDisplayed, e.domain).toBe('headline-link-summary')
  })
  it('the two no-display-permission sources are recorded as unclear, not as a grant', () => {
    expect(entry('coindesk.com').whatMayBeDisplayed).toBe('unclear')
    expect(entry('investing.com').whatMayBeDisplayed).toBe('unclear')
  })
  it('no verified content source is silently headline-link today', () => {
    // If one ever is, that is a decision (T-407) and this test is updated with it.
    expect(SOURCE_TERMS.filter((e) => e.whatMayBeDisplayed === 'headline-link').map((e) => e.domain)).toEqual([])
  })
})

describe('the three news routes gate every summary on it', () => {
  for (const route of ['news', 'market-news', 'macro-news']) {
    it(`${route} imports summaryPermitted and uses it at every summary site`, () => {
      const s = src(`src/app/live-data/${route}/route.ts`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(s).toMatch(/import \{ summaryPermitted \} from '@\/lib\/server\/sourceTerms'/)
      // A summary SITE is where a summary is built from feed content — not the
      // response type's `summary: string`, and not CryptoPanic's `summary: title`
      // (a headline is not a summary; nothing to withhold). The whitespace lives INSIDE
      // the lookahead — outside it, `\s*` backtracks to zero and the exclusion never fires.
      const sites = s.match(/^\s*(?:const )?summary\s*[:=](?!\s*string\b)(?!\s*title\b)/gm) ?? []
      expect(sites.length, `${route}: summary sites`).toBeGreaterThanOrEqual(2)
      const gated = s.match(/summaryPermitted\(/g) ?? []
      expect(gated.length, `${route}: gated sites`).toBe(sites.length)
    })
  }
  it('guards the guard: an ungated summary site would be counted', () => {
    const s = "  summary: string\n  summary: title,\n  summary: item.summary.slice(0, 280),\n  summary: summaryPermitted(u) ? x : '',\n"
    expect((s.match(/^\s*(?:const )?summary\s*[:=](?!\s*string\b)(?!\s*title\b)/gm) ?? []).length).toBe(2)
    expect((s.match(/summaryPermitted\(/g) ?? []).length).toBe(1)
  })
})
