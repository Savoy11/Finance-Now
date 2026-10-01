import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  hoursLabel,
  overnightSessionLive,
  tradesOnWeekends,
  NASDAQ_OVERNIGHT,
  type OvernightSchedule,
  type TradingVenue,
} from '../marketHours'
import { CLASS_PROFILES } from '@/lib/data/assetClassProfiles'
import { discoverFrom, firstStaleDay, utc } from '../../../../scripts/check-staleness-horizon'

const DAY = 86_400_000
const VENUES: TradingVenue[] = ['us-exchange', 'fund-nav', 'crypto', 'futures', 'fx', 'us-rates']

const schedule = (launchStatus: OvernightSchedule['launchStatus']): OvernightSchedule => ({
  ...NASDAQ_OVERNIGHT,
  launch: '2026-12-06',
  launchStatus,
})
const LAUNCH = utc('2026-12-06')
const BEFORE = new Date(LAUNCH - DAY)
const AFTER = new Date(LAUNCH + DAY)

describe('the overnight session only goes live once confirmed', () => {
  it('a REPORTED start never makes it live, before or after the date', () => {
    // The whole point of the status field: a slipped launch must not leave the app
    // describing trading that is not happening.
    for (const now of [BEFORE, new Date(LAUNCH), AFTER, new Date(LAUNCH + 365 * DAY)]) {
      expect(overnightSessionLive(now, schedule('reported'))).toBe(false)
    }
  })

  it('a CONFIRMED start goes live at 00:00 UTC on its date, not a moment before', () => {
    expect(overnightSessionLive(new Date(LAUNCH - 1), schedule('confirmed'))).toBe(false)
    expect(overnightSessionLive(new Date(LAUNCH), schedule('confirmed'))).toBe(true)
    expect(overnightSessionLive(AFTER, schedule('confirmed'))).toBe(true)
  })
})

describe('the US-exchange label', () => {
  const label = (now: Date, s: OvernightSchedule) => hoursLabel('us-exchange', now, s)

  it('reported, before the date: today’s hours plus an approval with a REPORTED start', () => {
    const text = label(BEFORE, schedule('reported'))
    expect(text).toContain('9:30 am–4 pm ET')
    expect(text).toContain('is approved to add an overnight session')
    expect(text).toContain('reported for December 6, 2026')
    expect(text).not.toMatch(/trades overnight/)
  })

  it('reported, after the date: says the start was reported and is not confirmed', () => {
    // Not "reported for December 6" in January — a sentence that was true when written
    // and reads as a forecast once the date has passed.
    const text = label(AFTER, schedule('reported'))
    expect(text).toContain('was reported to start on December 6, 2026')
    expect(text).toContain('not confirmed')
    expect(text).not.toMatch(/trades overnight|is approved to add/)
  })

  it('confirmed, before the date: names the start as fact', () => {
    const text = label(BEFORE, schedule('confirmed'))
    expect(text).toContain('adds an overnight session')
    expect(text).toContain('on December 6, 2026')
    expect(text).not.toMatch(/reported|trades overnight/)
  })

  it('confirmed, from the date: Nasdaq trades overnight', () => {
    const text = label(AFTER, schedule('confirmed'))
    expect(text).toContain('Nasdaq also trades overnight (9 pm–4 am ET)')
    expect(text).toContain('23 hours a day')
    expect(text).not.toMatch(/reported|approved/)
  })

  it('four states, four different sentences', () => {
    const all = [
      label(BEFORE, schedule('reported')), label(AFTER, schedule('reported')),
      label(BEFORE, schedule('confirmed')), label(AFTER, schedule('confirmed')),
    ]
    expect(new Set(all).size).toBe(4)
  })
})

describe('every venue', () => {
  it('has an answer in every schedule state, with no advice wording', () => {
    const forbidden = /\b(should|recommend|buy|sell|avoid|best|worst|better investment|safer choice)\b/i
    for (const v of VENUES) {
      for (const s of [schedule('reported'), schedule('confirmed')]) {
        for (const now of [BEFORE, AFTER]) {
          const text = hoursLabel(v, now, s)
          expect(text, v).toBeTruthy()
          expect(text, v).not.toMatch(forbidden)
        }
      }
    }
  })

  it('covers every venue a class profile uses', () => {
    // Guards the list above: a venue added to the type and used by a class would
    // otherwise be skipped by the checks in this file.
    for (const p of Object.values(CLASS_PROFILES)) expect(VENUES).toContain(p.venue)
  })

  it('only crypto trades on weekends', () => {
    expect(VENUES.filter(tradesOnWeekends)).toEqual(['crypto'])
  })
})

describe('the shipped schedule and its reminder clock', () => {
  const source = readFileSync(join(__dirname, '..', 'marketHours.ts'), 'utf8')
  const { clocks, problems } = discoverFrom([{ rel: 'src/lib/utils/marketHours.ts', text: source }])

  it('is discovered by npm run staleness:check', () => {
    // Anti-vacuity: the assertion below means nothing if the checker cannot see the clock.
    expect(problems).toEqual([])
    expect(clocks).toHaveLength(1)
    expect(clocks[0].anchorName).toBe('MARKET_HOURS_LAST_VERIFIED')
  })

  it('while the start is only reported, the clock fires BEFORE the reported date', () => {
    // So someone checks the launch before the label would need to change. Re-dating the
    // anchor without confirming or moving the launch fails here.
    if (NASDAQ_OVERNIGHT.launchStatus !== 'reported') return
    expect(firstStaleDay(clocks[0])).toBeLessThan(utc(NASDAQ_OVERNIGHT.launch))
  })

  it('the guard above can fail: an anchor re-dated past the launch is caught', () => {
    const redated = source.replace(/MARKET_HOURS_LAST_VERIFIED = '\d{4}-\d{2}-\d{2}'/, "MARKET_HOURS_LAST_VERIFIED = '2026-11-15'")
    expect(redated).not.toBe(source)
    const [clock] = discoverFrom([{ rel: 'x.ts', text: redated }]).clocks
    expect(firstStaleDay(clock)).toBeGreaterThan(utc(NASDAQ_OVERNIGHT.launch))
  })
})
