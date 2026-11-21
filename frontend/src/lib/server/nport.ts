// SEC EDGAR N-PORT plumbing — the authoritative, keyless source for fund
// holdings. Every registered fund files form NPORT-P; the public filing
// discloses the complete portfolio (name, CUSIP/ISIN/ticker, shares, value,
// % of net assets) as of the last month of each fiscal quarter, ~60 days
// delayed. Free and definitive, unlike key-gated aggregator APIs.
//
// Flow: ticker → series id (company_tickers_mf.json) → NPORT-P filings for
// that series (browse-edgar atom) → primary_doc.xml → parsed holdings.

import { EDGAR_HEADERS } from './edgar'
import { decodeEntities } from '@/lib/utils/html'

export interface FundSeries {
  seriesId: string
  classId: string
}

export interface NportFilingRef {
  accession: string
  cik: string
  /** Filing date (the report period inside is ~2 months earlier). */
  filedAt: string
}

export interface NportHolding {
  /** Exchange ticker when disclosed; many debt instruments have none. */
  ticker: string | null
  name: string
  cusip: string | null
  isin: string | null
  /** Shares/units held (N-PORT "balance"). */
  balance: number | null
  /** Position value in USD. */
  valueUsd: number | null
  /** Percent of net assets (0–100). */
  pctVal: number | null
  /**
   * N-PORT `assetCat` code for the position — 'EC' (equity-common), 'EP'
   * (equity-preferred), 'DBT' (debt), 'STIV' (short-term investment vehicle),
   * 'RA' (repurchase agreement), 'DE' (derivative), and so on. Null when the
   * filer omits it, which happens on derivative blocks that carry the category
   * on a nested element instead.
   *
   * Added 2026-08-18 for NT9: this is the field the stock/bond/cash mix is
   * derived from, keylessly, from a filing the app already fetches.
   */
  assetCat: string | null
  /**
   * The issuer's country as the filer reports it (Item C.6, `invCountry`): an ISO 3166 two-letter
   * code, a company's home rather than where it sells. Null when the filer wrote "N/A" (swaps and
   * other derivatives do) or nothing. T-455.
   */
  country: string | null
  /**
   * The currency the holding is in (Item C.2.c): `<curCd>`, or for a holding outside US dollars
   * the `curCd` attribute of `<currencyConditional>`, which carries the exchange rate beside it.
   */
  currency: string | null
  /**
   * The kind of issuer (Item C.5): CORP, UST, USGA, USGSE, MUN, NUSS, PF, RF or OTHER, from
   * `<issuerCat>` or the `issuerCat` attribute of `<issuerConditional>`.
   */
  issuerCat: string | null
  /** A debt holding's maturity date (Item C.9.a, `debtSec`'s `maturityDt`), YYYY-MM-DD. */
  maturity: string | null
}

/**
 * One currency's interest-rate risk from N-PORT Item B.3.a: the change in the
 * fund's value, in US dollars, for a 1 basis point move in rates (DV01), summed
 * here across the five maturity buckets the form splits it into (3 months, 1,
 * 5, 10 and 30 years). Filed only by funds whose debt is at least 25% of net
 * assets. Filers disagree on the sign — iShares reports it positive, Vanguard
 * negative — so nothing here reads meaning into it. The item's DV100 is not
 * read at all: its direction appears to differ by filer (lib/utils/fundRateSensitivity.ts).
 */
export interface NportRateRisk {
  currency: string
  dv01: number
}

/**
 * One share class's total returns for the three months the filing covers (Item B.5.a,
 * `<monthlyTotReturn classId rtn1 rtn2 rtn3>`), in percent: "Monthly total returns of the Fund
 * for each of the preceding three months", per class for a fund with several. `months[2]` is the
 * month the report date falls in, `months[0]` two months before (T-459). Null where the filer
 * wrote "N/A" or nothing.
 */
