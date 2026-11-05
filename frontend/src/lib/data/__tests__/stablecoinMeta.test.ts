import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ATTESTATION_META,
  COMPOSITION_MAP,
  DEFILLAMA_STABLECOINS,
  MONITORED_STABLECOINS,
  pickMonitoredStablecoins,
} from '../stablecoinMeta'

// Entries copied from DefiLlama's stablecoin list on 2026-11-05 (ids, CoinGecko
// ids and rounded supply), including the lookalikes that share a ticker.
const LLAMA = [
  { id: '1', symbol: 'USDT', name: 'Tether', gecko_id: 'tether', supply: 177_735_663_849 },
  { id: '2', symbol: 'USDC', name: 'USD Coin', gecko_id: 'usd-coin', supply: 71_120_900_699 },
  { id: '5', symbol: 'DAI', name: 'Dai', gecko_id: 'dai', supply: 4_719_782_272 },
  { id: '120', symbol: 'PYUSD', name: 'PayPal USD', gecko_id: 'paypal-usd', supply: 2_674_641_539 },
  { id: '7', symbol: 'TUSD', name: 'TrueUSD', gecko_id: 'true-usd', supply: 483_675_110 },
  { id: '306', symbol: 'GUSD', name: 'Gate USD', gecko_id: 'gusd', supply: 319_290_774 },
  { id: '6', symbol: 'FRAX', name: 'Frax', gecko_id: 'frax', supply: 145_241_449 },
  { id: '235', symbol: 'FRXUSD', name: 'Frax USD', gecko_id: 'frax-usd', supply: 94_898_684 },
  { id: '19', symbol: 'GUSD', name: 'Gemini Dollar', gecko_id: 'gemini-dollar', supply: 35_299_282 },
  { id: '8', symbol: 'LUSD', name: 'Liquity USD', gecko_id: 'liquity-usd', supply: 24_104_079 },
  { id: '11', symbol: 'USDP', name: 'Pax Dollar', gecko_id: 'paxos-standard', supply: 22_432_642 },
  { id: '291', symbol: 'USDp', name: 'Parallel USDp', gecko_id: 'parallel-usdp', supply: 845_575 },
  { id: '33', symbol: 'USDP', name: 'USDP Stablecoin', gecko_id: null, supply: 146 },
]

describe('pickMonitoredStablecoins', () => {
  it('takes Gemini Dollar for GUSD, not the larger Gate USD that shares its ticker', () => {
    // The bug this replaces: the largest coin per ticker won, so the GUSD row
    // showed Gate USD's $319M under Gemini's auditor.
    const { picked } = pickMonitoredStablecoins(LLAMA)
    const gusd = picked.find((p) => p.key === 'GUSD')
    expect(gusd?.coin.name).toBe('Gemini Dollar')
    expect(gusd?.coin.id).toBe('19')
  })

  it('never picks a lookalike that only shares a ticker', () => {
    const { picked } = pickMonitoredStablecoins(LLAMA)
    const names = picked.map((p) => p.coin.name)
    expect(names).not.toContain('Gate USD')
    expect(names).not.toContain('Parallel USDp')
    expect(names).not.toContain('USDP Stablecoin')
    expect(picked).toHaveLength(MONITORED_STABLECOINS.length)
  })

  it('names a monitored coin that is missing, rather than dropping it', () => {
    const { picked, notFound } = pickMonitoredStablecoins(LLAMA.filter((c) => c.id !== '19'))
    expect(picked.find((p) => p.key === 'GUSD')).toBeUndefined()
    expect(notFound).toEqual([{ key: 'GUSD', reason: expect.stringContaining('id 19') }])
  })

  it('refuses an id that now points at a different coin', () => {
    const moved = LLAMA.map((c) => (c.id === '19' ? { ...c, gecko_id: 'gusd' } : c))
    const { picked, notFound } = pickMonitoredStablecoins(moved)
    expect(picked.find((p) => p.key === 'GUSD')).toBeUndefined()
    expect(notFound[0]).toMatchObject({ key: 'GUSD' })
    expect(notFound[0].reason).toContain('gemini-dollar')
  })

  it('accepts numeric ids, which is what a JSON feed may send', () => {
    const numeric = LLAMA.map((c) => ({ ...c, id: Number(c.id) }))
    expect(pickMonitoredStablecoins(numeric).picked).toHaveLength(MONITORED_STABLECOINS.length)
  })
})

describe('the monitored list and its tables agree', () => {
  it('gives every monitored coin a DefiLlama identity, each one distinct', () => {
    const ids = MONITORED_STABLECOINS.map((k) => DEFILLAMA_STABLECOINS[k]?.id)
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keys every issuer table by a monitored coin', () => {
    const monitored = new Set<string>(MONITORED_STABLECOINS)
    for (const key of Object.keys(ATTESTATION_META)) expect(monitored.has(key)).toBe(true)
    for (const key of Object.keys(COMPOSITION_MAP)) expect(monitored.has(key)).toBe(true)
  })
})

describe('what the 2026-11-05 re-check decided (D190)', () => {
  it('shows no ratio where no current source confirms one', () => {
    // DAI's 1.2 was an approximation, LUSD's 1.1 was the per-loan minimum, and
    // TUSD's 1.0 had nothing newer than a Nov 2024 figure at cost. Mutation:
    // put any of them back and this fails.
    for (const key of ['DAI', 'LUSD', 'TUSD', 'FRAX']) {
      expect(ATTESTATION_META[key].collateralizationRatio).toBeNull()
    }
  })

  it('tracks the legacy Frax Dollar and frxUSD as two coins', () => {
    expect(MONITORED_STABLECOINS).toContain('FRAX')
    expect(MONITORED_STABLECOINS).toContain('FRXUSD')
    expect(DEFILLAMA_STABLECOINS.FRAX.geckoId).toBe('frax')
    expect(DEFILLAMA_STABLECOINS.FRXUSD.geckoId).toBe('frax-usd')
  })

  it('never gives the legacy coin frxUSD\'s reserves', () => {
    // Until 2026-11-05 the FRAX row described frxUSD's custodians and a 1.0
    // ratio while showing the legacy coin, which trades near $0.99.
    expect(ATTESTATION_META.FRAX.attester).not.toMatch(/custodian|chaos/i)
    expect(COMPOSITION_MAP.FRAX).toBeUndefined()
  })
})

describe('the alerts feed (D191)', () => {
  const alerts = readFileSync(join(__dirname, '../../../app/live-data/alerts/route.ts'), 'utf8')

  it('watches frxUSD against its peg, not the legacy Frax Dollar', () => {
    // CoinGecko's 'frax' is the legacy coin, which trades near $0.99 with no $1
    // guarantee, so a $1.00 peg check on it was a standing warning. Mutation:
    // put { id: 'frax', … } back and this fails.
    expect(alerts).toMatch(/id:\s*'frax-usd'/)
    expect(alerts).not.toMatch(/id:\s*'frax'\s*,/)
  })
})

describe('the reserves route', () => {
  const route = readFileSync(join(__dirname, '../../../app/live-data/reserves/route.ts'), 'utf8')

  it('picks coins by id, not by ticker', () => {
    expect(route).toContain('pickMonitoredStablecoins(')
    // Matching on an uppercased ticker is the rule that put Gate USD in the
    // GUSD row. Mutation: restore `c.symbol?.toUpperCase()` matching.
    expect(route).not.toMatch(/symbol\?\.toUpperCase\(\)/)
  })

  it('reports the coins it could not find', () => {
    expect(route).toMatch(/notFound/)
  })
})
