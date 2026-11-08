import { describe, expect, it } from 'vitest'
import {
  BOND_PROFILE_MIN_PCT, ISSUER_KIND_LABELS, MATURITY_BUCKETS, computeFundExposure, computePortfolioCountries,
  countryName, coverageNote, currencyName, formatShare, maturityBucket, topSlices, type ExposureHolding,
} from '../fundExposure'

const h = (o: Partial<ExposureHolding>): ExposureHolding => ({
  pctVal: 1, assetCat: 'EC', country: 'US', currency: 'USD', issuerCat: 'CORP', maturity: null, ...o,
})

describe('computeFundExposure: countries and currencies (T-455)', () => {
  it('adds each holding’s share under its country, largest first, with English names', () => {
    const e = computeFundExposure([
      h({ pctVal: 60 }), h({ pctVal: 25, country: 'JP', currency: 'JPY' }), h({ pctVal: 10, country: 'IE' }),
      h({ pctVal: 5, country: 'JP', currency: 'JPY' }),
    ], '2026-06-30')
    expect(e.countries.slices).toEqual([
      { code: 'US', label: 'United States', pct: 60 },
      { code: 'JP', label: 'Japan', pct: 30 },
      { code: 'IE', label: 'Ireland', pct: 10 },
    ])
    // An Irish-domiciled company traded in dollars: the country and the currency differ.
    expect(e.currencies.slices.map((s) => [s.code, s.label, s.pct])).toEqual([['USD', 'US Dollar', 70], ['JPY', 'Japanese Yen', 30]])
  })

  it('never guesses a blank field: it lowers the coverage and is counted', () => {
    const e = computeFundExposure([
      h({ pctVal: 90 }), h({ pctVal: 4, country: null }), h({ pctVal: null, country: 'FR' }), h({ pctVal: 2, country: null, assetCat: 'DE' }),
    ], '2026-06-30')
    expect(e.countries.slices).toEqual([{ code: 'US', label: 'United States', pct: 90 }])
    expect(e.countries.statedPct).toBe(90)
    expect(e.countries.listedPct).toBe(96)
    expect(e.countries.unstatedCount).toBe(2)
  })

  it('is not rescaled to 100%: what the filing lists is what is shown', () => {
    const e = computeFundExposure([h({ pctVal: 40 }), h({ pctVal: 40, country: 'GB' })], null)
    expect(e.countries.slices.reduce((t, s) => t + s.pct, 0)).toBe(80)
  })

  it('drops a slice that rounds to zero, and keeps a negative one', () => {
    const e = computeFundExposure([h({ pctVal: 99 }), h({ pctVal: 0.001, country: 'SE' }), h({ pctVal: -0.5, country: 'DE' })], null)
    expect(e.countries.slices.map((s) => s.code)).toEqual(['US', 'DE'])
    expect(e.countries.slices[1].pct).toBe(-0.5)
  })
})