export interface NportClassReturns {
  /** The SEC class id (C000…), or null when the filer gave none. */
  classId: string | null
  months: [number | null, number | null, number | null]
}

/**
 * One month's money in and out of the whole fund, every share class (Item B.6,
 * `<mon1Flow sales reinvestment redemption>`), in US dollars as filed: shares sold, shares
 * issued for reinvested distributions, and shares redeemed. Null where unreadable.
 */
export interface NportFlowMonth {
  sales: number | null
  reinvestment: number | null
  redemption: number | null
}

export interface NportReport {
  /** Portfolio as-of date (repPdDate), YYYY-MM-DD. */
  asOf: string | null
  /** Net assets in US dollars (Item B.1.c), when stated. */
  netAssets: number | null
  holdings: NportHolding[]
  /** Interest-rate risk per currency; empty when the filing carries none. */
  rateRisk: NportRateRisk[]
  /** Item B.5.a, one row per share class; empty when the filing carries none (T-459). */
  returns: NportClassReturns[]
  /** Item B.6, month 1 to month 3; a month the filing omits is null (T-459). */
  flows: [NportFlowMonth | null, NportFlowMonth | null, NportFlowMonth | null]
}

/** Resolve a fund ticker to its EDGAR series/class ids via the SEC's mutual-fund
 *  ticker map (covers ETFs and mutual funds — both are series/class registrants). */
export async function resolveFundSeries(symbol: string): Promise<FundSeries | null> {
  const res = await fetch('https://www.sec.gov/files/company_tickers_mf.json', {
    headers: EDGAR_HEADERS,
    next: { revalidate: 86_400 },
  })
  if (!res.ok) throw new Error(`SEC MF ticker map: HTTP ${res.status}`)
  const payload = await res.json() as { fields?: string[]; data?: Array<Array<string | number>> }
  const fields = payload.fields ?? []
  const iSeries = fields.indexOf('seriesId')
  const iClass = fields.indexOf('classId')
  const iSymbol = fields.indexOf('symbol')
  if (iSeries < 0 || iSymbol < 0) return null
  const wanted = symbol.toUpperCase()
  for (const row of payload.data ?? []) {
    if (String(row[iSymbol]).toUpperCase() === wanted) {
      return { seriesId: String(row[iSeries]), classId: iClass >= 0 ? String(row[iClass]) : '' }
    }
  }
  return null
}

/** List recent NPORT-P filings for a series, newest first. browse-edgar accepts
 *  a series id in the CIK slot and returns that series' filings as Atom XML. */
export async function listNportFilings(seriesId: string, limit = 12): Promise<NportFilingRef[]> {
  const params = new URLSearchParams({
    action: 'getcompany', CIK: seriesId, type: 'NPORT-P',
    dateb: '', owner: 'include', count: String(Math.min(limit, 40)), output: 'atom',
  })
  const res = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?${params}`, {
    headers: { ...EDGAR_HEADERS, Accept: 'application/atom+xml' },
    next: { revalidate: 21_600 },
  })
  if (!res.ok) throw new Error(`EDGAR browse: HTTP ${res.status}`)
  return parseNportFilingsAtom(await res.text(), limit)
}

/** Parse a browse-edgar Atom listing into filing refs. Pure — regex-based, so
 *  malformed input yields fewer rows rather than a throw. */
export function parseNportFilingsAtom(xml: string, limit = 12): NportFilingRef[] {
  const filings: NportFilingRef[] = []
  const entries = xml.split(/<entry>/).slice(1)
  for (const entry of entries) {
    const accession = entry.match(/<accession-n(?:umbe)?r>\s*([\d-]+)\s*</)?.[1]
      ?? entry.match(/accession[-_]number=([\d-]+)/)?.[1]
    const filedAt = entry.match(/<filing-date>\s*([\d-]+)\s*</)?.[1] ?? null
    // The archive CIK is the trust's, not the series'; recover it from the index link.
    const cik = entry.match(/Archives\/edgar\/data\/(\d+)\//)?.[1] ?? null
    if (accession && cik) {
      filings.push({ accession, cik, filedAt: filedAt ?? '' })
    }
  }
  // Atom is newest-first already; dedupe on accession just in case.
  const seen = new Set<string>()
  return filings.filter((f) => !seen.has(f.accession) && seen.add(f.accession)).slice(0, limit)
}

const num = (s: string | undefined): number | null => {
  if (s == null) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const tag = (block: string, name: string): string | undefined =>
  block.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`))?.[1]

