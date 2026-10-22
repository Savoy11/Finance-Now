/**
 * Build the Fund Figures Check page (T-440).
 *
 *   npm run fund-figures-page -- <out.html> [--order <order.json>] [--suggestions <file>]
 *
 * The owner's check list for re-reading the fund catalog's approximate figures: every
 * yield, and every asset figure that carries no SEC filing date. One card per fund, with
 * the issuer's page and a box per figure for the value the page shows and its date.
 *
 * WHY A PAGE. Nothing in this environment can reach an issuer's site, and the readings
 * need a person with a browser. The page works on any device, keeps its place across
 * sittings, and needs nothing installed (the Transfer Fee Check page's reasoning, D52).
 *
 * --order takes a sort-order file kept OUTSIDE the repository: symbols in the order to
 * work them and a true/false `differs`, worked out by comparing an outside data service's
 * figures with the catalog. It is kept out because those figures are licensed; the file
 * itself carries none, and neither does the page. Without it the cards are grouped by
 * issuer.
 *
 * The page is REGENERATED, never hand-edited. The readings live in the published page's
 * own database, which a republish never touches (scripts/lib/fundFiguresPage.mjs says
 * where). Publish it with FUND_FIGURES_CAPABILITIES. Claude reads the readings and runs
 * `npm run fund-figures-plan` over them, and brings the differences to the owner first.
 *
 * --suggestions takes the pre-fill's file (fund-figures-suggestions.json, gitignored): each
 * figure then shows what the pre-fill copied from the issuer's own page, beside the row and
 * never in the reading box. Those pages are on the sites the owner ruled Allowed (D141).
 *
 * Reads the catalog; writes only the page. Nothing here touches FUND_FIGURES_COMPILED_ON.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  FUND_CATALOG,
  FUND_CATEGORY_INFO,
  FUND_FIGURES_COMPILED_ON,
  FUND_FIGURES_STALE_AFTER_DAYS,
  fundFiguresAgeDays,
} from '../src/lib/data/fundCatalog'
import { buildFundFiguresData, figuresFor, parseFundOrder, suggestionsByFigure } from './lib/fundFiguresData'
import { parseSuggestions } from './lib/fundFiguresReview'
import { buildFundFiguresPage, FUND_FIGURES_CAPABILITIES } from './lib/fundFiguresPage.mjs'

const [out, ...flags] = process.argv.slice(2)
if (!out || out.startsWith('-')) {
  console.error('usage: npm run fund-figures-page -- <out.html> [--order <order.json>] [--suggestions <file>]')
  process.exit(1)
}
const orderAt = flags.indexOf('--order')
const orderFile = orderAt >= 0 ? flags[orderAt + 1] : null
const withFigures = new Set(FUND_CATALOG.filter((f) => figuresFor(f).length > 0).map((f) => f.symbol))
const suggestionsAt = flags.indexOf('--suggestions')
const suggestionsFile = suggestionsAt >= 0 ? flags[suggestionsAt + 1] : null
if (suggestionsAt >= 0 && (!suggestionsFile || suggestionsFile.startsWith('-'))) {
  console.error('--suggestions needs the file npm run fund-figures-prefill wrote')
  process.exit(1)
}
const suggested = suggestionsFile ? parseSuggestions(JSON.parse(readFileSync(resolve(suggestionsFile), 'utf8').replace(/^\uFEFF/, ''))) : null
const order = orderFile ? parseFundOrder(JSON.parse(readFileSync(resolve(orderFile), 'utf8')), withFigures) : null

const now = new Date()
const data = buildFundFiguresData({
  catalog: FUND_CATALOG,
  categoryLabel: (id) => FUND_CATEGORY_INFO[id as keyof typeof FUND_CATEGORY_INFO]?.label ?? id,
  compiledOn: FUND_FIGURES_COMPILED_ON,
  ageDays: fundFiguresAgeDays(now),
  staleAfterDays: FUND_FIGURES_STALE_AFTER_DAYS,
  generatedOn: now.toISOString().slice(0, 10),
  order,
  suggestions: suggested ? { savedAt: suggested.savedAt, byFigure: suggestionsByFigure(suggested.pages) } : null,
})

const html = buildFundFiguresPage(data)
writeFileSync(resolve(out), html, 'utf8')

console.log(`Fund Figures Check page written → ${resolve(out)} (${Math.round(html.length / 1024)} KB)`)
console.log(`  ${data.counts.yields} yields and ${data.counts.assets} undated asset figures on ${data.counts.funds} of ${data.catalog.funds} funds`)
console.log(order
  ? `  ordered: ${data.order.ranked} funds from ${orderFile}, ${data.order.startHere} marked Start here; the rest grouped by issuer`
  : '  no sort order given: grouped by issuer')
if (data.suggestions) console.log(`  suggestions from ${suggestionsFile}: ${data.suggestions.suggested} figures suggested, ${data.suggestions.none} with the reason there is none`)
console.log(`  figures compiled ${data.catalog.compiledOn} (${data.catalog.ageDays} days ago) — not touched`)
console.log(`  publish with capabilities ${JSON.stringify(FUND_FIGURES_CAPABILITIES)}`)
