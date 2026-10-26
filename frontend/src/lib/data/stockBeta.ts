import { betaVsBenchmark, toDailyCloses, type ChartPoint } from '@/lib/utils/compareStats'

/**
 * A stock's beta (D170, 2026-10-25): its daily returns over one year regressed on SPY's, on
 * shared trading days, by the function Compare uses (betaVsBenchmark). Pure, so the page and
 * the tests apply one rule.
 *
 * Closes with nothing taken out are refused: a split inside the year reads as a one-day move
 * of the split's size (Honeywell's 1-for-2 as +100%), which would swamp every other day.
 */
export const BETA_BENCHMARK = 'SPY'

interface ChartLike {
  points: ChartPoint[]
  basis?: string
}

export type StockBeta =
  | { ok: true; beta: number; rSquared: number; overlap: number }
  | { ok: false; reason: string }

export function stockBetaFrom(stock: ChartLike | null, benchmark: ChartLike | null): StockBeta {
  if (!stock?.points.length || !benchmark?.points.length) {
    return { ok: false, reason: 'no price history from a configured provider, so no beta is worked out.' }
  }
  if (stock.basis === 'unadjusted' || benchmark.basis === 'unadjusted') {
    return { ok: false, reason: 'the only prices available are not adjusted for splits, which would distort a beta.' }
  }
  const r = betaVsBenchmark(toDailyCloses(stock.points), toDailyCloses(benchmark.points))
  if (!r) return { ok: false, reason: 'too few trading days shared with the benchmark to work one out.' }
  return { ok: true, ...r }
}
