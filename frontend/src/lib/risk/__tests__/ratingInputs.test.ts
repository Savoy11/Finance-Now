import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NO_FILING_PHRASES, NO_PRICE_PROVIDER_PREFIX, coinEligibility, coinInputsFromChart, isNoFilingError,
  isNoPriceProviderError, stockEligibility, stockInputsFrom, yesterdayUtc, type MarketChart,
} from '../ratingInputs'
import { rateAsset } from '../assetRating'
import { METHODOLOGY_V1 as M } from '../methodology/v1'
import { ASSET_CATALOG } from '@/lib/data/assetCatalog'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import { EQUITY_CATALOG } from '@/lib/data/equityCatalog'
import type { OhlcvCandle } from '@/lib/utils/indicators'
import type { CompanyFundamentals } from '@/lib/utils/companyRatios'

const DAY = 86_400_000
const NOW = new Date('2026-10-10T18:50:00Z')
const TODAY_MIDNIGHT = Date.UTC(2026, 9, 10)

/** The shape CoinGecko returns for days=365&interval=daily: 365 midnights ending today, then a live point. */
function chart(midnights: number, opts: { endAt?: number; live?: boolean } = {}): MarketChart {
  const end = opts.endAt ?? TODAY_MIDNIGHT
  const times = Array.from({ length: midnights }, (_, i) => end - (midnights - 1 - i) * DAY)
  if (opts.live !== false) times.push(NOW.getTime())
  // A gentle zigzag, so volatility and drawdown are both defined.
  const price = (i: number) => 100 * (1 + 0.02 * Math.sin(i))
  return {
    prices: times.map((t, i) => [t, price(i)]),
    total_volumes: times.map((t, i) => [t, i === times.length - 1 ? 9e12 : 2e9]),
    market_caps: times.map((t, i) => [t, i === times.length - 1 ? 9e15 : 5e11]),
  }
}

describe('dates', () => {
  it('yesterdayUtc is the newest day a complete rating can cover', () => {
    expect(yesterdayUtc(NOW)).toBe('2026-10-09')
    expect(yesterdayUtc(new Date('2026-10-10T00:00:00Z'))).toBe('2026-10-09')
    expect(yesterdayUtc(new Date('2026-10-09T23:59:59Z'))).toBe('2026-10-08')
  })
})

describe('the coin universe (methodology §3)', () => {
  it('rates a catalog layer-1 coin with a history source', () => {
    expect(coinEligibility('btc')).toEqual({ eligible: true, coingeckoId: COINGECKO_IDS.btc })
  })

  it('leaves out every stablecoin and the tokenized security, saying why', () => {
    for (const a of ASSET_CATALOG.filter((x) => x.assetType === 'stablecoin')) {
      expect(coinEligibility(a.id), a.id).toEqual({ eligible: false, reason: expect.stringMatching(/Stablecoins are not rated/) })
    }
    const tokenized = ASSET_CATALOG.filter((x) => x.assetType === 'tokenized')
    expect(tokenized.length).toBeGreaterThan(0)
    for (const a of tokenized) {
      expect(coinEligibility(a.id)).toEqual({ eligible: false, reason: expect.stringMatching(/Tokenized securities are not rated/) })
    }
  })

  it('a catalog coin with no history source is not rated, and one outside the catalog is not either', () => {
    const noHistory = ASSET_CATALOG.find((a) => a.assetType === 'layer1' && !COINGECKO_IDS[a.id])
    expect(noHistory).toBeDefined()
    expect(coinEligibility(noHistory!.id)).toEqual({ eligible: false, reason: expect.stringMatching(/No daily price history/) })
    expect(coinEligibility('not-a-coin')).toEqual({ eligible: false, reason: expect.stringMatching(/catalog/) })
  })
})

describe('the stock universe (methodology §4)', () => {
  it('rates catalog stocks only, and says how many there are', () => {
    expect(stockEligibility('AAPL')).toMatchObject({ eligible: true, entry: { symbol: 'AAPL' } })
    const out = stockEligibility('ZZZZ')
    expect(out).toEqual({ eligible: false, reason: expect.stringContaining(`${EQUITY_CATALOG.length} stocks`) })
  })
})

