// The arithmetic both backtest engines share (T-019, owner decision D172, 2026-10-26: keep
// the two strategy engines separate, share the maths). Pure, no I/O.
//
// Why it exists. Both engines annualised on a bar size they assumed rather than measured,
// and both were wrong (T-018):
// - The equity backtest took `barsPerYear` from its range picker, 252/52/12 for "1 Year
//   (daily)", "5 Years (weekly)" and "Max (monthly)". The data has been daily on every
//   range since the 2026-08-06 Yahoo removal, so a 5-year Sharpe was scaled by √52 where
//   √252 was right: understated by a factor of about 2.2.
// - The crypto backtest scaled a per-trade Sharpe by √(252 ÷ bars held). Crypto trades
//   every day, so a year is 365 daily bars, not 252. And on long ranges CoinGecko's free
//   service sends 4-day candles, so a "bar" was four days.
// Here the bar size is read from the timestamps, as `candleGranularity` does for the crypto
// charts, so the figure follows the data whatever shape it arrives in.

export type BacktestMarket = 'equity' | 'crypto'

/** Trading sessions in a US equity year. */
export const EQUITY_SESSIONS_PER_YEAR = 252
/** A gap this long or shorter between equity bars is one session: a weekend, or a holiday beside one. */
const ONE_SESSION_MAX_GAP_DAYS = 4

/**
 * The median gap between consecutive timestamps (unix seconds), in days, or null with fewer
 * than two. The median, so a missing bar or a holiday does not move it.
 */
export function medianSpacingDays(times: readonly number[]): number | null {
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) {
    const g = (times[i] - times[i - 1]) / 86_400
    if (Number.isFinite(g) && g > 0) gaps.push(g)
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
}

/**
 * How many of these bars make a year. Equity daily bars sit on trading sessions, 252 a year,
 * and their median gap is one day (Friday to Monday is one session too). Longer equity bars,
 * and every crypto bar, are calendar time: a crypto market trades all 365 days.
 */
export function periodsPerYear(times: readonly number[], market: BacktestMarket): number | null {
  const days = medianSpacingDays(times)
  if (days === null) return null
  if (market === 'equity') return days <= ONE_SESSION_MAX_GAP_DAYS ? EQUITY_SESSIONS_PER_YEAR : 365.25 / days
  return 365 / days
}

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/** Sample standard deviation (n − 1), or null with fewer than two values. */
export function sampleStdev(xs: readonly number[]): number | null {
  if (xs.length < 2) return null
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

/**
 * Annualised Sharpe of per-bar returns (no risk-free rate): mean ÷ standard deviation ×
 * √(bars a year). Null when it cannot be worked out: fewer than two returns, no spread, or
 * no measured bar size.
 */
export function annualisedSharpe(returns: readonly number[], perYear: number | null): number | null {
  const sd = sampleStdev(returns)
  if (sd === null || !(sd > 0) || perYear === null || !(perYear > 0)) return null
  return (mean(returns) / sd) * Math.sqrt(perYear)
}

/**
 * Per-trade Sharpe and Sortino, annualised by how many trades of the average length fit in a
 * year: × √(bars a year ÷ average bars held). Sortino divides by the root mean square of the
 * losing trades only, and needs at least two of them.
 */
export function perTradeRatios(
  returns: readonly number[],
  avgHoldBars: number,
  perYear: number | null,
): { sharpe: number | null; sortino: number | null } {
  if (returns.length < 2 || perYear === null || !(perYear > 0)) return { sharpe: null, sortino: null }
  const factor = Math.sqrt(perYear / Math.max(avgHoldBars, 1))
  const m = mean(returns)
  const sd = sampleStdev(returns)
  const sharpe = sd !== null && sd > 0 ? (m / sd) * factor : null
  const losses = returns.filter((r) => r < 0)
  let sortino: number | null = null
  if (losses.length >= 2) {
    const downside = Math.sqrt(losses.reduce((s, r) => s + r * r, 0) / losses.length)
    if (downside > 0) sortino = (m / downside) * factor
  }
  return { sharpe, sortino }
}

/** The worst fall from a running peak, as a fraction (0.25 = 25%), over an equity series. */
export function maxDrawdownFraction(equity: readonly number[], start = 1): number {
  let peak = start
  let worst = 0
  for (const e of equity) {
    peak = Math.max(peak, e)
    if (peak > 0) worst = Math.max(worst, (peak - e) / peak)
  }
  return worst
}
