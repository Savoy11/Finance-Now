#!/usr/bin/env tsx
//
// Coverage matrix — which providers, in combination, make every value live.
//
//   npx tsx scripts/gen-coverage-matrix.ts <audit.json> [--out <path>]
//
// ── Why this exists ──────────────────────────────────────────────────────────
// The distribution question (self-hosted BYOK vs. hosted on the owner's keys)
// cannot be priced until someone can say how many provider accounts a user would
// have to open to see every value live. That number is not in anyone's head and
// it is not in either input on its own:
//
//   • DATA_SOURCES (lib/data/dataSources.ts) says which providers COULD serve a
//     surface, and whether each needs a key. It does not know what actually
//     happened on this machine today.
//   • The audit (scripts/test-live-data.mjs --json) says what each route really
//     returned — REAL / FALLBACK / UNCONFIGURED / EMPTY / FAIL. It does not know
//     which provider would fix a surface that came back FALLBACK.
//
// Joined, they answer the question. This script does the join and then the set
// cover, so the headline number is computed rather than estimated.
//
// ── It REPORTS, it does not decide ───────────────────────────────────────────
// Same split as build-fund-fees.mjs and run-agent-eval.mjs. Nothing here edits
// the registry, changes a status, or picks a provider. Which account to open is
// the owner's call; this prints what each one buys.
//
// ⚠ The audit's verdicts are IP-dependent (CLAUDE.md), so this inherits that:
// a matrix built from a cloud or CI audit describes that host's egress, not a
// user's. Run the audit on the owner's machine, which is the same rule the audit
// itself carries.

import fs from 'node:fs'
import path from 'node:path'
import { DATA_SOURCES, type DataSourceEntry, type SourceProvider } from '../src/lib/data/dataSources'

type Verdict = 'REAL' | 'FALLBACK' | 'UNCONFIGURED' | 'EMPTY' | 'FAIL'

interface AuditResult {
  name: string
  group: string
  path: string
  verdict: Verdict
  detail?: string
  ms?: number
}

interface AuditFile {
  base: string
  mode: string
  ranAt: string
  counts: Record<string, number>
  results: AuditResult[]
}

/** Worst-first, because a surface is only as live as its weakest probe. */
const SEVERITY: Verdict[] = ['FAIL', 'EMPTY', 'FALLBACK', 'UNCONFIGURED', 'REAL']

const args = process.argv.slice(2)
const auditPath = args.find((a) => !a.startsWith('--'))
const outFlag = args.indexOf('--out')
if (!auditPath) {
  console.error('usage: npx tsx scripts/gen-coverage-matrix.ts <audit.json> [--out <path>]')
  process.exit(1)
}

const audit: AuditFile = JSON.parse(fs.readFileSync(auditPath, 'utf-8'))
const stamp = audit.ranAt.slice(0, 10)

/**
 * Optional: a saved `/live-data/config` payload, so the matrix can tell a key
 * already held from one nobody has signed up for.
 *
 * Without it every keyed provider reads as an account to open, which is how the
 * first run reported "4 accounts" while FMP, Finnhub, Twelve Data and
 * CoinMarketCap were already configured. That is not a rounding error — it is
 * the difference between a decision to take and a decision already taken.
 *
 * The payload carries `hasKey` booleans and no secrets (checked: the only
 * key-ish field names are requiresKey, keyUrl, hasKey), which is why it can be
 * committed next to the audit.
 */
const configFlag = args.indexOf('--config')
interface ProviderConfig { id: string; requiresKey?: boolean; config?: { hasKey?: boolean } }
const providerConfigs: ProviderConfig[] = configFlag >= 0
  ? (JSON.parse(fs.readFileSync(path.resolve(args[configFlag + 1]), 'utf-8')).providers ?? [])
  : []

