// ─────────────────────────────────────────────────────────────────────────────
// US ECONOMIC RELEASE DATES — hand-maintained from the two agencies' published schedules
// (T-456 d, owner decision D211, 2026-11-07: CPI, the jobs report, GDP and PCE inflation).
//
// WHY IT EXISTS. The Market Calendar's other economic releases come from FMP's economic
// calendar, a paid endpoint (402 on a free key), so on the free key no release showed at all.
// These four are the releases the calendar tool's description names and that most move rates.
// Like the Fed's meetings (fomcCalendar.ts), they need no key and show on every plan.
//
// WHY A TABLE AND NOT A FETCH. Both agencies publish a year's schedule at once, as HTML pages,
// and change dates rarely. A dated table with a review clock fails loudly; a scraper would break
// quietly. Nothing here is fetched at runtime.
//
// TERMS (read 2026-11-07 from a cloud session; registry entries in lib/server/sourceTerms.ts):
//   BLS, "Linking and Copyright Information" (https://www.bls.gov/bls/linksite.htm): "everything
//   that we publish, both in hard copy and electronically, is in the public domain, except for
//   previously copyrighted photographs and illustrations. You are free to use our public domain
//   material without specific permission, although we do ask that you cite the Bureau of Labor
//   Statistics as the source."
//   BEA, "Linking Policy" (https://www.bea.gov/about/policies-and-information/linking): "unless
//   stated otherwise, the information posted on the BEA Web site is in the public domain and may
//   be used or reproduced without specific permission. A citation such as "Source: U.S. Bureau of
//   Economic Analysis" would be appreciated." Neither may be presented as endorsing anything.
// Every surface that shows a row names its agency.
//
// TIMES. Both schedules list every release at "8:30 AM" and write no time zone; rows keep the
// time as listed.
//
// TO REFRESH. Open each SOURCE page and compare EVERY row. Add the next year once the agency
// lists it (BLS and BEA each publish theirs in the autumn). Only then move
// RELEASE_DATES_LAST_VERIFIED, never for a partial check (CLAUDE.md, "Data Files Reference").
// ─────────────────────────────────────────────────────────────────────────────

export type ReleaseAgency = 'bls' | 'bea'
export type ReleaseKind = 'cpi' | 'jobs' | 'gdp' | 'pce'

export const RELEASE_AGENCIES: Record<ReleaseAgency, { name: string; citation: string; scheduleUrls: string[] }> = {
  bls: {
    name: 'U.S. Bureau of Labor Statistics',
    citation: 'Source: U.S. Bureau of Labor Statistics',
    scheduleUrls: [
      'https://www.bls.gov/schedule/news_release/cpi.htm',
      'https://www.bls.gov/schedule/news_release/empsit.htm',
    ],
  },
  bea: {
    name: 'U.S. Bureau of Economic Analysis',
    citation: 'Source: U.S. Bureau of Economic Analysis',
    scheduleUrls: [
      'https://www.bea.gov/news/schedule/full',
      'https://www.bea.gov/news/schedule/next-year',
    ],
  },
}

export const RELEASE_KINDS: Record<ReleaseKind, { name: string; agency: ReleaseAgency; what: string }> = {
  cpi: { name: 'CPI inflation', agency: 'bls', what: 'Consumer Price Index' },
  jobs: { name: 'Jobs report', agency: 'bls', what: 'The Employment Situation' },
  gdp: { name: 'GDP', agency: 'bea', what: 'Gross Domestic Product' },
  pce: { name: 'PCE inflation', agency: 'bea', what: 'Personal Income and Outlays' },
}

/**
 * The day every row below was copied from the agencies' pages: BLS's two schedule pages, and
 * BEA's full 2026 schedule and 2027 schedule ("Page last modified on 11/7/26").
 */
export const RELEASE_DATES_LAST_VERIFIED = '2026-11-07'

// Quarterly, like the Fed's table: the agencies publish a year at once, but a date can move.
export const RELEASE_DATES_STALE_AFTER_DAYS = 90

export interface EconomicRelease {
  /** Release day (ISO date). */
  date: string
  kind: ReleaseKind
  /** What it covers, as the schedule names it: "October 2026", "3rd Quarter 2026". */
  period: string
  /** GDP only: which estimate (advance, second, third). */
  estimate?: 'Advance' | 'Second' | 'Third'
  /** As listed; the schedules write no time zone. */
  time: '8:30 AM'
}

const r = (date: string, kind: ReleaseKind, period: string, estimate?: EconomicRelease['estimate']): EconomicRelease =>
  ({ date, kind, period, ...(estimate ? { estimate } : {}), time: '8:30 AM' })

