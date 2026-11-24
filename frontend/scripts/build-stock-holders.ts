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

import { EQUITY_CATALOG } from '../src/lib/data/equityCatalog'
import { FUND_CATALOG } from '../src/lib/data/fundCatalog'
import { fetchTickerCikMap } from '../src/lib/server/edgar'
import { resolveFundSeries, listNportFilings, fetchNportReport } from '../src/lib/server/nport'
import {
  CLASS_WORDS, classCandidateCusips, cusipForClassByTitles, nameMatches, resolveCusips,
  type HoldingForCusip,
} from './lib/stockCusips'
import {
  isoFromSetDate, normalizeAmendmentKind, dominantPeriod, effectiveFilings, foldInfoRow, aggregate,
  type SubmissionRow, type CoverRow,
} from './lib/form13f'

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const OUT_PATH = path.join(FRONTEND_ROOT, 'src', 'lib', 'data', 'stockHolders.generated.json')
const CACHE_DIR = path.join(FRONTEND_ROOT, 'fn-13f-cache')
const SET_INDEX_PAGES = [
  // The SEC moved the newest sets to a new path family in 2026; read both.
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

/** Newest quarterly set: the latest end date among zip links on the index page. */
async function latestSetUrl(): Promise<string> {
  for (const page of SET_INDEX_PAGES) {
    const res = await fetch(page, { headers: { 'User-Agent': 'Finance Now research dashboard (FinanceNow72@gmail.com)' } })
    if (!res.ok) continue
    const html = await res.text()
    const links = [...html.matchAll(/href="([^"]*form13f[^"]*\.zip)"/gi)].map((m) => m[1])
    let best: { url: string; key: string } | null = null
    for (const href of links) {
      const m = /(\d{2})([a-z]{3})(\d{4})_form13f\.zip/i.exec(href)
      if (!m) continue
      const key = `${m[3]}-${isoFromSetDate(`${m[1]}-${m[2]}-${m[3]}`).slice(5)}` // sortable yyyy-mm-dd of the end date
      if (!best || key > best.key) best = { url: new URL(href, page).toString(), key }
    }
    if (best) return best.url
  }
  throw new Error('no form13f zip link found on the SEC index page — pass --set-url or --set-dir')
}

async function ensureSetDir(): Promise<{ dir: string; source: string }> {
  if (setDirArg) {
    if (!existsSync(path.join(setDirArg, 'INFOTABLE.tsv'))) throw new Error(`--set-dir has no INFOTABLE.tsv: ${setDirArg}`)
    return { dir: setDirArg, source: setDirArg }
  }
  if (existsSync(path.join(CACHE_DIR, 'INFOTABLE.tsv')) && !setUrlArg) {
    return { dir: CACHE_DIR, source: `${CACHE_DIR} (cached; delete the folder to refresh)` }
  }
  const url = setUrlArg ?? await latestSetUrl()
  console.log(`Downloading the 13F data set (~100MB): ${url}`)
  mkdirSync(CACHE_DIR, { recursive: true })
  const res = await fetch(url, { headers: { 'User-Agent': 'Finance Now research dashboard (FinanceNow72@gmail.com)' } })
  if (!res.ok) throw new Error(`13F set download: HTTP ${res.status}`)
  const zipPath = path.join(CACHE_DIR, '13f.zip')
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
  // unzip where present (Linux/macOS); bsdtar (Windows 10+'s tar.exe) also extracts zips.
  try {
    execFileSync('unzip', ['-o', zipPath, '-d', CACHE_DIR], { stdio: 'ignore' })
  } catch {
    execFileSync('tar', ['-xf', zipPath, '-C', CACHE_DIR], { stdio: 'ignore' })
  }
  if (!existsSync(path.join(CACHE_DIR, 'INFOTABLE.tsv'))) throw new Error('extracted set has no INFOTABLE.tsv')
  return { dir: CACHE_DIR, source: url }
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

async function aggregate13F(dir: string, cusips: ReadonlySet<string>, titleCusips: ReadonlySet<string>) {
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

  const totals = new Map<string, Map<string, { shares: number; valueUsd: number }>>()
  // Pass 2's evidence: how the 13F set itself titles each candidate CUSIP's
  // class ("COM CL B"), tallied so one odd row cannot decide.
  const titleTallies = new Map<string, Map<string, number>>()
  let rows = 0
  await readTsv(path.join(dir, 'INFOTABLE.tsv'), (get) => {
    rows++
    const cusip = get('CUSIP')
    if (titleCusips.has(cusip)) {
      const title = get('TITLEOFCLASS')
      if (title) {
        let tally = titleTallies.get(cusip)
        if (!tally) { tally = new Map(); titleTallies.set(cusip, tally) }
        tally.set(title, (tally.get(title) ?? 0) + 1)
      }
    }
    if (!cusips.has(cusip)) return
    foldInfoRow(totals, {
      accession: get('ACCESSION_NUMBER'),
      cusip,
      shares: Number(get('SSHPRNAMT')),
      sharesType: get('SSHPRNAMTTYPE'),
      putCall: get('PUTCALL'),
      valueUsd: Number(get('VALUE')),
    }, effective)
  })
  console.log(`  13F: ${rows.toLocaleString()} holdings rows streamed; period ${period}; ${effective.size.toLocaleString()} effective filings`)
  return { period, aggregates: aggregate(totals, managerNames, TOP_HOLDERS), managersInPeriod: new Set(effective.values()).size, titleTallies }
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
  const cikMap = await fetchTickerCikMap()
  const titleFor = (symbol: string) =>
    cikMap.get(symbol.toUpperCase())?.company ?? EQUITY_CATALOG.find((s) => s.symbol === symbol)?.name ?? symbol
  const resolution = resolveCusips(
    EQUITY_CATALOG.map((s) => ({ symbol: s.symbol, name: titleFor(s.symbol) })),
    sweep.holdingsForCusip,
  )
  console.log(`  CUSIPs: ${resolution.resolved.size} of ${EQUITY_CATALOG.length} stocks resolved by the fund filings' names`)

  // Pass 2 candidates: class shares whose fund-filing names do not say the
  // class at all (both Berkshire lines file as "Berkshire Hathaway Inc"). The
  // 13F set's TITLEOFCLASS column will decide among them after the stream.
  const taken = new Set([...resolution.resolved.values()].map((r) => r.cusip))
  const pass2 = new Map<string, { classWord: string; candidates: Array<{ cusip: string; families: string[] }> }>()
  for (const u of resolution.unresolved) {
    const classWord = CLASS_WORDS[u.symbol]
    if (!classWord) continue
    const candidates = classCandidateCusips({ symbol: u.symbol, name: titleFor(u.symbol) }, sweep.holdingsForCusip)
      .filter((c) => !taken.has(c.cusip))
    if (candidates.length > 0) pass2.set(u.symbol, { classWord, candidates })
  }

  const { dir, source } = await ensureSetDir()
  const wanted = new Set([...resolution.resolved.values()].map((r) => r.cusip))
  const titleCusips = new Set<string>()
  for (const { candidates } of pass2.values()) {
    for (const c of candidates) { wanted.add(c.cusip); titleCusips.add(c.cusip) }
  }
  const f13 = await aggregate13F(dir, wanted, titleCusips)

  const viaTitles = new Set<string>()
  for (const [symbol, { classWord, candidates }] of pass2) {
    const cusip = cusipForClassByTitles(classWord, candidates, f13.titleTallies)
    if (!cusip) continue
    resolution.resolved.set(symbol, { cusip, families: candidates.find((c) => c.cusip === cusip)?.families ?? [] })
    viaTitles.add(symbol)
  }
  resolution.unresolved = resolution.unresolved.filter((u) => !resolution.resolved.has(u.symbol))
  if (viaTitles.size > 0) console.log(`  +${viaTitles.size} resolved by the 13F set's own class titles: ${[...viaTitles].sort().join(', ')}`)
  console.log(`  CUSIPs: ${resolution.resolved.size} of ${EQUITY_CATALOG.length} stocks resolved`)

  for (const u of resolution.unresolved) {
    console.log(`    unresolved ${u.symbol}: ${u.reason}`)
    // Diagnostics: what the filings actually carry under that name, so the
    // next rules change starts from data instead of theory.
    const title = titleFor(u.symbol)
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
      const titles = f13.titleTallies.get(cusip)
      const titleNote = titles ? `; 13F titles: ${[...titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `"${t}"×${n}`).join(', ')}` : ''
      console.log(`      ${cusip}: ${list.length} rows, ${families.size} families, ${span} — e.g. "${list[0].name}"${titleNote}`)
    }
  }

  const stocks: Record<string, unknown> = {}
  for (const stock of EQUITY_CATALOG) {
    const r = resolution.resolved.get(stock.symbol)
    if (!r) continue
    const agg = f13.aggregates.get(r.cusip)
    const funds = (sweep.byCusipFunds.get(r.cusip) ?? [])
      .sort((a, b) => b.shares - a.shares)
      .slice(0, TOP_FUNDS)
    stocks[stock.symbol] = {
      cusip: r.cusip,
      cusipFamilies: r.families,
      cusipVia: viaTitles.has(stock.symbol) ? '13f-class-title' : 'fund-names',
      // One listed class of several: company-wide share counts cannot place
      // this class's 13F total, so the page shows shares without a percent.
      multiClass: stock.symbol in CLASS_WORDS,
      institutional: agg
        ? { totalShares: agg.totalShares, holderCount: agg.holderCount, topHolders: agg.topHolders }
        : null,
      funds,
    }
  }

  const out = {
    builtOn: new Date().toISOString().slice(0, 10),
    thirteenF: { period: f13.period, source, managersInPeriod: f13.managersInPeriod },
    fundsRead: sweep.fundsRead,
    fundsSkipped: sweep.fundsSkipped,
    unresolved: resolution.unresolved,
    stocks,
  }
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 1)}\n`)
  console.log(`Wrote ${OUT_PATH}`)

  // Sanity line for the reader: the largest aggregate, in plain words.
  const aapl = stocks.AAPL as { institutional?: { totalShares: number; holderCount: number } | null } | undefined
  if (aapl?.institutional) {
    console.log(`  AAPL: ${(aapl.institutional.totalShares / 1e9).toFixed(2)}B shares across ${aapl.institutional.holderCount.toLocaleString()} managers`)
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
