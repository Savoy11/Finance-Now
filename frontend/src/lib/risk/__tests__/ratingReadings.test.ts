import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planWeeklyReading, weekStartUtc, type StoredReading } from '../ratingReadings'
import type { AssetRating, RatingClassNumber } from '../assetRating'
import { METHODOLOGY_V1 as M } from '../methodology/v1'

type Rated = Extract<AssetRating, { rated: true }>
const V: string = M.version
const NOW = new Date('2026-10-09T15:00:00Z') // a Friday; its week starts Monday 2026-10-05

function rating(cls: RatingClassNumber, score = 50): Rated {
  return { rated: true, version: V, score, cls, label: '', coreScore: score, coreCls: cls, capped: false, dimensions: [], recentVolatility: null }
}

/** `n` consecutive weekly readings ending the week before NOW's. */
function history(classes: number[], shown: number, version = V): StoredReading[] {
  const start = Date.parse('2026-10-05T00:00:00Z') - classes.length * 7 * 86_400_000
  return classes.map((cls, i) => ({
    weekStart: new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10),
    methodologyVersion: version,
    cls,
    shownCls: shown,
  }))
}

const plan = (r: Rated, stored: StoredReading[]) =>
  planWeeklyReading({ assetKind: 'crypto', assetId: 'bitcoin', rating: r, stored, now: NOW })

describe('weekStartUtc', () => {
  it('is the Monday of the week, in UTC', () => {
    expect(weekStartUtc(NOW)).toBe('2026-10-05')
    expect(weekStartUtc(new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05')
    expect(weekStartUtc(new Date('2026-10-11T23:59:59Z'))).toBe('2026-10-05') // Sunday
    expect(weekStartUtc(new Date('2026-10-12T00:00:00Z'))).toBe('2026-10-12')
  })
})

describe('planWeeklyReading', () => {
  it('a first rating starts at its class and writes this week’s reading', () => {
    const p = plan(rating(5, 33.333), [])
    expect(p).toMatchObject({ shownCls: 5, currentCls: 5, held: false, weeksInRun: 1 })
    expect(p.reading).toMatchObject({ weekStart: '2026-10-05', methodologyVersion: V, score: '33.33', cls: 5, shownCls: 5 })
  })

  it('holds the shown class until a full run of weeks is outside it', () => {
    const p = plan(rating(5), history(Array(M.stabilityWeeks - 2).fill(5), 4))
    expect(p).toMatchObject({ shownCls: 4, currentCls: 5, held: true, weeksInRun: M.stabilityWeeks - 1 })
    expect(p.reading?.shownCls).toBe(4)
  })

  it('moves once every week of the window is outside the shown class', () => {
    const p = plan(rating(5), history(Array(M.stabilityWeeks - 1).fill(5), 4))
    expect(p).toMatchObject({ shownCls: 5, held: false, weeksInRun: M.stabilityWeeks })
    expect(p.reading?.shownCls).toBe(5)
  })

  it('a missing week breaks the run and holds the class (a gap never helps it move)', () => {
    // Enough readings that, counted without regard to the gap, the window would be full.
    const full = history(Array(M.stabilityWeeks).fill(5), 4)
    const gapped = full.filter((_, i) => i !== 7)
    expect(gapped.length + 1).toBe(M.stabilityWeeks)
    const p = plan(rating(5), gapped)
    expect(p.shownCls).toBe(4)
    expect(p.weeksInRun).toBeLessThan(M.stabilityWeeks)
  })

  it('a gap right before this week keeps the earlier shown class rather than restarting', () => {
    const old = history(Array(4).fill(5), 3).map((r) => ({
      ...r,
      weekStart: new Date(Date.parse(`${r.weekStart}T00:00:00Z`) - 3 * 7 * 86_400_000).toISOString().slice(0, 10),
    }))
    const p = plan(rating(5), old)
    expect(p).toMatchObject({ shownCls: 3, held: true, weeksInRun: 1 })
  })

  it('this week’s first reading stands; a later rating that week is shown but not stored', () => {
    const stored: StoredReading[] = [
      ...history(Array(M.stabilityWeeks - 1).fill(5), 4),
      { weekStart: '2026-10-05', methodologyVersion: V, cls: 5, shownCls: 5 },
    ]
    const p = plan(rating(4), stored)
    expect(p.reading).toBeNull()
    expect(p).toMatchObject({ shownCls: 5, currentCls: 4, held: true })
  })

  it('readings under another methodology version are ignored', () => {
    const p = plan(rating(2), history(Array(M.stabilityWeeks - 1).fill(6), 6, 'v0'))
    expect(p).toMatchObject({ shownCls: 2, held: false, weeksInRun: 1 })
  })

  it('refuses a stored class outside 1–7 instead of showing it', () => {
    expect(() => plan(rating(4), history([9], 4))).toThrow(RangeError)
  })
})

describe('the table matches the module', () => {
  it('the migration creates every column the reading carries, under a short key name', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../drizzle/0007_asset-rating-readings.sql'), 'utf8')
    for (const col of ['asset_kind', 'asset_id', 'week_start', 'methodology_version', 'score', 'cls', 'shown_cls', 'core_cls', 'capped']) {
      expect(sql).toContain(`"${col}"`)
    }
    for (const name of sql.matchAll(/CONSTRAINT "([^"]+)"/g)) expect(name[1].length).toBeLessThanOrEqual(63)
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)
  })
})
