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
