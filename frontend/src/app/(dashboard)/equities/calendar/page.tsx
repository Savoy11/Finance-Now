'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, KeyRound, Landmark } from 'lucide-react'
import { clsx } from 'clsx'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { ProvenanceNotice } from '@/components/ui/ProvenanceNotice'
import { STALE_TIME_LONG } from '@/lib/constants'
import { FOMC_SOURCE_URL, getFomcCalendarProvenance } from '@/lib/data/fomcCalendar'
import { RELEASE_AGENCIES, getReleaseDatesProvenance } from '@/lib/data/releaseCalendar'
import type { EarningsEvent, EconomicEvent, MarketCalendarResponse } from '@/app/live-data/market-calendar/route'
import { IpoCalendarSection } from './IpoCalendarSection'
import { isSecurityKey, securitySymbol, INSTRUMENT_BY_KEY } from '@/lib/data/instruments'
import { EARNINGS_SOURCE_NAMES, earningsTimeLabel } from '@/lib/data/earningsCalendar'
import { hydrateWatchlists, useWatchlistStore } from '@/store/useWatchlistStore'

// W3-6 (2026-08-20): "the calendar should look more like a calendar and allow
// users to flip through the months." The list view became a month GRID with
// prev/next navigation; a day's events expand below the grid when clicked.
// Range is bounded to ±12 months (the route clamps too) — FMP serves far dates
// thinly, and an honest empty month beats an unbounded pager into nothing.

const MONTH_SPAN = 12

interface MonthRef { year: number; month: number } // month 0-11

function monthKey(m: MonthRef): string {
  return `${m.year}-${String(m.month + 1).padStart(2, '0')}`
}

