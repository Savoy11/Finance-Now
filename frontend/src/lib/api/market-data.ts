import { fetchLiveMarkets } from './live/liveClient'

// The legacy backend fallbacks in this module sat behind `if (LIVE_DATA)`
// early returns, and `LIVE_DATA` is a hardcoded `true` (lib/constants.ts) —
// the M8 sweep removed them along with the axios client they called.
//
// getAssetMarketData / getPegHistory / getMultiAssetPegHistory went too: their
// hooks (useAssetMarketData, usePegHistory, useMultiAssetPegHistory) lost
// their last consumers when the orphaned dashboard widgets were deleted, and
// the two peg readers returned nothing but empties in live mode anyway. The
// coin detail page sources its peg history from the live analytics bundle.
export const marketDataApi = {
  /**
   * `avgRiskScore`, `criticalHighCount` and `activeAlerts` were removed from this
   * shape on 2026-09-08. All three had been hardcoded `null` — the first two
   * because **RP-6 (2026-08-29) withdrew per-coin risk scoring**, and an average
   * or a band-count over coins is that same figure aggregated; the third because
   * alerts are read from `useAlertStats`, not from here.
   *
   * A permanently-null field is precisely what RP-6 removed the `Asset` risk
   * fields to avoid: its only consumer rendered "Avg Safety Score — N/A", which
   * a reader takes as *temporarily unavailable* rather than *deliberately not
   * published*. Withholding a number and failing to fetch one must not look the
   * same.
   */
  getMarketOverview: async (): Promise<{
    totalAssets: number
    totalMarketCap: number | null
    totalVolume24h: number | null
  }> => {
    const { quotes } = await fetchLiveMarkets()
    const values = Object.values(quotes)
    const totalMarketCap = values.reduce((sum, q) => sum + (q.marketCap ?? 0), 0)
    const totalVolume24h = values.reduce((sum, q) => sum + (q.volume24h ?? 0), 0)
    return {
      totalAssets: values.length,
      totalMarketCap: totalMarketCap || null,
      totalVolume24h: totalVolume24h || null,
    }
  },
}
