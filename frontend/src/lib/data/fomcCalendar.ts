// ─────────────────────────────────────────────────────────────────────────────
// FOMC MEETING SCHEDULE — hand-maintained from the Federal Reserve Board's own calendar.
//
// WHY IT EXISTS. The Market Calendar's economic events come from FMP's economic-calendar
// endpoint, which is a paid-tier endpoint (402 on a free key). On the free key the page
// showed no Fed meetings at all — the one macro date nearly every reader plans around.
// These rows need no key and are merged into the page's economic events on every plan.
//
// WHY A TABLE AND NOT A FETCH. The Board publishes the schedule as an HTML page, with no
// feed or API, more than a year ahead, and changes it rarely. Scraping that page per
// request would add a parser that breaks quietly whenever its markup moves; a dated table
// with a review clock (`npm run staleness:check`) fails loudly instead. Nothing here is
// fetched at runtime.
//
// TERMS. The Board's website policy (https://www.federalreserve.gov/disclaimer.htm, read
// 2026-10-03, "Copyright/trademark"): "Unless otherwise indicated, information on Board's
// website is in the public domain and may be copied and distributed without permission.
// Please cite to the Board as the source of the information." The calendar page cites it
// in its source line and its provenance notice. Registry entry: lib/server/sourceTerms.ts.
//
// ⚠ DATES ARE TENTATIVE UNTIL CONFIRMED. The Board's own note under the schedule: "Each
// meeting date is tentative until confirmed at the meeting immediately preceding it."
// `isFomcMeetingTentative` applies exactly that rule, and the page labels those rows.
// Unscheduled meetings (March 2020, for example) are on no schedule and cannot appear here.
//
// TO REFRESH. Open FOMC_SOURCE_URL and compare EVERY row, including which meetings are
// asterisked (a Summary of Economic Projections). Add the next year once the Board lists
// it. Only then move FOMC_LAST_VERIFIED — never for a partial check (CLAUDE.md, "Data
// Files Reference").
// ─────────────────────────────────────────────────────────────────────────────

export const FOMC_SOURCE_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'

/**
 * The day every row below was compared against FOMC_SOURCE_URL. First compared 2026-10-03
 * (page "Last Update: September 16, 2026"); compared again in full on 2026-10-07, from the
 * owner's machine, against the page's "Last Update: October 07, 2026": every row, its end
 * date and its asterisk matched, and January 25-26, 2028 is still in the page's note.
 */
export const FOMC_LAST_VERIFIED = '2026-10-07'

// Quarterly. The Board publishes a new year's dates only once a year, but any tentative
// date can move at any of the eight meetings, so a quarter without a re-check is the most
// this table should go.
export const FOMC_STALE_AFTER_DAYS = 90

export interface FomcMeeting {
  /** First day of the two-day meeting (ISO date). */
  start: string
  /** Final day (ISO date). The policy statement — the rate decision — is released this day. */
  end: string
  /** Asterisked on the Board's page: comes with a Summary of Economic Projections. */
  projections: boolean
}

/** In date order. Covers 2025 so the page's 12-month look-back always has rows. */
export const FOMC_MEETINGS: readonly FomcMeeting[] = [
  // 2025
  { start: '2025-01-28', end: '2025-01-29', projections: false },
  { start: '2025-03-18', end: '2025-03-19', projections: true },
  { start: '2025-05-06', end: '2025-05-07', projections: false },
  { start: '2025-06-17', end: '2025-06-18', projections: true },
  { start: '2025-07-29', end: '2025-07-30', projections: false },
  { start: '2025-09-16', end: '2025-09-17', projections: true },
  { start: '2025-10-28', end: '2025-10-29', projections: false },
  { start: '2025-12-09', end: '2025-12-10', projections: true },
  // 2026
  { start: '2026-01-27', end: '2026-01-28', projections: false },
  { start: '2026-03-17', end: '2026-03-18', projections: true },
  { start: '2026-04-28', end: '2026-04-29', projections: false },
  { start: '2026-06-16', end: '2026-06-17', projections: true },
  { start: '2026-07-28', end: '2026-07-29', projections: false },
  { start: '2026-09-15', end: '2026-09-16', projections: true },
  { start: '2026-10-27', end: '2026-10-28', projections: false },
  { start: '2026-12-08', end: '2026-12-09', projections: true },
  // 2027
  { start: '2027-01-26', end: '2027-01-27', projections: false },
  { start: '2027-03-16', end: '2027-03-17', projections: true },
  { start: '2027-04-27', end: '2027-04-28', projections: false },
  { start: '2027-06-08', end: '2027-06-09', projections: true },
  { start: '2027-07-27', end: '2027-07-28', projections: false },
  { start: '2027-09-14', end: '2027-09-15', projections: true },
  { start: '2027-10-26', end: '2027-10-27', projections: false },
  { start: '2027-12-07', end: '2027-12-08', projections: true },
  // 2028 — the Board lists only this one so far: "A two-day meeting is scheduled for
  // January 25-26, 2028." It is not asterisked.
  { start: '2028-01-25', end: '2028-01-26', projections: false },
]

/** The last date the table covers. Past it, "no Fed meeting" means "not published yet". */
export function fomcScheduleThrough(): string {
  return FOMC_MEETINGS[FOMC_MEETINGS.length - 1].end
}

function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * The Board's rule, applied literally: a date stays tentative until the meeting
 * immediately before it has been held. The first row has no predecessor in the table
 * and is long past, so it counts as confirmed.
 */
export function isFomcMeetingTentative(index: number, now: Date = new Date()): boolean {
  const prev = FOMC_MEETINGS[index - 1]
  return !!prev && prev.end > isoDay(now)
}

/** Meetings whose decision day (`end`) falls inside [from, to], inclusive, with their index. */
export function fomcMeetingsBetween(from: string, to: string): Array<{ meeting: FomcMeeting; index: number }> {
  const out: Array<{ meeting: FomcMeeting; index: number }> = []
  FOMC_MEETINGS.forEach((meeting, index) => {
    if (meeting.end >= from && meeting.end <= to.slice(0, 10)) out.push({ meeting, index })
  })
  return out
}

// ── Staleness machinery (same pattern as stablecoinMeta.ts / transferFees.ts) ─────────

export function fomcCalendarAgeDays(now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(FOMC_LAST_VERIFIED).getTime()) / 86_400_000)
}

export function fomcCalendarIsStale(now: Date = new Date()): boolean {
  return fomcCalendarAgeDays(now) > FOMC_STALE_AFTER_DAYS
}

export type FomcCalendarConfidence = 'high' | 'medium' | 'low'

export interface FomcCalendarProvenance {
  source: string
  sourceUrl: string
  verifiedAt: string
  ageDays: number
  stale: boolean
  confidence: FomcCalendarConfidence
  /** Last date the table covers — see fomcScheduleThrough(). */
  through: string
}

export function getFomcCalendarProvenance(now: Date = new Date()): FomcCalendarProvenance {
  const ageDays = fomcCalendarAgeDays(now)
  const stale = ageDays > FOMC_STALE_AFTER_DAYS
  const confidence: FomcCalendarConfidence =
    ageDays <= 45 ? 'high' : ageDays <= FOMC_STALE_AFTER_DAYS ? 'medium' : 'low'
  return {
    source: 'Federal Reserve Board — FOMC meeting calendar (copied by hand)',
    sourceUrl: FOMC_SOURCE_URL,
    verifiedAt: FOMC_LAST_VERIFIED,
    ageDays,
    stale,
    confidence,
    through: fomcScheduleThrough(),
  }
}
