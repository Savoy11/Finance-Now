import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The ladder reads keys through the provider registry, which reads a config
// file. Stub it so these tests exercise the ladder's own ordering and fallback
// logic rather than whatever happens to be configured on the machine running them.
vi.mock('../providers', () => ({
  getProviderKey: vi.fn(),
  getEquityQuoteProviders: vi.fn(() => []),
  recordProviderFetch: vi.fn(),
}))

import { fetchSecurityChart, fetchTwelveDataChart } from '../marketData'
import { getProviderKey } from '../providers'

/**
 * D21 (owner, 2026-09-18): no provider may be load-bearing. For price history
 * FMP was — its free tier returns HTTP 402 for QQQ, VOO and VTSAX, so every
 * Vanguard ETF and every mutual fund in the Funds module had no chart at all
 * once the ladder exhausted. These cover the rung that fixes that, and the
 * ordering it must not disturb.
 */

const mockKey = vi.mocked(getProviderKey)
const keyed = (...ids: string[]) => {
  const set = new Set(ids)
  mockKey.mockImplementation((id: string) => (set.has(id) ? `test-${id}-key` : undefined))
}

const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response

/** FMP's actual free-tier refusal for a symbol outside the plan. */
const fmp402 = () => json('Premium Query Parameter', false, 402)

