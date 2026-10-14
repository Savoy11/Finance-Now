import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'

// The wallet routes follow the owner's T-432 rulings (D105, 2026-10-14).
//
// Tronscan: its terms require an account and its API rate-limits a request without a key
// (every keyless call from the owner's IP on 2026-10-14 got 429), so the TRON route calls it
// only with TRONSCAN_API_KEY, sent as TRON-PRO-API-KEY, and without one calls nothing.
// cloudflare-eth.com: dropped from the Ethereum ladder, being retired with no document
// granting keyless use. Its registry entry stays as the record, so the drift check alone
// would not notice it coming back.

const key = vi.hoisted(() => ({ value: undefined as string | undefined }))
vi.mock('@/lib/api/live/providers', () => ({ getProviderKey: (id: string) => (id === 'tronscan' ? key.value : undefined) }))

const ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const request = () => new NextRequest(`http://localhost/live-data/wallet/tron?address=${ADDRESS}`)

describe('the TRON wallet route', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    key.value = undefined
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('without a Tronscan key calls nothing and says why', async () => {
    const { GET } = await import('@/app/live-data/wallet/tron/route')
    const body = await (await GET(request())).json()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(body).toMatchObject({ ok: false, configured: false })
    expect(body.error).toMatch(/TRONSCAN_API_KEY/)
  })

  it('with a key sends it as TRON-PRO-API-KEY and reads the balance', async () => {
    key.value = 'test-key'
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ balance: 2_500_000 }), { status: 200 }))
    const { GET } = await import('@/app/live-data/wallet/tron/route')
    const body = await (await GET(request())).json()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('apilist.tronscanapi.com/api/account')
    expect((init.headers as Record<string, string>)['TRON-PRO-API-KEY']).toBe('test-key')
    expect(body).toMatchObject({ ok: true, balance: 2.5, symbol: 'TRX' })
  })
})

describe('the wallet routes’ ladders', () => {
  const WALLET = join(process.cwd(), 'src', 'app', 'live-data', 'wallet')
  const sources = readdirSync(WALLET, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(WALLET, d.name, 'route.ts')))
    .map((d) => ({ name: d.name, code: stripComments(readFileSync(join(WALLET, d.name, 'route.ts'), 'utf8')) as string }))

  it('finds the wallet routes (guards the guard)', () => {
    expect(sources.map((s) => s.name)).toEqual(expect.arrayContaining(['btc', 'eth', 'sol', 'tron', 'xrp']))
  })

  it('no longer fetch cloudflare-eth.com, which the owner dropped', () => {
    expect(sources.filter((s) => s.code.includes('cloudflare-eth.com')).map((s) => s.name)).toEqual([])
  })
})
