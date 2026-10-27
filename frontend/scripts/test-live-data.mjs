#!/usr/bin/env node
// Finance Now live-data audit harness.
//
// Hits every /live-data/* and /api/v1/* route, plus the agent prompts list,
// against the running dev server (which in turn calls the real upstream APIs),
// validates response shape, sanity-checks the actual values, and — the part
// that matters most — classifies the PROVENANCE of what came back.
//
// "Every" is held by a test, not asserted: a route this file does not call must
// be named in NOT_AUDITED (scripts/lib/auditCoverage.mjs) with the reason, and
// auditCoverage.test.ts fails otherwise. Until 2026-10-14 this header said
// "every" while 15 routes went uncalled, the MCP server's four among them.
//
// ── Why provenance classification exists ──────────────────────────────────────
// A route that returns HTTP 200 with stale, reference, or empty data is more
// dangerous than one that returns 500, because every downstream check reads it
// as healthy and any resulting inaccuracy gets misattributed to the UI layer.
// Before this harness had provenance checks it reported 43/43 PASS while
// /live-data/stock-universe was serving a 79-entry hand-written catalog and
// /live-data/fund-holdings was serving 5 indicative holdings from a static file.
// Both were "working". Neither was real.
//
// Every test therefore returns a verdict, not just pass/fail:
//   REAL          — verified live data from the intended upstream
//   FALLBACK      — HTTP 200, but served from a static catalog / reference /
//                   estimate path instead of the intended upstream
//   UNCONFIGURED  — key-gated and honestly reporting it (configured:false), or
//                   withheld by a recorded decision and saying which (Reddit's
//                   robots gate; funding rates and futures curves, whose only
//                   sources went on terms). A decision is not a fault, and a red
//                   row for one sends the reader to debug a route that is right
//   EMPTY         — HTTP 200, well-formed, but carries no data
//   FAIL          — non-2xx, ok:false, or a value that failed a sanity check
//
// Exit code: 0 only if there are no FAILs. FALLBACK/EMPTY/UNCONFIGURED are
// reported loudly but do not fail the run by default, because several are the
// correct behaviour on a free-tier key set. Use --strict to fail on those too.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   node scripts/test-live-data.mjs           # full audit      (npm run audit)
//   node scripts/test-live-data.mjs --quick   # fast CI subset  (npm run smoke)
//   node scripts/test-live-data.mjs --strict  # FALLBACK/EMPTY also fail
//   node scripts/test-live-data.mjs --json    # machine-readable output
//   BASE_URL=https://… node scripts/test-live-data.mjs
//
// Requires the app to be running.
//
// This file is the single live-data harness. The former scripts/smoke.mjs was a
// lighter, overlapping check; its unique cross-layer consistency assertions were
// folded in below (see the "cross-layer" group) so the two cannot drift apart.

import { createCoinGeckoPacer, derivedMinGapMs } from './lib/coingeckoPacing.mjs'
import { NOT_AUDITED } from './lib/auditCoverage.mjs'

const BASE = process.env.BASE_URL ?? process.env.FN_BASE_URL ?? process.env.CAEP_BASE_URL ?? 'http://localhost:3000'
const ARGS = new Set(process.argv.slice(2))
const QUICK = ARGS.has('--quick')
const STRICT = ARGS.has('--strict')
const JSON_OUT = ARGS.has('--json')

// ── Verdicts ──────────────────────────────────────────────────────────────────
const REAL = 'REAL'
const FALLBACK = 'FALLBACK'
const UNCONFIGURED = 'UNCONFIGURED'
const EMPTY = 'EMPTY'
const FAIL = 'FAIL'

const ICON = { REAL: '🟢', FALLBACK: '🟡', UNCONFIGURED: '🔑', EMPTY: '⚪', FAIL: '🔴' }

// Helpers a check() can return to declare a non-REAL verdict without throwing.
const fallback = (detail) => ({ verdict: FALLBACK, detail })
const unconfigured = (detail) => ({ verdict: UNCONFIGURED, detail })
const empty = (detail) => ({ verdict: EMPTY, detail })

/** Days between a series' first and last candle (unix-second `time`). */
const spanDays = (candles) => candles.length < 2 ? 0 : Math.round((candles.at(-1).time - candles[0].time) / 86_400)

// ─── CoinGecko pacing ────────────────────────────────────────────────────────
// The model and its two past mistakes are documented in scripts/lib/
// coingeckoPacing.mjs, which is where the logic lives so it can be tested.
// In short: a minimum spacing between CoinGecko CALLS (whatever ran in
// between), plus a sliding-window cap, plus a per-check WEIGHT — because a
// single check can be several upstream requests and charging it one slot is
// what left `coin-discovery` taking `coin-list`'s 429 on 2026-09-09.
const COINGECKO_WINDOW_MS = 60_000
// Default 10, set by the owner on 2026-09-09 to keep the run fast, with the
// trade-off recorded rather than left to be rediscovered:
//
//   On the sequence that actually 429'd (markets, 3x ohlcv, chart, coin-list,
//   coin-search, coin-discovery) a cap of 10 means the weighting throttles
//   NOTHING — 10 weighted calls fit exactly, so the harness issues the same
//   request pattern as the failing run. 8 or 9 do throttle it, and cost ~48s.
//   The choice is close to binary; 9 saves under 2s over 8.
//
//   Note also that the real CoinGecko call count in that window was ~7, not 10
//   (the three ohlcv checks were served by Binance and spent no budget), so a
//   per-minute cap may not be the lever at all — coin-list issues its three
//   pages 250ms apart, and a burst that tight is the likelier trigger. That
//   would be a fix in lib/server/coingeckoPages.ts, which serves real users and
//   not just this harness, so it wants an owner-machine run to confirm before
//   anyone touches it. See docs/audits/live-data-audit-2026-09-09.md.
//
// If coin-discovery 429s again, this is the first number to move — not the
// weighting, which is correct independently of where the cap sits.
const COINGECKO_MAX_PER_WINDOW = Number(process.env.AUDIT_CG_PER_MIN ?? 10)

// DERIVED from the cap, not chosen independently — see derivedMinGapMs. A fixed
// 1.8s gap let ten calls land in eighteen seconds, so the "10/min" cap was really
// permitting ~22-33/min and never bound. AUDIT_CG_GAP_MS still overrides for
// deliberate experiments; it just is not the default any more.
const COINGECKO_MIN_GAP_MS = Number(
  process.env.AUDIT_CG_GAP_MS ?? derivedMinGapMs(COINGECKO_WINDOW_MS, COINGECKO_MAX_PER_WINDOW),
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const cgPacer = createCoinGeckoPacer({
  minGapMs: COINGECKO_MIN_GAP_MS,
  windowMs: COINGECKO_WINDOW_MS,
  maxPerWindow: COINGECKO_MAX_PER_WINDOW,
})

/**
 * Upstream CoinGecko requests a single check issues, where it is more than one.
 * These MIRROR the routes — keep them in step or the budget drifts back out:
 *   coin-list       fetchCoinGeckoPages(3, ...)      — hardcoded 3 pages
 *   coin-discovery  ceil(limit / 250), limit=250     — 1 page at the audit's
 *                                                      default; raise this if
 *                                                      the audit ever passes
 *                                                      ?limit= above 250
 *                   + TOKENIZED_SECURITY_CATEGORIES  — 7 category pages (TS-3,
 *                     (lib/server/tokenizedSecurities)  2026-10-07), cached a day
 *                   + STABLECOIN_CATEGORY            — 1 category page (T-129 E,
 *                     (lib/server/stablecoinCategory)   2026-10-24), cached a day,
 *                                                      so 9 is a cold-cache bound
 *   ohlcv           /ohlc + /market_chart, together  — 2 per candle request since
 *                                                      the Binance rungs went
 *                                                      (T-423, 2026-10-13); a
 *                                                      closes=1 check that DefiLlama
 *                                                      answers spends none
 * Anything absent counts as 1. Over-counting only costs the run time; see the
 * module's note on why that asymmetry is deliberate.
 */
const COINGECKO_CALL_WEIGHT = {
  '/live-data/coin-list': 3,
  '/live-data/coin-discovery': 9,
  '/live-data/ohlcv': 2,
}
const coinGeckoWeight = (t) => {
  const hit = Object.entries(COINGECKO_CALL_WEIGHT).find(([r]) => t.path.startsWith(r))
  return hit ? hit[1] : 1
}

/**
 * Routes whose upstream is CoinGecko — directly or as the first rung of a
 * ladder. Matched on the route path so a renamed test cannot silently drop out
 * of the pacing.
 */
const COINGECKO_ROUTES = [
  '/live-data/markets',
  '/live-data/ohlcv',
  '/live-data/chart',
  '/live-data/coin-list',
  '/live-data/coin-search',
  '/live-data/coin-discovery',
  '/live-data/coin-profile',
  '/live-data/portfolio-prices',
  '/live-data/portfolio-history',
  '/live-data/alerts',
  '/live-data/global',
  '/live-data/staking-rates',
  '/live-data/network-fees',
  // The agent API reads CoinGecko too: /prices calls simple/price itself, and
  // /network-fees prices its gas through the same module as the route above.
  // Unpaced until 2026-10-14, each spent budget the window did not count.
  '/api/v1/prices',
  '/api/v1/network-fees',
]
const isCoinGeckoBacked = (t) => COINGECKO_ROUTES.some((r) => t.path.startsWith(r))

const results = []

async function getJson(path) {
  const t0 = Date.now()
  // The public API needs a key wherever keys are set (D173). On the owner's machine with none
  // set it answers without one; with FN_API_KEYS set locally, put one of them in FN_API_KEY.
  const key = process.env.FN_API_KEY?.trim()
  const auth = key && path.startsWith('/api/v1') ? { Authorization: `Bearer ${key}` } : {}
  const res = await fetch(BASE + path, { headers: { Accept: 'application/json', ...auth } })
  const text = await res.text()
  const ms = Date.now() - t0
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON body */ }
  return { status: res.status, json, text, headers: res.headers, ms }
}

