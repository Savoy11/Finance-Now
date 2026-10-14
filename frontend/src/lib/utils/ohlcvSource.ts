/**
 * Provenance label for a crypto OHLCV series.
 *
 * `/live-data/ohlcv` returns a provider key in `source`: 'coingecko' for candles,
 * 'defillama' for closing prices, and 'coinmetrics' for closing prices when
 * DefiLlama did not answer (T-434, D108). Until 2026-10-13 it could also be 'binance',
 * with a `venue` saying whether Binance.com or the Binance.US mirror answered;
 * that rung came out under T-423 (D102, D103), and an unknown key gets no label
 * rather than a guess.
 */
export function ohlcvSourceLabel(source?: string): string | undefined {
  if (source === 'coingecko') return 'CoinGecko'
  if (source === 'defillama') return 'DefiLlama'
  if (source === 'coinmetrics') return 'Coin Metrics'
  return undefined
}
