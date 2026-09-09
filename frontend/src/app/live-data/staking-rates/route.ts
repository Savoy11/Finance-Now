import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface StakingRatesResponse {
  ok: boolean
  rates: Partial<Record<string, number>>  // provider key → APR %
  sources: Partial<Record<string, 'live' | 'estimate'>>
  /**
   * Per-upstream outcome, keyed by upstream name. Every leg below deliberately
   * swallows its own failure and keeps the static fallback — right for the DATA,
   * since one dead endpoint must not 500 the route — but it left the route
   * undiagnosable: a run reporting "4 of 51 live" cannot distinguish one dead
   * endpoint from seventeen, and the owner has no way in from the outside.
   * This says which upstream failed and how.
   */
  upstreams: Record<string, string>
  updatedAt: string
}

// ─── Static fallback APRs ────────────────────────────────────────────────────
// These are shown any time a live fetch fails or times out.
// Keys must match the liveAprKey values used in stakingProviders.ts.
const FALLBACK: Record<string, number> = {
  // ETH liquid staking
  lido_eth:        3.8,
  rocketpool_eth:  3.6,
  ankr_eth:        3.7,
  coinbase_eth:    3.2,
  kraken_eth:      3.5,
  binance_eth:     3.1,

  // Solana
  marinade_sol:    7.0,
  jito_sol:        7.5,
  native_sol:      6.5,   // generic Solana native staking

  // Cosmos / ATOM
  stride_atom:     14.0,
  native_atom:     13.0,  // Cosmos Hub baseline (~13%)
  osmo_native:     9.0,   // Osmosis

  // Polkadot / Kusama
  native_dot:      12.0,
  native_ksm:      15.0,

  // Cardano
  native_ada:       4.5,

  // Avalanche
  native_avax:      7.5,

  // BNB Chain
  native_bnb:       5.0,

  // MATIC / Polygon
  native_matic:     4.5,
  lido_matic:       4.0,  // Lido stMATIC

  // TRON
  native_trx:       4.5,

  // Bitcoin yield (Babylon restaking baseline)
  babylon_btc:      3.5,

  // CRO (Crypto.com)
  native_cro:      10.0,

  // Injective
  native_inj:      14.0,
  stride_inj:      13.0,

  // Celestia
  native_tia:      17.0,
  stride_tia:      16.0,

  // NEAR Protocol
  native_near:     10.0,
  metapool_near:    9.5,

  // ── Liquid-staking / restaking protocols (live via DeFiLlama Yields) ────────
  // ETH LSTs & restaking
  frax_eth:         4.5,
  stakewise_eth:    3.7,
  stader_eth:       3.9,
  swell_eth:        4.2,
  renzo_eth:        4.5,
  kelp_eth:         4.3,
  puffer_eth:       4.0,
  origin_eth:       4.2,
  bedrock_eth:      4.1,
  etherfi_eth:      4.8,
  // Solana LSTs
  sanctum_sol:      7.8,
  ankr_sol:         6.2,
  // Avalanche LSTs
  benqi_avax:       6.5,
  ankr_avax:        6.0,
  // Polygon / BNB LSTs
  stader_matic:     4.5,
  stader_bnb:       5.0,
  pstake_bnb:       5.5,
  ankr_bnb:         5.5,
  // Cosmos LSTs
  quicksilver_atom:13.0,
  pstake_atom:     12.5,
  // Polkadot / Kusama LSTs
  bifrost_dot:     12.0,
  bifrost_ksm:     14.0,
  // Bitcoin LST
  lombard_btc:      3.2,
}

