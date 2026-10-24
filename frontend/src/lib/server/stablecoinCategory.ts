import { fetchCoinGeckoPages } from './coingeckoPages'

/**
 * Which coins CoinGecko itself files as stablecoins (T-129 E, owner 2026-10-24).
 *
 * Coin Discovery used to guess from the coin's id: "usd", "stable" or "dai"
 * anywhere in it meant stablecoin. That labelled coins CoinGecko does not file
 * as stablecoins (STABLE and apyUSD on the 2026-10-24 walkthrough; reUSD, also
 * questioned then, CoinGecko does file as one) and missed most stablecoins
 * pegged to anything but the dollar. CoinGecko's own `stablecoins` category
 * replaces the guess.
 *
 * One page of 250 by market cap is enough: measured 2026-10-24, the category's
 * 250th member ranked about 4,370 overall, far below the 750 Coin Discovery can
 * list. Membership changes slowly, so the page is cached a day, like the
 * tokenized-security categories (tokenizedSecurities.ts), and costs one request
 * a day.
 */
export const STABLECOIN_CATEGORY = 'stablecoins'

const REVALIDATE_SECONDS = 86_400

const categoryUrl = () =>
  'https://api.coingecko.com/api/v3/coins/markets' +
  `?vs_currency=usd&category=${STABLECOIN_CATEGORY}&order=market_cap_desc&per_page=250&page=1&sparkline=false`

export interface StablecoinIndex {
  /** CoinGecko ids in the category; null when it could not be read. */
  ids: Set<string> | null
  /** Why it could not be read, when it could not. */
  error?: string
}

export async function fetchStablecoinIndex(): Promise<StablecoinIndex> {
  const { pages, errors } = await fetchCoinGeckoPages<{ id: string }>(
    1, categoryUrl, { revalidate: REVALIDATE_SECONDS },
  )
  if (pages.length === 0) return { ids: null, error: errors.join('; ') || 'no data' }
  return { ids: new Set(pages[0].map((r) => r?.id).filter((id): id is string => typeof id === 'string')) }
}

/**
 * A candidate coin's category and note: factual metadata, no scoring (W3-1).
 * The catalog's hand-written entry wins; then CoinGecko's stablecoin category,
 * when it was read; the id is guessed from only when it was not, and the note
 * says which, so a guess never reads as CoinGecko's filing. The DeFi label is
 * still a labelled guess: there was no ruling to replace it.
 */
export function classifyCoinUtility(
  cgId: string,
  stablecoinIds: Set<string> | null,
  utilityMap: Readonly<Record<string, { category: string; note: string }>>,
): { category: string; note: string } {
  const mapped = utilityMap[cgId]
  if (mapped) return { category: mapped.category, note: mapped.note }
  const id = cgId.toLowerCase()
  if (stablecoinIds) {
    if (stablecoinIds.has(cgId)) return { category: 'stablecoin', note: 'Stablecoin (CoinGecko category)' }
  } else if (id.includes('usd') || id.includes('stable') || id.includes('dai')) {
    return { category: 'stablecoin', note: 'Stablecoin (heuristic)' }
  }
  if (id.includes('swap') || id.includes('dex') || id.includes('defi'))
    return { category: 'defi', note: 'DeFi protocol (heuristic)' }
  return { category: 'unknown', note: '' }
}
