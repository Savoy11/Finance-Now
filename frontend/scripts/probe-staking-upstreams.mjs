#!/usr/bin/env node
// Which of the staking upstreams still serve a live APR?
// — RUN THIS ON THE OWNER'S MACHINE. Every host here is refused at the gateway
//   from a cloud session, so a cloud run produces a uniformly wrong "everything
//   is dead" baseline. Same rule as the data audits: availability verdicts come
//   from the owner's network. The probe says so itself and exits 2 when it
//   notices most hosts were blocked locally.
//
// The list is 8 as of 2026-09-09, down from 17: a sequential run on the owner's
// machine found nine rungs genuinely dead (four DNS failures, two now needing a
// Subscan key, two 404s, one serving a marketing page), and they were removed
// from the route. This file mirrors what the route actually fetches — the drift
// test fails if the two disagree.
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
const PARALLEL = process.argv.includes('--parallel')
const out = (s) => { if (!JSON_OUT) process.stdout.write(s) }

// The route's per-fetch budget. Kept in step with it by the drift test, and used
// as a THRESHOLD here, not as this probe's own deadline.
const ROUTE_BUDGET_MS = 6_000

// SEQUENTIAL is the default, and that is the whole correction. The route fires
// every upstream at once under a shared 6s wall-clock; the 2026-09-09 audit showed
// the consequence — upstreams 1-5 answered and 6-17 all "timed out" at exactly 6s,
// in array order. Twelve unrelated hosts on three continents do not fail in array
// order: that was a client-side queueing limit, not twelve slow servers. The
// sequential run that followed found the cause — four DEAD hosts whose DNS lookups
// hung ~10s each, occupying Node's 4-thread resolver pool for longer than the whole
// budget. Removing them was the fix.
//
// This probe's first version made the same mistake (Promise.all over every one), so
// it would have reproduced those false timeouts and reported them as dead hosts —
// the misattribution it exists to prevent, one layer up. Probing one at a time
// gives each host an uncontended attempt, so a timeout here means that host really
// is slow. --parallel deliberately reproduces the route's behaviour: run both and
// the difference between them IS the measurement of contention.
const TIMEOUT_MS = PARALLEL ? ROUTE_BUDGET_MS : 20_000
const JSONH = { Accept: 'application/json' }

// ─── Parse helpers, mirroring the route ──────────────────────────────────────
const num = (v) => { const n = parseFloat(v ?? ''); return Number.isFinite(n) ? n : null }

/**
 * The route's own normalisation: a value under 1 is a fraction, so scale it.
 * Applied here too, or the probe prints a number the app never shows — the
 * 2026-09-09 run reported marinade as "0.06" and injective as "0.04" where the
 * route serves 6% and 4%, which reads as a live-but-wrong rate rather than a
 * healthy one. A diagnostic that disagrees with the thing it diagnoses is worse
 * than no diagnostic.
 */
const normPct = (raw) => (raw < 1 ? raw * 100 : raw)

function extractNumber(data, ...keys) {
  if (data == null || typeof data !== 'object') return null
  for (const k of keys) { const n = num(data[k]); if (n != null) return n }
  return null
}

