import { describe, expect, it } from 'vitest'
import { closesReason, drawableChartType, RANGE_CHART_TYPES, type ChartSeries } from '../useCryptoChartSeries'

// When a crypto chart switches from candles to DefiLlama's closing prices, and
// what it may draw once it has (T-423, D103).

const DAY = 86_400
const series = (count: number, step: number, ok = true): ChartSeries => ({
  ok,
  candles: Array.from({ length: count }, (_, i) => ({ time: 1_700_000_000 + i * step, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 })),
})

describe('closesReason', () => {
  it('asks for closing prices when no candles came back', () => {
    expect(closesReason(series(0, DAY, false))).toBe('no-candles')
    expect(closesReason(series(0, DAY))).toBe('no-candles')
  })

  it('asks for closing prices when the candles are 4-day ones', () => {
    // CoinGecko's free one-year answer: 92 candles, 96 hours apart (measured 2026-10-12).
    expect(closesReason(series(92, 4 * DAY))).toBe('coarse-candles')
  })

  it('keeps real candles at the size the range asked for', () => {
    expect(closesReason(series(365, DAY))).toBeNull()
    expect(closesReason(series(157, 7 * DAY))).toBeNull()
    expect(closesReason(series(180, 4 * 3_600))).toBeNull()
  })

  it('waits for the candle answer before deciding', () => {
    expect(closesReason(undefined)).toBeNull()
  })
})

describe('drawableChartType', () => {
  it('draws a line where the chosen type needs ranges the series lacks', () => {
    for (const t of RANGE_CHART_TYPES) expect(drawableChartType(t, true)).toBe('line')
  })

  it('keeps the chosen type when it reads closes, or when the series has ranges', () => {
    for (const t of ['line', 'step-line', 'area', 'baseline'] as const) expect(drawableChartType(t, true)).toBe(t)
    for (const t of RANGE_CHART_TYPES) expect(drawableChartType(t, false)).toBe(t)
  })
})
