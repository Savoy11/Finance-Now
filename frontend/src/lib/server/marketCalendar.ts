// Market Calendar — the economic-events half, as pure functions so it can be tested
// without a route or a key. The route (`/live-data/market-calendar`) fetches FMP and
// hands the rows here; the FOMC rows come from the hand-maintained table in
// lib/data/fomcCalendar.ts and need no key.

import { FOMC_SOURCE_URL, fomcMeetingsBetween, isFomcMeetingTentative } from '@/lib/data/fomcCalendar'

export interface EconomicEvent {
  event: string
  date: string
  country: string
  impact: string | null
  /** Who published the row. FOMC rows are keyless; FMP rows need FMP's paid plan. */
  source: 'fmp' | 'federal-reserve'
  /** FOMC rows only: the Board marks a date tentative until the meeting before it confirms it. */
  tentative?: boolean
  /** FOMC rows only: the Board's calendar page, which the Board asks to be cited. */
  url?: string
}

/**
 * FMP rows kept per request. FOMC rows never count against it.
 *
 * Before 2026-10-03 the route stopped at the first 40 rows in FMP's order, so in a busy
 * month a late high-impact release could be cut while routine medium ones were kept.
 * The cap now keeps high-impact rows first.
 */
export const FMP_ECON_CAP = 40

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
}

function meetingSpan(start: string, end: string): string {
  // Same month → "Oct 27–28"; a meeting spanning a month end → "Apr 30–May 1".
  return start.slice(5, 7) === end.slice(5, 7)
    ? `${shortDate(start)}–${Number(end.slice(8, 10))}`
    : `${shortDate(start)}–${shortDate(end)}`
}

/** One row per FOMC meeting whose decision day falls in [from, to]. */
export function fomcEventsBetween(from: string, to: string, now: Date = new Date()): EconomicEvent[] {
  return fomcMeetingsBetween(from, to).map(({ meeting, index }) => ({
    event: `FOMC rate decision${meeting.projections ? ' + economic projections' : ''} (meeting ${meetingSpan(meeting.start, meeting.end)})`,
    date: meeting.end,
    country: 'US',
    impact: 'High',
    source: 'federal-reserve' as const,
    tentative: isFomcMeetingTentative(index, now),
    url: FOMC_SOURCE_URL,
  }))
}

// FMP's own rows for the decision itself. Dropped on an FOMC decision day so the day does
// not list the same decision twice; FMP's other Fed rows (press conference, minutes,
// speeches) are kept.
const FMP_FED_DECISION = /interest rate decision|fomc statement|fomc economic projections/i

function rank(e: EconomicEvent): number {
  return (e.impact ?? '').toLowerCase() === 'high' ? 0 : 1
}

/**
 * FOMC rows plus FMP's US rows, in date order. FMP rows that repeat an FOMC decision are
 * dropped, then the FMP rows are capped — high impact first, then by date — and the
 * FOMC rows are added outside the cap.
 */
export function mergeEconomicEvents(
  fmp: EconomicEvent[],
  fomc: EconomicEvent[],
  cap: number = FMP_ECON_CAP,
): EconomicEvent[] {
  const fomcDays = new Set(fomc.map((e) => e.date.slice(0, 10)))
  const kept = fmp
    .filter((e) => !(fomcDays.has(e.date.slice(0, 10)) && FMP_FED_DECISION.test(e.event)))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.e.date.localeCompare(b.e.date) || a.i - b.i)
    .slice(0, cap)
    .map(({ e }) => e)
  return [...fomc, ...kept].sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)))
}
