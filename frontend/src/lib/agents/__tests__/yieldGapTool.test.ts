import { afterEach, describe, expect, it, vi } from 'vitest'
import { gapHistoryFact, runTool } from '../tools'
import type { SpreadHistoryResponse } from '@/app/live-data/treasury-spread-history/route'

// T-464: get_yield_curve gives the agents the gaps' ten-year history the Bonds & Rates page
// shows, worked out, so a model quotes how long the curve was inverted rather than guessing.

afterEach(() => { vi.unstubAllGlobals() })

const stretch = (start: string, end: string, readings: number, deepest: number, ongoing = false, startKnown = true) =>
  ({ start, end, startKnown, endKnown: true, ongoing, readings, deepest, deepestOn: start })

const HISTORY: SpreadHistoryResponse = {
  ok: true, range: '10y', interval: 'weekly', points: [], missingYears: [], source: 'treasury-gov',
  stretches: {
    spread2s10s: [stretch('2019-08-27', '2019-08-29', 3, -0.04), stretch('2022-07-06', '2024-08-26', 537, -1.08), stretch('2024-09-05', '2024-09-05', 1, -0.02)],
    spread3m10y: [stretch('2026-10-01', '2026-11-06', 26, -0.2, true, true)],
  },
  now: {
    spread2s10s: { date: '2026-11-06', value: 0.35, inverted: false, stretch: stretch('2024-09-05', '2024-09-05', 1, -0.02) },
    spread3m10y: { date: '2026-11-06', value: -0.12, inverted: true, stretch: stretch('2026-10-01', '2026-11-06', 26, -0.2, true, true) },
  },
}

describe('gapHistoryFact', () => {
  it('gives the last stretch, the longest and the count for a gap above zero now', () => {
    const out = gapHistoryFact(HISTORY) as Record<string, any>
    expect(out.spread2s10s).toMatchObject({
      name: '10-year minus 2-year',
      now: { date: '2026-11-06', pctPoints: 0.35, belowZero: false },
      lastStretchBelowZero: { start: '2024-09-05', end: '2024-09-05', tradingDaysBelowZero: 1 },
      timesBelowZero: 3,
      longestStretchBelowZero: { start: '2022-07-06', end: '2024-08-26', tradingDaysBelowZero: 537, lowestPctPoints: -1.08 },
    })
    expect(out.spread2s10s).not.toHaveProperty('currentStretch')
  })

  it('gives the stretch a gap below zero now is in, with no end', () => {
    const out = gapHistoryFact(HISTORY) as Record<string, any>
    expect(out.spread3m10y.currentStretch).toEqual({
      start: '2026-10-01', end: null, stillBelowZero: true, startIsEarliestRead: false,
      tradingDaysBelowZero: 26, lowestPctPoints: -0.2, lowestOn: '2026-10-01',
    })
    expect(out.note).toMatch(/not a forecast/)
  })

  it('passes a failure on rather than inventing a history', () => {
    expect(gapHistoryFact({ ok: false, error: 'treasury.gov could not be read for 2026' })).toEqual({ error: 'treasury.gov could not be read for 2026' })
  })
})

describe('get_yield_curve', () => {
  it('reads the ten-year gap history beside the curve, and keeps the curve if the history fails', async () => {
    const urls: string[] = []
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      urls.push(String(url))
      if (String(url).includes('treasury-spread-history')) return json(HISTORY)
      return json({ ok: true, latest: { date: '2026-11-06', points: [] }, spread2s10s: 0.35, spread3m10y: -0.12, shape: 'normal' })
    }))
    const out = await runTool('get_yield_curve', {}, 'http://x') as Record<string, any>
    expect(urls.some((u) => u.endsWith('/live-data/treasury-spread-history?range=10y'))).toBe(true)
    expect(out.gapHistory.spread2s10s.timesBelowZero).toBe(3)

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) =>
      String(url).includes('treasury-spread-history') ? new Response('down', { status: 503 }) : json({ ok: true, latest: {}, spread2s10s: 0.35 })))
    const partial = await runTool('get_yield_curve', {}, 'http://x') as Record<string, any>
    expect(partial.spread2s10s).toBe(0.35)
    expect(partial.gapHistory).toHaveProperty('error')
  })
})