const tiingoRows = [
  { date: '2026-09-15', close: 100, adjClose: 50 },
  { date: '2026-09-16', close: 102, adjClose: 51 },
]
/** FMP's /dividend-adjusted shape, newest first (T-441: the FMP rung reads it). */
const fmpRows = [
  { symbol: 'AAPL', date: '2026-09-16', adjOpen: 201, adjHigh: 203, adjLow: 200, adjClose: 202, volume: 10 },
  { symbol: 'AAPL', date: '2026-09-15', adjOpen: 199, adjHigh: 201, adjLow: 198, adjClose: 200, volume: 10 },
]
const tdBody = {
  values: [
    { datetime: '2026-09-16', close: '302' },
    { datetime: '2026-09-15', close: '300' },
  ],
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('the price-history ladder', () => {
  it('falls to Twelve Data when FMP refuses the symbol (the 402 case)', async () => {
    keyed('fmp', 'twelve-data')
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('financialmodelingprep') ? fmp402() : json(tdBody)))

    const chart = await fetchSecurityChart('VTSAX', '1y')

    expect(chart.source).toBe('twelve-data')
    expect(chart.points.map((p) => p.close)).toEqual([300, 302]) // oldest-first
    // Twelve Data returns strings; a parse that silently produced NaN would
    // still have the right point count, so assert the values, not the length.
    expect(chart.points.every((p) => Number.isFinite(p.close))).toBe(true)
  })

  it('reports the basis, because the rungs genuinely disagree', async () => {
    keyed('tiingo')
    fetchMock.mockResolvedValue(json(tiingoRows))
    expect((await fetchSecurityChart('AAPL', '1y')).basis).toBe('splits-and-dividends')

    keyed('fmp')
    fetchMock.mockResolvedValue(json(fmpRows))
    expect((await fetchSecurityChart('AAPL', '1y')).basis).toBe('splits-and-dividends')

    keyed('twelve-data')
    fetchMock.mockResolvedValue(json(tdBody))
    expect((await fetchSecurityChart('AAPL', '1y')).basis).toBe('unadjusted')
  })

  it('prefers Tiingo, and uses adjClose when it serves', async () => {
    // Order matters beyond preference: Twelve Data cannot honour the adjusted
    // basis, so a reshuffle that put it first would silently change every chart
    // across a split.
    keyed('tiingo', 'fmp', 'twelve-data')
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tiingo') ? json(tiingoRows) : json(fmpRows)))

    const chart = await fetchSecurityChart('AAPL', '1y')

    expect(chart.source).toBe('tiingo')
    expect(chart.points.map((p) => p.close)).toEqual([50, 51]) // adjClose, not close
  })

  it('keeps FMP ahead of Twelve Data when FMP can serve', async () => {
    keyed('fmp', 'twelve-data')
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('financialmodelingprep') ? json(fmpRows) : json(tdBody)))

    expect((await fetchSecurityChart('AAPL', '1y')).source).toBe('fmp')
  })

  it('skips a rung with no key rather than calling it', async () => {
    keyed('twelve-data')
    fetchMock.mockResolvedValue(json(tdBody))

    await fetchSecurityChart('QQQ', '1y')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('twelvedata.com')
  })

  it('throws with every rung named when nothing is configured', async () => {
    keyed()
    await expect(fetchSecurityChart('AAPL', '1y')).rejects.toThrow(/Tiingo, FMP or Twelve Data/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Tiingo and FMP on a dividend payer (T-441)', () => {
  // Invented figures for a $0.50 dividend going ex on 09-16: the raw close drops with it, and
  // the adjusted closes before that date are scaled by 1 - 0.50/50.00 = 0.99. Tiingo sends
  // both; FMP sends the adjusted ones from /dividend-adjusted and the raw ones from /full.
  const raw = { '2026-09-15': 50, '2026-09-16': 49.75, '2026-09-17': 50.1 }
  const adjusted = { '2026-09-15': 49.5, '2026-09-16': 49.75, '2026-09-17': 50.1 }
  const dates = Object.keys(raw) as Array<keyof typeof raw>
  const tiingo = dates.map((date) => ({ date, close: raw[date], adjClose: adjusted[date] }))
  const fmpAdjusted = [...dates].reverse().map((date) => ({
    symbol: 'XYZ', date, adjOpen: adjusted[date], adjHigh: adjusted[date], adjLow: adjusted[date], adjClose: adjusted[date], volume: 1,
  }))
  const fmpFull = [...dates].reverse().map((date) => ({
    symbol: 'XYZ', date, open: raw[date], high: raw[date], low: raw[date], close: raw[date], volume: 1,
  }))
  const closes = (c: { points: Array<{ close: number }> }) => c.points.map((p) => p.close)

  it('gives the same history whichever of the two serves', async () => {
    keyed('tiingo')
    fetchMock.mockImplementation(() => Promise.resolve(json(tiingo)))
    const fromTiingo = await fetchSecurityChart('XYZ', '1y')

    keyed('fmp')
    fetchMock.mockImplementation(() => Promise.resolve(json(fmpAdjusted)))
    const fromFmp = await fetchSecurityChart('XYZ', '1y')

    expect(fromFmp.source).toBe('fmp')
    expect(closes(fromFmp)).toEqual(closes(fromTiingo))
    expect(closes(fromFmp)).toEqual([49.5, 49.75, 50.1])
    expect(fromFmp.basis).toBe(fromTiingo.basis)
  })

  it('labels the split-only fallback, which does not agree', async () => {
    keyed('fmp')
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('dividend-adjusted') ? json({}, false, 403) : json(fmpFull)))
    const chart = await fetchSecurityChart('XYZ', '1y')

    expect(chart.basis).toBe('splits')
    expect(closes(chart)).toEqual([50, 49.75, 50.1])
  })
})

describe('the Twelve Data rung', () => {
  it('surfaces an error delivered inside a 200 body', async () => {
    // Twelve Data reports a bad symbol or an exhausted credit budget with
    // HTTP 200 and status:"error". Reading `values` first would turn that into
    // "empty result", the ladder would move on, and the real reason would never
    // reach the log.
    keyed('twelve-data')
    fetchMock.mockResolvedValue(json({ status: 'error', message: 'run out of API credits' }))

    await expect(fetchTwelveDataChart('QQQ', '1y')).rejects.toThrow(/run out of API credits/)
  })

  it('caps outputsize at the free tier ceiling on the max range', async () => {
    keyed('twelve-data')
    fetchMock.mockResolvedValue(json(tdBody))

    await fetchTwelveDataChart('QQQ', 'max')

    // RANGE_DAYS.max is 10000; asking for that returns an error, not 10000 rows.
    expect(String(fetchMock.mock.calls[0][0])).toContain('outputsize=5000')
  })
})
