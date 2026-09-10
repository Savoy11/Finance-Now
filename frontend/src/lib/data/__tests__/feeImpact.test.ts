import { describe, it, expect } from 'vitest'
import { feeImpact, DEFAULT_FEE_IMPACT_PARAMS } from '../feeImpact'
import { computeFeeDrag, FUND_CATALOG } from '../fundCatalog'

const P = DEFAULT_FEE_IMPACT_PARAMS

describe('feeImpact', () => {
  it('agrees exactly with the detail-page analyzer — one engine, one answer', () => {
    const impact = feeImpact({ expenseRatioPct: 0.75, type: 'etf', issuer: 'X' }, P)!
    const drag = computeFeeDrag(P.principal, 0.75, P.years, P.annualReturnPct).at(-1)!
    expect(impact.costUsd).toBe(drag.feesPaid)
    expect(impact.endValueUsd).toBe(drag.withFee)
  })

  it('returns null for a fund with no expense ratio — unknown must never sort as free', () => {
    expect(feeImpact({ expenseRatioPct: null as unknown as number, type: 'etf', issuer: '' }, P)).toBeNull()
    expect(feeImpact(null, P)).toBeNull()
  })

  it('a cheaper-than-benchmark fund shows a negative cost (a saving), not zero', () => {
    const impact = feeImpact({ expenseRatioPct: 0.015, type: 'mutual', issuer: 'Fidelity' }, P)!
    expect(impact.costUsd).toBeLessThan(0)
  })

  it('flags an UNVERIFIED load and leaves it out of the maths', () => {
    // AGTHX's real state: Capital Group front load exists, rate not verified.
    const withFlag = feeImpact({ expenseRatioPct: 0.59, type: 'mutual', issuer: 'Capital Group' }, P)!
    const noLoad = feeImpact({ expenseRatioPct: 0.59, type: 'mutual', issuer: 'Vanguard' }, P)!
    expect(withFlag.unverifiedLoad).toBe(true)
    expect(withFlag.includesLoad).toBe(false)
    // Same number as a no-load fund — the honesty lives in the flag, not a guess.
    expect(withFlag.costUsd).toBe(noLoad.costUsd)
    expect(noLoad.unverifiedLoad).toBe(false)
  })

  it('includes a VERIFIED front load in the cost, and says so', () => {
    const base = { expenseRatioPct: 0.59, type: 'mutual' as const, issuer: 'Capital Group' }
    const verified = feeImpact({
      ...base,
      salesCharge: { kind: 'front', maxPct: 5.75, source: 'prospectus', verifiedAt: '2026-09-05' },
    }, P)!
    const unverified = feeImpact(base, P)!
    expect(verified.includesLoad).toBe(true)
    expect(verified.unverifiedLoad).toBe(false)
    expect(verified.costUsd).toBeGreaterThan(unverified.costUsd)
  })

  it('rejects nonsense params rather than computing nonsense dollars', () => {
    const f = { expenseRatioPct: 0.5, type: 'etf' as const, issuer: 'X' }
    expect(feeImpact(f, { ...P, principal: 0 })).toBeNull()
    expect(feeImpact(f, { ...P, years: 0 })).toBeNull()
    expect(feeImpact(f, { ...P, years: 2.5 })).toBeNull()
    expect(feeImpact(f, { ...P, annualReturnPct: -1 })).toBeNull()
  })

  // A verified load landed on 2026-09-10 (AGTHX, 5.75% front, read from the SEC
  // Risk/Return Summary for 2025q4). The previous version of this test asserted
  // cost order == expense-ratio order across the WHOLE catalog and said, in as
  // many words, "if this ever fails, either a verified load landed (fine —
  // update this test to say so) or the maths broke". One landed. This says so.
  it('still orders by expense ratio for every fund with NO verified load', () => {
    // The monotonicity claim is still the real guard against broken maths; it
    // just no longer applies to a fund whose cost includes a one-off charge.
    const funds = FUND_CATALOG.filter(
      (f) => f.expenseRatioPct != null && !feeImpact(f, P)!.includesLoad,
    )
    const byEr = [...funds].sort((a, b) => a.expenseRatioPct - b.expenseRatioPct).map((f) => f.symbol)
    const byCost = [...funds]
      .sort((a, b) => feeImpact(a, P)!.costUsd - feeImpact(b, P)!.costUsd)
      .map((f) => f.symbol)
    expect(byCost).toEqual(byEr)
  })

  it('ranks a load-bearing fund WORSE by cost than its expense ratio alone implies', () => {
    // The point of pricing the load: AGTHX's 0.59% ER is unremarkable, and its
    // true cost to a Class A buyer is not. If the load stopped reaching the
    // maths, this fund would slide back among its ER peers and nothing else
    // would complain.
    const priced = FUND_CATALOG.filter((f) => feeImpact(f, P)!.includesLoad)
    expect(priced.length, 'no fund prices a load — did a verified rate get dropped?').toBeGreaterThan(0)

    for (const f of priced) {
      const erRank = [...FUND_CATALOG]
        .filter((x) => x.expenseRatioPct != null)
        .sort((a, b) => a.expenseRatioPct - b.expenseRatioPct)
        .findIndex((x) => x.symbol === f.symbol)
      const costRank = [...FUND_CATALOG]
        .filter((x) => x.expenseRatioPct != null)
        .sort((a, b) => feeImpact(a, P)!.costUsd - feeImpact(b, P)!.costUsd)
        .findIndex((x) => x.symbol === f.symbol)
      expect(costRank, `${f.symbol} should rank costlier once its load is priced`).toBeGreaterThan(erRank)
    }
  })
})
