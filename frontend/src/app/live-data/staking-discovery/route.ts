import { NextRequest, NextResponse } from 'next/server'
import {
  RISK_PRESETS, adjustRiskFromSignals, DEFILLAMA_SLUG_BLOCKLIST,
  ALL_STAKING_SYMBOLS, COIN_SYMBOL_MAP, MATURE_CHAINS,
} from '@/lib/data/stakingDiscovery'
import type { ProviderCategory, RiskProfile } from '@/lib/data/stakingProviders'

export const dynamic = 'force-dynamic'

// ─── Shared output type ───────────────────────────────────────────────────────

export type DiscoverySource = 'defillama' | 'yearn' | 'pendle' | 'beefy'

export interface DiscoveredPool {
  poolId:          string
  project:         string      // Canonical protocol name (used for grouping)
  projectSlug:     string
  opportunityName: string      // Human-readable name for this specific opportunity
  symbol:          string
  chain:           string
  coinId:          string
  tvlUsd:          number
  apy:             number
  apyBase:         number | null
  apyReward:       number | null
  auditCount:      number
  url:             string | null
  projectUrl:      string | null  // Protocol homepage (distinct from opportunity URL)
  category:        ProviderCategory
  custodyModel:    'custodial' | 'non-custodial' | 'smart-contract'
  risks:           RiskProfile
  /**
   * The six curated dimensions the presets and signal adjustments produced.
   *
   * No composite is derived from them. `riskScore`, `riskLevel`, `riskCanonical`
   * and `band` were REMOVED on 2026-09-14 (owner decision D14), along with the
   * `max_risk` filter, on the same reasoning as /api/v1/staking/opportunities:
   * one number ranking pools against each other reads as a verdict on which to
   * pick. Nothing in the UI ever rendered them — the field comment here already
   * said so and said to drop them rather than let them drift, which is what D14
   * settled. Do not reintroduce a composite here.
   */
  hasReceiptToken: boolean
  chainMature:     boolean
  source:          DiscoverySource
}

