import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fetchMarketauxNews, marketauxUrl, MARKETAUX_REVALIDATE_SECONDS, parseMarketaux } from '../marketauxNews'

// Shape of a /v1/news/all response, per https://www.marketaux.com/documentation.
const SAMPLE = {
  meta: { found: 2, returned: 2, limit: 3, page: 1 },
  data: [
    {
      uuid: 'a1',
      title: 'Apple <b>expands</b> buyback',
      description: 'The company said on Tuesday…',
      snippet: 'longer text',
      url: 'https://www.reuters.com/apple-buyback',
      published_at: '2026-10-07T14:00:00.000000Z',
      source: 'reuters.com',
      entities: [{ symbol: 'AAPL', name: 'Apple Inc.' }, { symbol: 'msft', name: 'Microsoft' }],
    },
    { uuid: 'b2', title: 'No link here', url: '', source: 'x.com', entities: [] },
    { uuid: 'c3', title: 'Bad date', url: 'https://example.com/x', published_at: 'not a date', snippet: 'only a snippet', entities: [] },
  ],
}

describe('parseMarketaux', () => {
  it('reads headline, link, publisher, date, summary and the tickers Marketaux tagged', () => {
    const [a] = parseMarketaux(SAMPLE)
    expect(a).toEqual({
      id: 'marketaux:a1',
      title: 'Apple expands buyback',
      url: 'https://www.reuters.com/apple-buyback',
      source: 'reuters.com',
      publishedAt: '2026-10-07T14:00:00.000Z',
      summary: 'The company said on Tuesday…',
      taggedSymbols: ['AAPL', 'MSFT'],
    })
  })

  it('credits the article to its own publisher, never to Marketaux, even with no source field', () => {
    const [, c] = parseMarketaux(SAMPLE)
    expect(c.source).toBe('example.com')
    expect(parseMarketaux(SAMPLE).every((x) => x.source.toLowerCase() !== 'marketaux')).toBe(true)
  })

  it('drops rows without a link, and keeps a bad-dated row with a snippet summary', () => {
    const rows = parseMarketaux(SAMPLE)
    expect(rows.map((r) => r.id)).toEqual(['marketaux:a1', 'marketaux:c3'])
    expect(rows[1].summary).toBe('only a snippet')
    expect(Number.isNaN(new Date(rows[1].publishedAt).getTime())).toBe(false)
  })

  it('returns nothing for an error body or a malformed payload', () => {
    expect(parseMarketaux({ error: { code: 'invalid_api_token', message: 'x' } })).toEqual([])
    expect(parseMarketaux(null)).toEqual([])
  })
})

describe('the request', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks for one ticker in English, and caches six hours (at most four calls a day per stock)', () => {
    const u = new URL(marketauxUrl('AAPL', 'k'))
    expect(u.host).toBe('api.marketaux.com')
    expect(u.searchParams.get('symbols')).toBe('AAPL')
    expect(u.searchParams.get('language')).toBe('en')
    expect(u.searchParams.get('api_token')).toBe('k')
    expect(MARKETAUX_REVALIDATE_SECONDS).toBe(21_600)
  })

  it("reports Marketaux's own refusal message", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'usage_limit_reached', message: 'Daily limit reached' } }), { status: 402 })))
    await expect(fetchMarketauxNews('AAPL', 'k')).rejects.toThrow('Marketaux usage_limit_reached: Daily limit reached')
  })
})

describe('where it runs', () => {
  const route = fs.readFileSync(path.join(__dirname, '../../../app/live-data/market-news/route.ts'), 'utf8')

  it('only in symbol mode, so the general feed never spends the daily requests', () => {
    expect(route).toMatch(/if \(symbol && marketauxKey\) tasks\.push\(\{ providerId: 'marketaux'/)
  })
})
