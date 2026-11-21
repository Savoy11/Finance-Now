import { describe, expect, it } from 'vitest'
import { changePct, conceptQuarters, lastQuarters, type ConceptFacts, type XbrlFact } from '../companyQuarters'

/**
 * T-461 (owner decision D222): a company's last eight quarters from its SEC company-facts file.
 * The facts are made up but laid out as the file lays them out: a 10-Q reports the three months
 * and the year to date (six or nine months) with last year's comparatives; a 10-K reports full
 * years only. No company-facts file was on hand to copy from (this session sends nothing to the
 * SEC); `npm run audit` reads a real one.
 */

const f = (start: string, end: string, val: number, form: string, filed: string, fy = Number(filed.slice(0, 4))): XbrlFact =>
  ({ start, end, val, form, filed, fy, fp: form === '10-K' ? 'FY' : 'Q', accn: `acc-${filed}-${end}` })

/** A calendar-year company: 2023 and 2024 full years, and quarters through September 2025. */
const REVENUE: XbrlFact[] = [
  // 2023
  f('2023-01-01', '2023-03-31', 80, '10-Q', '2023-05-01'),
  f('2023-04-01', '2023-06-30', 85, '10-Q', '2023-08-01'),
  f('2023-01-01', '2023-06-30', 165, '10-Q', '2023-08-01'),
  f('2023-07-01', '2023-09-30', 90, '10-Q', '2023-11-01'),
  f('2023-01-01', '2023-09-30', 255, '10-Q', '2023-11-01'),
  f('2023-01-01', '2023-12-31', 360, '10-K', '2024-02-15'),
  // 2024, and the 2024 10-K's comparative for 2023
  f('2024-01-01', '2024-03-31', 90, '10-Q', '2024-05-01'),
  f('2024-04-01', '2024-06-30', 100, '10-Q', '2024-08-01'),
  f('2024-01-01', '2024-06-30', 190, '10-Q', '2024-08-01'),
  f('2024-07-01', '2024-09-30', 102, '10-Q', '2024-11-01'),
  f('2024-01-01', '2024-09-30', 292, '10-Q', '2024-11-01'),
  f('2024-01-01', '2024-12-31', 400, '10-K', '2025-02-15'),
  f('2023-01-01', '2023-12-31', 360, '10-K', '2025-02-15'),
  // 2025, with the first-quarter 10-Q restating 2024's first quarter as 91
  f('2025-01-01', '2025-03-31', 99, '10-Q', '2025-05-01'),
  f('2024-01-01', '2024-03-31', 91, '10-Q', '2025-05-01'),
  f('2025-04-01', '2025-06-30', 110, '10-Q', '2025-08-01'),
  f('2025-07-01', '2025-09-30', 115, '10-Q', '2025-11-01'),
  f('2025-01-01', '2025-09-30', 324, '10-Q', '2025-11-01'),
  // An 8-K is not a periodic report and is never read.
  f('2025-07-01', '2025-09-30', 999, '8-K', '2025-10-20'),
]

const gaap = (extra: ConceptFacts = {}): ConceptFacts => ({
  RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: REVENUE } },
  NetIncomeLoss: {
    units: {
      USD: [
        f('2024-07-01', '2024-09-30', -5, '10-Q', '2024-11-01'),
        f('2025-07-01', '2025-09-30', 10, '10-Q', '2025-11-01'),
        f('2024-04-01', '2024-06-30', 8, '10-Q', '2024-08-01'),
        f('2025-04-01', '2025-06-30', 12, '10-Q', '2025-08-01'),
      ],
    },
  },
  EarningsPerShareDiluted: {
    units: {
      'USD/shares': [
        f('2024-07-01', '2024-09-30', 0.5, '10-Q', '2024-11-01'),
        f('2025-07-01', '2025-09-30', 0.6, '10-Q', '2025-11-01'),
        // A full year's earnings per share: never used to work out a fourth quarter.
        f('2024-01-01', '2024-12-31', 2.1, '10-K', '2025-02-15'),
        f('2024-01-01', '2024-09-30', 1.5, '10-Q', '2024-11-01'),
      ],
    },
  },
  ...extra,
})

