import { NextRequest, NextResponse } from 'next/server'
import { fetchNportReport, listNportFilings, resolveFundSeries, type NportFilingRef } from '@/lib/server/nport'
import { buildFundReturns, latestPerPeriod, type FilingFigures, type FundReturnsView } from '@/lib/utils/fundReturns'

// A fund's own returns and money flows, from its NPORT-P filings (T-459; D222, D223).
//   GET /live-data/fund-returns?symbol=VOO
//
// Keyless: SEC EDGAR only, the same filings /live-data/fund-holdings reads. The newest filing
// gives this share class's return for each of its three months and the fund's money in and out;
// the 12-month return needs the four newest quarters, so up to four filings are read (six when an
// amendment repeats a quarter). The rules are pure in lib/utils/fundReturns.ts.
//
// A fund the SEC's fund list does not carry (SPY, GLD and the other trusts that file no N-PORT)
// answers ok with `filer: false`, and the page shows nothing. A filing that cannot be read is
// counted in `filingsFailed`; a 12-month figure then needs the others to cover all twelve months.
// When the newest filing listed is one that could not be read, `newestUnread` gives its filing date:
// the figures shown may then not be the latest (code audit 2026-11-12, D226).

export const dynamic = 'force-dynamic'

/** Quarters the 12-month return needs. */
const QUARTERS = 4
/** At most this many filings are read, so an amended quarter does not cost the 12-month figure. */
const MAX_READ = 6

export interface FundReturnsResponse {
  ok: boolean
  symbol: string
  updatedAt: string
  /** The SEC's fund list carries this ticker, so it files N-PORT. */
  filer: boolean
  seriesId: string | null
  classId: string | null
  returns: FundReturnsView | null
  /** The filings read, newest report first. */
  filingsRead: { asOf: string; filedAt: string; accession: string }[]
  filingsFailed: number
  /** The newest filing listed could not be read: its filing date. The figures may not be the latest. */
  newestUnread?: { filedAt: string }
  source: 'SEC EDGAR, Form NPORT-P'
  error?: string
}

async function readFiling(ref: NportFilingRef): Promise<FilingFigures | null> {
  const r = await fetchNportReport(ref)
  if (!r.asOf) return null
  return { asOf: r.asOf, filedAt: ref.filedAt, accession: ref.accession, netAssets: r.netAssets, returns: r.returns, flows: r.flows }
}

/** Reads filings in order until QUARTERS distinct report dates are in hand or MAX_READ are tried. */
async function readQuarters(filings: NportFilingRef[]): Promise<{ read: FilingFigures[]; failed: number; newestFailed: boolean }> {
  const read: FilingFigures[] = []
  let failed = 0
  let newestFailed = false
  let next = 0
  while (next < filings.length && next < MAX_READ && latestPerPeriod(read).length < QUARTERS) {
    const want = Math.min(QUARTERS - latestPerPeriod(read).length, filings.length - next, MAX_READ - next)
    const batch = filings.slice(next, next + want)
    next += batch.length
    // Independent documents: one failing must not lose the others.
    const settled = await Promise.allSettled(batch.map(readFiling))
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled' && s.value) read.push(s.value)
      else {
        failed++
        // The list is newest first (the SEC's feed order), so the first filing is the newest.
        if (batch[i] === filings[0]) newestFailed = true
      }
    })
  }
  return { read, failed, newestFailed }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase() ?? ''
  const base = { symbol, updatedAt: new Date().toISOString(), source: 'SEC EDGAR, Form NPORT-P' as const }
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
    return NextResponse.json({ ...base, ok: false, filer: false, seriesId: null, classId: null, returns: null, filingsRead: [], filingsFailed: 0, error: 'Pass ?symbol=VOO' } satisfies FundReturnsResponse, { status: 400 })
  }
  try {
    const series = await resolveFundSeries(symbol)
    if (!series) {
      return NextResponse.json({ ...base, ok: true, filer: false, seriesId: null, classId: null, returns: null, filingsRead: [], filingsFailed: 0 } satisfies FundReturnsResponse)
    }
    const filings = await listNportFilings(series.seriesId, 12)
    const { read, failed, newestFailed } = await readQuarters(filings)
    const classId = series.classId || null
    return NextResponse.json({
      ...base,
      ok: true,
      filer: true,
      seriesId: series.seriesId,
      classId,
      returns: buildFundReturns(read, classId),
      filingsRead: latestPerPeriod(read).map((f) => ({ asOf: f.asOf, filedAt: f.filedAt, accession: f.accession })),
      filingsFailed: failed,
      ...(newestFailed && read.length > 0 ? { newestUnread: { filedAt: filings[0].filedAt } } : {}),
      ...(filings.length > 0 && read.length === 0 ? { error: `None of the fund's N-PORT filings could be read (${failed} tried).` } : {}),
    } satisfies FundReturnsResponse)
  } catch (e) {
    return NextResponse.json({
      ...base, ok: false, filer: false, seriesId: null, classId: null, returns: null, filingsRead: [], filingsFailed: 0,
      error: e instanceof Error ? e.message : String(e),
    } satisfies FundReturnsResponse, { status: 502 })
  }
}
