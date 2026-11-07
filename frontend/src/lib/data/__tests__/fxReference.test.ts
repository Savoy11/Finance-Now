import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ECB_PAIRS, buildPairHistory, currenciesFor, ecbPairBySlug, ecbPairBySymbol, isWorkedOut, latestPairRate,
  pairClosingCandles, pairRate, pairRateBasis, shownPairRate, type EuroRatesDay,
} from '../fxReference'
import { CONVERTER_CURRENCIES, CURRENCY_CATALOG } from '../currencyCatalog'
import { SOURCE_TERMS } from '@/lib/server/sourceTerms'
import { getSource } from '../dataSources'

// T-445 (D203): every currency pair at the European Central Bank's daily reference
// rate where it would show a dash, worked out from the Bank's euro rates.

const NOW = new Date('2026-11-07T12:00:00Z')
const pair = (slug: string) => ecbPairBySlug(slug)!
// The ECB's rates for 2026-11-05 and 2026-11-06, as Frankfurter returned them that day.
const NOV5: EuroRatesDay = { date: '2026-11-05', rates: { USD: 1.1224, JPY: 177.85, GBP: 0.83393, INR: 106.0395 } }
const NOV6: EuroRatesDay = { date: '2026-11-06', rates: { USD: 1.1165, JPY: 176.77, GBP: 0.83415, INR: 104.8645 } }

describe('which pairs the ECB prices', () => {
  it('is every catalog pair but the Dollar Index, and every leg is a currency the ECB publishes', () => {
    expect(ECB_PAIRS.map((p) => p.slug)).toEqual(CURRENCY_CATALOG.filter((c) => c.category !== 'index').map((c) => c.slug))
    expect(ECB_PAIRS.some((p) => p.slug === 'dollar-index')).toBe(false)
    const ecb = new Set<string>(CONVERTER_CURRENCIES)
    for (const code of currenciesFor(ECB_PAIRS)) expect(ecb.has(code), code).toBe(true)
    expect(currenciesFor(ECB_PAIRS)).not.toContain('EUR')
    expect(ecbPairBySymbol('JPY=X')?.slug).toBe('usd-jpy')
    expect(ecbPairBySymbol('DX-Y.NYB')).toBeUndefined()
  })
})

describe('a pair from the euro rates', () => {
  it('takes a euro pair as the ECB published it', () => {
    expect(pairRate(pair('eur-usd'), NOV6.rates)).toBe(1.1165)
    expect(pairRate(pair('eur-gbp'), NOV6.rates)).toBe(0.83415)
    expect(isWorkedOut(pair('eur-usd'))).toBe(false)
  })

  it('works out a pair without the euro as quote-per-euro over base-per-euro, the same day', () => {
    // USD/JPY = 176.77 / 1.1165; mutation: divide the other way round and this fails.
    expect(pairRate(pair('usd-jpy'), NOV6.rates)).toBe(158.325)
    // GBP/USD = 1.1165 / 0.83415, as /live-data/fx-reference-pairs served it that day
    expect(pairRate(pair('gbp-usd'), NOV6.rates)).toBe(1.33849)
    expect(pairRate(pair('usd-inr'), NOV6.rates)).toBe(93.9225)
    expect(isWorkedOut(pair('usd-jpy'))).toBe(true)
  })

  it('gives nothing when a leg is missing or not a positive number, never a neighbour’s figure', () => {
    expect(pairRate(pair('usd-jpy'), { USD: 1.1165 })).toBeNull()
    expect(pairRate(pair('usd-jpy'), { USD: 0, JPY: 176.77 })).toBeNull()
    expect(pairRate(pair('usd-jpy'), { USD: Number.NaN, JPY: 176.77 })).toBeNull()
  })
})

describe('a pair’s history and newest rate', () => {
  const days: EuroRatesDay[] = [
    NOV6,
    { date: '2026-10-30', rates: { USD: 1.1172, JPY: 175.68 } },
    { date: '2026-11-04', rates: { JPY: 178.3 } }, // no dollar rate: no USD/JPY that day
    NOV5,
    NOV5,
  ]

  it('reads each day both legs were published, from the range’s first day, oldest first, never twice', () => {
    const h = buildPairHistory(pair('usd-jpy'), days, '1mo', NOW)
    expect(h.interval).toBe('daily')
    expect(h.points).toEqual([
      { date: '2026-10-30', rate: 157.25 },
      { date: '2026-11-05', rate: 158.455 },
      { date: '2026-11-06', rate: 158.325 },
    ])
    // A range starting after 10-30 leaves it out.
    expect(buildPairHistory(pair('usd-jpy'), days, '1mo', new Date('2026-12-03T12:00:00Z')).points.map((p) => p.date))
      .toEqual(['2026-11-05', '2026-11-06'])
  })

  it('keeps each week’s last rate over five or ten years', () => {
    const h = buildPairHistory(pair('eur-usd'), days, '5y', NOW)
    expect(h.interval).toBe('weekly')
    expect(h.points.map((p) => p.date)).toEqual(['2026-10-30', '2026-11-06'])
  })

  it('gives the newest rate with its change since the previous working day both legs were published', () => {
    expect(latestPairRate(pair('usd-jpy'), days)).toEqual({
      date: '2026-11-06', rate: 158.325, previousDate: '2026-11-05', previousRate: 158.455, changePct: -0.08,
    })
    expect(latestPairRate(pair('usd-jpy'), [NOV6])).toEqual({ date: '2026-11-06', rate: 158.325 })
    expect(latestPairRate(pair('usd-jpy'), [{ date: '2026-11-06', rates: {} }])).toBeNull()
  })

  it('turns the history into closing-only candles: one figure a day, no range, no volume', () => {
    const [c] = pairClosingCandles([{ date: '2026-11-06', rate: 1.1165 }])
    expect(c).toEqual({ time: Date.UTC(2026, 10, 6) / 1000, open: 1.1165, high: 1.1165, low: 1.1165, close: 1.1165, volume: 0 })
  })
})

