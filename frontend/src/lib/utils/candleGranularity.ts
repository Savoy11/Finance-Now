/**
 * How far apart a series' candles actually are, read from their timestamps.
 *
 * `/live-data/ohlcv` used to send a typed `granularity` per range, and it was
 * wrong in both directions. CoinGecko's free service returns 4-DAY candles for
 * any window over 30 days, so a one-year series of 92 candles went out as "1D";
 * and the Binance rung asks for 1-hour bars on the 1H range while the label said
 * "30m". Measured 2026-10-12 (T-423): `/coins/bitcoin/ohlc?days=365` → 92
 * candles, 96 hours apart. A size worked out from the candles cannot disagree
 * with them.
 *
 * Consumers that compute on an assumed spacing — the scanner's timeframes, the
 * multi-timeframe grid, the Coins screener's 14-day RSI and 30-day volatility —
 * compare this against the size they asked for, and leave a coin out when the
 * two differ rather than reading 4-day candles as daily ones.
 */

export type CandleSize = '15m' | '30m' | '1H' | '4H' | '1D' | '4D' | '1W'

const SIZES: readonly (readonly [CandleSize, number])[] = [
  ['15m', 900],
  ['30m', 1_800],
  ['1H', 3_600],
  ['4H', 14_400],
  ['1D', 86_400],
  ['4D', 345_600],
  ['1W', 604_800],
]

/**
 * The candle size nearest the median gap between consecutive timestamps (unix
 * seconds), or null when there are fewer than two candles to measure.
 *
 * The median, not the mean, so one missing candle or a year-to-date cut does not
 * move the answer; "nearest" on a log scale, because sizes are multiples of one
 * another and the halfway point between a day and four days is two days, not
 * two and a half. Weekly candles resampled from 4-day ones fall 4 or 8 days
 * apart, three 8s to every 4, and the median reads as a week.
 */
export function candleGranularity(times: readonly number[]): CandleSize | null {
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1]
    if (gap > 0 && Number.isFinite(gap)) gaps.push(gap)
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2

  let best: CandleSize = SIZES[0][0]
  let bestDistance = Infinity
  for (const [size, seconds] of SIZES) {
    const distance = Math.abs(Math.log(median / seconds))
    if (distance < bestDistance) { best = size; bestDistance = distance }
  }
  return best
}

const WORDS: Record<CandleSize, string> = {
  '15m': '15-minute',
  '30m': '30-minute',
  '1H': '1-hour',
  '4H': '4-hour',
  '1D': 'daily',
  '4D': '4-day',
  '1W': 'weekly',
}

/** "4-day", "daily", "1-hour": the size as it reads in a sentence. */
export function candleSizeWords(size: string | null | undefined): string | undefined {
  return size && size in WORDS ? WORDS[size as CandleSize] : undefined
}
