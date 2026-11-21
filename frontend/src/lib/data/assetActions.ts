import { CLASS_LABELS, INSTRUMENT_BY_KEY } from './instruments'
import { compareOptionForLink } from './compareUniverse'
import { ASSET_CATALOG } from './assetCatalog'
import { ASSET_ID_BY_COINGECKO } from '@/lib/api/live/coingeckoIds'
import type { AlertInstrumentKind } from '@/store/usePriceAlertStore'

// ─── The asset pages' action row (T-454, D209) ───────────────────────────────
//
// One row at the top of every coin, stock, fund and macro instrument page:
// watch it, set a price alert, compare it, ask the AI. These are its rules,
// pure so they can be tested: which of the four an asset can have, and where
// each one goes. components/markets/AssetActions.tsx draws them.

export type AssetPageKind = 'coin' | 'stock' | 'fund' | 'macro'

/** The asset a page is about, as the action row needs it. */
export interface AssetRef {
  kind: AssetPageKind
  /** The ticker as the page shows it (BTC, AAPL, VOO, GC=F). */
  symbol: string
  name: string
  /**
   * The instrument key watchlists and prices use: a coin's CoinGecko id, or
   * `sec:SYMBOL` for everything else. Null for a coin the app has no CoinGecko
   * id for, which has no live price either.
   */
  key: string | null
  /** A coin page's catalog id (/assets/[id]), which Compare's coin options carry. */
  assetId?: string
}

const COIN_BY_ASSET_ID = new Map(ASSET_CATALOG.map((a) => [a.id, a]))

/**
 * What the Watchlist page calls a saved key: the instrument list's entry, else
 * a coin in the coin registry by its CoinGecko id. The instrument list holds
 * only the coins Portfolios offers, while every coin page can add its coin
 * (T-454), so without the second lookup most coins would show as "Unknown".
 */
export function describeWatchKey(key: string): { symbol: string; name: string; classLabel: string } | null {
  const inst = INSTRUMENT_BY_KEY[key]
  if (inst) return { symbol: inst.symbol, name: inst.name, classLabel: CLASS_LABELS[inst.class] }
  const assetId = ASSET_ID_BY_COINGECKO[key]
  const coin = assetId ? COIN_BY_ASSET_ID.get(assetId) : undefined
  return coin ? { symbol: coin.symbol, name: coin.name, classLabel: CLASS_LABELS.crypto } : null
}

/**
 * The key to add to a watchlist, or null. Only an instrument the Watchlist page
 * can name (describeWatchKey): anything else would show there as an "Unknown
 * instrument". A coin with no CoinGecko id has no key, and no price either.
 */
export function watchKeyFor(asset: AssetRef): string | null {
  return asset.key && describeWatchKey(asset.key) ? asset.key : null
}

/** Why an asset cannot be watched, for the disabled button. */
export const NOT_WATCHABLE_NOTE =
  'Watchlists hold the coins, stocks, funds and macro instruments in the app’s catalogs, and this one is not in them yet.'

/**
 * What a price alert watches, in the terms the alert monitor reads: a coin by
 * its CoinGecko id, a stock or fund by its ticker. Null for macro instruments,
 * whose quotes are mostly unserved and whose units are not dollars (grains in
 * cents, yields in percent), while an alert is typed and worded in dollars.
 */
export function alertTargetFor(asset: AssetRef): { kind: AlertInstrumentKind; target: string } | null {
  if (asset.kind === 'macro') return null
  if (asset.kind === 'coin') return asset.key ? { kind: 'crypto', target: asset.key } : null
  return { kind: 'security', target: asset.symbol.toUpperCase() }
}

/** The asset's own page, so a list of alerts can link back to it. */
export function assetPageHref(asset: AssetRef): string {
  const sym = encodeURIComponent(asset.symbol.toLowerCase())
  if (asset.kind === 'coin') return `/assets/${encodeURIComponent(asset.assetId ?? asset.symbol.toLowerCase())}`
  if (asset.kind === 'stock') return `/equities/${sym}`
  if (asset.kind === 'fund') return `/funds/${sym}`
  return asset.key ? INSTRUMENT_BY_KEY[asset.key]?.detailPath ?? '/macro' : '/macro'
}

/**
 * A link that opens Compare with this asset chosen, or null when Compare would
 * open something else. Compare reads a symbol in its address against its own
 * catalogs, first match wins (compareUniverse.ts), and treats a symbol none of
 * them knows as a stock. So a coin or fund outside the catalogs, or a symbol a
 * different catalog asset already uses, would open as the wrong thing.
 */
export function compareHrefFor(asset: AssetRef): string | null {
  const opt = compareOptionForLink(asset.symbol)
  const same =
    asset.kind === 'coin' ? opt.kind === 'crypto' && opt.id === asset.assetId
      : asset.kind === 'stock' ? opt.kind === 'stock'
        : asset.kind === 'fund' ? opt.kind === 'fund'
          : opt.kind === 'macro'
  return same ? `/compare?symbols=${encodeURIComponent(opt.symbol)}` : null
}

/** Why Compare cannot be opened on this asset, for the disabled button. */
export function notComparableNote(asset: AssetRef): string {
  return `Compare cannot open ${asset.symbol} from a link: it would read the symbol as a different asset. Open Compare and search for it there.`
}

/**
 * A link to Research with this asset's module agent and a question about it
 * already typed. The question asks what the asset is and how it has moved, with
 * its risks, and never what to do with it; the reader still presses Run.
 * A stock keeps the link its page already had, which Research turns into the
 * equity agent's own question.
 */
export function askAiHrefFor(asset: AssetRef): string {
  const label = asset.name && asset.name !== asset.symbol ? `${asset.name} (${asset.symbol})` : asset.symbol
  if (asset.kind === 'stock') return `/research?symbol=${encodeURIComponent(asset.symbol)}`
  const [market, task] =
    asset.kind === 'coin'
      ? ['crypto', `Research ${label}: what the project does, how its price and trading volume have moved recently, the latest news about it, and the main risks to know about.`]
      : asset.kind === 'fund'
        ? ['equities', `Research the fund ${label}: what it holds, what it costs, how its price has moved, the latest news about it, and the main risks to know about.`]
        : ['macro', `Research ${label}: how it has moved recently, what the news says is driving it, and what to watch next.`]
  return `/research?market=${market}&task=${encodeURIComponent(task)}`
}

/** A typed alert price, or null when it is not a usable one. */
export function parseAlertPrice(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!/^\d*\.?\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}
