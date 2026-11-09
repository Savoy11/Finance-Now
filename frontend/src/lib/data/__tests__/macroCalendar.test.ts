import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ECONOMIC_RELEASES, RELEASE_AGENCIES, RELEASE_DATES_LAST_VERIFIED, RELEASE_DATES_STALE_AFTER_DAYS, RELEASE_KINDS,
  getReleaseDatesProvenance, nextReleases, releaseLabel, releaseScheduleSpan, releasesBetween,
} from '../releaseCalendar'
import { daysUntil, fedMeetingsInYear, macroCalendarAhead, macroCalendarNext, meetingDays, shortDay } from '../macroCalendar'
import { FOMC_MEETINGS, isFomcMeetingTentative } from '../fomcCalendar'
import { MACRO_NEWS_MATCHERS, MAX_RELATED, detectMacroRelated, newsCanName } from '../macroNewsMatchers'
import { COMMODITY_CATALOG } from '../commodityCatalog'
import { CURRENCY_CATALOG } from '../currencyCatalog'
import { RATES_CATALOG } from '../ratesCatalog'
import { releaseEventsBetween, mergeEconomicEvents, type EconomicEvent } from '@/lib/server/marketCalendar'
import { SOURCE_TERMS } from '@/lib/server/sourceTerms'
import { DATA_SOURCES } from '../dataSources'
import { runTool, toolsForAgent } from '@/lib/agents/tools'

// T-456 (D211): the Fed's meetings and the CPI, jobs, GDP and PCE release dates on the Macro
// pages, the Market Calendar and the macro agents; news on each instrument's page.

const NOW = new Date('2026-11-07T15:00:00Z')
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('the release-date table', () => {
  it('is in date order, with real dates, the four kinds, and an estimate on GDP rows only', () => {
    const dates = ECONOMIC_RELEASES.map((r) => r.date)
    expect([...dates].sort()).toEqual(dates)
    for (const r of ECONOMIC_RELEASES) {
      expect(new Date(`${r.date}T00:00:00Z`).toISOString().slice(0, 10), r.date).toBe(r.date)
      expect(Object.keys(RELEASE_KINDS)).toContain(r.kind)
      expect(r.kind === 'gdp' ? r.estimate : undefined, `${r.date} ${r.kind}`).toBe(r.kind === 'gdp' ? r.estimate ?? 'missing' : undefined)
      expect(r.time).toBe('8:30 AM')
    }
    // No release is entered twice.
    expect(new Set(ECONOMIC_RELEASES.map((r) => `${r.kind}:${r.period}:${r.estimate ?? ''}`)).size).toBe(ECONOMIC_RELEASES.length)
  })

  it('holds the dates the agencies’ pages listed (spot checks, read 2026-11-07)', () => {
    const on = (date: string) => ECONOMIC_RELEASES.filter((r) => r.date === date).map((r) => r.kind).sort()
    expect(on('2026-11-10')).toEqual(['cpi'])
    expect(on('2026-11-25')).toEqual(['gdp', 'pce'])
    expect(on('2027-01-08')).toEqual(['jobs'])
    expect(on('2027-04-29')).toEqual(['gdp', 'pce'])
    expect(releaseScheduleSpan()).toEqual({ from: '2026-11-06', through: '2027-12-22' })
  })

  it('names each release with its period', () => {
    expect(releaseLabel(ECONOMIC_RELEASES.find((r) => r.date === '2026-11-10')!)).toBe('CPI inflation for October 2026')
    expect(releaseLabel(ECONOMIC_RELEASES.find((r) => r.date === '2026-11-25' && r.kind === 'gdp')!)).toBe('GDP, 3rd Quarter 2026 (second estimate)')
  })

  it('gives the next release of each kind, in date order', () => {
    expect(nextReleases(NOW).map((r) => [r.kind, r.date])).toEqual([
      ['cpi', '2026-11-10'], ['gdp', '2026-11-25'], ['pce', '2026-11-25'], ['jobs', '2026-12-04'],
    ])
    expect(nextReleases(new Date('2028-01-01T00:00:00Z'))).toEqual([])
    // A release due today is still the next one, until the day is over.
    expect(nextReleases(new Date('2026-11-10T20:00:00Z'))[0]).toMatchObject({ kind: 'cpi', date: '2026-11-10' })
    expect(macroCalendarNext(new Date('2026-12-09T20:00:00Z')).fed?.meeting.end).toBe('2026-12-09')
    expect(releasesBetween('2026-11-01', '2026-11-30').map((r) => r.date)).toEqual(['2026-11-06', '2026-11-10', '2026-11-25', '2026-11-25'])
  })

  it('carries a review clock that turns stale after its window', () => {
    expect(RELEASE_DATES_LAST_VERIFIED).toBe('2026-11-07')
    expect(getReleaseDatesProvenance(NOW)).toMatchObject({ stale: false, confidence: 'high', through: '2027-12-22' })
    const late = new Date(Date.parse(`${RELEASE_DATES_LAST_VERIFIED}T00:00:00Z`) + (RELEASE_DATES_STALE_AFTER_DAYS + 1) * 86_400_000)
    expect(getReleaseDatesProvenance(late)).toMatchObject({ stale: true, confidence: 'low' })
  })

  it('names both agencies in the registry of sources and their terms, with the market calendar', () => {
    for (const domain of ['bls.gov', 'bea.gov']) {
      const entry = SOURCE_TERMS.find((e) => e.domain === domain)
      expect(entry, domain).toBeDefined()
      expect(entry!.verdict).toBe('approved')
      expect(entry!.finding).toContain('public domain')
    }
    const hosts = DATA_SOURCES.find((d) => d.id === 'market-calendar')!.providers.map((p) => p.host)
    expect(hosts).toEqual(expect.arrayContaining(['www.bls.gov', 'www.bea.gov']))
  })

  it('is cited wherever its dates are shown (both agencies ask to be)', () => {
    for (const f of ['src/components/markets/MacroCalendarCard.tsx', 'src/app/(dashboard)/equities/calendar/page.tsx']) {
      expect(read(f), f).toContain('RELEASE_AGENCIES.bls.name')
      expect(read(f), f).toContain('RELEASE_AGENCIES.bea.name')
    }
  })
})

