import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchTokenizedSecurityIndex, partitionTokenizedSecurities, TOKENIZED_SECURITY_CATEGORIES,
} from '../tokenizedSecurities'

const coin = (id: string, rank: number) => ({ id, symbol: id.slice(0, 4), name: id, market_cap_rank: rank })

describe('partitionTokenizedSecurities', () => {
  it('moves tokenized securities out and keeps everything else in order', () => {
    const coins = [coin('bitcoin', 1), coin('figure-heloc', 9), coin('ethereum', 2), coin('ondo-us-dollar-yield', 48)]
    const { kept, excluded } = partitionTokenizedSecurities(coins, {
      kinds: { 'figure-heloc': ['tokenized private credit'], 'ondo-us-dollar-yield': ['tokenized Treasury fund'] },
    })
    expect(kept.map((c) => c.id)).toEqual(['bitcoin', 'ethereum'])
    expect(excluded).toEqual([
      { cgId: 'figure-heloc', symbol: 'FIGU', name: 'figure-heloc', marketCapRank: 9, kinds: ['tokenized private credit'] },
      { cgId: 'ondo-us-dollar-yield', symbol: 'ONDO', name: 'ondo-us-dollar-yield', marketCapRank: 48, kinds: ['tokenized Treasury fund'] },
    ])
  })

  it('an empty index leaves the list alone', () => {
    const coins = [coin('bitcoin', 1)]
    expect(partitionTokenizedSecurities(coins, { kinds: {} }).kept).toEqual(coins)
  })
})

describe('the category list', () => {
  const ids: string[] = TOKENIZED_SECURITY_CATEGORIES.map((c) => c.id)

  it('holds only security categories: never the broad parent, metals, commodities or real estate', () => {
    for (const bad of ['tokenized-products', 'tokenized-gold', 'tokenized-silver', 'tokenized-commodities', 'tokenized-btc', 'real-estate', 'tokenized-bank-deposit']) {
      expect(ids, bad).not.toContain(bad)
    }
  })

  it('covers stocks, funds, Treasuries and credit (measured 2026-10-07)', () => {
    for (const must of ['tokenized-stock', 'tokenized-exchange-traded-funds-etfs', 'tokenized-treasuries', 'tokenized-money-market-fund-mmfs', 'tokenized-private-credit']) {
      expect(ids).toContain(must)
    }
  })
})

describe('fetchTokenizedSecurityIndex', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

  it('collects every category, and a token in two categories gets both kinds', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('category=tokenized-treasuries')) return json([{ id: 'buidl' }, { id: 'usdy' }])
      if (url.includes('category=tokenized-money-market-fund-mmfs')) return json([{ id: 'buidl' }])
      return json([])
    }))
    const idx = await fetchTokenizedSecurityIndex()
    expect(idx.checked).toHaveLength(TOKENIZED_SECURITY_CATEGORIES.length)
    expect(idx.failed).toEqual([])
    expect(idx.kinds.buidl).toEqual(['tokenized Treasury fund', 'tokenized money-market fund'])
    expect(idx.kinds.usdy).toEqual(['tokenized Treasury fund'])
  })

  it('stops at a rate limit and says the rest were not tried, rather than hammering', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      if (calls.length === 1) return json([{ id: 'tslax' }])
      return json({ status: { error_message: 'rate limited' } }, 429)
    }))
    const idx = await fetchTokenizedSecurityIndex()
    expect(calls).toHaveLength(2) // the first answered, the second was refused, nothing after
    expect(idx.checked).toEqual([TOKENIZED_SECURITY_CATEGORIES[0].id])
    expect(idx.failed).toHaveLength(TOKENIZED_SECURITY_CATEGORIES.length - 1)
    expect(idx.failed[0]).toMatch(/429/)
    expect(idx.failed.slice(1).every((f) => f.includes('not tried after a rate limit'))).toBe(true)
  })

  it('an unreachable category is reported, not silently treated as empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('category=tokenized-stock&')) throw new Error('ECONNRESET')
      return json([])
    }))
    const idx = await fetchTokenizedSecurityIndex()
    expect(idx.failed).toEqual([expect.stringContaining('tokenized-stock: page 1: ECONNRESET')])
    expect(idx.checked).not.toContain('tokenized-stock')
  })
})
