/**
 * The Staking Facts Check pre-fill (D153): read each staking provider's own pages, on the sites
 * the owner ruled Allowed, and suggest the facts they show, for the owner to check.
 *
 *   npm run staking-facts-prefill                       the providers it may read and a cost estimate; spends nothing
 *   npm run staking-facts-prefill -- --run --limit 1    read one provider
 *   npm run staking-facts-prefill -- --run              read the rest
 *
 * RUN IT ON THE OWNER'S MACHINE. Every page goes through the same gate as the fund pre-fill
 * (scripts/lib/allowedFetch.ts): a site ruled Allowed at every hop, robots.txt honoured, no
 * cookies. Per provider it reads the catalog's staking page and up to MAX_EXTRA_PAGES pages on
 * the same site that page links to, chosen by their addresses and link text, never by the
 * model. The model is given that text, never the catalog's figures; every fact it reports is
 * looked up on the pages read and put through the check page's own parsing
 * (stakingFacts.core.js) before it is kept (scripts/lib/stakingPrefill.ts).
 *
 * It writes one file, staking-facts-suggestions.json in the repository root (gitignored). It
 * writes nothing to the catalog or to the check page: a suggestion is for the owner to compare
 * with the page, and the answer they give there is still theirs.
 *
 * The key is the Integrations page's Anthropic key, else ANTHROPIC_API_KEY. It is never printed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { STAKING_COIN_INFO, STAKING_PROVIDERS } from '@/lib/data/stakingProviders'
import { allowedFetcher, type PageOutcome } from './lib/allowedFetch'
import { anthropicKey } from './lib/anthropicKey'
import { pageTextOf } from './lib/figurePrefill'
import { buildStakingFactsData } from './lib/stakingFactsData'
import {
  buildFactsPrompt, checkFact, factAsks, factLine, factsFormat, factsFromResponse, FACTS_SYSTEM, MAX_EXTRA_PAGES, parseStakingPrefillArgs,
  pickLinks, prefillProviders, STAKING_PREFILL_USAGE, type FactSuggestion, type PrefillProvider, type ReadPage, type StakingCore,
} from './lib/stakingPrefill'
import {
  allowedSites, apiErrorText, DEFAULT_MODEL, MIN_PAGE_CHARS, MODELS, requestDollars, RESULTS_FORMAT, RULINGS_FORMAT, runStopper,
  type RulingsFile, type SiteResult,
} from './lib/siteTerms'

const ROOT = resolve(process.cwd(), '..')
const RESULTS = resolve(ROOT, 'site-terms-results.json')
const RULINGS = resolve(ROOT, 'site-terms-rulings.json')
const SUGGESTIONS = resolve(ROOT, 'staking-facts-suggestions.json')
const SUGGESTIONS_FORMAT = 'staking-facts-suggestions-v1'

/** Says what it is and that robots.txt's FinanceNow rules apply to it. */
const USER_AGENT = 'FinanceNow/1.0 (staking facts check: reads a provider page for its owner)'
/** Thinking counts against this too. */
const MAX_TOKENS = 8_000

const coreSrc = readFileSync(join(process.cwd(), 'scripts/lib/stakingFacts.core.js'), 'utf8')
const core = new Function(`${coreSrc}\nreturn StakingFactsCore`)() as StakingCore

interface PageNote { url: string; outcome: PageOutcome; why: string; textChars: number }

interface ProviderRead {
  id: string
  url: string
  readAt: string
  outcome: PageOutcome | 'error'
  why: string
  pages: PageNote[]
  model: string | null
  dollars: number
  facts: FactSuggestion[]
}

// ─── Files ────────────────────────────────────────────────────────────────────

function readJson(path: string, format: string, what: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  const json = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
  if (json?.format !== format) throw new Error(`${path} is not ${what} (format ${String(json?.format)}). Move it aside rather than delete it.`)
  return json
}

function loadSuggestions(): ProviderRead[] {
  const json = readJson(SUGGESTIONS, SUGGESTIONS_FORMAT, 'a suggestions file this script wrote')
  return Array.isArray(json?.providers) ? (json.providers as ProviderRead[]) : []
}

