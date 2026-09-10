import { NextResponse } from 'next/server'
import type { GapReasonId } from '@/lib/data/dataGaps'

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
  /**
   * Which FALLBACK values rest on a measured reading and which do not. A
   * fallback is what publishes when an upstream fails, so a surface showing an
   * `estimate` rate needs to be able to say whether that estimate was ever
   * checked — 24 of them never have been.
   */
  fallbackProvenance: {
    measuredOn: string
    measuredKeys: number
    unmeasuredKeys: number
  }
  /**
   * WHY each non-live key is not live, keyed the same way as `sources`.
   *
   * `sources[key] === 'estimate'` says a figure is not a reading; it cannot say
   * whether nothing on earth publishes it, whether a working source just failed,
   * or whether it is an offset we compute on purpose. Those have opposite
   * responses, and only this route knows which upstream was responsible — so the
   * reason is declared here rather than re-derived in the UI, the same reasoning
   * that put `upstreams` here in #157.
   *
   * Live keys are absent from this map, not present with a null.
   */
  gaps: Partial<Record<string, GapReasonId>>
  updatedAt: string
}

// ─── Static fallback APRs ────────────────────────────────────────────────────
// These are shown any time a live fetch fails or times out.
// Keys must match the liveAprKey values used in stakingProviders.ts.
//
// ⚠ THIS TABLE IS HALF MEASURED AND HALF LEGACY, AND THE TWO HALVES DO NOT
//   CARRY THE SAME WEIGHT. Check FALLBACK_MEASURED before trusting a number.
//
//   27 of the 51 keys were set on 2026-09-09 from a live reading of this route
//   on the owner's machine (all 7 upstreams live, defillama-yields 19/19).
//   Those keys are listed in FALLBACK_MEASURED and dated by
//   FALLBACK_MEASURED_ON.
//
//   The other 24 have no upstream and were never measured — they are the
//   original hand-written estimates, of unknown vintage. FALLBACK_MEASURED_ON
//   deliberately does NOT date them: re-verifying 27 rows of 51 does not
//   refresh the other 24, and stamping the whole table with one fresh date is
//   the staleness lie the provenance convention exists to prevent.
//
//   WHAT THE 2026-09-09 PASS FOUND, and why this was worth doing: 22 of the 27
//   were off by ≥25%, and every one of them was OVERSTATED —
//
//     lombard_btc    3.2  → 0.17   (−95%)
//     swell_eth      4.2  → 0.64   (−85%)
//     ankr_bnb       5.5  → 1.16   (−79%)
//     puffer_eth     4.0  → 0.92   (−77%)
//     stride_tia    16.0  → 4.52   (−72%)
//     bifrost_dot   12.0  → 3.34   (−72%)
//
//   A one-directional error in 22 of 22 is not scatter. The table was written
//   when staking yields were far higher and never revisited. A fallback is
//   precisely what publishes when an upstream fails, so the app was quoting
//   yields up to 20× the real rate at the exact moment it had no source for
//   them — on a percentage a user acts on.
//
//   ⚠ Each measured value is a SINGLE point-in-time reading, not a
//     multi-source verification, and staking APRs move daily. That is a real
//     limit of this refresh, recorded rather than glossed: a dated single
//     reading still beats an undated estimate that is provably 95% high.
const FALLBACK: Record<string, number> = {
  // ETH liquid staking
  lido_eth:        2.19,
  rocketpool_eth:  2.16,
  ankr_eth:        2.45,
  coinbase_eth:    3.2,
  kraken_eth:      3.5,
  binance_eth:     3.1,

  // Solana
  marinade_sol:    6.14,
  jito_sol:        4.86,
  native_sol:      6.5,   // generic Solana native staking

  // Cosmos / ATOM
  stride_atom:     14.3,
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
  native_inj:      7.33,
  stride_inj:      7.16,

  // Celestia
  native_tia:      17.0,
  stride_tia:      4.52,

  // NEAR Protocol
  native_near:     10.0,
  metapool_near:    9.5,

  // ── Liquid-staking / restaking protocols (live via DeFiLlama Yields) ────────
  // ETH LSTs & restaking
  frax_eth:         2.7,
  stakewise_eth:    2.25,
  stader_eth:       2.31,
  swell_eth:        0.64,
  renzo_eth:        2.05,
  kelp_eth:         2.65,
  puffer_eth:       0.92,
  origin_eth:       2.65,
  bedrock_eth:      2.73,
  etherfi_eth:      2.54,
  // Solana LSTs
  sanctum_sol:      6.06,
  ankr_sol:         6.2,
  // Avalanche LSTs
  benqi_avax:       3.81,
  ankr_avax:        6.32,
  // Polygon / BNB LSTs
  stader_matic:     2.34,
  stader_bnb:       5.0,
  pstake_bnb:       5.5,
  ankr_bnb:         1.16,
  // Cosmos LSTs
  quicksilver_atom:13.0,
  pstake_atom:     12.5,
  // Polkadot / Kusama LSTs
  bifrost_dot:     3.34,
  bifrost_ksm:     12.03,
  // Bitcoin LST
  lombard_btc:      0.17,
}

