import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFI_PROTOCOL_BY_COIN, DEFI_PROTOCOL_UNMAPPED,
  coinProtocolFromFeed, combineProtocol, entriesForCoin, type LlamaProtocolEntry,
} from '../defiProtocols'
import { ASSET_CATALOG } from '../assetCatalog'

// T-469 (D242): the figure is the SUM of the protocol's parts, matched by a
// hand-kept map (D190 — never a name or ticker), and the fixture is a dated
// excerpt of the REAL feed (api.llama.fi/protocols, read 2026-11-24 through
// the route's own path), so the map is held against what DefiLlama actually
// publishes, not against what anyone remembers.

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/llama-protocols-2026-11-24.json'), 'utf8')) as {
  readOn: string
  entries: LlamaProtocolEntry[]
}

const entry = (over: Partial<LlamaProtocolEntry>): LlamaProtocolEntry => ({
  name: 'X', slug: 'x', tvl: 100, change_1d: 0, change_7d: 0, category: 'Lending', parentProtocol: null, gecko_id: null, ...over,
})

describe('the map covers the catalog, decided both ways', () => {
  const defiCoins = ASSET_CATALOG.filter((a) => a.assetType === 'defi').map((a) => a.id).sort()

  it('every catalog DeFi coin is mapped or deliberately unmapped with a reason — never silently absent', () => {
    const decided = [...Object.keys(DEFI_PROTOCOL_BY_COIN), ...Object.keys(DEFI_PROTOCOL_UNMAPPED)].sort()
    expect(decided).toEqual(defiCoins)
    for (const reason of Object.values(DEFI_PROTOCOL_UNMAPPED)) expect(reason.length).toBeGreaterThan(20)
  })

  it('no coin is both mapped and unmapped, and each mapping names parent XOR slug', () => {
    for (const id of Object.keys(DEFI_PROTOCOL_BY_COIN)) expect(DEFI_PROTOCOL_UNMAPPED[id]).toBeUndefined()
    for (const m of Object.values(DEFI_PROTOCOL_BY_COIN)) expect(Boolean(m.parent) !== Boolean(m.slug)).toBe(true)
  })
})

describe('the map against the real feed (fixture read 2026-11-24)', () => {
  // The parts each protocol had that day — the dated record. Runtime grouping
  // is by parent id, so a new version joins without a code change; this pin is
  // about the MAP pointing at the right protocol.
  const expectedSlugs: Record<string, string[]> = {
    uni: ['uniswap-v1', 'uniswap-v2', 'uniswap-v3', 'uniswap-v4'],
    aave: ['aave-aptos', 'aave-arc', 'aave-horizon-rwa', 'aave-v1', 'aave-v2', 'aave-v3', 'aave-v4'],
    mkr: ['sky-lending', 'sky-money', 'sky-rwa'],
    crv: ['crv-usd', 'crvusd', 'curve-dex', 'curve-llamalend', 'curve-llamalend-v2'].filter((s) => fixture.entries.some((e) => e.slug === s)),
    ldo: ['lido'],
  }

  it('selects each protocol’s own parts and nothing else', () => {
    for (const [coin, slugs] of Object.entries(expectedSlugs)) {
      const picked = entriesForCoin(coin, fixture.entries)
        .filter((e) => (e.tvl ?? 0) > 0)
        .map((e) => e.slug).sort()
      expect(picked, coin).toEqual(slugs.sort())
    }
  })

  it('never picks by name or symbol: an unrelated big entry is untouched, an unmapped coin gets nothing', () => {
    const binance = fixture.entries.find((e) => e.slug === 'binance-cex')!
    expect(binance.tvl).toBeGreaterThan(0)
    for (const coin of Object.keys(DEFI_PROTOCOL_BY_COIN)) {
      expect(entriesForCoin(coin, fixture.entries).some((e) => e.slug === 'binance-cex'), coin).toBe(false)
    }
    expect(entriesForCoin('grt', fixture.entries)).toEqual([])
    expect(coinProtocolFromFeed('grt', fixture.entries)).toBeNull()
  })

  it('the figure is the exact sum of the parts, with the biggest part naming the kind', () => {
    const aave = coinProtocolFromFeed('aave', fixture.entries)!
    const parts = entriesForCoin('aave', fixture.entries).filter((e) => (e.tvl ?? 0) > 0)
    expect(aave.tvl).toBeCloseTo(parts.reduce((s, p) => s + (p.tvl ?? 0), 0), 2)
    expect(aave.parts).toBe(parts.length)
    expect(aave.category).toBe('Lending')
    const ldo = coinProtocolFromFeed('ldo', fixture.entries)!
    expect(ldo.parts).toBe(1)
    expect(ldo.category).toBe('Liquid Staking')
  })

  it('snx is deliberately unmapped: the feed’s current Synthetix versions carry almost nothing', () => {
    // The reason the proposal’s sixth coin is out: v1+v2 read zero in the real
    // feed, so a figure would misstate the protocol. If DefiLlama starts
    // carrying it again, remap it on a fresh fixture — this documents why not.
    expect(DEFI_PROTOCOL_UNMAPPED.snx).toMatch(/v1\+v2 entry reports none/)
    const synthetix = fixture.entries.filter((e) => e.parentProtocol === 'parent#synthetix')
    expect(synthetix.find((e) => e.slug === 'synthetix-v1+v2')!.tvl).toBeNull()
    // And what the current versions do carry is under a million dollars.
    const carried = synthetix.reduce((s, e) => s + (e.tvl ?? 0), 0)
    expect(carried).toBeLessThan(1_000_000)
  })
})

