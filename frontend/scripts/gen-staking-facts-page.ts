/**
 * Build the Staking Facts Check page (T-394).
 *
 *   npm run staking-facts-page -- <out.html>
 *
 * The owner's check list for re-reading the staking catalog's factual fields: one card
 * per provider with its own staking page, and a row per fact — the page itself, the year
 * founded, the audit count, the staking-assets figure where DefiLlama cannot see it, and
 * each coin's minimum stake and lock-up. The rows come from scripts/lib/stakingFactRows.ts,
 * which the plan reads too, so the page and the plan cannot disagree.
 *
 * WHY A PAGE. Nothing in this environment can reach a provider's site, and the CSV
 * worksheet (npm run staking-worksheet) asks for a spreadsheet and a terminal. The page
 * works on any device, keeps its place across sittings, and needs nothing installed (the
 * Transfer Fee Check's reasoning, D52).
 *
 * The page is REGENERATED, never hand-edited. The answers live in the published page's
 * own database, which a republish never touches (scripts/lib/stakingFactsPage.mjs says
 * where). Publish it with STAKING_FACTS_CAPABILITIES. Claude reads the answers and runs
 * `npm run staking-facts-plan` over them; nothing reaches the catalog except by hand, in a
 * pull request.
 *
 * --suggestions takes the pre-fill's file (staking-facts-suggestions.json, gitignored): each
 * figure it found on a provider's own pages shows on its row, with the passage it came from,
 * or why there is none. It is a hint beside the row and never fills an answer box.
 *
 * Reads the catalog; writes only the page. Nothing here touches STAKING_DATA_LAST_VERIFIED.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  STAKING_PROVIDERS,
  STAKING_COIN_INFO,
  STAKING_DATA_LAST_VERIFIED,
  STAKING_DATA_STALE_AFTER_DAYS,
  stakingDataAgeDays,
} from '../src/lib/data/stakingProviders'
import { buildStakingFactsData, suggestionsByRow } from './lib/stakingFactsData'
import { buildStakingFactsPage, STAKING_FACTS_CAPABILITIES } from './lib/stakingFactsPage.mjs'
import { stakingFactRows } from './lib/stakingFactRows'

const [out, ...flags] = process.argv.slice(2)
if (!out || out.startsWith('-')) {
  console.error('usage: npm run staking-facts-page -- <out.html> [--suggestions <file>]')
  process.exit(1)
}
const suggestionsAt = flags.indexOf('--suggestions')
const suggestionsFile = suggestionsAt >= 0 ? flags[suggestionsAt + 1] : null
if (suggestionsAt >= 0 && (!suggestionsFile || suggestionsFile.startsWith('-'))) {
  console.error('--suggestions needs the file npm run staking-facts-prefill wrote')
  process.exit(1)
}

const now = new Date()
const symbols = Object.fromEntries(Object.entries(STAKING_COIN_INFO).map(([id, c]) => [id, c.symbol]))
let suggestions: { savedAt: string; byRow: ReturnType<typeof suggestionsByRow> } | null = null
if (suggestionsFile) {
  const json = JSON.parse(readFileSync(resolve(suggestionsFile), 'utf8').replace(/^﻿/, ''))
  if (json?.format !== 'staking-facts-suggestions-v1' || !Array.isArray(json.providers)) {
    console.error(`${suggestionsFile} is not a file npm run staking-facts-prefill wrote`)
    process.exit(1)
  }
  suggestions = { savedAt: String(json.savedAt ?? ''), byRow: suggestionsByRow(json.providers, stakingFactRows(STAKING_PROVIDERS, symbols)) }
}
const data = buildStakingFactsData({
  suggestions,
  providers: STAKING_PROVIDERS,
  symbols,
  lastVerified: STAKING_DATA_LAST_VERIFIED,
  ageDays: stakingDataAgeDays(now),
  staleAfterDays: STAKING_DATA_STALE_AFTER_DAYS,
  generatedOn: now.toISOString().slice(0, 10),
})

const html = buildStakingFactsPage(data)
writeFileSync(resolve(out), html, 'utf8')

const byKind: Record<string, number> = {}
for (const p of data.providers) for (const r of p.rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
console.log(`Staking Facts Check page written → ${resolve(out)} (${Math.round(html.length / 1024)} KB)`)
console.log(`  ${data.counts.rows} facts on ${data.counts.providers} providers (${data.catalog.defunct} defunct left out): ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')}; ${data.counts.leads} rows marked Start here (${data.leadSources.map((x) => `${x.rows} from ${x.by}`).join(', ')})`)
if (data.suggestions) console.log(`  suggestions from ${suggestionsFile}: ${data.suggestions.suggested} figures suggested, ${data.suggestions.none} with the reason there is none`)
console.log(`  catalog last fully verified ${data.catalog.lastVerified} (${data.catalog.ageDays} days ago) — not touched`)
console.log(`  publish with capabilities ${JSON.stringify(STAKING_FACTS_CAPABILITIES)}`)
