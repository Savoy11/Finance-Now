import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * /live-data/security-ohlcv's two rungs on one basis (T-441, owner, 2026-10-18). Tiingo's
 * adjusted candles take out splits and dividends; FMP's /full took out splits only, so a fall
 * from Tiingo to FMP moved a dividend payer's older candles up by its dividends. FMP's rung now
 * reads /dividend-adjusted, and the response names the basis, so the fallback that does not
 * agree (FMP's plan withholding those prices) is labelled rather than silent.
 */

const ladder = vi.hoisted(() => ({ ids: [] as string[] }))
vi.mock('@/lib/api/live/providers', () => ({
  getEquityOhlcvProviders: () => ladder.ids.map((id) => ({ id, isCustom: false })),
  getProviderKey: (id: string) => (ladder.ids.includes(id) ? `test-${id}-key` : undefined),
  recordProviderFetch: () => {},
}))

// Invented candles for a $0.50 dividend going ex on 09-16, with the adjusted prices before it
// scaled by 1 - 0.50/50.00 = 0.99. One price per candle keeps the arithmetic readable.
const raw = { '2026-09-15': 50, '2026-09-16': 49.75, '2026-09-17': 50.1 }
const adjusted = { '2026-09-15': 49.5, '2026-09-16': 49.75, '2026-09-17': 50.1 }
const dates = Object.keys(raw) as Array<keyof typeof raw>

const tiingoRows = dates.map((date) => ({
  date, open: raw[date], high: raw[date], low: raw[date], close: raw[date], volume: 1000,
  adjOpen: adjusted[date], adjHigh: adjusted[date], adjLow: adjusted[date], adjClose: adjusted[date], adjVolume: 1000,
}))
const fmpAdjustedRows = [...dates].reverse().map((date) => ({
  symbol: 'XYZ', date, adjOpen: adjusted[date], adjHigh: adjusted[date], adjLow: adjusted[date], adjClose: adjusted[date], volume: 1000,
}))
const fmpFullRows = [...dates].reverse().map((date) => ({
  symbol: 'XYZ', date, open: raw[date], high: raw[date], low: raw[date], close: raw[date], volume: 1000,
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const fetchMock = vi.fn()

async function served(ids: string[], answer: (url: string) => Response) {
  ladder.ids = ids
  fetchMock.mockImplementation((url: string) => Promise.resolve(answer(url)))
  const { GET } = await import('@/app/live-data/security-ohlcv/route')
  return (await GET(new NextRequest('http://localhost/live-data/security-ohlcv?symbol=XYZ&range=1Y'))).json()
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('security-ohlcv on a dividend payer', () => {
  it('gives the same candles whichever of Tiingo and FMP serves', async () => {
    const fromTiingo = await served(['tiingo'], () => json(tiingoRows))
    const fromFmp = await served(['fmp'], () => json(fmpAdjustedRows))

    expect(fromTiingo.source).toBe('tiingo')
    expect(fromFmp.source).toBe('fmp')
    expect(fromFmp.candles).toEqual(fromTiingo.candles)
    expect(fromFmp.candles.map((c: { close: number }) => c.close)).toEqual([49.5, 49.75, 50.1])
    expect(fromTiingo.basis).toBe('splits-and-dividends')
    expect(fromFmp.basis).toBe('splits-and-dividends')
  })

  it('asks FMP for its dividend-adjusted prices', async () => {
    await served(['fmp'], () => json(fmpAdjustedRows))
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stable/historical-price-eod/dividend-adjusted?symbol=XYZ')
  })

  it('labels the split-only fallback, which does not agree', async () => {
    const body = await served(['fmp'], (url) => (url.includes('dividend-adjusted') ? json({}, 403) : json(fmpFullRows)))
    expect(body.basis).toBe('splits')
    expect(body.candles.map((c: { close: number }) => c.close)).toEqual([50, 49.75, 50.1])
  })

  it('calls a Tiingo series missing an adjusted close unknown', async () => {
    const body = await served(['tiingo'], () => json(tiingoRows.map((r, i) => (i === 0 ? { ...r, adjClose: undefined } : r))))
    expect(body.basis).toBe('unknown')
  })
})
