import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFmpDailyHistory } from '../fmpHistory'

/**
 * FMP's price history on Tiingo's basis (T-441, owner, 2026-10-18): its dividend-adjusted
 * prices first, its split-only /full only where the plan withholds them, and the basis
 * named either way. The rows below are invented, in the shapes FMP sends: newest first,
 * `adjOpen…adjClose` from /dividend-adjusted, `open…close` from /full.
 */

const adjustedRows = [
  { symbol: 'XYZ', date: '2026-09-17', adjOpen: 49.9, adjHigh: 50.3, adjLow: 49.6, adjClose: 50.1, volume: 1200 },
  { symbol: 'XYZ', date: '2026-09-16', adjOpen: 49.6, adjHigh: 49.9, adjLow: 49.4, adjClose: 49.75, volume: 1100 },
  { symbol: 'XYZ', date: '2026-09-15', adjOpen: 49.2, adjHigh: 49.7, adjLow: 49.1, adjClose: 49.5, volume: 1000 },
]
const fullRows = [
  { symbol: 'XYZ', date: '2026-09-17', open: 49.9, high: 50.3, low: 49.6, close: 50.1, volume: 1200, change: 0.35 },
  { symbol: 'XYZ', date: '2026-09-16', open: 49.6, high: 49.9, low: 49.4, close: 49.75, volume: 1100, change: -0.25 },
  { symbol: 'XYZ', date: '2026-09-15', open: 49.7, high: 50.2, low: 49.6, close: 50, volume: 1000, change: 0.1 },
]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let fetchMock: ReturnType<typeof vi.fn>
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]))
const get = () => fetchFmpDailyHistory('XYZ', 'test-key', { revalidate: 900 })

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('FMP price history', () => {
  it('reads the dividend-adjusted prices, oldest first, in one call', async () => {
    fetchMock.mockResolvedValue(json(adjustedRows))
    const { bars, basis } = await get()

    expect(basis).toBe('splits-and-dividends')
    expect(urls()).toHaveLength(1)
    expect(urls()[0]).toContain('/stable/historical-price-eod/dividend-adjusted?symbol=XYZ')
    expect(bars.map((b) => b.date)).toEqual(['2026-09-15', '2026-09-16', '2026-09-17'])
    expect(bars[0]).toEqual({ date: '2026-09-15', open: 49.2, high: 49.7, low: 49.1, close: 49.5, volume: 1000 })
  })

  it('falls back to the split-only prices where the plan withholds the endpoint, and says so', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('dividend-adjusted') ? json({ 'Error Message': 'Restricted Endpoint' }, 403) : json(fullRows)))
    const { bars, basis } = await get()

    expect(basis).toBe('splits')
    expect(urls()[1]).toContain('/stable/historical-price-eod/full?symbol=XYZ')
    expect(bars[0].close).toBe(50) // the split-only close, not the adjusted 49.5
  })

  it('falls back when the endpoint answers without adjusted prices', async () => {
    // A renamed field must not read as an empty chart, nor as raw prices labelled adjusted.
    fetchMock.mockImplementation(() => Promise.resolve(json(fullRows)))
    const { basis } = await get()
    expect(basis).toBe('splits')
    expect(urls()).toHaveLength(2)
  })

  it('does not spend a second call on a symbol outside the plan (402)', async () => {
    // Measured 2026-09-18: the free key's 402s (QQQ, VOO, VTSAX) are the same on /full.
    fetchMock.mockResolvedValue(json('Premium Query Parameter', 402))
    await expect(get()).rejects.toThrow('FMP 402')
    expect(urls()).toHaveLength(1)
  })

  it('does not retry on /full when FMP is limiting or failing', async () => {
    for (const status of [429, 500]) {
      fetchMock.mockReset()
      fetchMock.mockResolvedValue(json({}, status))
      await expect(get()).rejects.toThrow(`FMP ${status}`)
      expect(urls()).toHaveLength(1)
    }
  })

  it('names the endpoint that failed last', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(json({}, url.includes('dividend-adjusted') ? 403 : 401)))
    await expect(fetchFmpDailyHistory('XYZ', 'k', { revalidate: 300, label: 'FMP chart' })).rejects.toThrow('FMP chart 401')
  })

  it('bounds each call with its own timeout, and keeps the cache period', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('dividend-adjusted') ? json({}, 403) : json(fullRows)))
    await get()
    const [first, second] = fetchMock.mock.calls.map((c) => c[1] as RequestInit & { next?: { revalidate?: number } })
    expect(first.signal).toBeInstanceOf(AbortSignal)
    expect(second.signal).toBeInstanceOf(AbortSignal)
    expect(first.signal).not.toBe(second.signal)
    expect(first.next?.revalidate).toBe(900)
  })
})
