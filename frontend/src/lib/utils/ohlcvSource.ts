/**
 * Provenance label for a crypto OHLCV series.
 *
 * `/live-data/ohlcv` returns a provider-family `source` ('binance' |
 * 'coingecko') plus, on the Binance rung, a `venue` recording which host
 * actually answered. api.binance.com is geo-blocked (451) from some regions, so
 * a flat "Binance" label hid the fact that the candles came from the Binance.US
 * mirror instead — a separate venue with its own liquidity and therefore its own
 * prices. Anyone comparing these candles against a Binance.com reference needs
 * to know which one they got.
 */
export function ohlcvSourceLabel(source?: string, venue?: string): string | undefined {
  if (source === 'binance') {
    if (venue === 'binance-us') return 'Binance.US'
    if (venue === 'binance-com') return 'Binance'
    // Older cached responses predate the `venue` field. Naming the family
    // without claiming a venue is honest; asserting 'Binance' would not be.
    return 'Binance'
  }
  if (source === 'coingecko') return 'CoinGecko'
  return undefined
}
