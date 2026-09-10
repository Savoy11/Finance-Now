import { describe, it, expect } from 'vitest'
import {
  computeFeeDrag, fundSalesCharge, fundTradingRestriction, getFundDataProvenance, fundDataAgeDays, fundDataIsStale,
  FUND_DATA_LAST_VERIFIED, FUND_DATA_STALE_AFTER_DAYS, FUND_CATALOG,
} from '../fundCatalog'

// W4-C9: computeFeeDrag drives a 30-year dollar projection on every fund detail
// page and had no tests. W4-C7: the expense ratios it runs on are hand-maintained
// and had no provenance machinery.

const VERIFIED = new Date(FUND_DATA_LAST_VERIFIED)
const daysAfter = (n: number) => new Date(VERIFIED.getTime() + n * 86_400_000)

describe('computeFeeDrag', () => {
  it('returns one point per year', () => {
    expect(computeFeeDrag(10_000, 0.5, 30)).toHaveLength(30)
    expect(computeFeeDrag(10_000, 0.5, 1)).toHaveLength(1)
  })

  it('returns nothing for a zero-year horizon', () => {
    expect(computeFeeDrag(10_000, 0.5, 0)).toEqual([])
  })

  it('compounds one year correctly against the benchmark', () => {
    // 10,000 × 1.07 × (1 − 0.01) = 10,593 with a 1% ER.
    // 10,000 × 1.07 × (1 − 0.0003) = 10,696.79 at the 0.03% benchmark.
    const [year1] = computeFeeDrag(10_000, 1, 1, 7, 0.03)
    expect(year1.year).toBe(1)
    expect(year1.withFee).toBe(10_593)
    expect(year1.withBenchmarkFee).toBe(10_697)
    expect(year1.feesPaid).toBe(104)
  })

  it('charges no drag when the fund matches the benchmark', () => {
    const series = computeFeeDrag(10_000, 0.03, 30, 7, 0.03)
    for (const p of series) {
      expect(p.feesPaid).toBe(0)
      expect(p.withFee).toBe(p.withBenchmarkFee)
    }
  })

  it('compounds the gap — drag grows faster than linearly', () => {
    const series = computeFeeDrag(10_000, 0.75, 30)
    const y10 = series[9].feesPaid
    const y20 = series[19].feesPaid
    const y30 = series[29].feesPaid
    expect(y20).toBeGreaterThan(y10 * 2)
    expect(y30).toBeGreaterThan(y20 * 1.5)
  })

  it('grows the balance monotonically at a positive return', () => {
    const series = computeFeeDrag(10_000, 0.5, 20, 7)
    for (let i = 1; i < series.length; i++) {
      expect(series[i].withFee).toBeGreaterThan(series[i - 1].withFee)
    }
  })

  it('still charges drag when the gross return is zero', () => {
    // The fee comes off the balance regardless of performance — a cheaper fund
    // simply loses less. Presenting no drag in a flat market would be wrong.
    const series = computeFeeDrag(10_000, 1, 10, 0)
    expect(series[9].withFee).toBeLessThan(10_000)
    expect(series[9].feesPaid).toBeGreaterThan(0)
  })

  it('handles a zero principal without producing NaN', () => {
    for (const p of computeFeeDrag(0, 0.5, 10)) {
      expect(p.withFee).toBe(0)
      expect(p.feesPaid).toBe(0)
    }
  })

  it('is defined for every fund in the catalog', () => {
    for (const fund of FUND_CATALOG) {
      const series = computeFeeDrag(10_000, fund.expenseRatioPct, 30)
      const final = series[series.length - 1]
      expect(Number.isFinite(final.withFee)).toBe(true)
      expect(Number.isFinite(final.feesPaid)).toBe(true)
    }
  })

  it('reports a negative drag for a fund cheaper than the benchmark', () => {
    // FXAIX is 0.015% against a 0.03% benchmark. The sign is correct and
    // meaningful — it is a saving — but the UI used to clamp the amount to zero
    // while keeping the minus sign, rendering "−$0 (−0.3%)". The Fee Drag card
    // now labels this case as a saving instead.
    const cheap = FUND_CATALOG.filter((f) => f.expenseRatioPct < 0.03)
    expect(cheap.length).toBeGreaterThan(0)
    for (const fund of cheap) {
      const series = computeFeeDrag(10_000, fund.expenseRatioPct, 30)
      expect(series[series.length - 1].feesPaid).toBeLessThan(0)
    }
  })
})

