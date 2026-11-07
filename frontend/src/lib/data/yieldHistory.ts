// ─── Treasury yield history and expected inflation (T-446, D202) ─────────────
//
// The pure half of /live-data/treasury-yield-history: which calendar years a
// range needs, each maturity's series from the official daily curves, and the
// bond market's expected inflation ("breakeven") at a maturity, which is the
// ordinary par yield minus the inflation-protected (real) par yield on the same
// day. Arithmetic on two figures the US Treasury publishes, never a forecast of
// our own. The fetching is lib/server/treasuryHistory.ts.
//
// Every figure is a daily official reading. A span longer than a year keeps each
// week's last reading, which the response says (`interval`), so a chart of ten
// years is not ten thousand points drawn as one line.

/** The 13 maturities of the daily par curve, in curve order. */
export const PAR_MATURITIES: ReadonlyArray<{ label: string; years: number }> = [
  { label: '1M', years: 1 / 12 },
  { label: '2M', years: 2 / 12 },
  { label: '3M', years: 3 / 12 },
  { label: '4M', years: 4 / 12 },
  { label: '6M', years: 6 / 12 },
  { label: '1Y', years: 1 },
  { label: '2Y', years: 2 },
  { label: '3Y', years: 3 },
  { label: '5Y', years: 5 },
  { label: '7Y', years: 7 },
  { label: '10Y', years: 10 },
  { label: '20Y', years: 20 },
  { label: '30Y', years: 30 },
]

/** The maturities of the daily real (inflation-protected) par curve. Expected inflation exists only for these. */
export const REAL_MATURITIES: readonly string[] = ['5Y', '7Y', '10Y', '20Y', '30Y']

export const YIELD_HISTORY_RANGES = ['1mo', '3mo', '6mo', '1y', '5y', '10y'] as const
export type YieldHistoryRange = (typeof YIELD_HISTORY_RANGES)[number]
export const YIELD_HISTORY_RANGE_LABELS: Record<YieldHistoryRange, string> = {
  '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y', '10y': '10Y',
}

/** Months each range spans. */
const RANGE_MONTHS: Record<YieldHistoryRange, number> = { '1mo': 1, '3mo': 3, '6mo': 6, '1y': 12, '5y': 60, '10y': 120 }

/** Ranges longer than this many months keep each week's last reading. */
const WEEKLY_AFTER_MONTHS = 12

export const isYieldHistoryRange = (v: string): v is YieldHistoryRange => (YIELD_HISTORY_RANGES as readonly string[]).includes(v)
export const isParMaturity = (v: string) => PAR_MATURITIES.some((m) => m.label === v)

/** The par-curve label for a maturity in years (0.25 → '3M'), or null when the curve publishes none. */
export function parLabelFor(years: number): string | null {
  return PAR_MATURITIES.find((m) => Math.abs(m.years - years) <= 0.02)?.label ?? null
}

/** The first day (YYYY-MM-DD) a range covers, counted back from `end`. */
export function rangeStart(range: YieldHistoryRange, end: Date): string {
  const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  d.setUTCMonth(d.getUTCMonth() - RANGE_MONTHS[range])
  return d.toISOString().slice(0, 10)
}

