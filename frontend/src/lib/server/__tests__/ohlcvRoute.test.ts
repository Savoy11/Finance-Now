import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/live-data/ohlcv/route'

// The crypto chart route end to end, with only the network replaced (T-423, D102).
// It used to type a candle size per range, and the typed size was wrong whenever
// CoinGecko answered: past 30 days its free service sends 4-day candles, which
// went out labelled "1D". These pin the measured size and the refusal's reason.

vi.mock('@/lib/api/live/coingecko', () => ({
  coingeckoBase: () => 'https://api.coingecko.com/api/v3',
  coingeckoHeaders: () => ({ Accept: 'application/json' }),
}))
// The price route records every provider call into .provider-config.json, the
// owner's key store. A test must never write to it, so the registry is replaced.
vi.mock('@/lib/api/live/providers', () => ({
  getProviderKey: () => undefined,
  recordProviderFetch: () => {},
}))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const START = Date.UTC(2025, 9, 11)

const req = (query: string) => new NextRequest(`http://localhost:3000/live-data/ohlcv?${query}`)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** CoinGecko /ohlc rows, `step` ms apart. */
const cgOhlc = (count: number, step: number) =>
  Array.from({ length: count }, (_, i) => [START + i * step, 100, 110, 90, 105])

/** Binance klines, `step` ms apart. */
const klines = (count: number, step: number) =>
  Array.from({ length: count }, (_, i) => [START + i * step, '100', '110', '90', '105', '1000'])

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => handler(String(input instanceof Request ? input.url : input)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { vi.unstubAllGlobals() })

/** Hosts called that belong to Binance. By host: CoinGecko ids such as "binancecoin" are not Binance calls. */
const binanceHosts = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.map(([u]) => new URL(String(u)).hostname).filter((h) => /(^|\.)binance\.(com|us)$/.test(h))

describe('/live-data/ohlcv reports the candle size it actually served', () => {
  it('calls CoinGecko’s one-year answer 4-day candles, not 1D', async () => {
    // Measured 2026-10-12: /coins/bitcoin/ohlc?days=365 → 92 candles, 96 hours apart.
    stubFetch((url) => url.includes('/ohlc?')
      ? json(cgOhlc(92, 4 * DAY))
      : json({ total_volumes: [] }))
    const body = await (await GET(req('id=btc&range=1Y&source=coingecko'))).json()
    expect(body.ok).toBe(true)
    expect(body.source).toBe('coingecko')
    expect(body.granularity).toBe('4D')
  })

  it('calls Binance’s 1H range 1-hour candles (the typed label said 30m)', async () => {
    stubFetch((url) => url.includes('binance')
      ? json(klines(168, HOUR))
      : json({ error: 'unexpected' }, 500))
    const body = await (await GET(req('id=btc&range=1H'))).json()
    expect(body.source).toBe('binance')
    expect(body.granularity).toBe('1H')
  })

  it('calls Binance’s one-year answer daily', async () => {
    stubFetch((url) => url.includes('binance')
      ? json(klines(365, DAY))
      : json({ error: 'unexpected' }, 500))
    const body = await (await GET(req('id=eth&range=1Y'))).json()
    expect(body.granularity).toBe('1D')
  })
})

describe('/live-data/ohlcv carries CoinGecko’s reason when it refuses', () => {
  it('passes on the 365-day limit instead of a bare status', async () => {
    const refusal = {
      error: { status: { error_code: 10012, error_message: 'Your request exceeds the allowed time range. Public API users are limited to querying historical data within the past 365 days.' } },
    }
    stubFetch((url) => url.includes('/ohlc?') ? json(refusal, 401) : json({ total_volumes: [] }))
    const body = await (await GET(req('id=btc&range=3Y&source=coingecko'))).json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('HTTP 401')
    expect(body.error).toContain('within the past 365 days')
  })
})

const WEEK = 7 * 86_400