/**
 * Registry display names and config ids do not always agree. Most match once
 * normalised ("Twelve Data" → twelvedata ↔ "twelve-data"); the ones that cannot
 * are aliased explicitly rather than guessed, because a wrong match would claim
 * a key is held when it is not.
 */
const VENDOR_ID_ALIASES: Record<string, string> = {
  'youtube data api': 'youtube-search',
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
function configFor(vendor: string): ProviderConfig | null {
  const alias = VENDOR_ID_ALIASES[vendor.toLowerCase()]
  const want = norm(alias ?? vendor)
  return providerConfigs.find((p) => {
    const id = norm(p.id)
    return id === want || (want.length >= 4 && (id.startsWith(want) || want.startsWith(id)))
  }) ?? null
}
const isHeld = (vendor: string) => configFor(vendor)?.config?.hasKey === true
const OUT = outFlag >= 0
  ? path.resolve(args[outFlag + 1])
  : path.resolve(process.cwd(), '..', 'docs', 'audits', `coverage-matrix-${stamp}.md`)

/** `/live-data/stock-universe?symbol=AAPL` → `/live-data/stock-universe` */
const bare = (p: string | undefined) => (p ?? '').split('?')[0]

/**
 * Not every probe is a route probe. The audit's `cross-layer` group asserts that
 * two layers agree with each other — a network count, a fee that must match
 * within 2% — and carries no `path` at all. Those cannot join to a registry
 * entry and must not be mistaken for a surface with no coverage, so they are
 * partitioned out here and reported separately.
 */
const routeProbes = audit.results.filter((r) => Boolean(r.path))
const crossLayer = audit.results.filter((r) => !r.path)

/**
 * Every route an entry owns — and `route` is not always one route.
 *
 * Several entries carry prose there, because the field feeds the /data-sources
 * page and the generated catalog as much as it feeds any checker:
 *
 *   "/live-data/security-quotes · security-chart · security-ohlcv"
 *   "/live-data/news + /live-data/market-news"
 *   "/live-data/wallet/*"
 *
 * That is why six entries first came back "no probe covered" while their probes
 * sat in the audit all along. Parsed here rather than rewritten in the registry:
 * the prose is what a reader sees on the page, and reshaping 51 entries to suit
 * one script is the tail wagging the dog. A bare segment after a separator
 * inherits the previous route's directory, which is what the prose means.
 */
function routesOf(entry: DataSourceEntry): string[] {
  const out: string[] = []
  let dir = '/live-data'
  for (const token of (entry.route ?? '').split(/[·+,]|\s+/).map((t) => t.trim()).filter(Boolean)) {
    if (token.startsWith('/')) {
      out.push(token)
      dir = token.slice(0, token.lastIndexOf('/')) || '/live-data'
    } else if (/^[\w-]+$/.test(token)) {
      out.push(`${dir}/${token}`)
    }
  }
  const covered = (entry.covers ?? []).map((c) => (c.startsWith('/') ? c : `/live-data/${c}`))
  return [...out, ...covered]
}

/** Routes may end in `*`, e.g. `/live-data/wallet/*` covering every chain below it. */
function routeMatches(routes: string[], probePath: string): boolean {
  return routes.some((r) =>
    r.endsWith('/*') ? probePath.startsWith(r.slice(0, -1)) : r === probePath)
}

function worst(verdicts: Verdict[]): Verdict | null {
  for (const v of SEVERITY) if (verdicts.includes(v)) return v
  return null
}

/**
 * What would make this surface live?
 *
 * The keyless providers have already had their turn — the audit just ran them.
 * So a surface that is not REAL is either waiting on a keyed provider, or it is
 * waiting on something no key can buy (a geo-block, a removed source, a terms
 * decision). Distinguishing those two is the whole point: the first is a price,
 * the second is a product gap, and conflating them inflates the account count
 * with accounts that would not help.
 */
function remedy(entry: DataSourceEntry): { keyed: SourceProvider[]; noKeyHelps: boolean } {
  const keyed = entry.providers.filter((p) => p.auth === 'key' || p.auth === 'paid')
  return { keyed, noKeyHelps: keyed.length === 0 }
}

/**
 * An upstream that throttled the audit is not a coverage gap.
 *
 * A full audit fires ~70 probes in a few minutes, and several share one keyless
 * upstream — CoinGecko's free tier most of all. It rate-limits itself, and the
 * route then reports FAIL for a surface that serves live data on the next
 * request. Counting those as "no key fixes this" would be doubly wrong: it
 * inflates the product-gap list, and it implies a paid plan is the remedy for a
 * surface that is already working.
 *
 * The signal is the upstream's own 429 and the retry-after it comes with, which
 * the audit copies into `detail` verbatim; one probe even labels itself
 * "(transient: re-run)". The heuristic's weakness, stated because it is real: a
 * surface that is genuinely broken AND mentions 429 lands here too. That is a
 * narrow miss — a 429 is by definition upstream throttling rather than a missing
 * key — and a re-run resolves it either way, which is what the doc tells the
 * reader to do.
 */
const RATE_LIMITED = /\b429\b|rate limit|retry-after|\(transient/i
const throttledProbe = (p: AuditResult) => p.verdict !== 'REAL' && RATE_LIMITED.test(p.detail ?? '')

interface Row {
  entry: DataSourceEntry
  verdict: Verdict | null
  probes: AuditResult[]
  keyed: SourceProvider[]
  noKeyHelps: boolean
  /** Every failing probe on this row was the upstream throttling the audit. */
  throttled: boolean
}

const rows: Row[] = DATA_SOURCES.map((entry) => {
  const routes = routesOf(entry)
  const probes = routeProbes.filter((r) => routeMatches(routes, bare(r.path)))
  const { keyed, noKeyHelps } = remedy(entry)
  const bad = probes.filter((p) => p.verdict !== 'REAL')
  return {
    entry,
    verdict: worst(probes.map((p) => p.verdict)),
    probes,
    keyed,
    noKeyHelps,
    throttled: bad.length > 0 && bad.every(throttledProbe),
  }
})

const unprobed = rows.filter((r) => r.verdict === null)
const live = rows.filter((r) => r.verdict === 'REAL')
const throttled = rows.filter((r) => r.verdict && r.verdict !== 'REAL' && r.throttled)
const degraded = rows.filter((r) => r.verdict && r.verdict !== 'REAL' && !r.throttled)

/**
 * Probes that match no registry entry — the join's other direction.
 *
 * Worth surfacing rather than dropping: a probe with no entry is usually a test
 * outliving the route it tested. The registry is regenerated when a route is
 * cut; the audit's test list is hand-maintained, so it is the half that goes
 * stale, and a 404 from a route deleted on purpose reads as a data failure to
 * anyone scanning the summary.
 */
const registryRoutes = DATA_SOURCES.flatMap(routesOf)
const orphanProbes = routeProbes.filter((r) => !routeMatches(registryRoutes, bare(r.path)))

// ── Accounts, not provider entries ───────────────────────────────────────────
// The question is how many accounts a user opens, so the cover has to run over
// vendors. Two things in the registry stand between a provider entry and a
// vendor, and both would inflate the number if taken at face value:
//
//   1. One vendor, several entries. "FMP" and "FMP company-screener" are listed
//      separately — correctly, they are different endpoints on different plans —
//      but a user opens ONE FMP account.
//   2. One entry, several vendors. "Equity quote ladder (FMP → Finnhub → Twelve
//      Data → Tiingo → Alpha Vantage)" is a single provider entry naming five
//      vendors in preference order. ANY of them satisfies it, so it must not
//      force a fifth account when FMP is already in the cover.
//
// Both are read from the data rather than a hardcoded list.

/** "FMP company-screener" → "FMP". Prefix at a word boundary, shortest wins. */
const allProviderNames = [...new Set(DATA_SOURCES.flatMap((e) => e.providers.map((p) => p.name)))]
function vendorOf(name: string): string {
  const prefixes = allProviderNames
    .filter((v) => v !== name && name.startsWith(v + ' '))
    .sort((a, b) => a.length - b.length)
  return prefixes[0] ?? name
}

/**
 * The vendors that would each, on their own, satisfy this provider entry.
 *
 * A parenthetical listing alternatives — separated by →, / or a comma — is a
 * ladder, and a ladder is an OR. Anything else is a single vendor.
 */
function candidatesOf(p: SourceProvider): string[] {
  // Alternatives are written two ways in this registry, and both mean OR:
  // inside a parenthetical — "Equity quote ladder (FMP → Finnhub → …)" — or as
  // the whole name, "Finnhub / Twelve Data / Tiingo / Alpha Vantage". Reading
  // only the first form left four-vendor ladders standing as one pseudo-vendor,
  // which then inherited a cost posture from whichever real provider its name
  // happened to start with.
  const inner = p.name.match(/\(([^)]*(?:→|\/|,)[^)]*)\)/)?.[1] ?? p.name
  const parts = inner.split(/→|\/|,/).map((s) => s.trim()).filter(Boolean)
  if (parts.length > 1) return [...new Set(parts.map(vendorOf))]
  return [vendorOf(p.name)]
}