describe('fund data provenance', () => {
  it('reports age from the verification date', () => {
    expect(fundDataAgeDays(VERIFIED)).toBe(0)
    expect(fundDataAgeDays(daysAfter(45))).toBe(45)
  })

  it('goes stale only past the window', () => {
    expect(fundDataIsStale(daysAfter(FUND_DATA_STALE_AFTER_DAYS))).toBe(false)
    expect(fundDataIsStale(daysAfter(FUND_DATA_STALE_AFTER_DAYS + 1))).toBe(true)
  })

  it('steps confidence down with age', () => {
    expect(getFundDataProvenance(daysAfter(10)).confidence).toBe('high')
    expect(getFundDataProvenance(daysAfter(60)).confidence).toBe('high')
    expect(getFundDataProvenance(daysAfter(61)).confidence).toBe('medium')
    expect(getFundDataProvenance(daysAfter(FUND_DATA_STALE_AFTER_DAYS)).confidence).toBe('medium')
    expect(getFundDataProvenance(daysAfter(FUND_DATA_STALE_AFTER_DAYS + 1)).confidence).toBe('low')
  })

  it('exposes the shape the ProvenanceNotice renders', () => {
    const p = getFundDataProvenance(daysAfter(30))
    expect(p).toMatchObject({
      verifiedAt: FUND_DATA_LAST_VERIFIED,
      ageDays: 30,
      stale: false,
      confidence: 'high',
    })
    expect(p.source).toMatch(/\S/)
  })

  it('accepts an injectable now, so the notice is testable', () => {
    // The whole point of the pattern: no test may depend on the wall clock.
    expect(getFundDataProvenance(daysAfter(500)).stale).toBe(true)
    expect(getFundDataProvenance(VERIFIED).stale).toBe(false)
  })
})

// ─── Sales charges (loads) ────────────────────────────────────────────────────
// A load is the largest single cost on a fund detail page and, until 2026-09-03,
// the Fee Drag Analyzer modelled only the expense ratio. AGTHX showed a cost of
// 0.59%/yr while a real Class A purchase loses several percent on day one.
describe('fundSalesCharge', () => {
  it('reports no charge for ETFs', () => {
    expect(fundSalesCharge({ type: 'etf', issuer: 'Vanguard' })).toBeNull()
    expect(fundSalesCharge({ type: 'etf', issuer: 'Capital Group' })).toBeNull()
  })

  it('reports no charge for no-load mutual fund families', () => {
    expect(fundSalesCharge({ type: 'mutual', issuer: 'Vanguard' })).toBeNull()
    expect(fundSalesCharge({ type: 'mutual', issuer: 'Fidelity' })).toBeNull()
  })

  it('reports a front load for Capital Group — the issuer string the catalog actually uses', () => {
    // The regression this guards: MUTUAL_FUND_POLICY keyed only on 'American
    // Funds' while AGTHX is filed under issuer 'Capital Group', so the app's
    // only mention of this load never rendered.
    expect(fundSalesCharge({ type: 'mutual', issuer: 'Capital Group' })).toEqual({ kind: 'front' })
  })

  it('reports the charge WITHOUT a rate when none has been verified', () => {
    // Undefined maxPct means "applies, amount unverified" — never "no charge".
    const c = fundSalesCharge({ type: 'mutual', issuer: 'Capital Group' })!
    expect(c.kind).toBe('front')
    expect(c.maxPct).toBeUndefined()
  })

  it('lets a fund-specific charge override the issuer default', () => {
    const c = fundSalesCharge({
      type: 'mutual',
      issuer: 'Capital Group',
      salesCharge: { kind: 'front', maxPct: 3.5, source: 'prospectus', verifiedAt: '2026-09-03' },
    })
    expect(c).toMatchObject({ kind: 'front', maxPct: 3.5 })
  })
})

