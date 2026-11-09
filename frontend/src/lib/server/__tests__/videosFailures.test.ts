import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// /live-data/videos names each channel feed it could not read (2026-11-09). The owner's audit
// that day read "0 videos" with nothing to say why: the route answered ok with no reason when
// every feed failed, so a changed YouTube feed and a blocked one looked the same.

const providers = [
  { id: 'yt-bloomberg', name: 'Bloomberg Television', isCustom: false },
  { id: 'yt-cnbc', name: 'CNBC Television', isCustom: false },
]
vi.mock('@/lib/api/live/providers', () => ({
  getVideoProviders: () => providers,
  recordProviderFetch: () => {},
}))
vi.mock('@/lib/server/apiGuard', () => ({ guardQuotaRoute: () => null }))

const FEED = `<?xml version="1.0"?><feed><title>CNBC Television</title>
<entry><yt:videoId>abc123</yt:videoId><title>Markets close higher</title>
<published>2026-11-08T21:00:00+00:00</published><author><name>CNBC Television</name></author></entry></feed>`

afterEach(() => { vi.unstubAllGlobals() })

const call = async () => {
  const { GET } = await import('@/app/live-data/videos/route')
  return (await GET(new NextRequest('http://localhost/live-data/videos?market=crypto'))).json()
}

describe('/live-data/videos — failed channel feeds', () => {
  it('names a feed it could not read, beside the ones that answered', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('UCIALMKvObZNtJ6AmdCLP7Lg') ? new Response('', { status: 404 }) : new Response(FEED)))
    const j = await call()
    expect(j.videos.map((v: { title: string }) => v.title)).toEqual(['Markets close higher'])
    expect(j.tried).toBe(2)
    expect(j.failed).toEqual([{ provider: 'yt-bloomberg', name: 'Bloomberg Television', error: 'HTTP 404' }])
  })

  it('says why when every feed fails, rather than answering with nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED') }))
    const j = await call()
    expect(j.videos).toEqual([])
    expect(j.failed.map((f: { error: string }) => f.error)).toEqual(['connect ECONNREFUSED', 'connect ECONNREFUSED'])
  })

  it('does not count a feed that answered with no videos as failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<feed><title>Quiet</title></feed>')))
    const j = await call()
    expect(j.failed).toEqual([])
    expect(j.tried).toBe(2)
  })
})
