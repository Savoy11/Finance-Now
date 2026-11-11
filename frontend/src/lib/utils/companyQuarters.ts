// ─── A company's last eight quarters, from its SEC company-facts file (T-461) ──────────────
//
// /live-data/company-facts downloads the company's whole XBRL company-facts file from the SEC,
// which carries every quarterly report's figures; the route's annual reader keeps only full-year
// 10-K figures. This reads the quarters (owner decision D222):
//
//   - Revenue, net income and earnings per share for each three-month period a 10-Q reports.
//   - Companies file no separate fourth-quarter report. So the fourth quarter's revenue and net
//     income are worked out as the 10-K's full year less the first nine months (the third
//     quarter's 10-Q reports those as one figure), or less the first three quarters added up, and
//     each such figure is marked as worked out. Its earnings per share are not worked out that
//     way, since the number of shares changes during the year: they show only where filed.
//   - Each quarter's change from the same quarter a year earlier, as a percent of the earlier
//     figure, only where that figure is above zero (a percent change from a loss means nothing).
//
// A figure a later filing restates (a comparative in next year's report) takes the later filing's
// value. Concepts are tried in the order given, as the annual reader does: a company that changed
// its revenue tag keeps one series, and a fourth quarter is worked out only within one tag, so a
// full year is never set against nine months of another tag.
//
// Pure and tested (__tests__/companyQuarters.test.ts).

/** One fact as the SEC's company-facts file gives it. */
export interface XbrlFact {
  start?: string
  end: string
  val: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
  accn?: string
}

export type ConceptFacts = Record<string, { units?: Record<string, XbrlFact[]> }>

export interface QuarterFigure {
  value: number
  /** The fourth quarter's figure, worked out as the full year less the first nine months. */
  workedOut: boolean
  /** Which tag it came from (for earnings per share: diluted or basic). */
  concept: string
}

export interface Quarter {
  /** First day of the three months, YYYY-MM-DD. */
  start: string
  /** Last day, YYYY-MM-DD. */
  end: string
  revenue: QuarterFigure | null
  netIncome: QuarterFigure | null
  eps: QuarterFigure | null
  /** Percent change from the quarter a year earlier; null without a figure above zero to compare with. */
  revenueChangePct: number | null
  netIncomeChangePct: number | null
  epsChangePct: number | null
}

const DAY = 86_400_000
/** A fiscal quarter: 13 weeks, 14 in a 53-week year, or three calendar months. */
const QUARTER_DAYS = [80, 100] as const
const NINE_MONTH_DAYS = [260, 290] as const
const YEAR_DAYS = [350, 380] as const
/** Dates that should meet may be off by a day or two in a filing. */
const NEAR_DAYS = 5
/** "The same quarter a year earlier" ends 52 weeks or a calendar year before, give or take. */
const YEAR_AGO_DAYS = [355, 375] as const

export const QUARTERS_SHOWN = 8

export const REVENUE_CONCEPTS = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']
export const NET_INCOME_CONCEPTS = ['NetIncomeLoss']
export const EPS_CONCEPTS = ['EarningsPerShareDiluted', 'EarningsPerShareBasic']

const days = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / DAY + 1
const within = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi
const near = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= NEAR_DAYS * DAY
const dayAfter = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10)

/** The forms a US company files its own quarterly and annual figures on, amendments included. */
const isPeriodicForm = (form: string | undefined) => !!form && /^10-[KQ](\/A)?$/.test(form)

/** The facts for one concept in the first unit it has. */
function factsFor(taxonomy: ConceptFacts, concept: string, units: string[]): XbrlFact[] {
  const u = taxonomy[concept]?.units
  if (!u) return []
  for (const unit of units) if (Array.isArray(u[unit]) && u[unit].length > 0) return u[unit]
  return []
}

/** One value per period: the most recently filed (a restatement wins over the original). */
function latestPerPeriod(facts: XbrlFact[]): Map<string, XbrlFact> {
  const out = new Map<string, XbrlFact>()
  for (const f of facts) {
    if (!f.start || !isPeriodicForm(f.form) || !Number.isFinite(f.val)) continue
    const key = `${f.start}|${f.end}`
    const seen = out.get(key)
    const newer = !seen || (f.filed ?? '') > (seen.filed ?? '') || ((f.filed ?? '') === (seen.filed ?? '') && (f.fy ?? 0) > (seen.fy ?? 0))
    if (newer) out.set(key, f)
  }
  return out
}

/**
 * One concept's quarters, by end date: each three-month period reported, and each fourth quarter
 * worked out from a full year (when `deriveQ4`), as the full year less the nine months to the third
 * quarter's end, or less the three quarters added up.
 */
