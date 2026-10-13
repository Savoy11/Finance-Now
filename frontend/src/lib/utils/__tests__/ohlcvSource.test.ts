import { describe, expect, it } from 'vitest'
import { ohlcvSourceLabel } from '../ohlcvSource'

describe('ohlcvSourceLabel', () => {
  it('labels the two launch sources', () => {
    expect(ohlcvSourceLabel('coingecko')).toBe('CoinGecko')
    expect(ohlcvSourceLabel('defillama')).toBe('DefiLlama')
  })

  it('no longer names Binance: the rung is gone, and a stale key gets no label (T-423)', () => {
    expect(ohlcvSourceLabel('binance')).toBeUndefined()
  })

  it('returns undefined for an unknown or missing source', () => {
    expect(ohlcvSourceLabel(undefined)).toBeUndefined()
    expect(ohlcvSourceLabel('somewhere-else')).toBeUndefined()
  })
})