function saveSuggestions(reads: Map<string, ProviderRead>): void {
  const list = [...reads.values()].sort((a, b) => a.id.localeCompare(b.id))
  writeFileSync(SUGGESTIONS, `${JSON.stringify({ format: SUGGESTIONS_FORMAT, savedAt: new Date().toISOString(), providers: list }, null, 2)}\n`)
}

// ─── One provider ─────────────────────────────────────────────────────────────

const coinWords = (p: PrefillProvider) => p.rows.flatMap((r) => (r.coin ? [r.coin, STAKING_COIN_INFO[r.coin]?.name ?? ''] : []))

async function readProvider(client: Anthropic, model: string, p: PrefillProvider, fetchPage: ReturnType<typeof allowedFetcher>, keySource: string): Promise<{ read: ProviderRead; stop: string | null }> {
  const read: ProviderRead = { id: p.id, url: p.url, readAt: new Date().toISOString(), outcome: 'read', why: '', pages: [], model: null, dollars: 0, facts: [] }
  const first = await fetchPage(p.url)
  const firstText = first.html ? pageTextOf(first.html) : ''
  read.pages.push({ url: first.finalUrl ?? p.url, outcome: first.outcome, why: first.why, textChars: firstText.length })
  if (first.outcome !== 'read' || first.html === null) return { read: { ...read, outcome: first.outcome, why: first.why }, stop: null }

  const pages: ReadPage[] = firstText.length >= MIN_PAGE_CHARS ? [{ url: first.finalUrl ?? p.url, text: firstText }] : []
  for (const url of pickLinks(first.html, first.finalUrl ?? p.url, p.site, coinWords(p), MAX_EXTRA_PAGES)) {
    const got = await fetchPage(url)
    const text = got.html ? pageTextOf(got.html) : ''
    read.pages.push({ url: got.finalUrl ?? url, outcome: got.outcome, why: got.why, textChars: text.length })
    if (got.outcome === 'read' && text.length >= MIN_PAGE_CHARS) pages.push({ url: got.finalUrl ?? url, text })
  }
  if (pages.length === 0) {
    return { read: { ...read, outcome: 'unreadable', why: `No page had more than ${MIN_PAGE_CHARS} characters of text: the site probably draws its pages in the browser.` }, stop: null }
  }

  const asks = factAsks(p)
  read.model = model
  try {
    const res = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: FACTS_SYSTEM,
      // Copying facts out of a page needs little thought, and thinking is billed as output.
      output_config: { effort: 'low', format: factsFormat(asks) },
      messages: [{ role: 'user', content: buildFactsPrompt(p, asks, pages) }],
    })
    read.dollars = requestDollars(model, res.usage)
    const parsed = factsFromResponse(res, asks)
    if (!parsed.ok) return { read: { ...read, outcome: 'error', why: `the answer could not be read: ${parsed.error}` }, stop: null }
    const now = Date.now()
    read.facts = asks.map((a) => checkFact(a, parsed.answers.get(a.slot), pages, core, now))
    return { read, stop: null }
  } catch (e) {
    return { read: { ...read, outcome: 'error', why: apiErrorText(e) }, stop: runStopper(e, keySource) }
  }
}

// ─── The run ──────────────────────────────────────────────────────────────────

const dollarsText = (n: number) => `$${n.toFixed(2)}`