describe('lastQuarters', () => {
  const q = lastQuarters(gaap())

  it('gives the last eight quarters, newest first, by their three-month figures', () => {
    expect(q.map((x) => [x.end, x.revenue?.value])).toEqual([
      ['2025-09-30', 115], ['2025-06-30', 110], ['2025-03-31', 99], ['2024-12-31', 108],
      ['2024-09-30', 102], ['2024-06-30', 100], ['2024-03-31', 91], ['2023-12-31', 105],
    ])
    expect(q.map((x) => x.start)).toEqual(['2025-07-01', '2025-04-01', '2025-01-01', '2024-10-01', '2024-07-01', '2024-04-01', '2024-01-01', '2023-10-01'])
  })

  it('works out the fourth quarter as the full year less the first nine months, and says so', () => {
    expect(q[3].revenue).toEqual({ value: 400 - 292, workedOut: true, concept: 'RevenueFromContractWithCustomerExcludingAssessedTax' })
    expect(q[0].revenue?.workedOut).toBe(false)
  })

  it('never works out a fourth quarter’s earnings per share', () => {
    expect(q[3].eps).toBeNull()
    expect(q[0].eps).toEqual({ value: 0.6, workedOut: false, concept: 'EarningsPerShareDiluted' })
  })

  it('takes a later filing’s restated figure over the original', () => {
    expect(q[6].revenue?.value).toBe(91)
  })

  it('compares each quarter with the same quarter a year earlier', () => {
    expect(q[0].revenueChangePct).toBeCloseTo(((115 - 102) / 102) * 100, 10)
    expect(q[3].revenueChangePct).toBeCloseTo(((108 - 105) / 105) * 100, 10)
    expect(q[6].revenueChangePct).toBeCloseTo(((91 - 80) / 80) * 100, 10)
    expect(q[7].revenueChangePct).toBeNull() // no 2022 on file
    expect(q[0].epsChangePct).toBeCloseTo(20, 10)
  })

  it('gives no percent change from a loss', () => {
    // Net income went from -5 to 10: no percent of a loss means anything.
    expect(q[0].netIncome?.value).toBe(10)
    expect(q[0].netIncomeChangePct).toBeNull()
    expect(q[1].netIncomeChangePct).toBeCloseTo(50, 10)
  })

  it('gives nothing for a company that files no 10-Q, whatever else it files', () => {
    const twentyF: ConceptFacts = {
      Revenues: {
        units: {
          USD: [
            f('2024-01-01', '2024-12-31', 500, '20-F', '2025-04-01'),
            // A foreign filer's half-year or quarterly update on Form 6-K is not a 10-Q.
            f('2024-07-01', '2024-09-30', 120, '6-K', '2024-11-15'),
          ],
        },
      },
    }
    expect(lastQuarters(twentyF)).toEqual([])
  })

  it('reads only 10-Q and 10-K figures, never an 8-K filed after them', () => {
    // Mutation: read every form and the later 8-K's 999 wins the quarter.
    const g = gaap({
      Revenues: { units: { USD: [f('2025-07-01', '2025-09-30', 999, '8-K', '2025-12-01')] } },
    })
    const withEightK = { ...g, RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [...REVENUE, f('2025-07-01', '2025-09-30', 999, '8-K', '2025-12-01')] } } }
    expect(lastQuarters(withEightK)[0].revenue?.value).toBe(115)
  })

  it('compares earnings per share only like for like, diluted with diluted', () => {
    // A year-earlier quarter with only a basic figure: no percent against this year's diluted one.
    const g = gaap({
      EarningsPerShareDiluted: { units: { 'USD/shares': [f('2025-07-01', '2025-09-30', 0.6, '10-Q', '2025-11-01')] } },
      EarningsPerShareBasic: { units: { 'USD/shares': [f('2024-07-01', '2024-09-30', 0.5, '10-Q', '2024-11-01')] } },
    })
    const q = lastQuarters(g)
    expect(q[0].eps?.concept).toBe('EarningsPerShareDiluted')
    expect(q[4].eps?.concept).toBe('EarningsPerShareBasic')
    expect(q[0].epsChangePct).toBeNull()
  })
})

