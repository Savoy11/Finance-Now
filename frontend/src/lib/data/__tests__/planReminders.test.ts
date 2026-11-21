import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FEATURE_NOTICES } from '@/lib/legal/featureNotices'
import {
  PLAN_REMINDER_POLL_MS, planReminderDue, planReminderMessage, reminderDay, type ReminderDrift,
} from '../planReminders'

// T-116 (D237, 2026-11-21): in-app rebalance reminders for saved builder plans.
// What is held here: a reminder fires only on the plan's own band breach, at most
// once a day; its words state the breach and where to look, carry the Builder's
// not-advice line, and never a trade list or an instruction — counsel brief A15
// reviews the advice-adjacency question before launch, and the reminder must
// have nothing sharper than the fact.

const NOW = new Date('2026-11-21T15:00:00Z')
const breach: ReminderDrift = { rebalanceDue: true, maxDriftPts: 5.2 }
const within: ReminderDrift = { rebalanceDue: false, maxDriftPts: 2.1 }

describe('when a reminder is due', () => {
  it('fires on a breach that has not reminded today', () => {
    expect(planReminderDue(breach, undefined, NOW)).toBe(true)
    expect(planReminderDue(breach, '2026-11-20', NOW)).toBe(true)
  })
  it('never fires inside the band, without a drift reading, or twice in a day', () => {
    expect(planReminderDue(within, undefined, NOW)).toBe(false)
    expect(planReminderDue(null, undefined, NOW)).toBe(false)
    expect(planReminderDue(breach, reminderDay(NOW), NOW)).toBe(false)
  })
  it('counts days in UTC, so the dedup key is deterministic', () => {
    expect(reminderDay(NOW)).toBe('2026-11-21')
    expect(reminderDay(new Date('2026-11-21T23:59:59Z'))).toBe('2026-11-21')
  })
})

describe('what a reminder says', () => {
  const message = planReminderMessage('Retirement 2040', breach, 3)

  it('states the plan, its band and the largest drift, and where the details are', () => {
    expect(message).toContain('"Retirement 2040"')
    expect(message).toContain('3% band')
    expect(message).toContain('5.2 points')
    expect(message).toContain('Portfolio Builder page')
  })
  it('carries the Builder’s not-advice line (D237)', () => {
    expect(message).toContain(FEATURE_NOTICES.portfolioBuilder)
  })
  it('carries the price source’s credit when one is owed, and nothing when not (T-424)', () => {
    expect(planReminderMessage('P', breach, 3, 'Powered by CoinGecko')).toMatch(/· Powered by CoinGecko$/)
    expect(planReminderMessage('P', breach, 3, null)).not.toContain('·')
  })
  it('carries no trade list and no instruction — the A15 edge stays off the reminder', () => {
    expect(message).not.toMatch(/\b(buy|sell|trade|should)\b/i)
    expect(message).not.toMatch(/\$\d/)
  })
})

describe('the monitor’s wiring', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

  it('is mounted app-wide beside the price alerts', () => {
    expect(read('src/app/(dashboard)/layout.tsx')).toContain('usePlanReminderMonitor()')
  })
  it('monitors only linked plans, dedups by day, and reads drift through checkDrift', () => {
    const hook = read('src/hooks/usePlanReminderMonitor.ts')
    expect(hook).toContain('p.linkedPortfolioId && reminded[p.id] !== reminderDay(now)')
    expect(hook).toContain('checkDrift(plan.plan, actual.weights, actual.valueUsd)')
    expect(hook).toMatch(/planReminderDue\(read\?\.drift \?\? null, reminded\[plan\.id\], now\)/)
  })
  it('checks a few times a day, not every minute — drift is not a price', () => {
    expect(PLAN_REMINDER_POLL_MS).toBeGreaterThanOrEqual(3_600_000)
  })
})