/** When the FALLBACK_MEASURED keys were read from live upstreams. */
const FALLBACK_MEASURED_ON = '2026-09-09'

/**
 * Exactly which keys FALLBACK_MEASURED_ON covers — every other key in FALLBACK
 * is an undated legacy estimate. Kept as an explicit list rather than derived
 * at runtime from `sources`, because "was this number ever checked by a human
 * against a real upstream" is a fact about the TABLE, not about whether today's
 * fetch happened to succeed.
 *
 * `stakingFallbackProvenance.test.ts` fails if a key here is absent from
 * FALLBACK, so the two cannot drift apart in a later edit.
 */
const FALLBACK_MEASURED: ReadonlySet<string> = new Set([
  'ankr_avax', 'ankr_bnb', 'ankr_eth', 'bedrock_eth', 'benqi_avax',
  'bifrost_dot', 'bifrost_ksm', 'etherfi_eth', 'frax_eth', 'jito_sol',
  'kelp_eth', 'lido_eth', 'lombard_btc', 'marinade_sol', 'native_inj',
  'origin_eth', 'puffer_eth', 'renzo_eth', 'rocketpool_eth', 'sanctum_sol',
  'stader_eth', 'stader_matic', 'stakewise_eth', 'stride_atom', 'stride_inj',
  'stride_tia', 'swell_eth',
])

/**
 * Why a key cannot be live, where the answer is a property of the KEY rather than
 * of today's fetch.
 *
 * Every entry below is a first-hand finding already recorded elsewhere in this
 * file or in docs/audits/live-data-audit-2026-09-09.md — this map only makes those
 * findings reachable by the UI, so a reader hovering an `est` chip gets the actual
 * reason instead of "static estimate".
 *
 * A key absent from this map and not live is reported as `upstream-failed`: it HAS
 * an upstream that is meant to make it live, so a miss is a fault worth chasing.
 * That default is the useful direction to be wrong in — it over-reports work
 * rather than silently writing a regression off as a known limitation.
 */
