'use client'

import { useQuery } from '@tanstack/react-query'
import type { OhlcvCandle } from '@/lib/utils/indicators'
import type { ChartType } from '@/components/charts/CandlestickChart'
import { candleGranularity } from '@/lib/utils/candleGranularity'

/**
 * The series a crypto chart draws: candles when there are real ones, DefiLlama's
 * closing prices when there are not (T-423, owner decision D103, 2026-10-13).
 *
 * Candles are asked for first, every time. Closing prices are asked for only
 * when the candles are missing (CoinGecko's free service refuses history older
 * than 365 days) or only 4-day ones (what it sends for any window over 30 days).
 * They come back as candles whose open, high and low are the close, with volume
 * 0, marked `bars: 'close'`, so a page drawing them must offer only what reads
 * closes alone: `indicatorsFor(false, false)` and the line chart types.
 *
 * If DefiLlama has nothing either, the candle answer stands, coarse or empty.
 */

export interface ChartSeries {
  ok: boolean
  candles: OhlcvCandle[]
  source?: string
  granularity?: string | null
  bars?: 'ohlc' | 'close'
  error?: string
}

/** Why a chart shows closing prices instead of candles. */
export type ClosesReason = 'no-candles' | 'coarse-candles'

/** Chart types that draw a candle's open, high and low. Drawn from closes, each is a flat tick. */
export const RANGE_CHART_TYPES: ReadonlySet<ChartType> = new Set<ChartType>(['candlestick', 'hollow', 'heikin-ashi', 'bars'])

/** The chart type to draw: the chosen one, or a line when it needs ranges the series lacks. */
export function drawableChartType(chosen: ChartType, closeOnly: boolean): ChartType {
  return closeOnly && RANGE_CHART_TYPES.has(chosen) ? 'line' : chosen
}

export function closesReason(candles: ChartSeries | undefined): ClosesReason | null {
  if (!candles) return null
  if (!candles.ok || candles.candles.length === 0) return 'no-candles'
  if (candleGranularity(candles.candles.map((c) => c.time)) === '4D') return 'coarse-candles'
  return null
}

async function getSeries(url: string): Promise<ChartSeries> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed (${res.status})`)
  const body = (await res.json()) as ChartSeries
  return { ...body, candles: body.candles ?? [] }
}

export function useCryptoChartSeries(
  assetId: string,
  range: string,
  { enabled = true, staleTime }: { enabled?: boolean; staleTime: number },
) {
  const base = `/live-data/ohlcv?id=${encodeURIComponent(assetId)}&range=${encodeURIComponent(range)}`

  const candles = useQuery({
    queryKey: ['ta-ohlcv', assetId, range],
    queryFn: () => getSeries(base),
    enabled,
    staleTime,
  })

  const reason = closesReason(candles.data)
  const closes = useQuery({
    queryKey: ['ta-ohlcv', assetId, range, 'closes'],
    queryFn: () => getSeries(`${base}&closes=1`),
    enabled: enabled && reason !== null,
    staleTime,
  })

  const useCloses = reason !== null && !!closes.data?.ok && closes.data.candles.length > 0
  const data = useCloses ? closes.data : candles.data

  return {
    data,
    /** True when the chart holds closing prices: no ranges, no volume. */
    closeOnly: data?.bars === 'close',
    /** Why, when it does. */
    closesReason: useCloses ? reason : null,
    /** The candle request's own failure, in the route's words, when it failed. */
    candleError: candles.data?.ok === false ? candles.data.error : undefined,
    isFetching: candles.isFetching || closes.isFetching,
    refetch: () => {
      void candles.refetch()
      if (reason !== null) void closes.refetch()
    },
  }
}