describe('the AGTHX catalog entry', () => {
  it('is recognised as carrying a front-end load', () => {
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    expect(fundSalesCharge(agthx)).toMatchObject({ kind: 'front' })
  })

  it('mentions the load in its trading restriction text', () => {
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    expect(fundTradingRestriction(agthx)).toMatch(/sales load/i)
  })

  it('carries the VERIFIED front load, read from the filing on 2026-09-10', () => {
    // This test used to assert maxPct was UNDEFINED, guarding the
    // never-from-memory rule while the prospectus was unread. It has now been
    // read — not from memory, and not from a website: the rate comes from the
    // SEC's own Risk/Return Summary dataset for 2025q4, tag
    // MaximumSalesChargeImposedOnPurchasesOverOfferingPrice, on the 485BPOS
    // that Growth Fund of America files every October (CIK 44201, class
    // C000025064). `npm run fund-fees` with RR_QUARTER=2025q4 reproduces it.
    //
    // The rule it guarded is unchanged and still enforced catalog-wide by the
    // next test: a stated rate MUST carry source + verifiedAt.
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    expect(agthx.salesCharge?.maxPct).toBe(5.75)
    expect(agthx.salesCharge?.source).toMatch(/Risk.Return Summary/i)
    expect(agthx.salesCharge?.verifiedAt).toBe('2026-09-10')
  })

  it('now feeds the load into the projection, doubling the 10-year cost', () => {
    // The point of verifying it. An unverified load is disclosed in words and
    // EXCLUDED from the maths, so until today the Fee Drag Analyzer showed
    // AGTHX's cost as the expense ratio alone.
    //
    // Measured 2026-09-10 on $10k at 7% vs a 3bps benchmark:
    //   10y   $1,071 -> $2,137   (2.00x)
    //   30y  $11,700 -> $15,365  (1.31x)
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    const load = agthx.salesCharge!.maxPct!
    const cost = (years: number, l = 0) => {
      const pts = computeFeeDrag(10_000, agthx.expenseRatioPct, years, 7, 0.03, l)
      return pts[pts.length - 1].feesPaid
    }
    expect(cost(10, load) / cost(10)).toBeGreaterThan(1.9)
    expect(cost(10, load) / cost(10)).toBeLessThan(2.1)
  })

  it('shows a front load mattering MOST over a short horizon', () => {
    // The counter-intuitive half, and the reason the analyzer models the load
    // separately rather than folding it into an annual figure: a front load is
    // charged ONCE, so its share of total cost shrinks as expense-ratio
    // compounding takes over. It is worst for the investor who sells early —
    // the opposite of how an expense ratio behaves.
    const agthx = FUND_CATALOG.find((f) => f.symbol === 'AGTHX')!
    const load = agthx.salesCharge!.maxPct!
    const ratio = (years: number) => {
      const withL = computeFeeDrag(10_000, agthx.expenseRatioPct, years, 7, 0.03, load)
      const erOnly = computeFeeDrag(10_000, agthx.expenseRatioPct, years, 7, 0.03)
      return withL[withL.length - 1].feesPaid / erOnly[erOnly.length - 1].feesPaid
    }
    expect(ratio(10)).toBeGreaterThan(ratio(30))
  })
})

describe('computeFeeDrag with a front load', () => {
  it('defaults to no load, so every existing call is unchanged', () => {
    expect(computeFeeDrag(10_000, 0.5, 10, 7, 0.03)).toEqual(computeFeeDrag(10_000, 0.5, 10, 7, 0.03, 0))
  })

  it('takes the load off the top — only the remainder compounds', () => {
    // 5.75% of 10,000 = 575 deducted at purchase. Year 1 with a 0% return and a
    // 0% ER must therefore be 9,425, not 10,000.
    const [y1] = computeFeeDrag(10_000, 0, 1, 0, 0, 5.75)
    expect(y1.withFee).toBe(9_425)
  })

  it('does NOT charge the load to the benchmark', () => {
    // The benchmark is a no-load index fund. Charging it too would cancel out
    // the difference the comparison exists to show.
    const [y1] = computeFeeDrag(10_000, 0, 1, 0, 0, 5.75)
    expect(y1.withBenchmarkFee).toBe(10_000)
    expect(y1.feesPaid).toBe(575)
  })

  it('opens a gap that GROWS with the horizon, unlike a one-off charge', () => {
    const s = computeFeeDrag(10_000, 0, 30, 7, 0, 5.75)
    const y1 = s[0].feesPaid
    const y30 = s[29].feesPaid
    expect(y30).toBeGreaterThan(y1 * 5)
  })

  it('roughly DOUBLES the ten-year cost vs the expense ratio alone', () => {
    // The reason this was worth fixing, stated as the arithmetic actually
    // shows it: on £10,000 at 0.59% ER over 10 years, the ER costs ~£1,071 and
    // a 5.75% load takes the total to ~£2,137. An earlier draft of this test
    // asserted "more than double" and failed at 1.995× — the load nearly
    // doubles the cost, which is claim enough without rounding it upward.
    const erOnly = computeFeeDrag(10_000, 0.59, 10, 7, 0.03, 0).at(-1)!.feesPaid
    const withLoad = computeFeeDrag(10_000, 0.59, 10, 7, 0.03, 5.75).at(-1)!.feesPaid
    expect(withLoad / erOnly).toBeGreaterThan(1.9)
    expect(withLoad - erOnly).toBeGreaterThan(1_000)
  })

  it('ignores a negative load rather than crediting the investor', () => {
    const [y1] = computeFeeDrag(10_000, 0, 1, 0, 0, -5)
    expect(y1.withFee).toBe(10_000)
  })
})

describe('catalog-wide sales-charge provenance', () => {
  it('every stated rate carries a source and a verification date', () => {
    // The never-from-memory rule, enforced. A rate with no provenance is
    // indistinguishable from a guess.
    for (const f of FUND_CATALOG) {
      if (f.salesCharge?.maxPct != null) {
        expect(f.salesCharge.source, `${f.symbol} states a load with no source`).toBeTruthy()
        expect(f.salesCharge.verifiedAt, `${f.symbol} states a load with no verifiedAt`).toBeTruthy()
      }
    }
  })

  it('no ETF claims a sales charge', () => {
    for (const f of FUND_CATALOG) {
      if (f.type === 'etf') expect(f.salesCharge, `${f.symbol}`).toBeUndefined()
    }
  })
})
