import { NextResponse } from 'next/server'
import { isParMaturity, isYieldHistoryRange, type YieldHistoryPoint } from '@/lib/data/yieldHistory'
import { fetchYieldHistory } from '@/lib/server/treasuryHistory'

// One Treasury yield's history from the official daily par curve (T-446, D202):
//   GET /live-data/treasury-yield-history?maturity=10Y&range=1y
// maturity is one of the curve's 13 labels (1M … 30Y); range is 1mo, 3mo, 6mo,
// 1y, 5y or 10y. Where the Treasury publishes a real (inflation-protected) yield
// for the maturity (5Y, 7Y, 10Y, 20Y, 30Y), each day also carries it and the
// market's expected inflation: the ordinary yield minus the real yield that day.
// Daily readings; a range over a year keeps each week's last one (`interval`).
//
// Same host as /live-data/treasury-yield-curve (home.treasury.gov, keyless, a
// federal work). No provider quotes these yields' history (D3), which is why the
// yield pages' charts were empty before this route.

export const dynamic = 'force-dynamic'

export interface YieldHistoryResponse {
  ok: boolean
  maturity?: string
  range?: string
  interval?: 'daily' | 'weekly'
  points?: YieldHistoryPoint[]
  hasReal?: boolean
  missingYears?: number[]
  source?: 'treasury-gov'
  error?: string
}

export async function GET(request: Request): Promise<NextResponse<YieldHistoryResponse>> {
  const url = new URL(request.url)
  const maturity = (url.searchParams.get('maturity') ?? '10Y').toUpperCase()
  const range = url.searchParams.get('range') ?? '1y'
  if (!isParMaturity(maturity)) {
    return NextResponse.json({ ok: false, error: 'maturity must be one of the par curve labels, such as 3M, 5Y, 10Y or 30Y' }, { status: 400 })
  }
  if (!isYieldHistoryRange(range)) {
    return NextResponse.json({ ok: false, error: 'range must be 1mo, 3mo, 6mo, 1y, 5y or 10y' }, { status: 400 })
  }
  try {
    const h = await fetchYieldHistory(maturity, range)
    return NextResponse.json({
      ok: true, maturity: h.maturity, range: h.range, interval: h.interval, points: h.points,
      hasReal: h.hasReal, missingYears: h.missingYears, source: 'treasury-gov',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'treasury yield history unavailable' })
  }
}
