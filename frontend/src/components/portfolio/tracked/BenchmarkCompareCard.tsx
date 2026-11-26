'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Scale } from 'lucide-react'
import { STALE_TIME_LONG } from '@/lib/constants'
import { FeatureNotice } from '@/components/legal/FeatureNotice'
import type { SecurityChartResponse } from '@/app/live-data/security-chart/route'
import type { ChartRange } from '@/lib/api/live/marketData'
import {
  BENCHMARK_CHOICES, benchmarkMethodNote, benchmarkWithheldWords, replayAgainstBenchmark,
  type BenchmarkSymbol,
} from '@/lib/data/benchmarkCompare'
import { formatReturnPct, moneyFlows, type PortfolioReturn } from '@/lib/data/trackedPortfolioViews'
import { formatUsd, type TradeView } from '@/lib/data/tradeLedger'

// "The same money in one index fund" (T-473, D245) — beside the tracked
// portfolio's return tile. Two figures and the method; NO verdict word and no
// colour on the gap (counsel question A16 reviews the shape before launch;
// D245 chose to build it now, the D237 pattern). Renders only when the
// portfolio's own return shows a figure at all: its withholdings (transfer
// out, unpriced holdings) come first.

const DAY_MS = 86_400_000

/** The smallest chart range that reaches back to the first flow. */
function rangeFor(since: string | null, now: Date): ChartRange {
  if (!since) return '1y'
  const ageDays = (now.getTime() - new Date(since).getTime()) / DAY_MS
  if (ageDays < 330) return '1y'
  if (ageDays < 1_750) return '5y'
  return 'max'
}

export function BenchmarkCompareCard({ trades, earned }: {
  trades: readonly TradeView[]
  earned: PortfolioReturn
}) {
  const [symbol, setSymbol] = useState<BenchmarkSymbol>(BENCHMARK_CHOICES[0].symbol)
  const { flows } = useMemo(() => moneyFlows(trades), [trades])
  const since = useMemo(() => {
    const dates = flows.map((f) => f.date).filter((d): d is string => d !== null).sort()
    return dates[0] ?? null
  }, [flows])
  const range = rangeFor(since, new Date())

  const chart = useQuery({
    queryKey: ['benchmark-compare', symbol, range],
    enabled: earned.kind !== 'none',
    staleTime: STALE_TIME_LONG,
    queryFn: async (): Promise<SecurityChartResponse> =>
      fetch(`/live-data/security-chart?symbol=${symbol}&range=${range}`).then((r) => r.json()),
  })

  const replay = useMemo(() => {
    const c = chart.data?.chart
    if (!c) return null
    return replayAgainstBenchmark(
      flows,
      c.points.map((p) => ({ date: new Date(p.t).toISOString().slice(0, 10), close: p.close })),
      c.basis,
      symbol,
    )
  }, [chart.data, flows, symbol])

  // The portfolio's own withholdings come first — no comparison without its figure.
  if (earned.kind === 'none') return null

  return (
    <section aria-labelledby="benchmark-compare-heading" className="bg-bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Scale size={14} className="text-text-muted" aria-hidden />
          <h3 id="benchmark-compare-heading" className="text-sm font-medium text-text-primary">
            The same money in one index fund
          </h3>
        </div>
        <div className="flex gap-1" role="group" aria-label="Benchmark fund">
          {BENCHMARK_CHOICES.map((b) => (
            <button
              key={b.symbol}
              onClick={() => setSymbol(b.symbol)}
              title={b.name}
              className={clsx(
                'px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors',
                symbol === b.symbol
                  ? 'border-accent-blue/50 bg-accent-blue/10 text-text-primary'
                  : 'border-border text-text-muted hover:text-text-secondary',
              )}
            >
              {b.symbol}
            </button>
          ))}
        </div>
      </div>

      {chart.isPending ? (
        <p className="text-xs text-text-muted">Fetching {symbol}’s price history…</p>
      ) : !chart.data?.ok || !replay ? (
        <p className="text-xs text-text-muted">
          No fund price history is available right now, so there is nothing to replay against.
          {chart.data?.error ? ` (${chart.data.error})` : ''}
        </p>
      ) : replay.kind === 'none' ? (
        <p className="text-xs text-text-muted">{benchmarkWithheldWords(replay)}</p>
      ) : (
        <>
          {/* Two figures, the same vocabulary as the return tile — and no third
              figure for the gap: the reader sees both and the method. */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <span className="text-[11px] text-text-muted uppercase tracking-wider block">Would be worth</span>
              <span className="text-xl font-semibold font-mono text-text-primary">{formatUsd(replay.valueUsd.toFixed(2))}</span>
            </div>
            <div>
              <span className="text-[11px] text-text-muted uppercase tracking-wider block">
                {replay.ratePct != null ? `${symbol} path, per year` : `${symbol} path, total`}
              </span>
              <span className="text-xl font-semibold font-mono text-text-primary">
                {replay.ratePct != null ? `${formatReturnPct(replay.ratePct)} a year` : formatReturnPct(replay.totalPct)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
            {benchmarkMethodNote(symbol, replay.asOf)}
          </p>
        </>
      )}
      <FeatureNotice feature="calculators" className="mt-2" />
    </section>
  )
}