describe('combineProtocol arithmetic', () => {
  it('combines each part’s change through its own prior value', () => {
    // 100 @ +10% and 300 @ −5%: prior = 100/1.1 + 300/0.95 = 406.698…,
    // so the whole moved (400 / 406.698 − 1) = −1.647%.
    const p = combineProtocol('X', [
      entry({ slug: 'a', tvl: 100, change_1d: 10 }),
      entry({ slug: 'b', tvl: 300, change_1d: -5 }),
    ])!
    expect(p.tvl).toBe(400)
    expect(p.change24hPct).toBeCloseTo(-1.6469, 3)
  })

  it('a window with any counted part missing its figure shows nothing — never a shrunken base', () => {
    const p = combineProtocol('X', [
      entry({ slug: 'a', tvl: 100, change_1d: 10, change_7d: null }),
      entry({ slug: 'b', tvl: 300, change_1d: -5, change_7d: 2 }),
    ])!
    expect(p.change24hPct).not.toBeNull()
    expect(p.change7dPct).toBeNull()
  })

  it('a change at or below −100% voids the window rather than dividing by nothing', () => {
    const p = combineProtocol('X', [entry({ slug: 'a', tvl: 100, change_1d: -100 })])!
    expect(p.change24hPct).toBeNull()
  })

  it('zero-value parts are left out of the sum, the count and the change', () => {
    const p = combineProtocol('X', [
      entry({ slug: 'a', tvl: 100, change_1d: 2 }),
      entry({ slug: 'dead', tvl: 0, change_1d: null }),
    ])!
    expect(p.parts).toBe(1)
    expect(p.change24hPct).toBeCloseTo(2, 6)
    expect(combineProtocol('X', [entry({ slug: 'dead', tvl: 0 })])).toBeNull()
  })
})

describe('the wiring', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')

  it('the route answers ?coin= through the map and leaves the panel’s response alone', () => {
    const route = read('../../../app/live-data/defi-tvl/route.ts')
    expect(route).toContain("searchParams.get('coin')")
    expect(route).toContain('coinProtocolFromFeed(')
    expect(route).toContain('satisfies DefiTvlData') // the original shape still served
  })

  it('the coin page mounts the card, and the card fetches only for mapped coins', () => {
    const page = read('../../../app/(dashboard)/assets/[id]/page.tsx')
    expect(page).toContain('<CoinProtocolCard assetId={asset.id} symbol={asset.symbol} />')
    const card = read('../../../components/assets/CoinProtocolCard.tsx')
    expect(card).toMatch(/enabled: mapped/)
    expect(card).toContain('protocolNotTokenLine(')
  })
})
