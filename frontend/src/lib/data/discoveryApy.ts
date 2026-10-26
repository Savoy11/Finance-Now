// The yield a Live Pools row may show (staking page, /live-data/staking-discovery).
//
// Found 2026-10-26 by `npm run audit`: the tab showed Swell's rswETH at 7,530% and swETH at
// 366%, both DefiLlama readings that had gone wrong. D169 (2026-10-25) had already stopped
// the same reading on the staking rates, whose DefiLlama collector refuses anything above
// 40% (`usableRate(raw, 40)` in lib/server/stakingRates.ts), but this route reads DefiLlama
// on its own and had no bound; only its Beefy leg dropped values above 300%.
//
// A staking yield above 40% is not a staking yield: it is a broken reading, or a pool paid in
// reward tokens that the tab is not about. So every source here keeps the same bound as the
// staking rates, and a pool above it is left out and NAMED in the response's `refused`, never
// dropped silently, so the page and the audit can say what was left out.

/** The highest yield, in percent, a Live Pools row may show. Equal to the staking rates' DefiLlama bound. */
export const DISCOVERY_APY_MAX = 40

export interface RefusedPool {
  poolId: string
  source: string
  project: string
  symbol: string
  chain: string
  apy: number
}

/** A reading worth showing: finite, above zero, and no higher than `max`. */
export function plausibleApy(apy: number, max = DISCOVERY_APY_MAX): boolean {
  return Number.isFinite(apy) && apy > 0 && apy <= max
}

/** Splits pools into those shown and those refused, keeping the order of each. */
export function splitPlausiblePools<T extends RefusedPool>(pools: readonly T[], max = DISCOVERY_APY_MAX): { kept: T[]; refused: RefusedPool[] } {
  const kept: T[] = []
  const refused: RefusedPool[] = []
  for (const p of pools) {
    if (plausibleApy(p.apy, max)) kept.push(p)
    else refused.push({ poolId: p.poolId, source: p.source, project: p.project, symbol: p.symbol, chain: p.chain, apy: p.apy })
  }
  return { kept, refused }
}