const GAP_BY_KEY: Record<string, GapReasonId> = {
  // ── Offsets and averages we compute on purpose (never live, by design) ──
  //    Only Lido's number is a reading; these are arithmetic on it.
  coinbase_eth:     'derived-estimate',
  kraken_eth:       'derived-estimate',
  binance_eth:      'derived-estimate',
  native_sol:       'derived-estimate',
  native_matic:     'derived-estimate',

  // ── Upstream removed 2026-09-09 because it carries no rate AT ALL ──
  //    Not "the field moved": these hosts were probed and answer without a yield,
  //    or no longer resolve. Chasing them again is wasted work.
  native_atom:      'no-upstream',   // api-cosmoshub-ia.cosmostation.io — DNS gone
  osmo_native:      'no-upstream',   // api-osmosis.cosmostation.io — DNS gone
  native_tia:       'no-upstream',   // api-celestia-ia.cosmostation.io — DNS gone
  native_ada:       'no-upstream',   // js.adapools.org — NXDOMAIN
  native_bnb:       'no-upstream',   // api.binance.org staking path retired (404)
  native_trx:       'no-upstream',   // tronscanapi staking-info path gone
  lido_matic:       'no-upstream',   // polygon.lido.fi serves a marketing page
  native_near:      'no-upstream',   // nearblocks /stats carries no yield field
  metapool_near:    'no-upstream',   // DeFiLlama lists meta-pool-eth only
  ankr_sol:         'no-upstream',   // Ankr has no Solana product in the pool set
  stader_bnb:       'no-upstream',   // Stader lists ETHX/MATICX only
  pstake_bnb:       'no-upstream',   // pSTAKE absent from DeFiLlama entirely
  pstake_atom:      'no-upstream',   // ditto
  quicksilver_atom: 'no-upstream',   // Quicksilver absent entirely

  // ── Source exists but now requires a key, which is a policy decision ──
  native_dot:       'needs-api-key', // polkadot.webapi.subscan.io — 403, keyed
  native_ksm:       'needs-api-key', // kusama.webapi.subscan.io — 403, keyed

  // ── Never had a feed; hand-maintained reference, dated by the catalog ──
  native_avax:      'curated-estimate',
  native_cro:       'curated-estimate',
  babylon_btc:      'curated-estimate',
}

