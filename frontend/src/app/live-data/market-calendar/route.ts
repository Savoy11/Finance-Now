import { NextRequest, NextResponse } from 'next/server'
import { EQUITY_BY_SYMBOL } from '@/lib/data/equityCatalog'
import { getProviderKey } from '@/lib/api/live/providers'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { fomcEventsBetween, mergeEconomicEvents, releaseEventsBetween, type EconomicEvent } from '@/lib/server/marketCalendar'
import { fomcScheduleThrough } from '@/lib/data/fomcCalendar'
import { releaseScheduleSpan } from '@/lib/data/releaseCalendar'
import { upcomingEarnings, type EarningsSourceStatus } from '@/lib/server/earningsCalendar'
import { earningsGap, type EarningsSource, type EarningsTime } from '@/lib/data/earningsCalendar'
import { addDays, marketToday } from '@/lib/utils/marketDay'

// Earnings + economic calendar for the equities module.
//
// - Earnings: FMP, free key, with Alpha Vantage's earnings calendar behind it (T-458, D213): one
//   request a day, filling in companies FMP does not list, and every company when FMP is gone.
// - US economic releases: FMP's economic calendar, a PAID endpoint (402 on free).
// - FOMC meetings: keyless — the hand-maintained table in lib/data/fomcCalendar.ts,
//   copied from the Federal Reserve Board's calendar (added 2026-10-03). Returned on
//   every plan, including with no FMP key at all.
// - CPI, jobs, GDP and PCE release dates: keyless too — lib/data/releaseCalendar.ts, copied
//   from the BLS and BEA schedules (T-456, added 2026-11-07), returned like the FOMC rows.
//
// With neither an FMP nor an Alpha Vantage key the route reports configured:false so the UI shows
// an honest setup notice for earnings, and still returns the FOMC and release rows.

export const dynamic = 'force-dynamic'

export type { EconomicEvent }

export interface EarningsEvent {
  symbol: string
  name: string
  date: string
  epsEstimate: number | null
  /** Before the open or after the close, when the source says. FMP's /stable calendar has not. */
  time: EarningsTime | null
  inCatalog: boolean
  /** Which calendar listed it. */
  source: EarningsSource
}

export interface MarketCalendarResponse {
  /**
   * A keyed source returned at least one row: an earnings row from FMP or Alpha Vantage, or an
   * FMP economic row. FOMC and release rows do NOT count: they are always present, so counting
   * them would make dead keyed legs read as "no earnings scheduled" (the research agent's
   * get_market_calendar tool relies on this).
   */
  ok: boolean
  /** An earnings source has a key: FMP or Alpha Vantage. */
  configured: boolean
  /** An FMP key is configured; the economic releases other than the hand-kept ones need it. */
  fmpConfigured: boolean
  /** How each earnings source answered. */
  earningsSources: Record<EarningsSource, EarningsSourceStatus>
  /** When a configured earnings calendar failed and another answered: which dates may be missing (D214). */
  earningsGap: string | null
  from: string
  to: string
  earnings: EarningsEvent[]
  economic: EconomicEvent[]
  /** Last date the FOMC table covers. Past it, no FOMC row means "not published yet". */
  fomcThrough: string
  /** Dates the release table covers (CPI, jobs, GDP, PCE). Outside them, no release row means "not in the table". */
  releasesFrom: string
  releasesThrough: string
  updatedAt: string
}

export async function GET(req: NextRequest) {
  // W3-6: ?month=YYYY-MM fetches that calendar month, for the month-grid UI.
  // Bounded to ±12 months from now — FMP serves history and far-future dates
  // thinly, and an unbounded month param would let one URL sweep years of the
  // provider's calendar for nothing.
  const monthParam = req.nextUrl.searchParams.get('month')
  let from: string
  let to: string
  if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    const now = new Date()
    const offset = (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth())
    const clamped = Math.max(-12, Math.min(12, offset))
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + clamped, 1))
    from = target.toISOString().slice(0, 10)
    to = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  } else {
    const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '14', 10) || 14, 30)
    // New York's day (D214): from UTC's, that evening's reporters dropped out after ~8 pm Eastern.
    from = marketToday()
    to = addDays(from, days)
  }
  const span = releaseScheduleSpan()
  const base = { from, to, fomcThrough: fomcScheduleThrough(), releasesFrom: span.from, releasesThrough: span.through, updatedAt: new Date().toISOString() }

  // Keyless, so computed before the key check: these show on every plan.
  const fomc = fomcEventsBetween(from, to)
  const releases = releaseEventsBetween(from, to)

  // UI-saved key (Integrations page) or FMP_API_KEY env var
  const FMP_KEY = getProviderKey('fmp')
  const stable = 'https://financialmodelingprep.com/stable'
  // Earnings (FMP, then Alpha Vantage) and FMP's economic calendar are independent requests.
  // The economic calendar is a paid endpoint (402 on free); allSettled lets it fail on its own.
  const [earningsResult, econRes] = await Promise.allSettled([
    upcomingEarnings(from, to),
    FMP_KEY
      ? fetch(`${stable}/economic-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) })
      : Promise.reject(new Error('no FMP key')),
  ])
  const upcoming = earningsResult.status === 'fulfilled' ? earningsResult.value : null
  const unanswered: EarningsSourceStatus = { configured: false, ok: false, count: 0, detail: 'not asked' }
  const earningsSources = upcoming?.sources ?? { fmp: unanswered, 'alpha-vantage': unanswered }

  if (!upcoming?.configured && !FMP_KEY) {
    return NextResponse.json({
      ok: false, configured: false, fmpConfigured: false, earningsSources, earningsGap: null, earnings: [],
      economic: mergeEconomicEvents([], fomc, 0, releases), ...base,
    } satisfies MarketCalendarResponse)
  }

  const earnings: EarningsEvent[] = []
  let outsideCatalog = 0
  for (const row of upcoming?.events ?? []) {
    const entry = EQUITY_BY_SYMBOL[row.symbol]
    // Catalog names first; cap the long tail of non-catalog names
    if (!entry && outsideCatalog >= 120) continue
    if (!entry) outsideCatalog++
    earnings.push({
      symbol: row.symbol,
      name: entry?.name ?? (row.name !== row.symbol ? row.name : row.symbol),
      date: row.date,
      epsEstimate: row.epsEstimate,
      time: row.time,
      inCatalog: !!entry,
      source: row.source,
    })
  }
  earnings.sort((a, b) => Number(b.inCatalog) - Number(a.inCatalog) || a.date.localeCompare(b.date))

  // Every US medium/high row; mergeEconomicEvents applies the cap (high impact first)
  // and drops FMP's copy of an FOMC decision the table already carries.
  const fmpEconomic: EconomicEvent[] = []
  if (econRes.status === 'fulfilled' && econRes.value.ok) {
    const rows = await econRes.value.json() as Array<{ event: string; date: string; country: string; impact?: string }>
    for (const row of rows) {
      if (row.country !== 'US') continue
      if ((row.impact ?? '').toLowerCase() === 'low') continue
      fmpEconomic.push({ event: row.event, date: row.date, country: row.country, impact: row.impact ?? null, source: 'fmp' })
    }
  }

  return NextResponse.json({
    ok: earnings.length > 0 || fmpEconomic.length > 0,
    configured: !!upcoming?.configured,
    fmpConfigured: !!FMP_KEY,
    earningsSources,
    earningsGap: earningsGap(earningsSources),
    earnings: earnings.slice(0, 120),
    economic: mergeEconomicEvents(fmpEconomic, fomc, undefined, releases),
    ...base,
  } satisfies MarketCalendarResponse)
}
