import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchCoinGeckoPages } from '../coingeckoPages'

/**
 * The paged fetcher, and specifically what it says when CoinGecko refuses.
 *
 * Three audit pacing models were tuned against a rate limit nobody had read —
 * each inferred from how many calls a run happened to make before a 429, which
 * is a guess wearing the clothes of a measurement. CoinGecko states its
 * allowance in headers and usually in the body. Reporting that is what turns
 * the next failure into a reading, so it is pinned here.
 */

const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })

afterEach(() => { vi.unstubAllGlobals() })

describe('fetchCoinGeckoPages — reporting a throttle', () => {
  it('reports the limit CoinGecko states, not just that it refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(429,
      { status: { error_code: 429, error_message: 'You have exceeded the Rate Limit. Please subscribe.' } },
      { 'x-ratelimit-limit': '30', 'x-ratelimit-remaining': '0', 'retry-after': '58' },
    )))

    const out = await fetchCoinGeckoPages(3, (p) => `https://example.test/p${p}`)

    expect(out.throttled).toBe(true)
    const [err] = out.errors
    expect(err).toContain('HTTP 429')
    // The three things that decide the pacing, none of which we previously kept.
    expect(err).toContain('x-ratelimit-limit=30')
    expect(err).toContain('retry-after=58')
    expect(err).toContain('exceeded the Rate Limit')
  })

  it('says so plainly when the upstream states no limit at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(429, '')))
    const out = await fetchCoinGeckoPages(1, () => 'https://example.test/p1')
    // "No headers" must not read like "headers we forgot to look at".
    expect(out.errors[0]).toContain('upstream stated no limit headers')
  })

  it('stops at the first 429 rather than deepening the penalty', async () => {
    const f = vi.fn(async () => res(429, '', { 'x-ratelimit-limit': '5' }))
    vi.stubGlobal('fetch', f)
    await fetchCoinGeckoPages(5, (p) => `https://example.test/p${p}`)
    // A bare 429 with no usable retry-after is not retried, and the walk breaks.
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('keeps the pages that arrived before the refusal', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      n += 1
      return n === 1 ? res(200, [{ id: 'btc' }]) : res(429, '', { 'x-ratelimit-limit': '5' })
    }))

    const out = await fetchCoinGeckoPages<{ id: string }>(3, (p) => `https://example.test/p${p}`)

    // Partial beats all-or-nothing: page 1 is real data the caller can serve.
    expect(out.pages).toEqual([[{ id: 'btc' }]])
    expect(out.throttled).toBe(true)
  })

  it('reading the body for the report does not consume it for the caller', async () => {
    // describeThrottle clones before reading; if it did not, a 200 following a
    // 429 in the same walk would arrive with a used stream.
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      n += 1
      return n === 1
        ? res(429, { status: { error_message: 'slow down' } }, { 'retry-after': '1' })
        : res(200, [{ id: 'eth' }])
    }))

    const out = await fetchCoinGeckoPages<{ id: string }>(2, (p) => `https://example.test/p${p}`)

    // retry-after of 1s is inside maxRetryWaitMs, so page 1 is retried and
    // succeeds, then page 2 fetches normally. Both parse — which is the point:
    // had describeThrottle read the 429 without cloning, the retry path would
    // be operating on a disturbed stream.
    expect(out.pages).toEqual([[{ id: 'eth' }], [{ id: 'eth' }]])
    expect(out.throttled).toBe(false)
    expect(out.errors).toEqual([])
  })
})
