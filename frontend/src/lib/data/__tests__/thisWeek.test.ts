import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EARNINGS_SOURCE, FED_SOURCE, MAX_EARNINGS_CHIPS,
  capEarnings, earningsItems, macroDateItems, nextFomcDecision, thisWeekDay, thisWeekRows, thisWeekSources,
} from '../thisWeek'
import { FOMC_MEETINGS } from '../fomcCalendar'
import { ECONOMIC_RELEASES, RELEASE_AGENCIES, RELEASE_KINDS, type ReleaseKind } from '../releaseCalendar'
import type { UpcomingEarnings } from '../earningsCalendar'

// T-468 (D242): the Headlines strip computes nothing new — it picks the NEXT
// of each date the app already keeps and labels each row with who publishes
// it. These tests hold the picking, the gating and the citations, because the
// strip sits on the one page every session starts on.

const NOW = new Date('2026-12-01T15:00:00Z')

const earning = (symbol: string, date: string, time: UpcomingEarnings['time'] = null): UpcomingEarnings => ({
  symbol, name: symbol, date, fiscalPeriodEnd: null, time, epsEstimate: null, source: 'fmp',
})

describe('macroDateItems', () => {
  it('is empty when neither module is on — the strip renders nothing', () => {
    expect(macroDateItems({ macroOn: false, equitiesOn: false, now: NOW })).toEqual([])
  })

  it('picks the next Fed decision and the next release of each kind, in date order', () => {
    const items = macroDateItems({ macroOn: true, equitiesOn: false, now: NOW })
    const today = '2026-12-01'

    const fomc = items.find((i) => i.kind === 'fomc')
    expect(fomc).toBeDefined()
    expect(fomc!.date).toBe(FOMC_MEETINGS.find((m) => m.end >= today)!.end)
    expect(fomc!.source).toBe(FED_SOURCE)

    // One row per release kind, and each is the table's own next of that kind.
    for (const kind of Object.keys(RELEASE_KINDS) as ReleaseKind[]) {
      const row = items.find((i) => i.id === `release:${kind}`)
      expect(row, kind).toBeDefined()
      expect(row!.date).toBe(ECONOMIC_RELEASES.find((r) => r.kind === kind && r.date >= today)!.date)
    }

    const dates = items.map((i) => i.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('names each release row’s agency with its own citation (D211)', () => {
    const items = macroDateItems({ macroOn: true, equitiesOn: false, now: NOW })
    for (const row of items.filter((i) => i.kind === 'release')) {
      const kind = row.id.replace('release:', '') as ReleaseKind
      expect(row.source).toBe(RELEASE_AGENCIES[RELEASE_KINDS[kind].agency].citation)
      expect(row.source).toMatch(/^Source: U\.S\. Bureau of /)
    }
  })

  it('links to the Macro section when the reader has it, else the Equities calendar', () => {
    for (const row of macroDateItems({ macroOn: true, equitiesOn: true, now: NOW })) expect(row.href).toBe('/macro/rates')
    for (const row of macroDateItems({ macroOn: false, equitiesOn: true, now: NOW })) expect(row.href).toBe('/equities/calendar')
  })

  it('past the tables, rows are left out rather than guessed', () => {
    const far = new Date('2035-01-01T12:00:00Z')
    expect(nextFomcDecision(far)).toBeNull()
    expect(macroDateItems({ macroOn: true, equitiesOn: false, now: far })).toEqual([])
  })
})

describe('earningsItems', () => {
  it('keeps only reports inside the soon window, sorted, linking each stock’s page', () => {
    const items = earningsItems({
      AAPL: earning('AAPL', '2026-12-03', 'post-market'),
      MSFT: earning('MSFT', '2026-12-02'),
      XOM: earning('XOM', '2027-02-01'), // outside the window
      NKE: null, // no listed report
    }, NOW)
    expect(items.map((i) => i.label)).toEqual(['MSFT earnings', 'AAPL earnings'])
    expect(items[1].href).toBe('/equities/aapl')
    expect(items[1].timeLabel).toBe('after the market closes')
    for (const i of items) expect(i.source).toBe(EARNINGS_SOURCE)
  })

  it('is empty with no dates at all', () => {
    expect(earningsItems(undefined, NOW)).toEqual([])
  })

  it('caps the chips and counts the rest', () => {
    const many = Array.from({ length: 9 }, (_, i) => earningsItems({ [`S${i}`]: earning(`S${i}`, '2026-12-02') }, NOW)[0])
    const { shown, more } = capEarnings(many)
    expect(shown).toHaveLength(MAX_EARNINGS_CHIPS)
    expect(more).toBe(9 - MAX_EARNINGS_CHIPS)
  })
})

describe('the strip’s assembly', () => {
  it('merges in date order and lists each distinct source once, in order', () => {
    const macro = macroDateItems({ macroOn: true, equitiesOn: true, now: NOW })
    const earnings = earningsItems({ AAPL: earning('AAPL', '2026-12-02') }, NOW)
    const rows = thisWeekRows(macro, earnings)
    expect(rows.map((r) => r.date)).toEqual(rows.map((r) => r.date).sort())
    const sources = thisWeekSources(rows)
    expect(new Set(sources).size).toBe(sources.length)
    expect(sources).toContain(FED_SOURCE)
    expect(sources).toContain(EARNINGS_SOURCE)
  })

  it('formats a calendar day in UTC so no zone shifts it', () => {
    expect(thisWeekDay('2026-12-09')).toBe('Wed, Dec 9')
  })
})

describe('the wiring', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')

  it('Headlines mounts the strip', () => {
    const page = read('../../../app/(dashboard)/headlines/page.tsx')
    expect(page).toContain('<ThisWeekStrip />')
  })

  it('the strip gates on the entitlements and fetches earnings only with Equities on', () => {
    const strip = read('../../../components/markets/ThisWeekStrip.tsx')
    expect(strip).toMatch(/isEnabled\('macro'\)/)
    expect(strip).toMatch(/isEnabled\('equities'\)/)
    // The earnings request's symbol list empties without the module, so the
    // hook's enabled-gate (list.length > 0) keeps the fetch from firing.
    expect(strip).toMatch(/if \(!equitiesOn\) return \[\]/)
    // The citations are printed, not tooltip-only (D211).
    expect(strip).toMatch(/\{sources\.join\(' · '\)\}/)
  })
})
