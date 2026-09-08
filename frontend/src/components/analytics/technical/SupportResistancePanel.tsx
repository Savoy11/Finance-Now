'use client'

import { useMemo } from 'react'
import { clsx } from 'clsx'
import { detectSupportResistance, type OhlcvCandle } from '@/lib/utils/indicators'

// ─── Auto Support / Resistance panel ────────────────────────────────────────────

export function SupportResistancePanel({ candles }: { candles: OhlcvCandle[] }) {
  const levels = useMemo(() => detectSupportResistance(candles), [candles])
  if (levels.length === 0) return null
  const last = candles[candles.length - 1].close

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Support / Resistance</span>
        <span className="text-[10px] text-text-muted">auto-detected from swings</span>
      </div>
      <div className="space-y-1">
        {levels.map((l, i) => {
          const isRes = l.type === 'resistance'
          return (
            <div key={i} className="flex items-center justify-between px-2 py-1 rounded hover:bg-bg-elevated text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={clsx('px-1 py-0.5 rounded text-[9px] font-semibold uppercase', isRes ? 'bg-red-400/10 text-red-400' : 'bg-emerald-400/10 text-emerald-400')}>
                  {isRes ? 'R' : 'S'}
                </span>
                {/* strength dots */}
                <span className="flex gap-0.5" title={`${l.strength} swing touches`}>
                  {Array.from({ length: Math.min(l.strength, 4) }).map((_, d) => (
                    <span key={d} className={clsx('inline-block size-1 rounded-full', isRes ? 'bg-red-400/60' : 'bg-emerald-400/60')} />
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[10px]', l.distancePct >= 0 ? 'text-red-400/80' : 'text-emerald-400/80')}>
                  {l.distancePct >= 0 ? '+' : ''}{l.distancePct.toFixed(1)}%
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  ${l.price.toLocaleString(undefined, { maximumFractionDigits: l.price > 100 ? 2 : 4 })}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-text-muted/70">Current ${last.toLocaleString(undefined, { maximumFractionDigits: last > 100 ? 2 : 4 })} · letters mark support (S) / resistance (R); dots = touch count.</p>
    </div>
  )
}