function monthLabel(m: MonthRef): string {
  return new Date(Date.UTC(m.year, m.month, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function shiftMonth(m: MonthRef, by: number): MonthRef {
  const d = new Date(Date.UTC(m.year, m.month + by, 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
}

function monthOffsetFromNow(m: MonthRef): number {
  const now = new Date()
  return (m.year - now.getFullYear()) * 12 + (m.month - now.getMonth())
}

/**
 * The grid's cells: leading blanks so day 1 lands under its weekday, then every
 * day of the month. Weeks start Sunday, matching every US market calendar.
 */
function monthCells(m: MonthRef): Array<string | null> {
  const first = new Date(Date.UTC(m.year, m.month, 1))
  const daysInMonth = new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: first.getUTCDay() }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return cells
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarContent() {
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [month, setMonth] = useState<MonthRef>({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDay, setSelectedDay] = useState<string | null>(todayIso)
  // T-458: show only the stocks on any of the reader's watchlists.
  const [watchedOnly, setWatchedOnly] = useState(false)
  const lists = useWatchlistStore((st) => st.lists)
  useEffect(() => { void hydrateWatchlists() }, [])
  const watched = useMemo(() => {
    const set = new Set<string>()
    for (const l of lists) for (const k of l.keys) {
      if (isSecurityKey(k) && (INSTRUMENT_BY_KEY[k]?.class ?? 'equity') === 'equity') set.add(securitySymbol(k).toUpperCase())
    }
    return set
  }, [lists])

  const { data, isLoading, isFetching } = useQuery<MarketCalendarResponse>({
    queryKey: ['market-calendar', monthKey(month)],
    queryFn: () => fetch(`/live-data/market-calendar?month=${monthKey(month)}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
    // Keep the previous month's grid visible while the next one loads — a
    // flash to empty on every arrow press reads as data loss.
    placeholderData: (prev) => prev,
  })

  const { earningsByDay, econByDay } = useMemo(() => {
    const e = new Map<string, EarningsEvent[]>()
    for (const row of data?.earnings ?? []) {
      if (watchedOnly && !watched.has(row.symbol.toUpperCase())) continue
      const day = row.date.slice(0, 10)
      e.set(day, [...(e.get(day) ?? []), row])
    }
    const c = new Map<string, EconomicEvent[]>()
    for (const row of data?.economic ?? []) {
      const day = row.date.slice(0, 10)
      c.set(day, [...(c.get(day) ?? []), row])
    }
    return { earningsByDay: e, econByDay: c }
  }, [data, watchedOnly, watched])

  const cells = useMemo(() => monthCells(month), [month])
  const offset = monthOffsetFromNow(month)
  const selEarnings = selectedDay ? earningsByDay.get(selectedDay) ?? [] : []
  const selEcon = selectedDay ? econByDay.get(selectedDay) ?? [] : []
  const configured = !!data?.configured
  const fomc = getFomcCalendarProvenance()
  const releases = getReleaseDatesProvenance()
  // Past the table's last row, "no FOMC meeting" means "not published yet", so say so.
  const pastFomcSchedule = monthKey(month) > fomc.through.slice(0, 7)

  return (
    <div className="space-y-5 max-w-(--breakpoint-xl) mx-auto">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-accent-blue" aria-hidden />
        <PageHeader
          title="Market Calendar"
          subtitle="Earnings, IPOs, Fed meetings and high-impact US economic events"
          description="A month grid of earnings dates for tracked and notable stocks, FOMC rate decisions, and medium/high-impact US economic releases. Click a day for its full list; flip months with the arrows."
          details={[{ label: 'Data source', text: 'Financial Modeling Prep for earnings (free key), with Alpha Vantage’s earnings calendar (free key) filling in companies FMP does not list, and other US economic releases (a paid FMP endpoint, empty on the free tier). FOMC meeting dates come from the Federal Reserve Board’s published calendar, and the CPI, jobs report, GDP and PCE dates from the Bureau of Labor Statistics’ and Bureau of Economic Analysis’ published schedules; all of these need no key.' }]}
        />
      </div>

      <SourceLine id="market-calendar" />

      <ProvenanceNotice
        label="FOMC dates: Federal Reserve Board"
        staleLabel="FOMC dates may be out of date"
        confidence={fomc.confidence}
        stale={fomc.stale}
      >
        Meeting dates copied from the{' '}
        <a href={FOMC_SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">Federal Reserve Board’s FOMC calendar</a>,
        last checked {fomc.verifiedAt} ({fomc.ageDays} day{fomc.ageDays === 1 ? '' : 's'} ago). The Fed treats each date as tentative until
        the meeting before it confirms it. Unscheduled meetings are not shown.
      </ProvenanceNotice>

      <ProvenanceNotice
        label="CPI, jobs, GDP and PCE dates: BLS and BEA"
        staleLabel="Release dates may be out of date"
        confidence={releases.confidence}
        stale={releases.stale}
      >
        Release dates copied from the published schedules of the{' '}
        <a href={RELEASE_AGENCIES.bls.scheduleUrls[0]} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">{RELEASE_AGENCIES.bls.name}</a>{' '}
        (CPI and the jobs report) and the{' '}
        <a href={RELEASE_AGENCIES.bea.scheduleUrls[0]} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">{RELEASE_AGENCIES.bea.name}</a>{' '}
        (GDP and PCE inflation), last checked {releases.verifiedAt}, through {releases.through}. An agency can move a date; its own page is the authority.
      </ProvenanceNotice>

      {/* Outside the FMP gate on purpose — IPOs come from Alpha Vantage, so
          someone with that key but no FMP key still sees them. */}
      <IpoCalendarSection />

      {isLoading ? (
        <div className="h-96 animate-shimmer bg-shimmer-gradient bg-size-[200%_100%] rounded-card" />
      ) : (
        <>
          {/* No earnings key: the grid still renders, because the Fed and release dates are keyless. */}
          {!configured && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/70" aria-hidden />
              <div>
                <p className="text-sm font-medium text-slate-200">Earnings need a free FMP or Alpha Vantage key</p>
                <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                  Fed meetings and the CPI, jobs, GDP and PCE dates below need no key. Earnings come from Financial Modeling Prep,
                  with Alpha Vantage behind it; either free key will do. Add one in{' '}
                  <Link href="/settings" className="text-accent-blue hover:underline">Settings → Integrations → Equity Market Data</Link>{' '}
                  — or set <code className="font-mono text-slate-300">FMP_API_KEY</code> or{' '}
                  <code className="font-mono text-slate-300">ALPHA_VANTAGE_API_KEY</code> in{' '}
                  <code className="font-mono text-slate-300">frontend/.env.local</code>. An FMP key also upgrades stock quotes suite-wide.
                </p>
              </div>
            </div>
          )}
          {configured && data?.earningsGap && (
            <p className="px-1 text-[11px] text-amber-400/90">{data.earningsGap}</p>
          )}
          {configured && data && !data.fmpConfigured && (
            <p className="px-1 text-[11px] text-text-muted">
              Earnings here come from Alpha Vantage, which lists the next three months; with no FMP key, earlier and later months show none.
            </p>
          )}
          {/* Month navigation */}
          <div className="flex items-center justify-between rounded-card border border-border bg-bg-card px-4 py-2.5">
            <button
              onClick={() => { setMonth((m) => shiftMonth(m, -1)); setSelectedDay(null) }}
              disabled={offset <= -MONTH_SPAN}
              aria-label="Previous month"
              className="rounded-sm p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-text-primary">{monthLabel(month)}</h2>
              {offset !== 0 && (
                <button
                  onClick={() => { setMonth({ year: today.getFullYear(), month: today.getMonth() }); setSelectedDay(todayIso) }}
                  className="rounded-sm border border-border px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:text-text-primary"
                >
                  Today
                </button>
              )}
              {isFetching && <span className="text-[11px] text-text-muted">updating…</span>}
              <label className="flex items-center gap-1.5 text-[11px] text-text-muted" title={watched.size === 0 ? 'No stocks on your watchlists yet' : undefined}>
                <input type="checkbox" checked={watchedOnly} onChange={(e) => setWatchedOnly(e.target.checked)}
                  className="rounded-sm border-border" disabled={watched.size === 0} />
                My watchlists only
              </label>
            </div>
            <button
              onClick={() => { setMonth((m) => shiftMonth(m, 1)); setSelectedDay(null) }}
              disabled={offset >= MONTH_SPAN}
              aria-label="Next month"
              className="rounded-sm p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {pastFomcSchedule && (
            <p className="px-1 text-[11px] text-text-muted">
              The Fed has not published FOMC dates past {new Date(`${fomc.through}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} yet,
              so no meeting shows this month.
            </p>
          )}

          {/* Month grid */}
          <div className="overflow-hidden rounded-card border border-border bg-bg-card">
            <div className="grid grid-cols-7 border-b border-border">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((iso, i) => {
                if (!iso) return <div key={`blank-${i}`} className="min-h-[84px] border-b border-r border-border/40 bg-bg-elevated/20" />
                const dayEarnings = earningsByDay.get(iso) ?? []
                const dayEcon = econByDay.get(iso) ?? []
                const dayFomc = dayEcon.find((e) => e.source === 'federal-reserve')
                const dayReleases = dayEcon.filter((e) => e.source === 'bls' || e.source === 'bea')
                const otherEcon = dayEcon.filter((e) => e.source === 'fmp')
                const catalogRows = dayEarnings.filter((e) => e.inCatalog)
                const isToday = iso === todayIso
                const isSelected = iso === selectedDay
                const dayNum = Number(iso.slice(8, 10))
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDay(isSelected ? null : iso)}
                    className={clsx(
                      'min-h-[84px] border-b border-r border-border/40 p-1.5 text-left align-top transition-colors',
                      isSelected ? 'bg-accent-blue/10' : 'hover:bg-bg-elevated/60',
                    )}
                    aria-pressed={isSelected}
                    aria-label={`${iso}: ${dayEarnings.length} earnings, ${dayEcon.length} economic events`}
                  >
                    <span className={clsx(
                      'inline-flex size-5 items-center justify-center rounded-full text-[11px] font-medium',
                      isToday ? 'bg-accent-blue text-white' : 'text-text-secondary',
                    )}>
                      {dayNum}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {/* The rate decision outranks everything else on its day. */}
                      {dayFomc && (
                        <span className="block truncate rounded-sm bg-red-400/10 px-1 py-px text-[10px] font-semibold text-red-400">
                          FOMC{dayFomc.tentative ? ' (tent.)' : ''}
                        </span>
                      )}
                      {dayReleases.map((e) => (
                        <span key={e.event} className="block truncate rounded-sm bg-amber-400/10 px-1 py-px text-[10px] font-semibold text-amber-400">
                          {releaseChip(e.event)}
                        </span>
                      ))}
                      {/* Tracked names first, at most three chips per cell —
                          the day panel below carries the full list. */}
                      {catalogRows.slice(0, 3).map((e) => (
                        <span key={e.symbol} className="block truncate rounded-sm bg-accent-blue/15 px-1 py-px font-mono text-[10px] text-accent-blue">
                          {e.symbol}
                        </span>
                      ))}
                      {dayEarnings.length > catalogRows.slice(0, 3).length && (
                        <span className="block px-1 text-[10px] text-text-muted">
                          +{dayEarnings.length - catalogRows.slice(0, 3).length} more
                        </span>
                      )}
                      {otherEcon.length > 0 && (
                        <span className="block truncate px-1 text-[10px] text-amber-400">
                          {otherEcon.length} econ
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected-day detail */}
          {selectedDay && (selEarnings.length > 0 || selEcon.length > 0) && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-card border border-border bg-bg-card overflow-hidden">
                <div className="border-b border-border px-4 py-2.5">
                  <h3 className="text-sm font-medium text-text-secondary">
                    Earnings · {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <div className="max-h-80 divide-y divide-border/60 overflow-y-auto">
                  {selEarnings.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-text-muted">
                      {!configured ? 'Earnings need an FMP or Alpha Vantage key (see above).'
                        : watchedOnly ? 'None of your watched stocks reports this day.' : 'No earnings this day.'}
                    </p>
                  )}
                  {selEarnings.map((e, i) => (
                    <div key={`${e.symbol}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                      {e.inCatalog ? (
                        <Link href={`/equities/${e.symbol.toLowerCase()}`} className="w-16 truncate font-mono font-semibold text-accent-blue hover:underline">{e.symbol}</Link>
                      ) : (
                        <span className="w-16 truncate font-mono text-text-secondary">{e.symbol}</span>
                      )}
                      <span className="flex-1 truncate text-xs text-text-muted">
                        {e.name}{earningsTimeLabel(e.time) ? ` · ${earningsTimeLabel(e.time)}` : ''}
                      </span>
                      {e.epsEstimate != null && <span className="font-mono text-[11px] text-text-muted">est. EPS {e.epsEstimate.toFixed(2)}</span>}
                      {e.source === 'alpha-vantage' && (
                        <span className="text-[10px] text-text-muted" title="Not on FMP's list; listed by Alpha Vantage">{EARNINGS_SOURCE_NAMES[e.source]}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-card border border-border bg-bg-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <Landmark size={14} className="text-text-muted" aria-hidden />
                  <h3 className="text-sm font-medium text-text-secondary">US Economic Events</h3>
                </div>
                <div className="max-h-80 divide-y divide-border/60 overflow-y-auto">
                  {selEcon.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-text-muted leading-relaxed">
                      No events this day. Fed meetings and the CPI, jobs, GDP and PCE releases always show; other
                      releases come from FMP&rsquo;s economic calendar, a <span className="text-text-secondary">paid-tier endpoint</span> that
                      is empty on a free key (earnings are unaffected).
                    </p>
                  )}
                  {selEcon.map((ev, i) => (
                    <div key={`${ev.event}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                      {ev.source !== 'fmp' && ev.url ? (
                        <a href={ev.url} target="_blank" rel="noreferrer" className="flex-1 text-xs text-text-secondary hover:text-text-primary hover:underline">
                          {ev.event}
                        </a>
                      ) : (
                        <span className="flex-1 text-xs text-text-secondary">{ev.event}</span>
                      )}
                      {ev.tentative && (
                        <span
                          className="rounded-sm border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                          title="The Fed confirms each date at the meeting before it."
                        >
                          Tentative
                        </span>
                      )}
                      {ev.impact && (
                        <span className={clsx('rounded-sm border px-1.5 py-0.5 text-[10px] font-medium capitalize',
                          ev.impact.toLowerCase() === 'high'
                            ? 'border-red-500/20 bg-red-400/10 text-red-400'
                            : 'border-amber-500/20 bg-amber-400/10 text-amber-400')}>
                          {ev.impact}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** A release row's short name for a calendar cell: "CPI", "Jobs", "GDP", "PCE". */
function releaseChip(event: string): string {
  if (event.startsWith('CPI')) return 'CPI'
  if (event.startsWith('Jobs')) return 'Jobs'
  if (event.startsWith('GDP')) return 'GDP'
  if (event.startsWith('PCE')) return 'PCE'
  return 'Release'
}

export default function MarketCalendarPage() {
  return (
    <ModuleGate module="equities">
      <CalendarContent />
    </ModuleGate>
  )
}
