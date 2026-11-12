'use client'

import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { CalendarRange } from 'lucide-react'
import { STALE_TIME_LONG } from '@/lib/constants'
import { formatCompact } from '@/lib/utils/format'
import { dayLabel, monthLabel, monthOf, pctText, signedDollars, type FundReturnsView } from '@/lib/utils/fundReturns'
import type { FundReturnsResponse } from '@/app/live-data/fund-returns/route'

// A fund's own returns and the money moving in and out of it (T-459; owner decisions D222, D223),
// from its NPORT-P filings with the SEC. Facts as the fund filed them: no rating, no ranking and
// no comparison with other funds (D92). The rules, the 12-month figure among them, are in
// lib/utils/fundReturns.ts.

const tone = (pct: number) => (pct.toFixed(2) === '0.00' || pct.toFixed(2) === '-0.00' ? 'text-text-primary' : pct < 0 ? 'text-red-400' : 'text-emerald-400')

const money = (usd: number | null) => (usd === null ? '—' : formatCompact(usd))

function Returns({ r, symbol, failed }: { r: FundReturnsView; symbol: string; failed: number }) {
  if (!r.classFound) {
    return (
      <p className="text-xs text-text-muted leading-relaxed">
        The newest filing gives no return for {symbol}&rsquo;s share class, so none is shown; another class&rsquo;s
        figures are never shown in its place.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <dl className="space-y-1.5">
        {r.months.map((m) => (
          <div key={m.month} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-text-muted">{monthLabel(m.month)}</dt>
            <dd className={clsx('font-mono tabular-nums', m.returnPct === null ? 'text-text-muted' : tone(m.returnPct))}>
              {m.returnPct === null ? 'Not given' : pctText(m.returnPct)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="pt-3 border-t border-border/60">
        {r.twelveMonths ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-text-primary">12 months to {monthLabel(r.twelveMonths.to)}</span>
            <span className={clsx('font-mono tabular-nums text-base font-semibold', tone(r.twelveMonths.returnPct))}>
              {pctText(r.twelveMonths.returnPct)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-text-muted leading-relaxed">
            {r.twelveMonthsMissing}
            {failed > 0 ? ` ${failed === 1 ? 'One filing' : `${failed} filings`} could not be read just now.` : ''}
          </p>
        )}
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        Total returns for this share class as the fund reported them: each month&rsquo;s figure counts its payouts
        (dividends and other distributions), not just the change in price.
        {r.twelveMonths ? ' The 12-month figure compounds the twelve monthly returns from the fund’s filings.' : ''}
      </p>
    </div>
  )
}

function Flows({ f, isEtf }: { f: NonNullable<FundReturnsView['flows']>; isEtf: boolean }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Money in and out of the whole fund, by month, in US dollars</caption>
          <thead>
            <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border">
              <th scope="col" className="text-left font-medium py-1.5 pr-2">Month</th>
              <th scope="col" className="text-right font-medium py-1.5 px-2">Net</th>
              <th scope="col" className="text-right font-medium py-1.5 px-2 whitespace-nowrap">New shares</th>
              <th scope="col" className="text-right font-medium py-1.5 px-2">Reinvested</th>
              <th scope="col" className="text-right font-medium py-1.5 pl-2">Redeemed</th>
            </tr>
          </thead>
          <tbody>
            {f.months.map((m) => (
              <tr key={m.month} className="border-b border-border/50 last:border-0">
                <th scope="row" className="text-left font-normal py-1.5 pr-2 text-text-muted whitespace-nowrap">{monthLabel(m.month)}</th>
                <td className={clsx('text-right font-mono tabular-nums py-1.5 px-2', m.net === null ? 'text-text-muted' : m.net < 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {m.net === null ? '—' : signedDollars(m.net)}
                </td>
                <td className="text-right font-mono tabular-nums py-1.5 px-2 text-text-secondary">{money(m.sales)}</td>
                <td className="text-right font-mono tabular-nums py-1.5 px-2 text-text-secondary">{money(m.reinvestment)}</td>
                <td className="text-right font-mono tabular-nums py-1.5 pl-2 text-text-secondary">{money(m.redemption)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {f.net !== null && (
        <p className="text-sm text-text-primary">
          Net over the three months: <span className={clsx('font-mono tabular-nums', f.net < 0 ? 'text-red-400' : 'text-emerald-400')}>{signedDollars(f.net)}</span>
          {f.netPctOfAssets !== null && f.netAssets !== null && (
            <span className="text-text-muted">, {pctText(f.netPctOfAssets)} of the fund&rsquo;s {formatCompact(f.netAssets)} in net assets</span>
          )}
        </p>
      )}
      <p className="text-[11px] text-text-muted leading-relaxed">
        For the whole fund, every share class together, as filed. New shares are shares the fund sold; reinvested
        are new shares issued for payouts holders chose to reinvest; redeemed are shares the fund bought back. Net is new
        shares plus reinvested, less redeemed.
        {isEtf ? ' For an ETF, new shares are created for, and redeemed from, large dealers; individual investors buy and sell on the exchange.' : ''}
      </p>
    </div>
  )
}

export function FundReturnsCard({ symbol, isEtf }: { symbol: string; isEtf: boolean }) {
  const { data, isError } = useQuery<FundReturnsResponse>({
    queryKey: ['fund-returns', symbol],
    queryFn: () => fetch(`/live-data/fund-returns?${new URLSearchParams({ symbol })}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
  })
  if (!data && !isError) return null

  const heading = (
    <div className="flex items-center gap-2 mb-1">
      <CalendarRange size={14} className="text-accent-blue" aria-hidden />
      <h2 id="fund-returns-heading" className="text-sm font-medium text-text-secondary">Returns and Money In and Out</h2>
    </div>
  )
  const r = data?.returns ?? null

  if (!data?.ok || !data.filer || !r) {
    return (
      <section aria-labelledby="fund-returns-heading" className="rounded-card border border-border bg-bg-card p-4">
        {heading}
        <p className="text-xs text-text-muted leading-relaxed">
          {data?.ok && !data.filer
            ? `These come from the fund’s own quarterly filing with the SEC (Form N-PORT), and ${symbol} files none: unit investment trusts such as SPY and commodity trusts such as GLD do not.`
            : `The fund’s SEC filings could not be read just now${data?.error ? ` (${data.error})` : ''}, so no returns are shown.`}
        </p>
      </section>
    )
  }

  const last = monthOf(r.asOf)
  return (
    <section aria-labelledby="fund-returns-heading" className="rounded-card border border-border bg-bg-card p-4 space-y-4">
      <div>
        {heading}
        <p className="text-[11px] text-text-muted leading-relaxed">
          From the fund&rsquo;s own N-PORT filing with the SEC for the three months to {dayLabel(r.asOf)}, filed {dayLabel(r.filedAt)}.
          Funds file these about 60 days after each quarter ends{last ? `, so these figures run to ${monthLabel(last)}` : ''}.
        </p>
        {data.newestUnread && (
          <p className="mt-1 text-[11px] text-amber-400/90 leading-relaxed" data-testid="newest-unread">
            The fund&rsquo;s newest filing, filed {dayLabel(data.newestUnread.filedAt)}, could not be read just now, so
            these may not be its latest figures.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-medium text-text-primary mb-2">Returns, {symbol}&rsquo;s share class</h3>
          <Returns r={r} symbol={symbol} failed={data.filingsFailed} />
        </div>
        <div>
          <h3 className="text-xs font-medium text-text-primary mb-2">Money in and out, whole fund</h3>
          {r.flows
            ? <Flows f={r.flows} isEtf={isEtf} />
            : <p className="text-xs text-text-muted leading-relaxed">The newest filing gives no figures for money in and out.</p>}
        </div>
      </div>
    </section>
  )
}
