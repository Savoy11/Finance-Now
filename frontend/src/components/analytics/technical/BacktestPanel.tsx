'use client'

// HIDDEN, NOT DELETED. The Backtest tab was hidden on 2026-08-20 (owner
// decision, explicitly revisitable), so this panel currently has no call site.
// It was extracted from technical-analysis/page.tsx on 2026-09-08 with the
// other eight panels, unchanged. To restore it: re-add 'backtest' to the Tab
// union in that page, to its two tab lists, and re-add the import of this file.
// Do not delete it for being unreferenced — that is the state it is meant to be
// in.

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { runBacktest, STRATEGIES, type StrategyCategory } from '@/lib/utils/backtest'
import { type OhlcvCandle } from '@/lib/utils/indicators'

// ─── Strategy Backtest panel (feature #7) ───────────────────────────────────────

const CAT_LABEL: Partial<Record<StrategyCategory, string>> = {
  trend: 'Trend', 'mean-reversion': 'Mean Reversion',
  volatility: 'Volatility', volume: 'Volume', 'multi-factor': 'Multi-Factor',
}
const CAT_ORDER: StrategyCategory[] = ['trend', 'mean-reversion', 'volatility', 'volume', 'multi-factor']

const FEE_OPTIONS = [
  { label: 'No fees', value: 0 },
  { label: '0.05%', value: 0.0005 },
  { label: '0.1%', value: 0.001 },
  { label: '0.25%', value: 0.0025 },
]

