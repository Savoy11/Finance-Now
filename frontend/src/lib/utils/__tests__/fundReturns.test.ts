import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  addMonths, buildFundReturns, compound, filingMonths, latestPerPeriod, monthLabel, monthOf, pctText, pickClass,
  returnsByMonth, signedDollars, type FilingFigures,
} from '../fundReturns'

/**
 * T-459 (owner decisions D222, D223): a fund's own returns and money flows from its N-PORT
 * filings. The first two filings are Vanguard 500 Index Fund's (VOO is class C000092055), copied
 * from the build cache; the rest are made up to drive each rule.
 */

const VOO = 'C000092055'

const VFIAX_Q1: FilingFigures = {
  asOf: '2026-03-31', filedAt: '2026-05-28', accession: '0000036405-26-000325', netAssets: 1421263311402.89,
  returns: [
    { classId: 'C000007774', months: [1.44656875, -0.76289431, -4.98408176] },
    { classId: VOO, months: [1.44652483, -0.76247071, -4.9823313] },
  ],
  flows: [
    { sales: 49491099928.3702, reinvestment: 0, redemption: 36185076096.9 },
    { sales: 30194137879.3799, reinvestment: 1358.23, redemption: 15721221443.66 },
    { sales: 56848168811.27, reinvestment: 1626514897.57, redemption: 69562527254.6 },
  ],
}
const VFIAX_Q2: FilingFigures = {
  asOf: '2026-06-30', filedAt: '2026-08-28', accession: '0000036405-26-000473', netAssets: 1671231561960.14,
  returns: [
    { classId: 'C000007774', months: [10.49014889, 5.25936275, -0.95490903] },
    { classId: VOO, months: [10.49057487, 5.26044899, -0.95476134] },
  ],
  flows: [
    { sales: 40632647042.0601, reinvestment: 5915.33, redemption: 12174698544.92 },
    { sales: 32054277718.52, reinvestment: 435.62, redemption: 16225703909.41 },
    { sales: 92586020974.6899, reinvestment: 1706081333.02, redemption: 102779354536.56 },
  ],
}

/** A made-up quarter for one class whose three months all return `pct`. */
const quarter = (asOf: string, pct: number, extra: Partial<FilingFigures> = {}): FilingFigures => ({
  asOf, filedAt: `${asOf.slice(0, 7)}-28`, accession: `acc-${asOf}`, netAssets: 1000,
  returns: [{ classId: 'C1', months: [pct, pct, pct] }], flows: [null, null, null], ...extra,
})

describe('months', () => {
  it('reads a filing’s three months, month 3 being the report date’s', () => {
    expect(filingMonths('2026-06-30')).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(filingMonths('2026-02-28')).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(filingMonths('nonsense')).toBeNull()
    expect(monthOf('2026-13-01')).toBeNull()
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2025-12', 13)).toBe('2027-01')
    expect(monthLabel('2026-08')).toBe('August 2026')
  })
})

describe('pickClass', () => {
  it('takes only the reader’s class, never another class’s figures', () => {
    expect(pickClass(VFIAX_Q2.returns, VOO)?.months[0]).toBe(10.49057487)
    expect(pickClass(VFIAX_Q2.returns, 'c000092055')?.classId).toBe(VOO)
    expect(pickClass(VFIAX_Q2.returns, 'C999')).toBeNull()
    expect(pickClass(VFIAX_Q2.returns, null)).toBeNull()
  })

  it('takes a lone row with no class id, or a lone row when no class is asked for', () => {
    expect(pickClass([{ classId: null, months: [1, 2, 3] }], 'C5')?.months).toEqual([1, 2, 3])
    expect(pickClass([{ classId: 'C5', months: [1, 2, 3] }], null)?.classId).toBe('C5')
    expect(pickClass([{ classId: 'C6', months: [1, 2, 3] }], 'C5')).toBeNull()
  })
})

describe('compounding', () => {
  it('compounds monthly returns rather than adding them', () => {
    expect(compound([10, 10])).toBeCloseTo(21, 10)
    expect(compound([10, -10])).toBeCloseTo(-1, 10)
    expect(compound(Array(12).fill(1))).toBeCloseTo((1.01 ** 12 - 1) * 100, 10)
  })
})

