/**
 * Weekly readings → the stability rule (T-420 item 3). Pure: the rating route loads an
 * asset's rows from `asset_rating_readings`, calls `planWeeklyReading`, shows the result
 * and inserts `reading` with ON CONFLICT DO NOTHING.
 *
 * Three choices, each the conservative one:
 *  - A week's reading is the FIRST rating computed in it. Later ratings that week are
 *    shown as today's class but never replace the stored reading.
 *  - The window counts calendar weeks. A week with no reading (nobody opened the page)
 *    breaks the run, so a class moves only after `stabilityWeeks` CONSECUTIVE weeks of
 *    readings outside it. A gap holds the shown class; it never helps it move.
 *  - Only readings under the current methodology version count. A new version starts
 *    every asset at its current class, as a new rating does.
 */
import { METHODOLOGY_V1 as M } from './methodology/v1'
import { applyStability, type AssetRating, type RatedAssetKind, type RatingClassNumber } from './assetRating'

const DAY_MS = 86_400_000

/** Monday of `now`'s week, UTC, as YYYY-MM-DD. */
export function weekStartUtc(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return new Date(d.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10)
}

function previousWeek(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10)
}

/** The fields of a stored row this module reads. */
export interface StoredReading {
  weekStart: string
  methodologyVersion: string
  cls: number
  shownCls: number
}

/** The row to insert for this week. `score` is a string, as Drizzle writes numeric. */
export interface NewReading {
  assetKind: RatedAssetKind
  assetId: string
  weekStart: string
  methodologyVersion: string
  score: string
  cls: RatingClassNumber
  shownCls: RatingClassNumber
  coreCls: RatingClassNumber
  capped: boolean
}

export interface WeeklyPlan {
  /** The class to show. */
  shownCls: RatingClassNumber
  /** Today's class from the score alone. */
  currentCls: RatingClassNumber
  /** True when the rule is keeping the shown class away from today's. */
  held: boolean
  /** Consecutive weekly readings the rule looked at, this week's included. */
  weeksInRun: number
  /** This week's reading, to insert unless the week already has one (null then). */
  reading: NewReading | null
}

function asClass(n: number): RatingClassNumber {
  if (!Number.isInteger(n) || n < 1 || n > 7) throw new RangeError(`stored class ${n} is outside 1–7`)
  return n as RatingClassNumber
}

export function planWeeklyReading(args: {
  assetKind: RatedAssetKind
  assetId: string
  rating: Extract<AssetRating, { rated: true }>
  stored: readonly StoredReading[]
  now: Date
}): WeeklyPlan {
  const { assetKind, assetId, rating, now } = args
  const thisWeek = weekStartUtc(now)
  const byWeek = new Map<string, StoredReading>()
  for (const r of args.stored) {
    if (r.methodologyVersion !== rating.version || r.weekStart > thisWeek) continue
    byWeek.set(r.weekStart, r)
  }

  const stored = byWeek.get(thisWeek)
  const thisWeekCls = stored ? asClass(stored.cls) : rating.cls

  // Walk back from last week while every week has a reading.
  const prior: StoredReading[] = []
  for (let w = previousWeek(thisWeek); prior.length < M.stabilityWeeks - 1; w = previousWeek(w)) {
    const r = byWeek.get(w)
    if (!r) break
    prior.unshift(r)
  }
  // The class shown before this week comes from the latest earlier reading, gap or not:
  // a missed week must not restart the rating at today's class.
  const latestEarlier = [...byWeek.keys()].filter((w) => w < thisWeek).sort().pop()
  const previousShown = latestEarlier ? asClass(byWeek.get(latestEarlier)!.shownCls) : null

  const result = applyStability(previousShown, [...prior.map((r) => asClass(r.cls)), thisWeekCls])
  // The window holds this week's STORED reading; what the reader sees as today's class is today's.
  const shownCls = stored ? asClass(stored.shownCls) : result.shownCls

  return {
    shownCls,
    currentCls: rating.cls,
    held: shownCls !== rating.cls,
    weeksInRun: prior.length + 1,
    reading: stored ? null : {
      assetKind,
      assetId,
      weekStart: thisWeek,
      methodologyVersion: rating.version,
      score: rating.score.toFixed(2),
      cls: rating.cls,
      shownCls: result.shownCls,
      coreCls: rating.coreCls,
      capped: rating.capped,
    },
  }
}
