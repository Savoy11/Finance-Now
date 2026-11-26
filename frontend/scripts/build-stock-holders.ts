// ─────────────────────────────────────────────────────────────────────────────
// BUILD STOCK OWNERSHIP DATA (T-471, owner request, 2026-11-24).
//
//   npm run holders:build                 # full build (N-PORT sweep + 13F set)
//   npm run holders:build -- --limit 8    # trial sweep over 8 funds
//   npm run holders:build -- --set-dir <extracted-13f-dir>
//
// Two questions, one quarter, one output file:
//  A. Which FUNDS this app tracks hold each catalog stock, and how much —
//     read from every catalog fund's newest N-PORT filing (keyless EDGAR,
//     the same filings the fund pages read).
//  B. How much of each stock INSTITUTIONS reported holding — aggregated from
//     the SEC's quarterly Form 13F structured data set (www.sec.gov, the same
//     family as the Risk/Return sets build-fund-fees.mjs reads).
//
// The join key is the CUSIP, DERIVED from the N-PORT holdings under
// scripts/lib/stockCusips.ts's rules (two independent fund families must
// agree, prices must reconcile, ambiguity refuses) and PINNED in the output
// for review — never a runtime name match (D190). The rules live in
// scripts/lib/{stockCusips,form13f}.ts, both unit-tested.
//
// It writes ONLY src/lib/data/stockHolders.generated.json (plus its own
// gitignored download cache) and deletes nothing. Exit codes follow the probe
// convention: 0 built, 1 real failure, 2 inconclusive (network unreachable).
// ─────────────────────────────────────────────────────────────────────────────

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { EQUITY_CATALOG, EQUITY_BY_SYMBOL } from '../src/lib/data/equityCatalog'
import { FUND_CATALOG } from '../src/lib/data/fundCatalog'
import { parseExchangeFile, selectCommonListings, type SecListing } from '../src/lib/data/secListings'
import FUND_FACTS from '../src/lib/data/fundFacts.generated.json'
import { fetchTickerCikMap } from '../src/lib/server/edgar'
import { resolveFundSeries, listNportFilings, fetchNportReport } from '../src/lib/server/nport'
import {
  classWordFor, nameMatches, resolveListed, type F13CusipEvidence, type HoldingForCusip,
} from './lib/stockCusips'
import {
  isoFromSetDate, normalizeAmendmentKind, dominantPeriod, effectiveFilings, foldInfoRow, aggregate,
  type SubmissionRow, type CoverRow,
} from './lib/form13f'
import { diffQuarter, isPriorQuarter } from './lib/holdersDiff'

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const OUT_PATH = path.join(FRONTEND_ROOT, 'src', 'lib', 'data', 'stockHolders.generated.json')
const CACHE_DIR = path.join(FRONTEND_ROOT, 'fn-13f-cache')
const PRIOR_CACHE_DIR = path.join(FRONTEND_ROOT, 'fn-13f-cache-prior')
const SET_INDEX_PAGES = [
  // The SEC's current index page for the quarterly 13F data sets.
  'https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets',
]
const TOP_HOLDERS = 10
const TOP_FUNDS = 15
const EDGAR_PAUSE_MS = 300

const args = process.argv.slice(2)
const argValue = (name: string): string | null => {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null
}
const fundLimit = Number(argValue('--limit') ?? '0') || 0
const setDirArg = argValue('--set-dir')
const setUrlArg = argValue('--set-url')
// Reuse a saved sweep while iterating on resolution rules, instead of asking
// EDGAR for ~300 filings again. The cache holds raw filing rows, so a rules
// change still applies to it.
const sweepCacheArg = argValue('--sweep-cache')
const priorSetDirArg = argValue('--prior-set-dir')
const priorSetUrlArg = argValue('--prior-set-url')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const isNetworkError = (err: unknown): boolean =>
  err instanceof TypeError || /fetch failed|ENOTFOUND|ECONNRE|EAI_AGAIN|aborted/i.test(String(err))

