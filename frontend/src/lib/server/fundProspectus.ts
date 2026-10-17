// A fund's current prospectus on SEC EDGAR (T-420 item 2, D92: "a link to the
// prospectus" among the facts that replace the switched-off Risk Profile label).
// Keyless, the same host as N-PORT (lib/server/nport.ts).
//
// Flow: ticker → share-class id (company_tickers_mf.json) → that class's 497K
// and 485BPOS filings (browse-edgar Atom) → the summary prospectus that came
// with the latest annual update → its primary document.
//
// Measured on EDGAR 2026-10-17, and the reason for each step:
//   • Look up by CLASS, never series. VOO's series lists four 497Ks a date, one
//     per share class (Admiral, ETF, Institutional…); its class lists one.
//   • Not simply the newest 497K. 497K also carries supplements: FXAIX filed a
//     4 KB one on 2025-11-10 between annual updates. The annual summary
//     prospectus is filed with the 485BPOS that updates the registration
//     statement, so the rule is the EARLIEST 497K on or after the latest
//     485BPOS (IEF 06-18 → 06-29, VOO 04-28 → 04-28, FXAIX 04-24 → 04-28,
//     AGTHX 10-31 → 10-31). A later sticker never displaces it.
//   • No such 497K → the 485BPOS itself, which contains the full prospectus.
//   • Neither → nothing. SPY and GLD are trusts outside the SEC's mutual-fund
//     map and file neither form; a link guessed for them would be another
//     fund's document.
//
// Pure parts (parseFilingListAtom, chooseProspectus, primaryDocument) are
// tested; the fetchers are thin.

import { EDGAR_HEADERS } from './edgar'

export interface FilingListEntry {
  type: string
  /** YYYY-MM-DD */
  filedAt: string
  /** EDGAR filing index page (…-index.htm). */
  indexUrl: string
}

export type ProspectusKind = 'summary' | 'registration'

export interface ProspectusRef {
  kind: ProspectusKind
  filedAt: string
  indexUrl: string
}

export interface FundProspectus extends ProspectusRef {
  /** The prospectus document itself; the index page when it could not be read. */
  url: string
}

/** Parse a browse-edgar Atom listing. Pure; malformed entries are skipped. */
export function parseFilingListAtom(xml: string): FilingListEntry[] {
  const out: FilingListEntry[] = []
  const seen = new Set<string>()
  for (const entry of xml.split(/<entry>/).slice(1)) {
    const type = entry.match(/<filing-type>\s*([^<]+?)\s*</)?.[1]
    const filedAt = entry.match(/<filing-date>\s*(\d{4}-\d{2}-\d{2})\s*</)?.[1]
    const indexUrl = entry.match(/<filing-href>\s*(https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/[^<\s]+-index\.html?)\s*</)?.[1]
    if (!type || !filedAt || !indexUrl || seen.has(indexUrl)) continue
    seen.add(indexUrl) // EDGAR lists a 485BPOS once per form it covers
    out.push({ type, filedAt, indexUrl })
  }
  return out
}

/**
 * The summary prospectus filed with the latest annual update: the earliest 497K
 * on or after the newest 485BPOS. Falls back to that 485BPOS, then to the newest
 * 497K when no 485BPOS is listed, then null. Order of the inputs does not matter.
 */
export function chooseProspectus(summaries: FilingListEntry[], registrations: FilingListEntry[]): ProspectusRef | null {
  const s = summaries.filter((f) => f.type === '497K')
  const r = registrations.filter((f) => f.type === '485BPOS')
  const latestReg = r.reduce<FilingListEntry | null>((a, b) => (a && a.filedAt >= b.filedAt ? a : b), null)
  if (latestReg) {
    const after = s.filter((f) => f.filedAt >= latestReg.filedAt)
    const first = after.reduce<FilingListEntry | null>((a, b) => (a && a.filedAt <= b.filedAt ? a : b), null)
    if (first) return { kind: 'summary', filedAt: first.filedAt, indexUrl: first.indexUrl }
    return { kind: 'registration', filedAt: latestReg.filedAt, indexUrl: latestReg.indexUrl }
  }
  const newest = s.reduce<FilingListEntry | null>((a, b) => (a && a.filedAt >= b.filedAt ? a : b), null)
  return newest ? { kind: 'summary', filedAt: newest.filedAt, indexUrl: newest.indexUrl } : null
}

/**
 * The filing's main document from its index.json listing: the largest .htm that
 * is not EDGAR's own index page. Images and the .txt bundle are never it. Null
 * when the listing has none.
 */
export function primaryDocument(items: Array<{ name?: string; size?: string | number }>): string | null {
  let best: { name: string; size: number } | null = null
  for (const it of items) {
    const name = String(it.name ?? '')
    if (!/\.html?$/i.test(name) || /-index(-headers)?\.html?$/i.test(name)) continue
    const size = Number(it.size)
    const n = Number.isFinite(size) ? size : 0
    if (!best || n > best.size) best = { name, size: n }
  }
  return best?.name ?? null
}

async function listFilings(classId: string, type: '497K' | '485BPOS'): Promise<FilingListEntry[]> {
  const params = new URLSearchParams({
    action: 'getcompany', CIK: classId, type, dateb: '', owner: 'include', count: '10', output: 'atom',
  })
  const res = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?${params}`, {
    headers: { ...EDGAR_HEADERS, Accept: 'application/atom+xml' },
    next: { revalidate: 86_400 },
  })
  if (!res.ok) throw new Error(`EDGAR browse (${type}): HTTP ${res.status}`)
  return parseFilingListAtom(await res.text())
}

/** Resolve the prospectus for a share class. Throws only when EDGAR cannot be read. */
export async function fetchFundProspectus(classId: string): Promise<FundProspectus | null> {
  const [summaries, registrations] = await Promise.all([listFilings(classId, '497K'), listFilings(classId, '485BPOS')])
  const ref = chooseProspectus(summaries, registrations)
  if (!ref) return null
  // The document itself is a better link than EDGAR's index page, but the index
  // page is still the right filing; a failed lookup degrades to it, never to null.
  const folder = ref.indexUrl.replace(/[^/]+$/, '')
  try {
    const res = await fetch(`${folder}index.json`, { headers: EDGAR_HEADERS, next: { revalidate: 86_400 } })
    if (res.ok) {
      const j = await res.json() as { directory?: { item?: Array<{ name?: string; size?: string }> } }
      const doc = primaryDocument(j.directory?.item ?? [])
      if (doc) return { ...ref, url: folder + doc }
    }
  } catch { /* fall through to the index page */ }
  return { ...ref, url: ref.indexUrl }
}
