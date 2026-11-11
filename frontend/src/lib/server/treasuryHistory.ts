import 'server-only'

import { recordProviderFetch } from '@/lib/api/live/providers'
import {
  REAL_MATURITIES, buildYieldHistory, intervalFor, rangeStart, yearsFor,
  type YieldHistoryPoint, type YieldHistoryRange,
} from '@/lib/data/yieldHistory'
import { fetchCurveYear, type CurveSnapshot } from './treasuryCurve'

// ─── Treasury yield history (T-446, owner decision D202) ─────────────────────
// One maturity's daily history from the official par curve, with the real yield
// and the market's expected inflation where the Treasury publishes a real yield
// for that maturity. Shared by /live-data/treasury-yield-history and the macro
// agent's price-history tool, so both read one source. The arithmetic is pure, in
// lib/data/yieldHistory.ts.
//
// The Treasury publishes one file per calendar year, so a range asks for each
// year it spans. The years are independent, so they are fetched together, and a
// year that fails is named in `missingYears` rather than failing the rest: a
// chart with a gap it states beats no chart.

export interface YieldHistory {
  maturity: string
  range: YieldHistoryRange
  interval: 'daily' | 'weekly'
  points: YieldHistoryPoint[]
  /** Whether a real yield (and so expected inflation) exists for this maturity. */
  hasReal: boolean
  /** Calendar years whose file could not be read, oldest first: the chart has a gap there. */
  missingYears: number[]
}

/** Each year's file, fetched together; a year that fails is named in `missing`. Shared with the gaps' history (T-464). */
export async function yearsOf(years: number[], kind: 'par' | 'real', now: Date) {
  const results = await Promise.allSettled(years.map((y) => fetchCurveYear(y, kind, now)))
  const snapshots: CurveSnapshot[] = []
  const missing: number[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') snapshots.push(...r.value)
    else missing.push(years[i])
  })
  return { snapshots, missing }
}

/** Throws when no reading at all could be had for the maturity. */
export async function fetchYieldHistory(maturity: string, range: YieldHistoryRange, now: Date = new Date()): Promise<YieldHistory> {
  try {
    const years = yearsFor(range, now)
    const hasReal = REAL_MATURITIES.includes(maturity)
    const [par, real] = await Promise.all([
      yearsOf(years, 'par', now),
      hasReal ? yearsOf(years, 'real', now) : Promise.resolve({ snapshots: [] as CurveSnapshot[], missing: [] as number[] }),
    ])
    const interval = intervalFor(range)
    const points = buildYieldHistory(maturity, par.snapshots, real.snapshots, rangeStart(range, now), interval)
    if (points.length === 0) throw new Error(par.missing.length ? `treasury.gov could not be read for ${par.missing.join(', ')}` : 'no readings in range')
    recordProviderFetch('treasury-gov', { count: points.length })
    return {
      maturity, range, interval, points, hasReal,
      missingYears: [...new Set([...par.missing, ...real.missing])].sort((a, b) => a - b),
    }
  } catch (err) {
    recordProviderFetch('treasury-gov', { error: err instanceof Error ? err.message : 'fetch failed' })
    throw err
  }
}
