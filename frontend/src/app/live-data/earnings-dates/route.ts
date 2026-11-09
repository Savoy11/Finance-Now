import { NextRequest, NextResponse } from 'next/server'
import { upcomingEarnings, type EarningsSourceStatus } from '@/lib/server/earningsCalendar'
import { EARNINGS_LOOK_AHEAD_DAYS, addDays, cleanSymbols, earningsGap, marketToday, nextEarningsBySymbol, type EarningsSource, type UpcomingEarnings } from '@/lib/data/earningsCalendar'

// The next expected earnings date for each stock asked about (T-458, D213): the stock page asks
// for one, the watchlist for its stocks.
//   GET /live-data/earnings-dates?symbols=AAPL,NVDA
// From FMP's earnings calendar, with Alpha Vantage's filling in companies FMP does not list
// (lib/server/earningsCalendar.ts). Ninety days ahead: companies report quarterly, and Alpha
// Vantage's free list covers three months.

export const dynamic = 'force-dynamic'

const MAX_SYMBOLS = 200

export interface EarningsDatesResponse {
  ok: boolean
  /** At least one earnings source (FMP or Alpha Vantage) has a key. */
  configured: boolean
  from: string
  to: string
  sources: Record<EarningsSource, EarningsSourceStatus>
  /** Each symbol asked about: its next expected report, or null when no source that answered lists one in the window. */
  dates: Record<string, UpcomingEarnings | null>
  /** When a configured calendar failed and another answered: which dates may be missing (D214). */
  gap: string | null
  updatedAt: string
}

export async function GET(req: NextRequest) {
  const symbols = cleanSymbols(req.nextUrl.searchParams.get('symbols') ?? '', MAX_SYMBOLS)
  if (symbols.length === 0) {
    return NextResponse.json({ ok: false, error: 'Pass ?symbols=AAPL,MSFT' }, { status: 400 })
  }
  const from = marketToday()
  const to = addDays(from, EARNINGS_LOOK_AHEAD_DAYS)
  const result = await upcomingEarnings(from, to)
  const next = nextEarningsBySymbol(result.events, from)
  const dates: Record<string, UpcomingEarnings | null> = {}
  for (const s of symbols) dates[s] = next.get(s) ?? null
  return NextResponse.json({
    // Answered: at least one source gave its list. A null date means "not listed by a source that
    // answered"; `gap` says when another configured source failed, so a date may be missing (D214).
    ok: result.sources.fmp.ok || result.sources['alpha-vantage'].ok,
    gap: earningsGap(result.sources),
    configured: result.configured,
    from, to,
    sources: result.sources,
    dates,
    updatedAt: new Date().toISOString(),
  } satisfies EarningsDatesResponse)
}
