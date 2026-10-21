/**
 * Site terms check (owner, 2026-10-19, D140): what each website behind the Transfer Fee
 * Check, the Staking Facts Check and the Fund Figures Check says about software reading it.
 *
 *   npm run site-terms                          the sites and a cost estimate; spends nothing
 *   npm run site-terms -- --run --limit 3       read three sites; prints what they cost
 *   npm run site-terms -- --run                 read the rest, stopping at --max-dollars ($10)
 *   npm run site-terms -- --run --only kraken.com --redo
 *   npm run site-terms -- --run --only a.com --web dynamic   the newer web tools, not the default
 *
 * RUN IT ON THE OWNER'S MACHINE. robots.txt and the quotes are checked from here, and the
 * cloud environment reaches none of these sites. The agent reads through Anthropic's own
 * web tools, which fetch from Anthropic's servers, so a page it read may still refuse this
 * machine: that quote is marked "not checked here", never passed.
 *
 * It spends money only with --run, one site at a time, and stops before a site that would
 * take this run past --max-dollars. It writes two files in the repository root, both
 * gitignored, after every site: site-terms-results.json (every answer; a rerun keeps the
 * sites already read and reads only the rest) and site-terms-worksheet.md (the page to rule
 * from). It decides nothing and changes nothing in the app.
 *
 * The key is the Integrations page's Anthropic key, else ANTHROPIC_API_KEY from the shell or
 * .env.local. It is never printed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { STAKING_PROVIDERS } from '@/lib/data/stakingProviders'
import { FUND_CATALOG } from '@/lib/data/fundCatalog'
import { EXCHANGES } from '@/lib/data/transferFees'
import { pinnedFetch } from '@/lib/server/pinnedFetch'
import { hostOf, matchTermsEntry } from '@/lib/server/sourceTerms'
import { discoverTermsLinks, htmlToText, isPathAllowedByRobots, parseRobotsTxt, PROBE_USER_AGENT, scanTermsText } from '@/lib/server/termsProbe'
import { readProviderConfigs } from './lib/providerConfigFile.mjs'
import { FEE_PAGES } from './lib/transferFeeRows'
import {
  buildPrompt, collectSites, disagreement, estimateDollars, homeOrigins, isSettled, MIN_PAGE_CHARS, parseReading,
  parseSiteTermsArgs, quoteOnPage, READ_AGAIN_LABEL, readAgainCommands, readAgainReason, READING_LABEL, READING_TOOL,
  renderWorksheet, robotsAnswer, runReadingLoop, runStopper, SYSTEM_PROMPT, termsLinksFor, toolErrorSummary, USAGE, webTools,
  webVersion, type Reading, type RobotsAnswer, type SiteResult, type SiteTarget, type WebToolVersions,
} from './lib/siteTerms'

const ROOT = resolve(process.cwd(), '..')
const RESULTS = resolve(ROOT, 'site-terms-results.json')
const WORKSHEET = resolve(ROOT, 'site-terms-worksheet.md')
const RESULTS_FORMAT = 'site-terms-results-v1'

/** Thinking counts against this too. */
const MAX_TOKENS = 16_000
const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 800_000
const MAX_REDIRECTS = 5

/** Same dependency-free loader as scripts/auth-consent.ts: the real environment wins over the file. */
function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local: rely on the environment */ }
}

/**
 * The Integrations key first, then the environment, as getProviderKey resolves it in the app.
 * `source` names where the key came from, never the key: a refused key has to be replaced
 * where it lives. `note` says why the Integrations page's keys could not be read, if not.
 */
function anthropicKey(): { key: string | null; source: string; note: string | null } {
  const { configs, error } = readProviderConfigs()
  const saved = configs?.anthropic?.apiKey
  if (typeof saved === 'string' && saved.trim()) return { key: saved.trim(), source: 'the Integrations page', note: null }
  const shell = process.env.ANTHROPIC_API_KEY?.trim()
  if (shell) return { key: shell, source: 'ANTHROPIC_API_KEY in this PowerShell window', note: error }
  loadEnvLocal()
  const local = process.env.ANTHROPIC_API_KEY?.trim()
  return { key: local || null, source: 'ANTHROPIC_API_KEY in frontend\\.env.local', note: error }
}

// ─── Reading from this machine ────────────────────────────────────────────────

interface Fetched { status: number | null; text: string | null; url: string; why: string }

/**
 * One page as this machine reads it. Redirects are followed here, one hop at a time, so each
 * new host is checked against the registry and pinned to its own address, and `url` is where
 * the page really is: the base its relative links resolve against. Each address is read once
 * a run, however many times it is asked for.
 */
