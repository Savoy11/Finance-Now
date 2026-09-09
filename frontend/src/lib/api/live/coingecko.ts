import { getProviderKey } from './providers'

/**
 * Shared CoinGecko endpoint resolution.
 *
 * Five call sites resolved this independently — four repeating the same
 * `process.env.COINGECKO_BASE_URL?.replace(/\/$/, '') || …` line, and
 * `/live-data/alerts` hardcoding `https://api.coingecko.com/api/v3` outright.
 * The hardcoded one meant COINGECKO_BASE_URL did not apply to alerts, so
 * pointing the app at a proxy or a Pro endpoint silently missed one route, and
 * a configured API key was never sent there at all — the free-tier limit
 * applied even on a paid plan.
 *
 * Not routed through `pinnedFetch`, deliberately: pinnedFetch attaches a custom
 * dispatcher, which takes the request out of Next's fetch cache entirely (see
 * the warning on that function). Every CoinGecko call site here depends on
 * `next: { revalidate }` to stay inside the rate limit — the same limit that
 * produced the audit's three-routes-fail-together artifact — so the trade would
 * be a terms gate on a first-party, terms-VERIFIED host in exchange for
 * multiplying the request volume that already throttles us.
 */

const DEFAULT_BASE = 'https://api.coingecko.com/api/v3'

/** Base URL with any trailing slash removed. */
export function coingeckoBase(): string {
  return (process.env.COINGECKO_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '')
}

/**
 * The effective key: UI-saved config first, then COINGECKO_API_KEY. The
 * scaffold placeholder is treated as absent — sending it produces a 401 that
 * reads like a bad key rather than an unset one.
 */
export function coingeckoKey(): string | undefined {
  const key = getProviderKey('coingecko')
  if (!key || key === 'your-coingecko-api-key') return undefined
  return key
}

/** Request headers, carrying the demo-tier key header when a key is configured. */
export function coingeckoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const key = coingeckoKey()
  if (key) headers['x-cg-demo-api-key'] = key
  return headers
}
