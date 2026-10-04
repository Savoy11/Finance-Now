'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import {
  MAX_REASON_LENGTH, formatUnitPrice, formatUnits, formatUsd, tradeKindLabel, trimDecimal, type TradeView,
} from '@/lib/data/tradeLedger'

// Every trade in the portfolio, oldest first, cancelled ones included (T-027,
// D65). Nothing is ever edited or removed: a mistake is cancelled here, with a
// reason if the user gives one, and the right trade is recorded as a new one.

const DAY: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }

/** Trades are dated by day; the date typed is shown as typed, whatever the reader's time zone. */
export function formatTradeDate(iso: string | null): string {
  if (!iso) return 'Date not given'
  return new Date(iso).toLocaleDateString('en-US', { ...DAY, timeZone: 'UTC' })
}

/** A moment the app recorded, such as a cancellation, on the reader's own calendar. */
export function formatRecordedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', DAY)
}

export function TradesTable({ trades, onCancel, busyId }: {
  trades: TradeView[]
  /** Cancels the trade; resolves to the server's reason if it refused, or null once cancelled. */
  onCancel: (tradeId: string, reason: string) => Promise<string | null>
  busyId: string | null
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (trades.length === 0) {
    return <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-sm text-text-muted">No trades recorded yet.</div>
  }

  function openConfirm(id: string | null) {
    setConfirming(id)
    setReason('')
    setError(null)
  }

  async function confirm(id: string) {
    const refused = await onCancel(id, reason.trim())
    if (refused) { setError(refused); return }
    openConfirm(null)
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Trades, oldest first, cancelled ones included</caption>
          <thead>
            <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border bg-bg-elevated/50">
              <th scope="col" className="text-left font-medium px-4 py-2">Date</th>
              <th scope="col" className="text-left font-medium px-3 py-2">Kind</th>
              <th scope="col" className="text-left font-medium px-3 py-2">Holding</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Units</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Price</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Fee</th>
              <th scope="col" className="text-left font-medium px-3 py-2">Note</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const cancelled = !!t.cancelled
              const priced = t.side !== 'transfer_out'
              return (
                <tr key={t.id} className={clsx('border-b border-border/50 last:border-0 align-top', cancelled && 'opacity-60')}>
                  <td className={clsx('px-4 py-2.5 whitespace-nowrap text-text-secondary', cancelled && 'line-through')}>{formatTradeDate(t.executedAt)}</td>
                  <td className={clsx('px-3 py-2.5 whitespace-nowrap text-text-primary', cancelled && 'line-through')}>{tradeKindLabel(t)}</td>
                  <td className={clsx('px-3 py-2.5 whitespace-nowrap font-semibold text-text-primary', cancelled && 'line-through')}>{t.symbol}</td>
                  <td className={clsx('px-3 py-2.5 text-right font-mono whitespace-nowrap', cancelled && 'line-through')}>{formatUnits(trimDecimal(t.quantity))}</td>
                  <td className={clsx('px-3 py-2.5 text-right font-mono whitespace-nowrap text-text-secondary', cancelled && 'line-through')}>
                    {priced ? formatUnitPrice(trimDecimal(t.pricePerUnit)) : '—'}
                  </td>
                  <td className={clsx('px-3 py-2.5 text-right font-mono whitespace-nowrap text-text-secondary', cancelled && 'line-through')}>
                    {/^0(\.0+)?$/.test(t.feeUsd) ? '—' : formatUsd(t.feeUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-muted max-w-[14rem]">
                    {t.note}
                    {cancelled && (
                      <div className="text-amber-300 not-italic">
                        Cancelled {formatRecordedDate(t.cancelled!.at)}{t.cancelled!.reason ? `: ${t.cancelled!.reason}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {!cancelled && confirming !== t.id && (
                      <button type="button" onClick={() => openConfirm(t.id)}
                        className="text-xs text-text-muted hover:text-red-400 transition-colors"
                        aria-label={`Cancel the ${tradeKindLabel(t).toLowerCase()} of ${t.symbol}${t.executedAt ? ` on ${formatTradeDate(t.executedAt)}` : ''}`}>
                        Cancel
                      </button>
                    )}
                    {!cancelled && confirming === t.id && (
                      <div className="flex flex-col items-end gap-1.5 min-w-[14rem]">
                        <input autoFocus maxLength={MAX_REASON_LENGTH} placeholder="Reason (optional)"
                          aria-label="Why this trade is being cancelled"
                          className="w-full bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                          value={reason} onChange={(e) => setReason(e.target.value)} />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openConfirm(null)}
                            className="text-xs text-text-muted hover:text-text-primary px-2 py-1">Keep it</button>
                          <button type="button" disabled={busyId === t.id} onClick={() => void confirm(t.id)}
                            className="text-xs bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50 rounded px-2 py-1">
                            {busyId === t.id ? 'Cancelling…' : 'Cancel trade'}
                          </button>
                        </div>
                        {error && <p className="text-[11px] text-red-400 text-right whitespace-normal" role="alert">{error}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-text-muted border-t border-border/50">
        A cancelled trade stays listed and counts for nothing. To correct a trade, cancel it and record the right one.
      </p>
    </div>
  )
}
