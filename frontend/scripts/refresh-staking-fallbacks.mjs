#!/usr/bin/env node
//
// Re-measure the staking FALLBACK table from a live reading.
//
//   npm run staking:refresh-fallbacks            # report only, writes nothing
//   npm run staking:refresh-fallbacks -- --write # rewrite the table and the date
//   npm run staking:refresh-fallbacks -- --write --from audit.json
//   npm run staking:refresh-fallbacks -- --direct --write  # no app running (D186)
//
// Where the reading comes from: `--from <file>` reads a saved reading; `--direct`
// calls the collector the route serves (lib/server/stakingRates.ts) in this
// process, so no dev server is needed; otherwise it asks the running app at
// FN_BASE_URL. All three are the same collector's answer.
//
// ── Why this is a committed command ──────────────────────────────────────────
// Since 2026-09-18 the route WITHHOLDS a measured fallback older than 14 days
// (owner decision; gap `estimate-expired`), so neglecting this table no longer
// publishes a stale number — it shows a dash. That bounds the damage, and it
// makes the repair the thing that has to be cheap. A gate without a one-command
// refresh just makes the page go dark.
//
// ⚠ IT MAY RUN IN THE CLOUD SINCE 2026-11-05 (D186). This said "run it from the
// owner machine", on the grounds that a cloud run measures the wrong network. Two
// things settled it the other way. A rate is what the source publishes, the same
// whoever asks: a network that cannot reach a source gets no rate, not a different
// one. And the rule below refuses any reading in which a measured key went unread,
// so a blocked source can never re-date an old value. On 2026-11-03 a cloud run
// reached all six sources and read all 22 measured keys. A weekly scheduled cloud
// session now runs `--direct --write` and opens a pull request for the owner to
// merge. Which sources WORK is still measured on the owner's machine (npm run audit).
//
// ⚠ IT WRITES ONLY A WHOLE READING (2026-10-13). FALLBACK_MEASURED_ON is one date
// for every measured key, so a key whose upstream did not answer would have its
// old value re-dated as measured today. With any measured key unread, --write
// refuses and writes nothing. The rules live in scripts/lib/stakingFallbackRefresh.mjs.
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
import { planFallbackRefresh, readingDate } from './lib/stakingFallbackRefresh.mjs'

const ROUTE_FILE = path.resolve(process.cwd(), 'src/lib/server/stakingRates.ts')
const BASE = process.env.BASE_URL ?? process.env.FN_BASE_URL ?? 'http://localhost:3000'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const DIRECT = args.includes('--direct')
const FROM = args.includes('--from') ? args[args.indexOf('--from') + 1] : null

async function readLive() {
  if (FROM) return JSON.parse(fs.readFileSync(path.resolve(FROM), 'utf8'))
  if (DIRECT) {
    // The route's own collector, so this is the reading the route would serve. It
    // is TypeScript, which is why the npm script runs this file with tsx.
    const { collectStakingRates } = await import('../src/lib/server/stakingRates.ts')
    return collectStakingRates()
  }
  const res = await fetch(`${BASE}/live-data/staking-rates`, { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`${BASE}/live-data/staking-rates → HTTP ${res.status}`)
  return res.json()
}

const live = await readLive()
const src = fs.readFileSync(ROUTE_FILE, 'utf8')
const today = readingDate(live)
const { measured, changed, skipped, failedUpstreams, liveCount, next, refusal } = planFallbackRefresh(src, live, today)
const upstreamCount = Object.keys(live.upstreams ?? {}).length

console.log(`\n═══ staking fallback refresh ${WRITE ? '(WRITE)' : '(report only)'} → ${FROM ?? (DIRECT ? 'the collector, read directly' : BASE)} ═══\n`)
console.log(`  upstreams      ${upstreamCount - failedUpstreams.length}/${upstreamCount} live`)
console.log(`  live keys      ${liveCount} of ${Object.keys(live.rates ?? {}).length}`)
console.log(`  measured set   ${measured.length} keys · ${changed.length} would change · ${skipped.length} skipped`)
if (failedUpstreams.length > 0) {
  console.log('\n  ⚠ upstreams NOT live — their keys are skipped, not zeroed:')
  for (const [name, why] of failedUpstreams) console.log(`      ${name.padEnd(22)} ${String(why).slice(0, 80)}`)
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
  // Said here too, so a report run tells the owner before --write whether today
  // is a day a refresh can happen at all.
  if (refusal) console.log(`\n  ⚠ --write would refuse today: ${refusal}`)
  console.log('\nREPORT ONLY — nothing written. Re-run with --write to apply.\n')
  process.exit(0)
}

if (refusal) {
  console.error(`\nREFUSED: ${refusal} Nothing written.\n`)
  process.exit(1)
}

fs.writeFileSync(ROUTE_FILE, next)
console.log(`\nWritten. FALLBACK_MEASURED_ON → ${today}. Run the suite before committing.\n`)
