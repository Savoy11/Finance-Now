/**
 * The pre-fill's suggestions as one page to read beside the Fund Figures Check (D140 step 2).
 *
 *   npm run fund-figures-review              writes fund-figures-review.html in the repository root
 *   npm run fund-figures-review -- <out.html>
 *
 * Reads fund-figures-suggestions.json (written by npm run fund-figures-prefill) and the
 * fund catalog, and writes one HTML file, gitignored like the suggestions it is made from.
 * It reads no website, spends nothing and changes nothing: the owner still compares each
 * figure with the fund's own page and types the reading into the check page.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FUND_CATALOG } from '../src/lib/data/fundCatalog'
import { figuresFor } from './lib/fundFiguresData'
import { buildReviewPage, parseSuggestions, reviewCounts, type ReviewFund } from './lib/fundFiguresReview'

const ROOT = resolve(process.cwd(), '..')
const SUGGESTIONS = join(ROOT, 'fund-figures-suggestions.json')
const out = resolve(process.argv[2] ?? join(ROOT, 'fund-figures-review.html'))

if (!existsSync(SUGGESTIONS)) {
  console.error(`No suggestions yet: ${SUGGESTIONS} does not exist. Run npm run fund-figures-prefill -- --run first.`)
  process.exit(2)
}
const { savedAt, pages } = parseSuggestions(JSON.parse(readFileSync(SUGGESTIONS, 'utf8').replace(/^﻿/, '')))

const coreSrc = readFileSync(join(process.cwd(), 'scripts/lib/fundFigures.core.js'), 'utf8')
const core = new Function(`${coreSrc}\nreturn FundFiguresCore`)() as { YIELD_KINDS: Record<string, string>; ASSET_KINDS: Record<string, string> }
const kindLabel = (figure: string, kind: string) => (figure === 'yield' ? core.YIELD_KINDS : core.ASSET_KINDS)[kind] ?? kind

const funds = new Map<string, ReviewFund>(
  FUND_CATALOG.map((f) => [f.symbol, { name: f.name, issuer: f.issuer, catalog: Object.fromEntries(figuresFor(f).map((x) => [x.id, x.catalog])) }]),
)

writeFileSync(out, buildReviewPage({ savedAt, pages, funds, kindLabel }))
const n = reviewCounts(pages)
console.log(`${n.read} of ${n.pages} pages read; ${n.suggested} figures suggested, ${n.byHand} to read by hand.`)
console.log(`Page: ${out}`)
