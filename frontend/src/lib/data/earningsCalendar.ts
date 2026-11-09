import { fitRow, readAlphaVantageCsv, type AlphaVantageFailure } from './alphaVantageCsv'
import { addDays, marketToday } from '@/lib/utils/marketDay'

// New York's day, shared with the Macro calendar (lib/utils/marketDay.ts).
export { addDays, marketToday }

// ─── Upcoming earnings dates (T-458, D213) ───────────────────────────────────
//
// FMP's earnings calendar is the first source; Alpha Vantage's EARNINGS_CALENDAR, one request a
// day on its free tier, is the second, so earnings dates survive losing FMP (D21). Pure: the
// fetching is in lib/server/earningsCalendar.ts.
//
// Alpha Vantage's feed, read 2026-11-08 through the owner's Alpha Vantage connection:
//   symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay
//   NVDA,NVIDIA CORPORATION,2026-11-17,2026-10-31,2.49,USD,post-market
// A company with no date in the next three months has no row (IBM, the same day).
//
// Every date is EXPECTED: companies often confirm late, and a date can move. Every surface says so.

export type EarningsSource = 'fmp' | 'alpha-vantage'
export type EarningsTime = 'pre-market' | 'post-market'

export interface UpcomingEarnings {
  symbol: string
  name: string
  /** Expected report day, YYYY-MM-DD. */
  date: string
  /** The quarter the report covers ends on this day, when the source gives it. */
  fiscalPeriodEnd: string | null
  /** Before the market opens or after it closes, when the source says. */
  time: EarningsTime | null
  /** Analysts' expected earnings per share, as the source gives it. */
  epsEstimate: number | null
  source: EarningsSource
}

export type EarningsParseOutcome = { ok: true; events: UpcomingEarnings[] } | AlphaVantageFailure

const DATE = /^\d{4}-\d{2}-\d{2}$/
const SYMBOL = /^[A-Z][A-Z0-9.-]{0,9}$/

