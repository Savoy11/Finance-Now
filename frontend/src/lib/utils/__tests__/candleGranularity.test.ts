import { describe, it, expect } from 'vitest'
import { candleGranularity, candleSizeWords } from '../candleGranularity'

const HOUR = 3_600
const DAY = 86_400
const series = (count: number, step: number, start = 1_760_000_000) =>
  Array.from({ length: count }, (_, i) => start + i * step)

describe('candleGranularity', () => {
  it('names each size the chart route can serve', () => {
    expect(candleGranularity(series(200, 900))).toBe('15m')
    expect(candleGranularity(series(48, 30 * 60))).toBe('30m')
    expect(candleGranularity(series(168, HOUR))).toBe('1H')
    expect(candleGranularity(series(180, 4 * HOUR))).toBe('4H')
    expect(candleGranularity(series(365, DAY))).toBe('1D')
    expect(candleGranularity(series(157, 7 * DAY))).toBe('1W')
  })

  it('calls CoinGecko’s free one-year series what it is: 4-day candles, not daily', () => {
    // Measured 2026-10-12: /coins/bitcoin/ohlc?days=365 → 92 candles, 96 hours apart.
    expect(candleGranularity(series(92, 96 * HOUR))).toBe('4D')
  })

  it('reads weekly candles resampled from 4-day ones as weekly', () => {
    // Monday buckets of 4-day candles start 4 or 8 days apart, three gaps of 8 to every 4.
    const times = [0, 8, 16, 24, 28, 36, 44, 52, 56, 64].map((d) => 1_760_000_000 + d * DAY)
    expect(candleGranularity(times)).toBe('1W')
  })

  it('takes the median, so one missing candle does not change the answer', () => {
    const times = series(100, DAY)
    times.splice(50, 1)
    expect(candleGranularity(times)).toBe('1D')
  })

  it('is not moved by one long pause, where an average would be', () => {
    // 30 daily candles, then trading resumes 60 days later: the mean gap is about
    // three days, which would call daily candles 4-day ones.
    const times = [...series(30, DAY), 1_760_000_000 + 89 * DAY]
    expect(candleGranularity(times)).toBe('1D')
  })

  it('splits sizes on a log scale: under two days is daily, over is 4-day', () => {
    expect(candleGranularity(series(10, 1.9 * DAY))).toBe('1D')
    expect(candleGranularity(series(10, 2.1 * DAY))).toBe('4D')
  })

  it('returns null when there is nothing to measure', () => {
    expect(candleGranularity([])).toBeNull()
    expect(candleGranularity([1_760_000_000])).toBeNull()
    expect(candleGranularity([5, 5, 5])).toBeNull()
  })
})

describe('candleSizeWords', () => {
  it('reads a size as it goes in a sentence', () => {
    expect(candleSizeWords('4D')).toBe('4-day')
    expect(candleSizeWords('1D')).toBe('daily')
    expect(candleSizeWords('1H')).toBe('1-hour')
  })

  it('says nothing for a size it does not know', () => {
    expect(candleSizeWords(undefined)).toBeUndefined()
    expect(candleSizeWords(null)).toBeUndefined()
    expect(candleSizeWords('3D')).toBeUndefined()
  })
})
