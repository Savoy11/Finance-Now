// ─── A fund's own returns and money flows, from its N-PORT filings (T-459) ──
//
// Every registered fund reports to the SEC, in each NPORT-P filing, its total return for each of
// the three months the filing covers, per share class (Item B.5.a), and the money that came in and
// went out of the whole fund in each of those months (Item B.6). The public filings are quarterly
// and appear about 60 days after the quarter ends. This turns the filings into what the fund page
// shows (owner decision D222, and D223 for the money flows):
//
//   - The reader's share class's return for each month of the newest filing.
//   - A 12-month return, but only where the filings read cover all twelve months to the newest
//     one: each month's return compounded on the last. A month missing means no 12-month figure,
//     never a guessed one.
//   - For each month of the newest filing, shares sold, payouts reinvested and shares redeemed,
//     the net, and the quarter's net against the fund's net assets.
//
// Returns are matched to calendar months, not to quarters: month 3 of a filing is the month its
// report date falls in, month 1 two months before. So a filing that is late, amended or (once the
// SEC's monthly filing takes effect) covers a single month slots in by its months. Where two
// filings report one month, the later-filed one wins, since an amendment restates the original.
//
// Facts from the fund's own filing only: no rating, no ranking, no comparison (D92). Pure and
// tested (__tests__/fundReturns.test.ts).

import type { NportClassReturns, NportFlowMonth } from '@/lib/server/nport'
import { formatCompact } from './format'

/** One NPORT-P filing's return and flow figures, as the route reads them. */
export interface FilingFigures {
  /** The report date (repPdDate), YYYY-MM-DD: the last day of the third month. */
  asOf: string
  /** When the fund filed it, YYYY-MM-DD. */
  filedAt: string
  accession: string
  /** Net assets at the report date, US dollars. */
  netAssets: number | null
  returns: NportClassReturns[]
  flows: (NportFlowMonth | null)[]
}

/** A calendar month, "YYYY-MM". */
export type Month = string

export interface MonthReturn {
  month: Month
  /** Percent; null where the filing gives none for this class. */
  returnPct: number | null
}

export interface MonthFlow {
  month: Month
  /** New shares sold, US dollars. */
  sales: number | null
  /** Shares issued for reinvested distributions. */
  reinvestment: number | null
  /** Shares redeemed. */
  redemption: number | null
  /** sales + reinvestment − redemption; null when any of the three is missing. */
  net: number | null
}

export interface FundReturnsView {
  /** The newest filing read: the months below are its months. */
  asOf: string
  filedAt: string
  accession: string
  /** Whether the newest filing has a row for this share class. */
  classFound: boolean
  /** The newest filing's three months, oldest first. Empty when the class was not found. */
  months: MonthReturn[]
  /** The 12 months to the newest month, compounded; null with `twelveMonthsMissing` saying why. */
  twelveMonths: { from: Month; to: Month; returnPct: number } | null
  twelveMonthsMissing: string | null
  /** The newest filing's money in and out, oldest month first; null when it carries none. */
  flows: {
    months: MonthFlow[]
    /** The months' net together; null when any month's is missing. */
    net: number | null
    netAssets: number | null
    /** net as a percent of net assets at the report date; null without both. */
    netPctOfAssets: number | null
  } | null
}

const MONTH_RE = /^(\d{4})-(\d{2})/

/** The month a date falls in, "YYYY-MM", or null. */
export function monthOf(date: string): Month | null {
  const m = MONTH_RE.exec(date)
  if (!m) return null
  const mm = Number(m[2])
  return mm >= 1 && mm <= 12 ? `${m[1]}-${m[2]}` : null
}

/** `month` moved by `delta` months. */
export function addMonths(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number)
  const i = y * 12 + (m - 1) + delta
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/** The three months a filing covers, oldest first: month 1, 2 and 3 of Items B.5 and B.6. */
export function filingMonths(asOf: string): [Month, Month, Month] | null {
  const last = monthOf(asOf)
  return last ? [addMonths(last, -2), addMonths(last, -1), last] : null
}

/**
 * The row for this share class. A fund with one row and no class id, or one row and no class
 * asked for, is that row; otherwise only an exact class id. Never another class's figures.
 */
export function pickClass(rows: readonly NportClassReturns[], classId: string | null): NportClassReturns | null {
  const wanted = classId?.trim().toUpperCase() || null
  if (wanted) {
    const hit = rows.find((r) => r.classId?.toUpperCase() === wanted)
    if (hit) return hit
  }
  if (rows.length === 1 && (rows[0].classId === null || wanted === null)) return rows[0]
  return null
}

