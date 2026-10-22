/**
 * The Fund Figures Check pre-fill (D140, step 2): read the fund pages on the sites the owner
 * ruled Allowed, and suggest the figures each page shows, for the owner to check.
 *
 *   npm run fund-figures-prefill                       the pages it may read and a cost estimate; spends nothing
 *   npm run fund-figures-prefill -- --run --limit 4    read four pages, one on each Allowed site
 *   npm run fund-figures-prefill -- --run              read the rest
 *
 * RUN IT ON THE OWNER'S MACHINE, after `npm run site-terms -- --rule ...`. Only a page on a
 * site ruled Allowed, on the reading in force, is read; a redirect to any other site stops
 * there. Each page is fetched here, as FinanceNow, and only where its robots.txt lets
 * FinanceNow read it; a robots.txt that cannot be read is no permission. The page's text then
 * goes to the model, which copies figures out of it and is never shown the catalog's. Every
 * figure it reports is looked up in that same text, and put through the check page's own
 * tests (fundFigures.core.js), before it is printed.
 *
 * It writes one file, fund-figures-suggestions.json in the repository root (gitignored):
 * every page read and every suggestion, kept across runs. It writes nothing to the catalog
 * or to the check page. A suggestion is for the owner to compare with the page, and the
 * reading they type there is still theirs.
 *
 * The key is the Integrations page's Anthropic key, else ANTHROPIC_API_KEY. It is never printed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FUND_CATALOG } from '@/lib/data/fundCatalog'
import { allowedFetcher, type GatedPage } from './lib/allowedFetch'
import { anthropicKey } from './lib/anthropicKey'
import {
  answerFromResponse, buildFiguresPrompt, checkAnswer, figuresFormat, FIGURES_SYSTEM, pageTextOf, parsePrefillArgs,
  pickPages, prefillFunds, PREFILL_USAGE, suggestionLine, type FiguresCore, type PrefillFund, type Suggestion,
} from './lib/figurePrefill'
import { figuresFor } from './lib/fundFiguresData'
import {
  allowedSites, apiErrorText, DEFAULT_MODEL, MIN_PAGE_CHARS, MODELS, requestDollars, RESULTS_FORMAT, RULINGS_FORMAT, runStopper, siteOf,
  type RulingsFile, type SiteResult,
} from './lib/siteTerms'

const ROOT = resolve(process.cwd(), '..')
const RESULTS = resolve(ROOT, 'site-terms-results.json')
const RULINGS = resolve(ROOT, 'site-terms-rulings.json')
const SUGGESTIONS = resolve(ROOT, 'fund-figures-suggestions.json')
const SUGGESTIONS_FORMAT = 'fund-figures-suggestions-v1'

/** Says what it is and that robots.txt's FinanceNow rules apply to it. */
const USER_AGENT = 'FinanceNow/1.0 (fund figures check: reads a fund page for its owner)'
/** Thinking counts against this too. */
const MAX_TOKENS = 8_000

const coreSrc = readFileSync(join(process.cwd(), 'scripts/lib/fundFigures.core.js'), 'utf8')
const core = new Function(`${coreSrc}\nreturn FundFiguresCore`)() as FiguresCore & { YIELD_KINDS: Record<string, string>; ASSET_KINDS: Record<string, string> }
const kindLabel = (figure: string, kind: string) => (figure === 'yield' ? core.YIELD_KINDS : core.ASSET_KINDS)[kind] ?? kind

interface PageRead {
  symbol: string
  url: string
  /** Where the page really was, after any redirects. */
  finalUrl: string | null
  readAt: string
  outcome: 'read' | 'not-allowed' | 'robots' | 'unreadable' | 'error'
  why: string
  textChars: number
  model: string | null
  dollars: number
  figures: Suggestion[]
}

// ─── Files ────────────────────────────────────────────────────────────────────

function readJson(path: string, format: string, what: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  const json = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
  if (json?.format !== format) throw new Error(`${path} is not ${what} (format ${String(json?.format)}). Move it aside rather than delete it.`)
  return json
}

