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

describe('get_macro_price_history over a long range (audit 2026-11-07)', () => {
  // Over 5Y and MAX the history routes send each week's last reading. The tool called their
  // highest and lowest the period's: on the 2023 file the daily 10-year high was 4.98%
  // (2023-10-19) and the weekly series' 4.93% (2023-10-20).
  const weekly = { ok: true, interval: 'weekly', points: [
    { date: '2023-10-13', yieldPct: 4.63, rate: 1.05 }, { date: '2023-10-20', yieldPct: 4.93, rate: 1.06 }, { date: '2023-10-27', yieldPct: 4.84, rate: 1.055 },
  ] }
  const daily = { ...weekly, interval: 'daily' }

  it('says the extremes are of weekly readings when the readings are weekly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(weekly)))
    const y = await runTool('get_macro_price_history', { symbol: '^TNX', range: '5Y' }, 'http://x') as Record<string, unknown>
    expect(y.highestYieldPct).toBe(4.93)
    expect(String(y.note)).toContain('highest and lowest are of those weekly readings')
    const fx = await runTool('get_macro_price_history', { symbol: 'EURUSD=X', range: 'MAX' }, 'http://x') as Record<string, unknown>
    expect(String(fx.note)).toContain('highest and lowest are of those weekly readings')
  })

  it('says nothing of the kind over daily readings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(daily)))
    const y = await runTool('get_macro_price_history', { symbol: '^TNX', range: '1Y' }, 'http://x') as Record<string, unknown>
    expect(String(y.note)).not.toContain('weekly')
  })
})
