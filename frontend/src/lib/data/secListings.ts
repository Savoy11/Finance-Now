// ─── The Stock Registry's wider list: every NYSE and Nasdaq stock the SEC names (T-450) ──
//
// On the free FMP key the registry is the 79-name curated catalog: FMP's company
// screener is paid-only (T-076, parked for launch). The SEC publishes, free and with
// no key, every company with a ticker and the exchange each ticker trades on
// (company_tickers_exchange.json, on the host the app already reads), and the
// app's per-share reader already covers every SEC filer in a fixed handful of
// requests. This is the wider list built from those two, the rules for which
// listings count, and the rules for screening it. Pure; the server passes the
// file in.
//
// Which listings count (owner, D205): NYSE and Nasdaq common stock only. The
// file names each ticker's exchange, which removes over-the-counter names. Three
// more rules remove what is not a company's common stock, each counted so the
// page can say how many it left out:
//   · a ticker of another shape (a preferred series like "JPM-PD", a warrant
//     "-WT", a unit "-UN") — only a plain ticker, or one with a single class
//     letter after a dash like "BRK-B", is common stock, and a single "-P",
//     "-R", "-U" or "-W" is a preferred share, right, unit or warrant ("ETI-P");
//   · a five-letter ticker that is another of the same company's tickers plus
//     one letter, unless that letter is one Nasdaq uses for a class of common
//     stock (A, B, C, K): "AGNCP", "AGNCZ" and "ACQRW" beside "AGNC" and
//     "ACQR" are preferred shares, notes and warrants. GOOGL, an L, is common
//     stock and stays as a curated stock; a few preferred classes lettered A or
//     B may remain;
//   · a later ticker of a company whose first listed ticker is a different
//     stock: banks and other issuers list notes and exchange-traded notes under
//     their own company number (JPMorgan's AMJB and VYLD beside JPM, Bank of
//     Montreal's leveraged notes beside BMO, Southern Co's SOJC beside SO). A
//     later ticker stays only as a class of the first: the same letters with a
//     class letter after a dash (BRK-A beside BRK-B), one letter fewer (GOOG
//     beside GOOGL, FOX beside FOXA), one class letter more on Nasdaq (LILAK
//     beside LILA) or a different class letter (LBRDA beside LBRDK). On the
//     NYSE a class is written with a dash, and one letter more is a note:
//     Duke's DUKB, Sempra's SREA. The SEC's file puts a company's main ticker
//     first; a company with tracking stocks of unrelated letters keeps only the
//     first, and Wiley's class B, written WLYB on the NYSE, is left out.
//
// Measured on the SEC's ticker list as the app had it on 2026-11-06 (10,409
// tickers, read from the app's own cache): single letters after a dash were A,
// B, C, V and P, the P ones preferred (ETI-P, TY-P, TFIN-P); two letters started
// with P, W, U or R in every case; and the fifth letters beside a four-letter
// sibling ran from W (346) and U (240) to a long tail of notes and preferred
// series (Z, L, G, I, H…), with A, B and K mostly classes of common stock.
//   · a fund or exchange-traded trust: a ticker the app already knows is a fund
//     (its fund catalog, or the SEC fund filings it reads), or a name that says
//     ETF, ETN or Fund. Closed-end funds and commodity trusts file like
//     companies, so a few without those words may remain; the page says so.
//
// What the list cannot do, stated on the page: every price-based figure (price,
// market cap, P/E, yield) needs a live quote, and only the rows on screen have
// one, so sorting or screening on those over the whole list is refused (the rule
// set when fund return screening was switched off). Sorts and screens on the SEC
// figures (earnings and dividends per share, shares outstanding) cover every
// stock. A sector is known only for the curated 79: the SEC's industry code
// needs one request per company.

/** The exchanges whose listings the wider list keeps (owner, D205). */
export const LISTED_EXCHANGES = ['NYSE', 'Nasdaq'] as const
export type ListedExchange = typeof LISTED_EXCHANGES[number]

/** One row of the SEC's company_tickers_exchange.json. */
export interface SecExchangeRow {
  cik: number
  name: string
  ticker: string
  /** As the SEC writes it: "NYSE", "Nasdaq", "OTC", "CBOE", or null. */
  exchange: string | null
}

