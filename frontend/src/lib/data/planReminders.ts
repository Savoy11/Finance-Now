// In-app rebalance reminders for saved Portfolio Builder plans (T-116, D237,
// 2026-11-21). The rules only: when a reminder is due and what it says. The
// monitoring loop is hooks/usePlanReminderMonitor.ts, mounted app-wide beside
// the price alerts; reminder state stays in this browser (the D209 posture, and
// what the draft Privacy Policy describes).
//
// What a reminder deliberately is NOT (D237): it carries no trade list and no
// buy/sell wording — the Plan Monitor page has the per-holding figures. It never
// covers a plan without a linked portfolio (hand-entered weights cannot be
// monitored in the background), and one plan reminds at most once a day.
// Counsel reviews the advice-adjacency question (brief A15) before launch; until
// then the reminder states the fact of the breach and carries the Builder's
// not-advice line (FEATURE_NOTICES.portfolioBuilder), never an instruction.

import { FEATURE_NOTICES } from '@/lib/legal/featureNotices'

/** Drift moves at portfolio speed, not price speed: four checks a day is plenty. */
export const PLAN_REMINDER_POLL_MS = 6 * 3_600_000

export const PLAN_REMINDER_STORAGE_KEY = 'fn:plan-reminders:v1'

/** The day (UTC) a moment falls on — the unit of "at most once a day". */
export function reminderDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** The two drift facts a reminder reads; the page reads the full DriftReport. */
export interface ReminderDrift {
  rebalanceDue: boolean
  maxDriftPts: number
}

/** Whether this plan reminds now: its drift breached the band, and not already today. */
export function planReminderDue(
  drift: ReminderDrift | null,
  lastRemindedOn: string | undefined,
  now: Date,
): boolean {
  if (!drift?.rebalanceDue) return false
  return lastRemindedOn !== reminderDay(now)
}

/**
 * The reminder's words: the fact of the breach and where to look — no trade list (D237).
 * `credit` is the price source's required attribution ("Powered by CoinGecko", T-424)
 * when a crypto leg was priced into the weights; a toast renders no SourceLine, so the
 * message carries it itself, as the price alerts' messages do.
 */
export function planReminderMessage(
  planName: string,
  drift: ReminderDrift,
  driftBandPct: number,
  credit?: string | null,
): string {
  const base =
    `"${planName}" has drifted outside its ${driftBandPct}% band ` +
    `(largest drift ${drift.maxDriftPts.toFixed(1)} points). ` +
    `The Portfolio Builder page has the details. ${FEATURE_NOTICES.portfolioBuilder}`
  return credit ? `${base} · ${credit}` : base
}
