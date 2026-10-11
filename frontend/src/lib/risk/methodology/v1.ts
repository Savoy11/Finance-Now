/**
 * Risk ratings methodology, v1 — every number the coin and stock ratings use (T-420 item 1).
 *
 * The single source for the method in docs/architecture/risk-ratings-methodology.md
 * (D94, D95). The engine (lib/risk/assetRating.ts) reads only this file, and the public
 * methodology section will be rendered from it, so the page can never describe numbers
 * the code does not use. A change to the method is an edit here plus a new `version`,
 * and a line in the methodology note's changelog.
 *
 * The numbers were decided by the owner on 2026-10-11 (D97), after the validation in the
 * methodology's §8 (docs/assessments/risk-ratings-validation-2026-10-10.md): the volatility
 * and drawdown curves come from the EU PRIIPs bands and are shared by coins and stocks
 * (PRICE_CURVES), and the other parts may lower the class but never raise it above price
 * behaviour alone (capClassesAboveCore: 0). The weights and the other curves are Finance
 * Now's choices, kept by that decision; no source supports any particular weights
 * (docs/assessments/risk-rating-methods-survey-2026-10-07.md).
 *
 * Nothing here is shown to anyone: ASSET_PAGE_RATINGS_SHOWN stays false until counsel
 * confirms the form (D4), the owner's holdings policy is written, and the owner says so.
 */

export type Curve = ReadonlyArray<readonly [value: number, subScore: number]>

export interface RatingClass {
  /** 1 is the lowest measured risk, 7 the highest. */
  cls: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** Lowest score in the class (scores are 0–100, higher = lower measured risk). */
  min: number
  /** Decided by the owner, 2026-10-07 (D95). Always shown under HEADING. */
  label: string
}

export interface DimensionSpec {
  key: string
  label: string
  weight: number
  /** One sentence for the methodology section. */
  description: string
  window: string
  source: string
}

export interface AssetClassMethod {
  /** Days of daily prices needed before anything is rated. */
  minHistoryDays: number
  /** Periods per year used to annualise daily volatility. */
  periodsPerYear: number
  /** Days of prices used for volatility and drawdown. */
  priceWindowDays: number
  /** Days used for median volume figures. */
  volumeWindowDays: number
  dimensions: readonly DimensionSpec[]
  curves: Record<string, Curve>
}

/**
 * Volatility and drawdown → sub-score, the same for coins and stocks (D97). Worked out from
 * the EU PRIIPs market-risk bands (< 0.5%, 0.5–5%, 5–12%, 12–20%, 20–30%, 30–80%, > 80%
 * annualised volatility): each band edge sits half a point under the matching class
 * boundary, so volatility alone lands in the class whose band holds it. PRIIPs has no
 * drawdown measure, so each drawdown point is the fall a random walk at that volatility
 * typically shows in a year, 1 − e^(−σ·√(π/2)) (Magdon-Ismail et al., 2004), to 0.01%.
 *
 * Written out rather than computed, so a version's numbers can never move under it:
 * __tests__/assetRating.test.ts recomputes them from the bands (euCalibratedCurves in
 * scripts/lib/ratingValidation.ts) and fails if they drift.
 */
export const PRICE_CURVES = {
  volatility: [[0, 100], [0.005, 85.5], [0.05, 71.5], [0.12, 57.5], [0.2, 43.5], [0.3, 29.5], [0.8, 14.5], [1.6, 0]],
  drawdown: [[0, 100], [0.0062, 85.5], [0.0607, 71.5], [0.1396, 57.5], [0.2217, 43.5], [0.3134, 29.5], [0.6331, 14.5], [0.8654, 0]],
} as const satisfies Record<'volatility' | 'drawdown', Curve>