export interface StakingDiscoveryResponse {
  ok:        boolean
  pools:     DiscoveredPool[]
  total:     number
  sources:   Record<DiscoverySource, number>
  updatedAt: string
  /** True when upstreams failed and this is the last-known-good payload (updatedAt reflects when it was actually fetched). */
  stale?:    boolean
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Upstreams (DefiLlama yields especially) throw transient failures that recover
// on immediate retry. Every fetcher goes through this: one retry after a short
// backoff, and a persistent failure THROWS so the handler can tell "upstream
// down" apart from "legitimately no matching pools".
const RETRY_DELAY_MS = 400

/**
 * Per-request timeout budget.
 *
 * This route fans out to four upstreams in parallel, so the response is gated by
 * the SLOWEST of them — and with no timeout, "slowest" had no upper bound at
 * all. It was measured at 18-22 s (DATA-AVAILABILITY, standing perf item). Six
 * seconds is generous for a JSON list endpoint and short enough that a wedged
 * upstream costs the page one slot instead of the whole response: the fan-out is
 * `allSettled`, so a timed-out leg drops its pools and the other three still
 * serve.
 */
const UPSTREAM_TIMEOUT_MS = 6_000

/**
 * A TIMEOUT is not retried, unlike a transient error.
 *
 * The retry exists for the failures the comment above describes — upstreams that
 * throw and then immediately succeed. A timeout says the upstream is slow, and
 * retrying a slow upstream buys the same likely answer for twice the wait, which
 * is exactly the cost this budget exists to remove. Worst case is therefore
 * ~6 s for a hanging upstream rather than ~12.4 s.
 */
function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
}

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as T
    } catch (err) {
      if (attempt >= 1) throw err
      if (isTimeout(err)) {
        throw new Error(`upstream did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s: ${url}`)
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

// Last-known-good payloads per filter combination, served (marked stale) when
// an upstream is down and the live result came back empty. In-memory is fine:
// single-instance app, and the cache repopulates on the first healthy fetch.
const lastGood = new Map<string, { response: StakingDiscoveryResponse; cachedAt: number }>()
const LAST_GOOD_TTL_MS = 6 * 3_600_000
const LAST_GOOD_MAX_ENTRIES = 20

function symbolToCoinId(symbol: string): string | null {
  const base = symbol.split('-')[0].split('/')[0].toUpperCase()
  for (const [coinId, symbols] of Object.entries(COIN_SYMBOL_MAP)) {
    if (symbols.some(s => base.startsWith(s))) return coinId
  }
  return null
}

function hasReceiptToken(symbol: string): boolean {
  return /^(st|r[A-Z]|j[A-Z]|m[A-Z]|b[A-Z]|an[A-Z]|s[A-Z]{2})/.test(symbol) && symbol.length > 3
}

function buildPool(
  partial: {
    poolId: string; project: string; opportunityName: string; symbol: string; chain: string;
    coinId: string; tvlUsd: number; apy: number; apyBase?: number | null;
    apyReward?: number | null; auditCount?: number; url?: string | null;
    projectUrl?: string | null; category: ProviderCategory; source: DiscoverySource;
  },
): DiscoveredPool {
  const chainMature  = MATURE_CHAINS.has(partial.chain)
  const receipt      = hasReceiptToken(partial.symbol)
  const auditCount   = partial.auditCount ?? 0
  const custodyModel = partial.category === 'cefi' ? 'custodial' : partial.category === 'wallet' ? 'non-custodial' : 'smart-contract'
  const risks = adjustRiskFromSignals(RISK_PRESETS[partial.category], {
    tvlUsd: partial.tvlUsd, auditCount,
    isSmartContract: partial.category === 'liquid', chainMature, hasReceiptToken: receipt,
  })
  return {
    poolId:          partial.poolId,
    project:         partial.project,
    projectSlug:     partial.project.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    opportunityName: partial.opportunityName,
    symbol:          partial.symbol,
    chain:           partial.chain,
    coinId:          partial.coinId,
    tvlUsd:          partial.tvlUsd,
    apy:             parseFloat(partial.apy.toFixed(2)),
    apyBase:         partial.apyBase != null ? parseFloat(partial.apyBase.toFixed(2)) : null,
    apyReward:       partial.apyReward != null ? parseFloat(partial.apyReward.toFixed(2)) : null,
    auditCount,
    url:             partial.url ?? null,
    projectUrl:      partial.projectUrl ?? partial.url ?? null,
    category:        partial.category,
    custodyModel,
    risks,
    hasReceiptToken: receipt,
    chainMature,
    source:          partial.source,
  }
}

// ─── DefiLlama ────────────────────────────────────────────────────────────────

interface DLPool {
  pool: string; project: string; symbol: string; chain: string;
  tvlUsd: number; apy: number; apyBase: number | null; apyReward: number | null;
  stablecoin: boolean; ilRisk: string | null; audits: string | null;
  category: string | null; url: string | null;
}

async function fetchDefiLlama(minTvl: number, minApy: number, coinFilter: string | null): Promise<DiscoveredPool[]> {
  const json = await getJson<{ data?: DLPool[] }>('https://yields.llama.fi/pools', 1800)
  const raw  = json.data ?? []
  const pools: DiscoveredPool[] = []

  for (const p of raw) {
    const baseSymbol = p.symbol.split('-')[0].split('/')[0].toUpperCase()
    if (!ALL_STAKING_SYMBOLS.has(baseSymbol)) continue
    if (DEFILLAMA_SLUG_BLOCKLIST.has(p.project.toLowerCase())) continue
    if (p.stablecoin || p.ilRisk === 'yes') continue
    if (p.tvlUsd < minTvl || (p.apy ?? 0) < minApy) continue
    const coinId = symbolToCoinId(baseSymbol)
    if (!coinId || (coinFilter && coinId !== coinFilter)) continue
    const category: ProviderCategory =
      (p.category ?? '').toLowerCase().includes('cefi') ? 'cefi' : 'liquid'
    const auditCount = p.audits ? (parseInt(p.audits, 10) || 0) : 0
    const pool = buildPool({
      poolId: p.pool, project: p.project,
      opportunityName: `${baseSymbol} on ${p.chain}`,
      symbol: p.symbol, chain: p.chain,
      coinId, tvlUsd: p.tvlUsd, apy: p.apy ?? 0,
      apyBase: p.apyBase, apyReward: p.apyReward,
      auditCount, url: p.url, projectUrl: p.url,
      category, source: 'defillama',
    })
    pools.push(pool)
  }
  return pools
}

// ─── Yearn Finance ────────────────────────────────────────────────────────────
// Endpoint: https://api.yearn.finance/v1/chains/1/vaults/all
// Returns ETH-chain vaults with net APY and TVL.

interface YearnVault {
  address:  string
  name:     string
  symbol:   string
  endorsed: boolean
  type:     string
  token:    { symbol: string; address: string }
  tvl:      { tvl: number } | null
  apy:      { net_apy: number; gross_apr: number } | null
  metadata: { displayName?: string } | null
}

async function fetchYearn(minTvl: number, minApy: number, coinFilter: string | null): Promise<DiscoveredPool[]> {
  const vaults = await getJson<YearnVault[]>('https://api.yearn.finance/v1/chains/1/vaults/all', 1800)
  const pools: DiscoveredPool[] = []

  for (const v of vaults) {
    if (!v.endorsed) continue
    const tvl = v.tvl?.tvl ?? 0
    if (tvl < minTvl) continue
    const netApy = (v.apy?.net_apy ?? 0) * 100
    if (netApy < minApy) continue

    const coinId = symbolToCoinId(v.token.symbol)
    if (!coinId || (coinFilter && coinId !== coinFilter)) continue

    const vaultName = v.metadata?.displayName ?? v.name ?? v.token.symbol
    const pool = buildPool({
      poolId:          `yearn-${v.address}`,
      project:         'Yearn Finance',
      opportunityName: vaultName,
      symbol:          v.token.symbol,
      chain:           'Ethereum',
      coinId, tvlUsd: tvl, apy: netApy,
      apyBase: (v.apy?.gross_apr ?? 0) * 100, apyReward: null,
      auditCount: 3,
      url:        `https://yearn.finance/vaults/1/${v.address}`,
      projectUrl: 'https://yearn.finance',
      category: 'liquid', source: 'yearn',
    })
    pools.push(pool)
  }
  return pools
}

// ─── Pendle Finance ───────────────────────────────────────────────────────────
// Endpoint: https://api-v2.pendle.finance/core/v1/1/markets
// Yield tokenization markets — PT/YT on staked assets like wstETH, rETH, etc.

// ⚠ REPOINTED 2026-09-22 (T-399). The old `/core/v1/sdk/1/markets` path 404s; the host
// was never down. Three things moved with it, and only the first is visible in a diff:
//   1. the path lost its `/sdk` segment;
//   2. `?order_by=liquidity:desc` is now REJECTED with HTTP 400 and had to go;
//   3. `totalLiquidity` (a number) became `liquidity` — AN OBJECT, `{ usd, acc }`.
//
// (3) is the one worth pausing on. A rename-only fix compiles and then silently compares
// an object to a number: `(m.liquidity ?? 0) < minTvl` evaluates `NaN < 1000000`, which is
// `false`, so every market would PASS the liquidity gate. A filter that quietly stops
// filtering. It was caught by measuring the live payload, not by reading the diff.
//
// `isWhitelisted` also split into three flags. `isWhitelistedPro` is used because it is
// the closest analogue to the old single flag — measured 2026-09-22, Pro admitted 100 of
// 100 sampled markets, LimitOrder 95, and Simple a curated 10. Note the choice currently
// changes nothing downstream: all three resolved to ZERO pools before COIN_SYMBOL_MAP was
// widened, and the widening is what actually unblocks this rung.
interface PendleMarket {
  address:         string
  name:            string
  liquidity:       { usd?: number; acc?: number } | null
  impliedApy:      number
  underlyingAsset: { symbol: string; address: string } | null
  pt:              { symbol: string } | null
  yt:              { symbol: string; impliedApy?: number } | null
  isWhitelistedPro: boolean
  expiry:          string | null
}

interface PendleResponse {
  results: PendleMarket[]
  total:   number
}

async function fetchPendle(minTvl: number, minApy: number, coinFilter: string | null): Promise<DiscoveredPool[]> {
  const json = await getJson<PendleResponse>('https://api-v2.pendle.finance/core/v1/1/markets?limit=100', 1800)
  const markets = json.results ?? []
  const pools: DiscoveredPool[] = []

  for (const m of markets) {
    if (!m.isWhitelistedPro) continue
    // `.usd` — see the interface note: this field is an object, not a number.
    if ((m.liquidity?.usd ?? 0) < minTvl) continue

    // Use implied APY (annualized yield) expressed as percentage
    const apy = (m.impliedApy ?? 0) * 100
    if (apy < minApy) continue

    // Underlying asset tells us what's being staked
    const underlying = m.underlyingAsset?.symbol ?? m.pt?.symbol ?? ''
    const coinId = symbolToCoinId(underlying)
    if (!coinId || (coinFilter && coinId !== coinFilter)) continue

    // Skip expired markets
    if (m.expiry && new Date(m.expiry) < new Date()) continue

    const pool = buildPool({
      poolId:          `pendle-${m.address}`,
      project:         'Pendle Finance',
      opportunityName: m.name,
      symbol:          underlying,
      chain:           'Ethereum',
      coinId, tvlUsd: m.liquidity?.usd ?? 0, apy,
      apyBase: apy, apyReward: null,
      auditCount: 2,
      url:        `https://app.pendle.finance/trade/markets/${m.address}`,
      projectUrl: 'https://app.pendle.finance',
      category: 'liquid', source: 'pendle',
    })
    pools.push(pool)
  }
  return pools
}

// ─── Beefy Finance ────────────────────────────────────────────────────────────
// Endpoint: https://api.beefy.finance/vaults + https://api.beefy.finance/apy/breakdown
// Multichain yield optimizer — covers SOL, AVAX, BNB, MATIC chains.

interface BeefyVault {
  id:         string
  name:       string
  token:      string
  chain:      string
  status:     string
  assets:     string[]
  tvl?:       number
  platformId: string
}

interface BeefyApy {
  [vaultId: string]: {
    totalApy?:  number
    vaultApr?:  number
    tradingApr?: number
  } | number
}

const BEEFY_CHAIN_MAP: Record<string, string> = {
  bsc: 'BSC', avax: 'Avalanche', polygon: 'Polygon', arbitrum: 'Arbitrum',
  optimism: 'Optimism', base: 'Base', cronos: 'Cronos', fantom: 'Fantom',
  solana: 'Solana', moonbeam: 'Moonbeam', celo: 'Celo', ethereum: 'Ethereum',
}

async function fetchBeefy(minTvl: number, minApy: number, coinFilter: string | null): Promise<DiscoveredPool[]> {
  // Vault list is required (throws through the retry helper); TVL and APY
  // enrichments stay best-effort.
  const [vaults, tvlResult, apyResult] = await Promise.all([
    getJson<BeefyVault[]>('https://api.beefy.finance/vaults', 1800),
    getJson<Record<string, Record<string, number>>>('https://api.beefy.finance/tvl', 1800).catch(() => null),
    getJson<BeefyApy>('https://api.beefy.finance/apy/breakdown', 1800).catch(() => null),
  ])

  // TVL: { [chainId]: { [vaultId]: number } }
  const tvlMap: Record<string, number> = {}
  for (const chainTvls of Object.values(tvlResult ?? {})) {
    Object.assign(tvlMap, chainTvls)
  }

  const apyData: BeefyApy = apyResult ?? {}

  const pools: DiscoveredPool[] = []

  for (const v of vaults) {
    if (v.status !== 'active') continue
    // Only include single-asset vaults (staking, not LP)
    if (!v.assets || v.assets.length !== 1) continue

    const coinId = symbolToCoinId(v.assets[0])
    if (!coinId || (coinFilter && coinId !== coinFilter)) continue

    const tvl = tvlMap[v.id] ?? 0
    if (tvl < minTvl) continue

    const apyEntry = apyData[v.id]
    let apy = 0
    if (typeof apyEntry === 'number') {
      apy = apyEntry * 100
    } else if (apyEntry && typeof apyEntry === 'object') {
      apy = ((apyEntry.totalApy ?? apyEntry.vaultApr ?? 0)) * 100
    }
    if (apy < minApy || apy > 300) continue  // filter out obviously broken APY values

    const chainName = BEEFY_CHAIN_MAP[v.chain] ?? v.chain
    const pool = buildPool({
      poolId:          `beefy-${v.id}`,
      project:         'Beefy Finance',
      opportunityName: v.name,
      symbol:          v.assets[0].toUpperCase(),
      chain:           chainName,
      coinId, tvlUsd: tvl, apy,
      apyBase: apy, apyReward: null,
      auditCount: 1,
      url:        `https://app.beefy.finance/vault/${v.id}`,
      projectUrl: 'https://app.beefy.finance',
      category: 'liquid', source: 'beefy',
    })
    pools.push(pool)
  }
  return pools
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const coinFilter   = req.nextUrl.searchParams.get('coin')?.toLowerCase() ?? null
  const minTvl       = parseFloat(req.nextUrl.searchParams.get('min_tvl') ?? '1000000')
  const minApy       = parseFloat(req.nextUrl.searchParams.get('min_apy') ?? '0.1')
  const sourceFilter = req.nextUrl.searchParams.get('source') ?? 'all'

  const results = await Promise.allSettled([
    fetchDefiLlama(minTvl, minApy, coinFilter),
    fetchYearn(minTvl, minApy, coinFilter),
    fetchPendle(minTvl, minApy, coinFilter),
    fetchBeefy(minTvl, minApy, coinFilter),
  ])
  const [dlResult, yearnResult, pendleResult, beefyResult] = results
  const anyUpstreamFailed = results.some(r => r.status === 'rejected')

  const dlPools     = dlResult.status     === 'fulfilled' ? dlResult.value     : []
  const yearnPools  = yearnResult.status  === 'fulfilled' ? yearnResult.value  : []
  const pendlePools = pendleResult.status === 'fulfilled' ? pendleResult.value : []
  const beefyPools  = beefyResult.status  === 'fulfilled' ? beefyResult.value  : []

  let all: DiscoveredPool[] = [
    ...dlPools,
    ...yearnPools,
    ...pendlePools,
    ...beefyPools,
  ]

  // Source filter
  if (sourceFilter !== 'all') {
    all = all.filter(p => p.source === sourceFilter)
  }

  // Deduplicate by poolId (safety net)
  const seen = new Set<string>()
  const pools = all.filter(p => {
    if (seen.has(p.poolId)) return false
    seen.add(p.poolId)
    return true
  })

  // Sort by TVL descending
  pools.sort((a, b) => b.tvlUsd - a.tvlUsd)

  const sources: Record<DiscoverySource, number> = {
    defillama: dlPools.length,
    yearn:     yearnPools.length,
    pendle:    pendlePools.length,
    beefy:     beefyPools.length,
  }

  const cacheKey = [coinFilter, minTvl, minApy, sourceFilter].join('|')

  // Upstream outage emptied the result → serve the last healthy payload for
  // this exact filter combination, marked stale. A legitimately empty result
  // (strict filters, all upstreams healthy) is returned as-is.
  if (pools.length === 0 && anyUpstreamFailed) {
    const cached = lastGood.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < LAST_GOOD_TTL_MS) {
      return NextResponse.json({ ...cached.response, stale: true } satisfies StakingDiscoveryResponse)
    }
  }

  const response: StakingDiscoveryResponse = {
    ok: true,
    pools,
    total: pools.length,
    sources,
    updatedAt: new Date().toISOString(),
  }

  if (pools.length > 0) {
    lastGood.set(cacheKey, { response, cachedAt: Date.now() })
    if (lastGood.size > LAST_GOOD_MAX_ENTRIES) {
      const oldest = lastGood.keys().next().value
      if (oldest !== undefined) lastGood.delete(oldest)
    }
  }

  return NextResponse.json(response)
}
