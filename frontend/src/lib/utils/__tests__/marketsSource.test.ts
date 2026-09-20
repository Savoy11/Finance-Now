import { describe, it, expect } from 'vitest'
import { marketsSourceLabel } from '../marketsSource'

/**
 * The Coins page said "live prices via CoinGecko" unconditionally while
 * /live-data/markets ladders CoinGecko → Binance → CoinMarketCap and reports
 * which rung answered. These assertions are what stops that regressing: each
 * one fails if the label stops tracking the response's own `source` field.
 */
describe('marketsSourceLabel', () => {
  it('names each rung of the ladder', () => {
    expect(marketsSourceLabel('coingecko')).toBe('CoinGecko')
    expect(marketsSourceLabel('binance')).toBe('Binance')
    expect(marketsSourceLabel('coinmarketcap')).toBe('CoinMarketCap')
  })

  it('marks a fallback rung as a fallback', () => {
    // The route suffixes `-fallback` whenever the first choice failed. Hiding
    // that would restate the original bug in a subtler form: the reader would
    // see a correct provider name and still not know it was the second choice.
    expect(marketsSourceLabel('binance-fallback')).toBe('Binance (fallback)')
    expect(marketsSourceLabel('coinmarketcap-fallback')).toBe('CoinMarketCap (fallback)')
  })

  it('never claims a provider it cannot confirm', () => {
    // Undefined source must not resolve to CoinGecko — naming the most likely
    // provider is exactly the guess this helper exists to remove.
    expect(marketsSourceLabel(undefined)).toBe('the configured provider')
    expect(marketsSourceLabel('')).toBe('the configured provider')
  })

  it('passes an unrecognised rung through verbatim', () => {
    // A provider added to the ladder should read as itself on day one rather
    // than silently inheriting another provider's name.
    expect(marketsSourceLabel('kraken')).toBe('kraken')
    expect(marketsSourceLabel('kraken-fallback')).toBe('kraken (fallback)')
  })
})
