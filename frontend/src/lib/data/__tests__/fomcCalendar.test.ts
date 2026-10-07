import { describe, it, expect } from 'vitest'
import {
  FOMC_MEETINGS, FOMC_LAST_VERIFIED, FOMC_STALE_AFTER_DAYS, FOMC_SOURCE_URL,
  fomcMeetingsBetween, fomcScheduleThrough, isFomcMeetingTentative,
  fomcCalendarAgeDays, fomcCalendarIsStale, getFomcCalendarProvenance,
} from '../fomcCalendar'

// The day the table was compared against the Board's calendar.
const VERIFIED = new Date(`${FOMC_LAST_VERIFIED}T12:00:00Z`)
const DAY = 86_400_000

describe('FOMC_MEETINGS — shape of the table', () => {
  it('is in date order with no duplicates', () => {
    const ends = FOMC_MEETINGS.map((m) => m.end)
    expect([...ends].sort()).toEqual(ends)
    expect(new Set(ends).size).toBe(ends.length)
  })

  it('holds only two-day meetings: the decision day is the day after the first', () => {
    // Every scheduled meeting on the Board's page for 2025–2028 is two days. A row
    // that is not would be a typo in one of the two dates.
    for (const m of FOMC_MEETINGS) {
      expect(new Date(m.end).getTime() - new Date(m.start).getTime(), m.start).toBe(DAY)
    }
  })

  it('has eight meetings in every full year it lists, four with projections', () => {
    // The Board's own structure: eight scheduled meetings a year, a Summary of Economic
    // Projections at four of them (March, June, September, December).
    for (const year of ['2025', '2026', '2027']) {
      const rows = FOMC_MEETINGS.filter((m) => m.end.startsWith(year))
      expect(rows, year).toHaveLength(8)
      expect(rows.filter((m) => m.projections).map((m) => m.end.slice(5, 7)), year).toEqual(['03', '06', '09', '12'])
    }
  })

  it('carries the dates the Board published (spot checks against the page read 2026-10-03)', () => {
    const ends = FOMC_MEETINGS.map((m) => m.end)
    expect(ends).toContain('2026-10-28')
    expect(ends).toContain('2026-12-09')
    expect(ends).toContain('2027-06-09') // June 8-9, 2027 — earlier in the month than usual
    expect(fomcScheduleThrough()).toBe('2028-01-26')
  })

  it('points at the Board, over https', () => {
    expect(FOMC_SOURCE_URL).toBe('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm')
  })
})

describe('isFomcMeetingTentative — "tentative until confirmed at the meeting immediately preceding it"', () => {
  const idx = (end: string) => FOMC_MEETINGS.findIndex((m) => m.end === end)

  it('treats the next meeting as confirmed once the one before it has been held', () => {
    // 3 Oct 2026: September's meeting (ended 16 Sep) confirmed October's.
    expect(isFomcMeetingTentative(idx('2026-10-28'), VERIFIED)).toBe(false)
  })

  it('treats every later meeting as tentative', () => {
    expect(isFomcMeetingTentative(idx('2026-12-09'), VERIFIED)).toBe(true)
    expect(isFomcMeetingTentative(idx('2027-03-17'), VERIFIED)).toBe(true)
  })

  it('confirms a date on the day the preceding meeting ends', () => {
    expect(isFomcMeetingTentative(idx('2026-12-09'), new Date('2026-10-28T20:00:00Z'))).toBe(false)
  })

  it('never calls a past meeting tentative, including the first row', () => {
    expect(isFomcMeetingTentative(0, VERIFIED)).toBe(false)
    expect(isFomcMeetingTentative(idx('2026-07-29'), VERIFIED)).toBe(false)
  })
})

describe('fomcMeetingsBetween', () => {
  it('returns meetings whose decision day falls in the range, inclusive', () => {
    const oct = fomcMeetingsBetween('2026-10-01', '2026-10-31')
    expect(oct.map((r) => r.meeting.end)).toEqual(['2026-10-28'])
    expect(fomcMeetingsBetween('2026-10-28', '2026-10-28')).toHaveLength(1)
  })

  it('returns nothing for a month without a meeting', () => {
    expect(fomcMeetingsBetween('2026-11-01', '2026-11-30')).toEqual([])
  })

  it('returns nothing past the published schedule — the page says why', () => {
    expect(fomcMeetingsBetween('2028-03-01', '2028-03-31')).toEqual([])
  })
})

describe('provenance (same pattern as stablecoinMeta / transferFees)', () => {
  it('is fresh and high-confidence on the day it was compiled', () => {
    const p = getFomcCalendarProvenance(VERIFIED)
    expect(p).toMatchObject({ verifiedAt: FOMC_LAST_VERIFIED, ageDays: 0, stale: false, confidence: 'high', through: '2028-01-26' })
    expect(p.source).toMatch(/Federal Reserve Board/)
  })

  it('goes stale only after the window', () => {
    const atEdge = new Date(VERIFIED.getTime() + FOMC_STALE_AFTER_DAYS * DAY)
    const past = new Date(VERIFIED.getTime() + (FOMC_STALE_AFTER_DAYS + 1) * DAY)
    expect(fomcCalendarIsStale(atEdge)).toBe(false)
    expect(fomcCalendarIsStale(past)).toBe(true)
    expect(getFomcCalendarProvenance(past).confidence).toBe('low')
  })

  it('counts age in whole days from the anchor', () => {
    expect(fomcCalendarAgeDays(new Date(VERIFIED.getTime() + 10 * DAY))).toBe(10)
  })
})
