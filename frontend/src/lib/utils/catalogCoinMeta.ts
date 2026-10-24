import type { CoinListEntry } from '@/lib/types/coinList'

/**
 * A catalog coin's display name and market-cap rank, read from /live-data/coin-list
 * by its CoinGecko id (T-129, 2026-10-24).
 *
 * The Crypto Scanner and the Technical Analysis coin picker used to match by
 * ticker symbol. Tickers are not unique: 14 were shared inside CoinGecko's top
 * 750 on 2026-10-24, and a Map built from the list keeps the LAST entry for a
 * symbol, which is the lower-ranked one. So Maker's DAI (#24) showed as "DAI on
 * PulseChain" (#429) and sorted there, and MemeCore (#48) as "Mantis" with no
 * rank. The catalog already says which coin each asset id is (COINGECKO_IDS),
 * so that is the key; a coin outside the list keeps its symbol and sorts last.
 */
export interface CatalogCoinMeta {
  id: string
  symbol: string
  label: string
  rank: number
}

/** Rank given to a coin the list does not carry, so it sorts after every ranked one. */
export const UNRANKED = 9999

export function catalogCoinMeta(
  assetIds: readonly string[],
  coingeckoIds: Readonly<Record<string, string>>,
  coins: readonly CoinListEntry[] | undefined,
): CatalogCoinMeta[] {
  const byCoingeckoId = new Map((coins ?? []).map((c) => [c.id, c]))
  return assetIds.map((id) => {
    const live = byCoingeckoId.get(coingeckoIds[id])
    return {
      id,
      symbol: id.toUpperCase(),
      label: live?.name ?? id.toUpperCase(),
      rank: live?.rank ?? UNRANKED,
    }
  })
}
