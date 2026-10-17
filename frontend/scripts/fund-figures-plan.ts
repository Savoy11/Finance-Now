/**
 * Read the readings on the Fund Figures Check page against the catalog (T-440).
 *
 *   npm run fund-figures-plan -- <answers-dir>
 *
 * <answers-dir> holds the page's database as the ArtifactData tool saves it with an
 * out_dir: <dir>/readings/<SYMBOL:yield|assets>.json and <dir>/notes/<SYMBOL>.json, one
 * document per file.
 *
 * It reads every reading through the same core the page saved it with
 * (scripts/lib/fundFigures.core.js), against the catalog as it is NOW, and prints what
 * the readings say: the figures that differ, those that agree at the catalog's own
 * precision, readings of a different kind than the catalog holds, and what is still
 * unread. A reading taken against a catalog figure that has since changed is OUT OF DATE
 * and is listed so it can be asked again.
 *
 * REPORTS, NEVER WRITES. Claude brings the differences to the owner before anything is
 * changed (T-440's next action), and the catalog moves only in a pull request. The
 * compiled date may move only when `complete` is true, and then to the oldest date read.
 * Nothing here touches FUND_FIGURES_COMPILED_ON.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FUND_CATALOG, FUND_FIGURES_COMPILED_ON } from '../src/lib/data/fundCatalog'
import { figuresFor, type FundFigure } from './lib/fundFiguresData'

type Reading = { id: string; result: string; value: number | null; typed: string; asOf: string | null; kind: string | null; note: string }
type Item = { id: string; symbol: string; figure: string; from: number; to: number; asOf: string; kind: string; note: string }
type Plan = {
  differ: Item[]; same: Item[]; otherKind: Item[]
  cantSee: string[]; stale: string[]; applied: string[]; unread: string[]
  notes: Array<{ id: string; note: string }>
  oldestAsOf: string | null; complete: boolean
}
interface Core {
  YIELD_KINDS: Record<string, string>
  ASSET_KINDS: Record<string, string>
  normReading(id: string, x: unknown): Reading
  normFundNote(id: string, x: unknown): { symbol: string; text: string; at: string }
  figurePlan(figs: FundFigure[], readings: Record<string, Reading>): Plan
  figureText(figure: string, value: number | null): string
}

const coreSrc = readFileSync(join(process.cwd(), 'scripts/lib/fundFigures.core.js'), 'utf8')
const core = new Function(`${coreSrc}\nreturn FundFiguresCore`)() as Core

const [dirArg] = process.argv.slice(2)
if (!dirArg || dirArg.startsWith('-')) {
  console.error('usage: npm run fund-figures-plan -- <answers-dir>')
  process.exit(1)
}
const dir = resolve(dirArg)

/** Every document in one saved collection, keyed by id (the file name). */
function readCollection(name: string): Record<string, unknown> {
  const d = join(dir, name)
  const out: Record<string, unknown> = {}
  if (!existsSync(d)) return out
  for (const f of readdirSync(d)) {
    if (!f.endsWith('.json')) continue
    try {
      const body = JSON.parse(readFileSync(join(d, f), 'utf8'))
      // Tolerate a { data } wrapper as well as a bare document.
      out[f.slice(0, -'.json'.length)] = body && typeof body === 'object' && 'data' in body && typeof body.data === 'object' ? body.data : body
    } catch {
      console.warn(`  skipped ${name}/${f}: not readable JSON`)
    }
  }
  return out
}

const figs = FUND_CATALOG.flatMap(figuresFor)
const known = new Set(figs.map((f) => f.id))
const readings: Record<string, Reading> = {}
const unknown: string[] = []
for (const [id, body] of Object.entries(readCollection('readings'))) {
  if (!known.has(id)) { unknown.push(id); continue }
  readings[id] = core.normReading(id, body)
}
const notes = Object.entries(readCollection('notes')).map(([id, body]) => core.normFundNote(id, body)).filter((n) => n.text)

const plan = core.figurePlan(figs, readings)

const kindText = (i: Item) => (i.figure === 'yield' ? core.YIELD_KINDS : core.ASSET_KINDS)[i.kind] ?? i.kind
const show = (i: Item) => {
  const typed = readings[i.id]?.typed
  return `    ${i.id}: ${core.figureText(i.figure, i.from)} → ${core.figureText(i.figure, i.to)} as of ${i.asOf}` +
    (typed ? ` (typed “${typed}”)` : '') + (i.note ? ` — ${i.note}` : '')
}
const list = (label: string, ids: string[]) => {
  console.log(`  ${label}: ${ids.length}`)
  for (const k of ids) console.log(`    ${k}`)
}
console.log(`Readings in ${dir}, read against the catalog as it is now (${figs.length} figures):`)
console.log(`  differ from the catalog — bring to the owner: ${plan.differ.length}`)
for (const i of plan.differ) console.log(show(i))
console.log(`  a different kind of figure than the catalog holds — ask before using: ${plan.otherKind.length}`)
for (const i of plan.otherKind) console.log(`${show(i)} [${kindText(i)}]`)
console.log(`  agree at the catalog's precision (a date to record): ${plan.same.length}`)
for (const i of plan.same) console.log(show(i))
list("can't find it", plan.cantSee)
list('OUT OF DATE — read against an older catalog figure, not planned', plan.stale)
list('already in the catalog', plan.applied)
console.log(`  not read yet: ${plan.unread.length}${plan.unread.length ? `\n    ${plan.unread.join(' ')}` : ''}`)
if (plan.notes.length) {
  console.log(`  notes: ${plan.notes.length}`)
  for (const n of plan.notes) console.log(`    ${n.id}: ${n.note}`)
}
if (unknown.length) list('readings for figures the catalog no longer has (ignored)', unknown)
for (const n of notes) console.log(`  fund note ${n.symbol} (${n.at.slice(0, 10)}): ${n.text}`)
console.log(plan.complete
  ? `\nEvery figure has a dated reading. FUND_FIGURES_COMPILED_ON (${FUND_FIGURES_COMPILED_ON}) may move to ${plan.oldestAsOf} once the owner has approved the changes; that voids its STALENESS-ACK, as intended.`
  : `\nNot complete: FUND_FIGURES_COMPILED_ON (${FUND_FIGURES_COMPILED_ON}) must not move yet.`)
