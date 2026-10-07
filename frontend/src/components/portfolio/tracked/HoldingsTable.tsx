'use client'

import { AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import {
  formatLivePrice, formatUnitPrice, formatUnits, formatUsd, formatUsdChange, type HoldingValue,
} from '@/lib/data/tradeLedger'

// One row per holding: what is held, what it cost, what it is worth at the live
// price, and the gains (T-027, D65). Realized figures are FIFO and plain; the
// table's caption names the method, as D65 requires of every realized figure.

const changeCls = (v: string | null) =>
  v === null ? 'text-text-muted' : v.startsWith('-') ? 'text-red-400' : formatUsd(v) === '$0.00' ? 'text-text-secondary' : 'text-emerald-400'

export function HoldingsTable({ holdings, methodLabel }: { holdings: HoldingValue[]; methodLabel: string }) {
  if (holdings.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-sm text-text-muted">
        Nothing held yet. Record a trade or a starting position below.
      </div>
    )
  }
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Holdings. Realized gains: {methodLabel}.</caption>
          <thead>
            <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border bg-bg-elevated/50">
              <th scope="col" className="text-left font-medium px-4 py-2">Holding</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Units</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Avg cost</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Cost</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Price</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Value</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Unrealized</th>
              <th scope="col" className="text-right font-medium px-4 py-2">Realized</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const held = h.quantityHeld !== '0'
              const fromStart = h.realizedFromStartingPositionUsd !== '0'
              return (
                <tr key={h.instrumentKey} className="border-b border-border/50 last:border-0 align-top">
                  <th scope="row" className="text-left font-normal px-4 py-2.5">
                    <div className="font-semibold text-text-primary">{h.symbol}</div>
                    <div className="text-xs text-text-muted max-w-[12rem] truncate" title={h.name}>{h.name}</div>
                    {h.issues.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {h.issues.map((i, n) => (
                          <li key={`${i.code}-${i.tradeId}-${n}`} className="flex items-start gap-1.5 text-[11px] text-amber-300 leading-snug">
                            <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" aria-hidden />
                            <span>{i.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </th>
                  <td className="text-right px-3 py-2.5 font-mono text-text-primary whitespace-nowrap">{formatUnits(h.quantityHeld)}</td>
                  <td className="text-right px-3 py-2.5 font-mono text-text-secondary whitespace-nowrap">{h.averageCostUsd ? formatUnitPrice(h.averageCostUsd) : '—'}</td>
                  <td className="text-right px-3 py-2.5 font-mono text-text-secondary whitespace-nowrap">{held ? formatUsd(h.costHeldUsd) : '—'}</td>
                  <td className="text-right px-3 py-2.5 font-mono text-text-secondary whitespace-nowrap">
                    {h.priceUsd !== null ? formatLivePrice(h.priceUsd) : held ? <span title="No live price right now. This holding is left out of the value totals, never valued at its cost.">—</span> : '—'}
                  </td>
                  <td className="text-right px-3 py-2.5 font-mono text-text-primary whitespace-nowrap">{h.valueUsd !== null ? formatUsd(h.valueUsd) : '—'}</td>
                  <td className={clsx('text-right px-3 py-2.5 font-mono whitespace-nowrap', changeCls(h.unrealizedUsd))}>
                    {h.unrealizedUsd !== null ? formatUsdChange(h.unrealizedUsd) : '—'}
                  </td>
                  <td className="text-right px-4 py-2.5">
                    <div className={clsx('font-mono whitespace-nowrap', changeCls(h.realizedGainUsd))}>{formatUsdChange(h.realizedGainUsd)}</div>
                    {fromStart && (
                      <div className="text-[10px] text-text-muted mt-0.5 ml-auto max-w-[7.5rem] leading-snug" title="This part rests on the average price you entered for your starting position.">
                        {formatUsdChange(h.realizedFromStartingPositionUsd)} from starting position
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-text-muted border-t border-border/50">Realized: {methodLabel}.</p>
    </div>
  )
}
