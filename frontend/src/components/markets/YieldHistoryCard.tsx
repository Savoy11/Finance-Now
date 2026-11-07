'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { LineChart } from '@/components/charts/LineChart'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { STALE_TIME_LONG } from '@/lib/constants'
import {
  YIELD_HISTORY_RANGES, YIELD_HISTORY_RANGE_LABELS, type YieldHistoryRange,
} from '@/lib/data/yieldHistory'
import type { YieldHistoryResponse } from '@/app/live-data/treasury-yield-history/route'

// A Treasury yield's history from the official daily par curve (T-446, D202).
// Where the Treasury publishes a real (inflation-protected) yield for the
// maturity, the chart also draws it and the market's expected inflation: the
// ordinary yield minus the real yield, the same day. Used on each yield's own
// page and on Bonds & Rates. Daily readings, said so, as the headline figure does.

export function useYieldHistory(maturity: string, range: YieldHistoryRange, enabled = true) {
  return useQuery<YieldHistoryResponse>({
    queryKey: ['treasury-yield-history', maturity, range],
    queryFn: () => fetch(`/live-data/treasury-yield-history?maturity=${encodeURIComponent(maturity)}&range=${range}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
    enabled,
  })
}

const pct = (v: unknown) => `${Number(v).toFixed(2)}%`

export function YieldHistoryCard({ maturities, defaultMaturity, title = 'Yield history' }: {
  /** The maturities a reader may pick; one entry means no picker. */
  maturities: readonly string[]
  defaultMaturity: string
  title?: string
}) {
  const [maturity, setMaturity] = useState(defaultMaturity)
  const [range, setRange] = useState<YieldHistoryRange>('1y')
  const { data, isLoading } = useYieldHistory(maturity, range)
  const points = data?.ok ? data.points ?? [] : []
  const hasReal = !!data?.hasReal && points.some((p) => p.realPct !== undefined)
  const long = range === '5y' || range === '10y'
  const xFormat = (v: unknown) => {
    const d = new Date(`${String(v)}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? '' : format(d, range === '1mo' || range === '3mo' ? 'MMM d' : long ? 'yyyy' : 'MMM yy')
  }

  return (
    <div className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-text-secondary">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {maturities.length > 1 && (
            <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5" role="group" aria-label="Maturity">
              {maturities.map((m) => (
                <button key={m} type="button" onClick={() => setMaturity(m)} aria-pressed={maturity === m}
                  className={clsx('px-2 py-1 rounded-sm text-[11px] font-mono font-medium transition-colors',
                    maturity === m ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5" role="group" aria-label="Range">
            {YIELD_HISTORY_RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                className={clsx('px-2 py-1 rounded-sm text-[11px] font-mono font-medium transition-colors',
                  range === r ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}>
                {YIELD_HISTORY_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : points.length > 0 ? (
        <>
          <LineChart
            data={points as unknown as Record<string, unknown>[]}
            xKey="date"
            series={[
              { key: 'yieldPct', label: `${maturity} yield`, color: '#3b82f6', strokeWidth: 2 },
              ...(hasReal ? [
                { key: 'realPct', label: `${maturity} real yield`, color: '#64748b', dashed: true },
                { key: 'breakevenPct', label: 'Expected inflation', color: '#f59e0b' },
              ] : []),
            ]}
            xFormatter={xFormat}
            yFormatter={(v) => `${Number(v).toFixed(1)}%`}
            tooltipFormatter={(v, name) => [pct(v), String(name)]}
            height={260}
            showLegend={hasReal}
            connectNulls
          />
          <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
            Official US Treasury par yields, published once a day{data?.interval === 'weekly' ? '; over this span each week’s last reading is drawn' : ''}.
            {hasReal && ' Expected inflation is the ordinary yield minus the inflation-protected (real) yield at the same maturity on the same day: what the bond market prices in, not a forecast of ours.'}
            {data?.missingYears && data.missingYears.length > 0 && ` The Treasury’s file for ${data.missingYears.join(', ')} could not be read, so the line has a gap there.`}
          </p>
        </>
      ) : (
        <p className="py-10 text-center text-xs text-text-muted">
          {data && !data.ok ? `The Treasury’s yield history could not be read (${data.error ?? 'no answer'}). It returns when the feed recovers.` : 'No readings in this range.'}
        </p>
      )}
    </div>
  )
}
