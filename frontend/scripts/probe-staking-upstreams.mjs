#!/usr/bin/env node
// Which of the 17 staking upstreams still serve a live APR?
// — RUN THIS ON THE OWNER'S MACHINE. Every host here is blocked at the gateway
//   from a cloud session (all 17 answered HTTP 403 on 2026-09-09), so a cloud
//   run produces a uniformly wrong "everything is dead" baseline. Same rule as
//   the data audits: availability verdicts come from the owner's network.
//
// Why this exists. The 2026-09-09 owner-machine audit reported `4/51 live` for
// /live-data/staking-rates. The route now reports each upstream's outcome, so a
// second audit run names the failures — but naming them is not the same as
// FIXING them, and the three cures are mutually exclusive:
//
//   • dead endpoint      → the URL moved or the service shut down. Find the new
//                          one, or drop the rung and keep the static fallback.
//   • reachable, no rate → the endpoint answers 200 but the FIELD moved. The URL
//                          is fine; only the parse path is stale. This is the
//                          failure that hides, because a stale parse and a
//                          healthy estimate look identical from outside.
//   • timeout            → reachable but slow from here. Neither of the above;
//                          raising the 6s budget may be the whole fix.
//
// The route cannot tell you which, because it discards the body it could not
// parse. This probe keeps it: on a 200 that yields no number it prints a body
// EXCERPT, which is what makes the corrected parse path writable from one run.
//
// Usage:  npm run staking-upstreams          (no dev server required)
//         npm run staking-upstreams -- --json
//
// Exit 0 = every upstream produced a number.
// Exit 1 = at least one did not. That is a real result, not a harness failure.

const JSON_OUT = process.argv.includes('--json')
const out = (s) => { if (!JSON_OUT) process.stdout.write(s) }

const TIMEOUT_MS = 6_000   // the route's own per-fetch budget — keep in step
const JSONH = { Accept: 'application/json' }
const POST_EMPTY = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }

// ─── Parse helpers, mirroring the route ──────────────────────────────────────
const num = (v) => { const n = parseFloat(v ?? ''); return Number.isFinite(n) ? n : null }

function extractNumber(data, ...keys) {
  if (data == null || typeof data !== 'object') return null
  for (const k of keys) { const n = num(data[k]); if (n != null) return n }
  return null
}