const fetched = new Map<string, Promise<Fetched>>()
function fetchHere(url: string): Promise<Fetched> {
  if (!fetched.has(url)) fetched.set(url, fetchFollowing(url))
  return fetched.get(url)!
}

async function fetchFollowing(url: string): Promise<Fetched> {
  let at = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const host = hostOf(at)
    if (!host || !/^https?:/i.test(at)) return { status: null, text: null, url: at, why: 'not a web address' }
    if (matchTermsEntry(host)?.verdict === 'prohibited') return { status: null, text: null, url: at, why: 'the registry rules this host prohibited' }
    try {
      const res = await pinnedFetch(at, {
        headers: { 'User-Agent': PROBE_USER_AGENT, Accept: 'text/html,text/plain,*/*' },
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Reading a site's robots.txt and terms is how its terms are learned: the same opt-out
        // termsProbe.ts takes for the same two documents. Address checks still apply.
        skipTermsCheck: true,
      })
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
      if (next) {
        at = new URL(next, at).toString()
        continue
      }
      if (!res.ok) return { status: res.status, text: null, url: at, why: `HTTP ${res.status}` }
      const type = res.headers.get('content-type') ?? ''
      if (type && !/text|html|xml/i.test(type)) return { status: res.status, text: null, url: at, why: `not a text page (${type.split(';')[0]})` }
      return { status: res.status, text: (await res.text()).slice(0, MAX_BYTES), url: at, why: '' }
    } catch (e) {
      return { status: null, text: null, url: at, why: e instanceof Error ? e.message : String(e) }
    }
  }
  return { status: null, text: null, url: at, why: `more than ${MAX_REDIRECTS} redirects` }
}

/** One read per page however many quotes cite it: the promise is cached, not the text, so concurrent checks share it. */
const pageCache = new Map<string, Promise<string | null>>()
function pageText(url: string): Promise<string | null> {
  if (!pageCache.has(url)) pageCache.set(url, fetchHere(url).then((r) => (r.text === null ? null : htmlToText(r.text))))
  return pageCache.get(url)!
}

interface PendingRobots { origin: string; paths: string[]; why: string }

/** robots.txt for every host the site's pages are on. A 404 is an answer: nothing is disallowed. */
async function robotsHere(target: SiteTarget): Promise<{ answers: RobotsAnswer[]; pending: PendingRobots[] }> {
  const byOrigin = new Map<string, string[]>()
  for (const p of target.pages) {
    const u = new URL(p.url)
    byOrigin.set(u.origin, [...(byOrigin.get(u.origin) ?? []), `${u.pathname}${u.search}`])
  }
  const answers: RobotsAnswer[] = []
  const pending: PendingRobots[] = []
  for (const [origin, paths] of byOrigin) {
    const r = await fetchHere(`${origin}/robots.txt`)
    if (r.text !== null) answers.push(robotsAnswer(origin, r.text, paths, 'here', 'read from this machine'))
    else if (r.status === 404 || r.status === 410) answers.push(robotsAnswer(origin, '', paths, 'here', 'no robots.txt, so nothing is disallowed'))
    else pending.push({ origin, paths, why: r.why })
  }
  return { answers, pending }
}

/**
 * Links on the site's home pages that look like its terms, for the agent to open directly. A
 * home page whose robots.txt disallows it is not read; neither is one whose robots.txt could
 * not be read, short of a 404, which disallows nothing.
 */
async function termsLinksHere(target: SiteTarget): Promise<string[]> {
  const found: string[] = []
  for (const origin of homeOrigins(target)) {
    const robots = await fetchHere(`${origin}/robots.txt`)
    const allowed = robots.text !== null
      ? isPathAllowedByRobots(parseRobotsTxt(robots.text), '/')
      : robots.status === 404 || robots.status === 410
    if (!allowed) continue
    const home = await fetchHere(`${origin}/`)
    if (home.text !== null) found.push(...discoverTermsLinks(home.text, home.url))
  }
  return termsLinksFor(target.site, found)
}

// ─── Asking the agent ─────────────────────────────────────────────────────────

function askAgent(client: Anthropic, model: string, web: WebToolVersions, target: SiteTarget, robotsToCopy: string[], termsLinks: string[]) {
  return runReadingLoop(model, buildPrompt(target, robotsToCopy, termsLinks), (messages) => client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    tools: [...webTools(model, web), READING_TOOL],
    messages: messages as Anthropic.MessageParam[],
  }).finalMessage())
}

