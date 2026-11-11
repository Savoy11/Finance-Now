import { NextResponse } from 'next/server'
import { isHistoryRange } from '@/lib/data/dailyHistory'
import type { GapNow, InvertedStretch, SpreadKey, SpreadPoint } from '@/lib/data/curveSpreads'
import { fetchSpreadHistory } from '@/lib/server/treasurySpreadHistory'

// The gaps between short and long Treasury yields over time (T-464):
//   GET /live-data/treasury-spread-history?range=1y
// Each day's 10-year minus 2-year ("2s10s") and 10-year minus 3-month ("3m10y") from the
// official daily par curve, the stretches when each was below zero (short yields above long,
// "inverted"), and where each stands now. range is 1mo, 3mo, 6mo, 1y, 5y or 10y; daily
// readings, each week's last over a span longer than a year (`interval`). The stretches are
// always worked out from the daily readings.
//
// Same host and files as /live-data/treasury-yield-history (home.treasury.gov, keyless, a
// federal work).

export const dynamic = 'force-dynamic'

export interface SpreadHistoryResponse {
  ok: boolean
  range?: string
  interval?: 'daily' | 'weekly'
  points?: SpreadPoint[]
  stretches?: Record<SpreadKey, InvertedStretch[]>
  now?: Record<SpreadKey, GapNow | null>
  missingYears?: number[]
  /** The first reading read: a gap with no stretch has not been below zero since. */
  readFrom?: string
  source?: 'treasury-gov'
  error?: string
}

export async function GET(request: Request): Promise<NextResponse<SpreadHistoryResponse>> {
  const range = new URL(request.url).searchParams.get('range') ?? '1y'
  if (!isHistoryRange(range)) {
    return NextResponse.json({ ok: false, error: 'range must be 1mo, 3mo, 6mo, 1y, 5y or 10y' }, { status: 400 })
  }
  try {
    const h = await fetchSpreadHistory(range)
    return NextResponse.json({
      ok: true, range: h.range, interval: h.interval, points: h.points,
      stretches: h.stretches, now: h.now, missingYears: h.missingYears, readFrom: h.readFrom, source: 'treasury-gov',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'treasury spread history unavailable' })
  }
}
