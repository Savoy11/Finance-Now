import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { planWeeklyReading, type StoredReading } from '@/lib/risk/ratingReadings'
import { METHODOLOGY_V1 as M } from '@/lib/risk/methodology/v1'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import { clearRatingCache, type AssetRatingResponse } from '@/lib/server/assetRatingRoute'
import { RatingStoreUnavailable } from '@/lib/server/ratingStore'
import { GET as coinRating } from '@/app/live-data/coin-rating/route'
import { GET as stockRating } from '@/app/live-data/stock-rating/route'

// The rating routes end to end, with only the database replaced: the engine, the input
// preparation and the stability rule all run for real (T-420 item 4).

const { applyWeeklyReading } = vi.hoisted(() => ({ applyWeeklyReading: vi.fn() }))
vi.mock('@/lib/server/ratingStore', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/server/ratingStore')>()
  return { ...real, applyWeeklyReading }
})

const DAY = 86_400_000
const NOW = new Date('2026-10-10T18:50:00Z')
const TODAY_MIDNIGHT = Date.UTC(2026, 9, 10)

const req = (path: string, host = 'localhost:3000') =>
  new NextRequest(`http://${host}${path}`, { headers: { host } })
const body = async (res: Response) => (await res.json()) as AssetRatingResponse

/** CoinGecko's daily chart: `n` midnights ending today, then the live point. */
function coinChart(n = 365) {
  const times = Array.from({ length: n }, (_, i) => TODAY_MIDNIGHT - (n - 1 - i) * DAY).concat(NOW.getTime())
  return {
    prices: times.map((t, i) => [t, 100 * (1 + 0.03 * Math.sin(i))]),
    total_volumes: times.map((t) => [t, 3e10]),
    market_caps: times.map((t) => [t, 1.2e12]),
  }
}

/** security-ohlcv: `n` sessions ending yesterday, plus today's still-open one. */
function candles(n = 260) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const close = 200 * (1 + 0.01 * Math.sin(i))
    return { time: (TODAY_MIDNIGHT - (n - i) * DAY) / 1000, open: close, high: close, low: close, close, volume: 5e7 }
  })
}

const FACTS_OK = {
  ok: true, symbol: 'AAPL', cik: '0000320193', company: 'Apple Inc.', fiscalYearEnd: '2025-09-27',
  fundamentals: { longTermDebt: 8e10, equity: 6e10, netIncome: 1e11, revenue: 4e11, balanceSheetAsOf: '2026-06-28' },
  ratios: null, annualSeries: [], updatedAt: NOW.toISOString(), source: 'SEC EDGAR (XBRL company facts)',
}

type Responder = (url: string, init?: RequestInit) => Response | Promise<Response>
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
function serve(responder: Responder) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => responder(String(input), init))
  vi.stubGlobal('fetch', fetchMock)
}
const calls = (fragment: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(fragment))

/** The store stand-in: the real stability rule over the readings given. */
function storeWith(stored: StoredReading[] = []) {
  applyWeeklyReading.mockImplementation(async (a) => planWeeklyReading({ ...a, stored }))
}

const savedEnv = { ...process.env }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  delete process.env.FN_ADMIN_TOKEN
  delete process.env.CAEP_ADMIN_TOKEN
  clearRatingCache()
  applyWeeklyReading.mockReset()
  storeWith()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  process.env = { ...savedEnv }
})