interface FundRow {
  symbol: string
  name: string
  shares: number
  valueUsd: number | null
  pctVal: number | null
  asOf: string
}

async function sweepFunds() {
  const holdingsForCusip: HoldingForCusip[] = []
  const byCusipFunds = new Map<string, FundRow[]>()
  const fundsSkipped: Array<{ symbol: string; reason: string }> = []
  let fundsRead = 0

  const funds = fundLimit > 0 ? FUND_CATALOG.slice(0, fundLimit) : FUND_CATALOG
  for (const fund of funds) {
    await sleep(EDGAR_PAUSE_MS)
    try {
      const series = await resolveFundSeries(fund.symbol)
      if (!series) { fundsSkipped.push({ symbol: fund.symbol, reason: 'not in the SEC fund ticker map' }); continue }
      const filings = await listNportFilings(series.seriesId, 1)
      if (filings.length === 0) { fundsSkipped.push({ symbol: fund.symbol, reason: 'no N-PORT filing (UITs such as SPY file none)' }); continue }
      const report = await fetchNportReport(filings[0])
      if (!report.asOf) { fundsSkipped.push({ symbol: fund.symbol, reason: 'filing carries no report date' }); continue }
      fundsRead++
      for (const h of report.holdings) {
        if (h.assetCat !== 'EC') continue
        if (!h.cusip || !/^[0-9A-Z]{9}$/.test(h.cusip)) continue
        if (h.balance == null || !(h.balance > 0)) continue
        holdingsForCusip.push({
          family: fund.issuer, asOf: report.asOf, name: h.name,
          cusip: h.cusip, balance: h.balance, valueUsd: h.valueUsd,
        })
        const list = byCusipFunds.get(h.cusip) ?? []
        list.push({
          symbol: fund.symbol, name: fund.name, shares: h.balance,
          valueUsd: h.valueUsd, pctVal: h.pctVal, asOf: report.asOf,
        })
        byCusipFunds.set(h.cusip, list)
      }
      if (fundsRead % 10 === 0) console.log(`  …${fundsRead} funds read (latest: ${fund.symbol}, as of ${report.asOf})`)
    } catch (err) {
      if (isNetworkError(err)) throw err
      fundsSkipped.push({ symbol: fund.symbol, reason: String(err instanceof Error ? err.message : err) })
    }
  }
  return { holdingsForCusip, byCusipFunds, fundsSkipped, fundsRead }
}

/** Every quarterly set on the index page, newest filing-window first. */
async function listSetUrls(): Promise<Array<{ url: string; key: string }>> {
  for (const page of SET_INDEX_PAGES) {
    const res = await fetch(page, { headers: { 'User-Agent': 'Finance Now research dashboard (FinanceNow72@gmail.com)' } })
    if (!res.ok) continue
    const html = await res.text()
    const links = [...html.matchAll(/href="([^"]*form13f[^"]*\.zip)"/gi)].map((m) => m[1])
    const out: Array<{ url: string; key: string }> = []
    for (const href of links) {
      const m = /(\d{2})([a-z]{3})(\d{4})_form13f\.zip/i.exec(href)
      if (!m) continue
      const key = `${m[3]}-${isoFromSetDate(`${m[1]}-${m[2]}-${m[3]}`).slice(5)}` // sortable yyyy-mm-dd of the end date
      out.push({ url: new URL(href, page).toString(), key })
    }
    if (out.length > 0) return out.sort((a, b) => b.key.localeCompare(a.key))
  }
  throw new Error('no form13f zip link found on the SEC index page — pass --set-url or --set-dir')
}

