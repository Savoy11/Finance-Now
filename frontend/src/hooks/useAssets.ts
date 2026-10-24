import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { assetsApi, type GetAssetsParams } from '@/lib/api/assets'
import type { AddedCoinRef } from '@/lib/api/live/addedCoins'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import { needsTechnicalSweep } from '@/lib/data/coinFilters'
import { useTechnicalSweep } from '@/hooks/useTechnicalSweep'
import { useAssetStore } from '@/store/useAssetStore'
import { useCoinDiscoveryStore, type AddedCoin } from '@/store/useCoinDiscoveryStore'
import type { FilterRule } from '@/lib/data/coinFilters'
import { STALE_TIME_SHORT, STALE_TIME_MEDIUM, GC_TIME } from '@/lib/constants'

export const ASSET_KEYS = {
  all: ['assets'] as const,
  lists: () => [...ASSET_KEYS.all, 'list'] as const,
  list: (params: GetAssetsParams) => [...ASSET_KEYS.lists(), params] as const,
  details: () => [...ASSET_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ASSET_KEYS.details(), id] as const,
  search: (q: string) => [...ASSET_KEYS.all, 'search', q] as const,
}

/**
 * List assets. When a risk index is supplied it is joined onto assets BEFORE
 * filtering/sorting/pagination (see assetsApi.getAssets) so the Safety Score
 * filters and sort operate on real scores. `riskIndexVersion` must change when
 * the index does (use the index query's dataUpdatedAt) so results recompute.
 */
export function useAssets(params: GetAssetsParams = {}) {
  return useQuery({
    queryKey: ASSET_KEYS.list(params),
    queryFn: () => assetsApi.getAssets(params),
    staleTime: STALE_TIME_SHORT,
    gcTime: GC_TIME,
    placeholderData: (prev) => prev,
  })
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ASSET_KEYS.detail(id),
    queryFn: () => assetsApi.getAsset(id),
    staleTime: STALE_TIME_MEDIUM,
    gcTime: GC_TIME,
    enabled: !!id,
  })
}

// useWatchlist was removed in the M8 sweep — no consumers, and the api method
// behind it faked a saved list from "the first 5 assets". The real watchlist is
// store/useWatchlistStore.ts, backed by /api/user/watchlists.

/**
 * The live risk composite for every scored asset, indexed by id. Shared query
 * key so registry / detail / heatmap dedupe to a single request (R2 Phase 2).
 */
export function useAssetSearch(query: string) {
  return useQuery({
    queryKey: ASSET_KEYS.search(query),
    queryFn: () => assetsApi.searchAssets(query),
    staleTime: STALE_TIME_SHORT,
    gcTime: GC_TIME,
    enabled: query.length >= 2,
  })
}

// usePrefetchAsset was removed in the M8 sweep — it was written for a hover-
// prefetch on the asset table that never shipped, and had no callers.

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Only what the Coins table needs from a saved coin. The saved price and
 * market cap are left behind on purpose: they are a figure from the day the
 * coin was added, and they used to sit in the live column (T-129 A).
 */
function toRef(c: AddedCoin): AddedCoinRef {
  return { cgId: c.cgId, symbol: c.symbol, name: c.name, category: c.category, addedAt: c.addedAt, notes: c.notes }
}

export function useAssetsWithStore(filterRules: FilterRule[] = []) {
  const { filters, sort, page, pageSize } = useAssetStore()
  const { addedCoins } = useCoinDiscoveryStore()
  const addedRefs = useMemo(() => addedCoins.map(toRef), [addedCoins])

  // The candle sweep (option B). It runs ONLY when a technical rule is active,
  // and over the WHOLE tracked universe rather than the visible page — the
  // screener's invariant is that filters see the dataset, and sweeping one page
  // would filter as though it had seen every coin.
  const sweepIds = useMemo(() => Object.keys(COINGECKO_IDS), [])
  const sweepNeeded = needsTechnicalSweep(filterRules)
  const sweep = useTechnicalSweep(sweepIds, sweepNeeded)

  const params: GetAssetsParams = {
    assetType: filters.assetType !== 'all' ? filters.assetType : undefined,
    search: filters.search || undefined,
    filterRules: filterRules.length ? filterRules : undefined,
    // Deliberately NOT stripped while the sweep is in flight. With no values
    // yet every coin is `untested`, which is exactly true — showing the
    // unfiltered table instead would present coins that may not match as
    // though they did. The UI shows the sweep's progress over the top.
    technicals: sweep.data,
    addedCoins: addedRefs.length ? addedRefs : undefined,
    sortBy: sort.key,
    sortDirection: sort.direction,
    page,
    pageSize,
  }

  // Added coins ride in `params` (T-129 A) and are merged inside getAssets,
  // before search, type, screener, sort and paging. They used to be merged here,
  // after all of those: unfiltered, onto the current page only, and priced at
  // the figure saved the day they were added.
  const mainQuery = useAssets(params)

  return {
    ...mainQuery,
    // Surfaced so the screener can say what it is doing. `active` distinguishes
    // "no technical rule, nothing to sweep" from "swept and found nothing" —
    // an absent sweep and an empty one are not the same state.
    technicalSweep: {
      active: sweepNeeded,
      isLoading: sweepNeeded && sweep.isLoading,
      progress: sweep.progress,
      /** Coins the sweep returned values for. The rest read as not tested. */
      covered: sweep.data?.size ?? 0,
      universe: sweepIds.length,
      /** Credits the swept prices' sources require (Coin Metrics, when it served: D108). */
      credits: sweep.credits,
    },
  }
}
