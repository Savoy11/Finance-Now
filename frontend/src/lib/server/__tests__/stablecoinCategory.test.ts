import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyCoinUtility, fetchStablecoinIndex, STABLECOIN_CATEGORY } from '../stablecoinCategory'

const MAP = { 'usd-coin': { category: 'stablecoin', note: 'Catalog note' } }

describe('classifyCoinUtility (T-129 E)', () => {
  const category = new Set(['resolv-usr', 'stasis-eurs', 'xsgd'])

  it('the catalog entry wins over everything', () => {
    expect(classifyCoinUtility('usd-coin', category, MAP)).toEqual({ category: 'stablecoin', note: 'Catalog note' })
  })

  it('with the category read, membership decides: a non-dollar stablecoin is caught', () => {
    expect(classifyCoinUtility('stasis-eurs', category, MAP)).toEqual({ category: 'stablecoin', note: 'Stablecoin (CoinGecko category)' })
    expect(classifyCoinUtility('xsgd', category, MAP).category).toBe('stablecoin')
  })

  it('with the category read, an id that merely looks like one is not a stablecoin', () => {
    // Ids shaped like the 2026-10-24 walkthrough's mislabels: "stable", "usd" in the id.
    for (const id of ['stable', 'apyusd', 'reusd']) {
      expect(classifyCoinUtility(id, category, MAP).category, id).not.toBe('stablecoin')
    }
  })

  it('without the category, falls back to the id guess, and says it is one', () => {
    expect(classifyCoinUtility('reusd', null, MAP)).toEqual({ category: 'stablecoin', note: 'Stablecoin (heuristic)' })
    expect(classifyCoinUtility('stasis-eurs', null, MAP).category).toBe('unknown')
  })

  it('the DeFi label stays a labelled guess either way', () => {
    expect(classifyCoinUtility('some-swap', category, MAP)).toEqual({ category: 'defi', note: 'DeFi protocol (heuristic)' })
    expect(classifyCoinUtility('some-swap', null, MAP).note).toBe('DeFi protocol (heuristic)')
  })
})

describe('fetchStablecoinIndex', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  it('reads one page of the category and returns its ids', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { calls.push(url); return json([{ id: 'tether' }, { id: 'xsgd' }]) }))
    const idx = await fetchStablecoinIndex()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain(`category=${STABLECOIN_CATEGORY}&`)
    expect([...idx.ids!]).toEqual(['tether', 'xsgd'])
  })

  it('a refusal is reported as unread, never as an empty category', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: { error_message: 'rate limited' } }, 429)))
    const idx = await fetchStablecoinIndex()
    expect(idx.ids).toBeNull()
    expect(idx.error).toMatch(/429/)
  })
})
