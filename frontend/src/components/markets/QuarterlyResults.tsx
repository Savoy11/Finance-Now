'use client'

import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { CalendarRange } from 'lucide-react'
import { STALE_TIME_LONG } from '@/lib/constants'
import { formatCompact } from '@/lib/utils/format'
import { type Q4Withheld, type Quarter, type QuarterFigure } from '@/lib/utils/companyQuarters'
import type { CompanyFactsResponse } from '@/app/live-data/company-facts/route'

// A company's last eight quarters (T-461, owner decision D222): revenue, net income and earnings
// per share from its 10-Q reports, each with the change from the same quarter a year earlier.
// Shares the ['company-facts', symbol] query with FinancialRatios and FundamentalsTrend, so the
// page still downloads the SEC file once. The rules are in lib/utils/companyQuarters.ts.

const dollars = (v: number) => (v < 0 ? `-${formatCompact(-v)}` : formatCompact(v))
const perShare = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`
const quarterEnd = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const t = Math.abs(pct).toFixed(1)
  const zero = t === '0.0'
  return (
    <span className={clsx('block text-[10px]', zero ? 'text-text-muted' : pct < 0 ? 'text-red-400' : 'text-emerald-400')}>
      {zero ? '0.0%' : `${pct < 0 ? '-' : '+'}${t}%`}
    </span>
  )
}

/** Why a fourth quarter's figure is a dash (code audit 2026-11-12, D226). */
const WITHHELD_TITLE: Record<Q4Withheld, string> = {
  restated: 'Not worked out: the annual report changed earlier figures, so the full year and the first nine months are on different bases.',
  'not-positive': 'Not worked out: the full year less the first nine months came to zero or below.',
}

function Cell({ fig, pct, fmt, withheld }: { fig: QuarterFigure | null; pct: number | null; fmt: (v: number) => string; withheld?: Q4Withheld }) {
  return (
    <td className="text-right font-mono tabular-nums py-1.5 pl-2 align-top">
      {fig ? (
        <>
          <span className={fig.value < 0 ? 'text-red-400' : 'text-text-primary'}>
            {fmt(fig.value)}{fig.workedOut && <sup className="text-text-muted" aria-label="worked out">*</sup>}
          </span>
          <Change pct={pct} />
        </>
      ) : withheld ? (
        <span className="text-text-muted" title={WITHHELD_TITLE[withheld]}>—<sup aria-label="not worked out">†</sup></span>
      ) : (
        <span className="text-text-muted">—</span>
      )}
    </td>
  )
}

export function QuarterlyResults({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useQuery<CompanyFactsResponse>({
    queryKey: ['company-facts', symbol],
    queryFn: async () => {
      const r = await fetch(`/live-data/company-facts?symbol=${encodeURIComponent(symbol)}`)
      const j: CompanyFactsResponse = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      return j
    },
    staleTime: STALE_TIME_LONG * 6,
  })
  if (isLoading) return null

  const quarters: Quarter[] = data?.quarters ?? []
  const anyWorkedOut = quarters.some((q) => q.revenue?.workedOut || q.netIncome?.workedOut)
  const reasons = new Set(quarters.flatMap((q) => [q.revenueWithheld, q.netIncomeWithheld]).filter((r): r is Q4Withheld => !!r))
  const basic = quarters.some((q) => q.eps?.concept === 'EarningsPerShareBasic')

  return (
    <section aria-labelledby="quarterly-results-heading" className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="quarterly-results-heading" className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <CalendarRange size={14} className="text-text-muted" aria-hidden />
          {quarters.length > 1 ? `Last ${quarters.length} Quarters` : 'Quarterly Results'}
        </h2>
        <span className="text-[11px] text-text-muted">quarterly · SEC EDGAR</span>
      </div>
      {error ? (
        <p className="text-xs text-text-muted leading-relaxed">
          Unavailable: {error instanceof Error ? error.message : 'SEC EDGAR could not be reached'}.
        </p>
      ) : quarters.length === 0 ? (
        <p className="text-xs text-text-muted leading-relaxed">
          No quarterly filings: {symbol} has no quarterly reports (Form 10-Q) on file with the SEC. A company based outside
          the US usually reports once a year instead.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">
                Revenue, net income and earnings per share for each of the last {quarters.length} quarters, with the change from the same quarter a year earlier
              </caption>
              <thead>
                <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border">
                  <th scope="col" className="text-left font-medium py-1.5 pr-2">Quarter ended</th>
                  <th scope="col" className="text-right font-medium py-1.5 pl-2">Revenue</th>
                  <th scope="col" className="text-right font-medium py-1.5 pl-2 whitespace-nowrap">Net income</th>
                  <th scope="col" className="text-right font-medium py-1.5 pl-2">EPS</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map((q) => (
                  <tr key={q.end} className="border-b border-border/50 last:border-0">
                    <th scope="row" className="text-left font-normal py-1.5 pr-2 text-text-muted whitespace-nowrap align-top">{quarterEnd(q.end)}</th>
                    <Cell fig={q.revenue} pct={q.revenueChangePct} fmt={dollars} withheld={q.revenueWithheld} />
                    <Cell fig={q.netIncome} pct={q.netIncomeChangePct} fmt={dollars} withheld={q.netIncomeWithheld} />
                    <Cell fig={q.eps} pct={q.epsChangePct} fmt={perShare} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 space-y-1 text-[11px] text-text-muted leading-relaxed">
            <p>
              From the company&rsquo;s quarterly and annual reports. The small figure under each is the change from the same
              quarter a year earlier, left out where that figure was a loss or zero.
            </p>
            {anyWorkedOut && (
              <p>
                * Companies file no separate fourth-quarter report, so its revenue and net income are worked out as the full
                year less the first nine months. Its earnings per share are shown only where the company filed them.
              </p>
            )}
            {reasons.size > 0 && (
              <p data-testid="q4-withheld">
                † Not worked out for that fourth quarter:{' '}
                {[
                  reasons.has('restated') && 'the annual report changed earlier figures (after selling or spinning off a business, for example), so the full year and the first nine months are on different bases',
                  reasons.has('not-positive') && 'the full year less the first nine months came to zero or below',
                ].filter(Boolean).join('; ')}.
              </p>
            )}
            <p>Earnings per share are diluted{basic ? ', or basic where the company gave no diluted figure' : ''}.</p>
          </div>
        </>
      )}
    </section>
  )
}
