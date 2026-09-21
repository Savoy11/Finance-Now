/**
 * Provenance label for the crypto market-quote ladder.
 *
 * `/live-data/markets` walks CoinGecko → Binance → CoinMarketCap and reports
 * which rung actually answered, suffixing `-fallback` when it was not the first
 * choice (`markets/route.ts`: `source: i === 0 ? src : \`${src}-fallback\``).
 *
 * The Coins page named CoinGecko unconditionally, so a reader could not tell a
 * CoinGecko response from a CoinMarketCap one — the same defect as the crypto TA
 * badge naming "Binance" for candles the Binance.US mirror served. Different
 * venues quote differently; a page that fixes the provider name in prose is
 * making a provenance claim the response may not support.
 *
 * Returns a display name, marking a fallback rung as such, and falls back to a
 * neutral phrase rather than naming a provider it cannot confirm.
 */
const NAMES: Record<string, string> = {
  coingecko: 'CoinGecko',
  binance: 'Binance',
  coinmarketcap: 'CoinMarketCap',
}

export function marketsSourceLabel(source?: string): string {
  if (!source) return 'the configured provider'

  const fallback = source.endsWith('-fallback')
  const key = fallback ? source.slice(0, -'-fallback'.length) : source
  const name = NAMES[key]

  // An unrecognised rung is named verbatim rather than guessed at or hidden —
  // a new provider should read as itself the day it is added, not as CoinGecko.
  if (!name) return fallback ? `${key} (fallback)` : key

  return fallback ? `${name} (fallback)` : name
}