describe('conceptQuarters: the fourth quarter', () => {
  it('adds up the three quarters when the filing gives no nine-month figure', () => {
    const facts = [
      f('2024-01-01', '2024-03-31', 10, '10-Q', '2024-05-01'),
      f('2024-04-01', '2024-06-30', 20, '10-Q', '2024-08-01'),
      f('2024-07-01', '2024-09-30', 30, '10-Q', '2024-11-01'),
      f('2024-01-01', '2024-12-31', 100, '10-K', '2025-02-01'),
    ]
    expect(conceptQuarters(facts, true).get('2024-12-31')).toEqual({ start: '2024-10-01', end: '2024-12-31', value: 40, workedOut: true })
  })

  it('keeps a fourth quarter the company reported itself', () => {
    const facts = [
      f('2024-01-01', '2024-09-30', 60, '10-Q', '2024-11-01'),
      f('2024-01-01', '2024-12-31', 100, '10-K', '2025-02-01'),
      f('2024-10-01', '2024-12-31', 41, '10-K', '2025-02-01'),
    ]
    expect(conceptQuarters(facts, true).get('2024-12-31')).toEqual({ start: '2024-10-01', end: '2024-12-31', value: 41, workedOut: false })
  })

  it('works out nothing without the first nine months', () => {
    const facts = [
      f('2024-04-01', '2024-06-30', 20, '10-Q', '2024-08-01'),
      f('2024-01-01', '2024-12-31', 100, '10-K', '2025-02-01'),
    ]
    expect(conceptQuarters(facts, true).has('2024-12-31')).toBe(false)
  })

  it('handles a 53-week year and 13-week quarters', () => {
    // A fiscal year ending the last Saturday of September, as Apple's does.
    const facts = [
      f('2023-10-01', '2024-06-29', 300, '10-Q', '2024-08-02'),
      f('2023-10-01', '2024-09-28', 391, '10-K', '2024-11-01'),
    ]
    expect(conceptQuarters(facts, true).get('2024-09-28')).toEqual({ start: '2024-06-30', end: '2024-09-28', value: 91, workedOut: true })
  })

  it('never sets a full year in one tag against nine months in another', () => {
    // A company that moved its revenue tag between the third-quarter 10-Q and the 10-K.
    const g: ConceptFacts = {
      Revenues: { units: { USD: [f('2024-01-01', '2024-09-30', 60, '10-Q', '2024-11-01'), f('2024-07-01', '2024-09-30', 20, '10-Q', '2024-11-01')] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [f('2024-01-01', '2024-12-31', 100, '10-K', '2025-02-01')] } },
    }
    const q = lastQuarters(g)
    expect(q.map((x) => x.end)).toEqual(['2024-09-30'])
  })
})