// ─── The 17 upstreams ────────────────────────────────────────────────────────
// `name` matches the key the route reports in its `upstreams` map, so a row
// here and a row in `npm run audit` are the same upstream. `parse` mirrors the
// route's own expression: this probe answers "would the SHIPPING code find a
// number in this body", never "is there a number in here somewhere".
// __tests__/stakingUpstreamProbe.test.ts fails if a URL here is absent from the
// route or vice versa, so the two cannot drift apart unnoticed.
const UPSTREAMS = [
  { name: 'lido-eth', url: 'https://eth-api.lido.fi/v1/protocol/steth/apr/sma', init: { headers: JSONH },
    parse: (d) => num(d?.data?.aprs?.[0]?.apr) ?? num(d?.data?.smaApr) },
  { name: 'rocketpool-eth', url: 'https://api.rocketpool.net/api/apr', init: { headers: JSONH },
    parse: (d) => num(d?.yearlyAPR) ?? num(d?.currentAPR) ?? num(d?.apr) },
  { name: 'marinade-sol', url: 'https://api.marinade.finance/msol/apy/1y', init: { headers: JSONH },
    parse: (d) => (typeof d === 'number' ? d : extractNumber(d, 'value', 'apy')) },
  { name: 'jito-sol', url: 'https://kobe.mainnet.jito.network/api/v1/stake_pool_stats', init: { headers: JSONH },
    parse: (d) => {
      const series = Array.isArray(d?.apy) ? d.apy : null
      const latest = series?.[series.length - 1]
      if (typeof latest?.data === 'number') return latest.data * 100
      return typeof d === 'number' ? d : extractNumber(d, 'value', 'apy')
    } },
  { name: 'stride-cosmos-lsts', url: 'https://edge.stride.zone/api/stake-stats', init: { headers: JSONH },
    // Three keys ride this one response; report it live only if ALL parse, and
    // name the ones that did not — a partial is a real state, not a pass.
    parse: (d) => {
      const got = ['atom', 'inj', 'tia'].filter((k) => num(d?.[k]?.apr) ?? num(d?.[k.toUpperCase()]?.apr))
      return got.length === 3 ? got.length : (got.length ? { partial: got } : null)
    } },
  { name: 'cosmoshub-native', url: 'https://api-cosmoshub-ia.cosmostation.io/cosmos/mint/v1beta1/inflation', init: { headers: JSONH },
    parse: (d) => num(d?.inflation) },
  { name: 'osmosis-native', url: 'https://api-osmosis.cosmostation.io/cosmos/mint/v1beta1/inflation', init: { headers: JSONH },
    parse: (d) => num(d?.inflation) },
  { name: 'polkadot-native', url: 'https://polkadot.webapi.subscan.io/api/v2/scan/staking_apy', init: POST_EMPTY,
    parse: (d) => num(d?.data?.apy) ?? num(d?.apy) },
  { name: 'kusama-native', url: 'https://kusama.webapi.subscan.io/api/v2/scan/staking_apy', init: POST_EMPTY,
    parse: (d) => num(d?.data?.apy) ?? num(d?.apy) },
  { name: 'cardano-native', url: 'https://js.adapools.org/global.json', init: { headers: JSONH },
    parse: (d) => num(d?.stats?.delegators?.roa) ?? num(d?.roa) ?? num(d?.apy) },
  { name: 'bnb-native', url: 'https://api.binance.org/v1/staking/asset?assetName=BNB', init: { headers: JSONH },
    parse: (d) => num(d?.data?.annualizedYield) ?? num(d?.annualizedYield) ?? num(d?.apr) },
  { name: 'lido-matic', url: 'https://polygon.lido.fi/api/stats', init: { headers: JSONH },
    parse: (d) => num(d?.apr) ?? num(d?.stMaticApr) ?? num(d?.apy) },
  { name: 'tron-native', url: 'https://apilist.tronscanapi.com/api/trx/staking-info', init: { headers: JSONH },
    parse: (d) => num(d?.data?.stakeYield) ?? num(d?.annualized_rate) ?? num(d?.apr) },
  { name: 'injective-native', url: 'https://lcd.injective.network/cosmos/mint/v1beta1/inflation', init: { headers: JSONH },
    parse: (d) => num(d?.inflation) },
  { name: 'celestia-native', url: 'https://api-celestia-ia.cosmostation.io/cosmos/mint/v1beta1/inflation', init: { headers: JSONH },
    parse: (d) => num(d?.inflation) },
  { name: 'near-native', url: 'https://api.nearblocks.io/v1/stats', init: { headers: JSONH },
    parse: (d) => num(d?.stats?.staking_return) ?? num(d?.staking_return) ?? num(d?.apy) },
  { name: 'defillama-yields', url: 'https://yields.llama.fi/pools', init: { headers: JSONH },
    // The load-bearing one: it alone backs ~24 of the route's live keys, so it
    // is worth more than the other 16 put together. Report the pool count, not
    // a rate — the route matches symbols against this list.
    parse: (d) => (Array.isArray(d?.data) && d.data.length ? d.data.length : null) },
]

// ─── Probe ───────────────────────────────────────────────────────────────────
async function probe(u) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(u.url, { ...u.init, signal: controller.signal })
    const ms = Date.now() - started
    const text = await res.text()
    if (!res.ok) {
      if (blockedLocally(res.status, text)) {
        return { ...base(u, ms), verdict: 'blocked-here', status: res.status,
                 detail: `HTTP ${res.status} from this network's own egress policy — says nothing about the source`,
                 excerpt: excerpt(text) }
      }
      return { ...base(u, ms), verdict: 'http-error', status: res.status,
               detail: `HTTP ${res.status}${res.status === 404 || res.status === 410 ? ' — endpoint gone; find the new URL or drop the rung' : ''}`,
               excerpt: excerpt(text) }
    }
    let data
    try { data = JSON.parse(text) } catch {
      return { ...base(u, ms), verdict: 'not-json', status: res.status,
               detail: 'HTTP 200 but the body is not JSON', excerpt: excerpt(text) }
    }
    let value
    try { value = u.parse(data) } catch (e) {
      return { ...base(u, ms), verdict: 'parse-threw', status: res.status,
               detail: `parse expression threw: ${e instanceof Error ? e.message : String(e)}`, excerpt: excerpt(text) }
    }
    if (value == null) {
      // The hiding failure: the URL is fine, the field moved. Keep the body.
      return { ...base(u, ms), verdict: 'no-rate', status: res.status,
               detail: 'HTTP 200 but the route\'s parse path finds no number — the FIELD moved, not the endpoint',
               excerpt: excerpt(text) }
    }
    if (typeof value === 'object' && value.partial) {
      return { ...base(u, ms), verdict: 'partial', status: res.status,
               detail: `only ${value.partial.join(', ')} parsed of atom, inj, tia`, excerpt: excerpt(text) }
    }
    return { ...base(u, ms), verdict: 'live', status: res.status, value,
             detail: u.name === 'defillama-yields' ? `${value} pools` : `${Number(value).toFixed(2)}` }
  } catch (e) {
    const ms = Date.now() - started
    const aborted = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
    return { ...base(u, ms),
             verdict: aborted ? 'timeout' : 'unreachable',
             detail: aborted
               ? `no answer within ${TIMEOUT_MS / 1000}s — reachable but slow; the budget may be the whole fix`
               : `${e instanceof Error ? e.message : String(e)} — host gone, DNS failure, or blocked from this network` }
  } finally { clearTimeout(timer) }
}