/** Why a row of the SEC's file is not in the wider list. */
export type LeftOutReason = 'other-exchange' | 'not-common' | 'fund'

export const LEFT_OUT_LABELS: Record<LeftOutReason, string> = {
  'other-exchange': 'listed elsewhere or over the counter',
  'not-common': 'preferred shares, warrants, units or rights',
  fund: 'funds and exchange-traded trusts',
}

export interface SecListing {
  symbol: string
  name: string
  exchange: ListedExchange
  cik: number
  /** How many of the company's tickers made the list: more than one is a company with several share classes. */
  shareClasses: number
}

export interface ListingSelection {
  listings: SecListing[]
  leftOut: Record<LeftOutReason, number>
}

/**
 * The SEC's file is `{ fields: ["cik","name","ticker","exchange"], data: [[…], …] }`. Columns
 * are found by name, so a reordering does not shift them; a file without the four is refused
 * (null) rather than read by position.
 */
export function parseExchangeFile(json: unknown): SecExchangeRow[] | null {
  if (!json || typeof json !== 'object') return null
  const { fields, data } = json as { fields?: unknown; data?: unknown }
  if (!Array.isArray(fields) || !Array.isArray(data)) return null
  const at = (name: string) => fields.findIndex((f) => typeof f === 'string' && f.toLowerCase() === name)
  const iCik = at('cik'), iName = at('name'), iTicker = at('ticker'), iExchange = at('exchange')
  if (iCik < 0 || iName < 0 || iTicker < 0 || iExchange < 0) return null
  const rows: SecExchangeRow[] = []
  for (const r of data) {
    if (!Array.isArray(r)) continue
    const cik = Number(r[iCik])
    const ticker = typeof r[iTicker] === 'string' ? r[iTicker].trim() : ''
    if (!Number.isInteger(cik) || cik <= 0 || !ticker) continue
    rows.push({
      cik,
      name: typeof r[iName] === 'string' ? r[iName].trim() : ticker,
      ticker,
      exchange: typeof r[iExchange] === 'string' && r[iExchange].trim() ? r[iExchange].trim() : null,
    })
  }
  return rows
}

/** "NYSE" / "Nasdaq" for those two exchanges, written any way; null for every other. */
export function listedExchange(raw: string | null | undefined): ListedExchange | null {
  const v = (raw ?? '').trim().toLowerCase()
  return v === 'nyse' ? 'NYSE' : v === 'nasdaq' ? 'Nasdaq' : null
}

/** The app's ticker form: upper case, a class letter after a dash ("BRK.B" → "BRK-B"). */
export const normalizeTicker = (t: string): string => t.trim().toUpperCase().replace(/[./]/g, '-')

/** A plain ticker, or one class letter after a dash other than P, R, U or W. */
const COMMON_SHAPE = /^[A-Z]{1,5}(-[A-OQSTVXYZ])?$/

/**
 * The fifth letters that can mark a class of common stock beside a four-letter sibling
 * (Nasdaq's A and B for classes, C, and K for non-voting shares). Every other letter beside
 * a sibling is a preferred share, a note, a right, a unit or a warrant.
 */
export const COMMON_CLASS_FIFTH_LETTERS = 'ABCK'

const CLASS_LETTERS = 'ABCK'

/** A ticker with any class letter after a dash taken off: "BRK-B" → "BRK". */
const stemOf = (t: string): string => t.replace(/-[A-Z]$/, '')

/**
 * Whether `later`, listed on `exchange`, is a class of the same stock as `first`, the company's
 * first listed ticker: see the rule above. Both in the app's form.
 */
export function isClassOf(later: string, first: string, exchange: ListedExchange): boolean {
  const a = stemOf(later), b = stemOf(first)
  if (a === b) return true
  if (b.length === a.length + 1 && b.startsWith(a)) return true                                   // GOOG beside GOOGL
  if (a.length === b.length + 1 && a.startsWith(b)) {                                             // LILAK beside LILA
    return exchange === 'Nasdaq' && !later.includes('-') && CLASS_LETTERS.includes(a[a.length - 1])
  }
  return a.length === b.length && a.length >= 4 && a.slice(0, -1) === b.slice(0, -1) &&
    CLASS_LETTERS.includes(a[a.length - 1]) && CLASS_LETTERS.includes(b[b.length - 1])           // LBRDA beside LBRDK
}