export const METHODOLOGY_V1 = {
  version: 'v1 (2026-10-11)',
  /** True while the weights and curves await the §8 validation; false since D97. */
  provisional: false,

  /** Panel heading; a label is never shown without it (D95). */
  heading: 'Measured risk',

  classes: [
    { cls: 1, min: 86, label: 'Very low' },
    { cls: 2, min: 72, label: 'Low' },
    { cls: 3, min: 58, label: 'Moderately low' },
    { cls: 4, min: 44, label: 'Moderate' },
    { cls: 5, min: 30, label: 'Moderately high' },
    { cls: 6, min: 15, label: 'High' },
    { cls: 7, min: 0, label: 'Very high' },
  ] as const satisfies readonly RatingClass[],

  /** Dimensions present must carry at least this share of the weight, or nothing is rated. */
  coverageFloor: 0.7,

  /** The shown class changes only after this many consecutive weekly readings outside it. */
  stabilityWeeks: 16,

  /**
   * The parts other than volatility and drawdown may lift the class at most this many classes
   * above price risk alone. 0 since D97: they can lower the class, never raise it (it was 1).
   */
  capClassesAboveCore: 0,

  /** Shown beside the rating as context; never part of the score. */
  recentVolatilityDays: 90,

  crypto: {
    minHistoryDays: 365,
    periodsPerYear: 365,
    priceWindowDays: 365,
    volumeWindowDays: 30,
    dimensions: [
      { key: 'volatility', label: 'Volatility', weight: 0.3, window: '365 days', source: 'CoinGecko daily history',
        description: 'Annualised standard deviation of daily log returns (sample, × √365).' },
      { key: 'drawdown', label: 'Drawdown', weight: 0.2, window: '365 days', source: 'CoinGecko daily history',
        description: 'Largest fall from a peak to a later low in daily closes.' },
      { key: 'liquidity', label: 'Liquidity', weight: 0.25, window: '30 days', source: 'CoinGecko daily history',
        description: 'The stronger of median daily dollar volume and turnover (median daily volume ÷ market cap). Turnover earns no extra credit above 5%, because very high turnover is a sign of wash trading.' },
      { key: 'scale', label: 'Scale', weight: 0.25, window: 'latest day', source: 'CoinGecko daily history',
        description: 'Market capitalisation.' },
    ],
    curves: {
      volatility: PRICE_CURVES.volatility,
      drawdown: PRICE_CURVES.drawdown,
      turnover: [[0.0005, 10], [0.005, 40], [0.02, 75], [0.05, 90]],
      dollarVolume: [[1e7, 10], [1e8, 35], [1e9, 60], [1e10, 80], [3e10, 90]],
      scale: [[5e8, 25], [2e9, 45], [1e10, 65], [5e10, 80], [2e11, 90], [1e12, 95]],
    },
  } satisfies AssetClassMethod,

  /** Liquidity is capped at this sub-score when median daily dollar volume is under cryptoThinVolumeFloorUsd. */
  cryptoThinVolumeCap: 30,
  cryptoThinVolumeFloorUsd: 1e7,

  stock: {
    minHistoryDays: 250, // one year of trading days
    periodsPerYear: 252,
    priceWindowDays: 252,
    volumeWindowDays: 30,
    dimensions: [
      { key: 'volatility', label: 'Volatility', weight: 0.25, window: '1 year', source: 'Daily closes (Tiingo, then FMP)',
        description: 'Annualised standard deviation of daily log returns (sample, × √252).' },
      { key: 'drawdown', label: 'Drawdown', weight: 0.2, window: '1 year', source: 'Daily closes (Tiingo, then FMP)',
        description: 'Largest fall from a peak to a later low in daily closes.' },
      { key: 'liquidity', label: 'Liquidity', weight: 0.2, window: '30 trading days', source: 'Daily closes and volume',
        description: 'Median daily dollar volume (close × volume).' },
      { key: 'size', label: 'Size', weight: 0.15, window: 'latest', source: 'Catalog reference figure (dated)',
        description: 'Market capitalisation.' },
      { key: 'fundamentals', label: 'Fundamentals', weight: 0.2, window: 'latest annual filing', source: 'SEC XBRL company facts',
        description: 'The average of two components of standard financial-strength models: long-term debt ÷ shareholders’ equity, and net margin. Not applied to financial companies.' },
    ],
    curves: {
      volatility: PRICE_CURVES.volatility,
      drawdown: PRICE_CURVES.drawdown,
      dollarVolume: [[1e5, 10], [1e6, 45], [1e7, 75], [5e7, 90], [5e8, 98]],
      size: [[5e7, 10], [3e8, 40], [2e9, 65], [1e10, 82], [2e11, 95]],
      debtToEquity: [[0.25, 92], [0.75, 80], [1.5, 60], [3, 35], [6, 12]],
      netMargin: [[-0.3, 10], [-0.05, 35], [0.02, 60], [0.1, 80], [0.25, 95]],
    },
  } satisfies AssetClassMethod,

  /** Debt ÷ equity is meaningless with negative equity; that half scores this, with the reason shown. */
  negativeEquityScore: 15,
  /** A filing older than this many months leaves the fundamentals dimension missing. */
  fundamentalsMaxAgeMonths: 15,
  /** Sectors left out of the fundamentals dimension (debt ÷ equity does not describe a lender). */
  fundamentalsExcludedSectors: ['financials'] as readonly string[],
} as const

/** Volatility and drawdown: the price-risk core the cap rule is measured against. */
export const CORE_DIMENSIONS = ['volatility', 'drawdown'] as const
