import { NextRequest, NextResponse } from 'next/server'
import { coingeckoBase, coingeckoHeaders } from '@/lib/api/live/coingecko'
import { describeThrottle } from '@/lib/server/coingeckoThrottle'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { METHODOLOGY_V1 as M } from '@/lib/risk/methodology/v1'
import { coinEligibility, coinInputsFromChart, yesterdayUtc, type MarketChart } from '@/lib/risk/ratingInputs'
import {
  cachedRating, cacheRating, failed, finishRating, gateAssetRating, notRated,
  type AssetRatingResponse, type RatingSources,
} from '@/lib/server/assetRatingRoute'

// Measured-risk rating for one catalog coin (T-420 item 4; methodology §3, §5).
//   GET /live-data/coin-rating?id=btc
//
// ⚠ Hidden: while ASSET_PAGE_RATINGS_SHOWN is false this answers only on the owner's
// machine or to FN_ADMIN_TOKEN (lib/risk/visibility.ts).
//
// One CoinGecko request per coin per UTC day: the daily chart carries the closes, the
// cross-exchange volume and the market cap together. Not /live-data/ohlcv, which asks
// Binance first: Binance's volume is one exchange's, and the liquidity dimension
// measures the total. No fallback either: without CoinGecko's volume and market cap,
// liquidity and scale would both be missing, below the coverage floor, so a second
// price source could not produce a rating.

export const dynamic = 'force-dynamic'

/** Days of history to ask for. CoinGecko's free tier serves at most 365. */
const HISTORY_DAYS = M.crypto.priceWindowDays

export async function GET(req: NextRequest) {
  const denied = gateAssetRating(req)
  if (denied) return denied

  const id = (req.nextUrl.searchParams.get('id') ?? '').trim().toLowerCase()
  if (!id) return NextResponse.json({ ok: false, error: 'Pass ?id=btc' }, { status: 400 })
  const now = new Date()

  const eligibility = coinEligibility(id)
  if (!eligibility.eligible) return NextResponse.json(notRated('crypto', id, eligibility.reason, now))

  const hit = cachedRating('crypto', id, now)
  if (hit) return NextResponse.json(hit)

  let chart: MarketChart
  try {
    // Uncached upstream on purpose: the day cache below is the cache, and a response
    // fetched before midnight would leave the whole day's rating a day behind.
    const res = await fetch(
      `${coingeckoBase()}/coins/${eligibility.coingeckoId}/market_chart?vs_currency=usd&days=${HISTORY_DAYS}&interval=daily`,
      { headers: coingeckoHeaders(), next: { revalidate: 0 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) },
    )
    if (!res.ok) {
      return NextResponse.json(
        failed('crypto', id, `CoinGecko daily history: HTTP ${res.status}${await describeThrottle(res)}`, now),
        { status: 503 },
      )
    }
    chart = await res.json() as MarketChart
  } catch (e) {
    return NextResponse.json(
      failed('crypto', id, `CoinGecko daily history unreachable: ${e instanceof Error ? e.message : String(e)}`, now),
      { status: 503 },
    )
  }

  const prepared = coinInputsFromChart(chart, now)
  const sources: RatingSources = {
    prices: { source: 'CoinGecko daily history', asOf: prepared.asOf },
    marketCap: { source: 'CoinGecko', asOf: prepared.asOf },
  }
  const { status, body } = await finishRating({ kind: 'crypto', id, prepared, sources, now })

  // Cache only a complete day: data reaching yesterday, and an answer, not a failure.
  if (status === 200 && prepared.asOf === yesterdayUtc(now)) cacheRating('crypto', id, now, body)
  return NextResponse.json<AssetRatingResponse>(body, { status })
}