describe('what a pair’s row shows (D203: live first, the ECB only instead of a dash)', () => {
  const ecb = { date: '2026-11-06', rate: 158.325, previousDate: '2026-11-05', previousRate: 158.455, changePct: -0.08 }

  it('shows the live quote whenever there is one', () => {
    // Mutation: prefer the ECB rate and this fails.
    expect(shownPairRate({ price: 158.4, changePercent: 0.1 }, ecb)).toEqual({ price: 158.4, changePct: 0.1, basis: 'live' })
  })

  it('shows the ECB rate, marked with its date, only where the quote is missing', () => {
    expect(shownPairRate({ price: null, changePercent: null }, ecb)).toEqual({
      price: 158.325, changePct: -0.08, basis: 'ecb', date: '2026-11-06', previousDate: '2026-11-05',
    })
    expect(shownPairRate(undefined, ecb)?.basis).toBe('ecb')
    expect(shownPairRate(undefined, null)).toBeNull()
  })

  it('says how the rate was arrived at, as the ECB asks for a changed figure', () => {
    expect(pairRateBasis(pair('usd-jpy'))).toMatch(/worked out from the European Central Bank’s euro reference rates: JPY per euro divided by USD per euro, on the same day/)
    expect(pairRateBasis(pair('eur-usd'))).toMatch(/the European Central Bank’s own euro reference rate/)
  })
})

describe('the ECB’s terms (read 2026-11-07)', () => {
  it('are registered, with their conditions, even though the Bank is not fetched directly', () => {
    const e = SOURCE_TERMS.find((t) => t.domain === 'ecb.europa.eu')
    expect(e?.verdict).toBe('conditional')
    expect(e?.review).toBe('seeded')
    expect(e?.finding).toContain('the ECB must be cited as the source')
    expect(e?.finding).toContain('this must be stated explicitly')
    const conditions = (e?.conditions ?? []).join(' ')
    expect(conditions).toMatch(/Cite the ECB/)
    expect(conditions).toMatch(/State modification explicitly/)
    expect(conditions).toMatch(/free of charge/)
  })

  it('are met on every surface that shows an ECB rate: the Bank named, and its free-of-charge line', () => {
    const read = (p: string) => readFileSync(join(__dirname, '../../../..', p), 'utf8')
    for (const f of [
      'src/components/markets/FxHistoryCard.tsx',
      'src/app/(dashboard)/macro/currencies/CurrenciesClient.tsx',
      // A pair page carries it through its chart card, FxHistoryCard (held to it above).
      'src/app/(dashboard)/macro/page.tsx',
    ]) {
      const src = read(f)
      expect(src, f).toContain('<EcbFreeOfCharge />')
      expect(src, f).toMatch(/European Central Bank|ECB_RATE_DESCRIPTION/)
    }
    expect(getSource('fx-reference-pairs')?.providers.map((p) => p.host)).toEqual(['api.frankfurter.dev'])
    expect(getSource('fx-pair-history')?.providers.map((p) => p.host)).toEqual(['api.frankfurter.dev'])
  })
})

describe('the pages read the ECB rates where a pair would show a dash', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../../..', p), 'utf8')

  it('the Currencies table, pair pages and Macro overview put the live quote first', () => {
    expect(read('src/app/(dashboard)/macro/currencies/CurrenciesClient.tsx')).toMatch(/shownPairRate\(quotes\?\.\[c\.symbol\], reference/)
    expect(read('src/app/(dashboard)/macro/currencies/[slug]/CurrencyDetailClient.tsx')).toMatch(/shownPairRate\(quote, ecbLatest\)/)
    expect(read('src/app/(dashboard)/macro/page.tsx')).toMatch(/shownPairRate\(data\?\.\[symbol\]/)
  })

  it('a pair page charts the ECB history, and only the Dollar Index keeps the quote ladder’s chart', () => {
    expect(read('src/app/(dashboard)/macro/currencies/[slug]/CurrencyDetailClient.tsx'))
      .toMatch(/ecbPair \? <FxHistoryCard pair=\{ecbPair\} \/> : <PriceChartCard/)
  })

  it('the TA page draws a pair from its closing figures, with no patterns', () => {
    const ta = read('src/app/(dashboard)/macro/technical-analysis/page.tsx')
    expect(ta).toContain('pairClosingCandles(pairData.points')
    expect(ta).toContain('const closesOnly = curveMaturity !== null || ecbPair !== null')
  })

  it('the agent’s tools hand over each pair’s ECB rate and history worked out', () => {
    const tools = read('src/lib/agents/tools.ts')
    expect(tools).toContain('/live-data/fx-reference-pairs')
    expect(tools).toMatch(/fx-pair-history\?pair=\$\{pair\.slug\}/)
  })
})