describe('coinInputsFromChart', () => {
  it('keeps the 365 midnight closes, drops today’s live point, and dates the data to yesterday', () => {
    const { inputs, asOf } = coinInputsFromChart(chart(365), NOW)
    expect(inputs.closes).toHaveLength(365)
    expect(inputs.dollarVolumes).toHaveLength(365)
    expect(inputs.dollarVolumes).not.toContain(9e12) // the live point's volume
    expect(inputs.marketCapUsd).toBe(5e11) // today's midnight cap, not the live point's
    expect(asOf).toBe('2026-10-09')
  })

  it('what the free tier returns is exactly enough to rate', () => {
    expect(M.crypto.minHistoryDays).toBe(365)
    expect(rateAsset(coinInputsFromChart(chart(365), NOW).inputs, NOW).rated).toBe(true)
    // One day short is not rated: the rule has no margin, and a gap in CoinGecko's data shows here.
    const short = rateAsset(coinInputsFromChart(chart(364), NOW).inputs, NOW)
    expect(short).toMatchObject({ rated: false, reason: expect.stringMatching(/Not enough history/) })
  })

  it('a chart that has not reached today’s midnight yet is dated a day earlier (the route will not cache it)', () => {
    const { asOf } = coinInputsFromChart(chart(365, { endAt: TODAY_MIDNIGHT - DAY }), NOW)
    expect(asOf).toBe('2026-10-08')
    expect(asOf).not.toBe(yesterdayUtc(NOW))
  })

  it('drops unusable prices and survives an empty chart', () => {
    const c = chart(5, { live: false })
    c.prices![1] = [c.prices![1][0], 0]
    c.prices![2] = [c.prices![2][0], Number.NaN]
    expect(coinInputsFromChart(c, NOW).inputs.closes).toHaveLength(3)
    expect(coinInputsFromChart({}, NOW)).toEqual({
      inputs: { kind: 'crypto', closes: [], dollarVolumes: [], marketCapUsd: null },
      asOf: null,
    })
  })
})

describe('stockInputsFrom', () => {
  const entry = EQUITY_CATALOG.find((e) => e.symbol === 'AAPL')!
  const candle = (dayOffset: number, close: number): OhlcvCandle => ({
    time: (TODAY_MIDNIGHT + dayOffset * DAY) / 1000, open: close, high: close, low: close, close, volume: 1000,
  })
  const fundamentals = { longTermDebt: 80, equity: 60, netIncome: 90, revenue: 400, balanceSheetAsOf: '2026-06-28' } as CompanyFundamentals

  it('drops today’s candle, dates the data to the last session kept, and maps the filing', () => {
    const candles = [candle(-3, 10), candle(-2, 11), candle(-1, 12), candle(0, 99)]
    const { inputs, asOf } = stockInputsFrom(entry, { candles, fundamentals, fiscalYearEnd: '2025-09-27' }, NOW)
    expect(inputs.closes).toEqual([10, 11, 12])
    expect(inputs.volumes).toEqual([1000, 1000, 1000])
    expect(asOf).toBe('2026-10-09')
    expect(inputs).toMatchObject({
      kind: 'stock',
      marketCapUsd: entry.marketCapB * 1e9,
      sector: entry.sector,
      fundamentals: { longTermDebt: 80, shareholdersEquity: 60, netIncome: 90, revenue: 400, periodEnd: '2025-09-27' },
    })
  })

  it('no filing means no fundamentals, not zeros', () => {
    expect(stockInputsFrom(entry, { candles: [candle(-1, 10)], fundamentals: null, fiscalYearEnd: null }, NOW).inputs.fundamentals).toBeNull()
  })
})

describe('telling a missing filing or key from an outage', () => {
  const src = (rel: string) => readFileSync(resolve(__dirname, '../../../app/live-data', rel), 'utf8')

  it('each "no filing" phrase is one company-facts actually sends', () => {
    const route = src('company-facts/route.ts')
    for (const p of NO_FILING_PHRASES) expect(route, p).toContain(p)
  })

  it('the "no key" prefix is the one security-ohlcv actually sends', () => {
    expect(src('security-ohlcv/route.ts')).toContain(`'${NO_PRICE_PROVIDER_PREFIX}:`)
  })

  it('outages are not mistaken for missing filings or keys', () => {
    expect(isNoFilingError('No SEC registrant found for ticker ZZZZ')).toBe(true)
    expect(isNoFilingError('Company facts contained no usable fundamentals')).toBe(true)
    expect(isNoFilingError('SEC company facts: HTTP 500')).toBe(false)
    expect(isNoFilingError('SEC EDGAR unreachable')).toBe(false)
    expect(isNoFilingError(undefined)).toBe(false)
    expect(isNoPriceProviderError('no_provider_configured: add a Tiingo or FMP API key')).toBe(true)
    expect(isNoPriceProviderError('fetch_failed')).toBe(false)
  })
})