async function readSite(client: Anthropic, model: string, web: WebToolVersions, target: SiteTarget, keySource: string): Promise<{ result: SiteResult; stop: string | null }> {
  const checkedAt = new Date().toISOString()
  const { answers, pending } = await robotsHere(target)
  const asked = await askAgent(client, model, web, target, pending.map((p) => `${p.origin}/robots.txt`), await termsLinksHere(target))
  if (asked.outcome === 'error') {
    return {
      result: { site: target.site, checkedAt, model, outcome: 'error', error: asked.error, robots: answers, usage: asked.usage, dollars: asked.dollars, web, toolErrors: asked.toolErrors },
      stop: runStopper(asked.thrown, keySource),
    }
  }

  let reading: Reading | undefined
  let error = asked.error
  if (asked.outcome === 'read') {
    const parsed = parseReading(asked.input)
    if (parsed.ok) reading = parsed.reading
    else error = `the answer could not be read: ${parsed.error}`
  }

  // robots.txt this machine could not read, from the agent's copy where it made one.
  for (const p of pending) {
    const copy = reading?.robotsFiles.find((f) => { try { return new URL(f.url).origin === p.origin } catch { return false } })
    answers.push(copy
      ? robotsAnswer(p.origin, copy.text, p.paths, 'agent', 'copied by the agent')
      : robotsAnswer(p.origin, null, p.paths, 'here', `This machine could not read it (${p.why}), and the agent did not copy it`))
  }

  const quoteChecks = reading ? await Promise.all(reading.clauses.map(async (c) => quoteOnPage(c.quote, await pageText(c.url)))) : undefined
  let scan: SiteResult['scan'] = null
  if (reading?.termsUrl) {
    const text = await pageText(reading.termsUrl)
    if (text !== null && text.length >= MIN_PAGE_CHARS) scan = { url: reading.termsUrl, signals: scanTermsText(text) }
  }

  return { stop: null, result: {
    site: target.site,
    checkedAt,
    model,
    outcome: reading ? 'read' : asked.outcome === 'read' ? 'no-answer' : asked.outcome,
    ...(error ? { error } : {}),
    ...(reading ? { reading, quoteChecks } : {}),
    robots: answers,
    scan,
    warning: reading ? disagreement(reading, scan?.signals ?? []) : null,
    usage: asked.usage,
    dollars: asked.dollars,
    web,
    toolErrors: asked.toolErrors,
  } }
}

// ─── The run ──────────────────────────────────────────────────────────────────

function loadResults(): SiteResult[] {
  if (!existsSync(RESULTS)) return []
  const json = JSON.parse(readFileSync(RESULTS, 'utf8').replace(/^\uFEFF/, ''))
  if (json?.format !== RESULTS_FORMAT || !Array.isArray(json.results)) {
    throw new Error(`${RESULTS} is not a results file this script wrote (format ${String(json?.format)}). Move it aside to start again.`)
  }
  return json.results as SiteResult[]
}

function save(results: Map<string, SiteResult>, targets: SiteTarget[], skipped: ReturnType<typeof collectSites>['skipped']): void {
  const list = [...results.values()].sort((a, b) => a.site.localeCompare(b.site))
  writeFileSync(RESULTS, `${JSON.stringify({ format: RESULTS_FORMAT, savedAt: new Date().toISOString(), results: list }, null, 2)}\n`)
  writeFileSync(WORKSHEET, renderWorksheet({ generatedOn: new Date().toISOString().slice(0, 10), results: list, targets, skipped }))
}

const dollarsText = (n: number) => `$${n.toFixed(2)}`

/** The sites to read again and the command for each group; nothing when there are none. */
function printReadAgain(results: Iterable<SiteResult>): void {
  for (const g of readAgainCommands([...results])) {
    const why = g.reason === 'tools-failed' ? 'the web tools failed on their calls' : 'ran out of page opens or searches before reaching the terms'
    console.log(`\n${g.sites.length} site${g.sites.length === 1 ? '' : 's'}: ${why}. Read ${g.sites.length === 1 ? 'it' : 'them'} again with:\n  ${g.command}`)
  }
}

