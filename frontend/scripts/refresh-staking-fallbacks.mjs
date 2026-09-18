#!/usr/bin/env node
//
// Re-measure the staking FALLBACK table from a live reading.
//
//   npm run staking:refresh-fallbacks            # report only, writes nothing
//   npm run staking:refresh-fallbacks -- --write # rewrite the table and the date
//   npm run staking:refresh-fallbacks -- --write --from audit.json
//
// ── Why this is a committed command ──────────────────────────────────────────
// Since 2026-09-18 the route WITHHOLDS a measured fallback older than 14 days
// (owner decision; gap `estimate-expired`), so neglecting this table no longer
// publishes a stale number — it shows a dash. That bounds the damage, and it
// makes the repair the thing that has to be cheap. A gate without a one-command
// refresh just makes the page go dark.
//
// ⚠ RUN IT FROM THE OWNER MACHINE. These verdicts are IP-dependent (CLAUDE.md):
// a cloud or CI run measures that host's egress, not a user's, and would write
// the wrong numbers into the table with a fresh date on them.
//
// ── It REPORTS what it changed, and that is not decoration ───────────────────
// The first hand-run of this refresh matched ZERO keys and bumped the date
// anyway — a table claiming a measurement it never had, which is precisely the
// staleness lie the measured/unmeasured split exists to prevent. The full suite
// stayed green, because no test can distinguish "re-measured, unchanged" from
// "never measured". The change list below is the only thing that catches it, so
// it prints even when nothing moved.

import fs from 'node:fs'
import path from 'node:path'

const ROUTE_FILE = path.resolve(process.cwd(), 'src/app/live-data/staking-rates/route.ts')
const BASE = process.env.BASE_URL ?? process.env.FN_BASE_URL ?? 'http://localhost:3000'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const FROM = args.includes('--from') ? args[args.indexOf('--from') + 1] : null

async function readLive() {
  if (FROM) return JSON.parse(fs.readFileSync(path.resolve(FROM), 'utf8'))
  const res = await fetch(`${BASE}/live-data/staking-rates`, { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`${BASE}/live-data/staking-rates → HTTP ${res.status}`)
  return res.json()
}

const live = await readLive()
const src = fs.readFileSync(ROUTE_FILE, 'utf8')

// The measured set is the contract: refresh exactly those keys, so the date
// bump covers precisely what it claims to and the 24 undated legacy estimates
// stay undated.
const setMatch = src.match(/const FALLBACK_MEASURED: ReadonlySet<string> = new Set\(\[([\s\S]*?)\]\)/)
if (!setMatch) throw new Error('FALLBACK_MEASURED not found — has the route changed shape?')
const measured = [...setMatch[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1])

const liveCount = Object.values(live.sources ?? {}).filter((s) => s === 'live').length
const upstreams = Object.entries(live.upstreams ?? {})
const failed = upstreams.filter(([, v]) => !String(v).startsWith('live'))

let next = src
const changed = []
const skipped = []

for (const key of measured) {
  const value = live.rates?.[key]
  if (live.sources?.[key] !== 'live' || typeof value !== 'number') {
    skipped.push(key)
    continue
  }
  const fresh = parseFloat(value.toFixed(2))
  const re = new RegExp(`(^\\s*${key}:\\s*)([0-9.]+)(,)`, 'm')
  const found = next.match(re)
  if (!found) {
    skipped.push(`${key} (no FALLBACK row)`)
    continue
  }
  const old = parseFloat(found[2])
  if (old !== fresh) changed.push({ key, old, fresh })
  next = next.replace(re, `$1${fresh}$3`)
}

const today = new Date().toISOString().slice(0, 10)
next = next.replace(/const FALLBACK_MEASURED_ON = '[0-9-]+'/, `const FALLBACK_MEASURED_ON = '${today}'`)

console.log(`\n═══ staking fallback refresh ${WRITE ? '(WRITE)' : '(report only)'} → ${FROM ?? BASE} ═══\n`)
console.log(`  upstreams      ${upstreams.length - failed.length}/${upstreams.length} live`)
console.log(`  live keys      ${liveCount} of ${Object.keys(live.rates ?? {}).length}`)
console.log(`  measured set   ${measured.length} keys · ${changed.length} would change · ${skipped.length} skipped`)
if (failed.length > 0) {
  console.log('\n  ⚠ upstreams NOT live — their keys are skipped, not zeroed:')
  for (const [name, why] of failed) console.log(`      ${name.padEnd(22)} ${String(why).slice(0, 80)}`)
}
if (skipped.length > 0) console.log(`\n  skipped: ${skipped.join(', ')}`)

if (changed.length > 0) {
  changed.sort((a, b) => Math.abs((b.fresh - b.old) / b.old) - Math.abs((a.fresh - a.old) / a.old))
  console.log('\n  key                    old      new     drift')
  for (const c of changed) {
    const d = ((c.fresh - c.old) / c.old) * 100
    console.log(
      `  ${c.key.padEnd(20)} ${String(c.old).padStart(7)} ${String(c.fresh).padStart(8)} ` +
      `${`${d > 0 ? '+' : ''}${d.toFixed(0)}%`.padStart(9)}${Math.abs(d) >= 25 ? '  <<' : ''}`,
    )
  }
} else {
  console.log('\n  no value moved at 2dp.')
}

if (!WRITE) {
  console.log('\nREPORT ONLY — nothing written. Re-run with --write to apply.\n')
  process.exit(0)
}

// Refuse to stamp a fresh date on a table nothing was read into. A skipped key
// is a key whose upstream did not answer, and dating those as "measured today"
// is the exact lie this script exists to avoid.
if (skipped.length === measured.length) {
  console.error('\nREFUSED: not one measured key came back live. Nothing written.\n')
  process.exit(1)
}

fs.writeFileSync(ROUTE_FILE, next)
console.log(`\nWritten. FALLBACK_MEASURED_ON → ${today}. Run the suite before committing.\n`)
