import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTool } from '../tools'

// The assistant's get_price_history (T-423 step c, D103). Candles where the
// candle source serves them; DefiLlama's closing prices where it refuses, which
// on CoinGecko's free service is anything past 365 days. A summary built from
// closes must not offer a "high" or "low": the highest close is not the
// period's high, and a model reading periodHigh would quote it as one.

const DAY = 86_400
const START = 1_700_000_000

type Row = { time: number; open: number; high: number; low: number; close: number; volume: number }
const candles = (count: number, step: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ time: START + i * step, open: 100 + i, high: 120 + i, low: 80 + i, close: 105 + i, volume: 1 }))
const closes = (count: number, step: number): Row[] =>
  Array.from({ length: count }, (_, i) => { const p = 100 + i; return { time: START + i * step, open: p, high: p, low: p, close: p, volume: 0 } })

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

/** Answers /live-data/ohlcv: `candleAnswer` without closes=1, `closesAnswer` with it. Records every path asked. */
function stubRoute(candleAnswer: unknown, closesAnswer: unknown = { ok: false, candles: [], error: 'unexpected closes request' }) {
  const asked: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    asked.push(url.pathname + url.search)
    return json(url.searchParams.get('closes') === '1' ? closesAnswer : candleAnswer)
  }))
  return asked
}

afterEach(() => { vi.unstubAllGlobals() })

const REFUSAL = 'CoinGecko HTTP 401: Your request exceeds the allowed time range. Public API users are limited to querying historical data within the past 365 days.'

describe('get_price_history', () => {
  it('summarises candles with the period’s high and low, and asks for nothing else', async () => {
    const asked = stubRoute({ ok: true, candles: candles(30, 4 * 3_600), source: 'coingecko', bars: 'ohlc' })
    const out = await runTool('get_price_history', { coin: 'btc', range: '1M' }, 'http://x') as Record<string, unknown>
    expect(out).toMatchObject({ source: 'coingecko', sourceName: 'CoinGecko', candleSize: '4-hour', candleCount: 30, periodHigh: 149, periodLow: 80 })
    expect(out).not.toHaveProperty('highestClose')
    expect(asked).toEqual(['/live-data/ohlcv?id=btc&range=1M'])
  })

  it('keeps 4-day candles rather than switching to closes: their highs and lows are the true extremes', async () => {
    const asked = stubRoute({ ok: true, candles: candles(92, 4 * DAY), source: 'coingecko', bars: 'ohlc' })
    const out = await runTool('get_price_history', { coin: 'btc', range: '1Y' }, 'http://x') as Record<string, unknown>
    expect(out).toMatchObject({ candleSize: '4-day', candleCount: 92 })
    expect(asked).toHaveLength(1)
  })

  it('past 365 days, reads closing prices and names them as closes, with why candles were not used', async () => {
    const asked = stubRoute(
      { ok: false, candles: [], error: REFUSAL },
      { ok: true, candles: closes(157, 7 * DAY), source: 'defillama', bars: 'close' },
    )
    const out = await runTool('get_price_history', { coin: 'btc', range: '3Y' }, 'http://x') as Record<string, unknown>
    expect(asked).toEqual(['/live-data/ohlcv?id=btc&range=3Y', '/live-data/ohlcv?id=btc&range=3Y&closes=1'])
    expect(out).toMatchObject({
      source: 'defillama', sourceName: 'DefiLlama',
      priceCount: 157, firstClose: 100, lastClose: 256, highestClose: 256, lowestClose: 100,
      candlesUnavailable: REFUSAL,
    })
    expect(out.prices).toBe('closing prices only, weekly: no intraday high or low')
    for (const key of ['periodHigh', 'periodLow', 'candleSize', 'candleCount']) expect(out, key).not.toHaveProperty(key)
  })

  it('reads closes when the candle source refuses for any reason, a rate limit included', async () => {
    stubRoute(
      { ok: false, candles: [], error: 'CoinGecko HTTP 429: throttled' },
      { ok: true, candles: closes(180, 4 * 3_600), source: 'defillama', bars: 'close' },
    )
    const out = await runTool('get_price_history', { coin: 'eth', range: '1M' }, 'http://x') as Record<string, unknown>
    expect(out).toMatchObject({ source: 'defillama', candlesUnavailable: 'CoinGecko HTTP 429: throttled' })
  })

  it('passes on the reason when neither source has prices', async () => {
    stubRoute({ ok: false, candles: [], error: REFUSAL }, { ok: false, candles: [], error: 'DefiLlama HTTP 404' })
    const out = await runTool('get_price_history', { coin: 'xyz', range: 'MAX' }, 'http://x') as Record<string, unknown>
    expect(out).toEqual({ error: 'no price history available', reason: 'DefiLlama HTTP 404', coin: 'xyz', range: 'MAX' })
  })
})
