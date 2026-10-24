import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAddedCoinAssets, type AddedCoinRef } from '../live/addedCoins'
import { parseExtraIds, MAX_EXTRA_IDS } from '../live/marketsExtra'
import { ALL_COINGECKO_IDS } from '../live/coingeckoIds'
import { assetsApi } from '../assets'
import type { LiveQuote } from '../live/liveClient'

// T-129 A (owner, 2026-10-24): coins added from Coin Discovery show live prices
// or none, never the figure saved the day they were added, and go through the
// type filter like any coin. A Layer 2 is no longer filed as Layer 1.

const ref = (cgId: string, category: string, symbol = cgId.slice(0, 3).toUpperCase()): AddedCoinRef =>
  ({ cgId, symbol, name: cgId, category, addedAt: '2026-06-28T00:00:00Z', notes: '' })

const quote = (price: number): LiveQuote =>
  ({ price, marketCap: price * 1e9, volume24h: 1e8, priceChange24h: 2.5, circulatingSupply: 1e9, marketCapRank: 40 })

describe('buildAddedCoinAssets', () => {
  it('takes every figure from the live quote', () => {
    const [op] = buildAddedCoinAssets([ref('optimism', 'layer2', 'OP')], { optimism: quote(1.9) })
    expect(op.price).toBe(1.9)
    expect(op.marketCap).toBe(1.9e9)
    expect(op.priceChangePercent24h).toBe(2.5)
    expect(op.marketCapRank).toBe(40)
  })

  it('a coin with no live quote shows no price, not a saved one', () => {
    const [c] = buildAddedCoinAssets([ref('some-coin', 'meme')], {})
    expect(c.price).toBeNull()
    expect(c.marketCap).toBeNull()
  })

  it('files a kind the four types do not name as other, labelled with its category', () => {
    const [op, meme, usds, uni, sol] = buildAddedCoinAssets([
      ref('optimism', 'layer2'), ref('a-meme', 'meme'), ref('usds', 'stablecoin'), ref('a-dex', 'defi'), ref('an-l1', 'layer1'),
    ])
    expect([op.assetType, op.typeLabel]).toEqual(['other', 'Layer 2'])
    expect([meme.assetType, meme.typeLabel]).toEqual(['other', 'Meme / Community'])
    expect([usds.assetType, usds.typeLabel]).toEqual(['stablecoin', undefined])
    expect(uni.assetType).toBe('defi')
    expect(sol.assetType).toBe('layer1')
  })

  it('skips a coin the catalog already lists, and one added twice is one row', () => {
    const inCatalog = ALL_COINGECKO_IDS[0]
    const rows = buildAddedCoinAssets([ref(inCatalog, 'layer1'), ref('optimism', 'layer2'), ref('optimism', 'layer2')])
    expect(rows.map((r) => r.id)).toEqual(['optimism'])
  })
})

describe('parseExtraIds', () => {
  it('keeps CoinGecko-shaped ids not in the catalog, once each', () => {
    expect(parseExtraIds(`optimism,OPTIMISM,${ALL_COINGECKO_IDS[0]},bad id,x&y=1,usds`)).toEqual(['optimism', 'usds'])
  })

  it('never asks for more than fit beside the catalog on one 250-coin page', () => {
    const many = Array.from({ length: 300 }, (_, i) => `coin-${i}`).join(',')
    const ids = parseExtraIds(many)
    expect(ids.length).toBe(Math.min(MAX_EXTRA_IDS, 250 - ALL_COINGECKO_IDS.length))
    expect(parseExtraIds(many, Array.from({ length: 250 }, (_, i) => `c${i}`))).toEqual([])
  })

  it('nothing asked, nothing kept', () => {
    expect(parseExtraIds(null)).toEqual([])
    expect(parseExtraIds('')).toEqual([])
  })
})

describe('getAssets with added coins', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('prices them in the catalog request and filters them like any coin', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({
        ok: true, updatedAt: '2026-10-24T00:00:00Z', source: 'coingecko',
        quotes: {}, extraQuotes: { optimism: quote(1.9) },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const added = [ref('optimism', 'layer2', 'OP'), ref('usds', 'stablecoin', 'USDS')]

    const all = await assetsApi.getAssets({ addedCoins: added, pageSize: 500 })
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('extra=' + encodeURIComponent('optimism,usds'))
    const op = all.data.find((a) => a.id === 'optimism')
    expect(op?.price).toBe(1.9)
    expect(all.data.find((a) => a.id === 'usds')?.price).toBeNull()

    // The Layer 1 chip no longer catches OP; the Stablecoin chip does catch USDS.
    const l1 = await assetsApi.getAssets({ addedCoins: added, assetType: 'layer1', pageSize: 500 })
    expect(l1.data.some((a) => a.id === 'optimism')).toBe(false)
    const stable = await assetsApi.getAssets({ addedCoins: added, assetType: 'stablecoin', pageSize: 500 })
    expect(stable.data.some((a) => a.id === 'usds')).toBe(true)
  })
})