describe('/live-data/coin-rating', () => {
  const coinsUrl = `/coins/${COINGECKO_IDS.btc}/market_chart`

  it('rates a coin, puts it through the stability rule, and dates it to yesterday', async () => {
    serve((url) => url.includes(coinsUrl) ? json(coinChart()) : json({}, 404))
    const res = await coinRating(req('/live-data/coin-rating?id=btc'))
    expect(res.status).toBe(200)
    const b = await body(res)
    expect(b).toMatchObject({ ok: true, rated: true, kind: 'crypto', id: 'btc', asOf: '2026-10-09', methodologyVersion: M.version })
    if (!b.ok || !b.rated) throw new Error('expected a rating')
    expect(b.shown).toMatchObject({ cls: b.rating.cls, held: false, weeksInRun: 1 })
    expect(b.shown.label).toBe(M.classes.find((c) => c.cls === b.shown.cls)!.label)
    expect(b.sources.prices.source).toMatch(/CoinGecko/)
    expect(applyWeeklyReading).toHaveBeenCalledWith(expect.objectContaining({ assetKind: 'crypto', assetId: 'btc' }))
    // Uncached upstream: the route's day cache is the only cache.
    expect(calls(coinsUrl)[0][1]).toMatchObject({ next: { revalidate: 0 } })
  })

  it('answers the rest of the day from the day cache: one CoinGecko request per coin per day', async () => {
    serve(() => json(coinChart()))
    await coinRating(req('/live-data/coin-rating?id=btc'))
    await coinRating(req('/live-data/coin-rating?id=btc'))
    expect(calls(coinsUrl)).toHaveLength(1)
    vi.setSystemTime(new Date(NOW.getTime() + DAY))
    await coinRating(req('/live-data/coin-rating?id=btc'))
    expect(calls(coinsUrl)).toHaveLength(2)
  })

  it('a chart that has not reached yesterday yet is answered but not cached, so the day is not left a day behind', async () => {
    const lagging = coinChart()
    for (const k of ['prices', 'total_volumes', 'market_caps'] as const) lagging[k] = lagging[k].slice(0, -2) // no today-midnight, no live point
    serve(() => json(lagging))
    const b = await body(await coinRating(req('/live-data/coin-rating?id=btc')))
    expect(b).toMatchObject({ ok: true, asOf: '2026-10-08' })
    serve(() => json(coinChart()))
    expect(await body(await coinRating(req('/live-data/coin-rating?id=btc')))).toMatchObject({ asOf: '2026-10-09' })
  })

  it('shows the class the stability rule holds, with today’s class beside it', async () => {
    serve(() => json(coinChart()))
    const lastWeek = new Date(Date.UTC(2026, 9, 5) - 7 * DAY).toISOString().slice(0, 10)
    storeWith([{ weekStart: lastWeek, methodologyVersion: M.version, cls: 7, shownCls: 7 }])
    const b = await body(await coinRating(req('/live-data/coin-rating?id=btc')))
    if (!b.ok || !b.rated) throw new Error('expected a rating')
    expect(b.rating.cls).not.toBe(7)
    expect(b.shown).toMatchObject({ cls: 7, label: 'Very high', currentCls: b.rating.cls, held: true })
  })

  it('a stablecoin is answered without a request or a reading', async () => {
    serve(() => json(coinChart()))
    const b = await body(await coinRating(req('/live-data/coin-rating?id=usdc')))
    expect(b).toMatchObject({ ok: true, rated: false, reason: expect.stringMatching(/Stablecoins/) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(applyWeeklyReading).not.toHaveBeenCalled()
  })

  it('too little history is not rated and stores nothing', async () => {
    serve(() => json(coinChart(120)))
    const b = await body(await coinRating(req('/live-data/coin-rating?id=btc')))
    expect(b).toMatchObject({ ok: true, rated: false, reason: expect.stringMatching(/Not enough history/) })
    expect(applyWeeklyReading).not.toHaveBeenCalled()
  })

  it('a CoinGecko refusal is a 503 that says what the limit is, and is not cached', async () => {
    serve(() => new Response('{"status":{"error_message":"rate limited"}}', { status: 429, headers: { 'retry-after': '60' } }))
    const res = await coinRating(req('/live-data/coin-rating?id=btc'))
    expect(res.status).toBe(503)
    expect(await body(res)).toMatchObject({ ok: false, error: expect.stringMatching(/HTTP 429 \(retry-after=60/) })
    await coinRating(req('/live-data/coin-rating?id=btc'))
    expect(calls(coinsUrl)).toHaveLength(2)
  })

  it('a database that is behind says to run the migration, and the answer is not cached', async () => {
    serve(() => json(coinChart()))
    applyWeeklyReading.mockRejectedValue(new RatingStoreUnavailable('not-migrated'))
    const res = await coinRating(req('/live-data/coin-rating?id=btc'))
    expect(res.status).toBe(503)
    expect(await body(res)).toMatchObject({ ok: false, error: expect.stringContaining('npm run db:migrate') })
    storeWith()
    expect((await coinRating(req('/live-data/coin-rating?id=btc'))).status).toBe(200)
    expect(calls(coinsUrl)).toHaveLength(2)
  })

  it('asks for an id', async () => {
    expect((await coinRating(req('/live-data/coin-rating'))).status).toBe(400)
  })
})

describe('/live-data/stock-rating', () => {
  const ohlcvUrl = '/live-data/security-ohlcv?symbol=AAPL'
  const factsUrl = '/live-data/company-facts?symbol=AAPL'

  function stockFeeds(over: { ohlcv?: unknown; facts?: unknown; factsStatus?: number } = {}) {
    serve((url) => {
      if (url.includes(ohlcvUrl)) return json(over.ohlcv ?? { ok: true, symbol: 'AAPL', range: '1Y', candles: candles(), source: 'tiingo' })
      if (url.includes(factsUrl)) return json(over.facts ?? FACTS_OK, over.factsStatus ?? 200)
      return json({}, 404)
    })
  }

  it('rates a catalog stock from the app’s own routes, dropping today’s session', async () => {
    stockFeeds()
    const res = await stockRating(req('/live-data/stock-rating?symbol=aapl'))
    expect(res.status).toBe(200)
    const b = await body(res)
    expect(b).toMatchObject({ ok: true, rated: true, kind: 'stock', id: 'AAPL', asOf: '2026-10-09' })
    if (!b.ok || !b.rated) throw new Error('expected a rating')
    expect(b.sources).toMatchObject({
      prices: { source: 'tiingo' },
      marketCap: { source: 'Catalog reference figure' },
      fundamentals: { periodEnd: '2025-09-27', balanceSheetAsOf: '2026-06-28' },
    })
    expect(b.rating.dimensions.find((d) => d.key === 'fundamentals')?.subScore).not.toBeNull()
    expect(applyWeeklyReading).toHaveBeenCalledWith(expect.objectContaining({ assetKind: 'stock', assetId: 'AAPL' }))
  })

  it('keeps nothing between requests: Tiingo’s terms bar it', async () => {
    stockFeeds()
    const res = await stockRating(req('/live-data/stock-rating?symbol=AAPL'))
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    await stockRating(req('/live-data/stock-rating?symbol=AAPL'))
    expect(calls(ohlcvUrl)).toHaveLength(2)
    expect(calls(ohlcvUrl)[0][1]).toMatchObject({ next: { revalidate: 0 } })
  })

  it('a ticker outside the catalog is not rated, and nothing is fetched', async () => {
    stockFeeds()
    const b = await body(await stockRating(req('/live-data/stock-rating?symbol=ZZZZ')))
    expect(b).toMatchObject({ ok: true, rated: false, reason: expect.stringMatching(/curated catalog/) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no price key: not rated, and the reason says which keys would fix it', async () => {
    stockFeeds({ ohlcv: { ok: false, symbol: 'AAPL', range: '1Y', candles: [], source: 'none', error: 'no_provider_configured: add a Tiingo or FMP API key on the Integrations page' } })
    const res = await stockRating(req('/live-data/stock-rating?symbol=AAPL'))
    expect(res.status).toBe(200)
    expect(await body(res)).toMatchObject({ ok: true, rated: false, reason: expect.stringMatching(/Tiingo or FMP key/) })
    expect(applyWeeklyReading).not.toHaveBeenCalled()
  })

  it('a price outage is a 503, not a rating', async () => {
    stockFeeds({ ohlcv: { ok: false, symbol: 'AAPL', range: '1Y', candles: [], source: 'none', error: 'fetch_failed' } })
    expect((await stockRating(req('/live-data/stock-rating?symbol=AAPL'))).status).toBe(503)
    expect(applyWeeklyReading).not.toHaveBeenCalled()
  })

  it('an SEC outage is a 503: it must not become the week’s stored reading', async () => {
    stockFeeds({ facts: { ...FACTS_OK, ok: false, fundamentals: null, error: 'SEC company facts: HTTP 500' }, factsStatus: 503 })
    const res = await stockRating(req('/live-data/stock-rating?symbol=AAPL'))
    expect(res.status).toBe(503)
    expect(await body(res)).toMatchObject({ ok: false, error: expect.stringMatching(/SEC company facts/) })
    expect(applyWeeklyReading).not.toHaveBeenCalled()
  })

  it('a company with no SEC filing is rated without fundamentals, with the reason on the dimension', async () => {
    stockFeeds({ facts: { ...FACTS_OK, ok: false, fundamentals: null, fiscalYearEnd: null, error: 'No SEC registrant found for ticker AAPL' }, factsStatus: 404 })
    const b = await body(await stockRating(req('/live-data/stock-rating?symbol=AAPL')))
    if (!b.ok || !b.rated) throw new Error('expected a rating')
    expect(b.rating.dimensions.find((d) => d.key === 'fundamentals')).toMatchObject({ subScore: null, note: 'No annual filing found.' })
    expect(applyWeeklyReading).toHaveBeenCalled()
  })
})
