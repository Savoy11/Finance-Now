'use client'

import { PieChart } from 'lucide-react'
import type { TrackedSplit } from '@/lib/data/trackedPortfolioViews'

// How a tracked portfolio's money splits (T-453 b, D208): coins by their category,
// everything else by class, as the what-if Analysis tab splits a portfolio, but by
// each holding's live value. Figures only.

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function TrackedMixCard({ split }: { split: TrackedSplit }) {
  return (
    <div className="rounded-card border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PieChart size={14} className="text-text-muted" aria-hidden />
        <h3 className="text-sm font-medium text-text-secondary">
          How the money splits <span className="text-text-muted font-normal">— by live value</span>
        </h3>
      </div>
      {split.slices.length === 0 ? (
        <p className="text-xs text-text-muted">Nothing held has a live price right now, so there is nothing to split.</p>
      ) : (
        <ul className="space-y-2">
          {split.slices.map((s) => (
            <li key={s.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-text-secondary min-w-0">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="font-mono tabular-nums text-text-primary shrink-0">
                  {s.pct.toFixed(1)}% <span className="text-text-muted">· {usd(s.valueUsd)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${Math.max(0.5, s.pct)}%`, backgroundColor: s.color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-text-muted leading-relaxed">
        Shares of {usd(split.valueUsd)} held at live prices.
        {split.unpriced.length > 0 && (
          <> No live price right now for {split.unpriced.join(', ')}, so {split.unpriced.length === 1 ? 'it is' : 'they are'} left out: a holding is never valued at its cost.</>
        )}
      </p>
    </div>
  )
}
