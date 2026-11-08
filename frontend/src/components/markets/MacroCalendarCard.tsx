'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CalendarClock, Landmark } from 'lucide-react'
import { ProvenanceNotice } from '@/components/ui/ProvenanceNotice'
import { useIsClient } from '@/hooks/useIsClient'
import { FOMC_SOURCE_URL, getFomcCalendarProvenance } from '@/lib/data/fomcCalendar'
import { RELEASE_AGENCIES, RELEASE_KINDS, getReleaseDatesProvenance, releaseLabel } from '@/lib/data/releaseCalendar'
import { fedMeetingsInYear, macroCalendarNext, daysUntil, meetingDays, shortDay } from '@/lib/data/macroCalendar'

// The Fed's meetings and the four US releases on the Macro pages (T-456 a and d, D211).
// Read from the two hand-kept tables, so nothing is fetched; drawn only once the browser has
// the page, since "next" depends on today's date and the server's day can differ from the reader's.

export function MacroCalendarCard({ full = false }: {
  /** Bonds & Rates: also the Fed's whole schedule for this year and next. */
  full?: boolean
}) {
  const isClient = useIsClient()
  const now = useMemo(() => (isClient ? new Date() : null), [isClient])
  const next = useMemo(() => (now ? macroCalendarNext(now) : null), [now])
  const fomc = getFomcCalendarProvenance()
  const releases = getReleaseDatesProvenance()

  return (
    <section aria-labelledby="macro-calendar-heading" className="rounded-card border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-accent-blue" aria-hidden />
        <h2 id="macro-calendar-heading" className="text-sm font-semibold text-text-primary">Fed meetings and US releases</h2>
      </div>

      {!next || !now ? (
        <p className="text-xs text-text-muted">Loading the calendar…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Next Fed meeting</p>
            {next.fed ? (
              <>
                <p className="text-sm text-text-primary">
                  <Landmark size={13} className="inline -mt-0.5 mr-1 text-red-400" aria-hidden />
                  {meetingDays(next.fed.meeting)} · rate decision {shortDay(next.fed.meeting.end)}
                  <span className="text-text-muted"> ({daysUntil(next.fed.meeting.end, now)})</span>
                </p>
                <p className="text-xs text-text-muted">
                  {next.fed.meeting.projections ? 'With the Fed’s economic projections. ' : ''}
                  {next.fed.tentative ? 'Tentative: the Fed confirms it at the meeting before.' : 'Confirmed at the meeting before.'}
                </p>
              </>
            ) : (
              <p className="text-xs text-text-muted">No meeting left in the table ({fomc.through}); the Fed has not published one yet.</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Next releases</p>
            {next.releases.length ? (
              <ul className="space-y-1">
                {next.releases.map((r) => (
                  <li key={`${r.kind}-${r.date}`} className="text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">{shortDay(r.date)}</span>
                    <span className="text-text-muted"> ({daysUntil(r.date, now)}) </span>
                    {releaseLabel(r)}
                    <span className="text-text-muted"> · {RELEASE_AGENCIES[RELEASE_KINDS[r.kind].agency].name}, {r.time}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">No release left in the table ({releases.through}).</p>
            )}
          </div>
        </div>
      )}

      {full && now && <FedYear now={now} />}

      <div className="grid gap-2 md:grid-cols-2">
        <ProvenanceNotice label="Fed dates: Federal Reserve Board" staleLabel="Fed dates may be out of date" confidence={fomc.confidence} stale={fomc.stale}>
          Copied by hand from the <a href={FOMC_SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">Federal Reserve Board’s FOMC calendar</a>,
          last checked {fomc.verifiedAt}. Unscheduled meetings are not shown.
        </ProvenanceNotice>
        <ProvenanceNotice label="Release dates: BLS and BEA" staleLabel="Release dates may be out of date" confidence={releases.confidence} stale={releases.stale}>
          Copied by hand from the schedules of the{' '}
          <a href={RELEASE_AGENCIES.bls.scheduleUrls[0]} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">{RELEASE_AGENCIES.bls.name}</a> and the{' '}
          <a href={RELEASE_AGENCIES.bea.scheduleUrls[0]} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">{RELEASE_AGENCIES.bea.name}</a>, last
          checked {releases.verifiedAt}. Times are as the schedules list them. Every date, with earnings, is on the{' '}
          <Link href="/equities/calendar" className="underline hover:text-slate-200">Market Calendar</Link>.
        </ProvenanceNotice>
      </div>
    </section>
  )
}

function FedYear({ now }: { now: Date }) {
  const year = now.getUTCFullYear()
  const years = [year, year + 1].map((y) => ({ y, meetings: fedMeetingsInYear(y, now) })).filter((x) => x.meetings.length)
  return (
    <div className="space-y-2">
      {years.map(({ y, meetings }) => (
        <div key={y}>
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Fed meetings in {y}</p>
          <ul className="flex flex-wrap gap-1.5">
            {meetings.map(({ meeting, held, tentative }) => (
              <li key={meeting.end}
                className={`rounded-sm border px-2 py-0.5 text-[11px] ${held ? 'border-border text-text-muted' : 'border-red-500/25 bg-red-400/5 text-text-secondary'}`}
                title={held ? 'Held' : tentative ? 'Tentative until the meeting before' : 'Confirmed'}>
                {meetingDays(meeting)}{meeting.projections ? ' *' : ''}{!held && tentative ? ' (tent.)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[11px] text-text-muted">* With the Fed’s economic projections. Past meetings are greyed.</p>
    </div>
  )
}
