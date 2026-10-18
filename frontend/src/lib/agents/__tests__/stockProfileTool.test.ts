import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTool } from '../tools'

// get_stock_profile hands an agent two sources at once: SEC EDGAR's registrant
// record and Wikipedia's summary. It returned Wikipedia's text with no name or link
// until 2026-10-17, when the agent evaluation found an agent crediting that text to
// SEC EDGAR. Wikipedia's terms ask for a link to the article (sourceTerms.ts).

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

describe('get_stock_profile', () => {
  it('names Wikipedia, links the article and gives the licence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      ok: true,
      profile: { name: 'Apple Inc.', sic: '3571' },
      wiki: { title: 'Apple Inc.', extract: 'Apple Inc. is an American multinational technology company.', url: 'https://en.wikipedia.org/wiki/Apple_Inc.' },
    })))
    const out = await runTool('get_stock_profile', { symbol: 'aapl' }, 'http://x') as Record<string, unknown>
    expect(out.background).toEqual({
      text: 'Apple Inc. is an American multinational technology company.',
      source: 'Wikipedia',
      url: 'https://en.wikipedia.org/wiki/Apple_Inc.',
      licence: 'CC BY-SA 4.0',
    })
  })

  it('gives no background when there is no summary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, profile: { name: 'X' }, wiki: null })))
    const out = await runTool('get_stock_profile', { symbol: 'x' }, 'http://x') as Record<string, unknown>
    expect(out.background).toBeNull()
  })
})