function loadSuggestions(): PageRead[] {
  const json = readJson(SUGGESTIONS, SUGGESTIONS_FORMAT, 'a suggestions file this script wrote')
  return Array.isArray(json?.pages) ? (json.pages as PageRead[]) : []
}

function saveSuggestions(pages: Map<string, PageRead>): void {
  const list = [...pages.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
  writeFileSync(SUGGESTIONS, `${JSON.stringify({ format: SUGGESTIONS_FORMAT, savedAt: new Date().toISOString(), pages: list }, null, 2)}\n`)
}

// ─── One fund ─────────────────────────────────────────────────────────────────

async function readFund(client: Anthropic, model: string, f: PrefillFund, fetchPage: (url: string) => Promise<GatedPage>, keySource: string): Promise<{ page: PageRead; stop: string | null }> {
  const readAt = new Date().toISOString()
  const page: PageRead = { symbol: f.symbol, url: f.url, finalUrl: null, readAt, outcome: 'read', why: '', textChars: 0, model: null, dollars: 0, figures: [] }
  const got = await fetchPage(f.url)
  page.finalUrl = got.finalUrl
  if (got.outcome !== 'read' || got.html === null) return { page: { ...page, outcome: got.outcome, why: got.why }, stop: null }

  const text = pageTextOf(got.html)
  page.textChars = text.length
  if (text.length < MIN_PAGE_CHARS) {
    return { page: { ...page, outcome: 'unreadable', why: `The page's text is ${text.length} characters, too little to hold its figures: it is probably drawn in the browser.` }, stop: null }
  }

  page.model = model
  try {
    const res = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: FIGURES_SYSTEM,
      // Copying figures out of a page needs little thought, and thinking is billed as output.
      output_config: { effort: 'low', format: figuresFormat(f.figures.map((x) => x.figure)) },
      messages: [{ role: 'user', content: buildFiguresPrompt(f, got.finalUrl ?? f.url, text) }],
    })
    page.dollars = requestDollars(model, res.usage)
    const parsed = answerFromResponse(res)
    if (!parsed.ok) return { page: { ...page, outcome: 'error', why: `the answer could not be read: ${parsed.error}` }, stop: null }
    const now = Date.now()
    page.figures = f.figures.map((fig) => checkAnswer(fig, parsed.figures.find((a) => a.figure === fig.figure), text, core, now))
    return { page, stop: null }
  } catch (e) {
    return { page: { ...page, outcome: 'error', why: apiErrorText(e) }, stop: runStopper(e, keySource) }
  }
}

// ─── The run ──────────────────────────────────────────────────────────────────

const dollarsText = (n: number) => `$${n.toFixed(2)}`

