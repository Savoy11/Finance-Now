import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DISCOVERY_APY_MAX, plausibleApy, splitPlausiblePools, type RefusedPool } from '@/lib/data/discoveryApy'

// Live Pools' yield bound (2026-10-26). `npm run audit` found Swell's rswETH at 7,530% and
// swETH at 366% on the staking page's Live Pools tab: DefiLlama readings D169 had already kept
// off the staking rates, which this route reads separately.

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const pool = (symbol: string, apy: number): RefusedPool & { tvlUsd: number } =>
  ({ poolId: `p-${symbol}`, source: 'defillama', project: 'x', symbol, chain: 'Ethereum', apy, tvlUsd: 1e7 })

describe('the Live Pools yield bound', () => {
  it('shows a yield above 0 and up to 40%, and nothing else', () => {
    expect(DISCOVERY_APY_MAX).toBe(40)
    for (const ok of [0.1, 3.2, 11.89, 40]) expect(plausibleApy(ok)).toBe(true)
    for (const bad of [0, -1, 40.01, 64.21, 365.63, 7530.09, NaN, Infinity]) expect(plausibleApy(bad)).toBe(false)
  })

  it('names every pool it leaves out, keeping the rest in order', () => {
    const { kept, refused } = splitPlausiblePools([pool('RSWETH', 7530.09), pool('STETH', 2.6), pool('SWETH', 365.63), pool('JITOSOL', 7.1)])
    expect(kept.map((p) => p.symbol)).toEqual(['STETH', 'JITOSOL'])
    expect(refused).toEqual([
      { poolId: 'p-RSWETH', source: 'defillama', project: 'x', symbol: 'RSWETH', chain: 'Ethereum', apy: 7530.09 },
      { poolId: 'p-SWETH', source: 'defillama', project: 'x', symbol: 'SWETH', chain: 'Ethereum', apy: 365.63 },
    ])
  })

  it('matches the staking rates’ DefiLlama bound, so the two staking tabs agree', () => {
    expect(read('src/lib/server/stakingRates.ts')).toMatch(new RegExp(`usableRate\\(raw, ${DISCOVERY_APY_MAX}\\)`))
  })

  it('is applied to every source in the route, before the list is built, and the response names what it left out', () => {
    const route = read('src/app/live-data/staking-discovery/route.ts')
    expect(route).toMatch(/const \{ kept: plausible, refused \} = splitPlausiblePools\(all\)/)
    expect(route).toMatch(/const pools = plausible\.filter/)
    expect(route).toMatch(/^\s*refused:\s+RefusedPool\[\]/m)
    expect(read('src/app/(dashboard)/staking/LivePoolsPanel.tsx')).toMatch(/data\.refused\.length\} left out: yield above \{DISCOVERY_APY_MAX\}%/)
  })

  it('the audit fails on any yield the route should have left out', () => {
    expect(read('scripts/test-live-data.mjs')).toMatch(new RegExp(`a <= 0 \\|\\| a > ${DISCOVERY_APY_MAX}\\)`))
  })
})
