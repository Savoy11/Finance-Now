/**
 * Fund net assets from SEC filings, re-read (D168) — `npm run fund-assets-check`.
 *
 *   npm run fund-assets-check                     every catalog fund with a filed figure
 *   npm run fund-assets-check -- --only AGG,TLT   these funds
 *   npm run fund-assets-check -- --json out.json  also write the lines as JSON
 *
 * For each catalog fund whose asset figure carries an SEC filing date (`aumAsOf`), finds its
 * newest NPORT-P through the app's own N-PORT code (lib/server/nport.ts: the SEC's ticker →
 * series map, then the series' filings) and compares period, net assets and accession. Reads
 * only sec.gov, keyless; reports, never writes (rules: scripts/lib/fundAssetsCheck.ts). The
 * differences go to the owner, and a change lands by PR.
 *
 * Replaces the `npm run fund-facts` the quarterly report named until D168: that script rebuilds
 * fundFacts.generated.json, which nothing in the app reads (T-392), and never touched these
 * figures. Requests are spaced under the SEC's 10-a-second limit.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FUND_CATALOG } from '../src/lib/data/fundCatalog'
import { fetchNportReport, listNportFilings, resolveFundSeries } from '../src/lib/server/nport'
import { assetsReport, compareFiled, type AssetsLine, type FilingResult } from './lib/fundAssetsCheck'

const args = process.argv.slice(2)
const onlyIdx = args.indexOf('--only')
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []
const jsonIdx = args.indexOf('--json')
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : undefined

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function newestFiling(symbol: string): Promise<FilingResult> {
  try {
    const series = await resolveFundSeries(symbol)
    if (!series) return { kind: 'not-nport', why: 'not in the SEC’s fund ticker map' }
    await sleep(150)
    const filings = await listNportFilings(series.seriesId, 3)
    if (!filings.length) return { kind: 'not-nport', why: `series ${series.seriesId} has no NPORT-P filings` }
    await sleep(150)
    const report = await fetchNportReport(filings[0])
    return { kind: 'nport', asOf: report.asOf, netAssets: report.netAssets, accession: filings[0].accession, filedAt: filings[0].filedAt }
  } catch (e) {
    return { kind: 'error', why: e instanceof Error ? e.message : String(e) }
  }
}

async function main() {
  const rows = FUND_CATALOG.filter((f) => f.aumAsOf && (only.length === 0 || only.includes(f.symbol)))
  if (rows.length === 0) {
    console.error('fund-assets-check: no catalog fund with a filed figure matched. A check that finds nothing has checked nothing.')
    process.exit(1)
  }
  const lines: AssetsLine[] = []
  for (const [i, f] of rows.entries()) {
    process.stderr.write(`\r  ${i + 1}/${rows.length} ${f.symbol.padEnd(6)}`)
    lines.push(compareFiled({ symbol: f.symbol, aumB: f.aumB, aumAsOf: f.aumAsOf!, aumSource: f.aumSource }, await newestFiling(f.symbol)))
    await sleep(150)
  }
  process.stderr.write('\n')
  console.log(assetsReport(lines, new Date().toISOString().slice(0, 10)))
  if (jsonOut) writeFileSync(resolve(jsonOut), JSON.stringify(lines, null, 1) + '\n', 'utf8')
}

main().catch((e) => {
  console.error(`fund-assets-check: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
