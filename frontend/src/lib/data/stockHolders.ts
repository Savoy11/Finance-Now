// ─────────────────────────────────────────────────────────────────────────────
// WHO HOLDS A STOCK — types, wording and provenance for the generated
// ownership data (T-471, owner request, 2026-11-24).
//
// The figures live in stockHolders.generated.json, built by
// `npm run holders:build` (scripts/build-stock-holders.ts) from two SEC
// sources: every catalog fund's newest N-PORT filing (which funds hold the
// stock) and the SEC's quarterly Form 13F structured data set (how much
// institutions reported holding). This module holds what the pages and the
// route share — the file's types, the plain-words notes, and the staleness
// clock — and imports nothing heavy, so client components can read it.
//
// The notes are load-bearing, not decoration. 13F totals are AS FILED:
// a stock lent into a short sale is counted by both its lender and the
// short-seller's buyer, and a parent and its subsidiary can each report the
// same shares — so the total CAN top the company's own share count, and
// saying why beats showing a quietly impossible percentage.
// ─────────────────────────────────────────────────────────────────────────────

import { FUND_CATALOG } from './fundCatalog'

/** Fund names once, for hydrating the file's per-stock fund tuples. */
const FUND_NAMES: Record<string, string> = Object.fromEntries(FUND_CATALOG.map((f) => [f.symbol, f.name]))

export interface StockFundHolderRow {
  symbol: string
  name: string
  shares: number
  valueUsd: number | null
  /** The holding as a share of the fund's portfolio value, as filed. */
  pctVal: number | null
  /** The fund filing's portfolio date. */
  asOf: string
}

export interface StockInstitutionalHolder {
  name: string
  cik: string
  shares: number
  valueUsd: number
}

export interface StockInstitutional {
  totalShares: number
  holderCount: number
  topHolders: StockInstitutionalHolder[]
}

export interface StockHoldersEntry {
  cusip: string
  /** The independent fund families whose filings agreed on the CUSIP. */
  cusipFamilies: string[]
  /**
   * How the CUSIP was settled: by the fund filings' own names; for class
   * shares every filer names identically, by the 13F set's class titles; or,
   * for a classless listing of a multi-class company, by elimination once its
   * siblings' identifiers were taken.
   */
  cusipVia: 'fund-names' | 'fund+13f-names' | '13f-names' | 'sibling-elimination'
  /**
   * The stock is one listed class of several (Berkshire's B shares,
   * Alphabet's A shares). The company's share counts cover every class
   * combined, so a percent of them would misplace this one class's 13F
   * total — the page shows the shares and says why there is no percent.
   */
  multiClass: boolean
  institutional: StockInstitutional | null
  funds: StockFundHolderRow[]
}

// ── The generated file's own shape (compact, one stock per line) ────────────
// The build covers every NYSE & Nasdaq common stock, so the file keeps
// manager names once in a dictionary (BlackRock is in nearly every top ten)
// and the per-stock rows as tuples; hydrateStockHolders turns one stock's
// slice back into the named shape above when the route serves it.

export interface StockHoldersFileEntry {
  cusip: string
  cusipFamilies: string[]
  cusipVia: StockHoldersEntry['cusipVia']
  multiClass: boolean
  institutional: {
    totalShares: number
    holderCount: number
    /** [manager CIK, shares, value in dollars] — names in the file's `managers`. */
    top: Array<[string, number, number]>
  } | null
  /** [fund symbol, shares, value, share of the fund's portfolio, as-of date]. */
  funds: Array<[string, number, number | null, number | null, string]>
}

export interface StockHoldersFile {
  builtOn: string
  thirteenF: { period: string; source: string; managersInPeriod: number }
  universe: { source: string; listed: number; leftOut: Record<string, number> }
  fundsRead: number
  fundsSkipped: Array<{ symbol: string; reason: string }>
  unresolved: Array<{ symbol: string; reason: string }>
  /** Manager names by CIK, shared across every stock's top holders. */
  managers: Record<string, string>
  stocks: Record<string, StockHoldersFileEntry>
}

/** One stock's slice of the file, with names and field words back in place. */
export function hydrateStockHolders(file: StockHoldersFile, symbol: string): StockHoldersEntry | null {
  const e = file.stocks[symbol]
  if (!e) return null
  return {
    cusip: e.cusip,
    cusipFamilies: e.cusipFamilies,
    cusipVia: e.cusipVia,
    multiClass: e.multiClass,
    institutional: e.institutional
      ? {
          totalShares: e.institutional.totalShares,
          holderCount: e.institutional.holderCount,
          topHolders: e.institutional.top.map(([cik, shares, valueUsd]) => ({
            cik, shares, valueUsd, name: file.managers[cik] ?? `CIK ${cik}`,
          })),
        }
      : null,
    funds: e.funds.map(([fundSymbol, shares, valueUsd, pctVal, asOf]) => ({
      symbol: fundSymbol, shares, valueUsd, pctVal, asOf,
      name: FUND_NAMES[fundSymbol] ?? fundSymbol,
    })),
  }
}

