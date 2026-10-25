/**
 * The quarterly accuracy check (D166) — `npm run accuracy-check`.
 *
 *   npm run accuracy-check                          the report, today
 *   npm run accuracy-check -- --now=2027-01-05      the report as it will read on that day
 *   npm run accuracy-check -- --out report.md       also write it to a file
 *
 * Lists every posted figure with a date (each shown fund yield, each fund asset figure, every
 * provenance clock), when its re-read falls due, and the command that re-reads it. It reads no
 * website, spends nothing and changes nothing; the rules are in scripts/lib/accuracyCheck.ts.
 * It exits 0 whatever is due: the fund pages already withhold a yield whose check was missed,
 * so a due figure is a reminder, never a broken build. It exits 1 only if it cannot find what
 * it checks (no fund figures or no clocks), since a check that sees nothing proves nothing.
 *
 * `.github/workflows/quarterly-accuracy-check.yml` runs it at the start of each quarter and
 * posts the report as an issue, so the reminder arrives without anyone remembering to look.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FUND_CATALOG, FUND_SITES_ALLOWED } from '../src/lib/data/fundCatalog'
import { discover } from './check-staleness-horizon'
import { accuracyReport, clockRows, fundRows, summarize, yieldSiteList } from './lib/accuracyCheck'

const args = process.argv.slice(2)
const nowArg = args.find((a) => a.startsWith('--now='))?.slice('--now='.length)
const outIdx = args.indexOf('--out')
const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined
if (nowArg !== undefined && Number.isNaN(Date.parse(`${nowArg}T00:00:00Z`))) {
  console.error(`accuracy-check: --now must be YYYY-MM-DD, got "${nowArg}"`)
  process.exit(1)
}
if (outIdx >= 0 && (!outPath || outPath.startsWith('-'))) {
  console.error('accuracy-check: --out takes a file path')
  process.exit(1)
}
const nowMs = nowArg ? Date.parse(`${nowArg}T00:00:00Z`) : Date.now()
const today = new Date(nowMs).toISOString().slice(0, 10)

const funds = fundRows(FUND_CATALOG, nowMs)
const { clocks, problems } = discover()
if (funds.length === 0 || clocks.length === 0) {
  console.error(`accuracy-check: found ${funds.length} fund figures and ${clocks.length} clocks. A check that finds nothing has checked nothing.`)
  process.exit(1)
}
for (const p of problems) console.error(`accuracy-check: clock discovery: ${p}`)

const summary = summarize([...funds, ...clockRows(clocks, nowMs)])
const report = accuracyReport(summary, today, { yieldSites: yieldSiteList(FUND_SITES_ALLOWED) })
console.log(report)
if (outPath) {
  writeFileSync(resolve(outPath), report + '\n', 'utf8')
  console.error(`\nWritten to ${resolve(outPath)}`)
}
