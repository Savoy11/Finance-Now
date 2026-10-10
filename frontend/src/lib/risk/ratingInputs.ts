/**
 * Raw feeds → the rating engine's inputs (T-420 item 4). Pure: the two rating routes
 * fetch, these functions decide what counts, and the tests feed them fixtures.
 *
 * Both read the PREVIOUS day's data (methodology §5 item 7): anything from today (UTC)
 * is dropped, so a rating worked out at 09:00 and one worked out at 21:00 read the same
 * inputs. That is what keeps a rating from moving within a day; the coin route's day
 * cache only saves work.
 */
import { ASSET_CATALOG } from '@/lib/data/assetCatalog'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import { EQUITY_CATALOG, type EquityEntry } from '@/lib/data/equityCatalog'
import type { AssetType } from '@/types/asset'
import type { OhlcvCandle } from '@/lib/utils/indicators'
import type { CompanyFundamentals } from '@/lib/utils/companyRatios'
import type { AssetRatingInputs } from './assetRating'

const DAY_MS = 86_400_000

/** Midnight UTC at the start of `now`'s day, in ms. */
function startOfTodayUtc(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

/** YYYY-MM-DD of the day before `now`, UTC: the newest day a complete rating can cover. */
export function yesterdayUtc(now: Date): string {
  return new Date(startOfTodayUtc(now) - DAY_MS).toISOString().slice(0, 10)
}

// ── universe (methodology §3, §4) ────────────────────────────────────────────

const COIN_EXCLUDED: Partial<Record<AssetType, string>> = {
  stablecoin: 'Stablecoins are not rated. This page shows facts only.',
  tokenized: 'Tokenized securities are not rated: this token represents another instrument.',
  cbdc: 'Central bank digital currencies are not rated.',
}

export type CoinEligibility =
  | { eligible: true; coingeckoId: string }
  | { eligible: false; reason: string }

/** Which coins are rated: catalog coins that are not stablecoins or tokenized securities, with a daily history source. */
export function coinEligibility(id: string): CoinEligibility {
  const asset = ASSET_CATALOG.find((a) => a.id === id)
  if (!asset) return { eligible: false, reason: 'Only coins in the app’s catalog are rated.' }
  const excluded = COIN_EXCLUDED[asset.assetType]
  if (excluded) return { eligible: false, reason: excluded }
  const coingeckoId = COINGECKO_IDS[id]
  if (!coingeckoId) return { eligible: false, reason: 'No daily price history is available for this coin, so it is not rated.' }
  return { eligible: true, coingeckoId }
}

export type StockEligibility =
  | { eligible: true; entry: EquityEntry }
  | { eligible: false; reason: string }

/** Which stocks are rated: the curated catalog's, and no others. */
export function stockEligibility(symbol: string): StockEligibility {
  const entry = EQUITY_CATALOG.find((e) => e.symbol === symbol)
  if (!entry) {
    return { eligible: false, reason: `Only the ${EQUITY_CATALOG.length} stocks in the curated catalog are rated. Other tickers show facts only.` }
  }
  return { eligible: true, entry }
}

// ── inputs ───────────────────────────────────────────────────────────────────

export interface PreparedInputs {
  inputs: AssetRatingInputs
  /** The last day the data covers (UTC, YYYY-MM-DD), or null when nothing usable arrived. */
  asOf: string | null
}

/** CoinGecko `/coins/{id}/market_chart?interval=daily`. */
export interface MarketChart {
  prices?: [number, number][]
  total_volumes?: [number, number][]
  market_caps?: [number, number][]
}

function seriesByTime(rows: [number, number][] | undefined): Map<number, number> {
  const out = new Map<number, number>()
  for (const [t, v] of rows ?? []) if (Number.isFinite(t) && Number.isFinite(v)) out.set(t, v)
  return out
}

/**
 * CoinGecko's daily chart → inputs. Its points sit exactly on midnight UTC, and a point
 * at midnight is the close of the day before it, so the point at today's midnight is
 * yesterday's close and is kept. The live point CoinGecko appends after it is today's
 * and is dropped. Volume and market cap are CoinGecko's totals across exchanges, read
 * at the same timestamps as the prices (measured 2026-10-10: the three arrays align).
 */
export function coinInputsFromChart(chart: MarketChart, now: Date): PreparedInputs {
  const cutoff = startOfTodayUtc(now)
  const prices = (chart.prices ?? [])
    .filter(([t, p]) => Number.isFinite(t) && t <= cutoff && Number.isFinite(p) && p > 0)
    .sort((a, b) => a[0] - b[0])
  const volumes = seriesByTime(chart.total_volumes)
  const caps = seriesByTime(chart.market_caps)

  const dollarVolumes: number[] = []
  for (const [t] of prices) {
    const v = volumes.get(t)
    if (v != null && v >= 0) dollarVolumes.push(v)
  }
  const last = prices[prices.length - 1]
  const cap = last ? caps.get(last[0]) : undefined

  return {
    inputs: {
      kind: 'crypto',
      closes: prices.map(([, p]) => p),
      dollarVolumes,
      marketCapUsd: cap != null && cap > 0 ? cap : null,
    },
    // A midnight point closes the day before it.
    asOf: last ? new Date(last[0] - 1).toISOString().slice(0, 10) : null,
  }
}

/**
 * The /live-data/company-facts errors that mean the company has no usable filing, as
 * opposed to SEC being unreachable. The first leaves the fundamentals dimension missing,
 * with its reason; the second must not be rated at all, or a passing outage would be
 * stored as the week's reading. The phrases are pinned against that route's source by
 * __tests__/ratingInputs.test.ts.
 */
export const NO_FILING_PHRASES = [
  'No SEC registrant found',
  'No US-GAAP facts on record',
  'contained no usable fundamentals',
] as const

export function isNoFilingError(error: string | undefined): boolean {
  return !!error && NO_FILING_PHRASES.some((p) => error.includes(p))
}

/**
 * /live-data/security-ohlcv's answer when no price provider has a key: the stock is
 * not rated, and the reason says what would fix it (methodology §4, D21). Any other
 * failure there is an outage, and is retried rather than answered. Pinned like the above.
 */
export const NO_PRICE_PROVIDER_PREFIX = 'no_provider_configured'

export function isNoPriceProviderError(error: string | undefined): boolean {
  return !!error && error.startsWith(NO_PRICE_PROVIDER_PREFIX)
}

export interface StockFeeds {
  /** Daily candles, split-adjusted, `time` at midnight UTC of the trading day. */
  candles: OhlcvCandle[]
  fundamentals: CompanyFundamentals | null
  /** End of the fiscal year the income figures cover. */
  fiscalYearEnd: string | null
}

/**
 * A catalog stock's feeds → inputs. Candles from today (UTC) are dropped, so a session
 * still trading never counts. Market cap is the catalog's dated reference figure: the
 * quote ladder carries none (methodology §4).
 */
export function stockInputsFrom(entry: EquityEntry, feeds: StockFeeds, now: Date): PreparedInputs {
  const cutoffSec = startOfTodayUtc(now) / 1000
  const kept = feeds.candles
    .filter((c) => Number.isFinite(c.time) && c.time < cutoffSec && Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time)
  const f = feeds.fundamentals
  const last = kept[kept.length - 1]

  return {
    inputs: {
      kind: 'stock',
      closes: kept.map((c) => c.close),
      volumes: kept.map((c) => c.volume),
      marketCapUsd: entry.marketCapB > 0 ? entry.marketCapB * 1e9 : null,
      sector: entry.sector,
      fundamentals: f
        ? {
            longTermDebt: f.longTermDebt,
            shareholdersEquity: f.equity,
            netIncome: f.netIncome,
            revenue: f.revenue,
            periodEnd: feeds.fiscalYearEnd,
          }
        : null,
    },
    asOf: last ? new Date(last.time * 1000).toISOString().slice(0, 10) : null,
  }
}
