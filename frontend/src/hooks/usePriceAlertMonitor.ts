'use client'

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { usePriceAlertStore, type PriceAlert } from '@/store/usePriceAlertStore'
import { attributionText } from '@/lib/data/dataSources'

// Client-side price-alert monitor. Polls quotes for armed alerts every minute
// while the app is open; fires a toast + browser notification once per alert.
// Runs from the dashboard layout so it covers every page.

const POLL_MS = 60_000

async function fetchPrices(alerts: PriceAlert[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  const cgIds = [...new Set(alerts.filter((a) => a.kind === 'crypto').map((a) => a.target))]
  const symbols = [...new Set(alerts.filter((a) => a.kind === 'security').map((a) => a.target))]

  const tasks: Promise<void>[] = []
  if (cgIds.length > 0) {
    tasks.push(
      fetch(`/live-data/portfolio-prices?ids=${cgIds.join(',')}`)
        .then((r) => r.json())
        .then((d: { prices?: Record<string, number> }) => {
          for (const [id, p] of Object.entries(d.prices ?? {})) prices[`crypto:${id}`] = p
        })
        .catch(() => {})
    )
  }
  if (symbols.length > 0) {
    tasks.push(
      fetch(`/live-data/security-quotes?symbols=${symbols.join(',')}`)
        .then((r) => r.json())
        .then((d: { quotes?: Record<string, { price: number; reference?: boolean }>; source?: string }) => {
          for (const [sym, q] of Object.entries(d.quotes ?? {})) {
            // Never fire alerts off reference/fallback prices
            if (d.source !== 'reference' && !q.reference) prices[`security:${sym}`] = q.price
          }
        })
        .catch(() => {})
    )
  }
  await Promise.all(tasks)
  return prices
}

/**
 * The alert's words. The "now" price comes from the source fetchPrices read it from, and a
 * toast or notification shows it on any page with no SourceLine in sight, so the message
 * carries that source's required credit itself (T-424): "Powered by CoinGecko" for a coin.
 */
export function priceAlertMessage(alert: PriceAlert, price: number): string {
  const direction = alert.condition === 'above' ? 'rose above' : 'fell below'
  const message = `${alert.label} ${direction} $${alert.price.toLocaleString()} (now $${price.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
  const credit = attributionText(alert.kind === 'crypto' ? 'portfolio-prices' : 'security-quotes')
  return credit ? `${message} · ${credit}` : message
}

function notify(alert: PriceAlert, price: number) {
  const message = priceAlertMessage(alert, price)
  toast(message, { icon: '🔔', duration: 10_000 })
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification('Finance Now price alert', { body: message }) } catch { /* blocked */ }
  }
}

export function usePriceAlertMonitor() {
  const checking = useRef(false)

  useEffect(() => {
    const check = async () => {
      if (checking.current) return
      const { alerts, markTriggered } = usePriceAlertStore.getState()
      const armed = alerts.filter((a) => a.triggeredAt === null)
      if (armed.length === 0) return
      checking.current = true
      try {
        const prices = await fetchPrices(armed)
        for (const alert of armed) {
          const price = prices[`${alert.kind}:${alert.target}`]
          if (price == null) continue
          const hit = alert.condition === 'above' ? price >= alert.price : price <= alert.price
          if (hit) {
            markTriggered(alert.id, price)
            notify(alert, price)
          }
        }
      } finally {
        checking.current = false
      }
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => clearInterval(interval)
  }, [])
}
