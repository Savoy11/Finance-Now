import { describe, it, expect } from 'vitest'
import { computeShareStructure } from '../shareStructure'

// Shapes mirror the SEC companyfacts JSON the company-facts route already
// parses: concept → units → 'shares' → fact rows. The scenarios are the ones
// measured against real filings on 2026-11-24 (see the module header).

type Row = { val: number; end: string; form?: string; start?: string }
const concepts = (map: Record<string, Row[]>) =>
  Object.fromEntries(Object.entries(map).map(([k, rows]) => [k, { units: { shares: rows } }]))

// The clock is injectable (house rule): every scenario is read as of this day.
const NOW = new Date('2026-11-24T12:00:00Z')
const structure = (gaap: ReturnType<typeof concepts>, dei: ReturnType<typeof concepts>) =>
  computeShareStructure(gaap, dei, NOW)

describe('computeShareStructure', () => {
  it('reads issued, treasury and outstanding, each with its own as-of date (the KO shape)', () => {
    const gaap = concepts({
      CommonStockSharesIssued: [
        { val: 7_040_000_000, end: '2026-06-27', form: '10-Q' },
        { val: 7_040_000_000, end: '2026-09-26', form: '10-Q' },
      ],
      TreasuryStockCommonShares: [
        { val: 2_730_000_000, end: '2026-06-27', form: '10-Q' },
        { val: 2_710_000_000, end: '2026-09-26', form: '10-Q' },
      ],
    })
    const dei = concepts({
      EntityCommonStockSharesOutstanding: [{ val: 4_330_000_000, end: '2026-10-20', form: '10-Q' }],
    })
    const s = structure(gaap, dei)
    expect(s.issued).toEqual({ shares: 7_040_000_000, asOf: '2026-09-26' })
    expect(s.treasury).toEqual({ shares: 2_710_000_000, asOf: '2026-09-26' })
    expect(s.treasuryReported).toBe(true)
    expect(s.outstanding).toEqual({ shares: 4_330_000_000, asOf: '2026-10-20' })
    expect(s.treasuryPctOfIssued).toBeCloseTo((2_710_000_000 / 7_040_000_000) * 100, 6)
    expect(s.reconciles).toBe(true) // 7.04B − 2.71B = 4.33B exactly
  })

  it('a company with NO treasury tag reports treasuryReported false, never a 0 (the Apple shape)', () => {
    const gaap = concepts({
      CommonStockSharesIssued: [{ val: 14_532_259_000, end: '2026-09-27', form: '10-K' }],
    })
    const dei = concepts({
      EntityCommonStockSharesOutstanding: [{ val: 14_532_259_000, end: '2026-10-17', form: '10-K' }],
    })
    const s = structure(gaap, dei)
    expect(s.treasury).toBeNull()
    expect(s.treasuryReported).toBe(false)
    expect(s.treasuryPctOfIssued).toBeNull()
    // With no treasury, issued = outstanding reconciles on its own.
    expect(s.reconciles).toBe(true)
  })

  it('prefers the current treasury tag; the legacy tag only wins when it is newer', () => {
    const base = {
      CommonStockSharesIssued: [{ val: 1_000, end: '2026-09-30', form: '10-Q' }],
    }
    const currentNewer = structure(concepts({
      ...base,
      TreasuryStockCommonShares: [{ val: 200, end: '2026-09-30', form: '10-Q' }],
      TreasuryStockShares: [{ val: 180, end: '2023-03-31', form: '10-Q' }], // KO's stale legacy rows
    }), {})
    expect(currentNewer.treasury).toEqual({ shares: 200, asOf: '2026-09-30' })

    const legacyNewer = structure(concepts({
      ...base,
      TreasuryStockCommonShares: [{ val: 180, end: '2023-03-31', form: '10-Q' }],
      TreasuryStockShares: [{ val: 220, end: '2026-09-30', form: '10-Q' }],
    }), {})
    expect(legacyNewer.treasury).toEqual({ shares: 220, asOf: '2026-09-30' })

    const legacyOnly = structure(concepts({
      ...base,
      TreasuryStockShares: [{ val: 150, end: '2026-06-30', form: '10-Q' }],
    }), {})
    expect(legacyOnly.treasury).toEqual({ shares: 150, asOf: '2026-06-30' })
    expect(legacyOnly.treasuryReported).toBe(true)
  })

  it('outstanding comes from the dei cover-page count, with the gaap tag only as fallback', () => {
    const gaap = concepts({
      CommonStockSharesIssued: [{ val: 1_000, end: '2026-09-30', form: '10-Q' }],
      CommonStockSharesOutstanding: [{ val: 900, end: '2026-03-31', form: '10-Q' }], // JPM: gaap lags
    })
    const dei = concepts({
      EntityCommonStockSharesOutstanding: [{ val: 980, end: '2026-10-15', form: '10-Q' }],
    })
    expect(structure(gaap, dei).outstanding).toEqual({ shares: 980, asOf: '2026-10-15' })
    expect(structure(gaap, {}).outstanding).toEqual({ shares: 900, asOf: '2026-03-31' })
  })

  it('counts only 10-K/10-Q share instants: duration rows and other forms are ignored', () => {
    const gaap = concepts({
      CommonStockSharesIssued: [
        { val: 1_000, end: '2026-06-30', form: '10-Q' },
        { val: 5_000, end: '2026-09-30', form: '8-K' }, // wrong form, newer — must not win
        { val: 4_000, end: '2026-12-31', form: '10-K', start: '2026-01-01' }, // a duration, not an instant
      ],
    })
    expect(structure(gaap, {}).issued).toEqual({ shares: 1_000, asOf: '2026-06-30' })
  })

  it('reconciles is false when issued − treasury misses outstanding by more than 2% of issued', () => {
    const gaap = concepts({
      CommonStockSharesIssued: [{ val: 1_000, end: '2026-09-30', form: '10-Q' }],
      TreasuryStockCommonShares: [{ val: 100, end: '2026-09-30', form: '10-Q' }],
    })
    const near = concepts({ EntityCommonStockSharesOutstanding: [{ val: 910, end: '2026-10-15', form: '10-Q' }] })
    const far = concepts({ EntityCommonStockSharesOutstanding: [{ val: 870, end: '2026-10-15', form: '10-Q' }] })
    expect(structure(gaap, near).reconciles).toBe(true) // off by 10 = 1% of issued
    expect(structure(gaap, far).reconciles).toBe(false) // off by 30 = 3% of issued
  })

  it('empty facts give nulls across the board, with reconciles null rather than asserted', () => {
    const s = structure({}, {})
    expect(s).toEqual({
      issued: null,
      treasury: null,
      treasuryReported: false,
      outstanding: null,
      treasuryPctOfIssued: null,
      reconciles: null,
    })
  })

  it('an ancient stray is never served as current (the Berkshire 2011 / Nike 2015 shape)', () => {
    // A multi-class filer tags its real counts per class, which companyfacts
    // drops; the one untagged row left is from 2011 and must not surface.
    const dei = concepts({
      EntityCommonStockSharesOutstanding: [{ val: 941_481, end: '2011-04-29', form: '10-Q' }],
    })
    const s = structure({}, dei)
    expect(s.outstanding).toBeNull()
    // A row just inside the bound still serves.
    const fresh = concepts({
      EntityCommonStockSharesOutstanding: [{ val: 941_481, end: '2025-09-30', form: '10-Q' }],
    })
    expect(structure({}, fresh).outstanding).toEqual({ shares: 941_481, asOf: '2025-09-30' })
  })

  it('two materially different values on the chosen date mean per-class rows — refuse, never pick one', () => {
    const dei = concepts({
      EntityCommonStockSharesOutstanding: [
        { val: 2_100_000_000, end: '2026-10-15', form: '10-Q' }, // Class A count
        { val: 350_000_000, end: '2026-10-15', form: '10-Q' }, // Class B count
      ],
    })
    expect(structure({}, dei).outstanding).toBeNull()
    // The same value twice (a 10-K and a 10-Q restating one figure) is fine.
    const dup = concepts({
      EntityCommonStockSharesOutstanding: [
        { val: 2_100_000_000, end: '2026-10-15', form: '10-Q' },
        { val: 2_100_000_000, end: '2026-10-15', form: '10-K' },
      ],
    })
    expect(structure({}, dup).outstanding).toEqual({ shares: 2_100_000_000, asOf: '2026-10-15' })
  })
})