describe('buildFundReturns', () => {
  it('shows the newest filing’s months for the class, and no 12-month figure from two quarters', () => {
    const r = buildFundReturns([VFIAX_Q1, VFIAX_Q2], VOO)!
    expect(r.asOf).toBe('2026-06-30')
    expect(r.filedAt).toBe('2026-08-28')
    expect(r.months).toEqual([
      { month: '2026-04', returnPct: 10.49057487 },
      { month: '2026-05', returnPct: 5.26044899 },
      { month: '2026-06', returnPct: -0.95476134 },
    ])
    expect(r.twelveMonths).toBeNull()
    expect(r.twelveMonthsMissing).toBe('The filings read give 6 of the 12 months to June 2026, so there is no 12-month figure.')
  })

  it('gives the 12-month figure when four quarters join up', () => {
    const r = buildFundReturns([quarter('2025-09-30', 1), quarter('2025-12-31', 2), quarter('2026-03-31', -1), quarter('2026-06-30', 0.5)], 'C1')!
    expect(r.twelveMonths).toEqual({ from: '2025-07', to: '2026-06', returnPct: expect.any(Number) })
    expect(r.twelveMonths!.returnPct).toBeCloseTo((1.01 ** 3 * 1.02 ** 3 * 0.99 ** 3 * 1.005 ** 3 - 1) * 100, 10)
    expect(r.twelveMonthsMissing).toBeNull()
  })

  it('gives none when a quarter is missing, never a guess from the rest', () => {
    // Mutation: compound whatever months are present and this fails.
    const r = buildFundReturns([quarter('2025-06-30', 1), quarter('2025-12-31', 2), quarter('2026-03-31', -1), quarter('2026-06-30', 0.5)], 'C1')!
    expect(r.twelveMonths).toBeNull()
    expect(r.twelveMonthsMissing).toMatch(/9 of the 12 months to June 2026/)
  })

  it('gives none when one month of the twelve is not given', () => {
    const gap = quarter('2026-03-31', 1, { returns: [{ classId: 'C1', months: [1, null, 1] }] })
    const r = buildFundReturns([quarter('2025-09-30', 1), quarter('2025-12-31', 1), gap, quarter('2026-06-30', 1)], 'C1')!
    expect(r.twelveMonths).toBeNull()
    expect(r.twelveMonthsMissing).toMatch(/11 of the 12/)
  })

  it('lets an amendment restate its quarter: the later-filed filing wins', () => {
    const original = quarter('2026-06-30', 1)
    const amended = quarter('2026-06-30', 2, { filedAt: '2026-09-15', accession: 'amended' })
    expect(latestPerPeriod([original, amended]).map((f) => f.accession)).toEqual(['amended'])
    expect(latestPerPeriod([amended, original]).map((f) => f.accession)).toEqual(['amended'])
    expect(buildFundReturns([original, amended], 'C1')!.months[0].returnPct).toBe(2)
  })

  it('matches by month, so filings that overlap take the newer report’s figure for a month', () => {
    // A filing covering one month (as the SEC's monthly reports will) overlapping a quarterly one.
    const byMonth = returnsByMonth([quarter('2026-06-30', 1), quarter('2026-07-31', 3)], 'C1')
    expect([...byMonth.entries()].sort()).toEqual([['2026-04', 1], ['2026-05', 3], ['2026-06', 3], ['2026-07', 3]])
  })

  it('refuses a monthly return below -100%, which no fund can have', () => {
    const r = buildFundReturns([quarter('2026-06-30', 1, { returns: [{ classId: 'C1', months: [-150, 1, 1] }] })], 'C1')!
    expect(r.months[0].returnPct).toBeNull()
  })

  it('says when the newest filing has no row for the class, and shows no other class', () => {
    const r = buildFundReturns([VFIAX_Q2], 'C999')!
    expect(r.classFound).toBe(false)
    expect(r.months).toEqual([])
    expect(r.twelveMonthsMissing).toBe('The newest filing has no return for this share class.')
  })

  it('works out each month’s net flow and the quarter’s against net assets', () => {
    const f = buildFundReturns([VFIAX_Q2], VOO)!.flows!
    expect(f.months.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(f.months[0].net).toBeCloseTo(40632647042.0601 + 5915.33 - 12174698544.92, 2)
    // June: more redeemed than sold, so the month's net is an outflow.
    expect(f.months[2].net!).toBeLessThan(0)
    const total = f.months.reduce((s, m) => s + m.net!, 0)
    expect(f.net).toBeCloseTo(total, 2)
    expect(f.netPctOfAssets).toBeCloseTo((total / 1671231561960.14) * 100, 10)
  })

  it('gives no quarter net when a month’s figures are incomplete', () => {
    const f = buildFundReturns([quarter('2026-06-30', 1, {
      flows: [{ sales: 10, reinvestment: 0, redemption: 5 }, { sales: null, reinvestment: 0, redemption: 5 }, { sales: 1, reinvestment: 0, redemption: 1 }],
    })], 'C1')!.flows!
    expect(f.months[1].net).toBeNull()
    expect(f.net).toBeNull()
    expect(f.netPctOfAssets).toBeNull()
  })

  it('gives nothing without a dated filing', () => {
    expect(buildFundReturns([], 'C1')).toBeNull()
    expect(buildFundReturns([quarter('not a date', 1)], 'C1')).toBeNull()
  })
})

describe('words on the page', () => {
  it('signs returns and money flows', () => {
    expect(pctText(1.44652483)).toBe('+1.45%')
    expect(pctText(-4.9823313)).toBe('-4.98%')
    expect(pctText(-0.001)).toBe('0.00%')
    expect(signedDollars(-1.2e9)).toBe('-$1.20B')
    expect(signedDollars(350e6)).toBe('+$350.0M')
    expect(signedDollars(0.2)).toBe('$0')
  })
})

describe('where these figures go (D92, the ledger’s “considered and cut”)', () => {
  const src = join(__dirname, '../../..')
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === '__tests__' ? [] : walk(join(dir, d.name))) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [])

  it('are read only by the fund page’s card and the AI fund tool, never by the Fund Registry', () => {
    // Each fund's filing ends on a different month, so a column or a sort across funds would set
    // unlike periods side by side. Mutation: read /live-data/fund-returns from the registry and this fails.
    const readers = walk(src)
      .filter((f) => !f.includes(`${join('live-data', 'fund-returns')}`))
      // A read is a request for the route; the data-source registry only names it.
      .filter((f) => /\b(fetch|get)\(\s*`\/live-data\/fund-returns/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(src.length + 1).split('\\').join('/'))
      .sort()
    expect(readers).toEqual(['app/(dashboard)/funds/[symbol]/FundReturnsCard.tsx', 'lib/agents/tools.ts'])
  })

  it('carry no rating, ranking or comparison words', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    const code = [
      join(src, 'lib/utils/fundReturns.ts'),
      join(src, 'app/(dashboard)/funds/[symbol]/FundReturnsCard.tsx'),
    ].map((f) => strip(readFileSync(f, 'utf8'))).join('\n')
    expect(code).not.toMatch(/\b(rank|ranked|ranking|rating|score|best|worst|outperform|underperform|beat|lagg?ed|strong|weak)\b/i)
  })
})