/** A name that says the listing is a fund: ETF, ETN or Fund as a word, or "exchange-traded". */
export function looksLikeFundName(name: string): boolean {
  return /\b(ETFs?|ETNs?|Fund)\b/i.test(name) || /exchange[- ]traded/i.test(name)
}

/**
 * The SEC's rows narrowed to NYSE and Nasdaq common stock, in the file's own order, one row
 * per ticker. `isFund` says whether a ticker is one the app knows as a fund; `keep` names
 * tickers kept whatever the rules say (the curated catalog: hand-checked common stocks).
 */
export function selectCommonListings(
  rows: readonly SecExchangeRow[],
  isFund: (symbol: string, name: string) => boolean,
  keep: (symbol: string) => boolean = () => false,
): ListingSelection {
  const leftOut: Record<LeftOutReason, number> = { 'other-exchange': 0, 'not-common': 0, fund: 0 }

  // Every company's listed tickers, for the sibling rule, and its first listed ticker.
  const tickersByCik = new Map<number, Set<string>>()
  const firstByCik = new Map<number, string>()
  for (const r of rows) {
    if (!listedExchange(r.exchange)) continue
    const t = normalizeTicker(r.ticker)
    const set = tickersByCik.get(r.cik) ?? new Set<string>()
    set.add(t)
    tickersByCik.set(r.cik, set)
    if (!firstByCik.has(r.cik)) firstByCik.set(r.cik, t)
  }

  const kept: Array<Omit<SecListing, 'shareClasses'>> = []
  const seen = new Set<string>()
  for (const r of rows) {
    const symbol = normalizeTicker(r.ticker)
    if (seen.has(symbol)) continue
    seen.add(symbol)
    const exchange = listedExchange(r.exchange)
    if (!exchange) { leftOut['other-exchange']++; continue }
    if (!keep(symbol)) {
      const siblings = tickersByCik.get(r.cik) ?? new Set<string>()
      const first = firstByCik.get(r.cik) ?? symbol
      const derivative = !COMMON_SHAPE.test(symbol) || (
        symbol.length === 5 && !symbol.includes('-') &&
        !COMMON_CLASS_FIFTH_LETTERS.includes(symbol[4]) && siblings.has(symbol.slice(0, 4))
      ) || (symbol !== first && !isClassOf(symbol, first, exchange))
      if (derivative) { leftOut['not-common']++; continue }
      if (isFund(symbol, r.name) || looksLikeFundName(r.name)) { leftOut.fund++; continue }
    }
    kept.push({ symbol, name: r.name, exchange, cik: r.cik })
  }

  const classes = new Map<number, number>()
  for (const l of kept) classes.set(l.cik, (classes.get(l.cik) ?? 0) + 1)
  return { listings: kept.map((l) => ({ ...l, shareClasses: classes.get(l.cik) ?? 1 })), leftOut }
}

// ─── Screening the wider list ───────────────────────────────────────────────

/** What a wider-list row carries that the screen reads: the SEC figures only, never a price. */
export interface WideRow {
  symbol: string
  name: string
  exchange: string | null
  eps: number | null
  dividendsPerShare: number | null
  dividendState: 'paid' | 'none' | 'unknown'
  shares: { val: number } | null
}

/** The sorts that cover every stock: the SEC's list order, the ticker, and the SEC figures. */
export const WIDE_SORT_KEYS = ['list', 'symbol', 'eps', 'dps', 'shares'] as const
export type WideSortKey = typeof WIDE_SORT_KEYS[number]

export const isWideSortKey = (v: string): v is WideSortKey => (WIDE_SORT_KEYS as readonly string[]).includes(v)

/** Why the price-based columns are not sortable or screenable over the wider list. */
export const WHOLE_LIST_PRICE_REFUSAL =
  'Price, market cap, P/E and yield need a live quote, and only the stocks on screen have one, so they are not sorted or screened over the whole list: a sort or a screen that had seen fifty stocks would order them as though it had seen every one.'