/** DefiLlama /chart prices: `count` of them `step` seconds apart, the last at `end` (unix seconds). */
const llamaPrices = (count: number, step: number, end: number) =>
  Array.from({ length: count }, (_, i) => ({ timestamp: end - (count - 1 - i) * step, price: 100 + i }))
const llamaBody = (prices: unknown[]) =>
  ({ coins: prices.length ? { 'coingecko:bitcoin': { symbol: 'BTC', confidence: 0.99, prices } } : {} })

/** Answers each DefiLlama request with `count(page)` prices ending at the requested `end`. */
const llamaAnswers = (step: number, count: (page: number, span: number) => number) => {
  let page = 0
  return (url: string) => {
    const u = new URL(url)
    const end = Number(u.searchParams.get('end'))
    const span = Number(u.searchParams.get('span'))
    return json(llamaBody(llamaPrices(count(page++, span), step, end)))
  }
}

const calledHosts = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.map(([u]) => new URL(String(u)).hostname)

describe('/live-data/ohlcv serves DefiLlama closing prices only to callers that ask for them (T-423, D103)', () => {
  it('answers a closes=1 caller from DefiLlama, marked as closing prices, daily for 1Y', async () => {
    const answer = llamaAnswers(86_400, (_, span) => span)
    const fetchMock = stubFetch((url) => url.includes('coins.llama.fi') ? answer(url) : json({ error: 'unexpected' }, 500))
    const body = await (await GET(req('id=btc&range=1Y&closes=1'))).json()
    expect(body).toMatchObject({ ok: true, source: 'defillama', bars: 'close', granularity: '1D' })
    expect(body.candles).toHaveLength(365)
    const last = body.candles.at(-1)
    expect([last.open, last.high, last.low]).toEqual([last.close, last.close, last.close])
    expect(calledHosts(fetchMock)).toEqual(['coins.llama.fi'])
  })

  it('never sends DefiLlama prices to a caller asking for candles', async () => {
    // A chart, a pattern finder or a setup detector reads highs, lows and volume.
    // Handed one price dressed as a candle, each computes a zero range without a
    // word, so the price-only source must be unreachable without `closes=1`.
    for (const query of ['id=btc&range=1Y', 'id=btc&range=1Y&source=coingecko', 'id=btc&range=3Y']) {
      const answer = llamaAnswers(86_400, (_, span) => span)
      const fetchMock = stubFetch((url) => {
        if (url.includes('coins.llama.fi')) return answer(url)
        if (url.includes('binance')) return json(klines(365, DAY))
        return url.includes('/ohlc?') ? json(cgOhlc(92, 4 * DAY)) : json({ total_volumes: [] })
      })
      const body = await (await GET(req(query))).json()
      expect(body.bars, query).toBe('ohlc')
      expect(calledHosts(fetchMock), query).not.toContain('coins.llama.fi')
    }
  })

  it('reads MAX backwards 500 at a time and stops where the coin’s history begins', async () => {
    // Bitcoin's first DefiLlama price is 28 April 2013 (measured 2026-10-13): about
    // 700 weeks, so two requests, the second one short.
    const answer = llamaAnswers(WEEK, (page, span) => page === 0 ? span : 202)
    const fetchMock = stubFetch((url) => url.includes('coins.llama.fi') ? answer(url) : json({ error: 'unexpected' }, 500))
    const body = await (await GET(req('id=btc&range=MAX&closes=1'))).json()
    expect(body).toMatchObject({ ok: true, source: 'defillama', granularity: '1W' })
    expect(body.candles).toHaveLength(702)
    expect(calledHosts(fetchMock)).toEqual(['coins.llama.fi', 'coins.llama.fi'])
    const spans = fetchMock.mock.calls.map(([u]) => new URL(String(u)).searchParams.get('span'))
    expect(spans).toEqual(['500', '500'])
  })

  it('asks for an `end` that holds still within the range’s cache window', async () => {
    // `end=now` would change every second, and Next's data cache is keyed by URL.
    const answer = llamaAnswers(86_400, (_, span) => span)
    const fetchMock = stubFetch(answer)
    await GET(req('id=btc&range=1Y&closes=1'))
    const end = Number(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('end'))
    expect(end % 900).toBe(0)
  })

  it('falls back to the candle ladder when DefiLlama has no prices for the coin', async () => {
    stubFetch((url) => {
      if (url.includes('coins.llama.fi')) return json(llamaBody([]))
      return url.includes('binance') ? json(klines(365, DAY)) : json({ error: 'unexpected' }, 500)
    })
    const body = await (await GET(req('id=btc&range=1Y&closes=1'))).json()
    expect(body).toMatchObject({ ok: true, source: 'binance', bars: 'ohlc' })
  })

  it.each([
    // The multi-timeframe grid's five rows and the scanner's three timeframes.
    ['15m', '15m', 900, '15m'],
    ['1H', '1h', 3_600, '1H'],
    ['4H', '4h', 14_400, '4H'],
    ['1Y', '1d', 86_400, '1D'],
    ['3Y', '1w', WEEK, '1W'],
  ] as const)('asks DefiLlama for range %s at its own spacing (%s)', async (range, period, step, size) => {
    // range=15m used to be upper-cased to 15M, match no range, and come back as a
    // year of daily prices (found 2026-10-13).
    const answer = llamaAnswers(step, (_, span) => span)
    const fetchMock = stubFetch(answer)
    const body = await (await GET(req(`id=btc&range=${range}&closes=1`))).json()
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('period')).toBe(period)
    expect(body).toMatchObject({ ok: true, range, granularity: size })
  })

  it('asks Binance for 15-minute candles when the range is 15m', async () => {
    const fetchMock = stubFetch((url) => url.includes('binance')
      ? json(klines(200, HOUR / 4))
      : json({ error: 'unexpected' }, 500))
    const body = await (await GET(req('id=btc&range=15m'))).json()
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('interval')).toBe('15m')
    expect(body.granularity).toBe('15m')
  })

  it('carries DefiLlama’s own reason when it refuses', async () => {
    stubFetch(() => json({ message: 'Requested 1000 data points exceeds the maximum of 500.' }, 400))
    const body = await (await GET(req('id=btc&range=1Y&source=defillama'))).json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('HTTP 400')
    expect(body.error).toContain('exceeds the maximum of 500')
  })
})

