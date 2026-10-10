/**
 * Every sentence the rating panel and the methodology page say about the rating
 * (T-420 item 5). The wording is the methodology note's (docs/architecture/
 * risk-ratings-methodology.md §1, §5, §6, approved as the v1 draft, D94/D95); every
 * number in it is read from methodology/v1.ts. Change wording in the note first.
 *
 * No suitability words: __tests__/ratingCopy.test.ts fails on "conservative",
 * "aggressive", "suitable", "safe" or "recommend" anywhere in this copy (the memo's
 * §6 item 5), except the one sentence saying the rating is NOT a recommendation.
 */
import { METHODOLOGY_V1 as M } from './methodology/v1'
import { EQUITY_CATALOG } from '@/lib/data/equityCatalog'
import { wholePercent } from './ratingFormat'
import type { RatingClassNumber } from './assetRating'

/** Where the methodology page lives. */
export const METHODOLOGY_PATH = '/about/risk-ratings'

export const CLASS_COUNT = M.classes.length

/** "Measured risk: Class 4 of 7" (D95). A label is never shown without it. */
export function ratingHeading(cls: RatingClassNumber): string {
  return `${M.heading}: Class ${cls} of ${CLASS_COUNT}`
}

export const NOT_RATED_HEADING = `${M.heading}: not rated`

/** §5 item 6, word for word in shape. */
export function heldSentence(shown: RatingClassNumber, current: RatingClassNumber): string {
  return `Class held at ${shown} by the stability rule; today’s score alone would be class ${current}.`
}

export function scoreSentence(score: number): string {
  return `Score ${score} of 100. A higher score means lower measured risk.`
}

/** §5 item 4: the cap rule, when it lowered the score. */
export function cappedSentence(score: number, coreScore: number, coreCls: RatingClassNumber): string {
  return `Size and liquidity can improve the class by at most ${M.capClassesAboveCore} over price behaviour alone, `
    + `so the score is capped at ${score}. Price behaviour alone scores ${coreScore}, class ${coreCls}.`
}

/** §2: shown beside the rating, never part of it. */
export function recentVolatilitySentence(formatted: string): string {
  return `Volatility over the last ${M.recentVolatilityDays} days: ${formatted}. Shown for context; it is not part of the score.`
}

/** §6, the regulators' phrasing. */
export const RATING_DISCLOSURES: readonly string[] = [
  `A guide to the level of measured price risk compared with other assets on this site, on a scale of 1 (lowest) to ${CLASS_COUNT} (highest).`,
  'Based on past prices and filings, which may not be a reliable indication of the future. It changes as new data arrives.',
  'The lowest class does not mean risk free.',
]

/** §6, and the short not-advice line beside the rating (§7 item 9). */
export const NOT_ADVICE_LINE =
  'The same for everyone who views this page. It does not use anything about you, and it is not a recommendation to buy, sell or hold.'

/** §1: what the rating does not assess. */
export const NOT_ASSESSED: readonly string[] = [
  'the project’s code or smart contracts',
  'the team',
  'custody or exchange risk',
  'legal or regulatory standing',
  'token supply schedules',
  'accounting quality',
  'order-book depth',
  'whether reported volume is genuine',
  'future prices',
]

export const NOT_ASSESSED_SENTENCE = `It does not assess ${NOT_ASSESSED.slice(0, -1).join(', ')}, or ${NOT_ASSESSED[NOT_ASSESSED.length - 1]}.`

/** §3: said wherever a coin's liquidity is shown. */
export const CRYPTO_VOLUME_CAVEAT = 'Reported crypto trading volume is not vetted.'

/** §1: what the rating is. */
export const WHAT_IT_IS =
  'A measurement of how much an asset’s price has moved and fallen over the past year, how easily it trades, how large it is, '
  + 'and, for stocks, how its balance sheet stands, combined by a fixed, published formula. The same for every reader; it takes no input from you.'

/** §3, §4, §6: which assets are rated, and why the others are not. */
export const UNIVERSE = {
  crypto: `Coins in the app’s catalog with at least ${M.crypto.minHistoryDays} days of daily prices. `
    + 'Stablecoins and tokenized securities are not rated, and neither is a coin with no daily price history.',
  stock: `The ${EQUITY_CATALOG.length} stocks in the curated catalog, each with at least one year of daily prices `
    + `(${M.stock.minHistoryDays} trading days). Other tickers show facts only. Daily prices need a Tiingo or FMP key; without one, no stock is rated.`,
} as const

/** §5 items 1–3 and 6–7, with their numbers. */
export const HOW_IT_BECOMES_A_CLASS: readonly string[] = [
  'Volatility and drawdown must both be present; without a year of prices the asset is not rated.',
  `Other missing parts are dropped and the weights spread over the rest, provided the parts present carry at least ${wholePercent(M.coverageFloor)} of the weight. Below that, the asset is not rated.`,
  'The score is the weighted mean of the parts present.',
  `Size and liquidity can improve the class by at most ${M.capClassesAboveCore} over what price behaviour alone shows; they can always lower it. Price behaviour alone means volatility and drawdown, in proportion to their weights.`,
  'The class comes from the score, using the table above.',
  `The class shown changes only when the class at every weekly reading over the past ${M.stabilityWeeks} weeks lies outside it; it then moves to the class matched at most of those readings. A week’s reading is the first rating worked out that week (Monday to Sunday, UTC), the weeks must be consecutive, and only readings under the current methodology version count. A new rating starts at its current class.`,
  'Ratings are worked out once a day from the previous day’s data and shown as of that date. Never intraday, never on a price move, never as a notification.',
]

export const PROVISIONAL_SENTENCE =
  'The weights and curves are Finance Now’s choice. No published source supports any particular weights, and these are provisional until the validation described in the methodology note is complete.'

export const TRACK_RECORD_SENTENCE =
  'Once ratings have been shown for a year, this page will report how well each class matched the volatility and drawdown that followed.'

/**
 * The owner's policy on their own holdings and trading in rated assets (methodology §11;
 * the memo's §6 item 8). Parked by the owner (D95) until before anything is shown, and a
 * precondition of turning ASSET_PAGE_RATINGS_SHOWN on: assetRatingsHidden.test.ts fails if
 * the switch is on while this is null. The owner writes it; it is never drafted here.
 */
export const HOLDINGS_POLICY: string | null = null
