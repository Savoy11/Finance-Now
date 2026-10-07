import { NextRequest, NextResponse } from 'next/server'
import { EQUITY_BY_SYMBOL } from '@/lib/data/equityCatalog'
import { getProviderKey } from '@/lib/api/live/providers'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { fomcEventsBetween, mergeEconomicEvents, type EconomicEvent } from '@/lib/server/marketCalendar'
import { fomcScheduleThrough } from '@/lib/data/fomcCalendar'

// Earnings + economic calendar for the equities module.
//
// - Earnings: FMP, free key.
// - US economic releases: FMP's economic calendar, a PAID endpoint (402 on free).
// - FOMC meetings: keyless — the hand-maintained table in lib/data/fomcCalendar.ts,
//   copied from the Federal Reserve Board's calendar (added 2026-10-03). Returned on
//   every plan, including with no FMP key at all.
//
// Without an FMP key the route reports configured:false so the UI shows an honest setup
// notice for earnings, and still returns the FOMC rows.

export const dynamic = 'force-dynamic'

export type { EconomicEvent }

export interface EarningsEvent {
  symbol: string
  name: string
  date: string
  epsEstimate: number | null
  time: string | null
  inCatalog: boolean
}

export interface MarketCalendarResponse {
  /**
   * FMP returned at least one row. FOMC rows do NOT count: they are always present, so
   * counting them would make a dead FMP leg read as "no earnings scheduled" (the research
   * agent's get_market_calendar tool relies on this).
   */
  ok: boolean
  /** An FMP key is configured. */
  configured: boolean
  from: string
  to: string
  earnings: EarningsEvent[]
  economic: EconomicEvent[]
  /** Last date the FOMC table covers. Past it, no FOMC row means "not published yet". */
  fomcThrough: string
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
    from = new Date().toISOString().slice(0, 10)
    to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  }
  const base = { from, to, fomcThrough: fomcScheduleThrough(), updatedAt: new Date().toISOString() }

  // Keyless, so computed before the key check: these show on every plan.
  const fomc = fomcEventsBetween(from, to)

  // UI-saved key (Integrations page) or FMP_API_KEY env var
  const FMP_KEY = getProviderKey('fmp')
  if (!FMP_KEY) {
    return NextResponse.json({ ok: false, configured: false, earnings: [], economic: fomc, ...base } satisfies MarketCalendarResponse)
  }

  // FMP /stable API. Earnings works on the free tier; the economic calendar is
  // a paid endpoint (402 on free) — Promise.allSettled lets it fail silently.
  const stable = 'https://financialmodelingprep.com/stable'
  const [earningsRes, econRes] = await Promise.allSettled([
    fetch(`${stable}/earnings-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }),
    fetch(`${stable}/economic-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }),
  ])

  const earnings: EarningsEvent[] = []
  if (earningsRes.status === 'fulfilled' && earningsRes.value.ok) {
    const rows = await earningsRes.value.json() as Array<{ symbol: string; date: string; epsEstimated: number | null }>
    for (const row of rows) {
      const entry = EQUITY_BY_SYMBOL[row.symbol?.toUpperCase() ?? '']
      // Catalog names first; cap the long tail of non-catalog names
      if (!entry && earnings.filter((e) => !e.inCatalog).length >= 120) continue
      earnings.push({
        symbol: row.symbol,
        name: entry?.name ?? row.symbol,
        date: row.date,
        epsEstimate: row.epsEstimated ?? null,
        time: null, // /stable earnings-calendar has no BMO/AMC session field
        inCatalog: !!entry,
      })
    }
    earnings.sort((a, b) => Number(b.inCatalog) - Number(a.inCatalog) || a.date.localeCompare(b.date))
  }

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
    configured: true,
    earnings: earnings.slice(0, 120),
    economic: mergeEconomicEvents(fmpEconomic, fomc),
    ...base,
  } satisfies MarketCalendarResponse)
}
