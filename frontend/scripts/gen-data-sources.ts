/**
 * Generates DATA-SOURCES.md (repo root) from the canonical registry in
 * src/lib/data/dataSources.ts, and (with --verify) cross-checks the registry
 * against the hosts actually fetched in each /live-data route.
 *
 *   npm run data-sources           # regenerate DATA-SOURCES.md
 *   npm run data-sources -- --verify   # also print registry↔code drift
 *
 * The registry is the single source of truth; this file only renders/checks it,
 * so the doc can never silently drift from the code the way a hand-written table
 * would. Run it whenever a data source is added, removed, or changes status.
 */
import fs from 'node:fs'
import { driftItems, linkOnlyItems, readRoutes } from './lib/routeHosts.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_SOURCES, SOURCE_STATUS_META, type DataSourceEntry } from '../src/lib/data/dataSources'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(here, '..')
const repoRoot = path.resolve(frontendDir, '..')
const liveDataDir = path.join(frontendDir, 'src/app/live-data')
const outFile = path.join(repoRoot, 'DATA-SOURCES.md')

const MODULE_TITLES: Record<DataSourceEntry['module'], string> = {
  crypto: 'Crypto', equities: 'Equities', funds: 'ETFs & Funds', macro: 'Macro Markets', shared: 'Shared / Cross-module',
}

function esc(s: string): string {
  return s.replace(/\|/g, '\\|')
}

function providerCell(e: DataSourceEntry): string {
  return e.providers.map(p => {
    const auth = p.auth === 'none' ? '' : p.auth === 'paid' ? ' _(paid)_' : ' _(key)_'
    const name = p.url ? `[${p.name}](${p.url})` : p.name
    const host = p.host ? ` \`${p.host}\`` : ''
    return `${name}${host}${auth}`
  }).join('<br>')
}

function renderMarkdown(): string {
  const now = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push('# Finance Now — Data Source Inventory')
  lines.push('')
  lines.push('_Auto-generated from `src/lib/data/dataSources.ts` by `npm run data-sources`. **Do not hand-edit** —')
  lines.push('change the registry and regenerate. This is the "where does the data come from" companion to')
  lines.push('`DATA-AVAILABILITY.md` (which tracks whether each surface is live). The same registry powers the')
  lines.push('in-app **/data-sources** page and the per-page provenance badges, so the app and the docs never diverge._')
  lines.push('')
  lines.push(`_Last generated: **${now}**_`)
  lines.push('')
  lines.push('## Legend')
  lines.push('')
  lines.push('| Status | Meaning |')
  lines.push('|--------|---------|')
  for (const [k, v] of Object.entries(SOURCE_STATUS_META)) {
    const meaning: Record<string, string> = {
      live: 'Sourced from a real external provider at request time.',
      partial: 'Some fields live, others static reference values or labeled estimates.',
      'key-gated': 'Needs an API key / paid plan the project may not have. Route reports this honestly.',
      derived: 'Computed from other live data, not a single upstream.',
      unavailable: 'No free real-time source; the UI shows an explicit "not available" notice.',
    }
    lines.push(`| **${v.label}** | ${meaning[k]} |`)
  }
  lines.push('')
  lines.push('Provider tags: `key` = needs an API key · `paid` = needs a paid plan · untagged = keyless.')
  lines.push('')

  const modules = [...new Set(DATA_SOURCES.map(e => e.module))]
  for (const m of modules) {
    lines.push(`## ${MODULE_TITLES[m]}`)
    lines.push('')
    lines.push('| Surface | Status | Provider(s) | Cadence | Route |')
    lines.push('|---------|--------|-------------|---------|-------|')
    for (const e of DATA_SOURCES.filter(x => x.module === m)) {
      const status = SOURCE_STATUS_META[e.status].label
      const route = e.route ? `\`${e.route}\`` : '—'
      lines.push(`| ${esc(e.surface)} | ${status} | ${providerCell(e)} | ${esc(e.cadence ?? '—')} | ${route} |`)
    }
    lines.push('')
    // Notes + static-data footnotes for this module
    const withNotes = DATA_SOURCES.filter(x => x.module === m && (x.notes || x.staticData?.length))
    if (withNotes.length) {
      for (const e of withNotes) {
        const bits: string[] = []
        if (e.notes) bits.push(e.notes)
        if (e.staticData?.length) bits.push(`Reference/fallback data: ${e.staticData.map(s => `\`${s}\``).join(', ')}.`)
        lines.push(`- **${esc(e.surface)}** — ${bits.join(' ')}`)
      }
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push(`_${DATA_SOURCES.length} surfaces catalogued. Regenerate with \`npm run data-sources\`; verify against the route code with \`npm run data-sources -- --verify\`._`)
  lines.push('')
  return lines.join('\n')
}

/**
 * Cross-checks the registry against the route code. Returns the number of drift
 * items so the caller can set a non-zero exit code.
 *
 * The walk, the host scan and the owner lookup live in scripts/lib/routeHosts.mjs, where
 * they are unit-tested. Comments are stripped before scanning (2026-09-26): a tombstone
 * recording a removed endpoint is not a fetch. Nested route folders are read too
 * (2026-10-13, T-432): the five wallet routes sit one folder down and were never checked.
 *
 * This used to print its findings and exit 0, which made it advisory in the one
 * situation that matters: a route fetching a host nobody registered. The
 * source-terms enforcement (lib/server/__tests__/sourceTerms.test.ts) can only
 * check hosts that ARE in the registry, so an unregistered host slips past both
 * — the test never sees it and this printed a warning that failed nothing.
 * Verified 2026-08-08 by adding a Yahoo fetch to a route without declaring it:
 * this caught it, the test suite did not, and the exit code was 0.
 */
function verify(): number {
  console.log('\n── Registry ↔ code drift check ──')
  const routes = readRoutes(liveDataDir)
  // Routes are read with the lib/server and lib/api modules they import (T-439, D113).
  const items = [...driftItems(DATA_SOURCES, routes), ...linkOnlyItems(path.resolve(liveDataDir, '..', '..'))]
  for (const item of items) console.log(`  ⚠ ${item}`)
  console.log(items.length
    ? `\n${items.length} drift item(s) — reconcile registry with code.`
    : `  ✓ no drift: every host in ${routes.length} routes, and the lib/server and lib/api modules they import, is represented in the registry.`)
  return items.length
}

const md = renderMarkdown()
fs.writeFileSync(outFile, md)
console.log(`Wrote ${path.relative(repoRoot, outFile)} (${DATA_SOURCES.length} surfaces).`)
if (process.argv.includes('--verify')) {
  const issues = verify()
  // exitCode rather than process.exit(): lets stdout flush before the runtime
  // tears down, so CI shows which routes drifted and not just a bare failure.
  if (issues > 0) {
    console.error(
      `\nA route fetches a host the registry does not name. Add it to the provider ` +
      `list in src/lib/data/dataSources.ts — that is also what puts it in front of ` +
      `the source-terms check, which cannot review a host it has never heard of.`
    )
    process.exitCode = 1
  }
}
