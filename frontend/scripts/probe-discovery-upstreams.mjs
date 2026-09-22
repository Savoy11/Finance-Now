// Probe the four upstreams behind /live-data/staking-discovery, and say WHERE
// their pools disappear (queue item T-399).
//
// ── Why this is a funnel and not a reachability check ────────────────────────
//
// The sibling probe (probe-staking-upstreams.mjs) asks "does this endpoint
// serve a rate". That question does not work here, because the reported symptom
// is "three of four upstreams contribute ZERO pools" and one of the three —
// Beefy — answers 200 to every request it makes. A reachability probe calls
// that healthy and tells you nothing.
//
// So this walks the route's OWN filter chain, stage by stage, and reports how
// many items survive each one. The verdicts are grouped by CURE, because the
// cures are mutually exclusive and the route cannot tell them apart:
//
//   endpoint-gone   → DNS/connection/404. Find the new URL, or drop the rung.
//   shape-changed   → responds, but the array we parse is absent or empty.
//                     Reparse; the data moved, the source did not.
//   filtered-out    → the source is FINE and returns items; the route's own
//                     filters remove every one. The defect is ours, not theirs,
//                     and dropping the rung would be exactly wrong.
//   live            → yields pools.
//   blocked-here    → our egress refused it. Says nothing about the source.
//
// ⚠ REPORTS, NEVER WRITES. Same split as the fee and llama-symbol probes: an
// automated rewrite of an upstream URL is how a rate from the wrong protocol
// lands on a coin.
//
// ⚠ RUN IT ON THE OWNER'S MACHINE, AND CHECK THE EGRESS FIRST. Reachability is
// IP-dependent — CLAUDE.md records three wrong attributions in one day from
// skipping this. A VPN counts as the wrong machine. In PowerShell `curl` is an
// alias for Invoke-WebRequest and will NOT work; use the real binary:
//
//   $ip = curl.exe -s https://api.ipify.org
//   curl.exe -s "http://ip-api.com/json/$ip`?fields=isp,org,proxy,hosting"
//
// If proxy or hosting is true, this run proves nothing.
//
// Usage:
//   npm run discovery-upstreams
//   npm run discovery-upstreams -- --json
//   npm run discovery-upstreams -- --parallel     (reproduces the route's contention)
//   npm run discovery-upstreams -- --min-tvl=0    (isolate the TVL gate)

import { COIN_SYMBOL_MAP, ALL_STAKING_SYMBOLS } from '../src/lib/data/stakingDiscovery.ts'

const JSON_OUT = process.argv.includes('--json')
const PARALLEL = process.argv.includes('--parallel')
const argOf = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? parseFloat(hit.split('=')[1]) : dflt
}

// The route's own defaults (route.ts:410-411). Overridable so a run can show
// what the funnel looks like with the gate open — which is the difference
// between "the source is empty" and "our threshold is too high".
const MIN_TVL = argOf('min-tvl', 1_000_000)
const MIN_APY = argOf('min-apy', 0.1)

const ROUTE_BUDGET_MS = 6_000          // UPSTREAM_TIMEOUT_MS in route.ts:77
const TIMEOUT_MS = PARALLEL ? ROUTE_BUDGET_MS : 20_000
const out = (s) => { if (!JSON_OUT) process.stdout.write(s) }

// Mirrors route.ts:119-125. Duplicated rather than imported because the route
// is a Next handler; stakingDiscoveryProbe.test.ts fails if it drifts.
function symbolToCoinId(symbol) {
  const base = String(symbol ?? '').split('-')[0].split('/')[0].toUpperCase()
  for (const [coinId, symbols] of Object.entries(COIN_SYMBOL_MAP)) {
    if (symbols.some((s) => base.startsWith(s))) return coinId
  }
  return null
}

const baseSymbolOf = (s) => String(s ?? '').split('-')[0].split('/')[0].toUpperCase()

// ── The four upstreams, each mirroring its fetcher in route.ts ───────────────
//
// `stages` is the route's filter chain in ORDER. Each returns true to keep an
// item. The first stage that drops everything is the answer.

