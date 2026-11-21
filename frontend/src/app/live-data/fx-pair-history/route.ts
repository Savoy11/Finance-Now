import { NextResponse } from 'next/server'
import { isHistoryRange } from '@/lib/data/dailyHistory'
import { ECB_PAIRS, ecbPairBySlug, isWorkedOut, type PairHistoryPoint } from '@/lib/data/fxReference'
import { fetchPairHistory } from '@/lib/server/ecbReference'

// One currency pair's history at the European Central Bank's daily reference
// rates (T-445, D203):
//   GET /live-data/fx-pair-history?pair=eur-usd&range=1y
// pair is a catalog slug (every pair but the Dollar Index); range is 1mo, 3mo,
// 6mo, 1y, 5y or 10y. One figure a working day; a range over a year keeps each
// week's last one (`interval`). A pair without the euro is worked out from the
// two euro rates of each day (lib/data/fxReference.ts).
//
// No provider the app holds a key for has sent a currency pair's history on any
// audit since 2026-09-09, which is why the pair pages' charts were empty.

export const dynamic = 'force-dynamic'

export interface FxPairHistoryResponse {
  ok: boolean
  pair?: string
  name?: string
  range?: string
  interval?: 'daily' | 'weekly'
  points?: PairHistoryPoint[]
  /** True when the rate is worked out from two euro rates rather than published as such. */
  workedOut?: boolean
  source?: 'ecb-frankfurter'
  error?: string
}

export async function GET(request: Request): Promise<NextResponse<FxPairHistoryResponse>> {
  const url = new URL(request.url)
  const slug = (url.searchParams.get('pair') ?? '').toLowerCase()
  const range = url.searchParams.get('range') ?? '1y'
  const pair = ecbPairBySlug(slug)
  if (!pair) {
    return NextResponse.json({ ok: false, error: `pair must be one of ${ECB_PAIRS.map((p) => p.slug).join(', ')}` }, { status: 400 })
  }
  if (!isHistoryRange(range)) {
    return NextResponse.json({ ok: false, error: 'range must be 1mo, 3mo, 6mo, 1y, 5y or 10y' }, { status: 400 })
  }
  try {
    const h = await fetchPairHistory(pair, range)
    return NextResponse.json({
      ok: true, pair: pair.slug, name: pair.name, range: h.range, interval: h.interval, points: h.points,
      workedOut: isWorkedOut(pair), source: 'ecb-frankfurter',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'ECB reference rate history unavailable' })
  }
}