// ─── DeFiLlama Yields mapping ────────────────────────────────────────────────
// Maps our internal rate key → the receipt-token symbol(s) DeFiLlama lists for
// that liquid-staking/restaking pool. Matching is by exact symbol (single-asset
// staking pools are just the ticker, e.g. "STETH"; LP pools are "STETH-ETH" and
// are excluded by the exact match), disambiguated by chain + highest TVL. This
// avoids hardcoding DeFiLlama's pool UUIDs, which churn.
const LLAMA_MAP: { key: string; symbols: string[]; chain?: string }[] = [
  // ETH liquid staking / restaking
  { key: 'frax_eth',        symbols: ['SFRXETH'],          chain: 'Ethereum' },
  { key: 'stakewise_eth',   symbols: ['OSETH'],            chain: 'Ethereum' },
  { key: 'stader_eth',      symbols: ['ETHX'],             chain: 'Ethereum' },
  { key: 'swell_eth',       symbols: ['RSWETH', 'SWETH'],  chain: 'Ethereum' },
  { key: 'renzo_eth',       symbols: ['EZETH'],            chain: 'Ethereum' },
  { key: 'kelp_eth',        symbols: ['RSETH'],            chain: 'Ethereum' },
  { key: 'puffer_eth',      symbols: ['PUFETH'],           chain: 'Ethereum' },
  { key: 'origin_eth',      symbols: ['OETH'],             chain: 'Ethereum' },
  { key: 'bedrock_eth',     symbols: ['UNIETH'],           chain: 'Ethereum' },
  { key: 'etherfi_eth',     symbols: ['WEETH', 'EETH'],    chain: 'Ethereum' },
  { key: 'ankr_eth',        symbols: ['ANKRETH'],          chain: 'Ethereum' },
  // Solana
  { key: 'sanctum_sol',     symbols: ['INF'],              chain: 'Solana' },
  { key: 'ankr_sol',        symbols: ['ANKRSOL'],          chain: 'Solana' },
  // Avalanche
  { key: 'benqi_avax',      symbols: ['SAVAX'],            chain: 'Avalanche' },
  { key: 'ankr_avax',       symbols: ['ANKRAVAX'],         chain: 'Avalanche' },
  // Polygon
  { key: 'stader_matic',    symbols: ['MATICX'],           chain: 'Polygon' },
  // BNB Chain
  { key: 'stader_bnb',      symbols: ['BNBX'],             chain: 'BSC' },
  { key: 'pstake_bnb',      symbols: ['STKBNB'],           chain: 'BSC' },
  { key: 'ankr_bnb',        symbols: ['ANKRBNB'],          chain: 'BSC' },
  // Cosmos LSTs (chain left open — symbol is distinctive and the chain label varies)
  { key: 'quicksilver_atom', symbols: ['QATOM'] },
  { key: 'pstake_atom',     symbols: ['STKATOM'] },
  // Polkadot / Kusama LSTs
  { key: 'bifrost_dot',     symbols: ['VDOT'] },
  { key: 'bifrost_ksm',     symbols: ['VKSM'] },
  // Bitcoin LST
  { key: 'lombard_btc',     symbols: ['LBTC'],             chain: 'Ethereum' },
  // NEAR (Meta Pool) — upgrades the metapool_near fallback to a live reading
  { key: 'metapool_near',   symbols: ['STNEAR'],           chain: 'Near' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 50) { return v >= lo && v <= hi ? v : null }
function round2(v: number) { return Math.round(v * 100) / 100 }

/** Extract a number from various API shapes (decimal or percent, object or primitive) */
function extractNumber(data: unknown, ...paths: string[]): number | null {
  let v: unknown = data
  for (const p of paths) v = (v as Record<string, unknown>)?.[p]
  if (v == null) return null
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return isNaN(n) ? null : n
}

/** Normalise a rate: if < 1 assume decimal (0.038 → 3.8), else assume percent */
function normPct(raw: number): number { return raw < 1 ? raw * 100 : raw }

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const rates  = { ...FALLBACK } as Record<string, number>
  const sources = Object.fromEntries(Object.keys(FALLBACK).map(k => [k, 'estimate'])) as Record<string, 'live' | 'estimate'>

  // Run all external fetches in parallel with a 6-second timeout each
  const T = 6_000
  function timedFetch(url: string, opts?: RequestInit) {
    const c = new AbortController()
    const id = setTimeout(() => c.abort(), T)
    return fetch(url, { ...opts, signal: c.signal, next: { revalidate: 300 } })
      .finally(() => clearTimeout(id))
  }

  const [
    lidoRes,
    rocketRes,
    marinadeRes,
    jitoRes,
    strideRes,
    injRes,
    nearRes,
    llamaRes,
  ] = await Promise.allSettled([
    // 1. Lido stETH 7-day APR SMA
    timedFetch('https://eth-api.lido.fi/v1/protocol/steth/apr/sma', { headers: { Accept: 'application/json' } }),
    // 2. Rocket Pool rETH APR (from Rocket Pool API)
    timedFetch('https://api.rocketpool.net/api/apr', { headers: { Accept: 'application/json' } }),
    // 3. Marinade mSOL 1-year APY
    timedFetch('https://api.marinade.finance/msol/apy/1y', { headers: { Accept: 'application/json' } }),
    // 4. Jito jitoSOL APY.
    // The old /api/v1/apy endpoint now 404s, which silently pinned jitoSOL to
    // the 7.5% static estimate while the docs still advertised it as live — and
    // the estimate was ~41% above the real rate. /api/v1/stake_pool_stats is the
    // current endpoint; it returns a time series where `apy` is an array of
    // { data, date } and `data` is a FRACTION (0.0532 = 5.32%).
    timedFetch('https://kobe.mainnet.jito.network/api/v1/stake_pool_stats', { headers: { Accept: 'application/json' } }),
    // 5. Stride stATOM APY
    timedFetch('https://edge.stride.zone/api/stake-stats', { headers: { Accept: 'application/json' } }),
    // ── Nine rungs removed 2026-09-09, each on first-hand evidence from a
    //    sequential owner-machine probe (`npm run staking-upstreams`; results in
    //    docs/audits/live-data-audit-2026-09-09.md). Every coin below keeps its
    //    static fallback, which is what it was already serving — these fetches
    //    produced nothing but latency.
    //
    //    DNS failure, no address at all (the three Cosmostation LCDs went
    //    together, so the pattern is gone rather than one host):
    //      api-cosmoshub-ia.cosmostation.io   native_atom   ~10.7s to fail
    //      api-osmosis.cosmostation.io        osmo_native   ~10.6s
    //      api-celestia-ia.cosmostation.io    native_tia    ~10.2s
    //      js.adapools.org                    native_ada    fast NXDOMAIN
    //
    //    ⚠ Those four are why the route was returning 4 of 51 live. Node resolves
    //    DNS on the libuv threadpool (4 threads by default), so four hosts each
    //    hanging ~10s occupied every thread for longer than the whole 6s budget —
    //    and the upstreams queued behind them aborted without a socket ever
    //    opening. That is the array-order failure the 2026-09-09 audit recorded:
    //    positions 1-5 answered, 6-17 "timed out". Removing dead hosts IS the
    //    fix for the cascade; there was never anything wrong with the twelve.
    //
    //    Now requires an API key — the endpoint answers 403 with that in the body
    //    ("If you want to use a program to access the API, see support.subscan.io"):
    //      polkadot.webapi.subscan.io         native_dot
    //      kusama.webapi.subscan.io           native_ksm
    //    Restoring these means adding a keyed provider, which is a policy
    //    decision, not a URL swap. Deliberately left out rather than left failing.
    //
    //    HTTP 404 — path or product retired:
    //      api.binance.org/v1/staking/asset   native_bnb   (BNB Beacon Chain)
    //      apilist.tronscanapi.com/.../staking-info  native_trx  (host alive,
    //        path gone; no replacement path verified, so not guessed at)
    //
    //    Serving a marketing page, not an API — the body is Lido's HTML site:
    //      polygon.lido.fi/api/stats          lido_matic
    //
    //    (11 was Avalanche, removed earlier: api.avax.network/ext/info returns a
    //    node version, never an APY.)
    // 15. Injective inflation (Cosmos LCD)
    timedFetch('https://lcd.injective.network/cosmos/mint/v1beta1/inflation', { headers: { Accept: 'application/json' } }),
    // (16 was Celestia — removed with the other Cosmostation LCDs above.)
    // 17. NEAR staking APY (NEAR public stats)
    timedFetch('https://api.nearblocks.io/v1/stats', { headers: { Accept: 'application/json' } }),
    // 18. DeFiLlama Yields — live APY for liquid-staking & restaking protocols (keyless)
    timedFetch('https://yields.llama.fi/pools', { headers: { Accept: 'application/json' } }),
  ])

  // ── 1. Lido stETH ──────────────────────────────────────────────────────────
  if (lidoRes.status === 'fulfilled' && lidoRes.value.ok) {
    try {
      const d = await lidoRes.value.json()
      const raw = parseFloat(d?.data?.aprs?.[0]?.apr ?? d?.data?.smaApr ?? '')
      const pct = clamp(raw < 1 ? raw * 100 : raw, 0, 15)
      if (pct != null) {
        rates.lido_eth = round2(pct)
        rates.ankr_eth = round2(pct + 0.1)
        rates.coinbase_eth = round2(pct - 0.5)
        rates.kraken_eth   = round2(pct - 0.2)
        rates.binance_eth  = round2(pct - 0.6)
        // Only Lido's number is a live reading — the others are derived offsets
        sources.lido_eth = 'live'
        for (const k of ['ankr_eth','coinbase_eth','kraken_eth','binance_eth']) sources[k] = 'estimate'
      }
    } catch { /* keep fallback */ }
  }

  // ── 2. Rocket Pool rETH ────────────────────────────────────────────────────
  if (rocketRes.status === 'fulfilled' && rocketRes.value.ok) {
    try {
      const d = await rocketRes.value.json()
      // RP API returns { yearlyAPR: "3.54" } or { currentAPR: number }
      const raw = parseFloat(d?.yearlyAPR ?? d?.currentAPR ?? d?.apr ?? '')
      const pct = clamp(normPct(raw), 0, 15)
      if (pct != null) { rates.rocketpool_eth = round2(pct); sources.rocketpool_eth = 'live' }
    } catch { /* fallback */ }
  }

  // ── 3. Marinade mSOL ───────────────────────────────────────────────────────
  if (marinadeRes.status === 'fulfilled' && marinadeRes.value.ok) {
    try {
      const d = await marinadeRes.value.json()
      const raw = typeof d === 'number' ? d : extractNumber(d, 'value') ?? extractNumber(d, 'apy')
      if (raw != null) {
        const pct = clamp(normPct(raw), 0, 25)
        if (pct != null) { rates.marinade_sol = round2(pct); sources.marinade_sol = 'live' }
      }
    } catch { /* fallback */ }
  }

  // ── 4. Jito jitoSOL ────────────────────────────────────────────────────────
  if (jitoRes.status === 'fulfilled' && jitoRes.value.ok) {
    try {
      const d = await jitoRes.value.json()
      // stake_pool_stats shape: { apy: [{ data: 0.0532, date: '…' }, …] } —
      // take the most recent sample. Older/simpler shapes are still accepted so
      // this keeps working if the endpoint reverts to a scalar.
      const series = Array.isArray(d?.apy) ? d.apy : null
      const latest = series?.length ? series[series.length - 1] : null
      const raw = typeof latest?.data === 'number'
        ? latest.data
        : typeof d === 'number' ? d : extractNumber(d, 'value') ?? extractNumber(d, 'apy')
      if (raw != null) {
        const pct = clamp(normPct(raw), 0, 25)
        if (pct != null) { rates.jito_sol = round2(pct); sources.jito_sol = 'live' }
      }
    } catch { /* fallback */ }
  }

  // If either Solana rate is live, derive native_sol as average
  if (sources.marinade_sol === 'live' || sources.jito_sol === 'live') {
    const vals = [rates.marinade_sol, rates.jito_sol].filter(Boolean) as number[]
    rates.native_sol = round2(vals.reduce((a, b) => a + b, 0) / vals.length)
    sources.native_sol = 'estimate' // derived from liquid-staking APYs, not a native-staking reading
  }

  // ── 5. Stride (stATOM, stINJ, stTIA) ──────────────────────────────────────
  if (strideRes.status === 'fulfilled' && strideRes.value.ok) {
    try {
      const d = await strideRes.value.json()
      // Stride now answers { stats: [ { chainId, name, denom: "ATOM",
      //   currentYield: 0.1485, strideYield: 0.1429, ... }, … ] } — an ARRAY keyed
      //   by denom, not the { atom: { apr } } map this used to read. Observed
      //   2026-09-09; the endpoint was healthy the whole time (HTTP 200) and only
      //   the shape moved, which is exactly the failure that looks identical to a
      //   healthy static estimate from outside the route.
      //
      //   strideYield, not currentYield: these keys are stATOM/stINJ/stTIA, so the
      //   number a holder actually earns after Stride's fee is the honest one.
      //   Both are fractions, so normPct scales them.
      const strideStats: Array<{ denom?: string; strideYield?: number; currentYield?: number }> =
        Array.isArray(d?.stats) ? d.stats : []
      const parseStride = (key: string) => {
        const row = strideStats.find((r) => (r?.denom ?? '').toUpperCase() === key.toUpperCase())
        const raw = row?.strideYield ?? row?.currentYield
        return typeof raw !== 'number' || isNaN(raw) ? null : clamp(normPct(raw), 0, 40)
      }
      const atom = parseStride('atom'); if (atom != null) { rates.stride_atom = round2(atom); sources.stride_atom = 'live' }
      const inj  = parseStride('inj');  if (inj  != null) { rates.stride_inj  = round2(inj);  sources.stride_inj  = 'live' }
      const tia  = parseStride('tia');  if (tia  != null) { rates.stride_tia  = round2(tia);  sources.stride_tia  = 'live' }
    } catch { /* fallback */ }
  }

  // ── 11. Avalanche — no live source; keeps its static fallback ──────────────
  // AVAX staking APY is stable around 7–9%; no reliable public API without a
  // wallet. The api.avax.network probe that used to sit in the fetch list above
  // only ever returned a node version, so it was removed rather than left
  // looking like a live rung that had failed.

  // ── 15. Injective inflation → APR ──────────────────────────────────────────
  if (injRes.status === 'fulfilled' && injRes.value.ok) {
    try {
      const d = await injRes.value.json()
      const raw = parseFloat(d?.inflation ?? '')
      const apr = clamp(normPct(raw) / 0.60, 0, 40)  // ~60% bonded ratio
      if (apr != null) { rates.native_inj = round2(apr); sources.native_inj = 'live' }
    } catch { /* fallback */ }
  }

  // ── 17. NEAR staking APY (nearblocks stats) ────────────────────────────────
  if (nearRes.status === 'fulfilled' && nearRes.value.ok) {
    try {
      const d = await nearRes.value.json()
      // nearblocks: { stats: { staking_ratio: "0.65", epoch_reward: "..." } }
      // or { staking_return: 10.2 }
      const raw = parseFloat(d?.stats?.staking_return ?? d?.staking_return ?? d?.apy ?? '')
      const pct = clamp(raw < 1 ? raw * 100 : raw, 0, 25)
      if (pct != null) { rates.native_near = round2(pct); sources.native_near = 'live' }
    } catch { /* fallback */ }
  }

  // ── 18. DeFiLlama Yields → liquid-staking / restaking protocol APYs ─────────
  // One keyless fetch covers ~24 protocol rows that otherwise have no live feed.
  // Runs after the protocol-specific blocks above so a DeFiLlama reading upgrades
  // any derived estimate (e.g. ankr_eth, previously offset from Lido) to live.
  if (llamaRes.status === 'fulfilled' && llamaRes.value.ok) {
    try {
      const d = await llamaRes.value.json()
      const pools: Array<{ symbol?: string; chain?: string; apy?: number; apyBase?: number; tvlUsd?: number }> =
        Array.isArray(d?.data) ? d.data : []
      if (pools.length) {
        for (const m of LLAMA_MAP) {
          let cands: typeof pools = []
          for (const sym of m.symbols) {
            cands = pools.filter(p => (p.symbol || '').toUpperCase() === sym)
            if (m.chain) {
              const byChain = cands.filter(p => p.chain === m.chain)
              if (byChain.length) cands = byChain
            }
            if (cands.length) break
          }
          if (!cands.length) continue
          cands.sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
          const best = cands[0]
          // Prefer base staking yield; fall back to total APY when base is absent/zero.
          const raw = (typeof best.apyBase === 'number' && best.apyBase > 0) ? best.apyBase : best.apy
          const pct = typeof raw === 'number' ? clamp(raw, 0, 40) : null
          if (pct != null) { rates[m.key] = round2(pct); sources[m.key] = 'live' }
        }
      }
    } catch { /* keep fallbacks */ }
  }

  // ── Bitcoin yield: Babylon native has no live public API; keep fallback ─────
  // babylon_btc is a nascent protocol with variable TVL-based yield; static fallback is accurate

  // ── Upstream diagnostics ───────────────────────────────────────────────────
  // `keys` lists only the keys an upstream is meant to make LIVE — never the
  // ones derived from it by an offset (ankr/coinbase/kraken/binance off Lido,
  // native_sol, native_matic), which are always estimates by design. So an
  // upstream reported as reachable-but-unusable really did fail to produce a
  // reading, rather than merely declining to fabricate neighbours.
  const upstreams = Object.fromEntries(([
    { name: 'lido-eth',           res: lidoRes,     keys: ['lido_eth'] },
    { name: 'rocketpool-eth',     res: rocketRes,   keys: ['rocketpool_eth'] },
    { name: 'marinade-sol',       res: marinadeRes, keys: ['marinade_sol'] },
    { name: 'jito-sol',           res: jitoRes,     keys: ['jito_sol'] },
    { name: 'stride-cosmos-lsts', res: strideRes,   keys: ['stride_atom', 'stride_inj', 'stride_tia'] },
    { name: 'injective-native',   res: injRes,      keys: ['native_inj'] },
    { name: 'near-native',        res: nearRes,     keys: ['native_near'] },
    { name: 'defillama-yields',   res: llamaRes,    keys: LLAMA_MAP.map((m) => m.key) },
  ] as const).map(({ name, res, keys }) => {
    if (res.status === 'rejected') {
      // An aborted fetch is the 6s timeout, not a refusal — distinguishing them
      // is the difference between "this host is slow from here" and "this host
      // is gone", and those have opposite fixes.
      const err: unknown = res.reason
      const name_ = err instanceof Error ? err.name : ''
      if (name_ === 'AbortError' || name_ === 'TimeoutError') return [name, `timeout after ${T / 1000}s`]
      return [name, `unreachable: ${err instanceof Error ? err.message : String(err)}`.slice(0, 120)]
    }
    if (!res.value.ok) return [name, `http ${res.value.status}`]
    const landed = keys.filter((k) => sources[k] === 'live')
    if (landed.length === keys.length) return [name, `live (${landed.length}/${keys.length})`]
    if (landed.length > 0) return [name, `partial (${landed.length}/${keys.length} live)`]
    // HTTP 200 whose body the parser could not turn into a rate: a changed
    // response shape or a symbol that no longer matches. This is the failure
    // that used to be indistinguishable from a healthy estimate.
    return [name, `reachable but no usable rate (0/${keys.length})`]
  })) as Record<string, string>

  return NextResponse.json({
    ok: true,
    rates,
    sources,
    upstreams,
    updatedAt: new Date().toISOString(),
  } satisfies StakingRatesResponse)
}
