// APR selection for staking provider cards — pure so the "which number shows,
// and is it labelled live" decision is testable. A wrong `live` badge here is
// exactly the misattribution bug the own-key rule exists to prevent.

import type { GapReasonId } from '@/lib/data/dataGaps'
import {
  DEFAULT_LIVE_APR_KEY,
  type StakingProvider, type StakingCoinId,
} from '@/lib/data/stakingProviders'

export interface AprDisplay {
  apr: number
  live: boolean
  /**
   * Why this row is not a live reading. Undefined when `live` is true.
   *
   * The route answers this for keys it fetches (`gaps`), but it cannot answer it
   * for a provider that has no live key at all — that is a fact about our
   * catalog, not about any upstream — so the two cases are resolved together
   * here and the row gets one reason either way.
   */
  gap?: GapReasonId
}

export function aprDisplay(
  staticApr: number,
  liveKey: string | undefined,
  rates: Partial<Record<string, number>>,
  sources: Partial<Record<string, 'live' | 'estimate'>>,
  /** `gaps` from /live-data/staking-rates. Optional: absent means "unknown why". */
  gaps?: Partial<Record<string, GapReasonId>>,
): AprDisplay {
  // Only providers with their OWN live-rate key show a live number/badge.
  // The old coin-level default-key fallback displayed a different provider's
  // rate (e.g. Lido's stETH APR on a CeFi card) as if it were this provider's.
  //
  // No key is its own reason, and a common one: most CeFi desks publish a rate on
  // a marketing page and nowhere machine-readable, so the catalog carries a dated
  // figure by hand. That is not a failed fetch and must not read as one.
  if (!liveKey) return { apr: staticApr, live: false, gap: 'curated-estimate' }

  const live = rates[liveKey]
  if (live != null) {
    if (sources[liveKey] === 'live') return { apr: live, live: true }
    // A number arrived but is not a reading — it is the route's fallback. The
    // route says why; `upstream-failed` only where it did not, which is the
    // useful direction to be wrong in (it reports work rather than hiding a
    // regression behind a known limitation).
    return { apr: live, live: false, gap: gaps?.[liveKey] ?? 'upstream-failed' }
  }
  return { apr: staticApr, live: false, gap: gaps?.[liveKey] ?? 'upstream-failed' }
}

/**
 * Resolve which live-rate key an asset row should read.
 *   1. An explicit asset.liveAprKey always wins.
 *   2. Self-custody wallets do NATIVE delegation, so the live network base rate
 *      (DEFAULT_LIVE_APR_KEY) is an honest reading of what the position earns
 *      (minus a small validator commission). Scoped to non-ETH coins: wallet ETH
 *      staking routes through assorted providers, so we don't show one LST's rate
 *      for it. CeFi/liquid are deliberately excluded — their rates aren't the raw
 *      network rate, so they must opt in with an explicit key.
 */
export function resolveLiveAprKey(
  provider: StakingProvider,
  coinId: StakingCoinId,
  asset: StakingProvider['assets'][StakingCoinId],
): string | undefined {
  if (asset?.liveAprKey) return asset.liveAprKey
  if (provider.category === 'wallet' && coinId !== 'eth') return DEFAULT_LIVE_APR_KEY[coinId]
  return undefined
}