describe('a fourth quarter across a change of basis (code audit 2026-11-12, D226)', () => {
  /**
   * The audit's case: a company spins off a segment on 2025-11-01, after its third quarter. Its
   * 2025 10-Qs report 100 a quarter with the segment; its 2025 10-K reports continuing operations
   * only, 300 for 2025 and 2024 restated from 400 to 300. Before the fix, both fourth quarters
   * came out as 0 and were marked worked out.
   */
  const spinOff: XbrlFact[] = [
    f('2024-01-01', '2024-03-31', 100, '10-Q', '2024-05-01'),
    f('2024-04-01', '2024-06-30', 100, '10-Q', '2024-08-01'),
    f('2024-07-01', '2024-09-30', 100, '10-Q', '2024-11-01'),
    f('2024-01-01', '2024-09-30', 300, '10-Q', '2024-11-01'),
    f('2024-01-01', '2024-12-31', 400, '10-K', '2025-02-15'),
    f('2025-01-01', '2025-03-31', 100, '10-Q', '2025-05-01'),
    f('2025-04-01', '2025-06-30', 100, '10-Q', '2025-08-01'),
    f('2025-07-01', '2025-09-30', 100, '10-Q', '2025-11-01'),
    f('2025-01-01', '2025-09-30', 300, '10-Q', '2025-11-01'),
    f('2024-01-01', '2024-09-30', 300, '10-Q', '2025-11-01'),
    // The 2025 10-K: continuing operations only, and 2024 restated on the same basis.
    f('2025-01-01', '2025-12-31', 300, '10-K', '2026-02-15'),
    f('2024-01-01', '2024-12-31', 300, '10-K', '2026-02-15'),
  ]
  const g: ConceptFacts = { RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: spinOff } } }

  it('works out neither fourth quarter, and says why', () => {
    // Mutation: drop the basis check and both read 0, marked worked out.
    const q = lastQuarters(g)
    const q4 = q.filter((x) => x.end.endsWith('12-31'))
    expect(q4.map((x) => [x.end, x.revenue, x.revenueWithheld])).toEqual([
      ['2025-12-31', null, 'restated'],
      ['2024-12-31', null, 'restated'],
    ])
    // The row is still there, between its neighbours, rather than vanishing.
    expect(q.map((x) => x.end).slice(0, 4)).toEqual(['2025-12-31', '2025-09-30', '2025-06-30', '2025-03-31'])
    expect(q[0].start).toBe('2025-10-01')
  })

  it('still works out a fourth quarter when nothing changed between the two reports', () => {
    const before = spinOff.filter((x) => x.filed! < '2026-01-01')
    const q = conceptQuarters(before, true)
    expect(q.get('2024-12-31')).toEqual({ start: '2024-10-01', end: '2024-12-31', value: 100, workedOut: true })
  })

  it('does not count a later report that only repeats a figure already restated', () => {
    // 2023's year was restated in the 2024 10-K, a year before 2025's nine months were filed. The
    // 2025 10-K repeats the restated value: that is no change, so 2025's fourth quarter is still
    // worked out.
    const facts = [
      f('2023-01-01', '2023-12-31', 500, '10-K', '2024-02-15'),
      f('2023-01-01', '2023-12-31', 450, '10-K', '2025-02-15'),
      f('2025-01-01', '2025-09-30', 300, '10-Q', '2025-11-01'),
      f('2025-01-01', '2025-12-31', 420, '10-K', '2026-02-15'),
      f('2023-01-01', '2023-12-31', 450, '10-K', '2026-02-15'),
    ]
    expect(conceptQuarters(facts, true).get('2025-12-31')?.value).toBe(120)
  })

  it('ignores a change under half a percent, a rounding or a small reclassification', () => {
    const facts = [
      f('2024-01-01', '2024-12-31', 1000, '10-K', '2025-02-15'),
      f('2025-01-01', '2025-09-30', 780, '10-Q', '2025-11-01'),
      f('2025-01-01', '2025-12-31', 1050, '10-K', '2026-02-15'),
      f('2024-01-01', '2024-12-31', 1004, '10-K', '2026-02-15'), // 0.4%
    ]
    expect(conceptQuarters(facts, true).get('2025-12-31')?.value).toBe(270)
    const moved = [...facts.slice(0, 3), f('2024-01-01', '2024-12-31', 1010, '10-K', '2026-02-15')] // 1%
    expect(conceptQuarters(moved, true).has('2025-12-31')).toBe(false)
  })

  it('withholds a worked-out revenue of zero or below, but not a net loss', () => {
    // Mutation: drop the revenue floor and a negative "revenue" is shown.
    const rev = [f('2025-01-01', '2025-09-30', 300, '10-Q', '2025-11-01'), f('2025-01-01', '2025-12-31', 280, '10-K', '2026-02-15')]
    const q = lastQuarters({
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: rev } },
      NetIncomeLoss: { units: { USD: [f('2025-01-01', '2025-09-30', 30, '10-Q', '2025-11-01'), f('2025-01-01', '2025-12-31', 10, '10-K', '2026-02-15')] } },
    })
    expect(q[0]).toMatchObject({ end: '2025-12-31', revenue: null, revenueWithheld: 'not-positive', netIncome: { value: -20, workedOut: true } })
    expect(q[0].netIncomeWithheld).toBeUndefined()
  })
})

describe('changePct', () => {
  it('is a percent of the earlier figure, and none from zero or below', () => {
    expect(changePct(110, 100)).toBeCloseTo(10, 10)
    expect(changePct(90, 100)).toBeCloseTo(-10, 10)
    expect(changePct(5, 0)).toBeNull()
    expect(changePct(5, -2)).toBeNull()
    expect(changePct(null, 2)).toBeNull()
  })
})