// ─── The upstreams ───────────────────────────────────────────────────────────
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
    // Shape corrected 2026-09-09: { stats: [ { denom: "ATOM", strideYield, … } ] },
    // an array keyed by denom rather than the { atom: { apr } } map this read
    // before. Three keys ride this one response, so report live only if ALL
    // three parse and name the ones that did not — a partial is a real state.
    parse: (d) => {
      const rows = Array.isArray(d?.stats) ? d.stats : []
      const got = ['ATOM', 'INJ', 'TIA'].filter((denom) => {
        const row = rows.find((r) => (r?.denom ?? '').toUpperCase() === denom)
        const raw = row?.strideYield ?? row?.currentYield
        return typeof raw === 'number' && !isNaN(raw)
      })
      return got.length === 3 ? got.length : (got.length ? { partial: got } : null)
    } },
  { name: 'injective-native', url: 'https://lcd.injective.network/cosmos/mint/v1beta1/inflation', init: { headers: JSONH },
    parse: (d) => num(d?.inflation) },
  { name: 'defillama-yields', url: 'https://yields.llama.fi/pools', init: { headers: JSONH },
    // The load-bearing one: it alone backs ~24 of the route's live keys, so it
    // is worth more than every other rung put together. Report the pool count,
    // not a rate — the route matches symbols against this list.
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
               detail: 'HTTP 200 but the body is not JSON', excerpt: excerpt(text, true) }
    }
    let value
    try { value = u.parse(data) } catch (e) {
      return { ...base(u, ms), verdict: 'parse-threw', status: res.status,
               detail: `parse expression threw: ${e instanceof Error ? e.message : String(e)}`, excerpt: excerpt(text, true) }
    }
    if (value == null) {
      // The hiding failure: the URL is fine, the field moved. Keep the body.
      // Two different causes land here and they need opposite fixes, so do not
      // assert one: the field may have MOVED (reparse, keep the URL), or the
      // endpoint may simply not carry a rate at all (replace or drop the rung).
      // near-native was the second on 2026-09-09 — a healthy network-stats
      // endpoint with no yield field in it — and this line previously said "the
      // FIELD moved", which sent the reader hunting for something never there.
      return { ...base(u, ms), verdict: 'no-rate', status: res.status,
               detail: 'HTTP 200, but no number the route can use — read the body: either the field moved, or this endpoint carries no rate',
               excerpt: excerpt(text, true) }
    }
    if (typeof value === 'object' && value.partial) {
      return { ...base(u, ms), verdict: 'partial', status: res.status,
               detail: `only ${value.partial.join(', ')} parsed of atom, inj, tia`, excerpt: excerpt(text, true) }
    }
    const reading = u.name === 'defillama-yields'
      ? `${value} pools`
      : u.name === 'stride-cosmos-lsts'
        ? `${value}/3 denoms`
        : `${normPct(Number(value)).toFixed(2)}%`
    // Answered, but not inside the window the route allows. Worth separating: the
    // rate exists and the parse works, so no URL or expression needs touching —
    // the route's budget is what would have to move.
    if (!PARALLEL && ms > ROUTE_BUDGET_MS) {
      return { ...base(u, ms), verdict: 'over-budget', status: res.status, value,
               detail: `${reading} — but took ${(ms / 1000).toFixed(1)}s, over the route's ${ROUTE_BUDGET_MS / 1000}s budget` }
    }
    return { ...base(u, ms), verdict: 'live', status: res.status, value, detail: reading }
  } catch (e) {
    const ms = Date.now() - started
    const aborted = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
    return { ...base(u, ms),
             verdict: aborted ? 'timeout' : 'unreachable',
             detail: aborted
               ? (PARALLEL
                   ? `no answer within ${TIMEOUT_MS / 1000}s while 16 other fetches were in flight — NOT evidence about this host; re-run without --parallel`
                   : `no answer within ${TIMEOUT_MS / 1000}s with nothing else in flight — this host really is unreachably slow`)
               : `${e instanceof Error ? e.message : String(e)} — host gone, DNS failure, or blocked from this network` }
  } finally { clearTimeout(timer) }
}

const base = (u, ms) => ({ name: u.name, url: u.url, ms })
// 300 chars was too short for the one verdict family where the body IS the
// deliverable: the 2026-09-09 run truncated near-native's response before
// reaching any yield field, so the fix could not be written from the output that
// exists to enable it. Error pages stay short — nobody needs 1500 chars of 404.
const excerpt = (t, long = false) => t.replace(/\s+/g, ' ').slice(0, long ? 1500 : 300)

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
               'blocked-here': '🚧', 'over-budget': '🐢' }

