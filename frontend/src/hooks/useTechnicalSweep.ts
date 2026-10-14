'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sweepTechnicals, SWEEP_RANGE, type TechnicalRow } from '@/lib/technicals/sweep'
import { mergeCredits, type RequiredCredit } from '@/lib/data/dataSources'

/**
 * React Query wrapper around the shared OHLCV sweep.
 *
 * The cache key is deliberately (range, sorted ids) and NOT the calling page.
 * That is the whole point of option B: open /scanner, then open the Coins
 * screener, and the second one is served from the first one's cache instead of
 * repeating ~80 upstream calls.
 *
 * `staleTime` matches the ohlcv route's own 15-minute revalidate. A shorter one
 * would re-sweep the universe only to be handed the same cached candles back.
 */
export const TECHNICAL_SWEEP_STALE_MS = 15 * 60 * 1000

export interface SweepProgress { done: number; total: number }

interface SweepResult {
  rows: Map<string, TechnicalRow>
  /**
   * Credits the sweep's responses carried (Coin Metrics, when it served a coin: D108).
   * Kept in the cached result, not component state, so a sweep served from the cache
   * still shows them.
   */
  credits: RequiredCredit[]
}

export function useTechnicalSweep(ids: string[], enabled: boolean, range = SWEEP_RANGE) {
  // Progress is component state, not query state: a sweep of ~80 coins takes
  // long enough that a bare spinner reads as a hang. The screener shows
  // "sweeping 34 of 80" instead.
  const [progress, setProgress] = useState<SweepProgress>({ done: 0, total: 0 })
  // Sorted so two callers holding the same coins in a different order share one
  // cache entry rather than sweeping twice for identical data.
  const key = [...ids].sort().join(',')

  const query = useQuery<SweepResult>({
    queryKey: ['technical-sweep', range, key],
    queryFn: async () => {
      setProgress({ done: 0, total: ids.length })
      let credits: RequiredCredit[] = []
      const rows = await sweepTechnicals(ids, {
        range,
        onProgress: (done, total) => setProgress({ done, total }),
        onCredits: (more) => { credits = mergeCredits(credits, more) },
      })
      return { rows, credits }
    },
    // Opt-in: a screener nobody opened must not cost a single upstream call.
    enabled: enabled && ids.length > 0,
    staleTime: TECHNICAL_SWEEP_STALE_MS,
    gcTime: TECHNICAL_SWEEP_STALE_MS,
    // A partial sweep is a normal result on a rate-limited tier, not a failure
    // to retry into: coins that failed are absent from the map and read as
    // "not tested". Retrying the whole sweep would multiply the pressure that
    // caused the gaps.
    retry: false,
    refetchOnWindowFocus: false,
  })

  return { ...query, data: query.data?.rows, credits: query.data?.credits ?? [], progress }
}