/** In date order. Starts with the first release on or after 2026-11-01, when the table was built. */
export const ECONOMIC_RELEASES: readonly EconomicRelease[] = [
  r('2026-11-06', 'jobs', 'October 2026'),
  r('2026-11-10', 'cpi', 'October 2026'),
  r('2026-11-25', 'gdp', '3rd Quarter 2026', 'Second'),
  r('2026-11-25', 'pce', 'October 2026'),
  r('2026-12-04', 'jobs', 'November 2026'),
  r('2026-12-10', 'cpi', 'November 2026'),
  r('2026-12-23', 'gdp', '3rd Quarter 2026', 'Third'),
  r('2026-12-23', 'pce', 'November 2026'),
  // 2027
  r('2027-01-08', 'jobs', 'December 2026'),
  r('2027-01-13', 'cpi', 'December 2026'),
  r('2027-01-28', 'gdp', '4th Quarter and Year 2026', 'Advance'),
  r('2027-01-28', 'pce', 'December 2026'),
  r('2027-02-05', 'jobs', 'January 2027'),
  r('2027-02-11', 'cpi', 'January 2027'),
  r('2027-02-25', 'gdp', '4th Quarter and Year 2026', 'Second'),
  r('2027-02-25', 'pce', 'January 2027'),
  r('2027-03-05', 'jobs', 'February 2027'),
  r('2027-03-10', 'cpi', 'February 2027'),
  r('2027-03-31', 'gdp', '4th Quarter and Year 2026', 'Third'),
  r('2027-03-31', 'pce', 'February 2027'),
  r('2027-04-02', 'jobs', 'March 2027'),
  r('2027-04-13', 'cpi', 'March 2027'),
  r('2027-04-29', 'gdp', '1st Quarter 2027', 'Advance'),
  r('2027-04-29', 'pce', 'March 2027'),
  r('2027-05-07', 'jobs', 'April 2027'),
  r('2027-05-12', 'cpi', 'April 2027'),
  r('2027-05-27', 'gdp', '1st Quarter 2027', 'Second'),
  r('2027-05-27', 'pce', 'April 2027'),
  r('2027-06-04', 'jobs', 'May 2027'),
  r('2027-06-10', 'cpi', 'May 2027'),
  r('2027-06-25', 'gdp', '1st Quarter 2027', 'Third'),
  r('2027-06-25', 'pce', 'May 2027'),
  r('2027-07-02', 'jobs', 'June 2027'),
  r('2027-07-14', 'cpi', 'June 2027'),
  r('2027-07-29', 'gdp', '2nd Quarter 2027', 'Advance'),
  r('2027-07-29', 'pce', 'June 2027'),
  r('2027-08-06', 'jobs', 'July 2027'),
  r('2027-08-11', 'cpi', 'July 2027'),
  r('2027-08-25', 'gdp', '2nd Quarter 2027', 'Second'),
  r('2027-08-25', 'pce', 'July 2027'),
  r('2027-09-03', 'jobs', 'August 2027'),
  r('2027-09-14', 'cpi', 'August 2027'),
  r('2027-09-30', 'gdp', '2nd Quarter 2027', 'Third'),
  r('2027-09-30', 'pce', 'August 2027'),
  r('2027-10-08', 'jobs', 'September 2027'),
  r('2027-10-14', 'cpi', 'September 2027'),
  r('2027-10-28', 'gdp', '3rd Quarter 2027', 'Advance'),
  r('2027-10-28', 'pce', 'September 2027'),
  r('2027-11-05', 'jobs', 'October 2027'),
  r('2027-11-10', 'cpi', 'October 2027'),
  r('2027-11-24', 'gdp', '3rd Quarter 2027', 'Second'),
  r('2027-11-24', 'pce', 'October 2027'),
  r('2027-12-03', 'jobs', 'November 2027'),
  r('2027-12-10', 'cpi', 'November 2027'),
  r('2027-12-22', 'gdp', '3rd Quarter 2027', 'Third'),
  r('2027-12-22', 'pce', 'November 2027'),
]

/** A release's name as the pages show it: "CPI inflation for October 2026". */
export function releaseLabel(rel: EconomicRelease): string {
  const k = RELEASE_KINDS[rel.kind]
  return rel.kind === 'gdp'
    ? `GDP, ${rel.period} (${rel.estimate?.toLowerCase()} estimate)`
    : `${k.name} for ${rel.period}`
}

/** First and last dates the table covers. Outside them, "no release" means "not in the table". */
export function releaseScheduleSpan(): { from: string; through: string } {
  return { from: ECONOMIC_RELEASES[0].date, through: ECONOMIC_RELEASES[ECONOMIC_RELEASES.length - 1].date }
}

/** Releases whose day falls inside [from, to], inclusive. */
export function releasesBetween(from: string, to: string): EconomicRelease[] {
  const end = to.slice(0, 10)
  return ECONOMIC_RELEASES.filter((x) => x.date >= from.slice(0, 10) && x.date <= end)
}

/** The next release of each kind on or after `now`'s day, in date order; a kind past the table is left out. */
export function nextReleases(now: Date = new Date()): EconomicRelease[] {
  const today = now.toISOString().slice(0, 10)
  const out: EconomicRelease[] = []
  for (const kind of Object.keys(RELEASE_KINDS) as ReleaseKind[]) {
    const next = ECONOMIC_RELEASES.find((x) => x.kind === kind && x.date >= today)
    if (next) out.push(next)
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// ── Staleness machinery (same pattern as fomcCalendar.ts) ─────────────────────────────

export function releaseDatesAgeDays(now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(RELEASE_DATES_LAST_VERIFIED).getTime()) / 86_400_000)
}

export interface ReleaseDatesProvenance {
  source: string
  verifiedAt: string
  ageDays: number
  stale: boolean
  confidence: 'high' | 'medium' | 'low'
  through: string
}

export function getReleaseDatesProvenance(now: Date = new Date()): ReleaseDatesProvenance {
  const ageDays = releaseDatesAgeDays(now)
  return {
    source: 'U.S. Bureau of Labor Statistics and U.S. Bureau of Economic Analysis release schedules (copied by hand)',
    verifiedAt: RELEASE_DATES_LAST_VERIFIED,
    ageDays,
    stale: ageDays > RELEASE_DATES_STALE_AFTER_DAYS,
    confidence: ageDays <= 45 ? 'high' : ageDays <= RELEASE_DATES_STALE_AFTER_DAYS ? 'medium' : 'low',
    through: releaseScheduleSpan().through,
  }
}