const finite = (raw: unknown): number | null => {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const timeOf = (raw: unknown): EarningsTime | null => {
  const t = String(raw ?? '').trim().toLowerCase()
  if (t === 'pre-market' || t === 'bmo') return 'pre-market'
  if (t === 'post-market' || t === 'amc') return 'post-market'
  return null
}

/** Alpha Vantage's EARNINGS_CALENDAR body, CSV or its JSON failure note. */
export function parseAlphaVantageEarnings(body: string): EarningsParseOutcome {
  const csv = readAlphaVantageCsv(body)
  if (!csv.ok) return csv
  const col = (name: string) => csv.header.indexOf(name)
  const i = {
    symbol: col('symbol'), name: col('name'), date: col('reportdate'), fiscal: col('fiscaldateending'),
    estimate: col('estimate'), time: col('timeoftheday'),
  }
  for (const [required, at] of [['symbol', i.symbol], ['reportDate', i.date]] as const) {
    if (at < 0) return { ok: false, reason: 'unparseable', detail: `missing "${required}" column; header was: ${csv.header.join(',')}` }
  }
  const events: UpcomingEarnings[] = []
  for (const raw of csv.rows) {
    const c = fitRow(raw, csv.header.length, i.name)
    const symbol = (c[i.symbol] ?? '').toUpperCase()
    const date = c[i.date] ?? ''
    // A row with no symbol or no date is not an event: skipped, never given an invented date.
    if (!SYMBOL.test(symbol) || !DATE.test(date)) continue
    const fiscal = i.fiscal >= 0 ? c[i.fiscal] ?? '' : ''
    events.push({
      symbol,
      name: (i.name >= 0 ? c[i.name] : '') || symbol,
      date,
      fiscalPeriodEnd: DATE.test(fiscal) ? fiscal : null,
      time: i.time >= 0 ? timeOf(c[i.time]) : null,
      epsEstimate: i.estimate >= 0 ? finite(c[i.estimate]) : null,
      source: 'alpha-vantage',
    })
  }
  return { ok: true, events }
}

/** FMP's /stable/earnings-calendar rows. Anything that is not a dated, named row is skipped. */
export function parseFmpEarnings(rows: unknown): UpcomingEarnings[] {
  if (!Array.isArray(rows)) return []
  const out: UpcomingEarnings[] = []
  for (const r of rows as Array<Record<string, unknown>>) {
    const symbol = String(r?.symbol ?? '').trim().toUpperCase()
    const date = String(r?.date ?? '').slice(0, 10)
    if (!SYMBOL.test(symbol) || !DATE.test(date)) continue
    out.push({
      symbol,
      name: symbol,
      date,
      fiscalPeriodEnd: null,
      // FMP's /stable calendar has carried no session field so far; read one if it appears.
      time: timeOf(r.time),
      epsEstimate: finite(r.epsEstimated),
      source: 'fmp',
    })
  }
  return out
}

/**
 * FMP first; Alpha Vantage fills in only the companies FMP does not list. Where both list a
 * company, FMP's dates stand and Alpha Vantage's are not mixed in, so one company never shows
 * two different "next" dates from two sources. Sorted by date, then symbol.
 *
 * `alsoListed` names companies FMP lists outside the rows passed, over the whole stretch Alpha
 * Vantage covers (EARNINGS_LISTED_WINDOW_DAYS). Without it, a month's calendar would take Alpha
 * Vantage's Nov 30 for a company FMP lists on Dec 2, and the next month and the stock page FMP's
 * (code audit 2026-11-09, D214).
 */
export function mergeEarnings(primary: UpcomingEarnings[], backup: UpcomingEarnings[], alsoListed: Iterable<string> = []): UpcomingEarnings[] {
  const listed = new Set([...primary.map((e) => e.symbol), ...alsoListed])
  return [...primary, ...backup.filter((e) => !listed.has(e.symbol))]
    .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
}

/** Each symbol's first expected report on or after `today` (YYYY-MM-DD). */
export function nextEarningsBySymbol(events: UpcomingEarnings[], today: string): Map<string, UpcomingEarnings> {
  const out = new Map<string, UpcomingEarnings>()
  for (const e of events) {
    if (e.date < today) continue
    const cur = out.get(e.symbol)
    if (!cur || e.date < cur.date) out.set(e.symbol, e)
  }
  return out
}

/** How far ahead the next-date lookup looks: companies report quarterly, and Alpha Vantage's free list covers three months. */
export const EARNINGS_LOOK_AHEAD_DAYS = 90

/**
 * The stretch from today over which "FMP lists this company" is decided, whatever range a page
 * shows: Alpha Vantage's whole reach, three calendar months, which is never more than 92 days.
 */
export const EARNINGS_LISTED_WINDOW_DAYS = 92



/** A watchlist marks a stock whose next report falls within this many days. */
export const EARNINGS_SOON_DAYS = 14


/** Whole days from `today` to `date`, both YYYY-MM-DD. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function isEarningsSoon(e: Pick<UpcomingEarnings, 'date'>, today: string, days = EARNINGS_SOON_DAYS): boolean {
  const d = daysUntil(e.date, today)
  return d >= 0 && d <= days
}

export const EARNINGS_SOURCE_NAMES: Record<EarningsSource, string> = {
  fmp: 'Financial Modeling Prep',
  'alpha-vantage': 'Alpha Vantage',
}

/** How one source answered, as lib/server/earningsCalendar.ts reports it. */
export interface EarningsSourceAnswer {
  configured: boolean
  ok: boolean
  detail?: string
}

/**
 * When a configured calendar failed while another answered, the sentence that says which dates may
 * be missing; otherwise null (code audit 2026-11-09, D214). On the owner's run Alpha Vantage listed
 * 1,873 dates and FMP 63, so a failed Alpha Vantage with FMP answering left most stocks with no
 * date, each described as not yet announced. A page shows this sentence beside a stock with no date.
 */
export function earningsGap(sources: Record<EarningsSource, EarningsSourceAnswer>): string | null {
  const answered = (Object.keys(sources) as EarningsSource[]).filter((s) => sources[s].ok)
  const failed = (Object.keys(sources) as EarningsSource[]).filter((s) => sources[s].configured && !sources[s].ok)
  if (answered.length === 0 || failed.length === 0) return null
  const names = failed.map((s) => EARNINGS_SOURCE_NAMES[s])
  return `${names.join(' and ')}’s earnings calendar could not be read right now, so a date only it lists may be missing.`
}

/** "before the market opens", "after the market closes", or null when the source does not say. */
export function earningsTimeLabel(time: EarningsTime | null): string | null {
  return time === 'pre-market' ? 'before the market opens' : time === 'post-market' ? 'after the market closes' : null
}

/** Ticker symbols worth asking about: upper-cased, deduplicated, shaped like a ticker, at most `max`. */
export function cleanSymbols(raw: string, max: number): string[] {
  const out: string[] = []
  for (const s of raw.split(',')) {
    const sym = s.trim().toUpperCase()
    if (SYMBOL.test(sym) && !out.includes(sym)) out.push(sym)
    if (out.length >= max) break
  }
  return out
}
