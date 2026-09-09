import { describe, it, expect } from 'vitest'
import { feeCostDisplay } from '../feeImpact'
import { FUND_CATALOG } from '../fundCatalog'
import { feeImpact, DEFAULT_FEE_IMPACT_PARAMS } from '../feeImpact'

describe('feeCostDisplay', () => {
  it('shows a real cost with a minus', () => {
    expect(feeCostDisplay(4088)).toEqual({ kind: 'cost', sign: '−', abs: 4088 })
  })

  it('shows a real saving with a plus', () => {
    expect(feeCostDisplay(-116)).toEqual({ kind: 'saving', sign: '+', abs: 116 })
  })

  // The bug this function exists for: a fund charging exactly the benchmark
  // rate costs exactly nothing, and the old rule printed "−$0".
  it('shows an exactly-zero cost unsigned, not as a negative zero', () => {
    expect(feeCostDisplay(0)).toEqual({ kind: 'none', sign: '', abs: 0 })
  })

  it('shows a sub-dollar figure unsigned, because the sign would be invisible', () => {
    expect(feeCostDisplay(0.4).kind).toBe('none')
    expect(feeCostDisplay(-0.4).kind).toBe('none')
    expect(feeCostDisplay(0.6).kind).toBe('cost')
    expect(feeCostDisplay(-0.6).kind).toBe('saving')
  })

  it('respects the caller decimals, so a cent-precision surface keeps its sign', () => {
    expect(feeCostDisplay(0.4, 2).kind).toBe('cost')
    expect(feeCostDisplay(0.004, 2).kind).toBe('none')
  })

  // Ties the rule to the real catalog rather than to invented numbers: whatever
  // funds sit exactly on the benchmark must not render a signed zero.
  it('renders every catalog fund priced at the benchmark as neither cost nor saving', () => {
    const atBenchmark = FUND_CATALOG.filter((f) => f.expenseRatioPct === 0.03)
    expect(atBenchmark.length).toBeGreaterThan(0)
    for (const f of atBenchmark) {
      const impact = feeImpact(f, DEFAULT_FEE_IMPACT_PARAMS)!
      expect(feeCostDisplay(impact.costUsd).kind, f.symbol).toBe('none')
    }
  })
})