async function downloadSet(url: string, dir: string): Promise<void> {
  console.log(`Downloading the 13F data set (~100MB): ${url}`)
  mkdirSync(dir, { recursive: true })
  const res = await fetch(url, { headers: { 'User-Agent': 'Finance Now research dashboard (FinanceNow72@gmail.com)' } })
  if (!res.ok) throw new Error(`13F set download: HTTP ${res.status}`)
  const zipPath = path.join(dir, '13f.zip')
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
  // unzip where present (Linux/macOS); bsdtar (Windows 10+'s tar.exe) also extracts zips.
  try {
    execFileSync('unzip', ['-o', zipPath, '-d', dir], { stdio: 'ignore' })
  } catch {
    execFileSync('tar', ['-xf', zipPath, '-C', dir], { stdio: 'ignore' })
  }
  if (!existsSync(path.join(dir, 'INFOTABLE.tsv'))) throw new Error('extracted set has no INFOTABLE.tsv')
}

// The recorded `source` names the SEC set, never a local path: the file's
// head is its own provenance record (D243), and a build directory identifies
// nothing once the machine that held it is gone — the first wide build
// recorded a container's /tmp path (audit 2026-11-24, finding 3). The period
// beside it names the quarter; only a download records the exact URL.
async function ensureSetDir(): Promise<{ dir: string; source: string }> {
  if (setDirArg) {
    if (!existsSync(path.join(setDirArg, 'INFOTABLE.tsv'))) throw new Error(`--set-dir has no INFOTABLE.tsv: ${setDirArg}`)
    return { dir: setDirArg, source: 'SEC Form 13F structured data set (supplied as a local directory)' }
  }
  if (existsSync(path.join(CACHE_DIR, 'INFOTABLE.tsv')) && !setUrlArg) {
    return { dir: CACHE_DIR, source: 'SEC Form 13F structured data set (fn-13f-cache copy; delete the folder to refresh)' }
  }
  const url = setUrlArg ?? (await listSetUrls())[0].url
  await downloadSet(url, CACHE_DIR)
  return { dir: CACHE_DIR, source: url }
}

/**
 * The PRIOR quarter's set, for the T-472 change blocks. Explicit flags first;
 * when the current set came off the index, the second-newest link is the
 * prior window. A --set-dir run with no prior flag builds without changes and
 * says so — a wrong "quarter before" would be worse than none, and
 * isPriorQuarter() still checks whatever is supplied.
 */
async function ensurePriorSetDir(): Promise<{ dir: string; source: string } | null> {
  if (priorSetDirArg) {
    if (!existsSync(path.join(priorSetDirArg, 'INFOTABLE.tsv'))) throw new Error(`--prior-set-dir has no INFOTABLE.tsv: ${priorSetDirArg}`)
    return { dir: priorSetDirArg, source: 'SEC Form 13F structured data set (supplied as a local directory)' }
  }
  if (priorSetUrlArg) {
    await downloadSet(priorSetUrlArg, PRIOR_CACHE_DIR)
    return { dir: PRIOR_CACHE_DIR, source: priorSetUrlArg }
  }
  if (setDirArg || setUrlArg) {
    console.log('  no prior set given (--prior-set-dir / --prior-set-url): quarter-over-quarter changes left out')
    return null
  }
  if (existsSync(path.join(PRIOR_CACHE_DIR, 'INFOTABLE.tsv'))) {
    return { dir: PRIOR_CACHE_DIR, source: 'SEC Form 13F structured data set (fn-13f-cache-prior copy; delete the folder to refresh)' }
  }
  const links = await listSetUrls()
  if (links.length < 2) {
    console.log('  the index lists no earlier set: quarter-over-quarter changes left out')
    return null
  }
  await downloadSet(links[1].url, PRIOR_CACHE_DIR)
  return { dir: PRIOR_CACHE_DIR, source: links[1].url }
}

/**
 * The prior quarter's per-manager share totals — the same effective-filing
 * and row rules as aggregate13F (foldInfoRow is shared, so the two quarters
 * cannot drift apart), without the identity tallies the current quarter
 * needs: the prior set only ever answers "what did this manager hold then".
 */
