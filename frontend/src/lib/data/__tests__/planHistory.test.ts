import { describe, expect, it } from 'vitest'
import { buildPortfolio, checkDrift, type BuilderInputs } from '../portfolioBuilder'
import {
  parsePlanSnapshot, planHistory, snapshotFromDrift,
  type PlanSnapshot, type SavedCheck,
} from '../planHistory'

/**
 * T-065 (D56, 2026-10-04). A saved check is a snapshot of one drift check. The
 * server stores only what parsePlanSnapshot returns, so these pin what it lets
 * through, what it refuses, and that its summaries cannot disagree with its rows.
 */

const inputs: BuilderInputs = {
  riskTolerance: 5, yearsToRetirement: 25, yearsToFirstUse: 25,
  sectorFocus: [], sectorExclude: [], cryptoComfort: 'none', amount: 100_000,
}
const plan = buildPortfolio(inputs)
const ctx = { portfolioName: 'Brokerage', valueUsd: 120_000, pricedPct: 100, bandPct: plan.driftBandPct }

function weights(overPts: number) {
  const byWeight = [...plan.holdings].sort((a, b) => b.weightPct - a.weightPct)
  const w: Record<string, number> = Object.fromEntries(plan.holdings.map((h) => [h.symbol, h.weightPct]))
  w[byWeight[0].symbol] += overPts
  w[byWeight[byWeight.length - 1].symbol] -= Math.min(overPts, byWeight[byWeight.length - 1].weightPct)
  return w
}
const snap = (overPts: number) => snapshotFromDrift(checkDrift(plan, weights(overPts), ctx.valueUsd), ctx)

describe('snapshotFromDrift', () => {
  it('keeps the drift check’s figures, row for row, and its summaries', () => {
    const drift = checkDrift(plan, weights(plan.driftBandPct + 2), ctx.valueUsd)
    const s = snapshotFromDrift(drift, ctx)
    // The same rows minus the display name, with checkDrift's -0 for an exact hold stored as 0.
    expect(s.items).toEqual(drift.items.map(({ name: _name, ...rest }) => ({ ...rest, tradeUsd: rest.tradeUsd === 0 ? 0 : rest.tradeUsd })))
    expect(s).toMatchObject({ maxDriftPts: drift.maxDriftPts, rebalanceDue: drift.rebalanceDue, turnoverUsd: drift.turnoverUsd })
    expect(s.portfolioName).toBe('Brokerage')
  })
})

describe('parsePlanSnapshot — what the server will store', () => {
  it('round-trips a snapshot built from a real drift check', () => {
    const s = snap(plan.driftBandPct + 2)
    expect(parsePlanSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s)
    const manual = snapshotFromDrift(checkDrift(plan, weights(0)), { ...ctx, portfolioName: null })
    expect(parsePlanSnapshot(manual)).toEqual(manual)
  })

  it('recomputes the summaries instead of trusting them', () => {
    const s = snap(plan.driftBandPct + 2)
    const lying = { ...s, maxDriftPts: 0, rebalanceDue: false, turnoverUsd: 0 }
    expect(parsePlanSnapshot(lying)).toMatchObject({
      maxDriftPts: s.maxDriftPts, rebalanceDue: true, turnoverUsd: s.turnoverUsd,
    })
  })

  it('stores only the fields it knows', () => {
    const extra = { ...snap(0), note: 'x'.repeat(10_000), items: snap(0).items.map((i) => ({ ...i, html: '<b>' })) }
    const parsed = parsePlanSnapshot(extra)!
    expect(parsed).not.toHaveProperty('note')
    expect(parsed.items[0]).not.toHaveProperty('html')
  })

  const bad: Array<[string, (s: PlanSnapshot) => unknown]> = [
    ['a wrong version', (s) => ({ ...s, v: 2 })],
    ['no rows', (s) => ({ ...s, items: [] })],
    ['too many rows', (s) => ({ ...s, items: Array.from({ length: 201 }, () => s.items[0]) })],
    ['an unknown action', (s) => ({ ...s, items: [{ ...s.items[0], action: 'short' }] })],
    ['a non-finite number', (s) => ({ ...s, valueUsd: Number.NaN })],
    ['a negative value', (s) => ({ ...s, valueUsd: -1 })],
    ['a priced share over 100', (s) => ({ ...s, pricedPct: 101 })],
    ['a zero band', (s) => ({ ...s, bandPct: 0 })],
    ['a target weight over 100', (s) => ({ ...s, items: [{ ...s.items[0], targetPct: 120 }] })],
    ['a blank symbol', (s) => ({ ...s, items: [{ ...s.items[0], symbol: '   ' }] })],
    ['a control character in a symbol', (s) => ({ ...s, items: [{ ...s.items[0], symbol: 'VT\u0007' }] })],
    ['an over-long portfolio name', (s) => ({ ...s, portfolioName: 'x'.repeat(121) })],
    ['a portfolio name that is not text', (s) => ({ ...s, portfolioName: 42 })],
    ['an unplanned list that is not a list', (s) => ({ ...s, unplanned: 'VTI' })],
  ]
  it.each(bad)('refuses %s', (_label, mutate) => {
    expect(parsePlanSnapshot(mutate(snap(plan.driftBandPct + 2)))).toBeNull()
  })

  it('refuses anything that is not a snapshot object', () => {
    for (const v of [null, undefined, 'snapshot', 3, [], [snap(0)]]) expect(parsePlanSnapshot(v)).toBeNull()
  })
})

describe('planHistory — each saved check compared with the one before', () => {
  const check = (id: string, at: string, s: PlanSnapshot): SavedCheck => ({ id, capturedAt: at, snapshot: s })
  const due = snap(plan.driftBandPct + 3)
  const within = snap(0)

  it('orders newest first, whatever order the checks arrive in', () => {
    const h = planHistory([
      check('a', '2026-08-01T10:00:00.000Z', within),
      check('c', '2026-10-01T10:00:00.000Z', within),
      check('b', '2026-09-01T10:00:00.000Z', due),
    ])
    expect(h.map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('marks a check back within its bands only after one that found a rebalance due', () => {
    const h = planHistory([
      check('a', '2026-08-01T10:00:00.000Z', within),
      check('b', '2026-09-01T10:00:00.000Z', due),
      check('c', '2026-10-01T10:00:00.000Z', within),
    ])
    expect(h.find((e) => e.id === 'c')!.backWithinBands).toBe(true)
    expect(h.find((e) => e.id === 'b')!.backWithinBands).toBe(false)
    expect(h.find((e) => e.id === 'a')!.backWithinBands).toBe(false)
  })

  it('reports the change in the largest drift, and nothing for the first check', () => {
    const h = planHistory([
      check('a', '2026-08-01T10:00:00.000Z', within),
      check('b', '2026-09-01T10:00:00.000Z', due),
    ])
    expect(h[1].maxDriftChangePts).toBeNull()
    expect(h[0].maxDriftChangePts).toBe(Math.round((due.maxDriftPts - within.maxDriftPts) * 10) / 10)
  })
})
