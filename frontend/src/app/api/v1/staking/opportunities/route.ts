import { NextRequest, NextResponse } from 'next/server'
import { CORS, options } from '@/app/api/_cors'
import {
  STAKING_PROVIDERS,
  resolveYieldType, YIELD_TYPE_META, getStakingDataProvenance,
  type StakingCoinId, type ProviderCategory,
} from '@/lib/data/stakingProviders'
import { collectStakingRates } from '@/lib/server/stakingRates'
import { aprDisplay, resolveLiveAprKey } from '@/lib/utils/aprDisplay'

export const dynamic = 'force-dynamic'
export { options as OPTIONS }

// This route used to carry its own LIVE_APR_SOURCES + fetchLiveRates here:
// three upstreams against the collector's seven, its own Lido-anchored spreads,
// and its own sanity bounds. It was deleted on 2026-09-18 rather than repaired,
// because it was broken in three ways the collector was not (its Lido parse
// multiplied an already-percentage value by 100 and then failed its own <30
// guard; that took the four derived exchange keys down with it; and its Jito
// endpoint was a 404). The measured result was a public API serving catalog
// estimates for 6 of 7 keys while the UI served live readings.
//
// Both surfaces now read collectStakingRates() and resolve through aprDisplay().

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const coinParam     = searchParams.get('coin')?.toLowerCase() as StakingCoinId | null
  const categoryParam = searchParams.get('category') as ProviderCategory | null
  const yieldTypeParam = searchParams.get('yield_type')?.toLowerCase() ?? null
  // When true (default), return only products that actually stake the queried coin —
  // i.e. exclude governance-token and lending yield. Set to 'true' to include them.
  const includeAdjacent = searchParams.get('include_adjacent') === 'true'
  const includeDefunct = searchParams.get('include_defunct') === 'true'

  // ⚠ BREAKING CHANGE, 2026-09-14 (owner decision D14). This route no longer
  // publishes a composite risk score, and the `max_risk` / `min_safety` /
  // `max_safety` filters are GONE — not deprecated, removed.
  //
  // A composite is one number that ranks providers against each other, and a
  // filter over it ("show me everything safer than 7") is a screen the caller
  // did not compute and cannot audit. That is the shape the owner ruled reads
  // as a recommendation rather than a description.
  //
  // Unknown query params are IGNORED rather than rejected, so an old client
  // sending `max_risk=5` still gets a 200 — with MORE rows than before, never
  // fewer. Erroring would break callers hardest at the moment they are least
  // able to fix it; silently returning a wider set is the safe direction,
  // because no row is filtered out by a rule the caller can no longer see.
  //
  // What REPLACED the filter under D14 — `riskBreakdown`, the six dimensions — is
  // itself gone under D26 (2026-09-25). Nothing replaces it: no risk figure at all.
  // (The next lines are the D14-era note, kept as history.)
  // dimensions per row. A caller who wants a threshold applies its own to those
  // numbers, which makes the judgment theirs and inspectable.

  const { rates, sources, gaps } = await collectStakingRates()

  const opportunities: object[] = []

  for (const provider of STAKING_PROVIDERS) {
    if (provider.defunct && !includeDefunct) continue
    if (categoryParam && provider.category !== categoryParam) continue

    for (const [assetCoinId, asset] of Object.entries(provider.assets) as [StakingCoinId, NonNullable<(typeof provider.assets)[StakingCoinId]>][]) {
      if (!asset) continue
      if (coinParam && assetCoinId !== coinParam) continue

      const yieldType = resolveYieldType(provider, asset)
      const yieldMeta = YIELD_TYPE_META[yieldType]

      // Yield-type filters
      if (yieldTypeParam && yieldType !== yieldTypeParam) continue
      // By default, hide products that don't actually stake the queried coin
      // (governance-token staking, lending) so "ETH staking" means ETH staking.
      if (!includeAdjacent && !yieldMeta.stakesQueriedAsset && !yieldTypeParam) continue

      // Resolved through the SAME pure function the staking page uses, off the
      // same collector — see lib/server/stakingRates.ts for why this route no
      // longer has its own. `aprDisplay` owns the "which number, is it live,
      // why not" decision; this only translates its answer into the v1 contract.
      const liveKey = resolveLiveAprKey(provider, assetCoinId, asset)
      const shown = aprDisplay(asset.staticApr, liveKey, rates, sources, gaps)

      // `apr` is non-nullable in the published v1 contract, and narrowing it is
      // the R2 §5.3 class of break D14 took only with an explicit ruling. So an
      // expired reading — where the UI renders an em-dash — keeps the catalog
      // figure here but says WHY it is one, rather than relabelling it a plain
      // 'estimate' and erasing the distinction this whole staleness pass drew.
      const apr = shown.apr ?? asset.staticApr
      // 'derived' = our Lido-anchored estimate for an exchange rate — a live
      // NUMBER but not the provider's own feed. Labelling it 'live' was D-19.
      // Read off the collector's own gap vocabulary rather than a second list
      // of key names here, which is the kind of parallel copy that caused this.
      const aprSource: 'live' | 'derived' | 'estimate' | 'estimate-expired' =
        shown.live ? 'live'
          : shown.gap === 'derived-estimate' ? 'derived'
            : shown.gap === 'estimate-expired' ? 'estimate-expired'
              : 'estimate'

      opportunities.push({
        provider:        provider.id,
        providerName:    provider.name,
        category:        provider.category,
        yieldType,
        yieldTypeLabel:  yieldMeta.label,
        stakesQueriedAsset: yieldMeta.stakesQueriedAsset,
        defunct:         provider.defunct ?? false,
        coin:            assetCoinId.toUpperCase(),
        coinId:          assetCoinId,
        apr,
        aprSource,
        lockupDays:      asset.lockupDays,
        lockupNote:      asset.lockupNote ?? null,
        liquid:          asset.liquid,
        receiptToken:    asset.receiptToken ?? null,
        minStakeNative:  asset.minStakeNative,
        custodyModel:    provider.custodyModel,
        // No risk figures of any kind (D14 removed the composite, D26 the six
        // dimensions). custodyModel, lockup, liquidity and TVL are facts; the
        // caller forms its own view from them.
        features:       asset.features,
        tvlBillions:    provider.tvlBillions ?? null,
        auditCount:     provider.auditCount ?? null,
      })
    }
  }

  // Sort: viable (non-defunct) first, then by APR desc
  opportunities.sort((a, b) => {
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    if (ao.defunct !== bo.defunct) return ao.defunct ? 1 : -1
    return (bo.apr as number) - (ao.apr as number)
  })

  // Count opportunities per yield type for the response summary
  const yieldTypeCounts = opportunities.reduce<Record<string, number>>((acc, o) => {
    const t = (o as Record<string, unknown>).yieldType as string
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    opportunities,
    total: opportunities.length,
    yieldTypeCounts,
    filters: { coin: coinParam ?? 'all', category: categoryParam ?? 'all', yieldType: yieldTypeParam ?? 'all', includeAdjacent, includeDefunct },
    note: 'Each opportunity carries a yieldType (native, liquid, cefi, restaking, governance, lending). By default only products that actually stake the queried coin are returned; governance-token staking and lending yield are excluded unless include_adjacent=true or yield_type is set explicitly. SCORING: this endpoint publishes NO composite risk or safety score, and has no risk-based filter. Removed 2026-09-14: the safetyScore, band, riskScore and riskLevel fields and the max_risk, min_safety and max_safety parameters. A single number ranking providers against each other reads as a recommendation, so the endpoint reports the inputs and leaves the weighting to the caller. Those parameters are now ignored rather than rejected, so an old client still gets a 200 — but with MORE rows than before, because nothing is being filtered out. Removed 2026-09-25 (owner decision D26): the riskBreakdown object with the six curated 1–10 dimensions — a risk figure attached to a provider reads as a recommendation whichever way it is labelled. This endpoint now carries no risk figure of any kind; custody model, lock-up, liquidity and TVL are facts, and the judgement is the caller\'s. Defunct providers (e.g. Celsius) are excluded by default — use include_defunct=true. FRESHNESS: updatedAt is when this response was generated, which describes the live APRs only (per-row aprSource="live"). Rows with aprSource="derived" are our estimates anchored to the Lido feed, not provider-published rates. Rows with aprSource="estimate", and every lock-up and minimum on every row, come from the curated catalog described by referenceData — check referenceData.verifiedAt, not updatedAt, before treating those as current.',
    source: 'Finance Now curated staking catalog + live protocol APR feeds (Lido, Marinade, Jito). Some exchange ETH rates are derived from the Lido feed (aprSource="derived").',
    updatedAt: new Date().toISOString(),
    // Provenance for the curated half of this payload. Without it the fresh
    // `updatedAt` above implied the risk profiles and estimated APRs had just
    // been refreshed too, which was never true (audit finding M5).
    referenceData: getStakingDataProvenance(),
  }, { headers: CORS })
}