async function aggregatePrior13F(dir: string) {
  const submissions: SubmissionRow[] = []
  await readTsv(path.join(dir, 'SUBMISSION.tsv'), (get) => {
    submissions.push({
      accession: get('ACCESSION_NUMBER'),
      filedAt: isoFromSetDate(get('FILING_DATE')),
      type: get('SUBMISSIONTYPE'),
      cik: get('CIK'),
      period: isoFromSetDate(get('PERIODOFREPORT')),
    })
  })
  const covers = new Map<string, CoverRow>()
  await readTsv(path.join(dir, 'COVERPAGE.tsv'), (get) => {
    const accession = get('ACCESSION_NUMBER')
    covers.set(accession, {
      accession,
      isAmendment: get('ISAMENDMENT').toUpperCase() === 'Y',
      amendmentKind: normalizeAmendmentKind(get('AMENDMENTTYPE')),
      managerName: get('FILINGMANAGER_NAME'),
    })
  })
  const period = dominantPeriod(submissions)
  if (!period) throw new Error('no 13F-HR rows in the prior set')
  const effective = effectiveFilings(submissions, covers, period)
  const managerNames = new Map<string, string>()
  for (const s of submissions) {
    if (effective.get(s.accession) === s.cik) {
      const name = covers.get(s.accession)?.managerName
      if (name) managerNames.set(s.cik, name)
    }
  }
  const totals = new Map<string, Map<string, { shares: number; valueUsd: number }>>()
  const internMap = new Map<string, string>()
  const intern = (s: string): string => {
    const c = internMap.get(s)
    if (c !== undefined) return c
    internMap.set(s, s)
    return s
  }
  let rows = 0
  await readTsv(path.join(dir, 'INFOTABLE.tsv'), (get) => {
    rows++
    if (get('SSHPRNAMTTYPE') !== 'SH') return
    if (get('PUTCALL').trim() !== '') return
    const accession = get('ACCESSION_NUMBER')
    if (!effective.has(accession)) return
    const shares = Number(get('SSHPRNAMT'))
    if (!Number.isFinite(shares) || shares <= 0) return
    foldInfoRow(totals, { accession, cusip: intern(get('CUSIP')), shares, sharesType: 'SH', putCall: '', valueUsd: Number(get('VALUE')) }, effective)
  })
  console.log(`  13F prior: ${rows.toLocaleString()} holdings rows streamed; period ${period}; ${effective.size.toLocaleString()} effective filings`)
  return { period, totals, managerNames }
}

async function readTsv(file: string, onRow: (get: (col: string) => string) => void): Promise<void> {
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity })
  let header: Map<string, number> | null = null
  for await (const line of rl) {
    if (!line) continue
    const cells = line.split('\t')
    if (!header) {
      header = new Map(cells.map((c, i) => [c.trim().toUpperCase(), i]))
      continue
    }
    const h = header
    onRow((col) => cells[h.get(col) ?? -1]?.trim() ?? '')
  }
}