async function main() {
  out(`\n${'─'.repeat(78)}\n STAKING UPSTREAM PROBE — ${UPSTREAMS.length} sources, ${TIMEOUT_MS / 1000}s each\n`)
  out(` Mode: ${PARALLEL
    ? `PARALLEL — reproducing the route (all at once, shared ${ROUTE_BUDGET_MS / 1000}s). Timeouts here are NOT host verdicts.`
    : 'SEQUENTIAL — one at a time, so a timeout means that host really is slow.'}\n`)
  out(` Run this on the owner's machine; a cloud run 403s on every host.\n${'─'.repeat(78)}\n\n`)

  let results
  if (PARALLEL) {
    results = await Promise.all(UPSTREAMS.map(probe))
  } else {
    // One at a time, printing as we go: the run takes longer than the parallel
    // version, and a probe that looks hung is a probe nobody waits out.
    results = []
    for (const u of UPSTREAMS) {
      const r = await probe(u)
      results.push(r)
      out(`${ICON[r.verdict] ?? '⚪'} ${r.verdict.padEnd(12)} ${String(r.ms ?? '').padStart(6)}ms  ${r.name.padEnd(20)} ${r.detail}\n`)
    }
    out(`\n`)
  }

  if (PARALLEL) {
    for (const r of results) {
      out(`${ICON[r.verdict] ?? '⚪'} ${r.verdict.padEnd(12)} ${String(r.ms ?? '').padStart(6)}ms  ${r.name.padEnd(20)} ${r.detail}\n`)
    }
  }

  const live = results.filter((r) => r.verdict === 'live' || r.verdict === 'over-budget')
  const blocked = results.filter((r) => r.verdict === 'blocked-here')
  const broken = results.filter((r) => !['live', 'over-budget', 'blocked-here'].includes(r.verdict))
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
  group(['no-rate', 'partial', 'not-json', 'parse-threw'], 'ANSWERED, BUT NO USABLE RATE — read the body',
        'The endpoint is healthy. Either the field moved (fix the parse path, keep the URL) or it '
        + 'carries no rate at all (replace or drop the rung). The body below decides which.')
  group(['http-error', 'unreachable'], 'ENDPOINT GONE — find the new URL, or drop the rung',
        'Do not leave a dead rung in place: it reads as a live source that happens to be failing. '
        + 'If MANY rows land here at once, suspect this network before suspecting the sources.')
  group(['blocked-here'], 'BLOCKED BY THIS NETWORK — not a finding about the source',
        'Our own egress policy refused these. Re-run where they are reachable.')
  group(['over-budget'], "SLOW BUT WORKING — the route's BUDGET is the fix, not the URL",
        `These served a usable rate, just not within ${ROUTE_BUDGET_MS / 1000}s. Nothing to reparse or replace: `
        + 'raise the budget, or stop making them compete for it.')
  group(['timeout'], PARALLEL
          ? 'TIMED OUT UNDER CONTENTION — not host verdicts'
          : 'TOO SLOW EVEN UNCONTENDED — a real host problem',
        PARALLEL
          ? 'Re-run without --parallel before concluding anything about these. In the route these same '
            + 'hosts fail in array order, which is queueing, not host health.'
          : 'Each of these had the network to itself and still did not answer. This is the host.')

  // The signature that started all this: a contiguous run of timeouts at the tail.
  // Position deciding the outcome is queueing; hosts fail independently of order.
  if (PARALLEL) {
    const firstTimeout = results.findIndex((r) => r.verdict === 'timeout')
    const tail = firstTimeout >= 0 && results.slice(firstTimeout).every((r) => r.verdict === 'timeout')
    if (tail && results.length - firstTimeout >= 3) {
      out(`\n⚠  ARRAY-ORDER FAILURE: everything from #${firstTimeout + 1} (${results[firstTimeout].name}) `
        + `onward timed out — ${results.length - firstTimeout} in a row.\n`)
      out(`   Position decided the outcome, so this is CONTENTION, not host health.\n`)
      out(`   Re-run without --parallel for per-host truth.\n`)
    }
  }

  if (JSON_OUT) process.stdout.write(JSON.stringify({ probedAt: new Date().toISOString(), results, mode: PARALLEL ? 'parallel' : 'sequential' }, null, 2) + '\n')
  // Exit 2 = inconclusive (this network blocked most of it), distinct from
  // exit 1 = upstreams genuinely broken. A caller must be able to tell "the
  // sources are down" from "you ran this in the wrong place".
  if (blocked.length >= results.length / 2) process.exit(2)
  process.exit(broken.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