const attr = (block: string, name: string): string | undefined =>
  block.match(new RegExp(`<${name}[^>]*\\bvalue="([^"]*)"`))?.[1]

/**
 * The holding's own lines, before the nested sections. A holding's country, currency and issuer
 * kind come before `<isRestrictedSec>`; what follows (a bond's `<debtSec>`, a swap's
 * `<derivativeInfo>`) carries other instruments' currencies and names. Read only the head, or a
 * convertible bond's reference stock lends the bond its currency (T-455).
 */
function holdingHead(block: string): string {
  const cut = block.search(/<(isRestrictedSec|fairValLevel|securityLending|debtSec|derivativeInfo|repurchaseAgrmt)\b/)
  return cut >= 0 ? block.slice(0, cut) : block
}

/** `<name>X</name>`, else `<nameConditional ... name="X"/>`. */
const tagOrConditional = (head: string, name: string, conditional: string): string | undefined =>
  tag(head, name) ?? head.match(new RegExp(`<${conditional}\\b[^>]*\\b${name}="([^"]*)"`))?.[1]

const code = (raw: string | undefined, pattern: RegExp): string | null => {
  const v = raw?.trim().toUpperCase()
  return v && pattern.test(v) ? v : null
}

const RATE_BUCKETS = ['period3Mon', 'period1Yr', 'period5Yr', 'period10Yr', 'period30Yr'] as const

/** Sum the five maturity-bucket attributes of the `<intrstRtRiskdv01>` element.
 *  Null when the element is missing or any bucket is unreadable: a total over
 *  four of five buckets would understate the exposure while looking complete. */
function dv01Total(block: string): number | null {
  const el = block.match(/<intrstRtRiskdv01\b([^>]*)\/?>/)?.[1]
  if (el == null) return null
  let total = 0
  for (const bucket of RATE_BUCKETS) {
    const v = num(el.match(new RegExp(`\\b${bucket}="([^"]*)"`))?.[1])
    if (v == null) return null
    total += v
  }
  return total
}

/** Parse Item B.3.a (`<curMetrics>`) into one entry per currency. Pure. */
export function parseNportRateRisk(xml: string): NportRateRisk[] {
  const section = xml.match(/<curMetrics>([\s\S]*?)<\/curMetrics>/)?.[1]
  if (!section) return []
  const out: NportRateRisk[] = []
  for (const raw of section.split(/<curMetric>/).slice(1)) {
    const block = raw.split(/<\/curMetric>/)[0]
    const dv01 = dv01Total(block)
    if (dv01 == null) continue
    out.push({ currency: tag(block, 'curCd') ?? '', dv01 })
  }
  return out
}

/** An attribute's value from an element's opening tag text, by name. */
const attrOf = (el: string, name: string): string | undefined =>
  el.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

/** Item B.5.a: each share class's three monthly total returns, in percent. Pure. */
export function parseNportReturns(xml: string): NportClassReturns[] {
  const section = xml.match(/<monthlyTotReturns>([\s\S]*?)<\/monthlyTotReturns>/)?.[1]
  if (!section) return []
  const out: NportClassReturns[] = []
  for (const m of section.matchAll(/<monthlyTotReturn\b([^>]*?)\/?>/g)) {
    const el = m[1]
    out.push({
      classId: attrOf(el, 'classId')?.trim() || null,
      months: [num(attrOf(el, 'rtn1')), num(attrOf(el, 'rtn2')), num(attrOf(el, 'rtn3'))],
    })
  }
  return out
}