export function conceptQuarters(facts: XbrlFact[], deriveQ4: boolean): Map<string, { start: string; end: string; value: number; workedOut: boolean }> {
  const periods = [...latestPerPeriod(facts).values()]
  const out = new Map<string, { start: string; end: string; value: number; workedOut: boolean }>()
  const quarters = periods.filter((f) => within(days(f.start as string, f.end), QUARTER_DAYS))
  // Two three-month periods ending the same day (a changed fiscal calendar): the later filing's.
  const byEnd = new Map<string, XbrlFact>()
  for (const q of quarters) {
    const seen = byEnd.get(q.end)
    if (!seen || (q.filed ?? '') > (seen.filed ?? '')) byEnd.set(q.end, q)
  }
  for (const q of byEnd.values()) out.set(q.end, { start: q.start as string, end: q.end, value: q.val, workedOut: false })
  if (!deriveQ4) return out

  for (const year of periods.filter((f) => f.form?.startsWith('10-K') && within(days(f.start as string, f.end), YEAR_DAYS))) {
    const yStart = year.start as string
    // A fourth quarter the company reported itself stands.
    if ([...out.values()].some((q) => near(q.end, year.end) && Date.parse(q.start) >= Date.parse(yStart) - NEAR_DAYS * DAY)) continue
    // The nine months to the third quarter's end, from the same year's start.
    const nine = periods.find((f) => near(f.start as string, yStart) && within(days(f.start as string, f.end), NINE_MONTH_DAYS))
    let firstNine: { end: string; value: number } | null = nine ? { end: nine.end, value: nine.val } : null
    if (!firstNine) {
      const q1 = quarters.find((q) => near(q.start as string, yStart))
      const q2 = q1 && quarters.find((q) => near(q.start as string, dayAfter(q1.end)))
      const q3 = q2 && quarters.find((q) => near(q.start as string, dayAfter(q2.end)))
      if (q1 && q2 && q3) firstNine = { end: q3.end, value: q1.val + q2.val + q3.val }
    }
    if (!firstNine) continue
    const start = dayAfter(firstNine.end)
    if (!within(days(start, year.end), QUARTER_DAYS)) continue
    out.set(year.end, { start, end: year.end, value: year.val - firstNine.value, workedOut: true })
  }
  return out
}

/** Each concept's quarters, merged by end date: an earlier-listed concept wins a quarter. */
function series(taxonomy: ConceptFacts, concepts: string[], units: string[], deriveQ4: boolean): Map<string, QuarterFigure & { start: string }> {
  const out = new Map<string, QuarterFigure & { start: string }>()
  for (const concept of concepts) {
    for (const [end, q] of conceptQuarters(factsFor(taxonomy, concept, units), deriveQ4)) {
      if (![...out.keys()].some((e) => near(e, end))) out.set(end, { value: q.value, workedOut: q.workedOut, concept, start: q.start })
    }
  }
  return out
}

/** The percent change from `earlier`, or null when there is no figure above zero to compare with. */
export function changePct(now: number | null | undefined, earlier: number | null | undefined): number | null {
  if (now == null || earlier == null || !(earlier > 0)) return null
  return ((now - earlier) / earlier) * 100
}

/**
 * The last `count` quarters, newest first, each with its change from the same quarter a year
 * earlier. Empty for a company that files no 10-Q (a foreign issuer, which files once a year).
 */
export function lastQuarters(gaap: ConceptFacts, count = QUARTERS_SHOWN): Quarter[] {
  const revenue = series(gaap, REVENUE_CONCEPTS, ['USD'], true)
  const netIncome = series(gaap, NET_INCOME_CONCEPTS, ['USD'], true)
  const eps = series(gaap, EPS_CONCEPTS, ['USD/shares'], false)

  // Every quarter end any of the three reports, with its figures matched by date.
  const ends: { end: string; start: string }[] = []
  for (const s of [revenue, netIncome, eps]) {
    for (const [end, q] of s) if (!ends.some((e) => near(e.end, end))) ends.push({ end, start: q.start })
  }
  ends.sort((a, b) => b.end.localeCompare(a.end))
  const pick = (s: Map<string, QuarterFigure & { start: string }>, end: string): QuarterFigure | null => {
    for (const [e, q] of s) if (near(e, end)) return { value: q.value, workedOut: q.workedOut, concept: q.concept }
    return null
  }
  const yearAgo = (s: Map<string, QuarterFigure & { start: string }>, end: string) => {
    for (const [e, q] of s) if (within((Date.parse(end) - Date.parse(e)) / DAY, YEAR_AGO_DAYS)) return q
    return null
  }
  return ends.slice(0, count).map(({ start, end }) => {
    const rev = pick(revenue, end), ni = pick(netIncome, end), e = pick(eps, end)
    const eAgo = yearAgo(eps, end)
    return {
      start, end,
      revenue: rev, netIncome: ni, eps: e,
      revenueChangePct: changePct(rev?.value, yearAgo(revenue, end)?.value),
      netIncomeChangePct: changePct(ni?.value, yearAgo(netIncome, end)?.value),
      // Only like for like: diluted against diluted, basic against basic.
      epsChangePct: e && eAgo && eAgo.concept === e.concept ? changePct(e.value, eAgo.value) : null,
    }
  })
}