describe('Binance is gone from the price and coin-list routes (T-423)', () => {
  it('the price route never calls a Binance host, even when asked for Binance', async () => {
    const { GET: markets } = await import('@/app/live-data/markets/route')
    const fetchMock = stubFetch((url) => url.includes('coingecko')
      ? json([{ id: 'bitcoin', current_price: 1, market_cap: 1, total_volume: 1, price_change_percentage_24h: 0, circulating_supply: 1 }])
      : json({ error: 'unexpected' }, 500))
    const body = await (await markets(req('source=binance'))).json()
    expect(body.source).toBe('coingecko')
    expect(binanceHosts(fetchMock)).toEqual([])
  })

  it('the coin list keeps market-cap order and never calls a Binance host', async () => {
    const { GET: coinList } = await import('@/app/live-data/coin-list/route')
    const row = (id: string, symbol: string, rank: number) =>
      ({ id, symbol, name: id, current_price: 1, market_cap: 1, market_cap_rank: rank, image: '' })
    const fetchMock = stubFetch((url) => url.includes('page=1')
      ? json([row('bitcoin', 'btc', 1), row('obscure', 'obs', 3), row('ethereum', 'eth', 2)])
      : json([]))
    const body = await (await coinList()).json()
    expect(body.coins.map((c: { id: string }) => c.id)).toEqual(['bitcoin', 'ethereum', 'obscure'])
    expect(binanceHosts(fetchMock)).toEqual([])
  })
})