/** The calendar years a range needs, oldest first: the Treasury publishes one file per year. */
export function yearsFor(range: YieldHistoryRange, now: Date): number[] {
  const first = Number(rangeStart(range, now).slice(0, 4))
  const last = now.getUTCFullYear()
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

export const intervalFor = (range: YieldHistoryRange): 'daily' | 'weekly' => (RANGE_MONTHS[range] > WEEKLY_AFTER_MONTHS ? 'weekly' : 'daily')

export interface DatedCurve {
  /** YYYY-MM-DD */
  date: string
  points: ReadonlyArray<{ label: string; yieldPct: number }>
}

export interface YieldHistoryPoint {
  /** YYYY-MM-DD */
  date: string
  /** The ordinary (nominal) par yield, percent. */
  yieldPct: number
  /** The real par yield the same day, percent; absent where the Treasury publishes none. */
  realPct?: number
  /** yieldPct − realPct, percentage points, to hundredths; present only with both. */
  breakevenPct?: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Ordinary minus real yield, to hundredths of a percentage point. */
export function breakeven(yieldPct: number, realPct: number): number {
  return round2(yieldPct - realPct)
}

/** Monday of the week a date falls in, as YYYY-MM-DD, for keeping one reading a week. */
function weekOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/**
 * One maturity's history from the daily curves, from `from` on, oldest first.
 * A day the ordinary curve lacks that maturity is left out; the real yield and
 * expected inflation are added only on days the real curve has the same maturity.
 * For a weekly interval, each week's last reading is kept.
 */
export function buildYieldHistory(
  label: string,
  nominal: readonly DatedCurve[],
  real: readonly DatedCurve[],
  from: string,
  interval: 'daily' | 'weekly',
): YieldHistoryPoint[] {
  const realByDate = new Map<string, number>()
  for (const c of real) {
    const p = c.points.find((x) => x.label === label)
    if (p && Number.isFinite(p.yieldPct)) realByDate.set(c.date, p.yieldPct)
  }
  const out: YieldHistoryPoint[] = []
  const seen = new Set<string>()
  for (const c of [...nominal].sort((a, b) => a.date.localeCompare(b.date))) {
    if (c.date < from || seen.has(c.date)) continue
    const p = c.points.find((x) => x.label === label)
    if (!p || !Number.isFinite(p.yieldPct)) continue
    seen.add(c.date)
    const realPct = realByDate.get(c.date)
    out.push(realPct === undefined
      ? { date: c.date, yieldPct: p.yieldPct }
      : { date: c.date, yieldPct: p.yieldPct, realPct, breakevenPct: breakeven(p.yieldPct, realPct) })
  }
  if (interval === 'daily') return out
  const lastOfWeek = new Map<string, YieldHistoryPoint>()
  for (const p of out) lastOfWeek.set(weekOf(p.date), p)
  return [...lastOfWeek.values()]
}

export interface ExpectedInflationRow {
  label: string
  yieldPct: number
  realPct: number
  breakevenPct: number
}

/**
 * The newest day both curves were published, and each real maturity's ordinary
 * yield, real yield and expected inflation on it. Null when the two curves share
 * no day. The two are published separately and can be a day apart, so the
 * figures are always taken from the same date, never mixed.
 */
export function expectedInflationTable(
  nominal: readonly DatedCurve[],
  real: readonly DatedCurve[],
): { date: string; rows: ExpectedInflationRow[] } | null {
  const nominalByDate = new Map(nominal.map((c) => [c.date, c]))
  const shared = real.map((c) => c.date).filter((d) => nominalByDate.has(d)).sort()
  const date = shared[shared.length - 1]
  if (!date) return null
  const n = nominalByDate.get(date)!
  const r = real.find((c) => c.date === date)!
  const rows = REAL_MATURITIES.flatMap((label) => {
    const y = n.points.find((p) => p.label === label)?.yieldPct
    const rp = r.points.find((p) => p.label === label)?.yieldPct
    return y === undefined || rp === undefined || !Number.isFinite(y) || !Number.isFinite(rp)
      ? []
      : [{ label, yieldPct: y, realPct: rp, breakevenPct: breakeven(y, rp) }]
  })
  return rows.length > 0 ? { date, rows } : null
}

/**
 * The history as closing-only candles, for the shared chart and indicator
 * engine: one figure a day, so open, high, low and close are the same and there
 * is no volume. Only what reads closes alone may be drawn from them (the
 * Macro TA page and scanner hold to that).
 */
export function closingCandles(points: readonly YieldHistoryPoint[]): Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> {
  return points.map((p) => {
    const v = p.yieldPct
    return { time: Math.floor(Date.parse(`${p.date}T00:00:00Z`) / 1000), open: v, high: v, low: v, close: v, volume: 0 }
  })
}
