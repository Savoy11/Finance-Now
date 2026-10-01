/**
 * Turn the answers on the Transfer Fee Check page into a plan for the table (T-031, D52).
 *
 *   npm run fee-check-plan -- <answers-dir> [--csv <out.csv>]
 *
 * <answers-dir> holds the page's database as the ArtifactData tool saves it with an
 * out_dir: <dir>/checks/<exchange:coin:network>.json, <dir>/trading/<exchangeId>.json and
 * <dir>/notes/<exchangeId>.json, one document per file.
 *
 * It reads every answer through the same core the page saved it with
 * (scripts/lib/feeCheck.core.js), against the table as it is NOW, and prints what the
 * answers ask for. Changed fees go to a worksheet CSV for `npm run fee-apply`, whose
 * guards then refuse the whole run if any row fails to resolve or the table moved since
 * the owner compared it. Minimums, rows no longer offered and trading fees are listed for
 * a hand edit: fee-apply moves fees only.
 *
 * An answer given against figures the table no longer holds is OUT OF DATE and is never
 * planned; it is listed so it can be asked again.
 *
 * Reads; writes only the CSV. Never touches TRANSFER_FEES_LAST_VERIFIED.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { EXCHANGES, SPOT_TRADING_FEES } from '../src/lib/data/transferFees'
import { feeRows } from './lib/transferFeeRows'

type Check = { key: string; result: string; fee: number | null; min: number | null; note: string }
type Trading = { exchangeId: string; result: string; maker: number | null; taker: number | null; note: string }
type Note = { exchangeId: string; text: string; at: string }
type PlanRow = { key: string; exchange: string; coin: string; network: string; fee: number; min: number }
type Plan = {
  csv: string
  feeChanges: Array<{ key: string; from: number; to: number }>
  minChanges: Array<{ key: string; from: number; to: number }>
  notOffered: string[]; confirmed: string[]; cantSee: string[]; stale: string[]; applied: string[]
  notes: Array<{ key: string; note: string }>
}
type TradingPlan = {
  changes: Array<{ exchangeId: string; from: { maker: number; taker: number } | null; to: { maker: number | null; taker: number | null } }>
  confirmed: string[]; cantSee: string[]; stale: string[]; notes: Array<{ exchangeId: string; note: string }>
}
interface Core {
  normRowCheck(id: string, x: unknown): Check
  normTradingCheck(id: string, x: unknown): Trading
  normExchangeNote(id: string, x: unknown): Note
  applyPlan(rows: PlanRow[], checks: Record<string, Check>): Plan
  tradingPlan(exchanges: Array<{ id: string; trading: unknown }>, checks: Record<string, Trading>): TradingPlan
}

const coreSrc = readFileSync(join(process.cwd(), 'scripts/lib/feeCheck.core.js'), 'utf8')
const core = new Function(`${coreSrc}\nreturn FeeCheckCore`)() as Core

const [dirArg, ...flags] = process.argv.slice(2)
if (!dirArg || dirArg.startsWith('-')) {
  console.error('usage: npm run fee-check-plan -- <answers-dir> [--csv <out.csv>]')
  process.exit(1)
}
const dir = resolve(dirArg)
const csvAt = flags.indexOf('--csv')
const csvOut = csvAt >= 0 ? flags[csvAt + 1] : null

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

const rows: PlanRow[] = feeRows(EXCHANGES).map((r) => ({
  key: r.key, exchange: r.exchange, coin: r.coin, network: r.network, fee: r.fee, min: r.minWithdraw,
}))
const known = new Set(rows.map((r) => r.key))

const checks: Record<string, Check> = {}
const unknown: string[] = []
for (const [id, body] of Object.entries(readCollection('checks'))) {
  if (!known.has(id)) { unknown.push(id); continue }
  checks[id] = core.normRowCheck(id, body)
}
const tradingChecks: Record<string, Trading> = {}
for (const [id, body] of Object.entries(readCollection('trading'))) tradingChecks[id] = core.normTradingCheck(id, body)
const notes = Object.entries(readCollection('notes')).map(([id, body]) => core.normExchangeNote(id, body)).filter((n) => n.text)

const plan = core.applyPlan(rows, checks)
const tplan = core.tradingPlan(
  EXCHANGES.map((e) => ({ id: e.id, trading: SPOT_TRADING_FEES[e.id] ?? null })),
  tradingChecks,
)

const list = (label: string, keys: string[]) => {
  console.log(`  ${label}: ${keys.length}`)
  for (const k of keys) console.log(`    ${k}`)
}
console.log(`Answers in ${dir}, read against the table as it is now (${rows.length} rows):`)
console.log(`  fee changes for fee-apply: ${plan.feeChanges.length}`)
for (const c of plan.feeChanges) console.log(`    ${c.key}: ${c.from} → ${c.to}`)
console.log(`  minimum changes (by hand): ${plan.minChanges.length}`)
for (const c of plan.minChanges) console.log(`    ${c.key}: ${c.from} → ${c.to}`)
list('no longer offered (row removal, by hand)', plan.notOffered)
list('matches', plan.confirmed)
list("can't see it", plan.cantSee)
list('OUT OF DATE — answered against older figures, not planned', plan.stale)
list('already in the table', plan.applied)
if (plan.notes.length) {
  console.log(`  notes: ${plan.notes.length}`)
  for (const n of plan.notes) console.log(`    ${n.key}: ${n.note}`)
}
if (unknown.length) list('answers for rows the table no longer has (ignored)', unknown)
console.log('Trading fees:')
for (const c of tplan.changes) {
  const from = c.from ? `${c.from.maker}/${c.from.taker}` : 'not in the table'
  console.log(`  ${c.exchangeId}: ${from} → ${c.to.maker}/${c.to.taker} (maker/taker %, by hand)`)
}
list('trading matches', tplan.confirmed)
list("trading can't see it", tplan.cantSee)
list('trading OUT OF DATE', tplan.stale)
for (const n of tplan.notes) console.log(`  trading note ${n.exchangeId}: ${n.note}`)
for (const n of notes) console.log(`  exchange note ${n.exchangeId} (${n.at.slice(0, 10)}): ${n.text}`)

if (csvOut) {
  writeFileSync(resolve(csvOut), plan.csv, 'utf8')
  console.log(`\nfee-apply input written → ${resolve(csvOut)} (${plan.feeChanges.length} row${plan.feeChanges.length === 1 ? '' : 's'})`)
  console.log(`next: npm run fee-apply -- ${csvOut} --dry-run`)
}
