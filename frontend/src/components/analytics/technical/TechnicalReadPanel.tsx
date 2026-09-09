'use client'

import { useMemo } from 'react'
import { Compass, Gauge, Waves, Target } from 'lucide-react'
import { clsx } from 'clsx'
import { buildTechnicalRead, type OhlcvCandle, type SignalSummary } from '@/lib/utils/indicators'

// ─── Technical Read panel (plain-English summary) ───────────────────────────────

export function TechnicalReadPanel({ candles, summary }: { candles: OhlcvCandle[]; summary: SignalSummary }) {
  const read = useMemo(() => buildTechnicalRead(candles, summary), [candles, summary])

  const trendColor = read.trendBias.state === 'bullish' ? 'text-emerald-400'
    : read.trendBias.state === 'bearish' ? 'text-red-400' : 'text-slate-400'
  const momColor = read.momentum.state === 'overbought' ? 'text-red-400'
    : read.momentum.state === 'oversold' ? 'text-emerald-400'
    : read.momentum.state === 'strengthening' ? 'text-emerald-400'
    : read.momentum.state === 'weakening' ? 'text-amber-400' : 'text-slate-400'
  const volColor = read.volatility.state === 'expanding' ? 'text-amber-400'
    : read.volatility.state === 'contracting' ? 'text-blue-400' : 'text-slate-400'

  const rows: { icon: React.ReactNode; label: string; state: string; color: string; detail: string }[] = [
    { icon: <Compass size={13} />,    label: 'Trend bias',  state: read.trendBias.state,  color: trendColor, detail: read.trendBias.detail },
    { icon: <Gauge size={13} />,      label: 'Momentum',    state: read.momentum.state,   color: momColor,   detail: read.momentum.detail },
    { icon: <Waves size={13} />,      label: 'Volatility',  state: read.volatility.state, color: volColor,   detail: read.volatility.detail },
    { icon: <Target size={13} />,     label: 'Key level',   state: '',                    color: 'text-slate-400', detail: read.srProximity.detail },
  ]

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Technical Read</span>
        <div className="flex items-center gap-1.5" title="Agreement-weighted conviction across the indicator stack">
          <span className="text-[10px] text-text-muted">Confidence</span>
          <span className={clsx('text-xs font-bold font-mono', read.confidence >= 60 ? 'text-emerald-400' : read.confidence >= 30 ? 'text-amber-400' : 'text-slate-400')}>
            {read.confidence}%
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2.5">
            <span className={clsx('mt-0.5 shrink-0', r.color)}>{r.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-text-primary">{r.label}</span>
                {r.state && <span className={clsx('text-[10px] font-semibold uppercase tracking-wide', r.color)}>{r.state}</span>}
              </div>
              <p className="text-[11px] text-text-muted leading-snug">{r.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted/70 border-t border-border pt-2 leading-snug">{read.sourceExplanation}</p>
    </div>
  )
}