/** A monthly return the filing could not mean: a fund cannot lose more than everything. */
const usable = (pct: number | null): number | null => (pct != null && Number.isFinite(pct) && pct >= -100 ? pct : null)

/** The newest filing per report date (the later-filed one restates the earlier), newest report first. */
export function latestPerPeriod(filings: readonly FilingFigures[]): FilingFigures[] {
  const byAsOf = new Map<string, FilingFigures>()
  for (const f of filings) {
    if (!monthOf(f.asOf)) continue
    const seen = byAsOf.get(f.asOf)
    if (!seen || f.filedAt > seen.filedAt) byAsOf.set(f.asOf, f)
  }
  return [...byAsOf.values()].sort((a, b) => b.asOf.localeCompare(a.asOf))
}

/** Every month's return for this class across the filings; where two filings give one month, the newer report wins. */
export function returnsByMonth(filings: readonly FilingFigures[], classId: string | null): Map<Month, number> {
  const out = new Map<Month, number>()
  for (const f of latestPerPeriod(filings)) {
    const months = filingMonths(f.asOf)
    const row = pickClass(f.returns, classId)
    if (!months || !row) continue
    months.forEach((m, i) => {
      const pct = usable(row.months[i])
      if (pct !== null && !out.has(m)) out.set(m, pct)
    })
  }
  return out
}

/** The return over consecutive months, each compounded on the last: (1+r₁)(1+r₂)…−1, in percent. */
export function compound(pcts: readonly number[]): number {
  return (pcts.reduce((acc, p) => acc * (1 + p / 100), 1) - 1) * 100
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "August 2026". */
export function monthLabel(month: Month): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** "June 30, 2026", the date as filed whatever the reader's time zone. */
export function dayLabel(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** A return as "+1.45%" or "-4.98%", two decimals; "0.00%" unsigned. */
export function pctText(pct: number): string {
  const t = Math.abs(pct).toFixed(2)
  return t === '0.00' ? '0.00%' : `${pct < 0 ? '-' : '+'}${t}%`
}

/** Dollars, compact, with the sign in front: "+$1.20B", "-$350.0M", "$0". */
export function signedDollars(usd: number): string {
  if (Math.abs(usd) < 0.5) return '$0'
  return `${usd < 0 ? '-' : '+'}${formatCompact(Math.abs(usd))}`
}

/**
 * What the page shows from a fund's filings. Null when no filing has a report date. The figures
 * are the newest filing's; the 12-month return also reads the older ones.
 */
export function buildFundReturns(filings: readonly FilingFigures[], classId: string | null): FundReturnsView | null {
  const periods = latestPerPeriod(filings)
  const newest = periods[0]
  if (!newest) return null
  const months = filingMonths(newest.asOf) as [Month, Month, Month]
  const row = pickClass(newest.returns, classId)

  let twelveMonths: FundReturnsView['twelveMonths'] = null
  let twelveMonthsMissing: string | null = null
  if (!row) {
    twelveMonthsMissing = 'The newest filing has no return for this share class.'
  } else {
    const byMonth = returnsByMonth(periods, classId)
    const to = months[2]
    const wanted = Array.from({ length: 12 }, (_, i) => addMonths(to, i - 11))
    const have = wanted.filter((m) => byMonth.has(m))
    if (have.length === 12) {
      twelveMonths = { from: wanted[0], to, returnPct: compound(wanted.map((m) => byMonth.get(m) as number)) }
    } else {
      twelveMonthsMissing = `The filings read give ${have.length} of the 12 months to ${monthLabel(to)}, so there is no 12-month figure.`
    }
  }

  const flowMonths: MonthFlow[] = []
  newest.flows.slice(0, 3).forEach((f, i) => {
    if (!f) return
    const net = f.sales != null && f.reinvestment != null && f.redemption != null ? f.sales + f.reinvestment - f.redemption : null
    flowMonths.push({ month: months[i], sales: f.sales, reinvestment: f.reinvestment, redemption: f.redemption, net })
  })
  const net = flowMonths.length === 3 && flowMonths.every((m) => m.net !== null)
    ? flowMonths.reduce((s, m) => s + (m.net as number), 0)
    : null
  const netAssets = newest.netAssets != null && newest.netAssets > 0 ? newest.netAssets : null

  return {
    asOf: newest.asOf,
    filedAt: newest.filedAt,
    accession: newest.accession,
    classFound: !!row,
    months: row ? months.map((m, i) => ({ month: m, returnPct: usable(row.months[i]) })) : [],
    twelveMonths,
    twelveMonthsMissing,
    flows: flowMonths.length
      ? { months: flowMonths, net, netAssets, netPctOfAssets: net !== null && netAssets !== null ? (net / netAssets) * 100 : null }
      : null,
  }
}
