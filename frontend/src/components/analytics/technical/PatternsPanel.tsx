'use client'

import { Activity, Target, ShieldAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { patternProjection, type OhlcvCandle, type DetectedPattern } from '@/lib/utils/indicators'

// ─── Patterns panel ────────────────────────────────────────────────────────────

export function PatternsPanel({ patterns, candles }: { patterns: DetectedPattern[]; candles: OhlcvCandle[] }) {
  if (patterns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-4 text-center">
        <Activity size={28} className="mx-auto mb-2 text-text-muted/40" />
        <p className="text-xs text-text-muted">No clear patterns detected</p>
      </div>
    )
  }

  const fmt = (v: number) => '$' + v.toLocaleString(undefined, { maximumFractionDigits: v > 100 ? 2 : 4 })

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Detected Patterns</span>
      {patterns.map((p, i) => {
        const proj = patternProjection(p, candles)
        const last = candles[candles.length - 1].close
        const movePct = proj ? ((proj.measuredMoveTarget - last) / last) * 100 : null
        return (
          <div key={i} className={clsx('rounded-lg border p-3 flex flex-col gap-1.5', p.type === 'bullish' ? 'border-emerald-500/20 bg-emerald-500/5' : p.type === 'bearish' ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-bg-elevated')}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-primary">{p.name}</span>
              <span className={clsx('text-[10px] font-mono px-1.5 py-0.5 rounded', p.type === 'bullish' ? 'text-emerald-400 bg-emerald-400/10' : p.type === 'bearish' ? 'text-red-400 bg-red-400/10' : 'text-slate-400 bg-slate-400/10')}>
                {(p.confidence * 100).toFixed(0)}% conf.
              </span>
            </div>
            <p className="text-[11px] text-text-muted">{p.description}</p>
            {proj && (
              <div className="grid grid-cols-2 gap-1.5 mt-1 pt-1.5 border-t border-border/60">
                <div className="flex items-center gap-1.5" title="Measured-move target — pattern height projected from the break level">
                  <Target size={11} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-text-muted">Target</span>
                  <span className="text-[10px] font-mono font-semibold text-text-primary">{fmt(proj.measuredMoveTarget)}</span>
                  {movePct !== null && <span className={clsx('text-[9px]', movePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>({movePct >= 0 ? '+' : ''}{movePct.toFixed(1)}%)</span>}
                </div>
                <div className="flex items-center gap-1.5" title="Invalidation — a close past this level voids the pattern">
                  <ShieldAlert size={11} className="text-amber-400 shrink-0" />
                  <span className="text-[10px] text-text-muted">Invalid</span>
                  <span className="text-[10px] font-mono font-semibold text-text-primary">{fmt(proj.invalidationLevel)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