/** Item B.6: the fund's money in and out for months 1 to 3. Pure. */
export function parseNportFlows(xml: string): NportReport['flows'] {
  const month = (n: 1 | 2 | 3): NportFlowMonth | null => {
    const el = xml.match(new RegExp(`<mon${n}Flow\\b([^>]*?)\\/?>`))?.[1]
    if (el == null) return null
    return { sales: num(attrOf(el, 'sales')), reinvestment: num(attrOf(el, 'reinvestment')), redemption: num(attrOf(el, 'redemption')) }
  }
  return [month(1), month(2), month(3)]
}

/** Fetch and parse one NPORT-P primary document into holdings. */
export async function fetchNportReport(ref: NportFilingRef): Promise<NportReport> {
  const adsh = ref.accession.replace(/-/g, '')
  const url = `https://www.sec.gov/Archives/edgar/data/${ref.cik}/${adsh}/primary_doc.xml`
  const res = await fetch(url, {
    headers: { ...EDGAR_HEADERS, Accept: 'application/xml' },
    next: { revalidate: 86_400 }, // filings are immutable
  })
  if (!res.ok) throw new Error(`EDGAR filing: HTTP ${res.status}`)
  return parseNportReport(await res.text())
}

/** Parse an NPORT-P primary document into holdings. Pure — regex-based, so
 *  malformed input yields empty/partial results rather than a throw. */
export function parseNportReport(xml: string): NportReport {
  const asOf = xml.match(/<repPdDate>\s*([\d-]+)\s*<\/repPdDate>/)?.[1] ?? null

  const holdings: NportHolding[] = []
  const blocks = xml.split(/<invstOrSec>/).slice(1)
  for (const raw of blocks) {
    const block = raw.split(/<\/invstOrSec>/)[0]
    // The filing is XML, so "Eli Lilly & Co" arrives as "Eli Lilly &amp; Co".
    const rawName = tag(block, 'name') ?? tag(block, 'title')
    const name = rawName ? decodeEntities(rawName) : 'Unknown'
    const cusipRaw = tag(block, 'cusip')
    // EDGAR uses sentinel strings for missing identifiers
    const cusip = cusipRaw && !/^(N\/A|0{9})$/i.test(cusipRaw) ? cusipRaw : null
    const isin = attr(block, 'isin') ?? null
    const tickerRaw = attr(block, 'ticker') ?? null
    const ticker = tickerRaw && /^[A-Za-z.-]{1,10}$/.test(tickerRaw) ? tickerRaw.toUpperCase() : null
    const head = holdingHead(block)
    const debt = block.match(/<debtSec>([\s\S]*?)<\/debtSec>/)?.[1]
    holdings.push({
      ticker, name, cusip, isin,
      balance: num(tag(block, 'balance')),
      valueUsd: num(tag(block, 'valUSD')),
      pctVal: num(tag(block, 'pctVal')),
      assetCat: tag(block, 'assetCat')?.trim().toUpperCase() || null,
      country: code(tag(head, 'invCountry'), /^[A-Z]{2}$/),
      currency: code(tagOrConditional(head, 'curCd', 'currencyConditional'), /^[A-Z]{3}$/),
      issuerCat: code(tagOrConditional(head, 'issuerCat', 'issuerConditional'), /^[A-Z]{2,6}$/),
      maturity: debt ? (tag(debt, 'maturityDt')?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? null) : null,
    })
  }
  return {
    asOf,
    netAssets: num(xml.match(/<netAssets>\s*([^<]*?)\s*<\/netAssets>/)?.[1]),
    holdings,
    rateRisk: parseNportRateRisk(xml),
    returns: parseNportReturns(xml),
    flows: parseNportFlows(xml),
  }
}