async function main(): Promise<number> {
  const args = parsePrefillArgs(process.argv.slice(2), Object.keys(MODELS), DEFAULT_MODEL)
  if ('error' in args) {
    console.error(`${args.error}\n\n${PREFILL_USAGE}`)
    return 1
  }
  if (args.help) {
    console.log(PREFILL_USAGE)
    return 0
  }

  const results = readJson(RESULTS, RESULTS_FORMAT, 'a site terms results file')
  const rulings = readJson(RULINGS, RULINGS_FORMAT, 'a rulings file') as RulingsFile | null
  if (!results || !rulings) {
    console.error('No rulings yet. Rule the sites first, with npm run site-terms -- --rule ... (see the site terms worksheet).')
    return 1
  }
  const allowed = new Set(allowedSites(rulings, results.results as SiteResult[]))
  if (allowed.size === 0) {
    console.log('No site is ruled Allowed, so there is nothing the pre-fill may read.')
    return 0
  }

  const funds = prefillFunds(FUND_CATALOG, figuresFor, allowed)
  const unknown = args.only.filter((s) => !funds.some((f) => f.symbol === s))
  if (unknown.length > 0) {
    console.error(`${unknown.join(', ')}: not a fund with a figure to re-read on a site ruled Allowed.`)
    return 1
  }
  const pages = new Map(loadSuggestions().map((p) => [p.symbol, p]))
  // Only a page that was read counts as done: one refused or unreachable is tried again, at no cost.
  const done = (symbol: string) => pages.get(symbol)?.outcome === 'read'
  const wanted = funds.filter((f) => args.only.length === 0 || args.only.includes(f.symbol)).filter((f) => args.redo || !done(f.symbol))
  const todo = pickPages(wanted, args.limit)

  const rows = funds.reduce((n, f) => n + f.figures.length, 0)
  console.log(`Fund figures pre-fill: ${[...allowed].sort().join(', ')} ruled Allowed.`)
  console.log(`${funds.length} fund pages on them, ${rows} figures. Already read: ${funds.filter((f) => done(f.symbol)).length}. This run would read ${todo.length}: ${todo.map((f) => f.symbol).join(', ') || 'none'}.`)
  if (todo.length === 0) return 0
  const per = (input: number, output: number) => requestDollars(args.model, { input_tokens: input, output_tokens: output })
  console.log(`Model: ${args.model}. Rough cost for ${todo.length}: ${dollarsText(per(3_000, 500) * todo.length)} to ${dollarsText(per(35_000, 1_500) * todo.length)} (a guess). Cap for this run: ${dollarsText(args.maxDollars)}.`)
  if (!args.run) {
    console.log('\nNothing was read or spent. To try four pages, one on each Allowed site:\n  npm run fund-figures-prefill -- --run --limit 4')
    return 0
  }

  const { key, source, note } = anthropicKey()
  if (!key) {
    console.error(`No Anthropic key found: not on the Integrations page, not in ANTHROPIC_API_KEY, not in .env.local.${note ? ` (${note})` : ''}`)
    return 2
  }
  console.log(`Key: from ${source}.`)
  const client = new Anthropic({ apiKey: key, maxRetries: 4 })

  const fetchPage = allowedFetcher(USER_AGENT, allowed)
  let spent = 0
  let attempted = 0
  const tally = { read: 0, suggested: 0, other: 0 }
  for (const [i, f] of todo.entries()) {
    const average = attempted > 0 ? spent / attempted : 0
    if (spent + average > args.maxDollars) {
      console.log(`\nStopping: ${dollarsText(spent)} spent, and the next page would likely pass the ${dollarsText(args.maxDollars)} cap. Raise it with --max-dollars.`)
      break
    }
    process.stdout.write(`[${i + 1}/${todo.length}] ${f.symbol} (${f.site}) … `)
    const { page, stop } = await readFund(client, args.model, f, fetchPage, source)
    attempted++
    spent += page.dollars
    if (page.outcome !== 'error') {
      pages.set(f.symbol, page)
      saveSuggestions(pages)
    }
    if (page.outcome === 'read') tally.read++
    console.log(page.outcome === 'read' ? `read · ${dollarsText(page.dollars)}` : `${page.outcome}: ${page.why}${page.dollars ? ` · ${dollarsText(page.dollars)}` : ''}`)
    for (const x of page.figures) {
      console.log(suggestionLine(f.symbol, x, kindLabel))
      if (x.status === 'suggested') tally.suggested++
      else tally.other++
    }
    if (stop) {
      console.log(`\nStopping: ${stop}`)
      break
    }
  }

  console.log(`\nSpent ${dollarsText(spent)}. ${tally.read} of ${attempted} page${attempted === 1 ? '' : 's'} read; ${tally.suggested} figure${tally.suggested === 1 ? '' : 's'} suggested, ${tally.other} not. A page not read is tried again next run.`)
  console.log('Nothing was written to the catalog or the check page. Compare each suggestion with the fund\'s page before you type a reading.')
  console.log(`Suggestions: ${SUGGESTIONS}`)
  return 0
}

main().then((code) => { process.exitCode = code }, (e) => { console.error(e); process.exitCode = 1 })
