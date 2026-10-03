import { describe, it, expect } from 'vitest'
import { FOMC_SOURCE_URL } from '@/lib/data/fomcCalendar'
import { fomcEventsBetween, mergeEconomicEvents, FMP_ECON_CAP, type EconomicEvent } from '../marketCalendar'

const NOW = new Date('2026-10-03T12:00:00Z')

const fmp = (event: string, date: string, impact: string | null = 'Medium'): EconomicEvent =>
  ({ event, date, country: 'US', impact, source: 'fmp' })

describe('fomcEventsBetween', () => {
  it('gives the decision day one high-impact row that names the meeting', () => {
    const [row] = fomcEventsBetween('2026-10-01', '2026-10-31', NOW)
    expect(row).toEqual({
      event: 'FOMC rate decision (meeting Oct 27–28)',
      date: '2026-10-28',
      country: 'US',
      impact: 'High',
      source: 'federal-reserve',
      tentative: false,
      url: FOMC_SOURCE_URL,
    })
  })

  it('says when a meeting brings economic projections, and marks later dates tentative', () => {
    const [row] = fomcEventsBetween('2026-12-01', '2026-12-31', NOW)
    expect(row.event).toBe('FOMC rate decision + economic projections (meeting Dec 8–9)')
    expect(row.tentative).toBe(true)
  })

  it('works for the research agent\'s rolling window, not only whole months', () => {
    // ?days=30 from 3 Oct reaches 2 Nov.
    expect(fomcEventsBetween('2026-10-03', '2026-11-02', NOW).map((e) => e.date)).toEqual(['2026-10-28'])
  })

  it('returns nothing for a month without a meeting', () => {
    expect(fomcEventsBetween('2026-11-01', '2026-11-30', NOW)).toEqual([])
  })
})

describe('mergeEconomicEvents', () => {
  const fomc = fomcEventsBetween('2026-10-01', '2026-10-31', NOW)

  it('shows FOMC rows with no FMP rows at all — the free-key case', () => {
    expect(mergeEconomicEvents([], fomc)).toEqual(fomc)
  })

  it('drops FMP\'s own copy of the decision on the decision day, and keeps its other Fed rows', () => {
    const merged = mergeEconomicEvents([
      fmp('Fed Interest Rate Decision', '2026-10-28 18:00:00', 'High'),
      fmp('FOMC Press Conference', '2026-10-28 18:30:00', 'High'),
      fmp('FOMC Minutes', '2026-10-08 18:00:00', 'High'),
    ], fomc)
    expect(merged.map((e) => e.event)).toEqual([
      'FOMC Minutes',
      'FOMC rate decision (meeting Oct 27–28)',
      'FOMC Press Conference',
    ])
  })

  it('keeps a rate-decision row from FMP on a day the table has no meeting', () => {
    // Not a duplicate of anything here — an unscheduled meeting, for instance.
    const merged = mergeEconomicEvents([fmp('Fed Interest Rate Decision', '2026-10-15 14:00:00', 'High')], fomc)
    expect(merged.map((e) => e.date.slice(0, 10))).toEqual(['2026-10-15', '2026-10-28'])
  })

  it('caps FMP rows with high impact first, so a late CPI print is not cut', () => {
    const routine = Array.from({ length: FMP_ECON_CAP }, (_, i) =>
      fmp(`Routine ${i}`, `2026-10-${String(1 + (i % 9)).padStart(2, '0')} 12:30:00`))
    const cpi = fmp('CPI', '2026-10-30 12:30:00', 'High')
    const merged = mergeEconomicEvents([...routine, cpi], fomc)
    expect(merged.map((e) => e.event)).toContain('CPI')
    // The cap counts FMP rows only; the FOMC row rides on top.
    expect(merged.filter((e) => e.source === 'fmp')).toHaveLength(FMP_ECON_CAP)
    expect(merged.filter((e) => e.source === 'federal-reserve')).toHaveLength(1)
  })

  it('returns rows in date order', () => {
    const merged = mergeEconomicEvents([
      fmp('Retail Sales', '2026-10-16 12:30:00'),
      fmp('Jobs Report', '2026-10-02 12:30:00', 'High'),
    ], fomc)
    const days = merged.map((e) => e.date.slice(0, 10))
    expect(days).toEqual([...days].sort())
  })
})