const UPSTREAMS = [
  {
    name: 'defillama',
    label: 'DefiLlama Yields',
    url: 'https://yields.llama.fi/pools',
    note: 'The control — this one works. If it also collapses, suspect the run, not the sources.',
    pick: (j) => j?.data ?? null,
    stages: [
      ['symbol is a staking symbol', (p) => ALL_STAKING_SYMBOLS.has(baseSymbolOf(p.symbol))],
      ['not stablecoin / no IL risk', (p) => !p.stablecoin && p.ilRisk !== 'yes'],
      [`tvlUsd >= ${MIN_TVL}`, (p) => (p.tvlUsd ?? 0) >= MIN_TVL],
      [`apy >= ${MIN_APY}`, (p) => (p.apy ?? 0) >= MIN_APY],
      ['coin id resolves', (p) => !!symbolToCoinId(baseSymbolOf(p.symbol))],
    ],
    // The route also applies DEFILLAMA_SLUG_BLOCKLIST; omitted here on purpose,
    // so a blocklisted project shows as a survivor rather than as a dead source.
  },
  {
    name: 'yearn',
    label: 'Yearn Finance',
    url: 'https://api.yearn.finance/v1/chains/1/vaults/all',
    note: 'Reported as not resolving. If that holds, the cure is a new URL or removal — not a reparse.',
    pick: (j) => (Array.isArray(j) ? j : null),
    stages: [
      ['endorsed', (v) => !!v.endorsed],
      [`tvl.tvl >= ${MIN_TVL}`, (v) => (v.tvl?.tvl ?? 0) >= MIN_TVL],
      [`apy.net_apy*100 >= ${MIN_APY}`, (v) => ((v.apy?.net_apy ?? 0) * 100) >= MIN_APY],
      ['coin id resolves', (v) => !!symbolToCoinId(v.token?.symbol)],
    ],
  },
  {
    name: 'pendle',
    label: 'Pendle',
    url: 'https://api-v2.pendle.finance/core/v1/sdk/1/markets?limit=100&order_by=liquidity:desc',
    note: 'Reported as 404 on this exact URL. A 404 with a healthy host usually means the path moved.',
    pick: (j) => j?.results ?? null,
    stages: [
      ['isWhitelisted', (m) => !!m.isWhitelisted],
      [`totalLiquidity >= ${MIN_TVL}`, (m) => (m.totalLiquidity ?? 0) >= MIN_TVL],
      [`impliedApy*100 >= ${MIN_APY}`, (m) => ((m.impliedApy ?? 0) * 100) >= MIN_APY],
      ['coin id resolves', (m) => !!symbolToCoinId(m.underlyingAsset?.symbol ?? m.pt?.symbol ?? '')],
      ['not expired', (m) => !(m.expiry && new Date(m.expiry) < new Date())],
    ],
  },
  {
    name: 'beefy',
    label: 'Beefy Finance',
    url: 'https://api.beefy.finance/vaults',
    note: 'Answers 200 and lands nothing. Its TVL and APY come from two SEPARATE endpoints that the route swallows with .catch(() => null) — if either is down, every vault scores 0 and every vault is filtered out. Those two are probed below as `enrichments`.',
    pick: (j) => (Array.isArray(j) ? j : null),
    // TVL and APY need the enrichment payloads, so they are applied in probeBeefy().
    stages: [
      ['status === active', (v) => v.status === 'active'],
      ['single-asset (not LP)', (v) => Array.isArray(v.assets) && v.assets.length === 1],
      ['coin id resolves', (v) => !!symbolToCoinId(v.assets?.[0])],
    ],
    enrichments: [
      { key: 'tvl', url: 'https://api.beefy.finance/tvl' },
      { key: 'apy', url: 'https://api.beefy.finance/apy/breakdown' },
    ],
  },
]

async function getJson(url) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const ms = Date.now() - t0
    const text = await res.text()
    if (!res.ok) {
      // 403/451 from our side is an egress verdict, not a source verdict.
      const kind = res.status === 403 || res.status === 451 ? 'blocked-here' : 'endpoint-gone'
      return { ok: false, kind, status: res.status, ms, excerpt: excerptOf(text) }
    }
    try {
      return { ok: true, status: res.status, ms, json: JSON.parse(text) }
    } catch {
      return { ok: false, kind: 'shape-changed', status: res.status, ms, excerpt: excerptOf(text),
               why: 'responded 200 but the body is not JSON' }
    }
  } catch (e) {
    const ms = Date.now() - t0
    const aborted = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    const msg = String(e?.cause?.code ?? e?.message ?? e)
    return {
      ok: false,
      kind: aborted ? 'timeout' : 'endpoint-gone',
      ms,
      why: aborted ? `no response within ${TIMEOUT_MS / 1000}s` : msg,
      dns: /ENOTFOUND|EAI_AGAIN/.test(msg),
    }
  }
}

