import { FOMC_MEETINGS, isFomcMeetingTentative, type FomcMeeting } from './fomcCalendar'
import { ECONOMIC_RELEASES, RELEASE_AGENCIES, RELEASE_KINDS, nextReleases, releaseLabel, type EconomicRelease } from './releaseCalendar'
import { addDays, marketToday } from '@/lib/utils/marketDay'

// The Macro pages' calendar (T-456 a and d, D211): what comes next from the Fed's meeting table
// and the BLS and BEA release table. Pure, with an injectable `now`, so its edge cases are tested.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// New York's day, as the tables' dates are (D214): in UTC, tomorrow's CPI read "today" from ~8 pm Eastern.
const isoDay = (now: Date) => marketToday(now)

/** "Dec 9, 2026". */
export function shortDay(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
}

/** "Dec 8–9, 2026", or "Apr 30–May 1, 2027" across a month end. */
export function meetingDays(m: FomcMeeting): string {
  const [ys, ms, ds] = [m.start.slice(0, 4), Number(m.start.slice(5, 7)), Number(m.start.slice(8, 10))]
  const [me, de] = [Number(m.end.slice(5, 7)), Number(m.end.slice(8, 10))]
  return ms === me ? `${MONTHS[ms - 1]} ${ds}–${de}, ${ys}` : `${MONTHS[ms - 1]} ${ds}–${MONTHS[me - 1]} ${de}, ${ys}`
}

/** "today", "tomorrow", "in 12 days", counted in whole days from New York's day. */
export function daysUntil(iso: string, now: Date): string {
  const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${isoDay(now)}T00:00:00Z`)) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}

export interface MacroCalendarNext {
  /** The next meeting whose decision day is today or later, or null past the table. */
  fed: { meeting: FomcMeeting; tentative: boolean } | null
  /** The next release of each kind, in date order. */
  releases: EconomicRelease[]
}

export function macroCalendarNext(now: Date = new Date()): MacroCalendarNext {
  const today = isoDay(now)
  const index = FOMC_MEETINGS.findIndex((m) => m.end >= today)
  return {
    fed: index >= 0 ? { meeting: FOMC_MEETINGS[index], tentative: isFomcMeetingTentative(index, now) } : null,
    releases: nextReleases(now),
  }
}

/** One year's meetings, each marked held or not, and tentative where the Fed's rule says so. */
export function fedMeetingsInYear(year: number, now: Date = new Date()): Array<{ meeting: FomcMeeting; held: boolean; tentative: boolean }> {
  const today = isoDay(now)
  return FOMC_MEETINGS.map((meeting, index) => ({ meeting, index }))
    .filter(({ meeting }) => meeting.end.startsWith(String(year)))
    .map(({ meeting, index }) => ({ meeting, held: meeting.end < today, tentative: isFomcMeetingTentative(index, now) }))
}

/** Every Fed decision and release in the next `days` days, in date order, for the macro agents. */
export function macroCalendarAhead(days: number, now: Date = new Date()): Array<{ date: string; event: string; kind: 'fed' | EconomicRelease['kind']; source: string }> {
  const from = isoDay(now)
  const to = addDays(from, days)
  const fed = FOMC_MEETINGS.map((meeting, index) => ({ meeting, index }))
    .filter(({ meeting }) => meeting.end >= from && meeting.end <= to)
    .map(({ meeting, index }) => ({
      date: meeting.end,
      kind: 'fed' as const,
      event: `Fed rate decision (meeting ${meetingDays(meeting)})${meeting.projections ? ', with economic projections' : ''}${isFomcMeetingTentative(index, now) ? ', tentative' : ''}`,
      source: 'Federal Reserve Board',
    }))
  const rel = ECONOMIC_RELEASES.filter((r) => r.date >= from && r.date <= to)
    .map((r) => ({ date: r.date, kind: r.kind, event: `${releaseLabel(r)}, ${r.time}`, source: RELEASE_AGENCIES[RELEASE_KINDS[r.kind].agency].name }))
  return [...fed, ...rel].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'fed' ? -1 : 1))
}
