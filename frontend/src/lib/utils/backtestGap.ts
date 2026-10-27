// Why the equity backtest has no result to show (T-021). Kept out of the page file, which
// Next.js allows to export nothing but the page.

import type { SecurityOhlcvResponse } from '@/app/live-data/security-ohlcv/route'

/** Bars a backtest needs: the slowest strategy reads a 40-bar average. */
export const MIN_BARS = 50

/**
 * Says why a backtest could not run, from what the data route answered (T-021). This blamed
 * a missing key every time, though the route tells a missing key ('no_provider_configured')
 * from providers that failed ('fetch_failed') and from history that is simply short.
 */
export function backtestGap(
  data: Pick<SecurityOhlcvResponse, 'ok' | 'candles' | 'error' | 'failures'> | undefined,
  symbol: string,
): { reason: 'needs-api-key' | 'upstream-failed' | 'no-upstream'; message: string } {
  const error = data?.error ?? ''
  if (error.startsWith('no_provider_configured')) {
    return { reason: 'needs-api-key', message: 'Backtesting reads daily price history, and no source for it is set up. Add a Tiingo or FMP key on the Integrations page: the keyless source was withdrawn on terms grounds.' }
  }
  if (error === 'fetch_failed') {
    const tried = data?.failures?.length ? ` Tried: ${data.failures.join('; ')}.` : ''
    return { reason: 'upstream-failed', message: `The price-history sources did not answer for ${symbol}. It may not be a ticker they carry, or a quota may be spent.${tried}` }
  }
  const n = data?.candles?.length ?? 0
  return { reason: 'no-upstream', message: `${symbol} has ${n} daily bar${n === 1 ? '' : 's'} in this range, and a backtest needs at least ${MIN_BARS}. Try a longer range, or a ticker with a longer history.` }
}
