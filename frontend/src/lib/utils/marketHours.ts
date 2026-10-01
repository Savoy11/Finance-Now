/**
 * When each kind of market trades — one place for the "When it trades" answers that
 * Compare's cross-class panel shows, and for the weekend caveat beside it.
 *
 * WHY THIS EXISTS (TS-9, docs/assessments/tokenized-securities-2026-09-21.md §7D, F8).
 * These answers were typed into `assetClassProfiles.ts` as fixed strings, and the one for
 * stocks and ETFs — "US exchange hours, weekdays." — has a known expiry: the SEC approved
 * Nasdaq's 23-hour weekday trading on 2026-04-10, and its start is reported for
 * 2026-12-06. A typed string cannot notice that. Here the overnight session is a dated
 * schedule with a status, and the label is computed from it.
 *
 * ⚠ THE REPORTED DATE NEVER FLIPS THE LABEL BY ITSELF. Until someone confirms the launch
 * and sets `launchStatus: 'confirmed'`, the label describes today's hours and says the
 * overnight session is approved with a REPORTED start — and once that date passes
 * unconfirmed, it says the start was reported and is not confirmed. A slipped launch must
 * never leave the app describing trading that is not happening.
 *
 * Only Nasdaq is dated here. The assessment records that NYSE and 24X hold comparable
 * 23×5 approvals, but no launch date for either, so neither appears in a label: a venue
 * gets named when there is a date to name it by.
 *
 * Facts about external markets, not advice — the same rule as the class profiles.
 */

// ─── Provenance ─────────────────────────────────────────────────────────────

/**
 * When every answer in this file was last checked as a whole.
 *
 * A MAINTAINER clock, not a disclosure clock: nothing renders an age to readers, because
 * the label already states its own status ("reported for…", then "was reported…") and
 * stays true without one. What the clock is for is making someone check the launch
 * before the reported date — `marketHours.test.ts` fails if, while the start is only
 * reported, this clock would fire on or after it.
 */
export const MARKET_HOURS_LAST_VERIFIED = '2026-10-01'
/**
 * When `npm run staleness:check` fires, check whether the launch happened or is
 * confirmed: if so, set `launchStatus: 'confirmed'` (correcting the date if it moved) and
 * check whether the overnight session covers every listed security or a subset — the
 * confirmed label says Nasdaq trades overnight, without qualification. If not, move the
 * reported date. Then re-date the anchor.
 */
export const MARKET_HOURS_STALE_AFTER_DAYS = 60

// ─── The one dated change ───────────────────────────────────────────────────

export interface OvernightSchedule {
  /** ISO date the overnight session starts (or is reported to start). */
  launch: string
  /** 'reported' until a primary source confirms the start; only 'confirmed' can make the label say it trades. */
  launchStatus: 'reported' | 'confirmed'
  /** The added session, in exchange time. */
  session: string
  source: string
}

export const NASDAQ_OVERNIGHT: OvernightSchedule = {
  launch: '2026-12-06',
  launchStatus: 'reported',
  session: '9 pm–4 am ET',
  source: 'SEC approval, Rel. 34-105199 (2026-04-10); start date as reported in the press, not yet confirmed by Nasdaq',
}

const launchTime = (schedule: OvernightSchedule) => Date.parse(`${schedule.launch}T00:00:00Z`)

/** True only once the start is confirmed AND its date has arrived. */
export function overnightSessionLive(now: Date, schedule: OvernightSchedule = NASDAQ_OVERNIGHT): boolean {
  return schedule.launchStatus === 'confirmed' && now.getTime() >= launchTime(schedule)
}

// ─── Venues ─────────────────────────────────────────────────────────────────

/** How an instrument trades — several instrument classes share one venue. */
export type TradingVenue = 'us-exchange' | 'fund-nav' | 'crypto' | 'futures' | 'fx' | 'us-rates'

const formatLaunch = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const US_MAIN_SESSION = 'Weekdays: the main session runs 9:30 am–4 pm ET, with pre-market and after-hours sessions around it'

function usExchangeLabel(now: Date, schedule: OvernightSchedule): string {
  const date = formatLaunch(schedule.launch)
  const arrived = now.getTime() >= launchTime(schedule)
  if (schedule.launchStatus === 'confirmed') {
    return arrived
      ? `${US_MAIN_SESSION}, and Nasdaq also trades overnight (${schedule.session}) — 23 hours a day in all.`
      : `${US_MAIN_SESSION}. Nasdaq adds an overnight session (${schedule.session}) for 23-hour trading on ${date}.`
  }
  return arrived
    ? `${US_MAIN_SESSION}. Nasdaq’s overnight session (${schedule.session}) was reported to start on ${date}; that start is not confirmed.`
    : `${US_MAIN_SESSION}. Nasdaq is approved to add an overnight session (${schedule.session}) for 23-hour trading; its start is reported for ${date}.`
}

/** What "When it trades" says for a venue, as of `now`. */
export function hoursLabel(venue: TradingVenue, now: Date = new Date(), schedule: OvernightSchedule = NASDAQ_OVERNIGHT): string {
  switch (venue) {
    case 'us-exchange': return usExchangeLabel(now, schedule)
    case 'fund-nav':    return 'Orders fill once daily at the close — no intraday trading.'
    case 'crypto':      return '24/7 — the market never closes.'
    case 'futures':     return 'Futures hours — most of the day on weekdays.'
    case 'fx':          return 'Around the clock on weekdays (global FX market).'
    case 'us-rates':    return 'Computed during bond-market hours, weekdays.'
  }
}

/**
 * Whether a venue's prices move on Saturdays and Sundays. Only crypto's do, and that is
 * what Compare's weekend caveat is about: correlation and beta pair two series on the
 * dates both have a close, so a seven-day market's weekend moves land in the next shared
 * day's figure instead of counting as days of their own.
 */
export function tradesOnWeekends(venue: TradingVenue): boolean {
  return venue === 'crypto'
}