const excerptOf = (t) => String(t ?? '').replace(/\s+/g, ' ').slice(0, 300)

function runFunnel(items, stages) {
  const funnel = []
  let survivors = items
  for (const [label, keep] of stages) {
    const before = survivors.length
    survivors = survivors.filter((x) => { try { return keep(x) } catch { return false } })
    funnel.push({ stage: label, in: before, out: survivors.length, dropped: before - survivors.length })
  }
  return { funnel, survivors }
}

async function probeBeefy(u) {
  const main = await getJson(u.url)
  if (!main.ok) return { name: u.name, label: u.label, url: u.url, ...main, verdict: main.kind }

  const vaults = u.pick(main.json)
  if (!vaults) {
    return { name: u.name, label: u.label, url: u.url, ms: main.ms, status: main.status,
             verdict: 'shape-changed', why: 'response is not the array the route expects' }
  }

  // The suspected root cause: these two are optional to the ROUTE and
  // load-bearing for its OUTPUT.
  const enrich = {}
  for (const e of u.enrichments) {
    const r = await getJson(e.url)
    enrich[e.key] = r.ok
      ? { ok: true, ms: r.ms, size: Object.keys(r.json ?? {}).length }
      : { ok: false, ms: r.ms, kind: r.kind, why: r.why ?? `HTTP ${r.status}` }
  }

  const tvlMap = {}
  if (enrich.tvl?.ok) {
    const r = await getJson(u.enrichments[0].url)
    for (const chain of Object.values(r.json ?? {})) Object.assign(tvlMap, chain)
  }
  const apyData = enrich.apy?.ok ? (await getJson(u.enrichments[1].url)).json ?? {} : {}

  const apyOf = (id) => {
    const e = apyData[id]
    if (typeof e === 'number') return e * 100
    if (e && typeof e === 'object') return (e.totalApy ?? e.vaultApr ?? 0) * 100
    return 0
  }

  const stages = [
    ...u.stages,
    [`tvl >= ${MIN_TVL} (needs /tvl)`, (v) => (tvlMap[v.id] ?? 0) >= MIN_TVL],
    [`apy in [${MIN_APY}, 300] (needs /apy/breakdown)`, (v) => {
      const a = apyOf(v.id); return a >= MIN_APY && a <= 300
    }],
  ]

  const { funnel, survivors } = runFunnel(vaults, stages)
  const enrichmentDown = Object.entries(enrich).filter(([, v]) => !v.ok).map(([k]) => k)

  return {
    name: u.name, label: u.label, url: u.url, ms: main.ms, status: main.status,
    rawCount: vaults.length, funnel, survivorCount: survivors.length, enrichments: enrich,
    verdict: survivors.length > 0 ? 'live' : 'filtered-out',
    rootCause: enrichmentDown.length
      ? `enrichment endpoint(s) down: ${enrichmentDown.join(', ')} — the route swallows these with .catch(() => null), so every vault scores 0 and every vault is filtered out`
      : null,
    survivorSample: survivors.slice(0, 5).map((v) => `${v.id} (${v.assets?.[0]})`),
  }
}

