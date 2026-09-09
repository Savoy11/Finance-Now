'use client'

import { Gauge } from 'lucide-react'
import { type Signal, type SignalSummary } from '@/lib/utils/indicators'
import { SignalBadge } from '@/components/charts/SignalBadge'

// ─── Signal Summary panel ──────────────────────────────────────────────────────

export function SignalSummaryPanel({ summary }: { summary: SignalSummary }) {
  const total = summary.buy + summary.neutral + summary.sell
  const buyPct = total > 0 ? (summary.buy / total) * 100 : 0
  const sellPct = total > 0 ? (summary.sell / total) * 100 : 0
  const neuPct = total > 0 ? (summary.neutral / total) * 100 : 0

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Signal Summary</span>
        <SignalBadge signal={summary.overall} />
      </div>

      {/* Gauge bar */}
      <div className="space-y-1.5">
        <div className="h-2.5 rounded-full overflow-hidden flex gap-px">
          <div className="bg-emerald-500 transition-all" style={{ width: `${buyPct}%` }} />
          <div className="bg-slate-600 transition-all" style={{ width: `${neuPct}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${sellPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span className="text-emerald-400">{summary.buy} Buy</span>
          <span>{summary.neutral} Neutral</span>
          <span className="text-red-400">{summary.sell} Sell</span>
        </div>
      </div>

      {/* Individual signals */}
      <div className="space-y-2">
        {summary.signals.map((sig) => (
          <div key={sig.name} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary">{sig.name}</p>
              <p className="text-[10px] text-text-muted truncate">{sig.description}</p>
            </div>
            <SignalBadge signal={sig.signal} />
          </div>
        ))}
      </div>
    </div>
  )
}
