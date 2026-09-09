import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveOutboundLink, forRanking, sponsoredProviders, affiliateCoverageByCategory,
} from '../affiliates'
import { STAKING_PROVIDERS, computeOverallRisk, type StakingProvider } from '../stakingProviders'

const root = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(root, p), 'utf-8')

const base = (over: Partial<StakingProvider> = {}): StakingProvider => ({
  id: 'test-provider', name: 'Test', category: 'cefi', tagline: '', description: '',
  custodyModel: 'custodial', website: 'https://example.test',
  risks: {
    custodyRisk: 5, counterpartyRisk: 5, contractRisk: 5,
    slashingRisk: 5, liquidityRisk: 5, regulatoryRisk: 5,
  },
  assets: {},
  ...over,
})

describe('resolveOutboundLink', () => {
  it('uses the honest URL when no referral link is configured', () => {
    const l = resolveOutboundLink(base())!
    expect(l.href).toBe('https://example.test')
    expect(l.sponsored).toBe(false)
  })

  it('uses the referral link when one exists, and keeps the honest URL alongside it', () => {
    // The ROADMAP rule: never overwrite `website`, so a non-affiliate path
    // always exists and links stay auditable.
    const l = resolveOutboundLink(base({
      affiliateUrl: 'https://example.test/?ref=fn', affiliateProgram: 'Example Partners',
    }))!
    expect(l.href).toBe('https://example.test/?ref=fn')
    expect(l.sponsored).toBe(true)
    expect(l.program).toBe('Example Partners')
    expect(l.honestUrl).toBe('https://example.test')
  })

  it('never monetises a defunct provider', () => {
    // Celsius is in the catalog as the cautionary example. Earning a commission
    // on a route to a platform that froze customer funds is the single most
    // obvious way this feature could do harm, so it is refused at the resolver
    // rather than left to each call site to remember.
    expect(resolveOutboundLink(base({
      defunct: true, affiliateUrl: 'https://example.test/?ref=fn',
    }))).toBeNull()
    expect(resolveOutboundLink(base({ defunct: true }))).toBeNull()
  })

  it('returns null rather than a dead link when there is nowhere to send the reader', () => {
    expect(resolveOutboundLink(base({ website: undefined }))).toBeNull()
  })
})

describe('the catalog ships with no live affiliate link', () => {
  it('no provider has an affiliateUrl set', () => {
    // The plumbing lands before any program is joined. If this ever fails, a
    // real referral URL has been added — which is fine, but it means the
    // disclosure copy on /how-we-make-money is no longer describing a
    // hypothetical and the owner-copy placeholders must be filled in first.
    const withUrls = STAKING_PROVIDERS.filter((p) => p.affiliateUrl)
    expect(
      withUrls.map((p) => p.id),
      'an affiliate URL was added — fill in the owner copy on /how-we-make-money before shipping it',
    ).toEqual([])
  })

  it('reports zero coverage, so the disclosure describes reality', () => {
    expect(sponsoredProviders(STAKING_PROVIDERS)).toHaveLength(0)
    expect(affiliateCoverageByCategory(STAKING_PROVIDERS).every((c) => c.sponsored === 0)).toBe(true)
    expect(affiliateCoverageByCategory(STAKING_PROVIDERS).reduce((n, c) => n + c.total, 0)).toBeGreaterThan(40)
  })
})

