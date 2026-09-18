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
const fmpRows = [
  { date: '2026-09-16', close: 202 },
  { date: '2026-09-15', close: 200 },
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
    expect((await fetchSecurityChart('AAPL', '1y')).basis).toBe('adjusted')

    keyed('fmp')
    fetchMock.mockResolvedValue(json(fmpRows))
    expect((await fetchSecurityChart('AAPL', '1y')).basis).toBe('unadjusted')

    keyed('twelve-data')
    fetchMock.mockResolvedValue(json(tdBody))
    expect((await fetchSecurityChart('AAPL', '1y')).basis).toBe('unadjusted')
  })

  it('prefers the adjusted rung, and uses adjClose when it serves', async () => {
    // Order matters beyond preference: Tiingo is the only rung that can honour
    // the adjusted basis, so a reshuffle that puts a raw-close rung first would
    // silently change every chart across a split.
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
