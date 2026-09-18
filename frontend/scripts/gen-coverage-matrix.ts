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
const OUT = outFlag >= 0
  ? path.resolve(args[outFlag + 1])
  : path.resolve(process.cwd(), '..', 'docs', 'audits', `coverage-matrix-${stamp}.md`)

/** `/live-data/stock-universe?symbol=AAPL` → `/live-data/stock-universe` */
const bare = (p: string) => p.split('?')[0]

/** Every route an entry owns — its own, plus the siblings folded into it. */
function routesOf(entry: DataSourceEntry): string[] {
  const own = entry.route ? [entry.route] : []
  const covered = (entry.covers ?? []).map((c) => (c.startsWith('/') ? c : `/live-data/${c}`))
  return [...own, ...covered]
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

interface Row {
  entry: DataSourceEntry
  verdict: Verdict | null
  probes: AuditResult[]
  keyed: SourceProvider[]
  noKeyHelps: boolean
}

const rows: Row[] = DATA_SOURCES.map((entry) => {
  const routes = routesOf(entry)
  const probes = audit.results.filter((r) => routes.includes(bare(r.path)))
  const { keyed, noKeyHelps } = remedy(entry)
  return { entry, verdict: worst(probes.map((p) => p.verdict)), probes, keyed, noKeyHelps }
})

const unprobed = rows.filter((r) => r.verdict === null)
const live = rows.filter((r) => r.verdict === 'REAL')
const degraded = rows.filter((r) => r.verdict && r.verdict !== 'REAL')

// ── Set cover ────────────────────────────────────────────────────────────────
// Which providers, in combination. A surface with exactly one keyed provider
// forces that account; the rest are a minimum-set-cover over what remains.
// Greedy, and the comment matters more than the algorithm: greedy set cover is
// not guaranteed optimal, so this is an UPPER BOUND on the account count. For
// the handful of providers in play the bound is almost certainly tight, but
// "almost certainly" is not "provably", and the number gets quoted.
const fixable = degraded.filter((r) => r.keyed.length > 0)
const forced = new Set<string>()
for (const r of fixable) if (r.keyed.length === 1) forced.add(r.keyed[0].name)

const covered = new Set<Row>()
for (const r of fixable) if (r.keyed.some((p) => forced.has(p.name))) covered.add(r)

const chosen = new Set(forced)
let remaining = fixable.filter((r) => !covered.has(r))
while (remaining.length > 0) {
  const tally = new Map<string, number>()
  for (const r of remaining) {
    for (const p of r.keyed) tally.set(p.name, (tally.get(p.name) ?? 0) + 1)
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  if (!best) break
  chosen.add(best[0])
  remaining = remaining.filter((r) => !r.keyed.some((p) => p.name === best[0]))
}

/** Every surface a given provider would lift, for the "what it buys" column. */
function buys(name: string): Row[] {
  return fixable.filter((r) => r.keyed.some((p) => p.name === name))
}

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
md.push(`· ${audit.results.length} probes · registry: ${DATA_SOURCES.length} surfaces`)
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
md.push(`| Degraded — not serving the intended source | **${degraded.length}** |`)
md.push(`| …of those, a key would fix | ${fixable.length} |`)
md.push(`| …of those, no key fixes | ${unfixable.length} |`)
md.push(`| Not covered by any audit probe | ${unprobed.length} |`)
md.push(`| **Accounts a user would open for full coverage** | **${chosen.size}** |`)
md.push('')
md.push(`The account figure is a greedy set cover, so it is an **upper bound**. ${forced.size} of the`)
md.push(`${chosen.size} ${forced.size === 1 ? 'is' : 'are'} forced — the only keyed provider for some surface — and the`)
md.push('remainder were chosen most-surfaces-first. It counts accounts, not money: several have a')
md.push('free tier, and the registry records `paid` separately from `key` for exactly that')
md.push('reason. It also counts only what a key can buy — the unfixable rows below are a')
md.push('product gap, and no number of accounts closes them.')
md.push('')
md.push('## The accounts')
md.push('')
md.push('| Provider | Forced? | Surfaces it lifts | Which |')
md.push('|---|---|---|---|')
for (const name of [...chosen].sort()) {
  const lifts = buys(name)
  const onlyHope = lifts.filter((r) => r.keyed.length === 1).length
  md.push(`| **${esc(name)}** | ${forced.has(name) ? `yes — sole source for ${onlyHope}` : 'no'} | ${lifts.length} | ${lifts.map((r) => esc(r.entry.id)).join(', ')} |`)
}
md.push('')
md.push('## Degraded surfaces, and what each is waiting on')
md.push('')
md.push('| | Surface | Module | Now | Waiting on |')
md.push('|---|---|---|---|---|')
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
console.log(`  ${live.length} live · ${degraded.length} degraded (${fixable.length} key-fixable, ${unfixable.length} not) · ${unprobed.length} unprobed`)
console.log(`  accounts for full coverage: ${chosen.size} (${[...chosen].sort().join(', ')})`)
