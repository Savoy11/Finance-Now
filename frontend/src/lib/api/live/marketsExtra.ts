import { ALL_COINGECKO_IDS } from './coingeckoIds'

/**
 * Coins a user added from Coin Discovery, asked for alongside the catalog on
 * `/live-data/markets?extra=` (T-129 A, owner 2026-10-24). They used to show
 * the price saved on the day they were added, in the live column with no label.
 *
 * They ride the SAME CoinGecko request as the catalog, so they cost no extra
 * call. That request is one page of at most 250 coins, so only ids not already
 * in the catalog are kept, and no more than fit beside it (MAX_EXTRA_IDS at most).
 * Only CoinGecko-shaped ids pass: the value goes into an upstream query string.
 */
export const MAX_EXTRA_IDS = 50
const PAGE_SIZE = 250
const EXTRA_ID = /^[a-z0-9][a-z0-9-]{0,99}$/

export function parseExtraIds(raw: string | null, catalog: readonly string[] = ALL_COINGECKO_IDS): string[] {
  if (!raw) return []
  const inCatalog = new Set(catalog)
  const ids = [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()))]
    .filter((id) => EXTRA_ID.test(id) && !inCatalog.has(id))
  return ids.slice(0, Math.max(0, Math.min(MAX_EXTRA_IDS, PAGE_SIZE - catalog.length)))
}
