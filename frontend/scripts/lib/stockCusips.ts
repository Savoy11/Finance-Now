// ─────────────────────────────────────────────────────────────────────────────
// CATALOG STOCK → CUSIP, DERIVED FROM FILINGS (T-471, owner request,
// 2026-11-24). The 13F tables and the funds' N-PORT holdings are keyed by
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
//     lacks. For the catalog's multi-class companies the row must also carry
//     that symbol's class words (CLASS_WORDS), or it is not a candidate.
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

export interface CusipResolution {
  resolved: Map<string, { cusip: string; families: string[] }>
  unresolved: Array<{ symbol: string; reason: string }>
}

/**
 * The catalog's multi-class companies: the holding row must carry the class
 * words for the symbol, so Alphabet's two listings and Berkshire's B shares
 * can never take each other's identifier. A catalog symbol with a dash is
 * also required to appear here — a new class-share listing fails the build
 * until someone writes its class down.
 */
export const CLASS_WORDS: Record<string, string> = {
  'BRK-B': 'class b',
  GOOGL: 'class a',
  GOOG: 'class c',
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

export function resolveCusips(
  catalog: ReadonlyArray<{ symbol: string; name: string }>,
  holdings: readonly HoldingForCusip[],
): CusipResolution {
  const resolved = new Map<string, { cusip: string; families: string[] }>()
  const unresolved: CusipResolution['unresolved'] = []

  for (const stock of catalog) {
    const classWord = CLASS_WORDS[stock.symbol]
    if (stock.symbol.includes('-') && !classWord) {
      unresolved.push({ symbol: stock.symbol, reason: 'a class-share symbol with no CLASS_WORDS entry — write its class down before it can resolve' })
      continue
    }

    // Candidate rows: name match, class rule, a well-formed CUSIP.
    const rows = holdings.filter((h) =>
      CUSIP_RE.test(h.cusip)
      && nameMatches(stock.name, h.name)
      && (classWord ? normalize(h.name).includes(classWord) : true)
      // A classless catalog symbol must NOT take a row that names a class some
      // OTHER catalog symbol of the SAME company claims (Alphabet Class C is
      // not "GOOGL"). Same company only: "Meta Platforms Inc Class A" is fine
      // for META — no other catalog symbol names Meta, so GOOGL's "class a"
      // claim does not reach it.
      && (classWord ? true : !claimedByAnotherSymbol(catalog, stock.symbol, h.name))
    )
    if (rows.length === 0) {
      unresolved.push({ symbol: stock.symbol, reason: 'no filing row names the company' })
      continue
    }

    // Group by CUSIP; a CUSIP counts only with two independent families.
    const byCusip = new Map<string, HoldingForCusip[]>()
    for (const r of rows) {
      const list = byCusip.get(r.cusip) ?? []
      list.push(r)
      byCusip.set(r.cusip, list)
    }
    const survivors: Array<{ cusip: string; families: string[] }> = []
    for (const [cusip, list] of byCusip) {
      const families = agreeingFamilies(list)
      if (families.length < 2) continue
      survivors.push({ cusip, families })
    }

    if (survivors.length === 1) {
      resolved.set(stock.symbol, survivors[0])
    } else if (survivors.length === 0) {
      unresolved.push({ symbol: stock.symbol, reason: 'no CUSIP carried by two independent fund families with agreeing per-share prices' })
    } else {
      unresolved.push({ symbol: stock.symbol, reason: `ambiguous: ${survivors.length} CUSIPs survive the checks (${survivors.map((s) => s.cusip).join(', ')})` })
    }
  }
  return { resolved, unresolved }
}

// ── Second pass: class shares the fund filings cannot separate ───────────────
// Measured on the full run (2026-11-24): filers name BOTH Berkshire lines
// "Berkshire Hathaway Inc" (one at ~$500, one at ~$749,000) and both Alphabet
// lines "Alphabet Inc", so a class-worded symbol can fail pass 1 with every
// check otherwise green. The 13F data set's own TITLEOFCLASS column separates
// them ("COM CL A" / "COM CL B") — filed data, so deciding by it is reading,
// not guessing. The build collects each candidate CUSIP's 13F class titles
// while streaming, and cusipForClassByTitles picks the one whose DOMINANT
// title carries the symbol's class words, refusing anything short of that.

/**
 * The CUSIPs that could be this company's, by name core + two independent
 * families + consistent prices, IGNORING class words — pass 2's candidates.
 */
export function classCandidateCusips(
  stock: { symbol: string; name: string },
  holdings: readonly HoldingForCusip[],
): Array<{ cusip: string; families: string[] }> {
  const byCusip = new Map<string, HoldingForCusip[]>()
  for (const h of holdings) {
    if (!CUSIP_RE.test(h.cusip) || !nameMatches(stock.name, h.name)) continue
    const list = byCusip.get(h.cusip) ?? []
    list.push(h)
    byCusip.set(h.cusip, list)
  }
  const out: Array<{ cusip: string; families: string[] }> = []
  for (const [cusip, list] of byCusip) {
    const families = agreeingFamilies(list)
    if (families.length >= 2) out.push({ cusip, families })
  }
  return out
}

/** A candidate's class titles as the 13F set reports them, by count. */
export type ClassTitleTally = ReadonlyMap<string, ReadonlyMap<string, number>>

const MIN_TITLE_ROWS = 3

/**
 * The one candidate whose dominant 13F class title carries the class words —
 * null unless exactly one does and no other candidate's dominant title does.
 */
export function cusipForClassByTitles(
  classWord: string,
  candidates: ReadonlyArray<{ cusip: string }>,
  tallies: ClassTitleTally,
): string | null {
  const matches: string[] = []
  for (const { cusip } of candidates) {
    const tally = tallies.get(cusip)
    if (!tally) continue
    let total = 0
    let dominant: string | null = null
    let dominantCount = 0
    for (const [title, count] of tally) {
      total += count
      if (count > dominantCount) { dominant = title; dominantCount = count }
    }
    if (total < MIN_TITLE_ROWS || dominant === null) continue
    if (normalize(dominant).includes(classWord)) matches.push(cusip)
  }
  return matches.length === 1 ? matches[0] : null
}

function claimedByAnotherSymbol(
  catalog: ReadonlyArray<{ symbol: string; name: string }>,
  symbol: string,
  holdingName: string,
): boolean {
  for (const [sym, word] of Object.entries(CLASS_WORDS)) {
    if (sym === symbol) continue
    const other = catalog.find((c) => c.symbol === sym)
    if (!other) continue
    if (nameMatches(other.name, holdingName) && normalize(holdingName).includes(word)) return true
  }
  return false
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
