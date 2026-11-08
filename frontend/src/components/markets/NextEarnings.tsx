'use client'

import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { SourceLine } from '@/components/ui/SourceLine'
import { STALE_TIME_LONG } from '@/lib/constants'
import {
  EARNINGS_LOOK_AHEAD_DAYS, EARNINGS_SOURCE_NAMES, daysUntil, earningsTimeLabel, marketToday, type UpcomingEarnings,
} from '@/lib/data/earningsCalendar'
import type { EarningsDatesResponse } from '@/app/live-data/earnings-dates/route'

// The next expected earnings date (T-458, D213): on each stock page, and marked on watchlists.

/** Next expected reports for these symbols, from /live-data/earnings-dates. Shared by every caller. */
export function useEarningsDates(symbols: string[]) {
  const list = [...new Set(symbols.map((s) => s.toUpperCase()))].sort()
  return useQuery<EarningsDatesResponse>({
    queryKey: ['earnings-dates', list],
    queryFn: () => fetch(`/live-data/earnings-dates?${new URLSearchParams({ symbols: list.join(',') })}`).then((r) => r.json()),
    enabled: list.length > 0,
    staleTime: STALE_TIME_LONG,
  })
}

/** "Tue, Nov 17, 2026". The date is a calendar day, so it is read in UTC and never shifted by a time zone. */
export function earningsDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function inDays(date: string): string {
  const d = daysUntil(date, marketToday())
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
}

export function NextEarningsCard({ symbol }: { symbol: string }) {
  const { data, isLoading } = useEarningsDates([symbol])
  const next: UpcomingEarnings | null | undefined = data?.dates?.[symbol.toUpperCase()]

  return (
    <section aria-labelledby="next-earnings-heading" className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarClock size={14} className="text-text-muted" aria-hidden />
        <h2 id="next-earnings-heading" className="text-sm font-medium text-text-secondary">Next earnings</h2>
      </div>
      {isLoading ? (
        <div className="mt-3 h-8 w-40 animate-shimmer bg-shimmer-gradient bg-size-[200%_100%] rounded-sm" />
      ) : !data || data.configured === false ? (
        <p className="mt-2 text-xs text-text-muted leading-relaxed">
          Earnings dates need a free FMP or Alpha Vantage key, added in{' '}
          <Link href="/settings" className="text-accent-blue hover:underline">Settings → Integrations</Link>.
        </p>
      ) : !data.ok ? (
        <p className="mt-2 text-xs text-amber-400/90">The earnings calendars could not be reached right now.</p>
      ) : next ? (
        <>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{earningsDay(next.date)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {inDays(next.date)}{earningsTimeLabel(next.time) ? `, ${earningsTimeLabel(next.time)}` : ''}
          </p>
          <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
            Expected, as listed by {EARNINGS_SOURCE_NAMES[next.source]}. Companies often confirm the date late and can move it.
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-text-muted leading-relaxed">
          No date listed in the next {EARNINGS_LOOK_AHEAD_DAYS} days. The company may not have announced it yet.
        </p>
      )}
      {data?.configured && <div className="mt-3"><SourceLine id="earnings-dates" /></div>}
    </section>
  )
}
