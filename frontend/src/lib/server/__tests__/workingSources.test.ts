import { describe, expect, it } from 'vitest'
import type { SourceProvider } from '@/lib/data/dataSources'
import { DATA_SOURCES } from '@/lib/data/dataSources'
import { lossIfDropped, providerKind, rangeSlices, sourcesOf } from '../../../../scripts/lib/workingSources'

// The coverage matrix's view over WORKING surfaces (T-439, D110): which vendor a surface that
// works would lose everything with. The old column saw only degraded surfaces and keyed vendors.

const p = (o: Partial<SourceProvider> & { name: string }): SourceProvider => ({ role: 'primary', auth: 'none', ...o })
const one = (x: SourceProvider) => [x.name]

describe('which providers count as sources', () => {
  it('a provider with a host is a vendor, keyless or not', () => {
    expect(providerKind(p({ name: 'DefiLlama', host: 'coins.llama.fi' }))).toBe('vendor')
    expect(providerKind(p({ name: 'SEC XBRL frames', host: 'data.sec.gov', role: 'aggregator' }))).toBe('vendor')
  })

  it('a keyed ladder written as a name is a vendor', () => {
    expect(providerKind(p({ name: 'Finnhub / Twelve Data / Alpha Vantage', role: 'fallback', auth: 'key' }))).toBe('vendor')
  })

  it('a host-less, keyless fallback is a hand-kept table', () => {
    expect(providerKind(p({ name: 'Curated catalog', role: 'fallback' }))).toBe('static-fallback')
  })

  it('in-app work, composites, user input and placeholders are not sources', () => {
    expect(providerKind(p({ name: 'Finance Now engine', role: 'derived' }))).toBe('other')
    expect(providerKind(p({ name: 'Finance Now AI agent (LLM, BYOK)', role: 'derived', auth: 'key' }))).toBe('other')
    expect(providerKind(p({ name: 'Every configured provider', role: 'aggregator', auth: 'key' }))).toBe('other')
    expect(providerKind(p({ name: 'Live-data routes', role: 'aggregator' }))).toBe('other')
    expect(providerKind(p({ name: 'User-entered option quotes' }))).toBe('other')
    expect(providerKind(p({ name: 'None — no source cleared for this use' }))).toBe('other')
  })
})

describe('what dropping a vendor does to the working surfaces', () => {
  const surfaces = [
    { id: 'fear-greed', providers: [p({ name: 'alternative.me', host: 'api.alternative.me' })] },
    { id: 'stock-universe', providers: [p({ name: 'FMP', host: 'financialmodelingprep.com', auth: 'key' }), p({ name: 'Curated catalog', role: 'fallback' })] },
    { id: 'ohlcv', providers: [p({ name: 'CoinGecko', host: 'api.coingecko.com' }), p({ name: 'DefiLlama', host: 'coins.llama.fi' })] },
    { id: 'compare', providers: [p({ name: 'Finance Now computation', role: 'derived' })] },
    { id: 'treasury', providers: [p({ name: 'Treasury', host: 'home.treasury.gov' }), p({ name: 'Treasury', host: 'api.fiscaldata.treasury.gov' })] },
  ].map((s) => sourcesOf(s, one))
  const loss = lossIfDropped(surfaces)

  it('a surface one keyless vendor carries empties when it goes', () => {
    expect(loss.get('alternative.me')).toEqual({ empties: ['fear-greed'], degrades: [] })
  })

  it('a hand-kept table behind the only vendor turns emptying into degrading', () => {
    expect(loss.get('FMP')).toEqual({ empties: [], degrades: ['stock-universe'] })
  })

  it('two vendors on a surface: dropping either loses nothing', () => {
    expect(loss.has('CoinGecko')).toBe(false)
    expect(loss.has('DefiLlama')).toBe(false)
  })

  it('one vendor under two hosts is still one vendor', () => {
    expect(loss.get('Treasury')).toEqual({ empties: ['treasury'], degrades: [] })
  })

  it('a surface with no external source is nobody’s to lose', () => {
    expect([...loss.values()].flatMap((l) => [...l.empties, ...l.degrades])).not.toContain('compare')
  })

  it('a ladder counts every vendor it names', () => {
    const ladder = sourcesOf(
      { id: 'quotes', providers: [p({ name: 'Ladder (FMP → Finnhub)', auth: 'key' })] },
      () => ['FMP', 'Finnhub'],
    )
    expect(ladder.vendors).toEqual(['FMP', 'Finnhub'])
    expect(lossIfDropped([ladder]).size).toBe(0)
  })
})