async function probeOne(u) {
  if (u.name === 'beefy') return probeBeefy(u)

  const r = await getJson(u.url)
  if (!r.ok) return { name: u.name, label: u.label, url: u.url, ...r, verdict: r.kind }

  const items = u.pick(r.json)
  if (!items) {
    return { name: u.name, label: u.label, url: u.url, ms: r.ms, status: r.status,
             verdict: 'shape-changed',
             why: 'responded 200, but the array the route reads is absent',
             topLevelKeys: Object.keys(r.json ?? {}).slice(0, 12) }
  }
  if (items.length === 0) {
    return { name: u.name, label: u.label, url: u.url, ms: r.ms, status: r.status,
             rawCount: 0, verdict: 'shape-changed',
             why: 'responded 200 with an EMPTY array — the source carries nothing here' }
  }

  const { funnel, survivors } = runFunnel(items, u.stages)
  return {
    name: u.name, label: u.label, url: u.url, ms: r.ms, status: r.status,
    rawCount: items.length, funnel, survivorCount: survivors.length,
    verdict: survivors.length > 0 ? 'live' : 'filtered-out',
    survivorSample: survivors.slice(0, 5).map((x) => x.symbol ?? x.name ?? x.address ?? '?'),
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

out('\nProbing /live-data/staking-discovery upstreams (T-399)\n')
out(`Mode: ${PARALLEL ? `PARALLEL (${ROUTE_BUDGET_MS}ms, reproduces the route)` : `SEQUENTIAL (${TIMEOUT_MS / 1000}s)`}`)
out(`   ·   min_tvl=${MIN_TVL}   min_apy=${MIN_APY}\n`)
out('⚠ Reachability is IP-dependent. If this is not the owner\'s machine on a clean\n')
out('  egress (proxy:false, hosting:false), the verdicts below are void.\n\n')

const results = PARALLEL
  ? await Promise.all(UPSTREAMS.map(probeOne))
  : await (async () => { const acc = []; for (const u of UPSTREAMS) acc.push(await probeOne(u)); return acc })()

if (JSON_OUT) {
  console.log(JSON.stringify({ minTvl: MIN_TVL, minApy: MIN_APY, parallel: PARALLEL, results }, null, 2))
} else {
  for (const r of results) {
    out(`${'─'.repeat(78)}\n${r.label}  [${r.verdict.toUpperCase()}]  ${r.ms ?? '?'}ms\n${r.url}\n`)
    if (r.why) out(`  why: ${r.why}\n`)
    if (r.dns) out('  DNS did not resolve — this is a dead hostname, not a slow one.\n')
    if (r.topLevelKeys) out(`  top-level keys present: ${r.topLevelKeys.join(', ')}\n`)
    if (r.enrichments) {
      for (const [k, v] of Object.entries(r.enrichments)) {
        out(`  enrichment /${k}: ${v.ok ? `ok (${v.size} keys, ${v.ms}ms)` : `FAILED — ${v.why}`}\n`)
      }
    }
    if (r.funnel) {
      out(`  ${r.rawCount} item(s) returned. Filter funnel:\n`)
      for (const f of r.funnel) {
        const flag = f.out === 0 && f.in > 0 ? '   ← EVERYTHING DROPPED HERE' : ''
        out(`    ${String(f.in).padStart(5)} → ${String(f.out).padStart(5)}   ${f.stage}${flag}\n`)
      }
    }
    if (r.rootCause) out(`\n  ROOT CAUSE: ${r.rootCause}\n`)
    if (r.survivorCount > 0) out(`  survivors: ${r.survivorSample.join(', ')}${r.survivorCount > 5 ? ` … (${r.survivorCount} total)` : ''}\n`)
    out('\n')
  }

  const by = (v) => results.filter((r) => r.verdict === v).map((r) => r.label)
  out(`${'═'.repeat(78)}\nWHAT TO DO, BY CURE\n\n`)
  const cures = [
    ['endpoint-gone', 'Find the new URL or DROP the rung. Same standard as the staking-rates audit: a source that carries no data at all is removed, not reparsed.'],
    ['shape-changed', 'REPARSE — the host is fine and the data moved. Do not drop these.'],
    ['filtered-out', 'OURS TO FIX, NOT THEIRS. The source returned items and our own filters removed every one. Dropping the rung here would delete a working source.'],
    ['timeout', 'Slow, not gone — in sequential mode this is the host; under --parallel it means nothing.'],
    ['blocked-here', 'OUR EGRESS refused it. Says nothing about the source.'],
    ['live', 'Yields pools. No action.'],
  ]
  for (const [v, advice] of cures) {
    const names = by(v)
    if (names.length) out(`  ${v.padEnd(15)} ${names.join(', ')}\n${' '.repeat(18)}${advice}\n\n`)
  }
}

const blocked = results.filter((r) => r.verdict === 'blocked-here').length
if (blocked >= Math.ceil(results.length / 2)) {
  out('⚠ THIS RUN PROVES NOTHING ABOUT THE SOURCES — half or more were refused by our\n')
  out('  own egress. Re-run from the owner\'s machine on a clean connection.\n')
  process.exit(2)
}
const broken = results.filter((r) => ['endpoint-gone', 'shape-changed', 'filtered-out'].includes(r.verdict)).length
process.exit(broken > 0 ? 1 : 0)
