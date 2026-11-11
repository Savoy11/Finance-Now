'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { LineChart } from '@/components/charts/LineChart'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { STALE_TIME_LONG } from '@/lib/constants'
import {
  SPREAD_KEYS, SPREAD_NAMES, shadeRanges,
  type InvertedStretch, type SpreadKey,
} from '@/lib/data/curveSpreads'
import { HISTORY_RANGES, HISTORY_RANGE_LABELS, type HistoryRange } from '@/lib/data/dailyHistory'
import type { SpreadHistoryResponse } from '@/app/live-data/treasury-spread-history/route'

// The gaps between short and long Treasury yields over time (T-464), on Bonds & Rates beside
// today's figures: whether the curve has just turned below zero or has been there for two years
// is what today's number needs. Each stretch below zero is shaded and dated from the daily
// readings. Facts only: no odds, no signal, no forecast.

/** "Nov 6, 2026" for "2026-11-06", read as a calendar day whatever the reader's time zone. */
function day(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`
const tradingDays = (n: number) => `${n.toLocaleString('en-US')} trading day${n === 1 ? '' : 's'}`

/** "Jul 6, 2022 to Aug 26, 2024", with "on or before" / "or later" where the readings stop short. */
function span(s: InvertedStretch): string {
  const start = `${s.startKnown ? '' : 'on or before '}${day(s.start)}`
  if (s.ongoing) return `since ${start}`
  return s.start === s.end ? `on ${start}` : `${start} to ${day(s.end)}${s.endKnown ? '' : ' or later'}`
}

export function YieldGapHistoryCard() {
  const [gap, setGap] = useState<SpreadKey>('spread2s10s')
  const [range, setRange] = useState<HistoryRange>('5y')
  const { data, isLoading } = useQuery<SpreadHistoryResponse>({
    queryKey: ['treasury-spread-history', range],
    queryFn: () => fetch(`/live-data/treasury-spread-history?range=${range}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
  })
  const { points, stretches, areas, yDomain } = useMemo(() => {
    const points = data?.ok ? data.points ?? [] : []
    const stretches = data?.ok ? data.stretches?.[gap] ?? [] : []
    // The value axis: the readings' range rounded out to half a point, with zero always in it.
    // Left to the chart library, a range of −1.89 to +2.28 was drawn from −2 to +6.
    const values = points.map((p) => p[gap]).filter((v): v is number => v != null)
    const yDomain: [number, number] = [
      Math.floor(Math.min(0, ...values) * 2) / 2,
      Math.ceil(Math.max(0, ...values) * 2) / 2,
    ]
    return { points, stretches, areas: shadeRanges(points.map((p) => p.date), stretches), yDomain }
  }, [data, gap])
  const now = data?.ok ? data.now?.[gap] ?? null : null
  const longest = stretches.reduce<InvertedStretch | null>((best, s) => (!best || s.readings > best.readings ? s : best), null)
  const latest = stretches[stretches.length - 1] ?? null
  const xFormat = (v: unknown) => {
    const d = new Date(`${String(v)}T12:00:00Z`)
    return Number.isNaN(d.getTime()) ? '' : format(d, range === '1mo' || range === '3mo' ? 'MMM d' : 'MMM yy')
  }
  const name = SPREAD_NAMES[gap]

  return (
    <div className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-text-secondary">The gap between long and short yields over time</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5" role="group" aria-label="Gap">
            {SPREAD_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => setGap(k)} aria-pressed={gap === k}
                className={clsx('px-2 py-1 rounded-sm text-[11px] font-medium transition-colors',
                  gap === k ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}>
                {SPREAD_NAMES[k].long}
              </button>
            ))}
          </div>
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
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : points.length > 0 ? (
        <>
          {now && (
            <p className="mb-3 text-xs text-text-secondary leading-relaxed" data-testid="gap-now">
              {now.inverted && now.stretch
                ? <>The {name.long} gap is <span className="font-mono text-red-400">{signed(now.value)}</span> points on {day(now.date)}: below zero {span(now.stretch)}, {tradingDays(now.stretch.readings)} so far, lowest {signed(now.stretch.deepest)} on {day(now.stretch.deepestOn)}.</>
                : <>The {name.long} gap is <span className="font-mono text-emerald-400">{signed(now.value)}</span> points on {day(now.date)}, above zero.{' '}
                    {now.stretch ? <>It was last below zero {span(now.stretch)}.</> : <>It has not been below zero since {day(data?.readFrom ?? now.date)}, the earliest reading read.</>}</>}
            </p>
          )}
          <LineChart
            data={points as unknown as Record<string, unknown>[]}
            xKey="date"
            series={[{ key: gap, label: `${name.long} (${name.short})`, color: '#3b82f6', strokeWidth: 2 }]}
            xFormatter={xFormat}
            yFormatter={(v) => signed(Number(v))}
            tooltipFormatter={(v, n) => [`${signed(Number(v))} points`, String(n)]}
            referenceLines={[{ y: 0, color: '#64748b' }]}
            referenceAreas={areas}
            yDomain={yDomain}
            height={260}
          />
          <div className="mt-3 text-xs text-text-secondary leading-relaxed" data-testid="gap-stretches">
            {stretches.length === 0 ? (
              <p>Not below zero at any point in this period.</p>
            ) : (
              <p>
                Below zero {stretches.length === 1 ? 'once' : `${stretches.length.toLocaleString('en-US')} times`} in this period (shaded)
                {longest && <>; the longest {span(longest)}, {tradingDays(longest.readings)}, lowest {signed(longest.deepest)} on {day(longest.deepestOn)}</>}
                {latest && longest && latest !== longest && <>; the most recent {span(latest)}</>}.
              </p>
            )}
          </div>
          <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
            The 10-year Treasury yield minus the {gap === 'spread2s10s' ? '2-year' : '3-month'} yield, in percentage points, from the US Treasury’s
            official daily par yield curve. Below zero, short-term yields are above long-term ones, which is called an inverted curve.
            Each stretch is worked out from every day’s reading{data?.interval === 'weekly' ? ', though the chart draws each week’s last' : ''}.
            {data?.missingYears && data.missingYears.length > 0 && ` The Treasury’s file for ${data.missingYears.join(', ')} could not be read, so the line has a gap there.`}
          </p>
        </>
      ) : (
        <p className="py-10 text-center text-xs text-text-muted">
          {data && !data.ok ? `The Treasury’s curve history could not be read (${data.error ?? 'no answer'}). It returns when the feed recovers.` : 'No readings in this range.'}
        </p>
      )}
    </div>
  )
}
