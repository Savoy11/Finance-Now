import { describe, expect, it } from 'vitest'
import { ohlcvSourceLabel } from '../ohlcvSource'

describe('ohlcvSourceLabel', () => {
  it('names the venue that actually answered, not the family', () => {
    expect(ohlcvSourceLabel('binance', 'binance-us')).toBe('Binance.US')
    expect(ohlcvSourceLabel('binance', 'binance-com')).toBe('Binance')
  })

  it('falls back to the family when a cached response carries no venue', () => {
    expect(ohlcvSourceLabel('binance')).toBe('Binance')
  })

  it('labels the CoinGecko rung', () => {
    expect(ohlcvSourceLabel('coingecko')).toBe('CoinGecko')
  })

  it('returns undefined for an unknown or missing source', () => {
    expect(ohlcvSourceLabel(undefined)).toBeUndefined()
    expect(ohlcvSourceLabel('somewhere-else')).toBeUndefined()
  })
})
