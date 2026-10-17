import { NextRequest, NextResponse } from 'next/server'
import { resolveFundSeries } from '@/lib/server/nport'
import { fetchFundProspectus, type FundProspectus } from '@/lib/server/fundProspectus'

// The fund's current prospectus on SEC EDGAR (T-420 item 2, D92).
//   GET /live-data/fund-prospectus?symbol=IEF
//
// Keyless, one source: the fund's own filings. How the filing is chosen, and
// why, is in lib/server/fundProspectus.ts. A fund outside the SEC's
// mutual-fund map (SPY, GLD: trusts that file neither a 497K nor a 485BPOS)
// answers ok:true with prospectus null and the reason, which is a fact about
// the fund, not a failure. EDGAR being unreachable is ok:false.
//
// Response: { ok, symbol, prospectus, reason?, error? }

export const dynamic = 'force-dynamic'

export interface FundProspectusResponse {
  ok: boolean
  symbol: string
  updatedAt: string
  prospectus: FundProspectus | null
  /** Why there is no prospectus, when ok and prospectus is null. */
  reason?: string
  error?: string
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Pass ?symbol=IEF' }, { status: 400 })
  }
  const base = { symbol, updatedAt: new Date().toISOString() }
  try {
    const series = await resolveFundSeries(symbol)
    if (!series?.classId) {
      return NextResponse.json({
        ok: true, ...base, prospectus: null,
        reason: `${symbol} is not in the SEC's mutual-fund and ETF share-class list, so it files no summary prospectus there (trusts such as SPY and GLD register differently).`,
      } satisfies FundProspectusResponse)
    }
    const prospectus = await fetchFundProspectus(series.classId)
    return NextResponse.json({
      ok: true, ...base, prospectus,
      ...(prospectus ? {} : { reason: `EDGAR lists no 497K or 485BPOS filing for ${symbol}'s share class (${series.classId}).` }),
    } satisfies FundProspectusResponse)
  } catch (e) {
    return NextResponse.json({
      ok: false, ...base, prospectus: null,
      error: `SEC EDGAR could not be read: ${e instanceof Error ? e.message : String(e)}`,
    } satisfies FundProspectusResponse, { status: 502 })
  }
}