async function main(): Promise<number> {
  const args = parseSiteTermsArgs(process.argv.slice(2))
  if ('error' in args) {
    console.error(`${args.error}\n\n${USAGE}`)
    return 1
  }
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const exchangeNames = Object.fromEntries(EXCHANGES.map((e) => [e.id, e.name]))
  const { targets, skipped } = collectSites({ stakingProviders: STAKING_PROVIDERS, funds: FUND_CATALOG, feePages: FEE_PAGES, exchangeNames })
  const unknown = args.only.filter((s) => !targets.some((t) => t.site === s))
  if (unknown.length > 0) {
    const why = unknown.map((s) => skipped.find((k) => k.site === s)?.reason ?? 'not a site any check page links to')
    console.error(unknown.map((s, i) => `${s}: ${why[i]}`).join('\n'))
    return 1
  }

  const results = new Map(loadResults().filter(isSettled).map((r) => [r.site, r]))
  let todo = targets.filter((t) => args.only.length === 0 || args.only.includes(t.site)).filter((t) => args.redo || !results.has(t.site))
  if (args.limit !== null) todo = todo.slice(0, args.limit)

  const pages = targets.reduce((n, t) => n + t.pages.length, 0)
  console.log(`Site terms check: ${targets.length} websites behind the three check pages (${pages} pages).`)
  if (skipped.length > 0) console.log(`Skipped ${skipped.length}: ${skipped.map((s) => s.site).join(', ')} (the registry rules them prohibited).`)
  console.log(`Already read: ${results.size}. This run would read ${todo.length}: ${todo.map((t) => t.site).join(', ') || 'none'}.`)
  if (todo.length === 0) {
    if (!args.run) printReadAgain(results.values())
    return 0
  }
  let web: WebToolVersions
  try {
    web = webVersion(args.model, args.web)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }
  const est = estimateDollars(args.model, todo.length)
  console.log(`Model: ${args.model}, ${web} web tools. Rough cost for ${todo.length}: ${dollarsText(est.low)} to ${dollarsText(est.high)} (a guess, not a measurement). Cap for this run: ${dollarsText(args.maxDollars)}.`)

  if (!args.run) {
    console.log('\nNothing was spent. To read three sites and see what they really cost:\n  npm run site-terms -- --run --limit 3')
    printReadAgain(results.values())
    return 0
  }

  const { key, source, note } = anthropicKey()
  if (!key) {
    console.error(`No Anthropic key found: not on the Integrations page, not in ANTHROPIC_API_KEY, not in .env.local.${note ? ` (${note})` : ''}`)
    return 2
  }
  console.log(`Key: from ${source}.${note ? ` The Integrations page's keys could not be read: ${note}` : ''}`)
  const client = new Anthropic({ apiKey: key, maxRetries: 4 })

  let spent = 0
  let saved = false
  let attempted = 0
  let failed = 0
  let inARow = 0
  for (const [i, target] of todo.entries()) {
    const average = attempted > 0 ? spent / attempted : 0
    if (spent + average > args.maxDollars) {
      console.log(`\nStopping: ${dollarsText(spent)} spent, and the next site would likely pass the ${dollarsText(args.maxDollars)} cap. Raise it with --max-dollars.`)
      break
    }
    process.stdout.write(`[${i + 1}/${todo.length}] ${target.site} … `)
    const { result, stop } = await readSite(client, args.model, web, target, source)
    attempted++
    spent += result.dollars
    results.set(result.site, result)
    save(results, targets, skipped)
    saved = true
    const again = readAgainReason(result)
    const label = again ? READ_AGAIN_LABEL[again] : result.reading ? READING_LABEL[result.reading.reading] : result.outcome
    const errors = result.toolErrors && result.toolErrors.length > 0 ? ` [${toolErrorSummary(result.toolErrors)}]` : ''
    console.log(`${label}${result.warning ? ' ⚠' : ''} · ${dollarsText(result.dollars)}${result.error ? ` (${result.error})` : ''}${errors}`)
    if (stop) {
      console.log(`\nStopping: ${stop}${note ? ` The Integrations page's keys could not be read: ${note}` : ''}`)
      failed++
      break
    }
    if (result.outcome === 'error') {
      failed++
      if (++inARow >= 3) {
        console.log('\nStopping: three sites in a row failed. Their errors are in the results file; a rerun tries them again.')
        break
      }
    } else inARow = 0
  }

  const left = targets.filter((t) => { const r = results.get(t.site); return !r || !isSettled(r) }).length
  console.log(`\nSpent ${dollarsText(spent)} on ${attempted} site${attempted === 1 ? '' : 's'}${spent > 0 ? ` (${dollarsText(spent / attempted)} each on average)` : ''}. ${left} left to read.`)
  if (spent > 0 && left > 0) console.log(`At that average the ${left} left would cost about ${dollarsText((spent / attempted) * left)}.`)
  printReadAgain(results.values())
  if (saved) console.log(`Worksheet: ${WORKSHEET}\nAnswers:   ${RESULTS}`)
  return failed > 0 && failed >= attempted ? 1 : 0
}

// exitCode, not exit(): on Windows, exiting while requests were still closing printed a Node
// assertion after run-agent-eval.mjs's plan.
main().then((code) => { process.exitCode = code }, (e) => { console.error(e); process.exitCode = 1 })
