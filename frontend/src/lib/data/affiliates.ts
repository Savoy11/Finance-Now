import type { StakingProvider } from './stakingProviders'

/**
 * Affiliate-link resolution, and the structural guarantee that paid status
 * cannot reach the risk engine.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 *
 * Finance Now scores the providers it would be paid by: `computeOverallRisk()`
 * rates 55 staking providers across six risk dimensions. That is a real
 * conflict of interest, and the product's value dies if the scores follow the
 * money. The ROADMAP's integrity rules therefore require enforcement that is
 * STRUCTURAL rather than a promise, and this file is where that lives.
 *
 * ── How the guarantee is actually made ────────────────────────────────────
 *
 * Three layers, because a single one of them is only a convention:
 *
 * 1. **The scoring functions never see a provider.** `computeOverallRisk()` and
 *    `scoreStakingProvider()` both take a bare `RiskProfile` — six numbers —
 *    not a `StakingProvider`. There is no field for them to read. That was
 *    already true and is now pinned by a test so a future refactor cannot
 *    quietly widen the signature.
 * 2. **Ranking code takes {@link RankableProvider}**, a type that OMITS the
 *    affiliate fields. Anything that sorts, filters or ranks providers accepts
 *    that type, so reading `affiliateUrl` inside a comparator is a compile
 *    error rather than a review catch.
 * 3. **A source-scan test** asserts no sort/filter/score path mentions an
 *    affiliate identifier — the backstop for code that takes the full provider
 *    for other reasons.
 */

/**
 * A provider with the affiliate fields removed at the type level.
 *
 * Ranking, sorting, filtering and scoring code should take this, not
 * `StakingProvider`. Passing a full provider where this is expected is fine —
 * the extra fields are simply unreadable through it, which is the point.
 */
export type RankableProvider = Omit<StakingProvider, 'affiliateUrl' | 'affiliateProgram'>

/**
 * Narrow a provider to the fields ranking code is allowed to see.
 *
 * The returned object is the SAME reference — this is a type-level narrowing,
 * not a copy, so it costs nothing and cannot drift from the original.
 */
export function forRanking(provider: StakingProvider): RankableProvider {
  return provider
}

export interface OutboundLink {
  /** Where the link actually goes. */
  href: string
  /** True when `href` is a referral URL and must be disclosed. */
  sponsored: boolean
  /** Program name, for the "How we make money" page. Only set when sponsored. */
  program?: string
  /**
   * The provider's own URL, always. Equal to `href` when not sponsored.
   * Surfaced so a UI can offer the unmonetised path beside the paid one.
   */
  honestUrl?: string
}

/**
 * Resolve the outbound link for a provider.
 *
 * Returns `null` when there is nowhere to send the reader — callers render
 * nothing rather than a dead link.
 *
 * **A defunct provider never gets an affiliate link**, even if one is
 * configured. Celsius is in this catalog as the cautionary example; monetising
 * a route to a failed platform is the single most obvious way this feature
 * could do harm, so it is refused here rather than left to each call site.
 */
export function resolveOutboundLink(provider: StakingProvider): OutboundLink | null {
  const honest = provider.website
  if (provider.defunct) {
    // No outbound link at all for a defunct provider — the page already
    // suppresses it, and this makes that structural rather than incidental.
    return null
  }
  if (provider.affiliateUrl) {
    return {
      href: provider.affiliateUrl,
      sponsored: true,
      program: provider.affiliateProgram,
      honestUrl: honest,
    }
  }
  if (!honest) return null
  return { href: honest, sponsored: false, honestUrl: honest }
}

/** Providers with a referral link configured — the coverage-bias disclosure reads this. */
export function sponsoredProviders(providers: StakingProvider[]): StakingProvider[] {
  return providers.filter((p) => !p.defunct && !!p.affiliateUrl)
}

/**
 * Coverage bias, measured rather than asserted.
 *
 * The ROADMAP requires that coverage bias be DISCLOSED, and the reason is
 * concrete: exchanges run referral programs while liquid-staking protocols
 * largely do not, so paid links cluster in CeFi. Stating that in prose would go
 * stale the moment the mix changes; this computes it from the catalog so the
 * disclosure is always describing the real distribution.
 */
export function affiliateCoverageByCategory(
  providers: StakingProvider[],
): { category: StakingProvider['category']; total: number; sponsored: number }[] {
  const cats: StakingProvider['category'][] = ['cefi', 'wallet', 'liquid']
  return cats.map((category) => {
    const inCat = providers.filter((p) => !p.defunct && p.category === category)
    return {
      category,
      total: inCat.length,
      sponsored: inCat.filter((p) => !!p.affiliateUrl).length,
    }
  })
}