describe('computeFundExposure: bonds (T-455 b)', () => {
  const bond = (o: Partial<ExposureHolding>) => h({ assetCat: 'DBT', issuerCat: 'UST', maturity: '2030-06-30', ...o })

  it('shows the bond splits only when bonds are at least 25% of the fund, the form’s own line', () => {
    expect(BOND_PROFILE_MIN_PCT).toBe(25)
    expect(computeFundExposure([h({ pctVal: 75.01 }), bond({ pctVal: 24.99 })], '2026-06-30').bonds).toBeNull()
    expect(computeFundExposure([h({ pctVal: 75 }), bond({ pctVal: 25 })], '2026-06-30').bonds?.bondsPct).toBe(25)
  })

  it('counts every kind of bond the asset mix counts, and nothing else', () => {
    const e = computeFundExposure([
      bond({ pctVal: 30 }), bond({ pctVal: 20, assetCat: 'ABS-MBS', issuerCat: 'USGSE' }), bond({ pctVal: 10, assetCat: 'LON', issuerCat: 'CORP' }),
      h({ pctVal: 40, assetCat: 'STIV', issuerCat: 'RF' }),
    ], '2026-06-30')
    expect(e.bonds?.bondsPct).toBe(60)
    expect(e.bonds?.borrowers.slices.map((s) => [s.label, s.pct])).toEqual([
      ['US Treasury', 30], ['US government-sponsored companies', 20], ['Companies', 10],
    ])
    expect(e.bonds?.borrowers.listedPct).toBe(60)
  })

  it('names every issuer kind on the form, and files an unknown one under Other', () => {
    expect(Object.keys(ISSUER_KIND_LABELS).sort()).toEqual(['CORP', 'MUN', 'NUSS', 'OTHER', 'PF', 'RF', 'USGA', 'USGSE', 'UST'])
    const e = computeFundExposure([bond({ pctVal: 30, issuerCat: 'NEWCAT' }), bond({ pctVal: 30, issuerCat: null })], '2026-06-30')
    expect(e.bonds?.borrowers.slices).toEqual([{ code: 'OTHER', label: 'Other', pct: 30 }])
    expect(e.bonds?.borrowers.unstatedCount).toBe(1)
  })

  it('buckets maturities from the report date, shortest first, and never guesses a missing or past date', () => {
    const asOf = '2026-06-30'
    const e = computeFundExposure([
      bond({ pctVal: 10, maturity: '2046-07-01' }), bond({ pctVal: 10, maturity: '2026-12-31' }),
      bond({ pctVal: 10, maturity: '2031-06-30' }), bond({ pctVal: 5, maturity: null }), bond({ pctVal: 5, maturity: '2026-01-01' }),
    ], asOf)
    expect(e.bonds?.maturities.slices.map((s) => s.code)).toEqual(['lt1', '5-10', 'gt20'])
    expect(e.bonds?.maturities.statedPct).toBe(30)
    expect(e.bonds?.maturities.unstatedCount).toBe(2)
    expect(computeFundExposure([bond({ pctVal: 30 })], null).bonds?.maturities.slices).toEqual([])
  })

  it('counts in calendar years, so a bond due exactly on a boundary is in the longer bucket', () => {
    expect(MATURITY_BUCKETS.map((b) => b.code)).toEqual(['lt1', '1-3', '3-5', '5-10', '10-20', 'gt20'])
    const asOf = '2026-06-30'
    expect(maturityBucket('2026-06-30', asOf)).toBe('lt1')
    expect(maturityBucket('2027-06-29', asOf)).toBe('lt1')
    expect(maturityBucket('2027-06-30', asOf)).toBe('1-3')
    expect(maturityBucket('2031-06-29', asOf)).toBe('3-5')
    expect(maturityBucket('2031-06-30', asOf)).toBe('5-10') // five years, across a leap day
    expect(maturityBucket('2046-06-29', asOf)).toBe('10-20')
    expect(maturityBucket('2046-06-30', asOf)).toBe('gt20')
    expect(maturityBucket('2026-06-29', asOf)).toBeNull()
    expect(maturityBucket(null, asOf)).toBeNull()
    expect(maturityBucket('2030-01-01', null)).toBeNull()
  })
})

describe('names and long lists', () => {
  it('names countries and currencies in English, and keeps a code it cannot name', () => {
    expect(countryName('KR')).toBe('South Korea')
    expect(currencyName('EUR')).toBe('Euro')
    expect(countryName('Q9')).toBe('Q9')
  })

  it('shows the largest few and adds up the rest', () => {
    const e = computeFundExposure(['US', 'JP', 'GB', 'FR', 'DE'].map((c, i) => h({ pctVal: 50 - i * 10, country: c })), null)
    const t = topSlices(e.countries, 3)
    expect(t.shown.map((s) => s.code)).toEqual(['US', 'JP', 'GB'])
    expect(t.rest).toEqual({ count: 2, pct: 30 })
    expect(topSlices(e.countries, 5).rest).toBeNull()
  })
})

