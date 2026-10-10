import { NextRequest, NextResponse } from 'next/server'
import { EQUITY_REFERENCE_AS_OF } from '@/lib/data/equityCatalog'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import {
  isNoFilingError, isNoPriceProviderError, stockEligibility, stockInputsFrom,
} from '@/lib/risk/ratingInputs'
import {
  failed, finishRating, gateAssetRating, notRated,
  type AssetRatingResponse, type RatingSources,
} from '@/lib/server/assetRatingRoute'
import type { SecurityOhlcvResponse } from '@/app/live-data/security-ohlcv/route'
import type { CompanyFactsResponse } from '@/app/live-data/company-facts/route'

// Measured-risk rating for one catalog stock (T-420 item 4; methodology §4, §5).
//   GET /live-data/stock-rating?symbol=AAPL
//
// ⚠ Hidden: while ASSET_PAGE_RATINGS_SHOWN is false this answers only on the owner's
// machine or to FN_ADMIN_TOKEN (lib/risk/visibility.ts).
//
// Reads the app's own routes rather than the providers, so every figure comes from the
// same place the stock page shows it: daily candles from security-ohlcv (Tiingo, then
// FMP; keyed) and the filing from company-facts (SEC, keyless).
//
// ⚠ NOTHING HERE IS CACHED ACROSS REQUESTS. Tiingo's Starter terms (§1.6(a)) bar keeping
// its data past the calculation, which is why security-ohlcv fetches Tiingo uncached; the
// candles reach this route the same way and are dropped when it answers. The weekly
// reading this stores holds the score and classes only, never a price.

export const dynamic = 'force-dynamic'

/** Each internal route may try two upstreams in turn, each under its own ceiling. */
const INTERNAL_TIMEOUT_MS = 2 * EXTERNAL_FETCH_TIMEOUT_MS

async function getJson<T>(url: string, init: RequestInit & { next: { revalidate: number } }): Promise<T | { fetchError: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS) })
    return await res.json() as T
  } catch (e) {
    return { fetchError: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const denied = gateAssetRating(req)
  if (denied) return denied

  const symbol = (req.nextUrl.searchParams.get('symbol') ?? '').trim().toUpperCase()
  if (!symbol) return NextResponse.json({ ok: false, error: 'Pass ?symbol=AAPL' }, { status: 400 })
  const now = new Date()
  const noStore = { headers: { 'Cache-Control': 'private, no-store' } }

  const eligibility = stockEligibility(symbol)
  if (!eligibility.eligible) return NextResponse.json(notRated('stock', symbol, eligibility.reason, now), noStore)

  const origin = req.nextUrl.origin
  const q = encodeURIComponent(symbol)
  // `revalidate: 0` is the repo's idiom for an uncached fetch. The candles must never
  // be cached (Tiingo §1.6(a), above); company-facts caches its own SEC request.
  const [ohlcv, facts] = await Promise.all([
    getJson<SecurityOhlcvResponse>(`${origin}/live-data/security-ohlcv?symbol=${q}&range=1Y`, { next: { revalidate: 0 } }),
    getJson<CompanyFactsResponse>(`${origin}/live-data/company-facts?symbol=${q}`, { next: { revalidate: 0 } }),
  ])

  const fail = (error: string) => NextResponse.json(failed('stock', symbol, error, now), { status: 503, ...noStore })

  if ('fetchError' in ohlcv) return fail(`Daily prices unreachable: ${ohlcv.fetchError}`)
  if (!ohlcv.ok) {
    if (isNoPriceProviderError(ohlcv.error)) {
      return NextResponse.json(
        notRated('stock', symbol, 'Not rated: daily prices need a Tiingo or FMP key, added on the Integrations page.', now),
        noStore,
      )
    }
    return fail(`Daily prices: ${ohlcv.error ?? 'no candles'}`)
  }

  // A company with no usable filing is rated without the fundamentals dimension, and the
  // panel says why. SEC being unreachable is retried instead: a passing outage must not
  // become the week's stored reading.
  if ('fetchError' in facts) return fail(`SEC company facts unreachable: ${facts.fetchError}`)
  if (!facts.ok && !isNoFilingError(facts.error)) return fail(`SEC company facts: ${facts.error ?? 'unavailable'}`)

  const prepared = stockInputsFrom(eligibility.entry, {
    candles: ohlcv.candles,
    fundamentals: facts.ok ? facts.fundamentals : null,
    fiscalYearEnd: facts.ok ? facts.fiscalYearEnd : null,
  }, now)

  const sources: RatingSources = {
    prices: { source: ohlcv.source, asOf: prepared.asOf },
    marketCap: { source: 'Catalog reference figure', asOf: EQUITY_REFERENCE_AS_OF },
    fundamentals: {
      source: 'SEC EDGAR (XBRL company facts)',
      periodEnd: facts.ok ? facts.fiscalYearEnd : null,
      balanceSheetAsOf: facts.ok ? facts.fundamentals?.balanceSheetAsOf ?? null : null,
    },
  }
  const { status, body } = await finishRating({ kind: 'stock', id: symbol, prepared, sources, now })
  return NextResponse.json<AssetRatingResponse>(body, { status, ...noStore })
}
