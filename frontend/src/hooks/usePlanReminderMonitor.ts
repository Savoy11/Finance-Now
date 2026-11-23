'use client'

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { actualWeightsFromPortfolio, checkDrift, type DriftReport, type SavedPlan } from '@/lib/data/portfolioBuilder'
import { actualWeightsFromTracked } from '@/lib/data/trackedPortfolioViews'
import { valueLedger } from '@/lib/data/tradeLedger'
import { trackedApi } from '@/lib/api/trackedPortfolios'
import { fetchInstrumentPrices } from '@/lib/api/instrumentPrices'
import { attributionText } from '@/lib/data/dataSources'
import type { Portfolio } from '@/lib/data/portfolioUtils'
import {
  PLAN_REMINDER_POLL_MS, PLAN_REMINDER_STORAGE_KEY, planReminderDue, planReminderMessage, reminderDay,
} from '@/lib/data/planReminders'

// Client-side rebalance-reminder monitor (T-116, D237). While the app is open it
// checks, a few times a day, each saved builder plan that is LINKED to a
// portfolio — what-if or tracked — by running the same checkDrift the Plan
// Monitor page runs on the same inputs, and shows one toast/notification per
// plan per day when the plan's own band is breached. Rules and wording are pure
// in lib/data/planReminders.ts. Signed-out local-denied or no-database setups
// answer the plans route with an error status, and the monitor stays idle —
// the feature is dark exactly where plans themselves are.

function readReminded(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PLAN_REMINDER_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function recordReminded(planId: string, day: string): void {
  try {
    localStorage.setItem(PLAN_REMINDER_STORAGE_KEY, JSON.stringify({ ...readReminded(), [planId]: day }))
  } catch {
    // Browser storage can be unavailable (private windows); the worst case is a
    // second reminder, never a missing page figure.
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** A crypto leg prices through /live-data/portfolio-prices (CoinGecko); securities are `sec:`-keyed. */
const anyCrypto = (keys: readonly string[]) => keys.some((k) => !k.startsWith('sec:'))

interface DriftRead {
  drift: DriftReport
  /** Whether CoinGecko prices went into the weights — the message then carries the credit (T-424). */
  cryptoPriced: boolean
}

/** The linked portfolio's drift against the plan, by live value — or null where it cannot be read. */
async function driftFor(plan: SavedPlan, whatIf: Portfolio[], trackedIds: ReadonlySet<string>): Promise<DriftRead | null> {
  const linked = plan.linkedPortfolioId
  if (!linked) return null
  const portfolio = whatIf.find((p) => p.id === linked)
  if (portfolio) {
    if (portfolio.holdings.length === 0) return null
    const keys = portfolio.holdings.map((h) => h.cgId)
    const priced = await fetchInstrumentPrices(keys)
    const actual = actualWeightsFromPortfolio(portfolio, priced.prices)
    if (Object.keys(actual.weights).length === 0) return null
    return { drift: checkDrift(plan.plan, actual.weights, actual.valueUsd), cryptoPriced: anyCrypto(keys) }
  }
  if (trackedIds.has(linked)) {
    const ledger = await trackedApi.ledger(linked)
    const held = ledger.view.holdings.filter((h) => h.basis.quantityHeld !== '0').map((h) => h.instrumentKey).sort()
    const priced = held.length > 0 ? await fetchInstrumentPrices(held) : { prices: {} as Record<string, number> }
    const actual = actualWeightsFromTracked(valueLedger(ledger.view, priced.prices).holdings)
    if (Object.keys(actual.weights).length === 0) return null
    return { drift: checkDrift(plan.plan, actual.weights, actual.valueUsd), cryptoPriced: anyCrypto(held) }
  }
  return null
}

export function usePlanReminderMonitor() {
  const checking = useRef(false)

  useEffect(() => {
    const check = async () => {
      if (checking.current) return
      checking.current = true
      try {
        const res = await fetchJson<{ ok: boolean; plans?: SavedPlan[] }>('/api/user/builder-plans')
        const now = new Date()
        const reminded = readReminded()
        // Only plans linked to a portfolio can be monitored (D237), and a plan
        // already reminded today costs no further request.
        const due = (res?.plans ?? []).filter(
          (p) => p.linkedPortfolioId && reminded[p.id] !== reminderDay(now),
        )
        if (due.length === 0) return

        const portfoliosRes = await fetchJson<{ ok: boolean; portfolios?: Portfolio[] }>('/api/user/portfolios')
        const whatIf = portfoliosRes?.portfolios ?? []
        const tracked = await trackedApi.list().catch(() => [])
        const trackedIds = new Set(tracked.map((t) => t.id))

        for (const plan of due) {
          try {
            const read = await driftFor(plan, whatIf, trackedIds)
            if (!planReminderDue(read?.drift ?? null, reminded[plan.id], now)) continue
            // A toast renders no SourceLine, so the message carries CoinGecko's required
            // credit itself whenever a crypto leg was priced into the weights (T-424).
            const credit = read!.cryptoPriced ? attributionText('portfolio-prices') : null
            const message = planReminderMessage(plan.name, read!.drift, plan.plan.driftBandPct, credit)
            toast(message, { icon: '📋', duration: 12_000 })
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try { new Notification('Finance Now plan check', { body: message }) } catch { /* blocked */ }
            }
            recordReminded(plan.id, reminderDay(now))
          } catch {
            // One plan's failed read never blocks the next plan's reminder.
          }
        }
      } finally {
        checking.current = false
      }
    }

    check()
    const interval = setInterval(check, PLAN_REMINDER_POLL_MS)
    return () => clearInterval(interval)
  }, [])
}