const base = (u, ms) => ({ name: u.name, url: u.url, ms })
const excerpt = (t) => t.replace(/\s+/g, ' ').slice(0, 300)

/**
 * Is this OUR network refusing, rather than the upstream?
 *
 * A sandboxed or proxied run answers 403 for every host with a body naming an
 * egress allowlist. Reporting that as "endpoint gone" would be this probe making
 * the very mistake it exists to catch — the audit row that blamed Reddit's
 * robots gate on a rate limit, in a new place. A local refusal is not evidence
 * about the source, so it gets its own verdict and is excluded from the count.
 */
function blockedLocally(status, body) {
  if (status !== 403 && status !== 407) return false
  return /not in allowlist|egress|proxy|blocked by|forbidden by policy/i.test(body ?? '')
}

const ICON = { live: '🟢', partial: '🟡', 'no-rate': '🟠', 'http-error': '🔴',
               'not-json': '🔴', 'parse-threw': '🔴', timeout: '⏳', unreachable: '🔴',
               'blocked-here': '🚧' }

async function main() {
  out(`\n${'─'.repeat(78)}\n STAKING UPSTREAM PROBE — ${UPSTREAMS.length} sources, ${TIMEOUT_MS / 1000}s budget each\n`)
  out(` Run this on the owner's machine; a cloud run 403s on every host.\n${'─'.repeat(78)}\n\n`)

  const results = await Promise.all(UPSTREAMS.map(probe))

  for (const r of results) {
    out(`${ICON[r.verdict] ?? '⚪'} ${r.verdict.padEnd(11)} ${String(r.ms ?? '').padStart(5)}ms  ${r.name.padEnd(20)} ${r.detail}\n`)
  }

  const live = results.filter((r) => r.verdict === 'live')
  const blocked = results.filter((r) => r.verdict === 'blocked-here')
  const broken = results.filter((r) => r.verdict !== 'live' && r.verdict !== 'blocked-here')
  const judged = results.length - blocked.length

  out(`\n${'─'.repeat(78)}\n ${live.length}/${judged} upstreams serving a rate`)
  if (blocked.length) out(`  (${blocked.length} not judged — blocked by this network)`)
  out(`\n${'─'.repeat(78)}\n`)

  // Refuse to imply a verdict this run cannot support. Most of these hosts
  // failing the same way at once is a local network fact, not 17 dead APIs.
  if (blocked.length >= results.length / 2) {
    out(`\n🚧 THIS RUN PROVES NOTHING ABOUT THE SOURCES.\n`)
    out(`   ${blocked.length} of ${results.length} hosts were refused by this network's egress policy,\n`)
    out(`   which is what a cloud or sandboxed session looks like. Re-run on the\n`)
    out(`   owner's machine; treat nothing below as a verdict on an upstream.\n`)
  }

  // Group the cures, because they are different work — this is the whole point
  // of the probe over the route's own report.
  const group = (v, title, note) => {
    const rows = results.filter((r) => v.includes(r.verdict))
    if (!rows.length) return
    out(`\n${title}\n  ${note}\n`)
    for (const r of rows) {
      out(`  • ${r.name} — ${r.detail}\n    ${r.url}\n`)
      if (r.excerpt) out(`    body: ${r.excerpt}\n`)
    }
  }
  group(['no-rate', 'partial', 'not-json', 'parse-threw'], 'FIELD MOVED — fix the parse path, keep the URL',
        'The endpoint is healthy. Read the body below and correct the expression in the route.')
  group(['http-error', 'unreachable'], 'ENDPOINT GONE — find the new URL, or drop the rung',
        'Do not leave a dead rung in place: it reads as a live source that happens to be failing. '
        + 'If MANY rows land here at once, suspect this network before suspecting the sources.')
  group(['blocked-here'], 'BLOCKED BY THIS NETWORK — not a finding about the source',
        'Our own egress policy refused these. Re-run where they are reachable.')
  group(['timeout'], 'SLOW — no code change may be needed',
        'Re-run before concluding anything; a single timeout is not a verdict.')

  if (JSON_OUT) process.stdout.write(JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2) + '\n')
  // Exit 2 = inconclusive (this network blocked most of it), distinct from
  // exit 1 = upstreams genuinely broken. A caller must be able to tell "the
  // sources are down" from "you ran this in the wrong place".
  if (blocked.length >= results.length / 2) process.exit(2)
  process.exit(broken.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