describe('what the card says beside each split', () => {
  const s = (statedPct: number, listedPct: number, unstatedCount: number) => ({ slices: [], statedPct, listedPct, unstatedCount })

  it('shows a share too small for one decimal place as under 0.1%, never 0.0%', () => {
    expect(formatShare(2.72)).toBe('2.7%')
    expect(formatShare(0.03)).toBe('<0.1%')
    expect(formatShare(-0.01)).toBe('−<0.1%')
    expect(formatShare(0)).toBe('0.0%')
    expect(formatShare(0.05)).toBe('0.1%')
  })

  it('says how much of the fund a split covers and how many holdings state nothing', () => {
    expect(coverageNote(s(99.9, 99.9, 0), 'country')).toBe('The country is stated for holdings worth 99.9% of the fund.')
    expect(coverageNote(s(95, 99.9, 1), 'country')).toMatch(/1 holding in the filing states none, so it is left out rather than guessed/)
    expect(coverageNote(s(90, 96, 12), 'currency')).toMatch(/12 holdings .* left out rather than guessed\. The rest of the fund is cash .* Nothing is rescaled to 100%/)
  })

  it('explains holdings that add up to over 100% of the fund', () => {
    expect(coverageNote(s(100.1, 100.1, 0), 'country')).toMatch(/a little over 100% because the fund owes some money it has not yet paid/)
    expect(coverageNote(s(100, 100.04, 0), 'country')).not.toMatch(/over 100%/)
    // Said once per fund: a second split of the same fund leaves the totals out.
    expect(coverageNote(s(100.1, 100.1, 0), 'currency', 'holdings', false)).toBe('The currency is stated for holdings worth 100.1% of the fund.')
    expect(coverageNote(s(90, 96, 0), 'currency', 'holdings', false)).not.toMatch(/rest of the fund/)
  })

  it('speaks of bonds for a bond split, whose shares are still of the whole fund', () => {
    const note = coverageNote(s(97, 98, 2), 'kind of borrower', 'bonds')
    expect(note).toBe('The kind of borrower is stated for bonds worth 97.0% of the fund. 2 bonds in the filing state none, so they are left out rather than guessed.')
  })
})

describe('computePortfolioCountries (T-455 c)', () => {
  const us = { slices: [{ code: 'US', label: 'United States', pct: 99 }], statedPct: 99, listedPct: 100, unstatedCount: 1 }
  const intl = {
    slices: [{ code: 'JP', label: 'Japan', pct: 40 }, { code: 'GB', label: 'United Kingdom', pct: 30 }, { code: 'US', label: 'United States', pct: 20 }],
    statedPct: 90, listedPct: 98, unstatedCount: 3,
  }

  it('weights each fund’s split by its share of the portfolio and adds them up', () => {
    const r = computePortfolioCountries(
      [{ symbol: 'VOO', weightPct: 50, isFund: true }, { symbol: 'VXUS', weightPct: 40, isFund: true }, { symbol: 'AAPL', weightPct: 10, isFund: false }],
      { VOO: us, VXUS: intl },
    )
    expect(r.slices).toEqual([
      { code: 'US', label: 'United States', pct: 57.5 },
      { code: 'JP', label: 'Japan', pct: 16 },
      { code: 'GB', label: 'United Kingdom', pct: 12 },
    ])
    expect(r.countedPct).toBe(85.5)
    expect(r.notStatedPct).toBe(4.5)
    expect(r.directPct).toBe(10)
    expect(r.fundsWithout).toEqual([])
  })

  it('names a fund with no split and leaves its weight out rather than spread it', () => {
    const r = computePortfolioCountries(
      [{ symbol: 'VOO', weightPct: 60, isFund: true }, { symbol: 'SPY', weightPct: 40, isFund: true }],
      { VOO: us, SPY: undefined },
    )
    expect(r.fundsWithout).toEqual([{ symbol: 'SPY', weightPct: 40 }])
    expect(r.slices).toEqual([{ code: 'US', label: 'United States', pct: 59.4 }])
    expect(r.countedPct + r.notStatedPct + r.directPct + 40).toBeCloseTo(100, 6)
  })
})