describe('the release rows on the Market Calendar', () => {
  const fmp = (event: string, date: string): EconomicEvent => ({ event, date, country: 'US', impact: 'High', source: 'fmp' })

  it('gives each release one high-impact row linked to its agency’s schedule', () => {
    const rows = releaseEventsBetween('2026-11-01', '2026-11-30')
    expect(rows.map((r) => [r.date, r.source])).toEqual([['2026-11-06', 'bls'], ['2026-11-10', 'bls'], ['2026-11-25', 'bea'], ['2026-11-25', 'bea']])
    expect(rows[1]).toMatchObject({ impact: 'High', url: RELEASE_AGENCIES.bls.scheduleUrls[0] })
    expect(rows[0].url).toBe(RELEASE_AGENCIES.bls.scheduleUrls[1])
    expect(rows[1].event).toContain('CPI inflation for October 2026')
    // A 2027 BEA row links the 2027 schedule.
    expect(releaseEventsBetween('2027-01-28', '2027-01-28')[0].url).toBe(RELEASE_AGENCIES.bea.scheduleUrls[1])
  })

  it('drops FMP’s copy of a release on its day, keeps its sub-figures, and never caps the table’s rows', () => {
    const releases = releaseEventsBetween('2026-11-10', '2026-11-10')
    const merged = mergeEconomicEvents([fmp('CPI', '2026-11-10'), fmp('Core CPI', '2026-11-10'), fmp('CPI', '2026-11-11')], [], 40, releases)
    expect(merged.map((e) => `${e.source}:${e.event.slice(0, 8)}`)).toEqual(['bls:CPI infl', 'fmp:Core CPI', 'fmp:CPI'])
    expect(mergeEconomicEvents([], [], 0, releases)).toHaveLength(1)
  })

  it('is served by the calendar route with no key, like the Fed’s rows', () => {
    const route = read('src/app/live-data/market-calendar/route.ts')
    expect(route).toMatch(/economic: mergeEconomicEvents\(\[\], fomc, 0, releases\)/)
  })
})