describe('integrity rule — affiliate status cannot reach scoring or ranking', () => {
  it('the risk composite takes six numbers, not a provider', () => {
    // The structural guarantee: there is no provider object in scope for the
    // scoring function, so there is no affiliate field it could read. Pinned
    // here so a future refactor cannot quietly widen the signature to take a
    // whole provider "for convenience".
    const risks = base().risks
    const score = computeOverallRisk(risks)
    expect(typeof score).toBe('number')
    expect(computeOverallRisk.length).toBe(1)

    const paid = base({ affiliateUrl: 'https://example.test/?ref=fn' })
    const unpaid = base()
    expect(computeOverallRisk(paid.risks)).toBe(computeOverallRisk(unpaid.risks))
  })

  it('scoreStakingProvider also takes only a RiskProfile', () => {
    const src = read('lib/risk/profiles/stakingAdapter.ts')
    expect(src).toMatch(/export function scoreStakingProvider\(\s*risks: RiskProfile/)
    expect(src).not.toContain('affiliate')
  })

  it('forRanking hands back the same object, narrowed — no copy to drift', () => {
    const p = base({ affiliateUrl: 'https://example.test/?ref=fn' })
    expect(forRanking(p)).toBe(p)
  })

  it('no scoring, sorting or filtering path mentions an affiliate field', () => {
    // The backstop for code that legitimately takes a whole provider. If a
    // comparator ever reads affiliate status, this fails before review does.
    const rankingPaths = [
      'lib/data/stakingProviders.ts',
      'lib/risk/profiles/stakingAdapter.ts',
      'lib/risk/engine.ts',
      'app/api/v1/staking/opportunities/route.ts',
      'app/live-data/staking-discovery/route.ts',
    ]
    for (const file of rankingPaths) {
      const src = read(file)
        // Strip comments: stakingProviders.ts documents the fields at their
        // declaration, which is exactly where a reader should find them.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const declaration = file.endsWith('stakingProviders.ts')
      if (declaration) {
        // Declaring the optional fields is expected; USING them here is not.
        expect(src, `${file} reads an affiliate field`).not.toMatch(/\.affiliateUrl|\.affiliateProgram/)
      } else {
        expect(src, `${file} mentions an affiliate field`).not.toMatch(/affiliateUrl|affiliateProgram/)
      }
    }
  })
})

describe('integrity rule — disclosure cannot be forgotten', () => {
  it('the staking page links out only through SponsoredLink', () => {
    const src = read('app/(dashboard)/staking/page.tsx')
    expect(src).toContain('SponsoredLink')
    // A bare anchor to a provider URL would bypass both the rel attribute and
    // the visible tag. The page may still contain internal links, so this
    // targets the provider fields specifically.
    expect(src).not.toMatch(/href=\{provider\.website\}/)
    expect(src).not.toMatch(/href=\{provider\.affiliateUrl\}/)
  })

  it('SponsoredLink marks a paid link rel="sponsored" and an unpaid one not', () => {
    const src = read('components/ui/SponsoredLink.tsx')
    expect(src).toContain("'sponsored noopener noreferrer'")
    expect(src).toContain("'noopener noreferrer'")
    // Every link gets noopener; only paid links get sponsored, or the signal
    // means nothing.
    expect(src).toMatch(/link\.sponsored \? 'sponsored noopener noreferrer' : 'noopener noreferrer'/)
  })

  it('a paid link renders a visible tag, not a footer note', () => {
    const src = read('components/ui/SponsoredLink.tsx')
    expect(src).toMatch(/link\.sponsored && !suppressTag && <SponsoredTag/)
    expect(src).toContain('Paid link')
  })

  it('the staking page carries the not-advice framing above the grid', () => {
    const src = read('app/(dashboard)/staking/page.tsx')
    expect(src).toContain('This is information, not advice')
    // Above the provider grid, not below it (T-126).
    expect(src.indexOf('<AffiliateDisclosure />')).toBeLessThan(src.indexOf('<NetworkAprReference />'))
  })
})

describe('integrity rule — click counting carries no user identity', () => {
  it('the counter stores a provider id and a number, and nothing else', () => {
    // Comments are stripped first: the module's own docstring lists exactly
    // these identifiers while explaining that none of them are stored, and a
    // scan that cannot tell the promise from the breach is not a guard. The
    // guarantee is about the code, so the code is what gets scanned.
    const src = read('lib/server/affiliateClicks.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const forbidden of ['userId', 'sessionId', 'ipAddress', 'req.ip', 'cookie', 'userAgent', 'user-agent']) {
      expect(src.toLowerCase(), `affiliateClicks.ts references ${forbidden}`)
        .not.toContain(forbidden.toLowerCase())
    }
  })

  it('the route never reads a header or cookie off the request', () => {
    const src = read('app/api/affiliate/clicks/route.ts')
    expect(src).not.toMatch(/req\.headers/)
    expect(src).not.toMatch(/req\.cookies/)
    expect(src).not.toMatch(/\bheaders\(\)/)
  })

  it('the route only counts ids that exist in the catalog', () => {
    const src = read('app/api/affiliate/clicks/route.ts')
    expect(src).toContain('isKnownProvider')
    expect(src).toContain('STAKING_PROVIDERS.some')
  })
})
