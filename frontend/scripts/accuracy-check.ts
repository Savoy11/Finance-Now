/**
 * The quarterly accuracy check (D166) — `npm run accuracy-check`.
 *
 *   npm run accuracy-check                          the report, today
 *   npm run accuracy-check -- --now=2027-01-05      the report as it will read on that day
 *   npm run accuracy-check -- --out report.md       also write it to a file
 *   npm run accuracy-check -- --sec                 also each stock's SEC figures (D167; reads data.sec.gov)
 *
 * Lists every posted figure with a date (each shown fund yield, each fund asset figure, every
 * provenance clock), when its re-read falls due, and the command that re-reads it. It reads no
 * website unless `--sec` asks it to read the SEC's data for the stocks, spends nothing and changes nothing; the rules are in scripts/lib/accuracyCheck.ts.
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
import { EQUITY_CATALOG } from '../src/lib/data/equityCatalog'
import { fetchStockPerShare } from '../src/lib/server/stockPerShare'
import { discover } from './check-staleness-horizon'
import { accuracyReport, clockRows, fundRows, stockRows, summarize, yieldSiteList, type AccuracyRow } from './lib/accuracyCheck'

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

async function main() {
  let stocks: AccuracyRow[] = []
  if (args.includes('--sec')) {
    const nonPayers = new Set(EQUITY_CATALOG.filter((e) => e.dividendYieldPct === null).map((e) => e.symbol))
    const { bySymbol, reached } = await fetchStockPerShare(EQUITY_CATALOG.map((e) => e.symbol), nonPayers, new Date(nowMs))
    if (!reached) {
      console.error('accuracy-check: --sec could not reach the SEC’s data, so the stock figures were not checked.')
      process.exit(1)
    }
    stocks = stockRows(bySymbol, nowMs)
  }

  const summary = summarize([...funds, ...stocks, ...clockRows(clocks, nowMs)])
  const report = accuracyReport(summary, today, { yieldSites: yieldSiteList(FUND_SITES_ALLOWED) })
  console.log(report)
  if (outPath) {
    writeFileSync(resolve(outPath), report + '\n', 'utf8')
    console.error(`\nWritten to ${resolve(outPath)}`)
  }
}

main().catch((e) => {
  console.error(`accuracy-check: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
