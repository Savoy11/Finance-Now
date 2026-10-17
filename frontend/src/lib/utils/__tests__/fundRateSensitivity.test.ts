import { describe, expect, it } from 'vitest'
import { describeRateSensitivity, fundRateSensitivity, MIN_DURATION_YEARS } from '../fundRateSensitivity'

// Σ DV01 across the five maturity buckets of real N-PORT filings fetched
// 2026-10-17 (computed from the bucket values, not typed), with net assets from
// the same filing. `published` is the issuer's own effective duration, read from
// its product page on 2026-10-17 (as of 2026-10-15): the outside check that the
// arithmetic lands near a number nobody in this repo computed. BND has none:
// Vanguard's page did not load, so it is here only as the negative-sign filer.
const FILINGS = {
  IEF: { dv01: 33773267.16, netAssets: 48329792760.21, published: 6.85 },
  TLT: { dv01: 64973063.65, netAssets: 42906038556.23, published: 14.85 },
  SHY: { dv01: 4778955.80, netAssets: 25438453831.44, published: 1.81 },
} as const
const BND = { dv01: -225790318.12, netAssets: 397107296566.89 }

describe('fundRateSensitivity', () => {
  it('lands within half a year of each issuer’s published effective duration', () => {
    for (const [k, f] of Object.entries(FILINGS)) {
      const r = fundRateSensitivity([{ currency: 'USD', dv01: f.dv01 }], f.netAssets, '2026-05-31')
      expect(r, k).not.toBeNull()
      expect(Math.abs(r!.durationYears - f.published), k).toBeLessThan(0.5)
    }
  })

  it('works the arithmetic: |ΣDV01| / net assets × 10,000', () => {
    const r = fundRateSensitivity([{ currency: 'USD', dv01: FILINGS.IEF.dv01 }], FILINGS.IEF.netAssets, '2026-05-31')!
    expect(r.durationYears).toBeCloseTo((33773267.16 / 48329792760.21) * 10_000, 9)
    expect(r.asOf).toBe('2026-05-31')
  })

  it('reads the same exposure the same under either sign convention', () => {
    const neg = fundRateSensitivity([{ currency: 'USD', dv01: BND.dv01 }], BND.netAssets, null)!
    const pos = fundRateSensitivity([{ currency: 'USD', dv01: -BND.dv01 }], BND.netAssets, null)!
    expect(neg.durationYears).toBeGreaterThan(0)
    expect(neg.durationYears).toBeCloseTo(pos.durationYears, 12)
    expect(neg.durationYears).toBeCloseTo(5.686, 3)
  })

  it('nets currencies with their signs before taking the size', () => {
    // A hedge reported against the long book offsets it; summing magnitudes
    // would overstate the exposure instead.
    const r = fundRateSensitivity(
      [{ currency: 'USD', dv01: 1_000_000 }, { currency: 'EUR', dv01: -400_000 }],
      1_000_000_000, null,
    )!
    expect(r.durationYears).toBeCloseTo(6, 9)
    expect(r.currencies).toEqual(['USD', 'EUR'])
  })

  it('says nothing without the section, without net assets, or for negligible exposure', () => {
    expect(fundRateSensitivity([], 1e9, null)).toBeNull()
    expect(fundRateSensitivity([{ currency: 'USD', dv01: 1e6 }], null, null)).toBeNull()
    expect(fundRateSensitivity([{ currency: 'USD', dv01: 1e6 }], 0, null)).toBeNull()
    expect(fundRateSensitivity([{ currency: 'USD', dv01: 1e6 }], -5, null)).toBeNull()
    expect(fundRateSensitivity([{ currency: 'USD', dv01: NaN }], 1e9, null)).toBeNull()
    // A stock fund holding a little T-bill cash: true, and meaningless as a duration.
    const tiny = ((MIN_DURATION_YEARS / 2) * 1e9) / 10_000
    expect(fundRateSensitivity([{ currency: 'USD', dv01: tiny }], 1e9, null)).toBeNull()
  })
})

describe('describeRateSensitivity', () => {
  const ief = fundRateSensitivity([{ currency: 'USD', dv01: FILINGS.IEF.dv01 }], FILINGS.IEF.netAssets, '2026-05-31')!

  it('states the duration, the filing and its date', () => {
    const { headline, method } = describeRateSensitivity(ief)
    expect(headline).toContain('about 7.0 years')
    expect(method).toContain('N-PORT filing as of 2026-05-31')
    expect(method).not.toMatch(/priced in/)
  })

  it('names currencies other than the dollar', () => {
    const r = fundRateSensitivity([{ currency: 'USD', dv01: 5e6 }, { currency: 'EUR', dv01: 1e6 }], 1e10, null)!
    expect(describeRateSensitivity(r).method).toContain('priced in EUR')
  })

  it('uses no risk-tolerance words, which the label it replaces did', () => {
    // Same list as fundStructure.test.ts, plus the words a duration line is
    // most tempted by.
    const banned = /conservative|moderate|aggressive|speculative|suitab|safe|risky|volatile|low.risk|high.risk|recommend/i
    for (const d of [0.2, 1.9, 7, 16.6, 25]) {
      const { headline, method } = describeRateSensitivity({ durationYears: d, currencies: ['USD', 'JPY'], asOf: null })
      expect(`${headline} ${method}`).not.toMatch(banned)
    }
  })
})