export function BacktestPanel({ assetId, symbol }: { assetId: string; symbol: string }) {
  // Dedicated long DAILY series so 200-period strategies have enough warm-up data.
  const { data, isFetching } = useQuery({
    queryKey: ['ta-backtest-ohlcv', assetId],
    queryFn: async () => {
      const res = await fetch(`/live-data/ohlcv?id=${assetId}&range=BT`)
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<{ ok: boolean; candles: OhlcvCandle[]; source?: string }>
    },
    staleTime: 60 * 60 * 1000,
  })
  const candles = useMemo<OhlcvCandle[]>(() => data?.candles ?? [], [data])

  const [strategyKey, setStrategyKey] = useState<string | null>(null)
  const [feesPct, setFeesPct]         = useState(0)
  const [direction, setDirection]     = useState<'long' | 'short'>('long')

  // Recompute all results when candles, fees, or direction change.
  const allResults = useMemo(
    () => Object.fromEntries(
      STRATEGIES.map(s => {
        if (candles.length === 0) return [s.key, null]
        // Isolate failures: a single misbehaving strategy must not crash the panel.
        try { return [s.key, runBacktest(candles, s.key, { feesPct, direction })] }
        catch { return [s.key, null] }
      })
    ),
    [candles, feesPct, direction],
  )

  // The default strategy is DERIVED, not written into state by an effect: the
  // first one that actually has trades. As state it took an extra render to
  // appear (one paint of an empty strategy) and it stuck to the first asset
  // loaded — a later asset with no trades on that strategy kept showing it. An
  // explicit pick by the reader still wins, because strategyKey takes priority.
  const defaultKey = useMemo(() => {
    if (candles.length === 0) return STRATEGIES[0].key
    const first = STRATEGIES.find(s => (allResults[s.key]?.metrics.sampleCount ?? 0) > 0)
    return (first ?? STRATEGIES[0]).key
  }, [allResults, candles.length])

  const activeKey = strategyKey ?? defaultKey
  const result    = allResults[activeKey] ?? null
  const strat     = STRATEGIES.find(s => s.key === activeKey)!

  const fmtRatio = (v: number | null) => v === null ? 'n/a' : v.toFixed(2)
  const ratioTone = (v: number | null) =>
    v === null ? 'text-text-muted' : v >= 1 ? 'text-emerald-400' : v >= 0 ? 'text-amber-400' : 'text-red-400'

  const metricCard = (label: string, value: string, tone?: string, sub?: string) => (
    <div className="rounded-lg border border-border bg-bg-card px-3 py-2.5 text-center">
      <div className={clsx('text-lg font-bold font-mono', tone ?? 'text-text-primary')}>{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
      {sub && <div className="text-[9px] text-text-muted/60 mt-0.5">{sub}</div>}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Strategy selector dropdown — grouped by category */}
      <div className="flex items-center gap-3">
        <label htmlFor="bt-strategy" className="text-xs text-text-muted flex-shrink-0">Strategy</label>
        <select
          id="bt-strategy"
          value={activeKey}
          onChange={e => setStrategyKey(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-blue/60 transition-colors"
        >
          {CAT_ORDER.map(cat => {
            const group = STRATEGIES.filter(s => s.category === cat)
            if (group.length === 0) return null
            return (
              <optgroup key={cat} label={CAT_LABEL[cat] ?? cat}>
                {group.map(s => {
                  const n = allResults[s.key]?.metrics.sampleCount
                  return (
                    <option key={s.key} value={s.key}>
                      {s.name}{n != null ? ` (${n} trades)` : ''}
                    </option>
                  )
                })}
              </optgroup>
            )
          })}
        </select>
      </div>

      {/* Simulation controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-bg-card px-3 py-2">
        {/* Direction */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Direction</span>
          {(['long', 'short'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={clsx('px-2.5 py-1 rounded text-xs font-medium border transition-colors capitalize',
                direction === d
                  ? d === 'long' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'text-text-muted border-border hover:text-text-secondary hover:bg-bg-elevated')}
            >
              {d}
            </button>
          ))}
        </div>
        {/* Fees */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Fees / side</span>
          {FEE_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => setFeesPct(f.value)}
              className={clsx('px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                feesPct === f.value
                  ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/30'
                  : 'text-text-muted border-border hover:text-text-secondary hover:bg-bg-elevated')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-muted">
        {strat.description} · {symbol} · {candles.length} daily candles (~{(candles.length / 365).toFixed(1)}y) ·{' '}
        {direction === 'long' ? 'Long-only' : 'Short-only'}, full position, one trade at a time
        {feesPct > 0 ? `, ${(feesPct * 100).toFixed(2)}% fee per side` : ', no fees'}.
      </p>

      {isFetching && candles.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card p-8 text-center text-text-muted text-sm">
          Loading {symbol} daily history…
        </div>
      ) : !result ? (
        <div className="rounded-xl border border-border bg-bg-card p-8 text-center text-text-muted text-sm">
          Not enough price history — needs ≥{strat.minBars} daily candles, {symbol} has {candles.length}.
          Bollinger-bounce works on shorter histories; 200-period trend strategies need ~2+ years.
        </div>
      ) : result.metrics.sampleCount === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card p-8 text-center text-text-muted text-sm">
          Enough data, but entry conditions never triggered for {symbol} over{' '}
          {(candles.length / 365).toFixed(1)} years. Try another strategy (trade counts in parentheses).
        </div>
      ) : (
        <>
          {/* Metrics grid — 8 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {metricCard('Win rate',    `${result.metrics.winRate.toFixed(0)}%`,
              result.metrics.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400')}
            {metricCard('Avg return',  `${result.metrics.averageReturn >= 0 ? '+' : ''}${result.metrics.averageReturn.toFixed(1)}%`,
              result.metrics.averageReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}
            {metricCard('Total return',`${result.metrics.totalReturn >= 0 ? '+' : ''}${result.metrics.totalReturn.toFixed(1)}%`,
              result.metrics.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}
            {metricCard('Max drawdown',`-${result.metrics.maxDrawdown.toFixed(1)}%`, 'text-red-400')}
            {metricCard('Trades',      `${result.metrics.sampleCount}`)}
            {metricCard('Avg hold',    `${result.metrics.averageHoldingPeriod.toFixed(0)} bars`)}
            {metricCard('Sharpe',      fmtRatio(result.metrics.sharpeRatio),
              ratioTone(result.metrics.sharpeRatio), 'annualised')}
            {metricCard('Sortino',     fmtRatio(result.metrics.sortinoRatio),
              ratioTone(result.metrics.sortinoRatio), 'downside only')}
          </div>

          {/* Trades table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  <th className="text-left  px-4 py-2 text-text-muted font-medium">#</th>
                  <th className="text-right px-3 py-2 text-text-muted font-medium">Entry</th>
                  <th className="text-right px-3 py-2 text-text-muted font-medium">Exit</th>
                  <th className="text-right px-3 py-2 text-text-muted font-medium">Return{feesPct > 0 ? ' (net)' : ''}</th>
                  <th className="text-right px-4 py-2 text-text-muted font-medium">Bars held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.trades.map((t, i) => (
                  <tr key={i} className="hover:bg-bg-elevated transition-colors">
                    <td className="px-4 py-2 text-text-muted">{i + 1}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: t.entryPrice > 100 ? 2 : 4 })}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">${t.exitPrice.toLocaleString(undefined, { maximumFractionDigits: t.exitPrice > 100 ? 2 : 4 })}</td>
                    <td className={clsx('px-3 py-2 text-right font-mono font-semibold', t.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>{t.returnPct >= 0 ? '+' : ''}{t.returnPct.toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right font-mono text-text-muted">{t.bars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-text-muted/70">
            Hypothetical{feesPct > 0 ? ` (${(feesPct * 100).toFixed(2)}% fee per side applied)` : ', no fees or slippage'}; past performance does not predict future results. Not financial advice.
          </p>
        </>
      )}
    </div>
  )
}
