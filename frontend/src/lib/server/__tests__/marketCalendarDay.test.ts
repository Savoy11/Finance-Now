import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Code audit 2026-11-09 (D214): /live-data/market-calendar's ?days= mode, which the agents'
// get_market_calendar tool reads, started on UTC's day, so after about 8 pm Eastern that evening's
// reporters dropped out. It starts on New York's day now.

vi.mock('@/lib/api/live/providers', () => ({ getProviderKey: () => undefined }))

afterEach(() => { vi.useRealTimers() })

describe('/live-data/market-calendar ?days=', () => {
  it('starts on New York’s day in the US evening', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T01:30:00Z')) // 8:30 pm Eastern on Nov 17
    const { GET } = await import('@/app/live-data/market-calendar/route')
    const j = await (await GET(new NextRequest('http://localhost/live-data/market-calendar?days=7'))).json()
    expect(j.from).toBe('2026-11-17')
    expect(j.to).toBe('2026-11-24')
  })
})