async function aggregate13F(dir: string) {
  const submissions: SubmissionRow[] = []
  await readTsv(path.join(dir, 'SUBMISSION.tsv'), (get) => {
    submissions.push({
      accession: get('ACCESSION_NUMBER'),
      filedAt: isoFromSetDate(get('FILING_DATE')),
      type: get('SUBMISSIONTYPE'),
      cik: get('CIK'),
      period: isoFromSetDate(get('PERIODOFREPORT')),
    })
  })

  const covers = new Map<string, CoverRow>()
  const managerNames = new Map<string, string>()
  await readTsv(path.join(dir, 'COVERPAGE.tsv'), (get) => {
    const accession = get('ACCESSION_NUMBER')
    covers.set(accession, {
      accession,
      isAmendment: get('ISAMENDMENT').toUpperCase() === 'Y',
      amendmentKind: normalizeAmendmentKind(get('AMENDMENTTYPE')),
      managerName: get('FILINGMANAGER_NAME'),
    })
  })

  const period = dominantPeriod(submissions)
  if (!period) throw new Error('no 13F-HR rows in the set')
  const effective = effectiveFilings(submissions, covers, period)
  for (const s of submissions) {
    if (effective.get(s.accession) === s.cik) {
      const name = covers.get(s.accession)?.managerName
      if (name) managerNames.set(s.cik, name)
    }
  }

  // Everything is folded — the whole set is the identity evidence as well as
  // the totals: per CUSIP, every effective share row's issuer name and class
  // title are tallied (so the dominant spelling decides, never one odd row)
  // alongside the per-manager share totals. CUSIP strings are interned so the
  // millions of row-fresh strings do not all stay alive as map keys.
  const totals = new Map<string, Map<string, { shares: number; valueUsd: number }>>()
  const names = new Map<string, Map<string, number>>()
  const titles = new Map<string, Map<string, number>>()
  const sums = new Map<string, { shares: number; value: number }>()
  const internMap = new Map<string, string>()
  const intern = (s: string): string => {
    const c = internMap.get(s)
    if (c !== undefined) return c
    internMap.set(s, s)
    return s
  }
  const bump = (map: Map<string, Map<string, number>>, cusip: string, value: string) => {
    if (!value) return
    let tally = map.get(cusip)
    if (!tally) { tally = new Map(); map.set(cusip, tally) }
    tally.set(value, (tally.get(value) ?? 0) + 1)
  }
  let rows = 0
  await readTsv(path.join(dir, 'INFOTABLE.tsv'), (get) => {
    rows++
    if (get('SSHPRNAMTTYPE') !== 'SH') return
    if (get('PUTCALL').trim() !== '') return
    const accession = get('ACCESSION_NUMBER')
    if (!effective.has(accession)) return
    const shares = Number(get('SSHPRNAMT'))
    if (!Number.isFinite(shares) || shares <= 0) return
    const cusip = intern(get('CUSIP'))
    const valueUsd = Number(get('VALUE'))
    bump(names, cusip, get('NAMEOFISSUER'))
    bump(titles, cusip, get('TITLEOFCLASS'))
    const sum = sums.get(cusip) ?? { shares: 0, value: 0 }
    sum.shares += shares
    if (Number.isFinite(valueUsd)) sum.value += valueUsd
    sums.set(cusip, sum)
    foldInfoRow(totals, { accession, cusip, shares, sharesType: 'SH', putCall: '', valueUsd }, effective)
  })
  const evidence = new Map<string, F13CusipEvidence>()
  for (const [cusip, tally] of names) {
    const sum = sums.get(cusip)
    evidence.set(cusip, {
      holderCount: totals.get(cusip)?.size ?? 0,
      names: tally,
      titles: titles.get(cusip) ?? new Map(),
      avgPrice: sum && sum.shares > 0 && sum.value > 0 ? sum.value / sum.shares : null,
    })
  }
  console.log(`  13F: ${rows.toLocaleString()} holdings rows streamed; period ${period}; ${effective.size.toLocaleString()} effective filings; ${evidence.size.toLocaleString()} CUSIPs with evidence`)
  // Aggregation into top-ten lists happens in main(), over the resolved
  // CUSIPs only — building ranked holder arrays for every CUSIP in the set
  // would churn memory for stocks nothing asks about.
  return { period, totals, managerNames, managersInPeriod: new Set(effective.values()).size, evidence }
}

/**
 * The universe: every NYSE & Nasdaq common stock on the SEC's exchange list —
 * the same list, through the same selection rules, as the app's stock search
 * (T-450) — so "a given company's stock" means any stock a reader can open,
 * not only the catalog. The catalog's own symbols are kept whatever the
 * filters say, exactly as the app's list does.
 */
async function listedUniverse(): Promise<{ stocks: SecListing[]; leftOut: Record<string, number> }> {
  const res = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
    headers: { 'User-Agent': 'Finance Now research dashboard (FinanceNow72@gmail.com)' },
  })
  if (!res.ok) throw new Error(`SEC exchange list: HTTP ${res.status}`)
  const rows = parseExchangeFile(await res.json())
  if (!rows || rows.length === 0) throw new Error('SEC exchange list: not in the expected shape')
  // The same fund filter the app's list uses: the fund catalog, plus every
  // ticker the SEC's N-PORT fund filings name.
  const fundSymbols = new Set([...FUND_CATALOG.map((f) => f.symbol.toUpperCase()), ...Object.keys(FUND_FACTS)])
  const { listings, leftOut } = selectCommonListings(
    rows,
    (symbol) => fundSymbols.has(symbol.toUpperCase()),
    (symbol) => !!EQUITY_BY_SYMBOL[symbol],
  )
  return { stocks: listings, leftOut }
}

