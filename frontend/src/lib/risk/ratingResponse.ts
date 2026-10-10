// What /live-data/coin-rating and /live-data/stock-rating answer (T-420 items 4–5).
// Types only, so the rating panel (a client component) and the routes share one shape
// without the panel importing a server module.

import type { AssetRating, RatedAssetKind, RatingClassNumber } from './assetRating'

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
