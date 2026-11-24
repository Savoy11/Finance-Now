'use client'

// "Coming up" on Headlines (T-468, D242): the next Fed decision, the next
// CPI/jobs/GDP/PCE release and the watchlist stocks reporting soon, where every
// session starts. Pure assembly — the rules live in lib/data/thisWeek.ts; the
// tables and the earnings route belong to their own surfaces, which keep the
// detail. Renders nothing unless a module that carries dates is on, and the
// earnings request fires only with Equities on and stocks on a watchlist.

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { useEntitlementStore } from '@/store/useEntitlementStore'
import { hydrateWatchlists, useWatchlistStore } from '@/store/useWatchlistStore'
import { INSTRUMENT_BY_KEY, isSecurityKey, securitySymbol } from '@/lib/data/instruments'
import { useEarningsDates } from '@/components/markets/NextEarnings'
import { capEarnings, earningsItems, macroDateItems, thisWeekDay, thisWeekRows, thisWeekSources } from '@/lib/data/thisWeek'

export function ThisWeekStrip() {
  const macroOn = useEntitlementStore((s) => s.isEnabled('macro'))
  const equitiesOn = useEntitlementStore((s) => s.isEnabled('equities'))

  useEffect(() => { void hydrateWatchlists() }, [])

  // Stocks across every watchlist — funds and macro instruments report no
  // earnings, and a stock outside the instrument list is still a stock (T-458).
  const lists = useWatchlistStore((s) => s.lists)
  const stockSymbols = useMemo(() => {
    if (!equitiesOn) return []
    const keys = [...new Set(lists.flatMap((l) => l.keys))]
    return keys
      .filter((k) => isSecurityKey(k) && (INSTRUMENT_BY_KEY[k]?.class ?? 'equity') === 'equity')
      .map((k) => securitySymbol(k))
  }, [equitiesOn, lists])
  const { data: earnings } = useEarningsDates(stockSymbols)

  const { rows, moreEarnings } = useMemo(() => {
    const macro = macroDateItems({ macroOn, equitiesOn })
    const { shown, more } = capEarnings(equitiesOn ? earningsItems(earnings?.dates) : [])
    return { rows: thisWeekRows(macro, shown), moreEarnings: more }
  }, [macroOn, equitiesOn, earnings])

  const sources = useMemo(() => thisWeekSources(rows), [rows])

  if (rows.length === 0) return null

  return (
    <section aria-label="Coming up" className="bg-bg-card border border-border rounded-lg px-4 py-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <CalendarDays size={13} className="text-sky-300" aria-hidden />
        <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">Coming up</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            title={r.source}
            className="inline-flex items-baseline gap-1.5 px-2 py-1 rounded-md bg-bg-elevated border border-border text-xs hover:border-accent-blue/40 transition-colors"
          >
            <span className="font-medium text-text-primary">{r.label}</span>
            <span className="text-[11px] text-text-muted font-mono">
              {thisWeekDay(r.date)}
              {r.tentative ? ' · tentative' : ''}
              {r.timeLabel ? ` · ${r.timeLabel}` : ''}
            </span>
          </Link>
        ))}
        {moreEarnings > 0 && (
          <Link
            href="/equities/calendar"
            className="inline-flex items-center px-2 py-1 rounded-md bg-bg-elevated border border-border text-[11px] text-text-muted hover:border-accent-blue/40 hover:text-text-secondary transition-colors"
          >
            +{moreEarnings} more reporting →
          </Link>
        )}
      </div>
      {/* The BLS and BEA ask to be cited wherever their dates show (D211); the
          earnings line is T-458's "expected" labelling. Visible, not tooltip-only. */}
      <p className="text-[10px] text-text-muted leading-relaxed">{sources.join(' · ')}.</p>
    </section>
  )
}
