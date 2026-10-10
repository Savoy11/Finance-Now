import 'server-only'

import type { NextRequest, NextResponse } from 'next/server'
import { guardSensitiveRoute } from '@/lib/server/apiGuard'
import { ASSET_PAGE_RATINGS_SHOWN } from '@/lib/risk/visibility'
import { METHODOLOGY_V1 as M } from '@/lib/risk/methodology/v1'
import { rateAsset, type AssetRating, type RatedAssetKind, type RatingClassNumber } from '@/lib/risk/assetRating'
import type { PreparedInputs } from '@/lib/risk/ratingInputs'
import { applyWeeklyReading, RatingStoreUnavailable } from '@/lib/server/ratingStore'

// What /live-data/coin-rating and /live-data/stock-rating share (T-420 item 4): the
// switch gate, the response shape, and the step from prepared inputs to the class shown.

/**
 * While ASSET_PAGE_RATINGS_SHOWN is false, only the owner's own machine (or a caller with
 * FN_ADMIN_TOKEN) is answered, so a deployed build stays closed while the methodology's
 * §8 validation runs locally. Returns the refusal, or null to proceed.
 */
export function gateAssetRating(req: NextRequest): NextResponse | null {
  if (ASSET_PAGE_RATINGS_SHOWN) return null
  return guardSensitiveRoute(req, 'asset-rating', 60)
}

export interface RatingSources {
  prices: { source: string; asOf: string | null }
  marketCap: { source: string; asOf: string | null }
  fundamentals?: { source: string; periodEnd: string | null; balanceSheetAsOf: string | null }
}

/** The class the reader sees, after the stability rule. */
export interface ShownClass {
  cls: RatingClassNumber
  label: string
  /** Today's class from the score alone. */
  currentCls: RatingClassNumber
  /** True when the stability rule keeps the shown class away from today's. */
  held: boolean
  /** Consecutive weekly readings the rule looked at, this week's included. */
  weeksInRun: number
}

interface ResponseBase {
  kind: RatedAssetKind
  id: string
  methodologyVersion: string
  computedAt: string
}

export type AssetRatingResponse =
  | (ResponseBase & {
      ok: true
      rated: true
      /** The last day the data covers (UTC). */
      asOf: string | null
      shown: ShownClass
      rating: Extract<AssetRating, { rated: true }>
      sources: RatingSources
    })
  | (ResponseBase & {
      ok: true
      rated: false
      reason: string
      asOf: string | null
      /** The engine's output when it ran; null when the asset is outside the universe. */
      rating: AssetRating | null
      sources: RatingSources | null
    })
  | (ResponseBase & { ok: false; error: string })

function base(kind: RatedAssetKind, id: string, now: Date): ResponseBase {
  return { kind, id, methodologyVersion: M.version, computedAt: now.toISOString() }
}

function labelFor(cls: RatingClassNumber): string {
  return M.classes.find((c) => c.cls === cls)!.label
}

/** An asset outside the universe, or one with no price source: not rated, with the reason. */
export function notRated(kind: RatedAssetKind, id: string, reason: string, now: Date): AssetRatingResponse {
  return { ...base(kind, id, now), ok: true, rated: false, reason, asOf: null, rating: null, sources: null }
}

/** A failure worth retrying (an upstream down, the database not ready). Never cached, never stored. */
export function failed(kind: RatedAssetKind, id: string, error: string, now: Date): AssetRatingResponse {
  return { ...base(kind, id, now), ok: false, error }
}

/**
 * Prepared inputs → the response: rate, then put a rated result through the stability rule,
 * which records this week's reading. An unrated result needs no database.
 */
export async function finishRating(args: {
  kind: RatedAssetKind
  id: string
  prepared: PreparedInputs
  sources: RatingSources
  now: Date
}): Promise<{ status: number; body: AssetRatingResponse }> {
  const { kind, id, prepared, sources, now } = args
  const rating = rateAsset(prepared.inputs, now)
  if (!rating.rated) {
    return {
      status: 200,
      body: { ...base(kind, id, now), ok: true, rated: false, reason: rating.reason, asOf: prepared.asOf, rating, sources },
    }
  }
  try {
    const plan = await applyWeeklyReading({ assetKind: kind, assetId: id, rating, now })
    return {
      status: 200,
      body: {
        ...base(kind, id, now),
        ok: true,
        rated: true,
        asOf: prepared.asOf,
        shown: { cls: plan.shownCls, label: labelFor(plan.shownCls), currentCls: plan.currentCls, held: plan.held, weeksInRun: plan.weeksInRun },
        rating,
        sources,
      },
    }
  } catch (e) {
    if (e instanceof RatingStoreUnavailable) return { status: 503, body: failed(kind, id, e.message, now) }
    throw e
  }
}

// ── day cache (coins only) ───────────────────────────────────────────────────
// One computation per coin per UTC day. Stock ratings are not cached here: Tiingo's
// Starter terms (§1.6(a)) bar keeping its data past the calculation, and the result
// does not change within a day anyway, because the inputs stop at yesterday.

const dayCache = new Map<string, AssetRatingResponse>()

function cacheKey(kind: RatedAssetKind, id: string, now: Date): string {
  return `${kind}:${id}:${now.toISOString().slice(0, 10)}`
}

export function cachedRating(kind: RatedAssetKind, id: string, now: Date): AssetRatingResponse | undefined {
  return dayCache.get(cacheKey(kind, id, now))
}

/** Keeps today's entries only, so the map never outgrows the universe. */
export function cacheRating(kind: RatedAssetKind, id: string, now: Date, body: AssetRatingResponse): void {
  const today = now.toISOString().slice(0, 10)
  for (const k of dayCache.keys()) if (!k.endsWith(`:${today}`)) dayCache.delete(k)
  dayCache.set(cacheKey(kind, id, now), body)
}

/** Tests only. */
export function clearRatingCache(): void {
  dayCache.clear()
}
