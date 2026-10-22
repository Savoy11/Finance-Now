import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The gate both pre-fills read through (scripts/lib/allowedFetch.ts): a page is read only on a
 * site the owner ruled Allowed, at every hop, and only where robots.txt lets FinanceNow read it.
 * Run against a fake network, so each rule is driven by what a site answers, never a real fetch.
 */
type Reply = { status: number; body?: string; location?: string }
let web: Record<string, Reply> = {}
const asked: string[] = []

vi.mock('@/lib/server/pinnedFetch', () => ({
  pinnedFetch: vi.fn(async (url: string, init: RequestInit) => {
    asked.push(url)
    expect(init.redirect).toBe('manual')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('FinanceNow/1.0 (test)')
    expect((init.headers as Record<string, string>).Cookie).toBeUndefined()
    const r = web[url] ?? { status: 404 }
    return new Response(r.body ?? '', { status: r.status, headers: r.location ? { location: r.location } : {} })
  }),
}))

const { allowedFetcher } = await import('../../../../scripts/lib/allowedFetch')
const allowed = new Set(['lido.fi', 'ankr.com'])

beforeEach(() => {
  web = {}
  asked.length = 0
})

describe('the pre-fills’ fetch gate', () => {
  it('reads a page on an Allowed site whose robots.txt lets it', async () => {
    web = { 'https://lido.fi/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /private' }, 'https://lido.fi/faq': { status: 200, body: '<p>hi</p>' } }
    const got = await allowedFetcher('FinanceNow/1.0 (test)', allowed)('https://lido.fi/faq')
    expect(got).toMatchObject({ outcome: 'read', html: '<p>hi</p>', finalUrl: 'https://lido.fi/faq' })
  })

  it('never fetches a site not ruled Allowed, not even its robots.txt', async () => {
    const got = await allowedFetcher('FinanceNow/1.0 (test)', allowed)('https://coinbase.com/earn')
    expect(got.outcome).toBe('not-allowed')
    expect(asked).toEqual([])
  })

  it('stops at a redirect to a site not ruled Allowed', async () => {
    web = { 'https://lido.fi/robots.txt': { status: 404 }, 'https://lido.fi/go': { status: 302, location: 'https://elsewhere.com/page' } }
    const got = await allowedFetcher('FinanceNow/1.0 (test)', allowed)('https://lido.fi/go')
    expect(got.outcome).toBe('not-allowed')
    expect(asked).not.toContain('https://elsewhere.com/page')
  })

  it('honours robots.txt, and takes no answer as no permission', async () => {
    web = { 'https://lido.fi/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /' } }
    expect((await allowedFetcher('FinanceNow/1.0 (test)', allowed)('https://lido.fi/faq')).outcome).toBe('robots')
    web = { 'https://ankr.com/robots.txt': { status: 503 } }
    expect((await allowedFetcher('FinanceNow/1.0 (test)', allowed)('https://ankr.com/staking')).outcome).toBe('robots')
    expect(asked).not.toContain('https://ankr.com/staking')
  })

  it('reads where robots.txt is missing, and reports a page that answers with an error', async () => {
    web = { 'https://ankr.com/robots.txt': { status: 404 }, 'https://ankr.com/staking': { status: 403 } }
    const got = await allowedFetcher('FinanceNow/1.0 (test)', allowed)('https://ankr.com/staking')
    expect(got).toMatchObject({ outcome: 'unreadable', why: 'HTTP 403', html: null })
  })
})
