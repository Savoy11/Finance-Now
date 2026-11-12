// APR selection for staking provider cards — pure so the "which number shows,
// and is it labelled live" decision is testable. A wrong `live` badge here is
// exactly the misattribution bug the own-key rule exists to prevent.

import type { GapReasonId } from '@/lib/data/dataGaps'
import {
  DEFAULT_LIVE_APR_KEY,
  type StakingProvider, type StakingCoinId,
} from '@/lib/data/stakingProviders'

export interface AprDisplay {
  /**
   * `null` means show no number at all — not zero, and not the catalog's own
   * estimate. Only `estimate-expired` produces it: the stored reading is older
   * than the window it stays meaningful for, so withholding it is the point.
   * Falling back to `staticApr` there would defeat the expiry, because that
   * value is the *less* dated of the two.
   */
  apr: number | null
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
  if (live != null && sources[liveKey] === 'live') return { apr: live, live: true }

  // AFTER the live check, deliberately. The route cannot set both today — it
  // skips `gaps` for live keys — but an expiry that could swallow a live reading
  // would be worse than the staleness it prevents, and that guarantee should not
  // rest on another file's control flow.
  //
  // Checked before `rates` is read for a value, though, because the route
  // WITHHOLDS the number it is talking about: there is nothing in `rates` to
  // notice, and the reason is the only evidence a value was deliberately not
  // served. Falling through would reach `staticApr` — the less dated of the two
  // — which defeats the expiry while looking like a graceful degrade.
  if (gaps?.[liveKey] === 'estimate-expired') {
    return { apr: null, live: false, gap: 'estimate-expired' }
  }

  // A number arrived but is not a reading — it is the route's fallback. The
  // route says why; `upstream-failed` only where it did not, which is the
  // useful direction to be wrong in (it reports work rather than hiding a
  // regression behind a known limitation).
  if (live != null) return { apr: live, live: false, gap: gaps?.[liveKey] ?? 'upstream-failed' }
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

// ─── Where a shown rate came from, and how old it is (T-465, D224) ──────────
//
// A rate that is not live is one of four things, and they are dated differently:
//   - worked out from a live reading this request (an exchange's ETH rate off Lido's): today's;
//   - the collector's backup table's own figure: dated by when it was measured, and some
//     never were (D224: they stay, each said to have no measured date);
//   - withheld, because its measurement is too old to show;
//   - the staking catalog's figure (`staticApr`), for a row with no live key or a key the
//     collector has no figure for: dated by the catalog's compile date.
// Until T-465 the page dated every one of them by the catalog's compile date.

export type AprBasis =
  | { kind: 'live' }
  | { kind: 'derived' }
  | { kind: 'backup'; measuredOn: string | null }
  | { kind: 'withheld'; measuredOn: string | null }
  | { kind: 'catalog' }

/**
 * Which of those `shown` is. `backupDates` is the collector's `fallbackProvenance.byKey`:
 * every key whose figure is the backup table's, with its measured date or null.
 */
export function aprBasis(
  shown: AprDisplay,
  liveKey: string | undefined,
  rates: Partial<Record<string, number>>,
  backupDates: Partial<Record<string, string | null>>,
): AprBasis {
  if (shown.live) return { kind: 'live' }
  if (!liveKey) return { kind: 'catalog' }
  if (shown.apr == null) return { kind: 'withheld', measuredOn: backupDates[liveKey] ?? null }
  if (rates[liveKey] == null) return { kind: 'catalog' }
  if (liveKey in backupDates) return { kind: 'backup', measuredOn: backupDates[liveKey] ?? null }
  return { kind: 'derived' }
}

/** "Nov 5, 2026" for "2026-11-05", read as a calendar day (not shifted by the reader's zone). */
export function rateDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * One sentence on where a rate came from and its date, for beside the rate.
 * `catalogCompiled` is the staking catalog's compile date.
 */
export function aprBasisText(basis: AprBasis, catalogCompiled: string): string {
  switch (basis.kind) {
    case 'live': return 'Live rate, read just now.'
    case 'derived': return 'Worked out from a live reading taken just now.'
    case 'backup':
      return basis.measuredOn
        ? `Backup rate, measured ${rateDay(basis.measuredOn)}, shown because there is no live reading.`
        : 'Backup rate with no measured date, shown because there is no live reading.'
    case 'withheld':
      return basis.measuredOn
        ? `Last measured ${rateDay(basis.measuredOn)}, too long ago to show.`
        : 'No current rate.'
    case 'catalog': return `Catalog figure, compiled ${rateDay(catalogCompiled)}.`
  }
}

/**
 * How many of the rows a page shows are each kind, for its notice. Counted over the rows' own
 * bases, so the notice can only count what the page draws (code audit 2026-11-12, D226: it had
 * counted the collector's keys, ten of which no row reads). `measuredOn` is the oldest measured
 * date among the backup rows.
 */
export interface BasisCounts {
  rows: number
  live: number
  derived: number
  /** Backup rates with a measured date, and the oldest and newest of those dates. */
  measured: number
  measuredOn: string | null
  measuredLatest: string | null
  undated: number
  withheld: number
  catalog: number
}

export function basisCounts(bases: AprBasis[]): BasisCounts {
  const out: BasisCounts = { rows: bases.length, live: 0, derived: 0, measured: 0, measuredOn: null, measuredLatest: null, undated: 0, withheld: 0, catalog: 0 }
  for (const b of bases) {
    if (b.kind === 'backup') {
      if (b.measuredOn) {
        out.measured++
        if (!out.measuredOn || b.measuredOn < out.measuredOn) out.measuredOn = b.measuredOn
        if (!out.measuredLatest || b.measuredOn > out.measuredLatest) out.measuredLatest = b.measuredOn
      } else out.undated++
    } else out[b.kind]++
  }
  return out
}

/** The notice's sentence: what the rates shown are, each kind counted over the rows drawn. */
export function rateSummary(c: BasisCounts): string {
  const be = (n: number) => (n === 1 ? 'is' : 'are')
  const parts: string[] = []
  if (c.live) parts.push(`${c.live} ${be(c.live)} live`)
  if (c.derived) parts.push(`${c.derived} ${be(c.derived)} worked out from a live reading taken just now`)
  if (c.measured && c.measuredOn) {
    const when = c.measuredLatest && c.measuredLatest !== c.measuredOn
      ? `between ${rateDay(c.measuredOn)} and ${rateDay(c.measuredLatest)}`
      : rateDay(c.measuredOn)
    parts.push(`${c.measured} ${c.measured === 1 ? 'is a backup rate' : 'are backup rates'} measured ${when}, shown because there is no live reading`)
  }
  if (c.undated) parts.push(`${c.undated} ${c.undated === 1 ? 'is a backup rate' : 'are backup rates'} with no measured date`)
  if (c.withheld) parts.push(`${c.withheld} ${c.withheld === 1 ? 'is' : 'are'} withheld, last measured too long ago`)
  if (c.catalog) parts.push(`${c.catalog} ${c.catalog === 1 ? 'is the catalog’s own figure' : 'are the catalog’s own figures'}`)
  if (parts.length === 0) return ''
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  return `Of the ${c.rows} rate${c.rows === 1 ? '' : 's'} shown, ${list}.`
}
