import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTool } from '../tools'

// get_yield_curve hands an agent today's curve and two comparison curves. Given only
// those, two agents in the 2026-10-18 run worked out the same 10-year move as +53bp and
// as about +8bp. The route now sends each maturity's change, and the tool must pass it on.

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

describe('get_yield_curve', () => {
  it('passes on each maturity’s change since the comparison curves', async () => {
    const changeSinceMonthAgo = [{ label: '10Y', bp: 8 }]
    const changeSinceYearStart = [{ label: '10Y', bp: 90 }]
    vi.stubGlobal('fetch', vi.fn(async () => json({
      ok: true, latest: { date: '2026-10-16', points: [] }, spread2s10s: 0.35,
      changeSinceMonthAgo, changeSinceYearStart,
    })))
    const out = await runTool('get_yield_curve', {}, 'http://x') as Record<string, unknown>
    expect(out.changeSinceMonthAgo).toEqual(changeSinceMonthAgo)
    expect(out.changeSinceYearStart).toEqual(changeSinceYearStart)
  })
})
