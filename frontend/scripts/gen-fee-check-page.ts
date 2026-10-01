/**
 * Build the Transfer Fee Check page (T-031, owner decision D52).
 *
 *   npm run fee-check-page -- <out.html>
 *
 * The owner's check list for the hand pass over the transfer-fee table: one card per
 * exchange with its fee-page link and its rows, the 45 highest-impact rows on exchanges
 * with no keyless fee feed first, each exchange's entry-tier trading fee (T-036), and the
 * open fee leads from the ledger on the exchanges they name.
 *
 * WHY A PAGE AND NOT ONLY THE CSV. The CSV worksheet (npm run fee-worksheet) asks for a
 * spreadsheet, a terminal and a 534-row file on one machine; the job has waited since
 * 2026-08-20. The page works on any device the owner reads fee pages on, keeps its place
 * across sittings, and needs nothing installed. It does not replace the worksheet: both
 * come from scripts/lib/transferFeeRows.ts, so they rank and count the job identically.
 *
 * The page is REGENERATED, never hand-edited. The owner's answers live in the published
 * page's own database, which a republish never touches (scripts/lib/feeCheckPage.mjs says
 * where). Publish it with FEE_CHECK_CAPABILITIES. Claude reads the answers and runs
 * `npm run fee-check-plan` over them; nothing reaches the table except through a pull
 * request, and a changed fee goes through fee-apply's guards.
 *
 * Reads the table; writes only the page. Nothing here touches TRANSFER_FEES_LAST_VERIFIED.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  EXCHANGES,
  SPOT_TRADING_FEES,
  TRANSFER_FEES_LAST_VERIFIED,
  TRADING_FEES_COMPILED,
  transferFeesAgeDays,
} from '../src/lib/data/transferFees'
import { WITHDRAW_FEE_SOURCES } from '../src/lib/server/withdrawFeeAdapters'
import { hostOf, matchTermsEntry } from '../src/lib/server/sourceTerms'
import { feeRows } from './lib/transferFeeRows'
import { buildFeeCheckData, type LedgerItem } from './lib/feeCheckData'
import { buildFeeCheckPage, FEE_CHECK_CAPABILITIES } from './lib/feeCheckPage.mjs'

const out = process.argv[2]
if (!out || out.startsWith('-')) {
  console.error('usage: npm run fee-check-page -- <out.html>')
  process.exit(1)
}

const LEDGER = join(process.cwd(), '..', 'docs/audits/task-queue-2026-09-07.json')
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as { outstanding: LedgerItem[] }

const now = new Date()
const data = buildFeeCheckData({
  rows: feeRows(EXCHANGES),
  exchanges: EXCHANGES.map((e) => ({ id: e.id, name: e.name, tier: e.tier })),
  trading: SPOT_TRADING_FEES,
  feedIds: WITHDRAW_FEE_SOURCES.map((s) => s.exchangeId),
  prohibitedName: (url) => {
    const host = hostOf(url)
    const entry = host ? matchTermsEntry(host) : null
    return entry && entry.verdict === 'prohibited' ? entry.name : null
  },
  ledgerItems: ledger.outstanding,
  lastVerified: TRANSFER_FEES_LAST_VERIFIED,
  ageDays: transferFeesAgeDays(now),
  tradingCompiled: TRADING_FEES_COMPILED,
  generatedOn: now.toISOString().slice(0, 10),
})

const html = buildFeeCheckPage(data)
writeFileSync(resolve(out), html, 'utf8')

const human = data.exchanges.filter((e) => !e.feed)
const leads = data.generalLeads.length + data.exchanges.reduce((n, e) => n + e.leads.length, 0)
console.log(`Transfer Fee Check page written → ${resolve(out)} (${Math.round(html.length / 1024)} KB)`)
console.log(`  ${data.table.rows} rows across ${data.exchanges.length} exchanges; ${human.reduce((n, e) => n + e.rows.length, 0)} on the ${human.length} with no fee feed`)
console.log(`  start here: ${data.coreCount} rows; ${leads} lead placements from the ledger`)
console.log(`  table last fully verified ${data.table.lastVerified} (${data.table.ageDays} days ago) — not touched`)
console.log(`  publish with capabilities ${JSON.stringify(FEE_CHECK_CAPABILITIES)}`)
