import { describe, expect, it } from 'vitest'
import { buildPortfolio, checkDrift, type BuilderInputs } from '../portfolioBuilder'
import { buildRebalanceNotes } from '../rebalanceNotes'

/**
 * T-066 (D56, 2026-10-04). The printed notes restate the drift table, so the
 * figures must agree with it exactly, and the words must stay arithmetic.
 */

const inputs: BuilderInputs = {
  riskTolerance: 5, yearsToRetirement: 25, yearsToFirstUse: 25,
  sectorFocus: [], sectorExclude: [], cryptoComfort: 'none', amount: 100_000,
}
const plan = buildPortfolio(inputs)
const AT = new Date('2026-10-04T15:30:00Z')

/** Actual weights with the largest holding pushed `pts` over target, taken from the smallest. */
function skewed(pts: number) {
  const byWeight = [...plan.holdings].sort((a, b) => b.weightPct - a.weightPct)
  const top = byWeight[0], bottom = byWeight[byWeight.length - 1]
  const w: Record<string, number> = Object.fromEntries(plan.holdings.map((h) => [h.symbol, h.weightPct]))
  w[top.symbol] += pts
  w[bottom.symbol] -= Math.min(pts, bottom.weightPct)
  return { w, top: top.symbol, bottom: bottom.symbol }
}

const notesFor = (weights: Record<string, number>, over: Partial<Parameters<typeof buildRebalanceNotes>[0]> = {}) =>
  buildRebalanceNotes({
    planName: 'Retirement core', drift: checkDrift(plan, weights, 250_000), portfolioName: 'Brokerage',
    valueUsd: 250_000, pricedPct: 100, bandPct: plan.driftBandPct, preparedAt: AT, ...over,
  })

describe('rebalance notes restate the drift check', () => {
  it('carries one row per plan holding, in the plan’s order, with the same figures', () => {
    const { w } = skewed(plan.driftBandPct + 3)
    const drift = checkDrift(plan, w, 250_000)
    const notes = notesFor(w)
    expect(notes.rows.map((r) => r.symbol)).toEqual(drift.items.map((i) => i.symbol))
    for (const [k, row] of notes.rows.entries()) {
      const item = drift.items[k]
      expect(row).toMatchObject({ targetPct: item.targetPct, currentPct: item.currentPct, driftPts: item.driftPts, action: item.action })
    }
  })

  it('prints a trade only outside the band, and the buys and sells add up to the turnover', () => {
    const { w, top } = skewed(plan.driftBandPct + 3)
    const notes = notesFor(w)
    expect(notes.rows.find((r) => r.symbol === top)!.action).toBe('sell')
    for (const r of notes.rows.filter((x) => x.action === 'hold')) expect(r.tradeUsd).toBe(0)
    expect(notes.tradeCount).toBe(notes.rows.filter((r) => r.action !== 'hold').length)
    expect(notes.buysUsd + notes.sellsUsd).toBe(notes.turnoverUsd)
    expect(notes.sellsUsd).toBeGreaterThan(0)
  })

  it('says plainly when nothing is outside its band', () => {
    const onTarget = Object.fromEntries(plan.holdings.map((h) => [h.symbol, h.weightPct]))
    const notes = notesFor(onTarget)
    expect(notes.tradeCount).toBe(0)
    expect(notes.turnoverUsd).toBe(0)
    expect(notes.note).toMatch(/no trade is shown/)
  })

  it('names what was compared, and lists holdings the plan does not call for', () => {
    const { w } = skewed(0)
    expect(notesFor(w).comparedWith).toBe('Portfolio “Brokerage”')
    expect(notesFor(w, { portfolioName: null }).comparedWith).toBe('Weights entered by hand')
    const notes = notesFor({ ...w, XYZ: 4 })
    expect(notes.unplanned).toEqual([{ symbol: 'XYZ', currentPct: 4 }])
  })

  it('keeps the date it was prepared, so a printout says when its figures held', () => {
    expect(notesFor(skewed(0).w).preparedAt).toBe('2026-10-04T15:30:00.000Z')
  })
})

describe('the printed words are arithmetic, not advice', () => {
  const both = [notesFor(skewed(plan.driftBandPct + 3).w), notesFor(skewed(0).w)]

  it('says it is not a recommendation, whether or not there are trades', () => {
    for (const n of both) expect(n.note).toMatch(/not a recommendation to buy or sell/)
  })

  it('never tells the reader what to do', () => {
    for (const n of both) expect(n.note).not.toMatch(/\byou should\b|\bwe recommend\b|\bwe suggest\b|\bconsider (buying|selling)\b/i)
  })

  it('names the band it measured against', () => {
    for (const n of both) expect(n.note).toContain(`±${plan.driftBandPct}%`)
  })
})