/** Every vendor that could lift this row, flattened across its keyed entries. */
function candidateVendors(r: Row): string[] {
  return [...new Set(r.keyed.flatMap(candidatesOf))]
}

// Greedy set cover over those vendors. The comment matters more than the
// algorithm: greedy is not guaranteed optimal, so this is an UPPER BOUND. For
// the handful of vendors in play the bound is almost certainly tight, but
// "almost certainly" is not "provably", and the number gets quoted.
const fixable = degraded.filter((r) => r.keyed.length > 0)
const forced = new Set<string>()
for (const r of fixable) {
  const c = candidateVendors(r)
  if (c.length === 1) forced.add(c[0])
}

const chosen = new Set(forced)
let remaining = fixable.filter((r) => !candidateVendors(r).some((v) => chosen.has(v)))
while (remaining.length > 0) {
  const tally = new Map<string, number>()
  for (const r of remaining) {
    for (const v of candidateVendors(r)) tally.set(v, (tally.get(v) ?? 0) + 1)
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  if (!best) break
  chosen.add(best[0])
  remaining = remaining.filter((r) => !candidateVendors(r).includes(best[0]))
}

/** Every surface a given vendor would lift, for the "what it buys" column. */
function buys(vendor: string): Row[] {
  return fixable.filter((r) => candidateVendors(r).includes(vendor))
}

/** The registry entries through which a vendor appears, with their plan tiers. */
function entriesFor(vendor: string): { name: string; auth: string }[] {
  const seen = new Map<string, string>()
  for (const e of DATA_SOURCES) {
    for (const p of e.providers) {
      if (candidatesOf(p).includes(vendor)) seen.set(p.name, p.auth)
    }
  }
  return [...seen].map(([name, auth]) => ({ name, auth }))
}

const accounts = new Set(chosen)

/**
 * What opening this account would actually cost, under the standing rule that
 * paid-service decisions wait until late in production (owner, 2026-09-18).
 *
 * A vendor can be two things at once, and collapsing that to one word is what
 * would hide the decision: FMP's quote endpoints are free and already
 * configured, while its company-screener needs a paid tier. That row has to say
 * "held, with a paid upgrade behind it" — not "held", and not "paid".
 */
function posture(vendor: string): { label: string; paid: boolean; held: boolean } {
  const auths = new Set(entriesFor(vendor).map((e) => e.auth))
  const paid = auths.has('paid')
  const held = isHeld(vendor)
  if (held && paid) return { label: 'held (free tier) · paid upgrade **deferred**', paid, held }
  if (held) return { label: 'held — no decision to take', paid, held }
  if (paid && auths.has('key')) return { label: 'free signup · paid tier **deferred**', paid, held }
  if (paid) return { label: '**paid — deferred**', paid, held }
  return { label: 'free signup', paid, held }
}

/** Every vendor that could serve any degraded surface, not just the chosen cover. */
const allCandidates = [...new Set(fixable.flatMap(candidateVendors))].sort()

/** Surfaces this vendor is the ONLY candidate for — what strands if we drop it. */
function soleFor(vendor: string): Row[] {
  return fixable.filter((r) => {
    const c = candidateVendors(r)
    return c.length === 1 && c[0] === vendor
  })
}

/** Degraded surfaces with exactly one possible vendor — the optionality risk. */
const singleSourced = fixable.filter((r) => candidateVendors(r).length === 1)

/** Degraded surfaces whose every option is paid — blocked by a deferred decision. */
const paidOnly = fixable.filter((r) => {
  const c = candidateVendors(r)
  return c.length > 0 && c.every((v) => posture(v).paid && !posture(v).held)
})

const unfixable = degraded.filter((r) => r.noKeyHelps)

// ── Render ───────────────────────────────────────────────────────────────────
const ICON: Record<Verdict, string> = {
  REAL: '🟢', FALLBACK: '🟡', UNCONFIGURED: '🔑', EMPTY: '⚪', FAIL: '🔴',
}

const esc = (s: string) => s.replace(/\|/g, '\\|')
const providerList = (ps: SourceProvider[]) =>
  ps.map((p) => `${p.name} (${p.role}/${p.auth})`).join(', ')

const md: string[] = []
md.push(`# Coverage matrix — ${stamp}`)
md.push('')
md.push('**Which providers, in combination, make every value live.** Generated by')
md.push('`npx tsx scripts/gen-coverage-matrix.ts` from two inputs, neither of which answers')
md.push('the question alone: the source registry (`lib/data/dataSources.ts`), which knows')
md.push('which providers *could* serve a surface and what each costs, and a live audit,')
md.push('which knows what actually came back.')
md.push('')
md.push(`Audit: \`${audit.base}\` · mode **${audit.mode}** · run ${audit.ranAt}`)
md.push(`· ${routeProbes.length} route probes (+${crossLayer.length} cross-layer, which assert agreement`)
md.push(`between layers rather than hitting a route) · registry: ${DATA_SOURCES.length} surfaces`)
md.push('')
md.push('⚠ **IP-dependent.** The audit\'s verdicts depend on the egress it ran from, so this')
md.push('matrix does too. Built from a cloud or CI run it describes that host, not a user.')
md.push('')
md.push('## The number')
md.push('')
md.push(`| | |`)
md.push(`|---|---|`)
md.push(`| Surfaces in the registry | ${DATA_SOURCES.length} |`)
md.push(`| Live now, no key needed | **${live.length}** |`)
md.push(`| Upstream throttled the audit — not a gap | ${throttled.length} |`)
md.push(`| Degraded — not serving the intended source | **${degraded.length}** |`)
md.push(`| …of those, a key would fix | ${fixable.length} |`)
md.push(`| …of those, no key fixes | ${unfixable.length} |`)
md.push(`| Not covered by any audit probe | ${unprobed.length} |`)
md.push(`| Keyed provider entries behind them | ${new Set([...accounts].flatMap((v) => entriesFor(v).map((e) => e.name))).size} |`)
md.push(`| **Accounts a user would open for full coverage** | **${accounts.size}** |`)
md.push('')
md.push(`The account figure is a greedy set cover, so it is an **upper bound**. ${forced.size} of the`)
md.push(`${accounts.size} ${forced.size === 1 ? "is" : "are"} forced — the only vendor that can serve some surface — and the`)
md.push('remainder were chosen most-surfaces-first. It counts accounts, not money: several have a')
md.push('free tier, and the registry records `paid` separately from `key` for exactly that')
md.push('reason. It also counts only what a key can buy — the unfixable rows below are a')
md.push('product gap, and no number of accounts closes them.')
md.push('')
md.push('## The accounts')
md.push('')
md.push('One row per **account**, which is not the same as one row per provider entry — see')
md.push('the note above. Where a vendor appears under more than one entry, each is listed,')
md.push('because they can sit on different plans.')
md.push('')
md.push(`| Account | Cost posture | Reached through | Forced? | Lifts | Which |`)
md.push(`|---|---|---|---|---|---|`)
for (const vendor of [...accounts].sort()) {
  const lifts = buys(vendor)
  const onlyHope = lifts.filter((r) => candidateVendors(r).length === 1).length
  const entries = entriesFor(vendor)
  const plans = [...new Set(entries.map((e) => e.auth))].sort().join('/')
  const via = entries.map((e) => esc(e.name)).join(', ')
  md.push(`| **${esc(vendor)}** | ${posture(vendor).label} | ${via} (${plans}) | ${forced.has(vendor) ? `yes — sole option for ${onlyHope}` : 'no'} | ${lifts.length} | ${lifts.map((r) => esc(r.entry.id)).join(', ')} |`)
}
md.push('')
md.push('## If we walk away from a vendor')
md.push('')
md.push('Standing rule (owner, 2026-09-18): **decisions that cost money are deferred until')
md.push('close to the end of production**, and the app is built so that no single provider is')
md.push('load-bearing. This table is how that rule is checked. "Strands" is what would have')
md.push('no remaining option at all if that vendor were dropped — the number to drive to zero.')
md.push('')
md.push('| Vendor | Cost posture | Could serve | Strands if dropped |')
md.push('|---|---|---|---|')
for (const vendor of allCandidates) {
  const stranded = soleFor(vendor)
  md.push(`| **${esc(vendor)}** | ${posture(vendor).label} | ${buys(vendor).length} | ${stranded.length === 0 ? '— none' : `**${stranded.length}**: ${stranded.map((r) => esc(r.entry.id)).join(', ')}`} |`)
}
md.push('')
if (singleSourced.length > 0) {
  md.push('### Single-sourced surfaces — the optionality risk')
  md.push('')
  md.push('Exactly one vendor can serve each of these. They are where the rule is not yet')
  md.push('satisfied: dropping that vendor does not degrade the surface, it removes it.')
  md.push('')
  for (const r of singleSourced) {
    const v = candidateVendors(r)[0]
    md.push(`- **${esc(r.entry.surface)}** (\`${r.entry.id}\`) — only ${esc(v)} (${posture(v).label})`)
  }
  md.push('')
}
if (paidOnly.length > 0) {
  md.push('### Blocked only by a deferred paid decision')
  md.push('')
  md.push('Every option here costs money and none is held, so under the standing rule these')
  md.push('stay as they are until late production. They are not defects to chase now.')
  md.push('')
  for (const r of paidOnly) {
    md.push(`- **${esc(r.entry.surface)}** (\`${r.entry.id}\`) — ${candidateVendors(r).map(esc).join(' or ')}`)
  }
  md.push('')
}
md.push('## Degraded surfaces, and what each is waiting on')
md.push('')
md.push('| | Surface | Module | Now | Waiting on |')
md.push(`|---|---|---|---|---|---|`)
for (const r of degraded.sort((a, b) => a.entry.module.localeCompare(b.entry.module) || a.entry.id.localeCompare(b.entry.id))) {
  const waiting = r.noKeyHelps
    ? '**no key fixes this** — keyless providers only'
    : providerList(r.keyed)
  md.push(`| ${ICON[r.verdict!]} | ${esc(r.entry.surface)} | ${r.entry.module} | ${r.verdict} | ${esc(waiting)} |`)
}
md.push('')
if (unfixable.length > 0) {
  md.push('### The ones no account closes')
  md.push('')
  md.push('Every provider on these entries is keyless, and the keyless providers already ran')
  md.push('in this audit. So the gap is a geo-block, a withdrawn source, a terms decision or a')
  md.push('genuine absence — not a price. These are the rows that decide what "every value')
  md.push('live" can even mean.')
  md.push('')
  for (const r of unfixable) {
    md.push(`- **${r.entry.surface}** (\`${r.entry.id}\`, ${r.verdict}) — providers: ${providerList(r.entry.providers) || 'none'}`)
    for (const p of r.probes.filter((p) => p.verdict !== 'REAL')) {
      md.push(`  - \`${p.path}\` → ${p.verdict}${p.detail ? ` — ${p.detail}` : ''}`)
    }
    if (r.entry.notes) md.push(`  - registry note: ${r.entry.notes}`)
  }
  md.push('')
}
if (throttled.length > 0) {
  md.push('## Throttled, not missing')
  md.push('')
  md.push('Every failing probe on these surfaces was the upstream rate-limiting the audit —')
  md.push('a full run fires dozens of probes in minutes and several share one keyless')
  md.push('provider. They are excluded from the counts above and from the account cover,')
  md.push('because a paid plan is not the remedy for a surface that is already working.')
  md.push('**Re-probe before treating any of these as a gap.**')
  md.push('')
  for (const r of throttled) {
    md.push(`- **${r.entry.surface}** (\`${r.entry.id}\`, ${r.verdict})`)
    for (const p of r.probes.filter((p) => p.verdict !== 'REAL')) {
      md.push(`  - \`${p.path}\` → ${p.verdict} — ${esc((p.detail ?? '').slice(0, 160))}`)
    }
  }
  md.push('')
}
if (unprobed.length > 0) {
  md.push('## Registry surfaces no probe covered')
  md.push('')
  md.push('Not a verdict — an absence of one. Either the audit has no test for the route, or')
  md.push('the entry\'s `route`/`covers` do not match any path the audit hits. Both are worth')
  md.push('knowing: an unprobed surface contributes nothing to the number above, so the')
  md.push('account count is computed over a smaller world than the registry describes.')
  md.push('')
  for (const r of unprobed) {
    md.push(`- \`${r.entry.id}\` — ${r.entry.surface} (${r.entry.route ?? 'no route'}, status \`${r.entry.status}\`)`)
  }
  md.push('')
}
if (orphanProbes.length > 0) {
  md.push('## Probes that match no registry entry')
  md.push('')
  md.push('The join\'s other direction, and usually a test outliving the route it tested. The')
  md.push('registry is regenerated when a route is cut; the audit\'s test list is hand-maintained,')
  md.push('so it is the half that goes stale — and a 404 from a route deleted on purpose reads')
  md.push('as a data failure to anyone scanning the summary. These contribute nothing to the')
  md.push('account count either way.')
  md.push('')
  for (const p of orphanProbes) {
    md.push(`- ${ICON[p.verdict]} \`${p.path}\` (${p.name}) → **${p.verdict}**${p.detail ? ` — ${esc(p.detail)}` : ''}`)
  }
  md.push('')
}
md.push('## Live now')
md.push('')
md.push(`${live.length} surfaces served their intended source on this run, with no key beyond what`)
md.push('is already configured:')
md.push('')
md.push(live.map((r) => `\`${r.entry.id}\``).join(' · '))
md.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md.join('\n'), 'utf-8')

console.log(`Coverage matrix → ${OUT}`)
console.log(`  ${live.length} live · ${degraded.length} degraded (${fixable.length} key-fixable, ${unfixable.length} not) · ${throttled.length} throttled · ${unprobed.length} unprobed`)
console.log(`  accounts for full coverage: ${accounts.size} (${[...accounts].sort().join(", ")})`)
