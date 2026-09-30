import { NextResponse } from 'next/server'

// Perpetual-swap funding rates and open interest — currently NO SOURCE.
//
// OKX was the only source, through its keyless public v5 API, until 2026-09-30. Its API
// Agreement §9.4 (read on the owner's machine 2026-09-26) limits Market Data — which §1.8
// defines to include funding rates — to "your own personal, non-commercial trading and
// account management purposes", bars using it in any "analytics platform", and applies
// "equally to Market Data accessed through public endpoints". The owner withdrew it (D40,
// docs/decisions/2026-09-30-owner-decisions.md) and okx.com is now `prohibited` in
// lib/server/sourceTerms.ts. Binance futures (fapi) answers 451 from US hosts.
//
// The route stays and answers ok:false WITH THE REASON, the way futures-curve does, so the
// Market Structure panel can say why the figure is missing instead of showing a bare dash
// — and a source whose terms permit this use can be wired back in here without touching
// the panel. The earlier implementation also reported a failed fetch as a 0% funding rate;
// that path is gone with the fetch.
//
// Response: { ok: false, rates: [], reason, updatedAt }

export const dynamic = 'force-dynamic'

export interface FundingRate {
  symbol: string        // e.g. "BTC"
  exchange: string
  fundingRate: number   // as decimal, e.g. 0.0001 = 0.01%
  annualized: number    // fundingRate * 3 * 365 * 100 (%)
  nextFundingTime: number | null  // unix ms
  openInterestUsd: number | null
  longShortRatio: number | null
}

export interface FundingRatesResponse {
  ok: boolean
  rates: FundingRate[]
  /** Why `rates` is empty, in words a reader can act on. Present whenever ok is false. */
  reason?: string
  updatedAt: string
}

// Not exported: a route module may export only its handlers, config and types.
const UNAVAILABLE_REASON =
  'No source: OKX, the only one, was withdrawn on 2026-09-30 because its API terms bar using its ' +
  'market data in an analytics platform. No other funding-rate source has been cleared for this use.'

export async function GET(): Promise<NextResponse<FundingRatesResponse>> {
  return NextResponse.json({
    ok: false,
    rates: [],
    reason: UNAVAILABLE_REASON,
    updatedAt: new Date().toISOString(),
  })
}
