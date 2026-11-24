// ─────────────────────────────────────────────────────────────────────────────
// LISTED STOCK → CUSIP, DERIVED FROM FILINGS (T-471, owner request,
// 2026-11-24; widened the same day from the 79-stock catalog to every NYSE &
// Nasdaq common stock the SEC exchange list carries — the app's searchable
// universe, T-450). The 13F tables and the funds' N-PORT holdings are keyed by
// CUSIP, and nothing keyless publishes a ticker→CUSIP table (CUSIPs are
// licensed data as a *database*; individual identifiers appear throughout
// public SEC filings). Measured before writing: NO N-PORT filer populates the
// ticker field (0 of 506 VOO equity rows, 0 of 102 QQQ rows), while CUSIP
// coverage is ~100% and independent filers agree exactly (Apple 037833100 in
// both). So the map is DERIVED from the filings the build already reads,
// under rules strict enough that a wrong identifier cannot slip through —
// the COINMETRICS_ASSETS / D190 posture: derived with checks, pinned in the
// generated file for review, never a runtime name match.
//
// A ticker resolves only when ALL of these hold:
//  1. The holding row's name and the company's name have the same CORE: the
//     words left after normalizing and stripping trailing corporate suffixes
//     (Inc, Corp, Co/The, Class B…). Equality, never a prefix — a prefix is
//     exactly how "Apple" took Apple Hospitality REIT's CUSIP on the first
//     trial run (measured 2026-11-24). The company name the build passes in
//     is the SEC's own registrant title for the ticker (company_tickers.json,
//     via fetchTickerCikMap), not the catalog's display name, so filers'
//     near-legal names ("International Business Machines Corp") line up with
//     it; the catalog name is only the fallback for a ticker the SEC map
//     lacks. For a multi-class listing the row must also carry the symbol's
//     class words (classWordFor: the ticker's own dash suffix — BRK-B is
//     "class b" — else the hand map for dashless pairs), or it is not a
//     candidate.
//  2. The same CUSIP appears under at least two DIFFERENT issuers' filings
//     (fund families file independently; agreement across families is the
//     check a single filer cannot fake by accident).
//  3. Those two families' rows imply a CONSISTENT per-share price
//     (valueUsd / balance): only families with a row within 35% of the
//     median implied price count toward rule 2. Two different companies'
//     rows that happened to name-match would not price-match — and counting
//     toward the median, instead of letting any one row veto, keeps a single
//     filer's unit error from sinking a CUSIP fifty clean rows support
//     (the first full run lost MSFT, GOOGL and TSLA exactly that way,
//     measured 2026-11-24).
//  4. Exactly one CUSIP survives for the ticker. Two survivors (an
//     undisambiguated multi-class company) resolve to NOTHING, with the
//     reason recorded — unresolved and said is better than resolved wrong.
// ─────────────────────────────────────────────────────────────────────────────

export interface HoldingForCusip {
  /** The filer family (the catalog fund's issuer), the independence unit. */
  family: string
  /** The filing's report date (asOf), for same-date price agreement. */
  asOf: string
  name: string
  cusip: string
  balance: number | null
  valueUsd: number | null
}

/**
 * Class words for DASHLESS multi-class listings, where the ticker itself does
 * not say the class. Hand-kept, only pairs whose class assignment is beyond
 * doubt — a wrong word here would make the 13F-title pass bind the symbol to
 * its sibling's identifier, so nothing is inferred (HEICO's dashless HEI is
 * the voting common, NOT "Class A", which is exactly why no "dashless means
 * Class A" rule exists). A dash-suffixed symbol needs no entry: the suffix IS
 * the class (BRK-B → "class b"), read by classWordFor.
 */
export const CLASS_WORDS: Record<string, string> = {
  GOOGL: 'class a',
  GOOG: 'class c',
  FOXA: 'class a',
  FOX: 'class b',
  NWSA: 'class a',
  NWS: 'class b',
}

/**
 * The class words a symbol's holding rows must carry, or null for a
 * single-class (or unknown-class) listing. The share-class convention puts
 * the class letter after a dash (BRK-B, HEI-A, LEN-B), the same dash form the
 * SEC exchange list and the catalog both use.
 */
