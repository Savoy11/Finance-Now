// ─── The gaps between short and long Treasury yields, over time (T-464) ──────
//
// The 10-year yield minus the 2-year ("2s10s") and minus the 3-month ("3m10y"), from the US
// Treasury's official daily par curve. When a gap is below zero, short yields are above long
// ones and the curve is said to be inverted. This works out each day's two gaps, the stretches
// when each was below zero, and where each stands now. Arithmetic on figures the Treasury
// publishes, never a forecast or a signal of our own. Pure; the fetching is
// lib/server/treasurySpreadHistory.ts, and today's curve uses `spreadsOfCurve` too, so one
// day's gap is worked out one way everywhere.

/** The two gaps on one curve, in percentage points. */
export interface CurveSpreads {
  /** 10Y minus 2Y. */
  spread2s10s?: number
  /** 10Y minus 3M. */
  spread3m10y?: number
}

export type SpreadKey = keyof CurveSpreads

export const SPREAD_KEYS: readonly SpreadKey[] = ['spread2s10s', 'spread3m10y']

export const SPREAD_NAMES: Record<SpreadKey, { short: string; long: string }> = {
  spread2s10s: { short: '2s10s', long: '10-year minus 2-year' },
  spread3m10y: { short: '3m10y', long: '10-year minus 3-month' },
}

export interface CurveLike {
  /** YYYY-MM-DD */
  date: string
  points: ReadonlyArray<{ label: string; yieldPct: number }>
}

const round2 = (v: number) => Math.round(v * 100) / 100
const at = (c: CurveLike, label: string) => {
  const v = c.points.find((p) => p.label === label)?.yieldPct
  return v != null && Number.isFinite(v) ? v : undefined
}

/** 10Y minus 2Y and 10Y minus 3M on one curve, rounded to hundredths. */
export function spreadsOfCurve(curve: CurveLike): CurveSpreads {
  const y2 = at(curve, '2Y'), y10 = at(curve, '10Y'), m3 = at(curve, '3M')
  return {
    spread2s10s: y2 != null && y10 != null ? round2(y10 - y2) : undefined,
    spread3m10y: m3 != null && y10 != null ? round2(y10 - m3) : undefined,
  }
}

export interface SpreadPoint extends CurveSpreads {
  /** YYYY-MM-DD */
  date: string
}

/** Each day's two gaps, oldest first, one per date, from `from` on; a day with neither is left out. */
export function dailySpreads(curves: readonly CurveLike[], from = ''): SpreadPoint[] {
  const seen = new Set<string>()
  const out: SpreadPoint[] = []
  for (const c of [...curves].sort((a, b) => a.date.localeCompare(b.date))) {
    if (c.date < from || seen.has(c.date)) continue
    seen.add(c.date)
    const s = spreadsOfCurve(c)
    if (s.spread2s10s == null && s.spread3m10y == null) continue
    out.push({ date: c.date, ...s })
  }
  return out
}

/**
 * Two readings further apart than this have a gap between them (a year's file that could not be
 * read), not a weekend or a holiday: a run below zero is not carried across it.
 */
export const MAX_READING_GAP_DAYS = 10

const DAY = 86_400_000
const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY

export interface InvertedStretch {
  /** The first reading below zero. */
  start: string
  /** The last reading below zero. */
  end: string
  /** False when the stretch reaches back to the first reading read (or to a gap), so it may have begun earlier. */
  startKnown: boolean
  /** False when the last reading below zero is followed by a gap in the readings, so it may have run on. */
  endKnown: boolean
  /** Still below zero at the latest reading. */
  ongoing: boolean
  /** How many daily readings were below zero. */
  readings: number
  /** The lowest reading, and its date. */
  deepest: number
  deepestOn: string
}

/**
 * Every stretch of consecutive daily readings below zero for one gap, oldest first. A day the
 * curve lacks the maturities for that gap is skipped and does not break a run; a gap of more
 * than `MAX_READING_GAP_DAYS` between readings does. Exactly zero is not below zero.
 */
export function invertedStretches(points: readonly SpreadPoint[], key: SpreadKey): InvertedStretch[] {
  const series = points.filter((p) => p[key] != null)
  const out: InvertedStretch[] = []
  let run: InvertedStretch | null = null
  series.forEach((p, i) => {
    const v = p[key] as number
    const afterGap = i > 0 && daysBetween(series[i - 1].date, p.date) > MAX_READING_GAP_DAYS
    if (run && afterGap) {
      run.endKnown = false
      out.push(run)
      run = null
    }
    if (v < 0) {
      if (!run) {
        run = { start: p.date, end: p.date, startKnown: i > 0 && !afterGap, endKnown: true, ongoing: false, readings: 0, deepest: v, deepestOn: p.date }
      }
      run.end = p.date
      run.readings += 1
      if (v < run.deepest) { run.deepest = v; run.deepestOn = p.date }
    } else if (run) {
      out.push(run)
      run = null
    }
  })
  if (run) {
    (run as InvertedStretch).ongoing = true
    out.push(run)
  }
  return out
}

export interface GapNow {
  date: string
  value: number
  /** Below zero at the latest reading. */
  inverted: boolean
  /** When inverted: the stretch it is in. Otherwise: the most recent stretch read, if any. */
  stretch?: InvertedStretch
}

/** Where one gap stands at the latest reading, with the stretch it is in or the last one before it. */
export function gapNow(points: readonly SpreadPoint[], key: SpreadKey): GapNow | null {
  const latest = [...points].reverse().find((p) => p[key] != null)
  if (!latest) return null
  const value = latest[key] as number
  const stretches = invertedStretches(points, key)
  const last = stretches[stretches.length - 1]
  return { date: latest.date, value, inverted: value < 0, ...(last ? { stretch: last } : {}) }
}

/**
 * Where to shade each stretch on a chart whose points may be weekly: the first and last chart
 * dates inside it. A stretch with no chart point inside it (shorter than a week, on a weekly
 * chart) is shaded at the next chart point, within the week, so it still shows.
 */
export function shadeRanges(chartDates: readonly string[], stretches: readonly InvertedStretch[]): { x1: string; x2: string }[] {
  const out: { x1: string; x2: string }[] = []
  for (const s of stretches) {
    const inside = chartDates.filter((d) => d >= s.start && d <= s.end)
    if (inside.length > 0) { out.push({ x1: inside[0], x2: inside[inside.length - 1] }); continue }
    const next = chartDates.find((d) => d > s.end)
    if (next && daysBetween(s.end, next) <= 7) out.push({ x1: next, x2: next })
  }
  return out
}