async function main(): Promise<number> {
  const args = parseStakingPrefillArgs(process.argv.slice(2), Object.keys(MODELS), DEFAULT_MODEL)
  if ('error' in args) {
    console.error(`${args.error}\n\n${STAKING_PREFILL_USAGE}`)
    return 1
  }
  if (args.help) {
    console.log(STAKING_PREFILL_USAGE)
    return 0
  }

  const results = readJson(RESULTS, RESULTS_FORMAT, 'a site terms results file')
  const rulings = readJson(RULINGS, RULINGS_FORMAT, 'a rulings file') as RulingsFile | null
  if (!results || !rulings) {
    console.error('No rulings yet. Rule the sites first, with npm run site-terms -- --rule ... (see the site terms worksheet).')
    return 1
  }
  const allowed = new Set(allowedSites(rulings, results.results as SiteResult[]))
  const symbols = Object.fromEntries(Object.entries(STAKING_COIN_INFO).map(([id, c]) => [id, c.symbol]))
  const cards = buildStakingFactsData({ providers: STAKING_PROVIDERS, symbols, lastVerified: '', ageDays: 0, staleAfterDays: 0, generatedOn: '' }).providers
  const providers = prefillProviders(cards, allowed)
  const unknown = args.only.filter((id) => !providers.some((p) => p.id === id))
  if (unknown.length > 0) {
    console.error(`${unknown.join(', ')}: not a provider with facts to check on a site ruled Allowed.`)
    return 1
  }
  const reads = new Map(loadSuggestions().map((r) => [r.id, r]))
  // Only a provider that was read counts as done: one refused or unreachable is tried again, at no cost.
  const done = (id: string) => reads.get(id)?.outcome === 'read'
  const wanted = providers.filter((p) => args.only.length === 0 || args.only.includes(p.id)).filter((p) => args.redo || !done(p.id))
  const todo = args.limit === null ? wanted : wanted.slice(0, args.limit)

  const facts = providers.reduce((n, p) => n + factAsks(p).length, 0)
  console.log(`Staking facts pre-fill: ${providers.length} providers on sites ruled Allowed (${[...new Set(providers.map((p) => p.site))].sort().join(', ') || 'none'}), ${facts} figures.`)
  console.log(`Already read: ${providers.filter((p) => done(p.id)).length}. This run would read ${todo.length}: ${todo.map((p) => p.id).join(', ') || 'none'}.`)
  if (todo.length === 0) return 0
  const per = (input: number, output: number) => requestDollars(args.model, { input_tokens: input, output_tokens: output })
  console.log(`Model: ${args.model}. Up to ${1 + MAX_EXTRA_PAGES} pages each. Rough cost for ${todo.length}: ${dollarsText(per(5_000, 800) * todo.length)} to ${dollarsText(per(55_000, 2_500) * todo.length)} (a guess). Cap for this run: ${dollarsText(args.maxDollars)}.`)
  if (!args.run) {
    console.log('\nNothing was read or spent. To try one provider:\n  npm run staking-facts-prefill -- --run --limit 1')
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
  const name = new Map(providers.map((p) => [p.id, p.name]))
  let spent = 0
  let attempted = 0
  const tally = { read: 0, suggested: 0, other: 0 }
  for (const [i, p] of todo.entries()) {
    const average = attempted > 0 ? spent / attempted : 0
    if (spent + average > args.maxDollars) {
      console.log(`\nStopping: ${dollarsText(spent)} spent, and the next provider would likely pass the ${dollarsText(args.maxDollars)} cap. Raise it with --max-dollars.`)
      break
    }
    process.stdout.write(`[${i + 1}/${todo.length}] ${p.id} (${p.site}) … `)
    const { read, stop } = await readProvider(client, args.model, p, fetchPage, source)
    attempted++
    spent += read.dollars
    if (read.outcome !== 'error') {
      reads.set(p.id, read)
      saveSuggestions(reads)
    }
    if (read.outcome === 'read') tally.read++
    const pagesRead = read.pages.filter((x) => x.outcome === 'read').length
    console.log(read.outcome === 'read' ? `read ${pagesRead} page${pagesRead === 1 ? '' : 's'} · ${dollarsText(read.dollars)}` : `${read.outcome}: ${read.why}${read.dollars ? ` · ${dollarsText(read.dollars)}` : ''}`)
    for (const x of read.facts) {
      console.log(factLine(name.get(p.id) ?? p.id, x))
      if (x.status === 'suggested') tally.suggested++
      else tally.other++
    }
    if (stop) {
      console.log(`\nStopping: ${stop}`)
      break
    }
  }

  console.log(`\nSpent ${dollarsText(spent)}. ${tally.read} of ${attempted} provider${attempted === 1 ? '' : 's'} read; ${tally.suggested} figure${tally.suggested === 1 ? '' : 's'} suggested, ${tally.other} not. A provider not read is tried again next run.`)
  console.log('Nothing was written to the catalog or the check page. Compare each suggestion with the provider\'s page before you answer.')
  console.log(`Suggestions: ${SUGGESTIONS}`)
  return 0
}

main().then((code) => { process.exitCode = code }, (e) => { console.error(e); process.exitCode = 1 })