export function classWordFor(symbol: string): string | null {
  const hand = CLASS_WORDS[symbol]
  if (hand) return hand
  const m = /-([A-Za-z])$/.exec(symbol)
  return m ? `class ${m[1].toLowerCase()}` : null
}

// Hyphens are stripped because filers disagree on them (Coca-Cola / COCA COLA);
// apostrophes are REMOVED, not spaced, because the SEC writes "LOWES" where a
// filer writes "Lowe's"; a trailing state-of-incorporation tag is cut because
// SEC titles carry one ("WELLS FARGO & COMPANY/MN", "AMERICAN TOWER CORP /MA/")
// and filers never do; and "CL" is read as "CLASS" because filers abbreviate
// it ("BERKSHIRE HATHAWAY INC CL B").
const normalize = (s: string): string =>
  s.toLowerCase()
    .replace(/\/\s*[a-z]{2,3}\s*\/?\s*$/i, ' ')
    .replace(/['’]/g, '')
    .replace(/[.,()&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bcl\b/g, 'class')

/**
 * Words that are corporate dressing, not identity: stripped from the END of a
 * normalized name to get its core. Only suffixes — a substantive word such as
 * "International" or "Group" is identity ("Honeywell International" must not
 * collapse onto some other "Honeywell").
 */
const TRAILERS = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'cos', 'company',
  'companies', 'plc', 'ltd', 'limited', 'llc', 'lp', 'sa', 'nv', 'se', 'ag',
  'adr', 'the', 'class', 'a', 'b', 'c', 'com', 'common', 'stock', 'shs',
  'shares', 'ord', 'ordinary', 'new', 'de', 'del',
])

function coreOf(name: string): string {
  const words = normalize(name).split(' ')
  while (words.length > 1 && TRAILERS.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

/** Rule 1: the two names share a core — equal, never a prefix. */
export function nameMatches(companyName: string, holdingName: string): boolean {
  const company = coreOf(companyName)
  return company !== '' && company === coreOf(holdingName)
}

const CUSIP_RE = /^[0-9A-Z]{9}$/

export interface ListedStock {
  symbol: string
  name: string
  /** How many of the company's tickers the SEC exchange list carries. */
  shareClasses: number
}

export interface ResolvedCusip {
  cusip: string
  /** The independent fund families whose price-consistent rows carry it (can be empty on a pure-13F resolution). */
  families: string[]
  via: 'fund-names' | 'fund+13f-names' | '13f-names' | 'sibling-elimination'
}

export interface WideResolution {
  resolved: Map<string, ResolvedCusip>
  unresolved: Array<{ symbol: string; reason: string }>
}

/**
 * The whole resolution, one stock at a time, from BOTH filing sources:
 *  - the catalog funds' N-PORT rows (two price-consistent independent
 *    families carry a CUSIP on their own);
 *  - the 13F set's own issuer names (at least MIN_F13_NAME_ROWS independent
 *    managers dominantly naming the company carry it on their own, or
 *    corroborate a single fund family);
 * with class words filtering both sides, the 13F titles saying what each
 * fund-less line IS (its class words, or the common line — a company's
 * preferred and unit lines carry its name too), one-CUSIP-one-listing
 * enforced at the end, and — after every symbol has had its turn — sibling
 * elimination for a classless listing of a multi-class company. Anything
 * short of one supported survivor resolves to nothing, with the reason.
 */
export function resolveListed(
  stocks: readonly ListedStock[],
  holdings: readonly HoldingForCusip[],
  f13: F13Evidence,
): WideResolution {
  const resolved = new Map<string, ResolvedCusip>()
  const unresolved: WideResolution['unresolved'] = []

  // Indexes, so a universe of thousands of listings stays O(rows + symbols):
  // holding rows by their name's core, and each core's class-worded symbols
  // (for the sibling-claim rule below).
  const rowsByCore = new Map<string, HoldingForCusip[]>()
  for (const h of holdings) {
    if (!CUSIP_RE.test(h.cusip)) continue
    const core = coreOf(h.name)
    const list = rowsByCore.get(core) ?? []
    list.push(h)
    rowsByCore.set(core, list)
  }
  const classWordsByCore = new Map<string, Array<{ symbol: string; word: string }>>()
  for (const stock of stocks) {
    const word = classWordFor(stock.symbol)
    if (!word) continue
    const core = coreOf(stock.name)
    const list = classWordsByCore.get(core) ?? []
    list.push({ symbol: stock.symbol, word })
    classWordsByCore.set(core, list)
  }
  // The 13F side, by the core of each CUSIP's dominant issuer name.
  const f13ByCore = new Map<string, string[]>()
  for (const [cusip, ev] of f13) {
    if (!CUSIP_RE.test(cusip)) continue
    const d = dominantOf(ev.names)
    if (!d || d.count < MIN_F13_NAME_ROWS) continue
    const core = coreOf(d.value)
    if (core === '') continue
    const list = f13ByCore.get(core) ?? []
    list.push(cusip)
    f13ByCore.set(core, list)
  }

  // Deferred decisions for the elimination phase: a classless listing of a
  // multi-class company whose candidates stayed ambiguous.
  const deferred = new Map<string, Array<{ cusip: string; families: string[] }>>()

  for (const stock of stocks) {
    const classWord = classWordFor(stock.symbol)
    const core = coreOf(stock.name)
    const coreRows = core === '' ? [] : rowsByCore.get(core) ?? []
    const siblings = classWordsByCore.get(core) ?? []

    // Fund-filing candidate rows: same name core, and the class rule — a
    // class-worded symbol's rows must carry its class words; a classless
    // symbol must NOT take a row carrying a class some OTHER symbol of the
    // same company claims (Alphabet Class C is not "GOOGL"; "Meta Platforms
    // Inc Class A" is fine for META, with no class-worded sibling listed).
    const rows = coreRows.filter((h) => {
      const name = normalize(h.name)
      if (classWord) return name.includes(classWord)
      return !siblings.some((s) => s.symbol !== stock.symbol && name.includes(s.word))
    })
    const byCusip = new Map<string, HoldingForCusip[]>()
    for (const r of rows) {
      const list = byCusip.get(r.cusip) ?? []
      list.push(r)
      byCusip.set(r.cusip, list)
    }

    // Candidates from either source.
    const candidates = new Set<string>(byCusip.keys())
    for (const cusip of core === '' ? [] : f13ByCore.get(core) ?? []) candidates.add(cusip)
    if (candidates.size === 0) {
      unresolved.push({ symbol: stock.symbol, reason: 'no filing names the company' })
      continue
    }

    // Support per candidate. No veto on a MISMATCHING 13F name: 13F filers
    // abbreviate by their own conventions ("TEXAS INSTRS INC", "DISNEY WALT
    // CO", "INTL BUSINESS MACHINES" — all measured), so a mismatch means
    // only that the 13F side stays silent, never that the fund families'
    // agreement is wrong.
    const survivors: Array<{ cusip: string; families: string[]; via: ResolvedCusip['via'] }> = []
    for (const cusip of candidates) {
      const ev = f13.get(cusip)
      const families = agreeingFamilies(byCusip.get(cusip) ?? [])
      const f13Named = ev !== undefined && f13NamesCompany(stock.name, ev)
      if (families.length >= 2) {
        survivors.push({ cusip, families, via: 'fund-names' })
      } else if (families.length >= 1 && f13Named) {
        survivors.push({ cusip, families, via: 'fund+13f-names' })
      } else if (f13Named && (classWord ? f13TitleCarries(classWord, ev!) : f13TitleIsCommon(ev!))) {
        // With no fund row to vouch for the line, the 13F title must say what
        // it is: the symbol's class words, or — for a classless listing —
        // the common line (the company's preferred/unit/note lines carry its
        // name too, and must never take a listing's figures).
        survivors.push({ cusip, families, via: '13f-names' })
      }
    }

    if (survivors.length === 1) {
      const s = survivors[0]
      resolved.set(stock.symbol, { cusip: s.cusip, families: s.families, via: s.via })
      continue
    }
    if (survivors.length === 0) {
      unresolved.push({ symbol: stock.symbol, reason: 'no CUSIP carried by two independent fund families, or by enough 13F filers naming the company, at consistent prices' })
      continue
    }
    // Several survivors. When exactly ONE is fund-backed, it wins: the fund
    // filings are dated this quarter and a fund can only hold the line that
    // trades today, while 13F rows keep carrying a company's RETIRED
    // identifier for years (BlackRock's and Linde's old CUSIPs both survived
    // the name and title checks, measured) — so a 13F-only sibling beside a
    // fund-held line is a stale spelling of the same stock, not a rival.
    const fundBacked = survivors.filter((s) => s.via === 'fund-names' || s.via === 'fund+13f-names')
    if (fundBacked.length === 1) {
      resolved.set(stock.symbol, { cusip: fundBacked[0].cusip, families: fundBacked[0].families, via: fundBacked[0].via })
      continue
    }
    // Otherwise: a class-worded symbol's survivors each carry class evidence
    // of their own, so two is a real conflict — refuse. A classless listing
    // of a multi-class company waits for elimination.
    if (!classWord && stock.shareClasses > 1) {
      deferred.set(stock.symbol, survivors.map((s) => ({ cusip: s.cusip, families: s.families })))
    }
    unresolved.push({ symbol: stock.symbol, reason: `ambiguous: ${survivors.length} CUSIPs survive the checks (${survivors.map((s) => s.cusip).join(', ')})` })
  }

  // Elimination phase: with every symbol decided, a deferred classless
  // listing of a multi-class company takes the one candidate its siblings
  // left — or stays unresolved.
  const taken = new Set([...resolved.values()].map((r) => r.cusip))
  for (const [symbol, candidates] of deferred) {
    const left = remainingCandidate(candidates, taken)
    if (!left) continue
    resolved.set(symbol, { cusip: left.cusip, families: left.families, via: 'sibling-elimination' })
    taken.add(left.cusip)
  }
  // One CUSIP is one security is one listing: two symbols resolving to the
  // SAME identifier means the rules could not tell their companies apart
  // (Blue Owl Capital Inc beside Blue Owl Capital Corp — different
  // registrants whose name cores collide once the corporate suffixes strip,
  // measured on the first unified run), so BOTH resolve to nothing rather
  // than one of them wearing the other's figures.
  const bySettled = new Map<string, string[]>()
  for (const [symbol, r] of resolved) {
    const list = bySettled.get(r.cusip) ?? []
    list.push(symbol)
    bySettled.set(r.cusip, list)
  }
  for (const [cusip, symbols] of bySettled) {
    if (symbols.length < 2) continue
    const label = [...symbols].sort().join(' and ')
    for (const symbol of symbols) {
      resolved.delete(symbol)
      unresolved.push({ symbol, reason: `listings ${label} both claimed ${cusip} — the filings cannot tell their companies apart` })
    }
  }

  const stillUnresolved = unresolved.filter((u) => !resolved.has(u.symbol))
  return { resolved, unresolved: stillUnresolved }
}

// ── The 13F set as an identity source of its own ─────────────────────────────
// Measured on the first wide run (2026-11-24): the catalog funds hold 4,495
// listed CUSIPs but only 2,762 with TWO fund families, and ~1,200 listed
// stocks sit in no catalog fund at all — the two-family rule alone covers
// barely half the exchange list. The 13F set carries the same grade of
// evidence for the rest: every manager's row NAMES the issuer
// (NAMEOFISSUER), and managers are independent filers of their own reports —
// five of them naming the same company for a CUSIP is the two-independent-
// filers standard met five times over. So a CUSIP's identity can rest on the
// fund filings, on the 13F filers, or on each corroborating the other; the
// refusal rules (core-equality, class words, price bands, ambiguity refuses)
// stay the same whichever filings speak.

export interface F13CusipEvidence {
  /** Distinct managers whose effective filings carry the CUSIP (SH rows). */
  holderCount: number
  /** NAMEOFISSUER spellings by row count. */
  names: ReadonlyMap<string, number>
  /** TITLEOFCLASS spellings by row count. */
  titles: ReadonlyMap<string, number>
  /** Value-weighted per-share price across all rows (whole dollars / shares). */
  avgPrice: number | null
}

export type F13Evidence = ReadonlyMap<string, F13CusipEvidence>

/** How many independent 13F filers must name the company for the 13F set to carry a CUSIP's identity alone. */
export const MIN_F13_NAME_ROWS = 5

const dominantOf = (tally: ReadonlyMap<string, number>): { value: string; count: number; total: number } | null => {
  let value: string | null = null
  let count = 0
  let total = 0
  for (const [v, n] of tally) {
    total += n
    if (n > count) { value = v; count = n }
  }
  return value === null ? null : { value, count, total }
}

/** Whether the 13F set's dominant issuer name for the CUSIP is this company's. */
export function f13NamesCompany(companyName: string, ev: F13CusipEvidence): boolean {
  const d = dominantOf(ev.names)
  return d !== null && d.count >= MIN_F13_NAME_ROWS && nameMatches(companyName, d.value)
}

/** Whether the 13F set's dominant class title for the CUSIP carries the class words. */
export function f13TitleCarries(classWord: string, ev: F13CusipEvidence): boolean {
  const d = dominantOf(ev.titles)
  return d !== null && d.total >= MIN_F13_NAME_ROWS && normalize(d.value).includes(classWord)
}

// A company's 13F rows cover every security it issued — its preferred lines,
// units, notes and warrants all carry the company's name (NextEra showed FOUR
// name-matched CUSIPs on the first unified run, titles "UNIT" and "PFD"
// among them). So the 13F set may carry a CLASSLESS listing's identity only
// when the dominant class title reads as the common line. ADS/ADR stays
// allowed: for a foreign company, the US-listed line IS the depositary share.
const COMMON_TITLE_WORDS = new Set(['com', 'common', 'stock', 'shs', 'share', 'shares', 'ord', 'ordinary', 'class', 'cl', 'a', 'b', 'c', 'adr', 'ads', 'adss', 'sponsored', 'spon', 'new', 'inc', 'ltd', 'rep', 'repstg', 'each'])
const NOT_COMMON_TITLE_WORDS = new Set(['pfd', 'pf', 'pref', 'preferred', 'unit', 'units', 'ut', 'uts', 'nt', 'nts', 'note', 'notes', 'deb', 'debs', 'debenture', 'debentures', 'bd', 'bds', 'bond', 'bonds', 'wt', 'wts', 'warrant', 'warrants', 'right', 'rights', 'rt', 'rts'])

/** Whether the CUSIP's dominant 13F class title reads as the common stock line. */
export function f13TitleIsCommon(ev: F13CusipEvidence): boolean {
  const d = dominantOf(ev.titles)
  if (d === null || d.total < MIN_F13_NAME_ROWS) return false
  const words = normalize(d.value).split(' ').filter(Boolean)
  if (words.length === 0) return false
  if (words.some((w) => NOT_COMMON_TITLE_WORDS.has(w))) return false
  return words.some((w) => COMMON_TITLE_WORDS.has(w))
}

/**
 * Third pass, for a CLASSLESS listing of a company the SEC exchange list
 * shows with SEVERAL listed classes (HEICO's HEI beside HEI-A): once every
 * sibling's identifier is taken, exactly one surviving candidate left is this
 * listing's — deduction from the SEC's own listing count, never a guess, and
 * only for a multi-class company, so two different companies that happened to
 * share a name core can never cross-assign. Anything but exactly one left
 * resolves to nothing.
 */
export function remainingCandidate(
  candidates: ReadonlyArray<{ cusip: string; families: string[] }>,
  taken: ReadonlySet<string>,
): { cusip: string; families: string[] } | null {
  const left = candidates.filter((c) => !taken.has(c.cusip))
  return left.length === 1 ? left[0] : null
}

/**
 * Rule 3: the families whose rows imply a price CONSISTENT with the rest of
 * the CUSIP's rows. The median implied price anchors the band — so one
 * filer's unit error can never veto a CUSIP every other filer agrees on, and
 * a lone family whose price stands apart from the median simply does not
 * count. A row with no usable price and value counts no family at all.
 * The band is wide (35%) because filings' as-of dates span a quarter.
 */
export const PRICE_BAND = 0.35

export function agreeingFamilies(rows: readonly HoldingForCusip[]): string[] {
  const priced = rows
    .filter((r) => r.balance != null && r.balance > 0 && r.valueUsd != null && r.valueUsd > 0)
    .map((r) => ({ family: r.family, price: (r.valueUsd as number) / (r.balance as number) }))
  if (priced.length === 0) return []
  const sorted = priced.map((p) => p.price).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const families = new Set<string>()
  for (const p of priced) {
    if (Math.abs(p.price / median - 1) <= PRICE_BAND) families.add(p.family)
  }
  return [...families].sort()
}
