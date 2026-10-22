/**
 * Read the answers on the Staking Facts Check page against the catalog (T-394).
 *
 *   npm run staking-facts-plan -- <answers-dir>
 *
 * <answers-dir> holds the page's database as the ArtifactData tool saves it with an
 * out_dir: <dir>/checks/<key>.json and <dir>/notes/<providerId>.json, one document per
 * file.
 *
 * It reads every answer through the same core the page saved it with
 * (scripts/lib/stakingFacts.core.js), against the catalog as it is NOW, and prints what
 * the answers ask for: each figure that differs, each coin a provider no longer stakes,
 * and what is confirmed, unseen, out of date or still unread. An answer given against
 * catalog figures that have since changed is OUT OF DATE and is never planned.
 *
 * REPORTS, NEVER WRITES. Each change is made by hand in stakingProviders.ts, in a pull
 * request. STAKING_DATA_LAST_VERIFIED may move only when `complete` is true. Nothing here
 * touches it.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { STAKING_PROVIDERS, STAKING_COIN_INFO, STAKING_DATA_LAST_VERIFIED } from '../src/lib/data/stakingProviders'
import { stakingFactRows, type FactRow } from './lib/stakingFactRows'
import { readSavedCollection } from './lib/savedCollection'

type Check = { key: string; result: string; values: Record<string, unknown>; note: string; at: string }
type Change = { key: string; providerId: string; kind: string; coin: string | null; field: string; from: unknown; to: unknown }
type Plan = {
  changes: Change[]; notOffered: string[]; confirmed: string[]; cantSee: string[]; stale: string[]; applied: string[]; unread: string[]
  notes: Array<{ key: string; note: string }>; complete: boolean; lastAnswered: string | null
}
interface Core {
  normCheck(id: string, x: unknown): Check
  normProviderNote(id: string, x: unknown): { providerId: string; text: string; at: string }
  factPlan(rows: FactRow[], checks: Record<string, Check>): Plan
}

const coreSrc = readFileSync(join(process.cwd(), 'scripts/lib/stakingFacts.core.js'), 'utf8')
const core = new Function(`${coreSrc}\nreturn StakingFactsCore`)() as Core

const [dirArg] = process.argv.slice(2)
if (!dirArg || dirArg.startsWith('-')) {
  console.error('usage: npm run staking-facts-plan -- <answers-dir>')
  process.exit(1)
}
const dir = resolve(dirArg)

/** Every document in one saved collection, keyed by its id (decoded from the file name). */
const readCollection = (name: string) => readSavedCollection(dir, name)

const symbols = Object.fromEntries(Object.entries(STAKING_COIN_INFO).map(([id, c]) => [id, c.symbol]))
const rows = stakingFactRows(STAKING_PROVIDERS, symbols)
const known = new Set(rows.map((r) => r.key))
const checks: Record<string, Check> = {}
const unknown: string[] = []
for (const [id, body] of Object.entries(readCollection('checks'))) {
  if (!known.has(id)) { unknown.push(id); continue }
  checks[id] = core.normCheck(id, body)
}
const notes = Object.entries(readCollection('notes')).map(([id, body]) => core.normProviderNote(id, body)).filter((n) => n.text)

const plan = core.factPlan(rows, checks)

const list = (label: string, keys: string[]) => {
  console.log(`  ${label}: ${keys.length}`)
  if (keys.length) console.log(`    ${keys.join(' ')}`)
}
console.log(`Answers in ${dir}, read against the catalog as it is now (${rows.length} facts):`)
console.log(`  changes to make by hand in stakingProviders.ts: ${plan.changes.length}`)
for (const c of plan.changes) console.log(`    ${c.key} ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`)
list('coins no longer offered (remove the asset entry, by hand)', plan.notOffered)
list('matches', plan.confirmed)
list("can't see it", plan.cantSee)
list('OUT OF DATE — answered against older figures, not planned', plan.stale)
list('already in the catalog', plan.applied)
list('not answered yet', plan.unread)
if (plan.notes.length) {
  console.log(`  notes: ${plan.notes.length}`)
  for (const n of plan.notes) console.log(`    ${n.key}: ${n.note}`)
}
if (unknown.length) list('answers for facts the catalog no longer has (ignored)', unknown)
for (const n of notes) console.log(`  provider note ${n.providerId} (${n.at.slice(0, 10)}): ${n.text}`)
console.log(plan.complete
  ? `\nEvery fact has a settling answer. Once the changes above are merged, STAKING_DATA_LAST_VERIFIED (${STAKING_DATA_LAST_VERIFIED}) may move to the day the pass finished (${plan.lastAnswered?.slice(0, 10)}); that voids its STALENESS-ACK, as intended.`
  : `\nNot complete: STAKING_DATA_LAST_VERIFIED (${STAKING_DATA_LAST_VERIFIED}) must not move yet.`)
