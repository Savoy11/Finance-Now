'use client'

import Link from 'next/link'
import { Bell, BellOff, RotateCcw, Trash2 } from 'lucide-react'
import { usePriceAlertStore, type PriceAlert } from '@/store/usePriceAlertStore'

// The user's price alerts (T-454, D209): each with whether it is still waiting
// or has fired, and buttons to re-arm or remove it. Shown on the Watchlist page
// for every alert, and in an asset page's action row for that asset's own.

export function formatAlertPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 })}`
}

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function PriceAlertList({ alerts, showAsset = true, emptyText }: {
  alerts: PriceAlert[]
  /** Name the asset on each row (the Watchlist page); an asset page leaves it out. */
  showAsset?: boolean
  emptyText?: string
}) {
  const removeAlert = usePriceAlertStore((s) => s.removeAlert)
  const rearmAlert = usePriceAlertStore((s) => s.rearmAlert)

  if (alerts.length === 0) {
    return emptyText ? <p className="text-xs text-text-muted">{emptyText}</p> : null
  }
  return (
    <ul className="divide-y divide-border/50">
      {alerts.map((a) => {
        const fired = a.triggeredAt !== null
        const what = `${a.condition === 'above' ? 'Rises above' : 'Falls below'} ${formatAlertPrice(a.price)}`
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
            {fired
              ? <BellOff size={13} className="text-text-muted shrink-0" aria-hidden />
              : <Bell size={13} className="text-accent-blue shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1">
              {showAsset && (
                <>
                  {a.href
                    ? <Link href={a.href} className="font-medium text-text-primary hover:text-accent-blue">{a.label}</Link>
                    : <span className="font-medium text-text-primary">{a.label}</span>}
                  {' · '}
                </>
              )}
              <span className="text-text-secondary">{what}</span>
              <span className="block text-text-muted">
                {fired
                  ? `Fired ${dateOf(a.triggeredAt!)}${a.triggeredPrice != null ? ` at ${formatAlertPrice(a.triggeredPrice)}` : ''}`
                  : `Waiting, since ${dateOf(a.createdAt)}`}
              </span>
            </span>
            {fired && (
              <button type="button" onClick={() => rearmAlert(a.id)}
                className="inline-flex items-center gap-1 text-accent-blue hover:underline"
                aria-label={`Re-arm the alert on ${a.label}: ${what}`}>
                <RotateCcw size={12} aria-hidden /> Re-arm
              </button>
            )}
            <button type="button" onClick={() => removeAlert(a.id)}
              className="inline-flex items-center gap-1 text-text-muted hover:text-red-400"
              aria-label={`Remove the alert on ${a.label}: ${what}`}>
              <Trash2 size={12} aria-hidden /> Remove
            </button>
          </li>
        )
      })}
    </ul>
  )
}