export interface WideFilters {
  query: string
  exchange: 'all' | ListedExchange
  /** Earnings per share range (dollars); NaN = no bound. */
  epsMin: number
  epsMax: number
  /** Dividends per share range (dollars); a company paying none counts as 0, an unknown figure as none. */
  dpsMin: number
  dpsMax: number
  /** Shares outstanding range, in millions. */
  sharesMinM: number
  sharesMaxM: number
  payersOnly: boolean
  withEarningsOnly: boolean
}

export const NO_WIDE_FILTERS: WideFilters = {
  query: '', exchange: 'all',
  epsMin: NaN, epsMax: NaN, dpsMin: NaN, dpsMax: NaN, sharesMinM: NaN, sharesMaxM: NaN,
  payersOnly: false, withEarningsOnly: false,
}

/** Dividends per share as the screen reads it: the figure when paid, 0 when none, null when unknown. */
export function dividendForScreen(r: Pick<WideRow, 'dividendsPerShare' | 'dividendState'>): number | null {
  if (r.dividendState === 'paid') return r.dividendsPerShare
  return r.dividendState === 'none' ? 0 : null
}

const inRange = (v: number | null, lo: number, hi: number): boolean =>
  (!Number.isFinite(lo) || (v != null && v >= lo)) && (!Number.isFinite(hi) || (v != null && v <= hi))

export function filterWide<T extends WideRow>(rows: readonly T[], f: WideFilters): T[] {
  const q = f.query.trim().toLowerCase()
  return rows.filter((r) =>
    (!q || r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) &&
    (f.exchange === 'all' || r.exchange === f.exchange) &&
    (!f.withEarningsOnly || r.eps != null) &&
    (!f.payersOnly || r.dividendState === 'paid') &&
    inRange(r.eps, f.epsMin, f.epsMax) &&
    inRange(dividendForScreen(r), f.dpsMin, f.dpsMax) &&
    inRange(r.shares ? r.shares.val / 1e6 : null, f.sharesMinM, f.sharesMaxM))
}

/**
 * Sorted copy. `list` keeps the order given (the SEC's own); every other key sorts with a
 * missing figure last whichever way it runs, and ties keep the list order.
 */
export function sortWide<T extends WideRow>(rows: readonly T[], key: WideSortKey, asc: boolean): T[] {
  const indexed = rows.map((r, i) => ({ r, i }))
  if (key === 'list') return (asc ? indexed : [...indexed].reverse()).map((x) => x.r)
  const dir = asc ? 1 : -1
  const value = (r: T): number | string | null => {
    switch (key) {
      case 'symbol': return r.symbol
      case 'eps':    return r.eps
      case 'dps':    return dividendForScreen(r)
      default:       return r.shares?.val ?? null
    }
  }
  return indexed.sort((a, b) => {
    const va = value(a.r), vb = value(b.r)
    if (va == null || vb == null) return va == null && vb == null ? a.i - b.i : va == null ? 1 : -1
    const c = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number)
    return c !== 0 ? c * dir : a.i - b.i
  }).map((x) => x.r)
}

/**
 * The best `limit` matches for a search over a long list: an exact ticker first, then tickers
 * starting with the query, then names with a word starting with it, then any other match, each
 * group in the list's own order. Over thousands of stocks a plain "contains" fills the ten
 * slots with whatever comes first: "F" would list ten stocks before Ford.
 */
export function rankSearch<T extends { symbol: string; name: string }>(pool: readonly T[], query: string, limit = 10): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const groups: T[][] = [[], [], [], []]
  const wordStart = new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  for (const e of pool) {
    const sym = e.symbol.toLowerCase(), name = e.name.toLowerCase()
    if (sym === q) groups[0].push(e)
    else if (sym.startsWith(q)) groups[1].push(e)
    else if (wordStart.test(name)) groups[2].push(e)
    else if (sym.includes(q) || name.includes(q)) groups[3].push(e)
  }
  return groups.flat().slice(0, limit)
}
