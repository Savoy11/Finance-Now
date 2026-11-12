// ─── Links between the coin pages, the Staking page and the Reserve Monitor (T-463) ──
//
// The three name coins their own ways: the Staking page's `matic` is the coin page `pol`, and
// Cosmos, Osmosis and Kusama have no coin page at all; the Reserve Monitor names its coins by
// DefiLlama's number. So each link goes through a hand-kept map, checked by a test against the
// coin catalog, and never through a match on the ticker: a ticker is not an identity (D190, when
// "GUSD" turned out to be two coins). A coin with no page is left unlinked.

import {
  STAKING_COIN_INFO, STAKING_PROVIDERS, YIELD_TYPE_META, resolveYieldType,
  type StakingCoinId, type StakingProvider,
} from './stakingProviders'
import { DEFILLAMA_STABLECOINS, type MonitoredStablecoin } from './stablecoinMeta'

/** The coin page (`/assets/[id]`) for each coin the Staking page names; null where there is none. */
export const STAKING_COIN_PAGE: Record<StakingCoinId, string | null> = {
  eth: 'eth',
  sol: 'sol',
  ada: 'ada',
  dot: 'dot',
  atom: null, // Cosmos has no coin page
  matic: 'pol', // the Staking page's Polygon is POL, the coin page `pol`
  avax: 'avax',
  bnb: 'bnb',
  trx: 'trx',
  btc: 'btc',
  cro: 'cro',
  osmo: null, // Osmosis has no coin page
  ksm: null, // Kusama has no coin page
  inj: 'inj',
  tia: 'tia',
  near: 'near',
}

export const isStakingCoinId = (v: string | null | undefined): v is StakingCoinId =>
  !!v && Object.prototype.hasOwnProperty.call(STAKING_COIN_INFO, v)

/** The coin page for a Staking page coin, or null. */
export function coinPageForStaking(coin: StakingCoinId): string | null {
  return STAKING_COIN_PAGE[coin]
}

/** The Staking page's coin for a coin page, or null when it lists none. */
export function stakingCoinForPage(pageId: string): StakingCoinId | null {
  const hit = (Object.entries(STAKING_COIN_PAGE) as [StakingCoinId, string | null][]).find(([, page]) => page === pageId)
  return hit ? hit[0] : null
}

/**
 * Whether a provider's offer for a coin stakes that coin itself, rather than paying a
 * governance token's or a lending yield. The Staking page shows only these unless asked
 * ("ETH staking should mean ETH staking"), and the coin page counts the same ones.
 */
export function stakesTheCoin(provider: StakingProvider, asset: NonNullable<StakingProvider['assets'][StakingCoinId]>): boolean {
  return YIELD_TYPE_META[resolveYieldType(provider, asset)].stakesQueriedAsset
}

/** The catalog's live providers that stake `coin` itself, as the Staking page lists them by default. */
export function stakingRowsFor(coin: StakingCoinId): { provider: StakingProvider; asset: NonNullable<StakingProvider['assets'][StakingCoinId]> }[] {
  return STAKING_PROVIDERS.flatMap((provider) => {
    const asset = provider.assets[coin]
    return !provider.defunct && asset && stakesTheCoin(provider, asset) ? [{ provider, asset }] : []
  })
}

/**
 * The coin page for each Reserve Monitor coin. Checked by a test: where the coin page has a
 * CoinGecko id, it is the one DefiLlama gives the monitored coin (DEFILLAMA_STABLECOINS); frxUSD's
 * page has none, so its full name is checked instead.
 */
export const RESERVE_COIN_PAGE: Record<MonitoredStablecoin, string> = {
  USDT: 'usdt',
  USDC: 'usdc',
  DAI: 'dai',
  FRAX: 'frax',
  FRXUSD: 'frxusd',
  TUSD: 'tusd',
  LUSD: 'lusd',
  USDP: 'usdp',
  GUSD: 'gusd',
  PYUSD: 'pyusd',
}

/** The coin page for a Reserve Monitor row, by DefiLlama's own number for the coin; null for any other. */
export function coinPageForReserve(defillamaId: string): string | null {
  const key = (Object.keys(DEFILLAMA_STABLECOINS) as MonitoredStablecoin[]).find((k) => DEFILLAMA_STABLECOINS[k].id === String(defillamaId))
  return key ? RESERVE_COIN_PAGE[key] : null
}