// A test = { path, name, group, quick?, expectStatus?, check(json,status,headers) }
//
// expectStatus — the HTTP status (or array of them) this route is SUPPOSED to
// answer with. Set it whenever the correct answer is not 2xx: a withdrawn route
// that must 404, an endpoint held from the rollout that must 503. Without it the
// runner treats any 4xx/5xx as a failure before check() is called, so an
// assertion about a deliberate error status can never be reached.
// check() returns: a string (REAL + detail) | { verdict, detail } | throws (FAIL).
const tests = [
  // ── Crypto market data ──────────────────────────────────────────────────────
  { group: 'crypto/market', path: '/live-data/markets', name: 'markets', quick: true, check: (j) => {
    const quotes = j.quotes ?? {}
    const entries = Object.entries(quotes)
    if (entries.length === 0) throw new Error('no market rows')
    const px = quotes.btc?.price
    if (!(px > 1000 && px < 5_000_000)) throw new Error(`BTC price implausible: ${px}`)
    const eth = quotes.eth?.price
    if (!(eth > 100 && eth < 100_000)) throw new Error(`ETH price implausible: ${eth}`)
    const usdc = quotes.usdc?.price
    if (typeof usdc === 'number' && Math.abs(usdc - 1) > 0.05) throw new Error(`USDC depegged in feed: ${usdc}`)
    if (String(j.source ?? '').includes('-fallback')) {
      return fallback(`${entries.length} assets via fallback source=${j.source}`)
    }
    return `${entries.length} assets, source=${j.source}, BTC=$${Math.round(px).toLocaleString()}`
  }},

  // Candles come from CoinGecko alone since the Binance rungs went (T-423,
  // 2026-10-13). Its free service sends 4-day candles past 30 days, so a year is
  // about 92 of them, not 365: the measured launch state, which the charts answer
  // by switching to closing prices. So these check the span the candles cover and
  // name the size, rather than counting candles against a daily expectation.
  { group: 'crypto/market', path: '/live-data/ohlcv?id=btc&range=1Y', name: 'ohlcv btc 1Y', quick: true, check: (j) => {
    if (!j.ok || !Array.isArray(j.candles)) throw new Error(`not ok: ${j.error ?? 'no candles'}`)
    const days = spanDays(j.candles)
    if (days < 300) throw new Error(`1Y candles cover only ${days} days`)
    const c = j.candles.at(-1)
    if (!(c.high >= c.low && c.high >= c.open && c.high >= c.close)) throw new Error('OHLC invariant broken')
    // Degenerate candles (o==h==l==c) mean a price series was reshaped to look
    // like OHLCV — real candles must show intra-period range.
    const flat = j.candles.filter((k) => k.open === k.high && k.high === k.low && k.low === k.close).length
    if (flat > j.candles.length * 0.5) throw new Error(`${flat}/${j.candles.length} candles have zero range — not real OHLC`)
    if (j.bars !== 'ohlc') throw new Error(`a candle request came back as bars=${j.bars}`)
    return `${j.candles.length} ${j.granularity} candles over ${days} days, source=${j.source}, last=$${Math.round(c.close).toLocaleString()}`
  }},

  // The closing-price path (T-423, D103). Flat candles are RIGHT here, and only
  // here: DefiLlama sends one price per day, and `bars: 'close'` must say so.
  // Anything else answering means the Coins screener is back on candles.
  { group: 'crypto/market', path: '/live-data/ohlcv?id=btc&range=1Y&closes=1', name: 'ohlcv btc 1Y closes (DefiLlama)', check: (j) => {
    if (!j.ok || !Array.isArray(j.candles)) throw new Error(`not ok: ${j.error ?? 'no candles'}`)
    if (j.source !== 'defillama') return fallback(`${j.candles.length} candles from ${j.source} — DefiLlama did not answer`)
    if (j.bars !== 'close') throw new Error(`DefiLlama prices not marked as closes (bars=${j.bars})`)
    if (j.granularity !== '1D') throw new Error(`expected daily prices, got ${j.granularity}`)
    if (j.candles.length < 300) throw new Error(`only ${j.candles.length} daily prices for 1Y`)
    return `${j.candles.length} daily closes, source=defillama, last=$${Math.round(j.candles.at(-1).close).toLocaleString()}`
  }},

  { group: 'crypto/market', path: '/live-data/ohlcv?id=xrp&range=6M', name: 'ohlcv xrp 6M (regression)', check: (j) => {
    if (!j.ok || !Array.isArray(j.candles)) throw new Error(`xrp 6M: ${j.error ?? 'no candles'}`)
    const days = spanDays(j.candles)
    if (days < 150) throw new Error(`xrp 6M sparse: ${j.candles.length} candles over ${days} days`)
    return `${j.candles.length} ${j.granularity} candles over ${days} days, source=${j.source}`
  }},

  // Past 365 days CoinGecko's free service refuses candles, in its own words, and
  // a paid key lifts that. The charts and the assistant read the closes below.
  { group: 'crypto/market', path: '/live-data/ohlcv?id=eth&range=MAX', name: 'ohlcv eth MAX candles', check: (j) => {
    if (!j.ok && /365 days/.test(String(j.error))) return unconfigured('CoinGecko’s free service refuses candles past 365 days; a paid key reaches them, and the charts read DefiLlama closes')
    if (!j.ok || !Array.isArray(j.candles) || j.candles.length < 50) throw new Error(`eth MAX: ${j.error ?? j.candles?.length}`)
    return `${j.candles.length} ${j.granularity} candles, source=${j.source}`
  }},

  { group: 'crypto/market', path: '/live-data/ohlcv?id=eth&range=MAX&closes=1', name: 'ohlcv eth MAX closes (DefiLlama)', check: (j) => {
    if (!j.ok || !Array.isArray(j.candles)) throw new Error(`not ok: ${j.error ?? 'no candles'}`)
    if (j.source !== 'defillama') return fallback(`${j.candles.length} candles from ${j.source} — DefiLlama did not answer`)
    if (j.bars !== 'close') throw new Error(`DefiLlama prices not marked as closes (bars=${j.bars})`)
    if (j.granularity !== '1W') throw new Error(`expected weekly prices, got ${j.granularity}`)
    // Measured 2026-10-13: 584 weekly prices, back to 12 August 2015, across two
    // 500-week pages. A short answer means the second page went missing.
    if (j.candles.length < 400) throw new Error(`only ${j.candles.length} weekly prices for MAX`)
    return `${j.candles.length} weekly closes over ${spanDays(j.candles)} days, source=defillama`
  }},

  // DefiLlama's backup for closing prices (T-434, D108). The chart route reaches it
  // only when DefiLlama does not answer, so this asks for it by name. Its licence
  // (CC BY-NC 4.0) needs the credit on every answer it serves.
  { group: 'crypto/market', path: '/live-data/ohlcv?id=eth&range=MAX&source=coinmetrics', name: 'ohlcv eth MAX closes (Coin Metrics)', check: (j) => {
    if (!j.ok || !Array.isArray(j.candles)) throw new Error(`not ok: ${j.error ?? 'no candles'}`)
    if (j.bars !== 'close') throw new Error(`Coin Metrics prices not marked as closes (bars=${j.bars})`)
    if (j.granularity !== '1W') throw new Error(`expected weekly prices, got ${j.granularity}`)
    if (j.candles.length < 400) throw new Error(`only ${j.candles.length} weekly prices for MAX`)
    if (!Array.isArray(j.attributions) || !j.attributions.some((a) => /Coin Metrics/.test(a?.text))) {
      throw new Error('served without the Coin Metrics credit its licence requires')
    }
    return `${j.candles.length} weekly closes over ${spanDays(j.candles)} days, source=coinmetrics, credited`
  }},

  { group: 'crypto/market', path: '/live-data/chart?id=btc&days=30', name: 'chart (synthetic OHLC proxy)', check: (j) => {
    if (!j.ok || !Array.isArray(j.candles) || j.candles.length === 0) throw new Error('no candles')
    const flat = j.candles.filter((k) => k.open === k.high && k.high === k.low && k.low === k.close).length
    // This route builds candles from CoinGecko's price-only series, so every
    // candle is legitimately zero-range. It must SAY so, or a consumer will
    // mistake it for real OHLCV (the shape is identical).
    if (flat === j.candles.length && !j.synthetic) {
      throw new Error('all candles zero-range but payload lacks synthetic:true marker')
    }
    return j.synthetic
      ? fallback(`${j.candles.length} price points, correctly marked synthetic:true (not real OHLC)`)
      : `${j.candles.length} candles`
  }},

  { group: 'crypto/market', path: '/live-data/coin-list', name: 'coin-list', check: (j) => {
    if (!j.ok || !Array.isArray(j.coins) || j.coins.length === 0) throw new Error(`no coins (source=${j.source})`)
    if (j.source === 'none' || j.source === 'error') return fallback(`source=${j.source}`)
    return `${j.coins.length} coins, source=${j.source}`
  }},

  { group: 'crypto/market', path: '/live-data/coin-search?q=bitcoin', name: 'coin-search', check: (j) => {
    const arr = j.coins ?? j.results ?? []
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('no results for "bitcoin"')
    return `${arr.length} matches`
  }},

  { group: 'crypto/market', path: '/live-data/coin-discovery', name: 'coin-discovery', check: (j) => {
    const arr = j.candidates ?? []
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('no candidates')
    // TS-3: candidates served without the tokenized-security check may include
    // tokenized stocks and funds, so that is a fallback, not a pass.
    const ts = j.tokenizedSecurities
    if (!ts?.checked) return fallback(`${arr.length} candidates, tokenized-security check did not run`)
    // A partial check names its unanswered categories, so the run says why
    // instead of only that it happened (2026-10-17: it said "partial" and nothing else).
    const failed = Array.isArray(ts.failed) && ts.failed.length ? `: ${ts.failed.join('; ')}` : ''
    const summary = `${arr.length} candidates, ${ts.excluded.length} tokenized securities left out${ts.partial ? ` (partial check${failed})` : ''}`
    // T-129 E: stablecoin labels guessed from the id are the fallback, not a pass.
    if (j.stablecoins && !j.stablecoins.checked) return fallback(`${summary}; stablecoin labels guessed (${j.stablecoins.error ?? 'category not read'})`)
    return summary
  }},

  { group: 'crypto/market', path: '/live-data/assets/list', name: 'assets/list', check: (j) => {
    const arr = j.assets ?? []
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('no assets')
    return `${arr.length} assets (static catalog by design)`
  }},

  { group: 'crypto/market', path: '/live-data/fear-greed', name: 'fear-greed', quick: true, check: (j) => {
    const n = Number(j.value ?? j.now?.value)
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`value out of range: ${j.value}`)
    return `index=${n}`
  }},

  // No source since 2026-09-30: OKX, the only one, was withdrawn on its API terms
  // (D40), and the route answers ok:false with the reason. That is a decision, and
  // this check said 'no rates' → FAIL for two weeks, which failed the whole run.
  // Rates coming back mean a source was wired in; the check then reads them.
  { group: 'crypto/market', path: '/live-data/funding-rates', name: 'funding-rates (no source, D40)', check: (j) => {
    const arr = j.rates ?? []
    if (j.ok === false && arr.length === 0) {
      if (!j.reason) throw new Error('ok:false with no reason: the route must say why there is no source')
      return unconfigured(`no source by decision (D40): ${j.reason}`)
    }
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('ok but no rates')
    const srcs = [...new Set(arr.map((r) => r.exchange ?? r.source).filter(Boolean))]
    return `${arr.length} instruments${srcs.length ? ` via ${srcs.join(', ')}` : ''}`
  }},

  { group: 'crypto/market', path: '/live-data/defi-tvl', name: 'defi-tvl', check: (j) => {
    const tvl = Number(j.totalTvl ?? j.tvl ?? j.total)
    if (!Number.isFinite(tvl) || tvl < 1e9) throw new Error(`TVL implausible: ${tvl}`)
    return `TVL=$${(tvl / 1e9).toFixed(1)}B, ${(j.protocols ?? []).length} protocols`
  }},

  { group: 'crypto/market', path: '/live-data/btc-stats', name: 'btc-stats', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    if (!(j.blockHeight > 800_000)) throw new Error(`block height implausible: ${j.blockHeight}`)
    return `height=${j.blockHeight}, hashrate=${j.hashrateTHs ? Math.round(j.hashrateTHs / 1e6) + ' EH/s' : '?'}`
  }},

  { group: 'crypto/market', path: '/live-data/network-fees', name: 'network-fees', quick: true, check: (j) => {
    const nets = j.networkFees ?? {}
    const count = Object.keys(nets).length
    if (count < 10) throw new Error(`only ${count} networks`)
    if (j.btcFeeSource !== 'live') return fallback(`BTC fee not live (btcFeeSource=${j.btcFeeSource})`)
    // Only Bitcoin is a live fee; every other chain is static-gas × live-price.
    const live = Object.values(nets).filter((f) => f.source === 'live').length
    return `${count} networks, ${live} live / ${count - live} estimated (by design)`
  }},

  // The live overlay on the transfer-fee table: keyless exchange fee feeds. The
  // page is hidden from the rollout (2026-08-22) but the route is live, and
  // /api/v1/transfer/routes reads the same overlay. A feed that fails leaves its
  // exchange on the hand-maintained table, which is FALLBACK by definition.
  { group: 'crypto/market', path: '/live-data/withdraw-fees', name: 'withdraw-fees (live fee overlay)', check: (j) => {
    const sources = j.sources ?? []
    if (!Array.isArray(sources) || sources.length === 0) throw new Error('no fee sources reported')
    const live = sources.filter((s) => s.status === 'live')
    const down = sources.filter((s) => s.status !== 'live')
    const detail = `${live.length}/${sources.length} exchange feeds live, ${j.applied ?? 0} fees overlaid`
    if (live.length === 0) throw new Error(`no exchange fee feed answered: ${down.map((s) => `${s.exchangeId}=${s.error ?? s.status}`).join(', ')}`)
    if (down.length) return fallback(`${detail}; on the static table: ${down.map((s) => `${s.exchangeId}=${s.error ?? s.status}`).join(', ')}`)
    return detail
  }},

  { group: 'crypto/market', path: '/live-data/reserves', name: 'reserves', check: (j) => {
    if (!j.ok || !Array.isArray(j.assets) || j.assets.length === 0) throw new Error('no reserve assets')
    return `${j.assets.length} stablecoins`
  }},

  // /live-data/risk-scores was REMOVED on 2026-08-29 (RP-6): the owner's position
  // is that publishing a per-coin risk figure may read as a recommendation, a
  // regulated activity. A 404 is the correct answer, so assert the removal
  // rather than reporting it as a failure — an audit that cries wolf on
  // intended behaviour trains the reader to skim its FAILURES block.
  // If this ever returns 200, the route came back and that IS a finding.
  { group: 'crypto/market', path: '/live-data/risk-scores', name: 'risk-scores (withdrawn RP-6)', expectStatus: 404, check: (j, s) => {
    if (s === 404) return 'correctly gone — removed 2026-08-29 (RP-6)'
    throw new Error(`expected 404 (route was removed); got ${s} — has the route been reinstated?`)
  }},

  { group: 'crypto/market', path: '/live-data/alerts', name: 'alerts', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    return `${(j.alerts ?? []).length} alerts`
  }},

  // D10 (owner decision, 2026-09-14): the /global-adoption page and this route
  // were CUT, and #191 deleted them. The test stayed behind, so every audit since
  // has carried a red FAIL for a route that is gone on purpose — a permanent
  // false alarm in the one report whose job is to make real failures obvious.
  // Kept rather than deleted, as a reinstatement guard, in the same shape as
  // risk-scores (RP-6) and wallet/exchange-connections (RP-5).
  { group: 'crypto/market', path: '/live-data/cbdc-data', name: 'cbdc-data (withdrawn D10)', expectStatus: 404, check: (j, s) => {
    if (s === 404) return 'correctly gone — /global-adoption and this route cut 2026-09-14 (D10)'
    throw new Error(`expected 404 (route was cut under D10); got ${s} — has the route been reinstated?`)
  }},

  // ── Staking ─────────────────────────────────────────────────────────────────
  { group: 'crypto/staking', path: '/live-data/staking-rates', name: 'staking-rates', quick: true, check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const rates = j.rates ?? {}
    const sources = j.sources ?? {}
    const keys = Object.keys(rates)
    if (keys.length === 0) throw new Error('no rates')
    // The DeFiLlama + native-rate expansion added ~23 protocol keys to the
    // fallback table, so a current route ALWAYS returns ~48 keys (51 until Stride's
    // three went, 2026-10-14) regardless of
    // which upstreams the running IP can reach (these are fallback keys — their
    // presence is IP-independent). Far fewer keys means the server is running
    // pre-expansion code (a stale dev server / old checkout) — fail loudly here
    // rather than let the run pass green against code that isn't the branch's.
    const REQUIRED_KEYS = ['frax_eth', 'renzo_eth', 'kelp_eth', 'benqi_avax', 'lombard_btc', 'quicksilver_atom']
    // A measured fallback past its 14-day window is WITHHELD (deleted from
    // `rates`, marked 'estimate-expired' in `gaps`) when its upstream also failed.
    // That is the route working, not stale code, so it is reported, not failed.
    const expired = REQUIRED_KEYS.filter((k) => !(k in rates) && j.gaps?.[k] === 'estimate-expired')
    const missingKeys = REQUIRED_KEYS.filter((k) => !(k in rates) && !expired.includes(k))
    if (missingKeys.length) throw new Error(`missing expanded staking keys (stale server / old code?): ${missingKeys.join(', ')} — only ${keys.length} keys returned`)
    const bad = keys.filter((k) => !(rates[k] >= 0 && rates[k] < 100))
    if (bad.length) throw new Error(`APR out of [0,100): ${bad.join(', ')}`)
    const live = keys.filter((k) => sources[k] === 'live')
    // Docs have historically claimed stETH + mSOL + jitoSOL are all live.
    // Assert that explicitly so a dead upstream cannot quietly become an
    // "estimate" while the docs still advertise it as live.
    const advertised = ['lido_eth', 'marinade_sol', 'jito_sol']
    const notLive = advertised.filter((k) => sources[k] && sources[k] !== 'live')
    if (notLive.length) {
      return fallback(`${live.length}/${keys.length} live — but advertised-live rates are estimates: ${notLive.map((k) => `${k}=${sources[k]}`).join(', ')}`)
    }
    // "4/51 live" on its own is not actionable: most of those 51 are fallback
    // keys that are estimates BY DESIGN, so the number cannot say whether the
    // live rungs are healthy. The route reports each upstream's outcome, so
    // name the ones that failed and how — a dead endpoint, a 6s timeout and a
    // changed response shape have three different fixes.
    const up = j.upstreams ?? {}
    const broken = Object.entries(up).filter(([, v]) => !/^live \(/.test(v))
    const detail = `${live.length}/${keys.length} live APRs; ${Object.keys(up).length - broken.length}/${Object.keys(up).length} upstreams healthy`
      + (expired.length ? `; withheld past their 14-day window (npm run staking:refresh-fallbacks): ${expired.join(', ')}` : '')
    if (broken.length) {
      return fallback(`${detail} — ${broken.map(([k, v]) => `${k}: ${v}`).join(', ')}`)
    }
    return detail
  }},

  { group: 'crypto/staking', path: '/live-data/staking-discovery', name: 'staking-discovery', check: (j) => {
    if (!j.ok || !Array.isArray(j.pools) || j.pools.length === 0) throw new Error('no pools')
    const apys = j.pools.map((p) => p.apy).filter(Number.isFinite)
    // 40 is DISCOVERY_APY_MAX (lib/data/discoveryApy.ts): the route leaves out any pool above it
    // and names it in `refused`. This check said 1000 until 2026-10-26, which let Swell's rswETH
    // at 366% pass and caught it only at 7,530%.
    if (apys.some((a) => a <= 0 || a > 40)) throw new Error('implausible APY present')
    const refused = Array.isArray(j.refused) ? j.refused : []
    const detail = `${j.pools.length} pools, APY ${Math.min(...apys).toFixed(1)}–${Math.max(...apys).toFixed(1)}%`
    return refused.length
      ? `${detail}; ${refused.length} left out above 40%: ${refused.map((r) => `${r.symbol} ${Number(r.apy).toFixed(0)}%`).join(', ')}`
      : detail
  }},

  // ── News & social ───────────────────────────────────────────────────────────
  { group: 'crypto/news', path: '/live-data/news?coin=btc&limit=10', name: 'news', quick: true, check: (j) => {
    const arr = j.articles ?? []
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('no articles')
    // NB: crypto news articles use `headline`; equity market-news uses `title`.
    const titled = arr.filter((a) => a.headline || a.title).length
    if (titled === 0) throw new Error('articles have no headline/title')
    if (titled < arr.length) throw new Error(`${arr.length - titled}/${arr.length} articles missing a headline`)
    return `${arr.length} articles from ${(j.providers ?? []).length} providers`
  }},

  { group: 'crypto/news', path: '/live-data/social?coin=btc', name: 'social', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const sig = j.signals ?? []
    // The route names every provider it declined to read, and why, in `withheld`.
    // Read that instead of guessing the cause: this row used to report "Reddit
    // RSS likely rate-limited (429) from this IP" for what is in fact Reddit's
    // robots gate — a deliberate decision that no amount of re-running clears.
    // An IP-dependent guess is the one thing an owner-machine audit must not do.
    const withheld = j.withheld ?? []
    const why = withheld.map((w) => `${w.name} withheld — ${w.reason}`).join(' | ')
    if (sig.length === 0) {
      return withheld.length
        ? unconfigured(`0 signals; every provider withheld. ${why}`)
        : empty('0 signals, and no provider reported a reason')
    }
    const platforms = [...new Set(sig.map((s) => s.platform))]
    if (!platforms.includes('reddit')) {
      const reddit = withheld.find((w) => w.id === 'reddit')
      // Distinguish "we chose not to fetch it" from "we fetched and got nothing".
      return reddit
        ? unconfigured(`${sig.length} signals via ${platforms.join(', ')}; ${reddit.name} withheld — ${reddit.reason}`)
        : fallback(`${sig.length} signals but no Reddit — fetched and returned nothing (RSS feeds 429 aggressively)`)
    }
    return `${sig.length} signals via ${platforms.join(', ')}${withheld.length ? ` (${why})` : ''}`
  }},

  { group: 'crypto/video', path: '/live-data/videos', name: 'videos', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const v = j.videos ?? []
    if (v.length === 0) return empty('0 videos')
    return `${v.length} videos`
  }},

  { group: 'crypto/video', path: '/live-data/video-search?q=bitcoin', name: 'video-search', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    if (j.configured === false) return unconfigured('no YouTube API key configured (honestly reported)')
    if ((j.videos ?? []).length === 0) return empty('configured but 0 results')
    return `${j.videos.length} videos`
  }},

  // GET only: it lists the video analyzers and which are configured, and spends
  // nothing. The POST runs a model over a video on the owner's key and is not
  // called here.
  { group: 'crypto/video', path: '/live-data/video-analyze', name: 'video-analyze (analyzers, GET only)', check: (j) => {
    if (!j.ok || !Array.isArray(j.providers) || j.providers.length === 0) throw new Error('no analyzers listed')
    const usable = j.providers.filter((p) => p.configured && p.supported)
    if (usable.length === 0) return unconfigured(`${j.providers.length} analyzers, none configured and supported (needs a provider key)`)
    return `${usable.length}/${j.providers.length} analyzers usable: ${usable.map((p) => p.label).join(', ')}`
  }},

  // ── Portfolio & wallets ─────────────────────────────────────────────────────
  // paxos-standard (USDP) and havven (SNX) are here on purpose: both are coins the
  // platform tracks whose CoinGecko id is the project's ORIGINAL name, and both sat
  // in coinCatalog.ts under their intuitive spelling ('pax-dollar',
  // 'synthetix-network-token') until 2026-09-09, matching nothing. Nothing validates
  // those ids, so the failure was silent. Pricing them here makes it loud.
  { group: 'crypto/portfolio', path: '/live-data/portfolio-prices?ids=bitcoin,ethereum,solana,paxos-standard,havven', name: 'portfolio-prices', check: (j) => {
    const WANT = 5
    const n = Object.keys(j.prices ?? {}).length
    if (n === 0) throw new Error(`no prices (source=${j.source}, missing=${(j.missing || []).join(',')})`)
    if (j.source === 'error') throw new Error('source=error')
    if (j.source === 'partial') return fallback(`${n}/${WANT} priced, source=partial, missing=${(j.missing || []).join(',')}`)
    return `${n}/${WANT} priced (source=${j.source})`
  }},

  { group: 'crypto/portfolio', path: '/live-data/portfolio-history?ids=bitcoin&date=2026-06-01', name: 'portfolio-history', check: (j) => {
    const n = Object.keys(j.prices ?? {}).length
    const priced = Object.values(j.prices ?? {}).filter((v) => v != null).length
    if (j.source === 'error' || priced === 0) {
      // Report WHY. A provider rate limit and a genuinely missing date are
      // different problems, and the 2026-09-03 audit could not tell them apart
      // — it printed "no historical prices (source=error)" during a CoinGecko
      // 429, which reads as a data gap.
      if (j.reason === 'upstream') throw new Error(`upstream refused — ${j.detail ?? 'no detail'} (transient: re-run)`)
      if (j.reason === 'no-data') throw new Error(`provider has no price for that date — ${j.detail ?? ''}`)
      throw new Error(`no historical prices (source=${j.source})`)
    }
    if (j.source === 'partial') return fallback(`partial history, ${priced}/${n} priced — ${j.detail ?? ''}`)
    return `${priced} coin priced on ${j.date} (source=${j.source})`
  }},

  // Params are required; a missing-param request must be rejected, not answered
  // with a 200 that a caller could mistake for "no data available".
  { group: 'crypto/portfolio', path: '/live-data/portfolio-history', name: 'portfolio-history (missing params → 400)', check: (j, s) => {
    if (s !== 400) throw new Error(`expected 400 for missing params, got ${s} (source=${j.source})`)
    return 'correctly rejected'
  }},

  { group: 'crypto/wallet', path: '/live-data/wallet/btc?address=1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', name: 'wallet btc', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    if (typeof j.balance !== 'number') throw new Error('no balance')
    return `balance=${j.balance} BTC`
  }},

  // Ethereum mainnet is the most-used chain here and was hard-502ing because the
  // single configured RPC (cloudflare-eth.com) started returning -32603. The
  // route now walks a ladder of public endpoints and reports which one served.
  { group: 'crypto/wallet', path: '/live-data/wallet/eth?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', name: 'wallet eth (mainnet)', quick: true, check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    if (!(j.balance >= 0) || !(j.txCount > 0)) throw new Error(`implausible: balance=${j.balance} txCount=${j.txCount}`)
    return `${j.balance.toFixed(4)} ETH, ${j.txCount} txs, via ${j.rpc ?? 'unknown rpc'}`
  }},

  { group: 'crypto/wallet', path: '/live-data/wallet/eth?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&chain=polygon', name: 'wallet eth (polygon)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    return `${j.balance.toFixed(2)} ${j.symbol}, via ${j.rpc ?? 'unknown rpc'}`
  }},

  { group: 'crypto/wallet', path: '/live-data/wallet/sol?address=9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', name: 'wallet sol', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    return `balance=${j.balance} SOL`
  }},

  // Tronscan is called only with a key since 2026-10-14 (D105): its terms require an
  // account, and its API rate-limits keyless requests (429 on every keyless call that day).
  { group: 'crypto/wallet', path: '/live-data/wallet/tron?address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', name: 'wallet tron', check: (j) => {
    if (j.configured === false) return unconfigured(`no Tronscan API key (TRONSCAN_API_KEY), so nothing is called: ${j.error}`)
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    return `balance=${j.balance} TRX`
  }},

  { group: 'crypto/wallet', path: '/live-data/wallet/xrp?address=rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh', name: 'wallet xrp', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    return `balance=${j.balance} XRP`
  }},

  // Exchange API-key linking was REMOVED on 2026-08-18 (RP-5) on security
  // grounds: it stored an apiKey + apiSecret in plaintext at rest, the
  // highest-value secret the app held. A 404 is the correct answer. A 200 here
  // would mean key custody has been reintroduced — which is exactly the thing
  // an audit should shout about, so that case fails loudly.
  { group: 'crypto/wallet', path: '/live-data/wallet/exchange-connections', name: 'wallet exchange-connections (withdrawn RP-5)', expectStatus: 404, check: (j, s) => {
    if (s === 404) return 'correctly gone — exchange key custody removed 2026-08-18 (RP-5)'
    throw new Error(`expected 404; got ${s} — has exchange key custody been reintroduced?`)
  }},

  // ── Pump report ─────────────────────────────────────────────────────────────
  { group: 'crypto/pump', path: '/live-data/pump-report/metrics', name: 'pump-report metrics', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const m = j.metrics ?? []
    if (m.length === 0) return empty('0 metrics')
    return `${m.length} metrics`
  }},

  // ── Equities ────────────────────────────────────────────────────────────────
  { group: 'equities', path: '/live-data/security-quotes?symbols=AAPL,MSFT,BRK-B', name: 'security-quotes (provider ladder)', quick: true, check: (j) => {
    if (!j.ok || !j.quotes) throw new Error('no quotes payload')
    const all = Object.values(j.quotes)
    const ref = all.filter((q) => q.reference)
    if (j.source === 'reference' || ref.length === all.length) {
      return fallback(`all ${all.length} quotes are static catalog reference prices (source=${j.source})`)
    }
    const aapl = j.quotes.AAPL
    if (!aapl || !(aapl.price > 10 && aapl.price < 5000)) throw new Error(`AAPL price implausible: ${aapl?.price}`)
    if (ref.length > 0) return fallback(`${all.length - ref.length}/${all.length} live via ${j.source}, ${ref.length} reference`)
    return `${all.length}/${all.length} live via ${j.source}, AAPL=$${aapl.price.toFixed(2)}`
  }},

  { group: 'equities', path: '/live-data/security-ohlcv?symbol=AAPL&range=6M', name: 'security-ohlcv', quick: true, check: (j) => {
    if (!j.ok || !Array.isArray(j.candles) || j.candles.length < 80) throw new Error(`sparse candles: ${j.candles?.length} (source=${j.source})`)
    const c = j.candles.at(-1)
    if (!(c.high >= c.low && c.high >= c.open && c.high >= c.close)) throw new Error('OHLC invariant broken')
    if (j.source === 'none') throw new Error('no source served')
    return `${j.candles.length} candles via ${j.source}`
  }},

  // NB: security-chart takes Yahoo-style ranges (6mo), while its sibling
  // security-ohlcv takes 6M. Different vocabulary, same concept — asserted here
  // so the inconsistency is visible rather than surprising a caller with a 400.
  { group: 'equities', path: '/live-data/security-chart?symbol=AAPL&range=6mo', name: 'security-chart', check: (j) => {
    if (!j.ok || !j.chart) throw new Error('no chart payload')
    const pts = j.chart.points ?? []
    if (pts.length < 80) throw new Error(`sparse series: ${pts.length}`)
    return `${pts.length} close points (close-only by design)`
  }},

  { group: 'equities', path: '/live-data/security-chart?symbol=AAPL&range=6M', name: 'security-chart (wrong range vocab → 400)', check: (j, s) => {
    if (s !== 400) throw new Error(`expected 400 for bad range, got ${s}`)
    return 'correctly rejected (use 6mo not 6M)'
  }},

  { group: 'equities', path: '/live-data/security-returns?symbols=AAPL,MSFT', name: 'security-returns', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    if (j.source === 'none') return fallback('source=none, no returns served')
    const n = Object.keys(j.returns ?? {}).length
    if (n === 0) return empty('0 symbols returned')
    return `${n} symbols via ${j.source}`
  }},

  { group: 'equities', path: '/live-data/stock-universe', name: 'stock-universe', quick: true, check: (j) => {
    if (!j.ok || !Array.isArray(j.entries) || j.entries.length === 0) throw new Error('no universe entries')
    const e = j.entries[0]
    // Since D170 (2026-10-25) the route serves no price or market cap, only the SEC figures and
    // share count, so its entries are checked for those. This check still asked for marketCapB
    // and a market-cap order until 2026-10-26, and failed every run.
    if (!e.symbol || !e.sector) throw new Error(`bad top entry: ${JSON.stringify(e).slice(0, 80)}`)
    if ('marketCapB' in e || 'referencePrice' in e) throw new Error('serves a market cap or reference price, which D170 removed')
    const withShares = j.entries.filter((x) => x.shares && x.shares.val > 0).length
    // The FMP company-screener is a PAID endpoint. Without a paid key the route
    // serves the ~79-entry curated catalog — a fraction of the real universe,
    // and every downstream screener/outlier surface inherits that narrowing.
    if (j.source === 'catalog') {
      return fallback(`${j.count} stocks from curated catalog, ${withShares} with an SEC share count — FMP company-screener needs a PAID plan (real universe ≈ thousands)`)
    }
    return `${j.count} stocks, source=${j.source}, ${withShares} with an SEC share count`
  }},

  { group: 'equities', path: '/live-data/stock-universe?symbol=AAPL', name: 'stock-universe (single lookup)', check: (j) => {
    if (!j.ok || j.entries?.[0]?.symbol !== 'AAPL') throw new Error('AAPL lookup failed')
    return `${j.entries[0].name} · ${j.entries[0].sector}`
  }},

  { group: 'equities', path: '/live-data/stock-outliers?min_mcap=2', name: 'stock-outliers (screener)', check: (j) => {
    if (!j.ok || !j.categories) throw new Error('no outlier categories')
    if (!(j.evaluated > 0) || !(j.sectorsEvaluated > 0)) throw new Error(`nothing evaluated (${j.evaluated})`)
    // The beta lists went with D170 (2026-10-25); this still asked for them until 2026-10-26.
    const cats = ['cheap', 'expensive', 'highYield']
    for (const c of cats) {
      if (!Array.isArray(j.categories[c])) throw new Error(`missing category ${c}`)
      for (const it of j.categories[c]) if (typeof it.z !== 'number') throw new Error(`item missing z in ${c}`)
    }
    const flagged = cats.reduce((n, c) => n + j.categories[c].length, 0)
    // Inherits stock-universe's source. On the catalog fallback this screens ~79
    // hand-picked large caps, so "outlier" means outlier within that small set.
    if (j.evaluated < 200) {
      return fallback(`only ${j.evaluated} evaluated across ${j.sectorsEvaluated} sectors — screening the curated catalog, not the real universe`)
    }
    return `${j.evaluated} evaluated across ${j.sectorsEvaluated} sectors, ${flagged} outliers`
  }},

  { group: 'equities', path: '/live-data/market-news?limit=10', name: 'market-news', quick: true, check: (j) => {
    if (!j.ok || !Array.isArray(j.articles) || j.articles.length === 0) throw new Error('no articles')
    const sources = [...new Set(j.articles.map((a) => a.source))]
    return `${j.articles.length} articles from ${sources.join(', ')}`
  }},

  // limit=80 (the max) on purpose. Signals are merged by recency, and StockTwits
  // posts arrive minutes old while Reddit threads are hours/days old — so at
  // small limits StockTwits fills every slot and Reddit reads as dead even when
  // it is working. Only a high limit distinguishes "Reddit blocked" from
  // "Reddit out-ranked". See the starvation note in the audit report.
  { group: 'equities', path: '/live-data/stock-social?limit=80', name: 'stock-social', check: (j) => {
    if (!j.ok || !Array.isArray(j.signals) || j.signals.length === 0) throw new Error('no signals')
    const platforms = [...new Set(j.signals.map((s) => s.platform))]
    const enabled = (j.providers ?? []).map((p) => p.id)
    const counts = platforms.map((p) => `${p}=${j.signals.filter((s) => s.platform === p).length}`).join(', ')
    // Read `withheld`, as the crypto social check does. This check blamed a 403
    // and rate limits, but `providers` lists only sources that contributed, so
    // with Reddit's robots gate closed (D58) it never fired and the row passed
    // green as though StockTwits were the whole feed.
    // With the gate open and Reddit's fetch empty, the route lists Reddit nowhere,
    // so that case cannot be told apart here; `providers` names who contributed.
    const reddit = (j.withheld ?? []).find((w) => w.id === 'reddit-stocks')
    if (reddit && !platforms.includes('reddit')) {
      return unconfigured(`${j.signals.length} signals (${counts}); ${reddit.name} withheld — ${reddit.reason}`)
    }
    return `${j.signals.length} signals (${counts}) from ${enabled.join(', ')}`
  }},

  { group: 'equities', path: '/live-data/sec-filings?symbol=AAPL&form=8-K&limit=5', name: 'sec-filings', check: (j) => {
    if (!j.ok || !Array.isArray(j.filings) || j.filings.length === 0) throw new Error(`no filings (${j.error ?? 'empty'})`)
    const f = j.filings[0]
    if (!f.form?.startsWith('8-K')) throw new Error(`wrong form: ${f.form}`)
    if (!f.url?.startsWith('https://www.sec.gov/')) throw new Error(`bad url: ${f.url}`)
    if (!Array.isArray(f.itemLabels) || f.itemLabels.length === 0) throw new Error('no item labels')
    return `${j.filings.length} filings, latest ${f.filedAt}`
  }},

  { group: 'equities', path: '/live-data/company-facts?symbol=AAPL', name: 'company-facts (SEC XBRL)', check: (j) => {
    if (!j.ok || !j.fundamentals || !j.ratios) throw new Error(`no fundamentals (${j.error ?? 'empty'})`)
    const f = j.fundamentals, r = j.ratios
    if (!(f.revenue > 1e11)) throw new Error(`AAPL revenue implausible: ${f.revenue}`)
    if (!(f.sharesOutstanding > 1e9)) throw new Error(`shares implausible: ${f.sharesOutstanding}`)
    if (!(r.netMargin > 0.05 && r.netMargin < 0.6)) throw new Error(`net margin implausible: ${r.netMargin}`)
    if (!(r.currentRatio > 0.2 && r.currentRatio < 5)) throw new Error(`current ratio implausible: ${r.currentRatio}`)
    return `rev=$${(f.revenue / 1e9).toFixed(0)}B, netMargin=${(r.netMargin * 100).toFixed(1)}%`
  }},

  { group: 'equities', path: '/live-data/company-profile?symbol=AAPL&name=Apple', name: 'company-profile (SEC+wiki)', check: (j) => {
    if (!j.ok || !j.profile) throw new Error(`no profile (${j.error ?? 'empty'})`)
    if (!j.profile.sicDescription) throw new Error('no SIC classification')
    return `${j.profile.sicDescription} · wiki=${j.wiki ? 'yes' : 'no'}`
  }},

  { group: 'equities', path: '/live-data/market-calendar', name: 'market-calendar', check: (j) => {
    if (j.configured === false) return unconfigured('no FMP key configured (honestly reported)')
    if (!j.ok) throw new Error('not ok but reports configured')
    const n = (j.earnings ?? []).length + (j.economic ?? []).length
    if (n === 0) return empty('configured but 0 events')
    return `${(j.earnings ?? []).length} earnings, ${(j.economic ?? []).length} economic`
  }},

  // Alpha Vantage's IPO_CALENDAR, on its free tier (25 requests a day). The route
  // reports why it has no events (`reason`, `detail`) and never claims "no IPOs
  // scheduled" on a failed request, so neither does this check.
  { group: 'equities', path: '/live-data/ipo-calendar', name: 'ipo-calendar', check: (j) => {
    if (j.configured === false) return unconfigured('no Alpha Vantage key configured (honestly reported)')
    if (!j.ok) throw new Error(`${j.reason ?? 'not ok'}: ${j.detail ?? 'no detail'}`)
    const n = (j.events ?? []).length
    if (n === 0) return empty('configured, answered, and lists 0 upcoming IPOs')
    return `${n} upcoming IPOs via ${j.source}`
  }},

  // ── Funds ───────────────────────────────────────────────────────────────────
  { group: 'funds', path: '/live-data/fund-universe', name: 'fund-universe', check: (j) => {
    if (!j.ok || !Array.isArray(j.entries) || j.entries.length === 0) throw new Error('no fund entries')
    if (j.source === 'catalog') return fallback(`${j.entries.length} funds from static catalog`)
    // Live path: entries carries only the rich catalog; discoveries ship as
    // compact {symbol,name} lists (F3 payload fix). Count both, honestly.
    const discovered = j.discovered ?? 0
    if (discovered === 0) throw new Error('source=live but zero discovered funds')
    return `${j.entries.length} catalog + ${discovered} discovered funds, source=${j.source}`
  }},

  // VOO is the representative case: an open-end fund that files N-PORT, so the
  // keyless SEC path should return the FULL book (~500 names). This is the test
  // that proves the primary holdings source actually works.
  { group: 'funds', path: '/live-data/fund-holdings?symbol=VOO', name: 'fund-holdings (VOO, N-PORT filer)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const h = j.holdings ?? []
    if (h.length === 0) throw new Error('no holdings')
    if (j.source === 'catalog') {
      return fallback(`only ${h.length} indicative holdings from static catalog — SEC N-PORT lookup failed for an N-PORT filer`)
    }
    if (!j.full || h.length < 100) return fallback(`${h.length} holdings via ${j.source} (partial book, full=${j.full})`)
    // N-PORT is filed quarterly and lands ~60 days after period end, so a book
    // older than ~8 months means the filing chain went stale, not just lagged.
    const ageDays = j.asOf ? (Date.now() - new Date(j.asOf).getTime()) / 86_400_000 : null
    if (ageDays != null && ageDays > 240) {
      return fallback(`${h.length} holdings via ${j.source} but asOf=${j.asOf} is ${Math.round(ageDays)} days stale`)
    }
    return `${h.length} holdings via ${j.source}, asOf=${j.asOf}`
  }},

  // SPY is a unit investment trust, NOT an open-end fund — UITs do not file
  // N-PORT at all, so falling back to the catalog's indicative top holdings is
  // correct here rather than a failure. Pinned as a test so nobody "fixes" the
  // SEC lookup to chase a filing that will never exist.
  { group: 'funds', path: '/live-data/fund-holdings?symbol=SPY', name: 'fund-holdings (SPY, UIT — catalog expected)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const h = j.holdings ?? []
    if (h.length === 0) throw new Error('no holdings at all')
    if (j.source === 'catalog') {
      return fallback(`${h.length} indicative holdings from catalog — expected: SPY is a UIT and files no N-PORT`)
    }
    return `${h.length} holdings via ${j.source} (unexpectedly better than catalog)`
  }},

  // T-420 item 2: IEF files a 497K summary prospectus with each annual 485BPOS,
  // so the link must be the summary, dated on or after that update and within
  // ~14 months (an annual filer older than that has stopped filing or the chain
  // broke). SPY, a trust outside the mutual-fund map, must get no link at all.
  { group: 'funds', path: '/live-data/fund-prospectus?symbol=IEF', name: 'fund-prospectus (IEF, 497K filer)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const p = j.prospectus
    if (!p) throw new Error(`no prospectus: ${j.reason ?? 'no reason given'}`)
    if (p.kind !== 'summary') return fallback(`${p.kind} filed ${p.filedAt}, expected the 497K summary prospectus`)
    if (p.url === p.indexUrl) return fallback(`summary filed ${p.filedAt}, but only the EDGAR index page — the document lookup failed`)
    const ageDays = (Date.now() - new Date(p.filedAt).getTime()) / 86_400_000
    if (ageDays > 430) return fallback(`summary filed ${p.filedAt} is ${Math.round(ageDays)} days old`)
    return `summary prospectus filed ${p.filedAt}`
  }},
  { group: 'funds', path: '/live-data/fund-prospectus?symbol=SPY', name: 'fund-prospectus (SPY, trust — none expected)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    if (j.prospectus) throw new Error(`SPY got a prospectus link (${j.prospectus.url}); it files no 497K or 485BPOS, so this is another fund's document`)
    return `no link, as expected: ${String(j.reason ?? '').slice(0, 80)}`
  }},

  { group: 'funds', path: '/live-data/fund-holdings-history?symbol=SPY', name: 'fund-holdings-history (SPY)', check: (j) => {
    if (!j.ok) {
      const e = String(j.error ?? '')
      if (/FMP_API_KEY|no SEC N-PORT/i.test(e)) return unconfigured(`no N-PORT series and no FMP key: ${e.slice(0, 90)}`)
      throw new Error(e || 'not ok')
    }
    return `${(j.changes ?? j.diffs ?? []).length} quarter-over-quarter changes`
  }},

  // ── Macro ───────────────────────────────────────────────────────────────────
  //
  // The Macro module shipped 2026-07-21 and this harness was never extended to
  // cover it, so four routes went untested for a week and DATA-AVAILABILITY.md
  // had no rows it could honestly fill — running the audit could not answer a
  // question the audit never asked. Added 2026-07-29.
  //
  // All four upstreams are keyless, so there is no UNCONFIGURED path here: a
  // failure is a real failure.

  { group: 'macro', path: '/live-data/macro-news?limit=20', name: 'macro-news (RSS feeds)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const a = j.articles ?? []
    if (a.length === 0) throw new Error('no articles — every macro feed failed upstream')
    // The pillar classifier is the point of this route: articles matching no
    // pillar are dropped, so a feed that returns only unclassifiable items
    // looks identical to a dead feed unless we count pillars.
    const pillars = new Set(a.map((x) => x.pillar).filter(Boolean))
    if (pillars.size === 0) return fallback(`${a.length} articles but none classified into a pillar`)
    if (pillars.size === 1) return fallback(`${a.length} articles, only one pillar (${[...pillars][0]}) — other feeds likely down`)
    return `${a.length} articles across ${pillars.size} pillars (${[...pillars].join(', ')})`
  }},

  { group: 'macro', path: '/live-data/fx-rates', name: 'fx-rates (ECB official tier)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const n = Object.keys(j.rates ?? {}).length
    if (n === 0) throw new Error('no rates returned')
    if (j.source !== 'frankfurter-ecb') return fallback(`${n} rates from unexpected source=${j.source}`)
    // ECB publishes ~30 reference currencies; materially fewer means a partial
    // response being presented as the complete official set.
    if (n < 25) return fallback(`only ${n} currencies — ECB publishes ~30, this looks partial`)
    return `${n} currencies, date=${j.date}, source=${j.source}`
  }},

  { group: 'macro', path: '/live-data/fx-rates-extended', name: 'fx-rates-extended (community tier)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const n = Object.keys(j.rates ?? {}).length
    if (n === 0) throw new Error('no extended rates returned')
    // `missing` is the route's own honesty signal: allowlisted codes the feed
    // did not price. Non-empty means the converter silently offers fewer
    // currencies than the UI implies.
    const missing = (j.missing ?? []).length
    if (missing > 0) return fallback(`${n} currencies but ${missing} allowlisted codes unpriced (${(j.missing ?? []).slice(0, 5).join(', ')}…)`)
    return `${n} extended currencies, date=${j.date}`
  }},

  { group: 'macro', path: '/live-data/treasury-yield-curve', name: 'treasury-yield-curve (treasury.gov)', check: (j) => {
    if (!j.ok) throw new Error(j.error ?? 'not ok')
    const pts = Object.keys(j.latest?.points ?? j.latest ?? {}).length
    if (!j.latest) throw new Error('no latest curve snapshot')
    if (j.source !== 'treasury-gov') return fallback(`curve from unexpected source=${j.source}`)
    if (j.spread2s10s == null || j.spread3m10y == null) {
      return fallback(`curve present but spreads not computed (2s10s=${j.spread2s10s}, 3m10y=${j.spread3m10y})`)
    }
    return `${pts} maturities, 2s10s=${j.spread2s10s}, 3m10y=${j.spread3m10y}, shape=${j.shape}`
  }},

  // No source since 2026-08-06: dated contract months were priced through Yahoo,
  // removed on terms, and nothing else the app can reach quotes them. The route
  // still resolves the months and answers ok:false with the reason. Gold is a
  // liquid contract, so a refusal for thin markets cannot stand in for that.
  { group: 'macro', path: '/live-data/futures-curve?slug=gold', name: 'futures-curve gold (no source)', check: (j) => {
    if (j.ok && (j.points ?? []).length > 0) return `${j.points.length} contract months priced — a dated-contract source is back`
    if (!j.error) throw new Error('ok:false with no reason: the route must say why there is no curve')
    if (!(j.unresolved ?? []).length) throw new Error(`no contract months resolved, so the failure is not the missing source: ${j.error}`)
    return unconfigured(`no source (Yahoo removed on terms, 2026-08-06): ${j.unresolved.length} contract months resolved, none priced`)
  }},

  // DATA-AVAILABILITY item 18: macro instrument quotes were the one row still
  // "Not measured". They ride the same security-quotes ladder as equities, but
  // their coverage is a separate question — Tiingo does not carry futures or FX
  // pairs at all, so which of these three answer depends entirely on WHICH
  // keyed provider is configured, and the honest expectation is partial.
  // Symbols are encoded because '=' is meaningful in a query string.
  { group: 'macro', path: `/live-data/security-quotes?symbols=${encodeURIComponent('GC=F,EURUSD=X,ZN=F')}`,
    name: 'macro quotes (gold / EURUSD / 10y future)', check: (j) => {
      if (!j.ok || !j.quotes) throw new Error('no quotes payload')
      const asked = ['GC=F', 'EURUSD=X', 'ZN=F']
      const rows = asked.map((sym) => [sym, j.quotes[sym]])
      const priced = rows.filter(([, q]) => q && typeof q.price === 'number' && !q.reference)
      const ref = rows.filter(([, q]) => q && q.reference)
      const missing = rows.filter(([, q]) => !q).map(([sym]) => sym)

      // No keyed provider at all is a CONFIGURATION state, not a failure: the
      // route is behaving correctly by declining to invent a price.
      if (priced.length === 0 && ref.length === 0) {
        return unconfigured(`no keyed provider served any macro quote (source=${j.source}; missing: ${missing.join(', ') || 'none'})`)
      }
      if (priced.length === 0) {
        return fallback(`all ${ref.length} macro quotes are catalog reference values (source=${j.source})`)
      }
      if (priced.length < asked.length) {
        // Expected on most configurations — say which, so the gap is a fact
        // rather than a suspicion.
        return fallback(`${priced.length}/${asked.length} live via ${j.source}; reference: ${ref.map(([s]) => s).join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`)
      }
      return `${priced.length}/${asked.length} live via ${j.source}`
    }},

  // ── Config / infra ──────────────────────────────────────────────────────────
  { group: 'infra', path: '/live-data/config', name: 'config (no key leakage)', quick: true, check: (j) => {
    if (!Array.isArray(j.providers)) throw new Error('no providers array')
    const leaked = j.providers.find((p) => p.config && p.config.apiKey)
    if (leaked) throw new Error(`API key leaked to client for ${leaked.id}`)
    return `${j.providers.length} providers, no keys leaked`
  }},

  { group: 'infra', path: '/live-data/config', name: 'config (llm providers)', check: (j) => {
    const llm = (j.providers ?? []).filter((p) => p.category === 'llm')
    if (llm.length < 5) throw new Error(`only ${llm.length} llm providers`)
    if (llm.some((p) => p.config?.apiKey)) throw new Error('llm api key leaked to client')
    const ids = llm.map((p) => p.id)
    if (!ids.includes('anthropic') || !ids.includes('openai')) throw new Error('missing core llm providers')
    return `${llm.length} llm providers, no keys leaked`
  }},

  // GET reads the in-repo terms registry, which /data-sources renders. The POST
  // probes an arbitrary site's robots.txt and terms, and is not called here.
  { group: 'infra', path: '/live-data/source-terms', name: 'source-terms (registry, GET only)', check: (j) => {
    const entries = j.entries ?? []
    if (!j.ok || !Array.isArray(entries) || entries.length === 0) throw new Error('no registry entries')
    const p = j.provenance ?? {}
    if (p.total !== entries.length) throw new Error(`provenance counts ${p.total} entries, the registry has ${entries.length}`)
    return `${entries.length} entries: ${p.verified} verified, ${p.seeded} seeded, ${p.prohibited} prohibited; oldest reading ${p.reviewedAt} (${p.ageDays} days)`
  }},

  // ── /api/v1 (agent-facing) ──────────────────────────────────────────────────
  { group: 'api/v1', path: '/api/v1/', name: 'v1 discovery', quick: true, check: (j, s, h) => {
    if (!Array.isArray(j.endpoints)) throw new Error('no endpoints')
    if (h.get('access-control-allow-origin') !== '*') throw new Error('missing CORS header')
    return `${j.endpoints.length} endpoints, CORS ok`
  }},

  { group: 'api/v1', path: '/api/v1/prices?coins=btc,eth', name: 'v1 prices', check: (j) => {
    const obj = j.prices ?? j.data ?? {}
    const n = Object.keys(obj).length
    if (n < 1) throw new Error('no prices')
    return `${n} coins`
  }},

  { group: 'api/v1', path: '/api/v1/exchanges', name: 'v1 exchanges', check: (j) => {
    const arr = j.exchanges ?? j.data ?? []
    if (arr.length < 10) throw new Error(`only ${arr.length} exchanges`)
    return `${arr.length} exchanges`
  }},

  { group: 'api/v1', path: '/api/v1/network-fees', name: 'v1 network-fees', check: (j) => {
    const n = Object.keys(j.fees ?? {}).length
    if (n < 10) throw new Error(`only ${n} networks`)
    return `${n} networks`
  }},

  { group: 'api/v1', path: '/api/v1/staking/opportunities?coin=eth', name: 'v1 staking (taxonomy)', check: (j) => {
    const arr = j.opportunities ?? []
    if (arr.length === 0) throw new Error('no opportunities')
    const aprs = arr.map((i) => i.apr ?? i.apy).filter(Number.isFinite)
    if (!aprs.every((a) => a >= 0 && a < 100)) throw new Error(`APR out of range: ${aprs.join(',')}`)
    const leak = arr.filter((i) => i.stakesQueriedAsset === false)
    if (leak.length) throw new Error(`governance/lending leaked into default ETH staking: ${leak.map((i) => i.provider).join(',')}`)
    return `${arr.length} ETH options, APR ${Math.min(...aprs).toFixed(1)}–${Math.max(...aprs).toFixed(1)}%`
  }},

  { group: 'api/v1', path: '/api/v1/staking/opportunities?coin=eth&include_adjacent=true', name: 'v1 staking (include_adjacent)', check: (j) => {
    const arr = j.opportunities ?? []
    const adj = arr.filter((i) => i.stakesQueriedAsset === false)
    if (adj.length === 0) throw new Error('include_adjacent surfaced nothing')
    return `${adj.length} adjacent yield products surfaced`
  }},

  { group: 'api/v1', path: '/api/v1/news?coin=btc&limit=5', name: 'v1 news', check: (j) => {
    const arr = j.articles ?? j.news ?? []
    if (arr.length === 0) throw new Error('no articles')
    return `${arr.length} articles`
  }},

  // Transfer Fees was held out of the initial rollout on 2026-08-22 (owner), so
  // this endpoint answers 503 by design and the matching MCP tool is commented
  // out. Both checks assert the hold: the parameter-validation case can't be
  // tested while the endpoint is withheld, because the 503 is returned before
  // any parameter is looked at — pretending otherwise would test nothing.
  //
  // WHEN TRANSFER FEES IS RESTORED: revert both of these to the real
  // assertions — routes array non-empty, and missing params → 400.
  { group: 'api/v1', path: '/api/v1/transfer/routes?from=binance&to=coinbase&coin=usdt&amount=1000', name: 'v1 transfer routes (withheld)', expectStatus: 503, check: (j, s) => {
    if (s === 503) return 'correctly withheld — Transfer Fees held from rollout 2026-08-22'
    if (s === 200 && Array.isArray(j?.routes)) throw new Error(`route is LIVE again (${j.routes.length} routes) — restore the real assertion in this harness`)
    throw new Error(`expected 503 (withheld); got ${s}`)
  }},

  { group: 'api/v1', path: '/api/v1/transfer/routes', name: 'v1 transfer (withheld before param check)', expectStatus: 503, check: (j, s) => {
    if (s === 503) return 'correctly withheld — 503 precedes parameter validation'
    if (s === 400) throw new Error('400 means the endpoint is live again — restore the real assertion in this harness')
    throw new Error(`expected 503 (withheld); got ${s}`)
  }},

  // The four routes below are what the MCP server's get_security_quotes,
  // get_security_history, get_yield_curve and get_fx_rates read. None was called
  // here before 2026-10-14. Each mirrors its /live-data sibling's check and adds
  // the CORS header every /api/v1 response must carry.
  { group: 'api/v1', path: '/api/v1/securities/quotes?symbols=AAPL,VOO', name: 'v1 securities quotes', check: (j, s, h) => {
    if (h.get('access-control-allow-origin') !== '*') throw new Error('missing CORS header')
    const all = Object.entries(j.quotes ?? {})
    if (all.length === 0) throw new Error(`no quotes (missing: ${(j.missing ?? []).join(', ')})`)
    const ref = all.filter(([, q]) => q.reference)
    if (j.source === 'reference' || ref.length === all.length) return fallback(`all ${all.length} quotes are catalog reference prices (source=${j.source})`)
    const aapl = j.quotes.AAPL
    if (!aapl || !(aapl.price > 10 && aapl.price < 5000)) throw new Error(`AAPL price implausible: ${aapl?.price}`)
    if (ref.length) return fallback(`${all.length - ref.length}/${all.length} live via ${j.source}; reference: ${ref.map(([k]) => k).join(', ')}`)
    return `${all.length}/${all.length} live via ${j.source}`
  }},

  // No reference fallback here: with no price-history key the route answers 502
  // with the setup instruction, which is honest, so it reads as UNCONFIGURED.
  { group: 'api/v1', path: '/api/v1/securities/history?symbol=AAPL&range=6mo', name: 'v1 securities history', expectStatus: [200, 502], check: (j, s, h) => {
    if (h.get('access-control-allow-origin') !== '*') throw new Error('missing CORS header')
    if (s === 502) {
      if (/No price-history provider is configured/.test(j.error ?? '')) return unconfigured(j.error)
      throw new Error(`502: ${j.error ?? 'no error message'}`)
    }
    const pts = j.points ?? []
    if (pts.length < 80) throw new Error(`sparse series: ${pts.length} points`)
    if (!j.source) throw new Error('no source named (review V4: every public route names its provider)')
    return `${pts.length} daily closes via ${j.source}`
  }},

  { group: 'api/v1', path: '/api/v1/macro/yield-curve', name: 'v1 macro yield-curve', check: (j, s, h) => {
    if (h.get('access-control-allow-origin') !== '*') throw new Error('missing CORS header')
    if (!j.latest) throw new Error('no latest curve snapshot')
    if (j.source !== 'treasury-gov') return fallback(`curve from unexpected source=${j.source}`)
    if (j.spread2s10s == null || j.spread3m10y == null) return fallback(`spreads not computed (2s10s=${j.spread2s10s}, 3m10y=${j.spread3m10y})`)
    return `date=${j.latest.date}, 2s10s=${j.spread2s10s}, shape=${j.shape}`
  }},

  { group: 'api/v1', path: '/api/v1/macro/fx-rates?symbols=EUR,JPY', name: 'v1 macro fx-rates', check: (j, s, h) => {
    if (h.get('access-control-allow-origin') !== '*') throw new Error('missing CORS header')
    const eur = j.rates?.EUR, jpy = j.rates?.JPY
    if (!(eur > 0.5 && eur < 2)) throw new Error(`EUR per USD implausible: ${eur}`)
    if (!(jpy > 50 && jpy < 300)) throw new Error(`JPY per USD implausible: ${jpy}`)
    if (j.source !== 'frankfurter-ecb') return fallback(`rates from unexpected source=${j.source}`)
    return `EUR=${eur}, JPY=${jpy}, date=${j.date}`
  }},

  // Switched off with every risk rating (D64, 2026-10-04): 503 with a reason.
  { group: 'api/v1', path: '/api/v1/options/score', name: 'v1 options score (withheld, D64)', expectStatus: 503, check: (j, s) => {
    if (s !== 503) throw new Error(`expected 503 (withheld); got ${s}`)
    if (!j.reason) throw new Error('503 with no reason: a caller must learn why it is withheld')
    return 'correctly withheld: risk ratings are switched off (D64)'
  }},

  { group: 'api/v1', path: '/api/v1/openapi.json', name: 'v1 openapi', check: (j) => {
    if (!j.openapi || !j.paths) throw new Error('not a valid openapi doc')
    return `openapi ${j.openapi}, ${Object.keys(j.paths).length} paths`
  }},

  { group: 'agents', path: '/api/agents/prompts', name: 'agent prompts list', check: (j, s, h) => {
    // Keep in sync with AGENT_DEFAULTS in src/lib/agents/prompts.ts
    const expected = ['app-assistant', 'research-analyst', 'data-scraper', 'pump-report-investigator', 'pump-report-chat',
      'equity-research', 'equity-data-scraper', 'equity-diligence', 'equity-screener', 'macro-research', 'macro-screener']
    if (!Array.isArray(j.agents)) throw new Error('no agents array')
    const ids = j.agents.map((a) => a.id)
    const missing = expected.filter((id) => !ids.includes(id))
    if (missing.length > 0) throw new Error(`missing agents: ${missing.join(', ')}`)
    if (h.get('access-control-allow-origin') !== '*') throw new Error('missing CORS header')
    return `${j.agents.length} agents, CORS ok`
  }},
]

// ── Cross-layer consistency ───────────────────────────────────────────────────
// Folded in from the former scripts/smoke.mjs. /live-data/network-fees and
// /api/v1/network-fees read the same shared module, so a divergence means one
// layer grew its own gas assumptions. The static gas amount must match exactly;
// the USD figure gets a small tolerance for price movement between the two
// requests.
//
// This is also a regression guard for the harness itself: the old smoke test
// counted `j.networks ?? j.fees ?? j` and, because /live-data returns neither
// key, silently fell through to counting the 5 TOP-LEVEL keys of the envelope
// and reported "5 networks" as a pass. Both layers really carry 18.
async function crossLayerChecks() {
  const out = []
  try {
    const [ld, v1] = await Promise.all([
      getJson('/live-data/network-fees'),
      getJson('/api/v1/network-fees'),
    ])
    const a = ld.json?.networkFees ?? {}
    const b = v1.json?.fees ?? {}

    const aKeys = Object.keys(a).length
    const bKeys = Object.keys(b).length
    out.push(aKeys === bKeys && aKeys >= 10
      ? { name: 'network count matches across layers', verdict: REAL, detail: `${aKeys} networks both layers`, ms: ld.ms + v1.ms, group: 'cross-layer' }
      : { name: 'network count matches across layers', verdict: FAIL, detail: `live=${aKeys} v1=${bKeys}`, ms: ld.ms + v1.ms, group: 'cross-layer' })

    for (const net of ['erc20', 'bitcoin']) {
      const an = a[net], bn = b[net]
      const near = an && bn && Math.abs(an.feeUsd - bn.feeUsd) <= Math.abs(bn.feeUsd) * 0.02
      out.push({
        name: `${net} feeUsd agrees across layers (≤2%)`,
        verdict: near ? REAL : FAIL,
        detail: `live=${an?.feeUsd} v1=${bn?.feeUsd}`, ms: 0, group: 'cross-layer',
      })
      const exact = an && bn && an.feeNative === bn.feeNative
      out.push({
        name: `${net} feeNative identical (static gas, no drift)`,
        verdict: exact ? REAL : FAIL,
        detail: `live=${an?.feeNative} v1=${bn?.feeNative}`, ms: 0, group: 'cross-layer',
      })
    }

    out.push({
      name: 'bitcoin fee is live (mempool.space)',
      verdict: a.bitcoin?.source === 'live' ? REAL : FALLBACK,
      detail: `source=${a.bitcoin?.source}`, ms: 0, group: 'cross-layer',
    })
  } catch (e) {
    out.push({ name: 'cross-layer network-fees', verdict: FAIL, detail: String(e), ms: 0, group: 'cross-layer' })
  }
  return out
}

// ── Runner ────────────────────────────────────────────────────────────────────
const run = async () => {
  const selected = QUICK ? tests.filter((t) => t.quick) : tests


  for (const t of selected) {
    // ── CoinGecko pacing (DATA-AVAILABILITY item 17) ──────────────────────────
    // An audit whose own load changes the answer is worse than no audit: it sends
    // the next reader to debug a route that works. scripts/lib/coingeckoPacing.mjs
    // records why adjacency was the wrong model, and why a per-check weight was
    // still needed after the sliding window replaced it.
    if (isCoinGeckoBacked(t)) await cgPacer.pace(coinGeckoWeight(t))

    try {
      const { status, json, headers, ms } = await getJson(t.path)

      // A test may DECLARE the status it expects. Without this the runner
      // decided what counted as an error by pattern-matching the test's display
      // NAME (/→ 4\d\d/), so a check asserting a deliberate 404 or 503 could
      // never run: the gates below rejected it first and the assertion was
      // unreachable. That is exactly how the four withdrawn-route checks kept
      // reporting FAIL on 2026-09-03 after being rewritten to assert the
      // removal. Intent belongs in a field, not in a string a human might edit.
      const expected = t.expectStatus == null
        ? null
        : (Array.isArray(t.expectStatus) ? t.expectStatus : [t.expectStatus])
      if (expected) {
        if (!expected.includes(status)) {
          results.push({
            ...t, verdict: FAIL, ms,
            detail: `expected HTTP ${expected.join(' or ')}, got ${status}${json?.error ? `: ${json.error}` : ''}`,
          })
          continue
        }
        // Expected status reached — hand it to check(), which decides the verdict.
        // json is null for an HTML error body, so check() gets {} and reads `status`.
      } else {
        const expectsError = /→ 4\d\d/.test(t.name)
        if (json === null && status >= 400 && !expectsError) {
          results.push({ ...t, verdict: FAIL, detail: `HTTP ${status}, non-JSON body`, ms })
          continue
        }
        if (status >= 500) {
          results.push({ ...t, verdict: FAIL, detail: `HTTP ${status}: ${json?.error ?? 'server error'}`, ms })
          continue
        }
      }
      const r = t.check(json ?? {}, status, headers)
      if (typeof r === 'object' && r?.verdict) {
        results.push({ ...t, verdict: r.verdict, detail: r.detail, ms })
      } else {
        results.push({ ...t, verdict: REAL, detail: typeof r === 'string' ? r : `HTTP ${status}`, ms })
      }
    } catch (e) {
      results.push({ ...t, verdict: FAIL, detail: e.message, ms: 0 })
    }
  }

  if (!QUICK) results.push(...await crossLayerChecks())

  const by = (v) => results.filter((r) => r.verdict === v)
  const fails = by(FAIL)
  const fallbacks = by(FALLBACK)
  const unconf = by(UNCONFIGURED)
  const empties = by(EMPTY)

  if (JSON_OUT) {
    console.log(JSON.stringify({
      base: BASE, mode: QUICK ? 'quick' : 'full', ranAt: new Date().toISOString(),
      counts: { real: by(REAL).length, fallback: fallbacks.length, unconfigured: unconf.length, empty: empties.length, fail: fails.length },
      results: results.map((r) => ({ name: r.name, group: r.group, path: r.path, verdict: r.verdict, detail: r.detail, ms: r.ms })),
      notAudited: Object.entries(NOT_AUDITED).map(([path, reason]) => ({ path, reason })),
    }, null, 2))
    process.exit(fails.length === 0 && (!STRICT || fallbacks.length + empties.length === 0) ? 0 : 1)
  }

  console.log(`\n══════════ FINANCE NOW LIVE-DATA AUDIT ${QUICK ? '(quick)' : '(full)'} → ${BASE} ══════════\n`)
  let lastGroup = ''
  for (const r of results) {
    if (r.group !== lastGroup) { console.log(`\n── ${r.group} ──`); lastGroup = r.group }
    const lat = r.ms ? String(r.ms).padStart(5) + 'ms' : '       '
    console.log(`${ICON[r.verdict]} ${r.verdict.padEnd(12)} ${lat}  ${r.name.padEnd(42)} ${r.detail ?? ''}`)
  }

  console.log('\n────────────────────────── SUMMARY ──────────────────────────')
  console.log(`🟢 REAL          ${by(REAL).length}`)
  console.log(`🟡 FALLBACK      ${fallbacks.length}   (HTTP 200 but NOT the intended live source)`)
  console.log(`🔑 UNCONFIGURED  ${unconf.length}   (key-gated or withheld by decision, honestly reported)`)
  console.log(`⚪ EMPTY         ${empties.length}`)
  console.log(`🔴 FAIL          ${fails.length}`)

  if (fallbacks.length) {
    console.log('\n⚠  SILENT DEGRADATION — these return 200 and look healthy:')
    for (const r of fallbacks) console.log(`   • ${r.name}: ${r.detail}`)
  }
  if (empties.length) {
    console.log('\n⚪ EMPTY responses:')
    for (const r of empties) console.log(`   • ${r.name}: ${r.detail}`)
  }
  if (fails.length) {
    console.log('\n🔴 FAILURES:')
    for (const r of fails) console.log(`   • ${r.name}: ${r.detail}`)
  }

  // Said on every run, so "0 failing" is never read as covering these.
  if (!QUICK) {
    console.log(`\n⊘  NOT CALLED, on purpose (${Object.keys(NOT_AUDITED).length}; scripts/lib/auditCoverage.mjs):`)
    for (const [path, reason] of Object.entries(NOT_AUDITED)) console.log(`   • ${path}: ${reason}`)
  }

  const slow = results.filter((r) => r.ms > 3000).sort((a, b) => b.ms - a.ms)
  if (slow.length) {
    console.log('\n🐢 SLOW (>3s):')
    for (const r of slow) console.log(`   • ${r.name}: ${(r.ms / 1000).toFixed(1)}s`)
  }

  // Say what the pacing cost, or the run just looks mysteriously slow and someone
  // "optimises" the throttle back out — which is how the 429s returned last time.
  if (cgPacer.pacedMs > 0) {
    console.log(`\n⏸  CoinGecko pacing held the run for ${(cgPacer.pacedMs / 1000).toFixed(1)}s`
      + ` (${COINGECKO_MAX_PER_WINDOW}/min cap, ${COINGECKO_MIN_GAP_MS}ms min gap,`
      + ` coin-list weighted ${COINGECKO_CALL_WEIGHT['/live-data/coin-list']} calls).`)
    console.log('   That is deliberate: without it coin-discovery, alerts and')
    console.log('   portfolio-history 429 and read as broken routes. Tune with')
    console.log('   AUDIT_CG_PER_MIN / AUDIT_CG_GAP_MS if the limit changes.')
  }

  console.log('')
  const bad = fails.length + (STRICT ? fallbacks.length + empties.length : 0)
  process.exit(bad === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('Audit run crashed:', e)
  process.exit(1)
})
