'use client'

import { clsx } from 'clsx'
import { ema, fibRetracement, type OhlcvCandle } from '@/lib/utils/indicators'

// ─── Key Levels panel ─────────────────────────────────────────────────────────

export function KeyLevelsPanel({ candles }: { candles: OhlcvCandle[] }) {
  if (candles.length < 20) return null
  const fib = fibRetracement(candles, Math.min(candles.length, 100))
  // null means the series carried no usable highs/lows. Dropping the panel
  // says so; an empty level list would read as "no levels near price".
  if (!fib) return null
  const last = candles[candles.length - 1].close
  const ema20Now = ema(candles.map((c) => c.close), 20)[candles.length - 1]
  const ema50Now = ema(candles.map((c) => c.close), 50)[candles.length - 1]
  const ema200Now = ema(candles.map((c) => c.close), 200)[candles.length - 1]

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Key Levels</span>

      {/* Fibonacci */}
      <div>
        <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wide">Fibonacci Retracement ({candles.length < 100 ? candles.length : 100} candles)</p>
        <div className="space-y-1">
          {fib.levels.map((l) => {
            const isAbove = l.price > last
            const isCurrent = Math.abs(l.price - last) / last < 0.005
            return (
              <div key={l.ratio} className={clsx('flex items-center justify-between px-2 py-1 rounded text-[11px]', isCurrent ? 'bg-accent-blue/10 border border-accent-blue/30' : 'hover:bg-bg-elevated')}>
                <span className={clsx('font-mono text-text-muted', isCurrent && 'text-accent-blue')}>{l.label}</span>
                <span className={clsx('font-mono font-semibold', isAbove ? 'text-red-400' : 'text-emerald-400', isCurrent && 'text-accent-blue')}>
                  ${l.price.toLocaleString(undefined, { maximumFractionDigits: l.price > 100 ? 2 : 4 })}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Moving Average levels */}
      <div>
        <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wide">Moving Averages</p>
        <div className="space-y-1">
          {[
            { label: 'EMA 20', value: ema20Now, color: '#f59e0b' },
            { label: 'EMA 50', value: ema50Now, color: '#8b5cf6' },
            { label: 'EMA 200', value: ema200Now, color: '#ec4899' },
          ].map(({ label, value, color }) => value !== null && (
            <div key={label} className="flex items-center justify-between px-2 py-1 rounded hover:bg-bg-elevated text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: color }} />
                <span className="text-text-muted">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[10px]', last > value ? 'text-emerald-400' : 'text-red-400')}>
                  {last > value ? '▲' : '▼'} {((last - value) / value * 100).toFixed(2)}%
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  ${value.toLocaleString(undefined, { maximumFractionDigits: value > 100 ? 2 : 4 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
