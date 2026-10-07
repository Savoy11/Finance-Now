// ─── Plan history (T-065) ────────────────────────────────────────────────────
//
// A saved check is a snapshot of one drift check: what the plan was compared
// against, at what value, and how far each holding sat from its target. Saving
// one is the user's choice (a button in the drift monitor), never a side effect
// of opening the panel, so the history holds the checks someone meant to keep.
//
// It describes the user's own plan over time: how far it drifted, and when it
// came back within its bands. It ranks nothing and scores nothing. The S5 charter
// calls it the honest version of NT10, the risk-score history RP-4 rejected: the
// user's own plan, not market scores.
//
// Pure, so the server's validation and the history's comparisons are tested
// (__tests__/planHistory.test.ts). The API route stores what parsePlanSnapshot
// returns and nothing else.

import type { DriftReport } from './portfolioBuilder'

export const PLAN_SNAPSHOT_VERSION = 1

/** The most saved checks one plan keeps. Saving past it is refused; nothing is ever removed to make room. */
export const MAX_SAVED_CHECKS_PER_PLAN = 500

export interface PlanSnapshotItem {
  symbol: string
  targetPct: number
  currentPct: number
  driftPts: number
  action: 'buy' | 'sell' | 'hold'
  /** Dollars to trade back to target at the value checked: positive buys, negative sells. */
  tradeUsd: number
}

export interface PlanSnapshot {
  v: typeof PLAN_SNAPSHOT_VERSION
  /** The portfolio the plan was compared against, or null for weights entered by hand. */
  portfolioName: string | null
  valueUsd: number
  /** Share of the portfolio that could be valued; 100 for hand-entered weights. */
  pricedPct: number
  bandPct: number
  items: PlanSnapshotItem[]
  unplanned: Array<{ symbol: string; currentPct: number }>
  /** The three summaries below are always recomputed from `items`, never taken on trust. */
  maxDriftPts: number
  rebalanceDue: boolean
  turnoverUsd: number
}

/** A saved check as the API returns it. */
export interface SavedCheck {
  id: string
  capturedAt: string
  snapshot: PlanSnapshot
}

export function snapshotFromDrift(
  drift: DriftReport,
  ctx: { portfolioName: string | null; valueUsd: number; pricedPct: number; bandPct: number },
): PlanSnapshot {
  return withSummaries({
    v: PLAN_SNAPSHOT_VERSION,
    portfolioName: ctx.portfolioName,
    valueUsd: ctx.valueUsd,
    pricedPct: ctx.pricedPct,
    bandPct: ctx.bandPct,
    items: drift.items.map((i) => ({
      symbol: i.symbol, targetPct: i.targetPct, currentPct: i.currentPct,
      // checkDrift rounds a zero drift's trade to -0, which JSON cannot carry.
      driftPts: i.driftPts, action: i.action, tradeUsd: i.tradeUsd === 0 ? 0 : i.tradeUsd,
    })),
    unplanned: drift.unplanned.map((u) => ({ symbol: u.symbol, currentPct: u.currentPct })),
  })
}

/** The same summaries checkDrift computes, from the items alone. */
function withSummaries(s: Omit<PlanSnapshot, 'maxDriftPts' | 'rebalanceDue' | 'turnoverUsd'>): PlanSnapshot {
  const moving = s.items.filter((i) => i.action !== 'hold')
  return {
    ...s,
    maxDriftPts: s.items.reduce((m, i) => Math.max(m, Math.abs(i.driftPts)), 0),
    rebalanceDue: moving.length > 0,
    turnoverUsd: moving.reduce((sum, i) => sum + Math.abs(i.tradeUsd), 0),
  }
}

const MAX_ITEMS = 200
const MAX_NAME = 120
const MAX_SYMBOL = 32
const MAX_USD = 1e12
const ACTIONS = new Set(['buy', 'sell', 'hold'])

const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

function cleanSymbol(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  // No control characters: a symbol is printed and compared, never interpreted.
  return s.length > 0 && s.length <= MAX_SYMBOL && !/[\u0000-\u001f\u007f]/.test(s) ? s : null
}

/**
 * Validate a snapshot sent by the browser and rebuild it from the fields this
 * module knows, so nothing else is stored. Returns null for anything malformed:
 * a wrong version, a missing or out-of-range number, an unknown action, too many
 * rows. The summaries are recomputed from the items rather than read.
 */
export function parsePlanSnapshot(input: unknown): PlanSnapshot | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const o = input as Record<string, unknown>
  if (o.v !== PLAN_SNAPSHOT_VERSION) return null

  let portfolioName: string | null = null
  if (o.portfolioName !== null) {
    if (typeof o.portfolioName !== 'string') return null
    portfolioName = o.portfolioName.trim()
    if (!portfolioName || portfolioName.length > MAX_NAME) return null
  }
  if (!isNum(o.valueUsd, 0, MAX_USD) || !isNum(o.pricedPct, 0, 100) || !isNum(o.bandPct, 0, 100) || o.bandPct === 0) return null

  if (!Array.isArray(o.items) || o.items.length === 0 || o.items.length > MAX_ITEMS) return null
  const items: PlanSnapshotItem[] = []
  for (const raw of o.items) {
    if (!raw || typeof raw !== 'object') return null
    const i = raw as Record<string, unknown>
    const symbol = cleanSymbol(i.symbol)
    if (!symbol) return null
    if (!isNum(i.targetPct, 0, 100) || !isNum(i.currentPct, 0, 1000) || !isNum(i.driftPts, -1000, 1000)) return null
    if (typeof i.action !== 'string' || !ACTIONS.has(i.action) || !isNum(i.tradeUsd, -MAX_USD, MAX_USD)) return null
    items.push({
      symbol, targetPct: i.targetPct, currentPct: i.currentPct, driftPts: i.driftPts,
      action: i.action as PlanSnapshotItem['action'], tradeUsd: i.tradeUsd,
    })
  }

  if (!Array.isArray(o.unplanned) || o.unplanned.length > MAX_ITEMS) return null
  const unplanned: PlanSnapshot['unplanned'] = []
  for (const raw of o.unplanned) {
    if (!raw || typeof raw !== 'object') return null
    const u = raw as Record<string, unknown>
    const symbol = cleanSymbol(u.symbol)
    if (!symbol || !isNum(u.currentPct, 0, 1000)) return null
    unplanned.push({ symbol, currentPct: u.currentPct })
  }

  return withSummaries({
    v: PLAN_SNAPSHOT_VERSION, portfolioName, valueUsd: o.valueUsd, pricedPct: o.pricedPct,
    bandPct: o.bandPct, items, unplanned,
  })
}

export interface HistoryEntry extends SavedCheck {
  /** Within its bands at this check, after the check before it found a rebalance due. */
  backWithinBands: boolean
  /** Change in the largest drift since the check before, in points; null for the first check. */
  maxDriftChangePts: number | null
}

/**
 * Saved checks, newest first, each compared with the one saved before it. The
 * comparison is between two of the user's own checks; it says what changed, not
 * what to do about it.
 */
export function planHistory(checks: SavedCheck[]): HistoryEntry[] {
  const sorted = [...checks].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  return sorted.map((c, k) => {
    const before = sorted[k + 1]
    return {
      ...c,
      backWithinBands: !!before && before.snapshot.rebalanceDue && !c.snapshot.rebalanceDue,
      maxDriftChangePts: before ? Math.round((c.snapshot.maxDriftPts - before.snapshot.maxDriftPts) * 10) / 10 : null,
    }
  })
}