describe('the Macro pages’ calendar', () => {
  it('gives the next Fed meeting and the next releases', () => {
    const next = macroCalendarNext(NOW)
    expect(next.fed?.meeting.end).toBe('2026-12-09')
    // The meeting before it (Oct 27–28) has been held, so the date is confirmed.
    expect(next.fed?.tentative).toBe(false)
    expect(next.releases).toHaveLength(4)
    expect(macroCalendarNext(new Date('2028-02-01T00:00:00Z')).fed).toBeNull()
  })

  it('writes dates and counts days plainly', () => {
    expect(shortDay('2026-12-09')).toBe('Dec 9, 2026')
    expect(meetingDays({ start: '2026-12-08', end: '2026-12-09', projections: true })).toBe('Dec 8–9, 2026')
    expect(meetingDays({ start: '2027-04-30', end: '2027-05-01', projections: false })).toBe('Apr 30–May 1, 2027')
    expect(daysUntil('2026-11-07', NOW)).toBe('today')
    expect(daysUntil('2026-11-08', NOW)).toBe('tomorrow')
    expect(daysUntil('2026-11-10', NOW)).toBe('in 3 days')
  })

  it('marks this year’s meetings held or still to come', () => {
    const y = fedMeetingsInYear(2026, NOW)
    expect(y).toHaveLength(8)
    expect(y.filter((m) => !m.held).map((m) => m.meeting.end)).toEqual(['2026-12-09'])
  })

  it('lists what is ahead for the agents, Fed first on a shared day, each with its source', () => {
    const ahead = macroCalendarAhead(40, NOW)
    expect(ahead.map((e) => e.date)).toEqual(['2026-11-10', '2026-11-25', '2026-11-25', '2026-12-04', '2026-12-09', '2026-12-10'])
    expect(ahead.find((e) => e.kind === 'fed')).toMatchObject({ source: 'Federal Reserve Board' })
    expect(ahead[0]).toMatchObject({ kind: 'cpi', source: 'U.S. Bureau of Labor Statistics' })
  })
})

describe('get_economic_calendar', () => {
  it('is offered to the macro agents and the Assistant', () => {
    expect(toolsForAgent('macro').map((t) => t.name)).toContain('get_economic_calendar')
    expect(toolsForAgent('all').map((t) => t.name)).toContain('get_economic_calendar')
    expect(toolsForAgent('equities').map((t) => t.name)).not.toContain('get_economic_calendar')
  })

  it('answers from the tables with their sources and where they end, asking no route', async () => {
    const out = await runTool('get_economic_calendar', { days: 400 }, 'http://unused') as Record<string, any>
    expect(out.days).toBe(400)
    expect(Array.isArray(out.events)).toBe(true)
    expect(out.scheduleThrough).toEqual({ fedMeetings: '2028-01-26', releases: '2027-12-22' })
    expect(out.sources.releases).toContain('Bureau of Labor Statistics')
    expect(out.sources.releases).toContain('Bureau of Economic Analysis')
  })
})

