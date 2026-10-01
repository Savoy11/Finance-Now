import { describe, it, expect } from 'vitest'
import {
  classAnswer, compareAssetClasses, CLASS_PROFILES, DIMENSION_LABELS, type DimensionId,
} from '../assetClassProfiles'
import { hoursLabel, NASDAQ_OVERNIGHT } from '@/lib/utils/marketHours'
import type { InstrumentClass } from '@/lib/data/instruments'

const ALL: InstrumentClass[] = ['crypto', 'equity', 'etf', 'mutual', 'commodity', 'currency', 'rate']
const DIMS = Object.keys(DIMENSION_LABELS) as DimensionId[]

// "When it trades" changes with the date, so the content checks run on both sides of
// the one dated change in it (Nasdaq's overnight session).
const DAY = 86_400_000
const LAUNCH = Date.parse(`${NASDAQ_OVERNIGHT.launch}T00:00:00Z`)
const DATES = [new Date(LAUNCH - 30 * DAY), new Date(LAUNCH + 30 * DAY)]
const NOW = DATES[0]

describe('CLASS_PROFILES completeness', () => {
  it('covers every instrument class on every dimension', () => {
    // Guards the guard: a class added to instruments.ts without a profile
    // would render an empty column in the comparison panel.
    for (const c of ALL) {
      expect(CLASS_PROFILES[c], `missing profile for ${c}`).toBeDefined()
      for (const now of DATES) {
        for (const d of DIMS) {
          expect(classAnswer(c, d, now), `${c} missing ${d}`).toBeTruthy()
        }
      }
    }
  })

  it('never uses advice vocabulary', () => {
    // The owner's line: explanation stays, recommendation goes. These words
    // appearing in a profile cell would put the panel on the wrong side of it.
    const forbidden = /\b(should|recommend|buy|sell|avoid|best|worst|better investment|safer choice)\b/i
    for (const c of ALL) {
      expect(CLASS_PROFILES[c].whatItIs).not.toMatch(forbidden)
      for (const now of DATES) {
        for (const d of DIMS) {
          expect(classAnswer(c, d, now), `advice wording in ${c}.${d}`).not.toMatch(forbidden)
        }
      }
    }
  })

  it('reads "When it trades" from the market-hours module, never a typed string', () => {
    // The TS-9 regression: stocks and ETFs said "US exchange hours, weekdays." in a
    // string nothing could update when Nasdaq's overnight session starts.
    for (const c of ALL) {
      for (const now of DATES) {
        expect(classAnswer(c, 'hours', now)).toBe(hoursLabel(CLASS_PROFILES[c].venue, now))
      }
      expect(Object.keys(CLASS_PROFILES[c].dimensions)).not.toContain('hours')
    }
    expect(classAnswer('equity', 'hours', NOW)).toContain('Nasdaq')
  })
})

describe('compareAssetClasses', () => {
  it('returns null below two distinct classes — no empty panel', () => {
    expect(compareAssetClasses([])).toBeNull()
    expect(compareAssetClasses(['equity'])).toBeNull()
    expect(compareAssetClasses(['equity', 'equity', 'equity'])).toBeNull()
  })

  it('deduplicates while preserving first-seen order', () => {
    const r = compareAssetClasses(['crypto', 'equity', 'crypto', 'equity'])!
    expect(r.classes).toEqual(['crypto', 'equity'])
  })

  it('partitions every dimension into shared or differing, never both or neither', () => {
    const r = compareAssetClasses(['equity', 'crypto'])!
    const total = r.similarities.length + r.differences.length
    expect(total).toBe(Object.keys(DIMENSION_LABELS).length)
  })

  it('finds genuine sharing between ETFs and mutual funds', () => {
    // Both are pooled vehicles: ownership, income and supply answers are
    // written identically on purpose. If someone edits one side, this fails
    // and forces the question "did they really stop being alike?"
    const r = compareAssetClasses(['etf', 'mutual'], NOW)!
    const sharedDims = r.similarities.map((row) => row.dimension)
    expect(sharedDims).toContain('ownership')
    expect(sharedDims).toContain('income')
    expect(sharedDims).toContain('supply')
    // And they genuinely differ on trading mechanics.
    expect(r.differences.map((row) => row.dimension)).toContain('hours')
  })

  it('stock vs crypto differs on every dimension', () => {
    const r = compareAssetClasses(['equity', 'crypto'])!
    expect(r.similarities).toEqual([])
    expect(r.differences).toHaveLength(Object.keys(DIMENSION_LABELS).length)
  })

  it('emits the weekend-overlap caveat only when a seven-day market meets a weekday one', () => {
    const weekend = (classes: InstrumentClass[]) =>
      compareAssetClasses(classes, NOW)!.caveats.find((c) => c.includes('weekend'))
    // Crypto beside each weekday venue: stock, NAV fund, futures, FX, rates.
    for (const other of ['equity', 'mutual', 'commodity', 'currency', 'rate'] as InstrumentClass[]) {
      expect(weekend(['crypto', other]), `crypto + ${other}`).toBeDefined()
    }
    expect(weekend(['crypto', 'equity'])).toContain('crypto’s weekend moves')
    // Weekday venues only, however many.
    expect(weekend(['equity', 'etf'])).toBeUndefined()
    expect(weekend(['equity', 'currency', 'commodity'])).toBeUndefined()
  })

  it('says correlation pairs shared dates and window stats do not — the code does both', () => {
    // The old caveat said window stats were computed on shared days only. They are not:
    // Compare runs windowStats over each series' own points (compareStats.ts).
    const text = compareAssetClasses(['crypto', 'equity'], NOW)!.caveats.find((c) => c.includes('weekend'))!
    expect(text).toMatch(/Correlation and beta pair the series on dates both have a close/)
    expect(text).toMatch(/window stats use each series’ own trading days/)
  })

  it('emits the not-investable caveat for rate indices', () => {
    const r = compareAssetClasses(['rate', 'equity'])!
    expect(r.caveats.some((c) => c.includes('not investable'))).toBe(true)
  })

  it('emits carry, NAV and futures-roll caveats for their classes', () => {
    const r = compareAssetClasses(['currency', 'mutual', 'commodity'])!
    expect(r.caveats.some((c) => c.includes('carry'))).toBe(true)
    expect(r.caveats.some((c) => c.includes('NAV'))).toBe(true)
    expect(r.caveats.some((c) => c.includes('rolling') || c.includes('roll'))).toBe(true)
  })

  it('only includes values for the classes actually compared', () => {
    const r = compareAssetClasses(['equity', 'commodity'])!
    for (const row of [...r.similarities, ...r.differences]) {
      expect(Object.keys(row.values).sort()).toEqual(['commodity', 'equity'])
    }
  })
})
