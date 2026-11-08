'use client'

import { useQuery } from '@tanstack/react-query'
import { Globe2 } from 'lucide-react'
import { ExposureBars } from '@/components/markets/ExposureBars'
import { coverageNote, topSlices } from '@/lib/utils/fundExposure'
import { STALE_TIME_LONG } from '@/lib/constants'
import type { FundHoldingsResponse } from '@/app/live-data/fund-holdings/route'

// Where a fund invests (T-455, D212): countries and currencies, and for a bond fund the kind of
// borrower and when its bonds are repaid, from the fund's own N-PORT filing. The query matches
// FundHoldingsSection's default request, so the three cards on the page share one fetch.

const COUNTRIES_SHOWN = 8
const CURRENCIES_SHOWN = 6

export function FundExposureCard({ symbol }: { symbol: string }) {
  const { data } = useQuery<FundHoldingsResponse>({
    queryKey: ['fund-holdings', symbol, 'auto'],
    queryFn: () => fetch(`/live-data/fund-holdings?${new URLSearchParams({ symbol })}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
  })
  if (!data?.ok) return null
  const e = data.exposure

  if (!e) {
    return (
      <section aria-labelledby="fund-exposure-heading" className="rounded-card border border-border bg-bg-card p-4">
        <Heading />
        <p className="text-xs text-text-muted leading-relaxed">
          Countries and currencies come from the fund&rsquo;s own quarterly holdings filing with the SEC (Form N-PORT),
          and none is available for {symbol} here{data.source === 'fmp' ? '; the holdings shown come from FMP, which gives no countries' : ''}.
          Some funds file none: SPY, for one, is a unit investment trust, which does not file this form.
        </p>
      </section>
    )
  }

  const countries = topSlices(e.countries, COUNTRIES_SHOWN)
  const currencies = topSlices(e.currencies, CURRENCIES_SHOWN)
  return (
    <section aria-labelledby="fund-exposure-heading" className="rounded-card border border-border bg-bg-card p-4 space-y-4">
      <div>
        <Heading />
        <p className="-mt-1 text-[11px] text-text-muted">
          From the fund&rsquo;s SEC N-PORT filing{e.asOf ? `, as of ${e.asOf}` : ''}. Each figure is a share of the fund&rsquo;s money.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ExposureBars title="By country" slices={countries.shown} rest={countries.rest} restNoun="countries"
          note={coverageNote(e.countries, 'country')} />
        <ExposureBars title="By currency" slices={currencies.shown} rest={currencies.rest} restNoun="currencies"
          note={coverageNote(e.currencies, 'currency', 'holdings', false)} />
        {e.bonds && (
          <>
            <ExposureBars title="Bonds: who borrowed" slices={e.bonds.borrowers.slices}
              note={<>Bonds are {e.bonds.bondsPct.toFixed(1)}% of the fund. {coverageNote(e.bonds.borrowers, 'kind of borrower', 'bonds')}</>} />
            <ExposureBars title="Bonds: when they are repaid" slices={e.bonds.maturities.slices}
              note={<>Counted from the filing&rsquo;s date{e.asOf ? `, ${e.asOf}` : ''}. {coverageNote(e.bonds.maturities, 'repayment date', 'bonds')}</>} />
          </>
        )}
      </div>
      <p className="pt-3 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">
        A holding&rsquo;s country is where the company or government that issued it is based, as the fund reports it: not
        where a company sells. The currency is the one the holding is bought in, which can differ from the country (a
        Taiwanese company&rsquo;s shares bought in US dollars, say).
        {e.bonds && ' The filing gives no credit ratings, so there is no split by bond quality.'}
      </p>
    </section>
  )
}

function Heading() {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Globe2 size={14} className="text-text-muted" aria-hidden />
      <h2 id="fund-exposure-heading" className="text-sm font-medium text-text-secondary">Where It Invests</h2>
    </div>
  )
}