describe('ranges one vendor carries (D112)', () => {
  const coingecko = p({ name: 'CoinGecko', host: 'api.coingecko.com', limits: { historyDays: 365 } })
  const defillama = p({ name: 'DefiLlama', host: 'coins.llama.fi' })
  const coinMetrics = p({ name: 'Coin Metrics', host: 'community-api.coinmetrics.io', role: 'fallback', limits: { intervals: ['1d', '1w'] } })

  it('finds the case that started T-434: before D108, DefiLlama alone served history past 365 days', () => {
    expect(rangeSlices({ id: 'ohlcv', providers: [coingecko, defillama] }, one)).toEqual([
      { range: 'history past 365 days', vendors: ['DefiLlama'] },
    ])
  })

  it('after D108 that range has two vendors, and Coin Metrics’ own limit leaves intraday to the other two', () => {
    expect(rangeSlices({ id: 'ohlcv', providers: [coingecko, defillama, coinMetrics] }, one)).toEqual([
      { range: 'history past 365 days', vendors: ['Coin Metrics', 'DefiLlama'] },
      { range: 'intervals other than 1d, 1w', vendors: ['CoinGecko', 'DefiLlama'] },
    ])
  })

  it('a provider with a longer history limit still serves the shorter one’s gap', () => {
    const twoYears = p({ name: 'Two-year source', host: 'two.example', limits: { historyDays: 730 } })
    expect(rangeSlices({ id: 's', providers: [coingecko, twoYears] }, one)).toEqual([
      { range: 'history past 365 days', vendors: ['Two-year source'] },
      { range: 'history past 730 days', vendors: [] },
    ])
  })

  it('a limit on something that is not a source marks out no range', () => {
    const engine = p({ name: 'Finance Now engine', role: 'derived', limits: { historyDays: 30 } })
    expect(rangeSlices({ id: 's', providers: [defillama, engine] }, one)).toEqual([])
  })

  it('a surface with no limits has no ranges to count', () => {
    expect(rangeSlices({ id: 's', providers: [defillama, p({ name: 'Other', host: 'o.example' })] }, one)).toEqual([])
  })

  it('the real chart registry: both recorded ranges have two vendors today', () => {
    const ohlcv = DATA_SOURCES.find((e) => e.id === 'ohlcv')!
    const slices = rangeSlices(ohlcv, one)
    expect(slices.map((s) => s.range)).toEqual(['history past 365 days', 'intervals other than 1d, 1w'])
    for (const s of slices) expect(s.vendors.length, s.range).toBeGreaterThanOrEqual(2)
  })
})

describe('the real registry', () => {
  it('every host-less, keyless provider that is not in-app work is named here, so a new one is classified on purpose', () => {
    // A real external source written without a host would be counted as "not a source" and could
    // hide a single-vendor surface. Injective's LCD was one until D113 gave it its host.
    const hostless = [...new Set(DATA_SOURCES.flatMap((e) => e.providers)
      .filter((x) => !x.host && x.auth === 'none' && x.role !== 'derived')
      .map((x) => `${providerKind(x)}: ${x.name}`))].sort()
    expect(hostless).toEqual([
      'other: Crypto + equity news feeds (merged client-side)',
      'other: Feeds added on the Integrations page (terms checked when saved)',
      'other: Live-data routes (same feeds the UI reads)',
      'other: None — no reachable source quotes dated contract months',
      'other: None — no source cleared for this use',
      'other: User-entered option quotes (from their broker chain)',
      'other: User-entered strikes, premiums and volatility (from their broker chain)',
      'static-fallback: Catalog',
      'static-fallback: Catalog reference prices',
      'static-fallback: Curated catalog',
    ])
  })
})
