'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { LineChart } from '@/components/charts/LineChart'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { STALE_TIME_LONG } from '@/lib/constants'
import { HISTORY_RANGES, HISTORY_RANGE_LABELS, type HistoryRange } from '@/lib/data/dailyHistory'
import { formatFxRate, type CurrencyEntry } from '@/lib/data/currencyCatalog'
import { ECB_FREE_OF_CHARGE, ECB_RATE_DESCRIPTION, ECB_RATES_PAGE, pairRateBasis } from '@/lib/data/fxReference'
import type { FxPairHistoryResponse } from '@/app/live-data/fx-pair-history/route'
import type { FxReferencePairsResponse } from '@/app/live-data/fx-reference-pairs/route'

// A currency pair's history at the European Central Bank's daily reference
// rates (T-445, D203), and the hook every Macro page reads the newest rates
// through. Used on each pair's own page and by the Macro TA page. One figure a
// working day, said so, and worked out from the euro rates where the pair has
// no euro leg, said so too: the ECB's terms ask that a change to its figures be
// stated.

/** Every catalog pair's newest ECB rate. One shared query key, so the pages share one cached answer. */
export function useFxReferencePairs(enabled = true) {
  return useQuery<FxReferencePairsResponse>({
    queryKey: ['fx-reference-pairs'],
    queryFn: () => fetch('/live-data/fx-reference-pairs').then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
    enabled,
  })
}

export function useFxPairHistory(slug: string, range: HistoryRange, enabled = true) {
  return useQuery<FxPairHistoryResponse>({
    queryKey: ['fx-pair-history', slug, range],
    queryFn: () => fetch(`/live-data/fx-pair-history?pair=${encodeURIComponent(slug)}&range=${range}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
    enabled,
  })
}

/**
 * The ECB's free-of-charge sentence, linked to the Bank's page. Its terms ask that
 * anyone selling something carrying its figures say so each time they are seen,
 * and the Macro module is a paid one at launch.
 */
export function EcbFreeOfCharge() {
  const [before, after] = ECB_FREE_OF_CHARGE.split('on its website')
  return (
    <>
      {before}<a href={ECB_RATES_PAGE} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">on its website</a>{after}
    </>
  )
}

export function FxHistoryCard({ pair, title = 'Rate history' }: { pair: CurrencyEntry; title?: string }) {
  const [range, setRange] = useState<HistoryRange>('1y')
  const { data, isLoading } = useFxPairHistory(pair.slug, range)
  const points = data?.ok ? data.points ?? [] : []
  const long = range === '5y' || range === '10y'
  const xFormat = (v: unknown) => {
    const d = new Date(`${String(v)}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? '' : format(d, range === '1mo' || range === '3mo' ? 'MMM d' : long ? 'yyyy' : 'MMM yy')
  }

  return (
    <div className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-text-secondary">{title}</h2>
        <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5" role="group" aria-label="Range">
          {HISTORY_RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
              className={clsx('px-2 py-1 rounded-sm text-[11px] font-mono font-medium transition-colors',
                range === r ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}>
              {HISTORY_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : points.length > 0 ? (
        <>
          <LineChart
            data={points as unknown as Record<string, unknown>[]}
            xKey="date"
            series={[{ key: 'rate', label: pair.name, color: '#22c55e', strokeWidth: 2 }]}
            xFormatter={xFormat}
            yFormatter={(v) => formatFxRate(pair, Number(v))}
            tooltipFormatter={(v, name) => [formatFxRate(pair, Number(v)), String(name)]}
            height={260}
            showLegend={false}
            connectNulls
            yDomain={['auto', 'auto']}
          />
          <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
            {ECB_RATE_DESCRIPTION} {pairRateBasis(pair)}
            {data?.interval === 'weekly' ? ' Over this span each week’s last rate is drawn.' : ''} <EcbFreeOfCharge />
          </p>
        </>
      ) : (
        <p className="py-10 text-center text-xs text-text-muted">
          {data && !data.ok ? `The ECB’s reference rates could not be read (${data.error ?? 'no answer'}). They return when the feed recovers.` : 'No rates in this range.'}
        </p>
      )}
    </div>
  )
}