// ─── DeFiLlama Yields mapping ────────────────────────────────────────────────
// Maps our internal rate key → the receipt-token symbol(s) DeFiLlama lists for
// that liquid-staking/restaking pool. Matching is by exact symbol (single-asset
// staking pools are just the ticker, e.g. "STETH"; LP pools are "STETH-ETH" and
// are excluded by the exact match), disambiguated by chain + highest TVL. This
// avoids hardcoding DeFiLlama's pool UUIDs, which churn.
// ── Six keys removed 2026-09-09, on a single `npm run llama-symbols` run
//    against DeFiLlama's full 17,193-pool set (owner machine). Every one is a
//    REMOVAL, not a rename — the probe's three lenses agreed each time, and no
//    corrected symbol exists to swap in:
//
//      ankr_sol          Ankr IS in the set with five products (ANKRETH,
//                        ANKRFLOWEVM, ANKRBNB, ANKRAVAX, ANKRMATIC) — Solana is
//                        simply not among them any more.
//      stader_bnb        Stader is present with ETHX and MATICX only; no BNBX.
//      pstake_bnb        pSTAKE is absent from the dataset entirely.
//      pstake_atom       ditto.
//      quicksilver_atom  Quicksilver is absent from the dataset entirely.
//      metapool_near     Meta Pool appears only as meta-pool-eth (MPETH, SPETH);
//                        no NEAR product. Same conclusion the native NEAR rung
//                        reached separately — see the removal note below.
//
//    ⚠ THE NEAR MISSES ARE NOT LP PAIRS. The probe's "similar symbol" lens
//    surfaced `BNBX-WBNB` (thena-fusion) and `STKATOM-WETH` (sushiswap), and
//    neither is a staking yield: an LP APY blends trading fees and incentives
//    and carries impermanent-loss exposure, so publishing one under "staking
//    APR" would be a category error, not an approximation. The matcher below
//    compares symbols EXACTLY, so it cannot drift into one by accident — but a
//    maintainer reading the probe output might paste one in, which is why this
//    is written down rather than left to the matcher.
//
//    All six keep the static fallback they were already serving (STATIC_RATES
//    above), so nothing regresses; the route just stops asking for six pools
//    that cannot answer, and `defillama-yields` stops reporting a permanent
//    partial that no fix could close.
//
//    Not acted on, but seen: ANKRMATIC (Polygon, ~2.4%) and MPETH/SPETH
//    (meta-pool-eth) are live pools with no key here. Adding them means new
//    keys in STATIC_RATES and on the staking page, which is a feature, not
//    this cleanup.
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
  // Avalanche
  { key: 'benqi_avax',      symbols: ['SAVAX'],            chain: 'Avalanche' },
  { key: 'ankr_avax',       symbols: ['ANKRAVAX'],         chain: 'Avalanche' },
  // Polygon
  { key: 'stader_matic',    symbols: ['MATICX'],           chain: 'Polygon' },
  // BNB Chain
  { key: 'ankr_bnb',        symbols: ['ANKRBNB'],          chain: 'BSC' },
  // Cosmos LSTs (chain left open — symbol is distinctive and the chain label varies)
  // Polkadot / Kusama LSTs
  { key: 'bifrost_dot',     symbols: ['VDOT'] },
  { key: 'bifrost_ksm',     symbols: ['VKSM'] },
  // Bitcoin LST
  { key: 'lombard_btc',     symbols: ['LBTC'],             chain: 'Ethereum' },
  // NEAR (Meta Pool) — upgrades the metapool_near fallback to a live reading
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
    // (17 was NEAR — removed 2026-09-09. api.nearblocks.io/v1/stats answers HTTP
    //  200 and is perfectly healthy, but the whole response is NETWORK stats:
    //  supply, price, block time, nodes, txns, tps — 17 fields, not one of them a
    //  staking yield. So this was never a stale parse path to repair; the endpoint
    //  does not carry the number. (The old expression could not have worked in any
    //  case: `stats` is an ARRAY, so `d.stats.staking_return` is always undefined.)
    //  Nor is it derivable from what IS there — NEAR's APY needs the total staked,
    //  and the response gives only total and circulating supply. native_near keeps
    //  its static fallback. Full body in docs/audits/live-data-audit-2026-09-09.md.)
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
    if (landed.length > 0) {
      // Name the misses, not just the count. "partial (19/25)" is the same dead
      // end "4/51 live" was: it says something is wrong without saying what, and
      // for DeFiLlama a miss means a symbol in LLAMA_MAP no longer matches any
      // pool — a one-line map fix, but only once you know which symbol. Capped so
      // a wholesale mismatch cannot flood the line.
      const missed = keys.filter((k) => sources[k] !== 'live')
      const shown = missed.slice(0, 8).join(', ')
      const more = missed.length > 8 ? `, +${missed.length - 8} more` : ''
      return [name, `partial (${landed.length}/${keys.length} live; no match: ${shown}${more})`]
    }
    // HTTP 200 whose body the parser could not turn into a rate: a changed
    // response shape or a symbol that no longer matches. This is the failure
    // that used to be indistinguishable from a healthy estimate.
    return [name, `reachable but no usable rate (0/${keys.length})`]
  })) as Record<string, string>

  // ── Why each non-live key is not live ──────────────────────────────────────
  // Built from today's `sources`, so a key that normally has an upstream and
  // missed THIS request reports `upstream-failed` rather than inheriting a
  // permanent excuse. Only keys whose reason is a property of the key itself come
  // from GAP_BY_KEY.
  const gaps: Partial<Record<string, GapReasonId>> = {}
  for (const key of Object.keys(FALLBACK)) {
    if (sources[key] === 'live') continue
    gaps[key] = GAP_BY_KEY[key] ?? 'upstream-failed'
  }

  return NextResponse.json({
    ok: true,
    rates,
    sources,
    upstreams,
    fallbackProvenance: {
      measuredOn: FALLBACK_MEASURED_ON,
      measuredKeys: FALLBACK_MEASURED.size,
      unmeasuredKeys: Object.keys(FALLBACK).length - FALLBACK_MEASURED.size,
    },
    gaps,
    updatedAt: new Date().toISOString(),
  } satisfies StakingRatesResponse)
}
