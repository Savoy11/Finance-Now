import type { Asset, AssetType } from '@/types/asset'
import { CATEGORY_INFO } from '@/lib/data/coinCatalog'
import { ASSET_ID_BY_COINGECKO } from './coingeckoIds'
import type { LiveQuote } from './liveClient'

/**
 * Coins a user added from Coin Discovery, as rows of the Coins table (T-129 A,
 * owner 2026-10-24).
 *
 * Before: each row carried the price and market cap saved the day it was added,
 * in the live column with no label (three saved 2026-06-28; OP's about 12% below
 * CoinGecko's on 2026-10-24); it skipped the type filter; and every kind but
 * stablecoin and DeFi was filed as Layer 1, OP included.
 *
 * Now: the figures come only from the live quote, fetched in the catalog's own
 * request; a coin with none shows no price, never the saved one. The rows go
 * into the list BEFORE search, type, screener, sort and paging, like any catalog
 * coin. A kind the four types do not name is `other`, with its Coin Discovery
 * category as its label ("Layer 2"), so it matches no type chip.
 */
export interface AddedCoinRef {
  cgId: string
  symbol: string
  name: string
  category: string
  addedAt: string
  notes: string
}

const TYPE_BY_CATEGORY: Readonly<Record<string, AssetType>> = {
  stablecoin: 'stablecoin',
  defi: 'defi',
  layer1: 'layer1',
}

export function buildAddedCoinAssets(
  refs: readonly AddedCoinRef[],
  extraQuotes: Readonly<Record<string, LiveQuote>> = {},
): Asset[] {
  const seen = new Set<string>()
  const out: Asset[] = []
  for (const coin of refs) {
    // A catalog coin is already a row; one added twice is one row.
    if (ASSET_ID_BY_COINGECKO[coin.cgId] || seen.has(coin.cgId)) continue
    seen.add(coin.cgId)
    const q = extraQuotes[coin.cgId]
    const assetType = TYPE_BY_CATEGORY[coin.category] ?? 'other'
    out.push({
      id: coin.cgId,
      symbol: coin.symbol,
      name: coin.name,
      assetType,
      ...(assetType === 'other' ? { typeLabel: (CATEGORY_INFO[coin.category] ?? CATEGORY_INFO.unknown).label } : {}),
      blockchain: 'other',
      contractAddress: '',
      isActive: true,
      price: q?.price ?? null,
      marketCap: q?.marketCap ?? null,
      volume24h: q?.volume24h ?? null,
      priceChange24h: q?.priceChange24h ?? null,
      priceChangePercent24h: q?.priceChange24h ?? null,
      fdv: q?.fdv ?? null,
      priceChange7d: q?.priceChange7d ?? null,
      priceChange30d: q?.priceChange30d ?? null,
      athChangePct: q?.athChangePct ?? null,
      circulatingSupply: q?.circulatingSupply ?? null,
      totalSupply: q?.totalSupply ?? null,
      maxSupply: q?.maxSupply ?? null,
      marketCapRank: q?.marketCapRank ?? null,
      pegDeviation: null,
      reserveRatio: null,
      createdAt: coin.addedAt,
      updatedAt: coin.addedAt,
      coingeckoId: coin.cgId,
      description: coin.notes ? `Added via Coin Discovery: ${coin.notes}` : 'Added via Coin Discovery',
    })
  }
  return out
}
