import { afterEach, describe, expect, it, vi } from 'vitest'

// Code audit 2026-11-09 (D214): a stablecoin DefiLlama sends with no price used to reach the AI's
// reserves tool as a live $1.00, 0 bps from its peg, because the reserves route filled in 1. The
// route now sends null and the tool says there is no price.

afterEach(() => { vi.unstubAllGlobals() })

describe('a stablecoin with no DefiLlama price', () => {
  it('reaches the reserves tool as no price, never as $1.00 on its peg', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ peggedAssets: [
      { id: '2', gecko_id: 'usd-coin', name: 'USD Coin', symbol: 'USDC', pegType: 'peggedUSD', pegMechanism: 'fiat-backed', price: null, circulating: { peggedUSD: 7.5e10 } },
      { id: '1', gecko_id: 'tether', name: 'Tether', symbol: 'USDT', pegType: 'peggedUSD', pegMechanism: 'fiat-backed', price: 0.9991, circulating: { peggedUSD: 1.8e11 } },
    ] }))))
    const { GET } = await import('@/app/live-data/reserves/route')
    const j = await (await GET()).json()
    const usdc = j.assets.find((a: { symbol: string }) => a.symbol === 'USDC')
    const usdt = j.assets.find((a: { symbol: string }) => a.symbol === 'USDT')
    expect(usdc.price).toBeNull()
    expect(usdt.price).toBe(0.9991)

    const { stablecoinReserves } = await import('@/lib/agents/tools')
    const out = stablecoinReserves(j.assets, j.notFound, j.metaAsOf ?? null, null) as { coins: Array<Record<string, unknown>> }
    const byId = Object.fromEntries(out.coins.map((c) => [c.symbol, c]))
    expect(byId.USDC).toMatchObject({ priceUsd: null, pegDeviationBps: null })
    expect(byId.USDT).toMatchObject({ priceUsd: 0.9991, pegDeviationBps: -9 })
  })
})
