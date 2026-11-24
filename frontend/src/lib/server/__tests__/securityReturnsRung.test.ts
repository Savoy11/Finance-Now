import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// T-470 (D242): FMP's dividend-adjusted history behind Tiingo on the trailing
// returns — the surface D21's record called "the only one with no fallback at
// all". The rules under test: the rung serves ONLY symbols Tiingo did not
// (fallback traffic, 250 free calls a day), a 402 leaves the symbol a dash
// rather than erroring the response, the basis labelling survives the rung
// (dividend-adjusted → adjusted: true; the /full fallback → false), and the
// response says which rung served which symbol.

const keys = vi.hoisted(() => ({ tiingo: null as string | null, fmp: null as string | null }))
vi.mock('@/lib/api/live/providers', () => ({
  getProviderKey: (p: string) => (p === 'tiingo' ? keys.tiingo : p === 'fmp' ? keys.fmp : null),
  recordProviderFetch: vi.fn(),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { GET } from '@/app/live-data/security-returns/route'

const day = 86_400_000
/** ~300 daily rows ending today, +0.1% a day. */
const series = (field: 'tiingo' | 'adj' | 'full') => {
  const rows = []
  for (let i = 299; i >= 0; i--) {
    const date = new Date(Date.now() - i * day).toISOString().slice(0, 10)
    const close = 100 * Math.pow(1.001, 299 - i)
    if (field === 'tiingo') rows.push({ date, close, adjClose: close })
    else if (field === 'adj') rows.push({ date, adjOpen: close, adjHigh: close, adjLow: close, adjClose: close, volume: 1 })
    else rows.push({ date, open: close, high: close, low: close, close, volume: 1 })
  }
  return rows
}

const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const get = async (symbols: string) => {
  const res = await GET(new NextRequest(`http://localhost:3000/live-data/security-returns?symbols=${symbols}`))
  return res.json()
}

const fmpCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('financialmodelingprep.com'))

beforeEach(() => {
  fetchMock.mockReset()
  keys.tiingo = null
  keys.fmp = null
})

describe('the FMP rung behind Tiingo', () => {
  it('never calls FMP for a symbol Tiingo answered', async () => {
    keys.tiingo = 'tk'
    keys.fmp = 'fk'
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('tiingo.com')) return json(series('tiingo'))
      throw new Error('unexpected host: ' + url)
    })
    const body = await get('SPY')
    expect(body.source).toBe('tiingo')
    expect(body.sources).toEqual({ SPY: 'tiingo' })
    expect(body.returns.SPY.adjusted).toBe(true)
    expect(fmpCalls()).toEqual([])
  })

  it('serves a symbol Tiingo failed from FMP dividend-adjusted, labelled per symbol', async () => {
    keys.tiingo = 'tk'
    keys.fmp = 'fk'
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('tiingo.com')) return u.includes('/spy/') ? json(series('tiingo')) : json({}, 500)
      if (u.includes('dividend-adjusted')) return json(series('adj'))
      throw new Error('unexpected: ' + u)
    })
    const body = await get('SPY,QQQ')
    expect(body.source).toBe('mixed')
    expect(body.sources).toEqual({ SPY: 'tiingo', QQQ: 'fmp' })
    expect(body.returns.QQQ.adjusted).toBe(true)
    expect(body.returns.QQQ.y1).not.toBeNull()
    expect(fmpCalls().every((u) => u.includes('QQQ'))).toBe(true)
  })

  it('a 402 from FMP leaves the symbol a dash — an ok response, never an error', async () => {
    keys.tiingo = 'tk'
    keys.fmp = 'fk'
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('tiingo.com')) return json({}, 404)
      if (u.includes('dividend-adjusted')) return json({ error: 'upgrade' }, 402)
      throw new Error('unexpected: ' + u)
    })
    const body = await get('VTSAX')
    expect(body.ok).toBe(true)
    expect(body.returns).toEqual({})
    expect(body.source).toBe('none')
  })

  it('the /full fallback (plan withholds the endpoint) serves with adjusted: false — T-401’s labelling', async () => {
    keys.fmp = 'fk' // no Tiingo key at all: the rung carries the request alone
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('dividend-adjusted')) return json({}, 403)
      if (u.includes('historical-price-eod/full')) return json(series('full'))
      throw new Error('unexpected: ' + u)
    })
    const body = await get('AAPL')
    expect(body.source).toBe('fmp')
    expect(body.sources).toEqual({ AAPL: 'fmp' })
    expect(body.returns.AAPL.adjusted).toBe(false)
  })

  it('with neither key the response is the honest none, naming both providers', async () => {
    const body = await get('SPY')
    expect(body.source).toBe('none')
    expect(body.error).toMatch(/Tiingo \(or FMP\)/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a whole-universe request is still refused, not served by the rung', async () => {
    keys.fmp = 'fk'
    const res = await GET(new NextRequest('http://localhost:3000/live-data/security-returns?universe=funds'))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
