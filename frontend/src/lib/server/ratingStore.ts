import 'server-only'

import { and, desc, eq, lte } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { assetRatingReadings } from '@/lib/db/schema'
import { METHODOLOGY_V1 as M } from '@/lib/risk/methodology/v1'
import { planWeeklyReading, weekStartUtc, type WeeklyPlan } from '@/lib/risk/ratingReadings'
import type { AssetRating, RatedAssetKind } from '@/lib/risk/assetRating'

// The weekly readings behind the stability rule (T-420 items 3–4; methodology §5 item 6).
// The rule lives in lib/risk/ratingReadings.ts; this file only loads and stores rows.

/** Why a rating could not be put through the stability rule. The routes answer 503 with the message. */
export class RatingStoreUnavailable extends Error {
  constructor(readonly why: 'not-configured' | 'not-migrated') {
    super(why === 'not-configured'
      ? 'Ratings need the database, which is not configured: run `npm run db:status` and set DATABASE_URL in frontend/.env.local.'
      : 'Ratings need a database update that has not been applied yet. Run `npm run db:migrate` in frontend/, then reload.')
    this.name = 'RatingStoreUnavailable'
  }
}

/**
 * Loads the asset's readings, applies the stability rule, and records this week's reading
 * if the week has none. The insert is ON CONFLICT DO NOTHING, so two first requests in the
 * same week leave one row, and a row is never rewritten.
 *
 * Reads the newest `stabilityWeeks` rows up to this week, which is all the rule can use:
 * this week, the run of up to `stabilityWeeks − 1` consecutive weeks before it, and the
 * latest earlier reading (the first earlier row, whatever the gap).
 */
export async function applyWeeklyReading(args: {
  assetKind: RatedAssetKind
  assetId: string
  rating: Extract<AssetRating, { rated: true }>
  now: Date
}): Promise<WeeklyPlan> {
  if (!isDbConfigured) throw new RatingStoreUnavailable('not-configured')
  const { assetKind, assetId, rating, now } = args
  const t = assetRatingReadings
  try {
    const stored = await db
      .select({ weekStart: t.weekStart, methodologyVersion: t.methodologyVersion, cls: t.cls, shownCls: t.shownCls })
      .from(t)
      .where(and(
        eq(t.assetKind, assetKind),
        eq(t.assetId, assetId),
        eq(t.methodologyVersion, rating.version),
        lte(t.weekStart, weekStartUtc(now)),
      ))
      .orderBy(desc(t.weekStart))
      .limit(M.stabilityWeeks)

    const plan = planWeeklyReading({ assetKind, assetId, rating, stored, now })
    if (plan.reading) await db.insert(t).values(plan.reading).onConflictDoNothing()
    return plan
  } catch (e) {
    if (isSchemaBehindError(e)) throw new RatingStoreUnavailable('not-migrated')
    throw e
  }
}
