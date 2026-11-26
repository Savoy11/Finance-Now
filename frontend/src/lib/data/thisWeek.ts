// ─────────────────────────────────────────────────────────────────────────────
// "COMING UP" ON HEADLINES (T-468, owner decision D242, 2026-11-24 — the pass's
// working name was the "This week" strip).
//
// The dates the app already keeps, surfaced where every session starts. Every
// figure here is hand-kept or already-fetched elsewhere: the Fed's meeting days
// (lib/data/fomcCalendar.ts), the CPI/jobs/GDP/PCE release days
// (lib/data/releaseCalendar.ts, T-456) and the watchlist stocks' expected
// report days (/live-data/earnings-dates, T-458). This module computes nothing
// new — it only picks the NEXT of each and shapes it for one strip, so the
// detail surfaces (/macro/rates, /equities/calendar, the Watchlist marks, each
// stock's Next earnings card) keep the detail and the landing page gets the
// glance.
//
// TWO RULES INHERITED, NOT INVENTED:
//  - Every row names who publishes its date (`source`): the BLS and BEA ask to
//    be cited and every surface showing their dates names its agency (D211);
//    earnings rows carry T-458's "expected" labelling. The strip prints the
//    distinct sources under the chips (thisWeekSources).
//  - Dates are calendar days, read in UTC and never shifted by a time zone —
//    the earningsDay rule.
// ─────────────────────────────────────────────────────────────────────────────

import { FOMC_MEETINGS, isFomcMeetingTentative } from './fomcCalendar'
import { RELEASE_AGENCIES, RELEASE_KINDS, nextReleases } from './releaseCalendar'
import { earningsTimeLabel, isEarningsSoon, marketToday, type UpcomingEarnings } from './earningsCalendar'

export type ThisWeekKind = 'fomc' | 'release' | 'earnings'

export interface ThisWeekItem {
  id: string
  kind: ThisWeekKind
  /** "Fed rate decision", "CPI inflation (October 2026)", "AAPL earnings". */
  label: string
  /** The event's calendar day (ISO date). */
  date: string
  /** The page with the detail. */
  href: string
  /** Who publishes the date — shown on the strip, not only in a tooltip (D211). */
  source: string
  /** FOMC only: dates after the next meeting are tentative, the Board's own rule. */
  tentative?: boolean
  /** Earnings only: "before the open" / "after the close" where the calendar says. */
  timeLabel?: string | null
}

export const FED_SOURCE = 'Dates: Federal Reserve Board'
export const EARNINGS_SOURCE = 'Earnings dates are expected, as listed by the earnings calendars; companies can move them'

/** The next Fed decision day (the meeting's final day) on or after now, or null past the table. */
export function nextFomcDecision(now: Date = new Date()): { date: string; tentative: boolean } | null {
  const today = marketToday(now)
  const index = FOMC_MEETINGS.findIndex((m) => m.end >= today)
  if (index === -1) return null
  return { date: FOMC_MEETINGS[index].end, tentative: isFomcMeetingTentative(index, now) }
}

/**
 * The macro dates: the next Fed decision and the next release of each kind, in
 * date order. Empty unless a module that shows these tables is on; rows link to
 * the Macro section when the reader has it, else the Equities calendar — both
 * render the full tables with their provenance.
 */
export function macroDateItems(opts: { macroOn: boolean; equitiesOn: boolean; now?: Date }): ThisWeekItem[] {
  const { macroOn, equitiesOn } = opts
  if (!macroOn && !equitiesOn) return []
  const now = opts.now ?? new Date()
  const href = macroOn ? '/macro/rates' : '/equities/calendar'
  const out: ThisWeekItem[] = []
  const fomc = nextFomcDecision(now)
  if (fomc) {
    out.push({ id: 'fomc', kind: 'fomc', label: 'Fed rate decision', date: fomc.date, href, source: FED_SOURCE, tentative: fomc.tentative })
  }
  for (const rel of nextReleases(now)) {
    const kindInfo = RELEASE_KINDS[rel.kind]
    out.push({
      id: `release:${rel.kind}`,
      kind: 'release',
      label: `${kindInfo.name} (${rel.period})`,
      date: rel.date,
      href,
      source: RELEASE_AGENCIES[kindInfo.agency].citation,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
}

/**
 * Watchlist stocks expected to report within EARNINGS_SOON_DAYS (T-458's own
 * window), in date order. The route already serves each symbol's next expected
 * report on or after today; this keeps only the imminent ones.
 */
export function earningsItems(dates: Record<string, UpcomingEarnings | null> | undefined, now: Date = new Date()): ThisWeekItem[] {
  if (!dates) return []
  const today = marketToday(now)
  const out: ThisWeekItem[] = []
  for (const [symbol, next] of Object.entries(dates)) {
    if (!next || !isEarningsSoon(next, today)) continue
    out.push({
      id: `earnings:${symbol}`,
      kind: 'earnings',
      label: `${symbol} earnings`,
      date: next.date,
      href: `/equities/${symbol.toLowerCase()}`,
      source: EARNINGS_SOURCE,
      timeLabel: earningsTimeLabel(next.time),
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
}

/**
 * A big watchlist can put a dozen stocks inside the window; the strip shows the
 * nearest few and points the rest at the Market Calendar's watchlist view.
 */
export const MAX_EARNINGS_CHIPS = 6

export function capEarnings(items: ThisWeekItem[], max: number = MAX_EARNINGS_CHIPS): { shown: ThisWeekItem[]; more: number } {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) }
}

/** Everything in date order; same-day rows sort by label so the order is stable. */
export function thisWeekRows(macro: ThisWeekItem[], earnings: ThisWeekItem[]): ThisWeekItem[] {
  return [...macro, ...earnings].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
}

/** The distinct source citations of what is shown, in first-appearance order. */
export function thisWeekSources(rows: ThisWeekItem[]): string[] {
  const out: string[] = []
  for (const r of rows) if (!out.includes(r.source)) out.push(r.source)
  return out
}

/** "Tue, Dec 9" — a calendar day, read in UTC so no time zone shifts it (the earningsDay rule). */
export function thisWeekDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * The same facts, shaped as given context for the Daily Brief's prompt (T-475,
 * D245). The Brief's task asks the agent for "Worth watching", but its runner
 * carries no calendar tool — so the section was whatever web search surfaced,
 * for users whose Headlines strip shows the real dates. Handing the dates over
 * as context is the D136 lesson (give an agent the figures it will quote, with
 * their sources, worked out); the publishers travel into the prompt because
 * the BLS and BEA ask to be cited wherever their dates show (D211), and
 * earnings keep T-458's "expected" wording through each row's own source line.
 */
export function briefDatesContext(rows: ThisWeekItem[]): string | null {
  if (rows.length === 0) return null
  const lines = rows.map((r) => {
    const when = [
      r.date,
      r.tentative ? 'tentative, the Board’s own rule' : null,
      r.timeLabel ?? null,
    ].filter(Boolean).join(', ')
    return `${r.label}: ${when} (${r.source})`
  })
  return (
    'Known upcoming dates from the app’s own calendars — ground "Worth watching" in these, '
    + 'name each date’s publisher as given, and do not invent other dates: '
    + `${lines.join('; ')}.`
  )
}