describe('news on each instrument’s page', () => {
  it('links every matcher to a real instrument page', () => {
    const pages = new Set([
      ...COMMODITY_CATALOG.map((c) => `/macro/commodities/${c.slug}`),
      ...CURRENCY_CATALOG.map((c) => `/macro/currencies/${c.slug}`),
      ...RATES_CATALOG.map((r) => `/macro/rates/${r.slug}`),
    ])
    for (const m of MACRO_NEWS_MATCHERS) expect(pages.has(m.href), m.href).toBe(true)
  })

  it('recognises every currency pair by its written form, and the common names', () => {
    expect(detectMacroRelated('AUD/USD climbs as RBA holds').map((r) => r.href)).toEqual(['/macro/currencies/aud-usd'])
    expect(detectMacroRelated('Euro slips against the dollar').map((r) => r.label)).toEqual(['EUR/USD'])
    for (const c of CURRENCY_CATALOG.filter((x) => x.name.includes('/'))) expect(newsCanName(`/macro/currencies/${c.slug}`), c.name).toBe(true)
  })

  it('recognises the 5-year yield only beside a bond word', () => {
    expect(detectMacroRelated('The 5-year Treasury yield rose to 4.1%').map((r) => r.href)).toEqual(['/macro/rates/5-year-yield'])
    expect(detectMacroRelated('Five-year notes rallied after the jobs report').map((r) => r.label)).toEqual(['5-Year Yield'])
    expect(detectMacroRelated('Natural gas hits a 5-year high').map((r) => r.href)).not.toContain('/macro/rates/5-year-yield')
  })

  it('keeps every instrument a story names, each once, and caps only the chips (D214)', () => {
    // The audit's story: four markets come before the yields in matcher order, and a cap of four
    // here kept it off the 10-Year Yield page.
    const all = detectMacroRelated('Gold and silver rallied, crude oil slipped and the euro firmed as the 10-year Treasury yield fell')
    expect(all.map((r) => r.label)).toContain('10-Year Yield')
    expect(all.length).toBeGreaterThan(MAX_RELATED)
    expect(new Set(all.map((r) => r.href)).size).toBe(all.length)
    expect(read('src/app/(dashboard)/macro/news/MacroNewsClient.tsx')).toMatch(/article\.related\.slice\(0, MAX_RELATED\)/)
    expect(read('src/app/(dashboard)/headlines/page.tsx')).toMatch(/tagLinks \?\? \[\]\)\.slice\(0, MAX_RELATED\)/)
  })

  it('says when the feed cannot recognise an instrument, rather than reporting no stories', () => {
    expect(newsCanName('/macro/rates/2-year-note-future')).toBe(false)
    expect(read('src/components/markets/InstrumentNewsCard.tsx')).toContain('no way to recognise')
  })

  it('is on every macro instrument page, and Headlines has a Macro section', () => {
    for (const f of [
      'src/app/(dashboard)/macro/commodities/[slug]/CommodityDetailClient.tsx',
      'src/app/(dashboard)/macro/currencies/[slug]/CurrencyDetailClient.tsx',
      'src/app/(dashboard)/macro/rates/[slug]/RatesDetailClient.tsx',
    ]) expect(read(f), f).toContain('<InstrumentNewsCard')
    const headlines = read('src/app/(dashboard)/headlines/page.tsx')
    expect(headlines).toContain("fetch('/live-data/macro-news")
    expect(headlines).toContain("isEnabled('macro')")
  })
})

describe('the Macro calendar counts from New York’s day, not UTC’s (code audit 2026-11-09, D214)', () => {
  // 9:30 pm Eastern on Nov 9 is already Nov 10 in UTC; CPI is released on Nov 10.
  const NOV9_EVENING = new Date('2026-11-10T02:30:00Z')
  // 8 pm Eastern on Dec 8, and on Dec 9, the Fed's decision day.
  const DEC8_EVENING = new Date('2026-12-09T01:00:00Z')
  const DEC9_EVENING = new Date('2026-12-10T01:00:00Z')

  it('calls tomorrow’s CPI tomorrow in the US evening', () => {
    const cpi = macroCalendarNext(NOV9_EVENING).releases.find((r) => r.kind === 'cpi')
    expect(cpi?.date).toBe('2026-11-10')
    expect(daysUntil('2026-11-10', NOV9_EVENING)).toBe('tomorrow')
  })

  it('keeps the Fed decision on its day until midnight in New York', () => {
    expect(daysUntil('2026-12-09', DEC8_EVENING)).toBe('tomorrow')
    expect(macroCalendarNext(DEC9_EVENING).fed?.meeting.end).toBe('2026-12-09')
    expect(daysUntil('2026-12-09', DEC9_EVENING)).toBe('today')
  })

  it('keeps a release on its own day until midnight in New York', () => {
    // 9:30 pm Eastern on Nov 10, CPI day: UTC has turned to Nov 11 and used to drop it.
    const cpi = nextReleases(new Date('2026-11-11T02:30:00Z')).find((r) => r.kind === 'cpi')
    expect(cpi?.date).toBe('2026-11-10')
  })

  it('counts the next Fed meeting tentative until the one before it is over in New York', () => {
    const jan = FOMC_MEETINGS.findIndex((m) => m.end === '2027-01-27')
    expect(isFomcMeetingTentative(jan, DEC8_EVENING)).toBe(true)
    expect(isFomcMeetingTentative(jan, DEC9_EVENING)).toBe(false)
  })

  it('looks ahead from New York’s day for the macro agents', () => {
    const ahead = macroCalendarAhead(1, NOV9_EVENING)
    expect(ahead.map((e) => e.date)).toContain('2026-11-10')
  })
})
