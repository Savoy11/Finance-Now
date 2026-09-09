'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { computeSignalSummary, type OhlcvCandle, type SignalSummary } from '@/lib/utils/indicators'
import { confluenceLabel } from '@/lib/utils/confluence'
import { SignalBadge } from '@/components/charts/SignalBadge'

// ─── Multi-Timeframe Confluence Grid ──────────────────────────────────────────

const TF_ROWS = [
  { label: '15m', range: '15m' },
  { label: '1H',  range: '1H'  },
  { label: '4H',  range: '4H'  },
  { label: '1D',  range: '1Y'  },
  { label: '1W',  range: '3Y'  },
] as const

interface TFRow {
  label: string
  range: string
  summary: SignalSummary | null
  loading: boolean
}

const loadingRows = (): TFRow[] => TF_ROWS.map(r => ({ ...r, summary: null, loading: true }))

/**
 * Fold one timeframe's result into the keyed state. If the state still belongs
 * to a previous asset, it starts from a fresh loading set — so a response that
 * lands just after the asset changed cannot graft the old coin's rows onto the
 * new one.
 */
function mergeRow(
  prev: { assetId: string; rows: TFRow[] },
  assetId: string,
  range: string,
  patch: Partial<TFRow>,
): { assetId: string; rows: TFRow[] } {
  const base = prev.assetId === assetId ? prev.rows : loadingRows()
  return { assetId, rows: base.map(r => (r.range === range ? { ...r, ...patch } : r)) }
}

export function MultiTimeframeGrid({ assetId }: { assetId: string }) {
  // State is KEYED on the asset rather than reset by a synchronous setState at
  // the top of the effect. The reset used to happen a render late — for one
  // paint the grid showed the previous coin's verdicts under the new coin's
  // name — and it cost a cascading render every time (react-hooks/
  // set-state-in-effect). Deriving the reset makes both go away.
  const [state, setState] = useState<{ assetId: string; rows: TFRow[] }>(
    () => ({ assetId, rows: loadingRows() }),
  )
  const rows = state.assetId === assetId ? state.rows : loadingRows()

  useEffect(() => {
    let cancelled = false

    Promise.all(TF_ROWS.map(async (tf) => {
      try {
        const res  = await fetch(`/live-data/ohlcv?id=${assetId}&range=${tf.range}`)
        const json = await res.json()
        const candles: OhlcvCandle[] = json.candles ?? []
        const summary = candles.length >= 50 ? computeSignalSummary(candles) : null
        if (!cancelled) setState(prev => mergeRow(prev, assetId, tf.range, { summary, loading: false }))
      } catch {
        if (!cancelled) setState(prev => mergeRow(prev, assetId, tf.range, { loading: false }))
      }
    }))

    return () => { cancelled = true }
  }, [assetId])

  // Confluence: count loaded rows and how many agree
  const loaded  = rows.filter(r => !r.loading && r.summary)
  const bullish = loaded.filter(r => r.summary!.overall === 'buy' || r.summary!.overall === 'strong_buy').length
  const bearish = loaded.filter(r => r.summary!.overall === 'sell' || r.summary!.overall === 'strong_sell').length

  const confluence = confluenceLabel(loaded.length, bullish, bearish)

  // Plain-English per-timeframe agreement, e.g. "1D bullish · 4H overbought · 1H weakening"
  function tfPhrase(summary: SignalSummary): { word: string; color: string } {
    const rsiSig = summary.signals.find(s => s.name.startsWith('RSI'))
    const rsiVal = rsiSig?.value ?? null
    if (rsiVal !== null && rsiVal > 70) return { word: 'overbought', color: 'text-red-400' }
    if (rsiVal !== null && rsiVal < 30) return { word: 'oversold', color: 'text-emerald-400' }
    switch (summary.overall) {
      case 'strong_buy':  return { word: 'strong bull', color: 'text-emerald-400' }
      case 'buy':         return { word: 'bullish', color: 'text-emerald-400' }
      case 'sell':        return { word: 'bearish', color: 'text-red-400' }
      case 'strong_sell': return { word: 'strong bear', color: 'text-red-400' }
      default:            return { word: 'neutral', color: 'text-slate-400' }
    }
  }
  const agreement = loaded.length >= 2
    ? [...loaded].reverse().map(r => ({ label: r.label, ...tfPhrase(r.summary!) }))
    : null

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Multi-Timeframe Confluence
        </span>
        {confluence && (
          <span className={clsx('text-[11px] font-medium', confluence.color)}>
            {confluence.text}
          </span>
        )}
      </div>

      {/* Plain-English agreement line */}
      {agreement && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] -mt-1">
          {agreement.map((a, i) => (
            <span key={a.label} className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-text-secondary">{a.label}</span>
              <span className={clsx('font-medium', a.color)}>{a.word}</span>
              {i < agreement.length - 1 && <span className="text-text-muted/40">·</span>}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-2">
        {rows.map((row) => {
          const total = row.summary ? row.summary.buy + row.summary.neutral + row.summary.sell : 0
          return (
            <div
              key={row.label}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-bg-elevated p-3"
            >
              <span className="text-[11px] font-mono font-bold text-text-secondary">{row.label}</span>

              {row.loading ? (
                <div className="h-5 w-16 rounded-full bg-bg-card animate-pulse" />
              ) : row.summary ? (
                <>
                  <SignalBadge signal={row.summary.overall} />
                  <div className="h-1.5 w-full rounded-full overflow-hidden flex gap-px">
                    <div className="bg-emerald-500 transition-all" style={{ width: `${(row.summary.buy    / total) * 100}%` }} />
                    <div className="bg-slate-600 transition-all"   style={{ width: `${(row.summary.neutral / total) * 100}%` }} />
                    <div className="bg-red-500 transition-all"     style={{ width: `${(row.summary.sell   / total) * 100}%` }} />
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <span className="text-emerald-400">{row.summary.buy}B</span>
                    <span className="text-text-muted">{row.summary.neutral}N</span>
                    <span className="text-red-400">{row.summary.sell}S</span>
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-text-muted">N/A</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
