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
 * Reads the catalog; writes only the page. Nothing here touches STAKING_DATA_LAST_VERIFIED.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  STAKING_PROVIDERS,
  STAKING_COIN_INFO,
  STAKING_DATA_LAST_VERIFIED,
  STAKING_DATA_STALE_AFTER_DAYS,
  stakingDataAgeDays,
} from '../src/lib/data/stakingProviders'
import { buildStakingFactsData } from './lib/stakingFactsData'
import { buildStakingFactsPage, STAKING_FACTS_CAPABILITIES } from './lib/stakingFactsPage.mjs'

const out = process.argv[2]
if (!out || out.startsWith('-')) {
  console.error('usage: npm run staking-facts-page -- <out.html>')
  process.exit(1)
}

const now = new Date()
const symbols = Object.fromEntries(Object.entries(STAKING_COIN_INFO).map(([id, c]) => [id, c.symbol]))
const data = buildStakingFactsData({
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
console.log(`  ${data.counts.rows} facts on ${data.counts.providers} providers (${data.catalog.defunct} defunct left out): ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')}; ${data.counts.leads} lock-ups marked Start here`)
console.log(`  catalog last fully verified ${data.catalog.lastVerified} (${data.catalog.ageDays} days ago) — not touched`)
console.log(`  publish with capabilities ${JSON.stringify(STAKING_FACTS_CAPABILITIES)}`)
