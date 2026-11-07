// ─── Ranges and spacing for a once-a-day official series ─────────────────────
//
// Shared by the Treasury yield history (T-446, D202) and the European Central
// Bank's currency reference rates (T-445, D203): both are one official figure a
// day, both are charted over the same ranges, and both keep each week's last
// reading over a span longer than a year, so a chart of ten years is not
// thousands of points drawn as one line. Pure; the clock is passed in.

export const HISTORY_RANGES = ['1mo', '3mo', '6mo', '1y', '5y', '10y'] as const
export type HistoryRange = (typeof HISTORY_RANGES)[number]
export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
  '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y', '10y': '10Y',
}

/** Months each range spans. */
const RANGE_MONTHS: Record<HistoryRange, number> = { '1mo': 1, '3mo': 3, '6mo': 6, '1y': 12, '5y': 60, '10y': 120 }

/** Ranges longer than this many months keep each week's last reading. */
const WEEKLY_AFTER_MONTHS = 12

export const isHistoryRange = (v: string): v is HistoryRange => (HISTORY_RANGES as readonly string[]).includes(v)

/** The first day (YYYY-MM-DD) a range covers, counted back from `end`. */
export function rangeStart(range: HistoryRange, end: Date): string {
  const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  d.setUTCMonth(d.getUTCMonth() - RANGE_MONTHS[range])
  return d.toISOString().slice(0, 10)
}

/** The calendar years a range needs, oldest first (the Treasury publishes one file per year). */
export function yearsFor(range: HistoryRange, now: Date): number[] {
  const first = Number(rangeStart(range, now).slice(0, 4))
  const last = now.getUTCFullYear()
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

export const intervalFor = (range: HistoryRange): 'daily' | 'weekly' => (RANGE_MONTHS[range] > WEEKLY_AFTER_MONTHS ? 'weekly' : 'daily')

/** Monday of the week a date falls in, as YYYY-MM-DD. */
function weekOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Each week's last reading, oldest first. The input must already be sorted by date. */
export function lastOfEachWeek<T extends { date: string }>(points: readonly T[]): T[] {
  const byWeek = new Map<string, T>()
  for (const p of points) byWeek.set(weekOf(p.date), p)
  return [...byWeek.values()]
}

export interface ClosingCandle { time: number; open: number; high: number; low: number; close: number; volume: number }

/**
 * A once-a-day series as closing-only candles, for the shared chart and
 * indicator engine: one figure a day, so open, high, low and close are the same
 * and there is no volume. Only what reads closes alone may be drawn or counted
 * from them (the Macro TA page and scanner hold to that).
 */
export function closingCandlesOf<T extends { date: string }>(points: readonly T[], value: (p: T) => number): ClosingCandle[] {
  return points.map((p) => {
    const v = value(p)
    return { time: Math.floor(Date.parse(`${p.date}T00:00:00Z`) / 1000), open: v, high: v, low: v, close: v, volume: 0 }
  })
}