/** What /live-data/stock-holders answers for one symbol. */
export interface StockHoldersResponse {
  ok: boolean
  symbol: string
  builtOn: string
  /** The 13F reporting quarter the institutional figures cover. */
  period: string
  managersInPeriod: number
  fundsRead: number
  /** How many listed stocks the build settled figures for. */
  stocksCovered: number
  entry: StockHoldersEntry | null
  /** Why the symbol has no entry (the build's recorded reason), when it has none. */
  unresolvedReason: string | null
  updatedAt: string
  source: string
}

// ── Provenance ───────────────────────────────────────────────────────────────
// The day `npm run holders:build` last wrote the generated file; a test pins it
// to the file's own builtOn so the two cannot drift. 13F sets are quarterly
// with a 45-day filing deadline, so past ~120 days a newer quarter's set and
// fresher N-PORT filings are out.
export const STOCK_HOLDERS_BUILT_ON = '2026-11-24'
export const STOCK_HOLDERS_STALE_AFTER_DAYS = 120

export function stockHoldersAgeDays(now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(`${STOCK_HOLDERS_BUILT_ON}T00:00:00Z`).getTime()) / 86_400_000)
}

export function stockHoldersIsStale(now: Date = new Date()): boolean {
  return stockHoldersAgeDays(now) > STOCK_HOLDERS_STALE_AFTER_DAYS
}

export function getStockHoldersProvenance(now: Date = new Date()) {
  return {
    source: 'SEC Form 13F data set + the catalog funds’ N-PORT filings',
    verifiedAt: STOCK_HOLDERS_BUILT_ON,
    ageDays: stockHoldersAgeDays(now),
    stale: stockHoldersIsStale(now),
    confidence: 'filed' as const,
  }
}

// ── The arithmetic the cards show ────────────────────────────────────────────

/** Reported institutional shares as a percent of the company's outstanding count. */
export function institutionalPctOfOutstanding(totalShares: number, outstanding: number | null): number | null {
  if (outstanding == null || !(outstanding > 0) || !(totalShares >= 0)) return null
  return (totalShares / outstanding) * 100
}

// ── Wording, pinned by tests so the honesty cannot drift ─────────────────────

/** Why a 13F total is not a clean "institutions own X%". */
export const INSTITUTIONAL_AS_FILED_NOTE =
  'Totals are as managers filed them: shares lent into short sales are counted twice '
  + '(by the lender and by whoever bought them), and a parent and its subsidiary can each '
  + 'report the same shares — so the total can top the company’s own share count.'

/** The quarter-end + 45-day-deadline lag, with the period filled in. */
export function thirteenFPeriodNote(period: string): string {
  return `Holdings as reported for the quarter ended ${period}; managers file up to 45 days later, so newer trades are not in these figures.`
}

/** Card B's scope line — the count is the build's own, never typed. */
export function fundHoldersScopeNote(fundsRead: number): string {
  return `Among the ${fundsRead} funds this app tracks, from each fund’s latest portfolio filing (filed up to 60 days after its date). Funds beyond this app’s catalog are not counted.`
}

/**
 * The build's recorded unresolved reasons, in plain words for the page. The
 * build refuses to guess a security identifier (see scripts/lib/stockCusips.ts);
 * the page says so instead of showing an empty card with no explanation.
 */
export function unresolvedInPlainWords(reason: string | null): string {
  if (reason == null) {
    return 'This stock was not on the NYSE and Nasdaq common-stock list these figures were built over — new listings join when the data is next rebuilt, and stocks traded elsewhere are not covered.'
  }
  if (reason.includes('ambiguous')) {
    return 'The filings carry more than one possible security identifier for this stock, and guessing between them is worse than leaving the figures out.'
  }
  return 'The tracked funds’ filings could not settle this stock’s security identifier, so its figures are left out rather than guessed.'
}

/** The Apple case: no treasury tag is a real state, never an unknown. */
export const TREASURY_NOT_REPORTED_NOTE =
  'No treasury shares reported — companies that retire repurchased shares have none to hold.'

/** Shown when issued − treasury ≠ outstanding (figures from different filing dates). */
export const STRUCTURE_DATES_DIFFER_NOTE =
  'These figures come from different filing dates, so they do not add up exactly.'

/** Multi-class symbols: why the institutional total carries no percent. */
export const MULTI_CLASS_NO_PCT_NOTE =
  'This stock is one of the company’s several share classes, and the company’s own counts cover every class combined — so no percent is shown against them.'

/** Multi-class symbols: what the company-wide counts above cover. */
export const MULTI_CLASS_COUNTS_NOTE =
  'The company’s share counts cover every share class combined.'
