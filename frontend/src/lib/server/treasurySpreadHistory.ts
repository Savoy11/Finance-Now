import 'server-only'

import { recordProviderFetch } from '@/lib/api/live/providers'
import {
  SPREAD_KEYS, dailySpreads, gapNow, invertedStretches,
  type GapNow, type InvertedStretch, type SpreadKey, type SpreadPoint,
} from '@/lib/data/curveSpreads'
import { intervalFor, lastOfEachWeek, rangeStart, yearsFor, type HistoryRange } from '@/lib/data/dailyHistory'
import { fetchCurveYear, type CurveSnapshot } from './treasuryCurve'
import { yearsOf } from './treasuryHistory'

// ─── The gaps between short and long Treasury yields, over time (T-464) ──────
// The 2s10s and 3m10y gaps' history, the stretches when each was below zero ("inverted"), and
// where each stands now, from the same official yearly curve files the yield charts read
// (lib/server/treasuryHistory.ts). Shared by /live-data/treasury-spread-history and the macro
// agent's yield-curve tool. The arithmetic is pure, in lib/data/curveSpreads.ts.
//
// Where each gap stands needs its most recent stretch below zero, fully dated: the one it is in
// now, or the last one before. Whether the curve turned a month or two years ago is the point
// of showing it. A short range reads only this year's file, which may hold no stretch, or a
// stretch reaching back to the file's first day, so earlier years are read one at a time, back
// to LOOKBACK_YEARS, until each gap's most recent stretch has a known start.

/** How far back each gap's most recent stretch below zero is looked for. */
export const LOOKBACK_YEARS = 10

export interface SpreadHistory {
  range: HistoryRange
  interval: 'daily' | 'weekly'
  /** The chart's readings, from the range's first day; each week's last over a span longer than a year. */
  points: SpreadPoint[]
  /** Each gap's stretches below zero that end within the range, from the daily readings, oldest first. */
  stretches: Record<SpreadKey, InvertedStretch[]>
  /** Where each gap stands at the latest reading. */
  now: Record<SpreadKey, GapNow | null>
  /** Calendar years whose file could not be read, oldest first. */
  missingYears: number[]
  /** The first reading read, for "not below zero since …" when no stretch was found. */
  readFrom: string
}

/** True when a gap's most recent stretch below zero is not in the readings, or its start is not. */
function needsEarlier(daily: readonly SpreadPoint[], key: SpreadKey): boolean {
  const stretches = invertedStretches(daily, key)
  const last = stretches[stretches.length - 1]
  return !last || !last.startKnown
}

/** Throws when no reading at all could be had in the range. */
export async function fetchSpreadHistory(range: HistoryRange, now: Date = new Date()): Promise<SpreadHistory> {
  try {
    const years = yearsFor(range, now)
    const par = await yearsOf(years, 'par', now)
    const snapshots: CurveSnapshot[] = [...par.snapshots]
    const missing = [...par.missing]
    let daily = dailySpreads(snapshots)

    // Read earlier years until each gap's most recent stretch below zero has a known start.
    const floor = now.getUTCFullYear() - LOOKBACK_YEARS
    let first = years[0]
    while (first > floor && daily.length > 0 && SPREAD_KEYS.some((k) => needsEarlier(daily, k))) {
      first -= 1
      try {
        snapshots.unshift(...(await fetchCurveYear(first, 'par', now)))
        daily = dailySpreads(snapshots)
      } catch {
        missing.push(first)
        break
      }
    }

    const from = rangeStart(range, now)
    const inRange = daily.filter((p) => p.date >= from)
    if (inRange.length === 0) throw new Error(missing.length ? `treasury.gov could not be read for ${missing.join(', ')}` : 'no readings in range')
    const interval = intervalFor(range)
    const stretches = Object.fromEntries(SPREAD_KEYS.map((k) => [k, invertedStretches(daily, k).filter((s) => s.end >= from)])) as Record<SpreadKey, InvertedStretch[]>
    const nowByKey = Object.fromEntries(SPREAD_KEYS.map((k) => [k, gapNow(daily, k)])) as Record<SpreadKey, GapNow | null>
    recordProviderFetch('treasury-gov', { count: inRange.length })
    return {
      range, interval,
      points: interval === 'daily' ? inRange : lastOfEachWeek(inRange),
      stretches, now: nowByKey,
      missingYears: [...new Set(missing)].sort((a, b) => a - b),
      readFrom: daily[0].date,
    }
  } catch (err) {
    recordProviderFetch('treasury-gov', { error: err instanceof Error ? err.message : 'fetch failed' })
    throw err
  }
}