type Sweep = Awaited<ReturnType<typeof sweepFunds>>

function loadSweepCache(file: string): Sweep | null {
  if (!existsSync(file)) return null
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Omit<Sweep, 'byCusipFunds'> & { byCusipFunds: Array<[string, FundRow[]]> }
  return { ...raw, byCusipFunds: new Map(raw.byCusipFunds) }
}

async function main(): Promise<number> {
  let sweep = sweepCacheArg ? loadSweepCache(sweepCacheArg) : null
  if (sweep) {
    console.log(`Reusing the saved N-PORT sweep: ${sweepCacheArg}`)
  } else {
    console.log(`Sweeping ${fundLimit > 0 ? fundLimit : FUND_CATALOG.length} catalog funds' N-PORT filings…`)
    sweep = await sweepFunds()
    if (sweepCacheArg) {
      writeFileSync(sweepCacheArg, JSON.stringify({ ...sweep, byCusipFunds: [...sweep.byCusipFunds] }))
      console.log(`  sweep saved to ${sweepCacheArg}`)
    }
  }
  console.log(`  ${sweep.fundsRead} funds read, ${sweep.fundsSkipped.length} skipped`)

  // Match against the SEC's own registrant title for each ticker — filers
  // write near-legal names ("International Business Machines Corp"), which the
  // catalog's display names ("IBM") do not line up with. Catalog name only
  // when the SEC map lacks the ticker.
  const universe = await listedUniverse()
  const byCik = new Map<number, SecListing[]>()
  for (const l of universe.stocks) {
    const list = byCik.get(l.cik) ?? []
    list.push(l)
    byCik.set(l.cik, list)
  }
  console.log(`Universe: ${universe.stocks.length} NYSE & Nasdaq common stocks (left out: ${Object.entries(universe.leftOut).map(([k, v]) => `${k} ${v}`).join(', ')})`)

  // Catalog symbols the SEC list happens to lack still resolve, with the SEC
  // registrant-title map as their name source.
  const cikMap = await fetchTickerCikMap()
  const missingCatalog = EQUITY_CATALOG.filter((s) => !universe.stocks.some((l) => l.symbol === s.symbol))
  const stockList: Array<{ symbol: string; name: string; shareClasses: number }> = [
    ...universe.stocks.map((l) => ({ symbol: l.symbol, name: l.name, shareClasses: l.shareClasses })),
    ...missingCatalog.map((s) => ({ symbol: s.symbol, name: cikMap.get(s.symbol.toUpperCase())?.company ?? s.name, shareClasses: 1 })),
  ]
  if (missingCatalog.length > 0) console.log(`  (+${missingCatalog.length} catalog symbols not on the SEC list: ${missingCatalog.map((s) => s.symbol).join(', ')})`)

  const { dir, source } = await ensureSetDir()
  const f13 = await aggregate13F(dir)

  // T-472 (D245): the prior quarter, for the per-stock change blocks.
  const priorSet = await ensurePriorSetDir()
  let prior: Awaited<ReturnType<typeof aggregatePrior13F>> | null = null
  let priorSource: string | null = null
  if (priorSet) {
    prior = await aggregatePrior13F(priorSet.dir)
    priorSource = priorSet.source
    if (!isPriorQuarter(f13.period, prior.period)) {
      console.warn(`  prior set's period ${prior.period} is not the quarter before ${f13.period} — changes left out`)
      prior = null
      priorSource = null
    }
  }

  // One resolution over both filing sources (scripts/lib/stockCusips.ts):
  // fund families and 13F filers each carry identity, titles say what a
  // fund-less line is, siblings eliminate, duplicates refuse.
  const resolution = resolveListed(stockList, sweep.holdingsForCusip, f13.evidence)
  const entryFor = new Map(stockList.map((s) => [s.symbol, s]))
  const viaCounts = new Map<string, number>()
  for (const r of resolution.resolved.values()) viaCounts.set(r.via, (viaCounts.get(r.via) ?? 0) + 1)
  console.log(`  CUSIPs: ${resolution.resolved.size} of ${stockList.length} stocks resolved — ${[...viaCounts.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(', ')}`)

  // Unresolved, by reason — and full diagnostics for the first few, so a
  // rules change starts from data instead of theory.
  const reasonCounts = new Map<string, number>()
  for (const u of resolution.unresolved) {
    const key = u.reason.replace(/\d+ CUSIPs.*$/, 'several CUSIPs survive')
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1)
  }
  for (const [reason, n] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${n} unresolved: ${reason}`)
  for (const u of resolution.unresolved.filter((x) => entryFor.get(x.symbol) && EQUITY_BY_SYMBOL[x.symbol]).slice(0, 15)) {
    console.log(`    catalog unresolved ${u.symbol}: ${u.reason}`)
    const title = entryFor.get(u.symbol)!.name
    const byCusip = new Map<string, HoldingForCusip[]>()
    for (const h of sweep.holdingsForCusip) {
      if (!nameMatches(title, h.name)) continue
      const list = byCusip.get(h.cusip) ?? []
      list.push(h)
      byCusip.set(h.cusip, list)
    }
    for (const [cusip, list] of byCusip) {
      const families = new Set(list.map((r) => r.family))
      const prices = list
        .filter((r) => r.balance != null && r.balance > 0 && r.valueUsd != null && r.valueUsd > 0)
        .map((r) => (r.valueUsd as number) / (r.balance as number))
        .sort((a, b) => a - b)
      const fmt = (v: number) => (v >= 1 ? v.toFixed(2) : v.toPrecision(3))
      const span = prices.length ? `$${fmt(prices[0])}…$${fmt(prices[prices.length - 1])} (median $${fmt(prices[Math.floor(prices.length / 2)])})` : 'no priced rows'
      const ev = f13.evidence.get(cusip)
      const titleNote = ev && ev.titles.size > 0 ? `; 13F titles: ${[...ev.titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `"${t}"×${n}`).join(', ')}` : ''
      console.log(`      ${cusip}: ${list.length} rows, ${families.size} families, ${span} — e.g. "${list[0].name}"${titleNote}`)
    }
  }

  // The file: one line per stock, so a rebuild's diff reads per company, and
  // manager names once in a dictionary rather than on every stock they hold
  // (BlackRock is in nearly every top ten). Holders and fund rows are tuples;
  // the reader (lib/data/stockHolders.ts hydrate) turns a stock's slice back
  // into named objects when the route serves it.
  const managers: Record<string, string> = {}
  const stockLines: string[] = []
  let covered = 0
  // Ranked holder lists for resolved CUSIPs only.
  const resolvedTotals = new Map<string, Map<string, { shares: number; valueUsd: number }>>()
  for (const r of resolution.resolved.values()) {
    const t = f13.totals.get(r.cusip)
    if (t) resolvedTotals.set(r.cusip, t)
  }
  const aggregates = aggregate(resolvedTotals, f13.managerNames, TOP_HOLDERS)

  // T-472: one CUSIP's quarter-over-quarter change, compact, with every named
  // manager's name put in the shared dictionary (current set's spelling first,
  // the prior set's for a manager who exited; an unknown CIK stays bare and
  // hydrate labels it).
  const changeFor = (cusip: string) => {
    if (!prior) return undefined
    const d = diffQuarter(f13.totals.get(cusip) ?? new Map(), prior.totals.get(cusip))
    if (!d) return null
    for (const [cik] of [...d.increases, ...d.reductions, ...d.newStakes, ...d.exits]) {
      const nm = f13.managerNames.get(cik) ?? prior.managerNames.get(cik)
      if (nm && !managers[cik]) managers[cik] = nm
    }
    return { tp: d.totalSharesPrior, mp: d.holderCountPrior, up: d.increases, down: d.reductions, add: d.newStakes, out: d.exits }
  }

  for (const stock of stockList) {
    const r = resolution.resolved.get(stock.symbol)
    if (!r) continue
    covered++
    const agg = aggregates.get(r.cusip)
    if (agg) for (const h of agg.topHolders) managers[h.cik] = h.name
    const funds = (sweep.byCusipFunds.get(r.cusip) ?? [])
      .sort((a, b) => b.shares - a.shares)
      .slice(0, TOP_FUNDS)
    const entry = {
      cusip: r.cusip,
      cusipFamilies: r.families,
      cusipVia: r.via,
      // One listed class of several: company-wide share counts cannot place
      // this class's 13F total, so the page shows shares without a percent.
      multiClass: stock.shareClasses > 1 || classWordFor(stock.symbol) !== null,
      institutional: agg
        ? { totalShares: agg.totalShares, holderCount: agg.holderCount, top: agg.topHolders.map((h) => [h.cik, h.shares, h.valueUsd]) }
        : null,
      ...(prior ? { change: changeFor(r.cusip) } : {}),
      funds: funds.map((f) => [f.symbol, f.shares, f.valueUsd, f.pctVal, f.asOf]),
    }
    stockLines.push(`  ${JSON.stringify(stock.symbol)}: ${JSON.stringify(entry)}`)
  }

  const head = {
    builtOn: new Date().toISOString().slice(0, 10),
    thirteenF: { period: f13.period, source, managersInPeriod: f13.managersInPeriod },
    thirteenFPrior: prior && priorSource ? { period: prior.period, source: priorSource } : null,
    universe: { source: 'SEC company_tickers_exchange.json (NYSE & Nasdaq common stocks, the app’s own T-450 selection rules) + the equity catalog', listed: stockList.length, leftOut: universe.leftOut },
    fundsRead: sweep.fundsRead,
    fundsSkipped: sweep.fundsSkipped,
    unresolved: resolution.unresolved,
    managers,
  }
  const headJson = JSON.stringify(head, null, 1)
  writeFileSync(OUT_PATH, `${headJson.slice(0, -2)},\n "stocks": {\n${stockLines.join(',\n')}\n }\n}\n`)
  console.log(`Wrote ${OUT_PATH} — ${covered} stocks covered, ${resolution.unresolved.length} unresolved`)

  // Sanity line for the reader: the largest aggregate, in plain words.
  const aapl = resolution.resolved.get('AAPL')
  const aaplAgg = aapl ? aggregates.get(aapl.cusip) : undefined
  if (aaplAgg) {
    console.log(`  AAPL: ${(aaplAgg.totalShares / 1e9).toFixed(2)}B shares across ${aaplAgg.holderCount.toLocaleString()} managers`)
    if (prior && aapl) {
      const d = diffQuarter(f13.totals.get(aapl.cusip) ?? new Map(), prior.totals.get(aapl.cusip))
      if (d) {
        console.log(`  AAPL vs ${prior.period}: total was ${(d.totalSharesPrior / 1e9).toFixed(2)}B across ${d.holderCountPrior.toLocaleString()} managers; `
          + `largest increase ${d.increases[0]?.[0] ?? 'none'} (+${(((d.increases[0]?.[1] ?? 0) - (d.increases[0]?.[2] ?? 0)) / 1e6).toFixed(1)}M sh)`)
      }
    }
  }
  return 0
}

main().then((code) => process.exit(code)).catch((err) => {
  if (isNetworkError(err)) {
    console.error(`INCONCLUSIVE — network unreachable from here: ${err}`)
    process.exit(2)
  }
  console.error(err)
  process.exit(1)
})
