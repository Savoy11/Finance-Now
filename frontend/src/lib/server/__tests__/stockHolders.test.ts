import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isoFromSetDate, normalizeAmendmentKind, dominantPeriod, effectiveFilings, foldInfoRow, aggregate,
  type SubmissionRow, type CoverRow, type InfoRow,
} from '../../../../scripts/lib/form13f'
import {
  CLASS_WORDS, agreeingFamilies, classCandidateCusips, cusipForClassByTitles, nameMatches,
  resolveCusips, type HoldingForCusip,
} from '../../../../scripts/lib/stockCusips'
import { allowedBrowseCount } from '../nport'
import GENERATED from '../../data/stockHolders.generated.json'
import {
  STOCK_HOLDERS_BUILT_ON, fundHoldersScopeNote, getStockHoldersProvenance,
  institutionalPctOfOutstanding, thirteenFPeriodNote, unresolvedInPlainWords,
  type StockHoldersFile,
} from '../../data/stockHolders'

const read = (p: string) => readFileSync(join(__dirname, '../../../..', p), 'utf8')

// ── The EDGAR browse `count` fix (found building T-471, 2026-11-24) ─────────
// EDGAR's company browse refuses any count that is not a round ten (or 500):
// "Invalid count, Received: 12, Count must be one of: 10, 20, 30, 40, 50, 60,
// 70, 80, 90, 100, 500". Every N-PORT surface asked for limit+2 and had been
// getting a 400 back.
describe('allowedBrowseCount', () => {
  it('rounds up to the next ten and stays inside 10..100', () => {
    expect(allowedBrowseCount(12)).toBe(20) // the measured failure: listNportFilings(seriesId, 10) asked for 12
    expect(allowedBrowseCount(10)).toBe(10)
    expect(allowedBrowseCount(1)).toBe(10)
    expect(allowedBrowseCount(0)).toBe(10)
    expect(allowedBrowseCount(41)).toBe(50)
    expect(allowedBrowseCount(100)).toBe(100)
    expect(allowedBrowseCount(250)).toBe(100)
  })
})

// ── Form 13F aggregation rules ──────────────────────────────────────────────

const sub = (o: Partial<SubmissionRow>): SubmissionRow => ({
  accession: 'a', filedAt: '2026-08-01', type: '13F-HR', cik: '1', period: '2026-06-30', ...o,
})
const cover = (accession: string, o: Partial<CoverRow> = {}): [string, CoverRow] =>
  [accession, { accession, isAmendment: false, amendmentKind: null, managerName: 'Mgr', ...o }]
const info = (o: Partial<InfoRow> & { valueUsd?: number }): InfoRow & { valueUsd?: number } => ({
  accession: 'a', cusip: '037833100', shares: 100, sharesType: 'SH', putCall: '', ...o,
})

describe('isoFromSetDate', () => {
  it('reads the sets\' DD-MON-YYYY spelling', () => {
    expect(isoFromSetDate('31-JUL-2026')).toBe('2026-07-31')
    expect(isoFromSetDate('03-feb-2025')).toBe('2025-02-03')
  })
  it('passes anything else through unchanged', () => {
    expect(isoFromSetDate('2026-07-31')).toBe('2026-07-31')
    expect(isoFromSetDate('31-VII-2026')).toBe('31-VII-2026')
  })
})

describe('normalizeAmendmentKind', () => {
  it('maps the two amendment kinds and nothing else', () => {
    expect(normalizeAmendmentKind('RESTATEMENT')).toBe('restatement')
    expect(normalizeAmendmentKind('NEW HOLDINGS')).toBe('add')
    expect(normalizeAmendmentKind('')).toBeNull()
    expect(normalizeAmendmentKind(undefined)).toBeNull()
    expect(normalizeAmendmentKind('OTHER')).toBeNull()
  })
})

describe('dominantPeriod', () => {
  it('picks the modal 13F-HR period, ignoring notice filings', () => {
    const rows = [
      sub({ accession: 'a1', period: '2026-06-30' }),
      sub({ accession: 'a2', period: '2026-06-30', cik: '2' }),
      sub({ accession: 'a3', period: '2026-03-31', cik: '3' }), // a straggler for the prior quarter
      sub({ accession: 'a4', period: '2026-03-31', cik: '4', type: '13F-NT' }),
      sub({ accession: 'a5', period: '2026-03-31', cik: '5', type: '13F-NT' }),
    ]
    expect(dominantPeriod(rows)).toBe('2026-06-30')
    expect(dominantPeriod([])).toBeNull()
  })
})

describe('effectiveFilings', () => {
  const period = '2026-06-30'

  it('keeps a lone original', () => {
    const eff = effectiveFilings([sub({ accession: 'orig' })], new Map(), period)
    expect([...eff.entries()]).toEqual([['orig', '1']])
  })

  it('a restatement replaces the original; a "new holdings" amendment adds to it', () => {
    const subs = [
      sub({ accession: 'orig', filedAt: '2026-07-15' }),
      sub({ accession: 'restated', filedAt: '2026-08-01', type: '13F-HR/A' }),
      sub({ accession: 'added', filedAt: '2026-08-10', type: '13F-HR/A' }),
    ]
    const covers = new Map([
      cover('restated', { isAmendment: true, amendmentKind: 'restatement' }),
      cover('added', { isAmendment: true, amendmentKind: 'add' }),
    ])
    const eff = effectiveFilings(subs, covers, period)
    expect(eff.has('orig')).toBe(false)
    expect(eff.has('restated')).toBe(true)
    expect(eff.has('added')).toBe(true)
  })

  it('an amendment with no readable coverpage is treated as a restatement — the undercounting error', () => {
    const subs = [
      sub({ accession: 'orig', filedAt: '2026-07-15' }),
      sub({ accession: 'mystery', filedAt: '2026-08-01', type: '13F-HR/A' }),
    ]
    const eff = effectiveFilings(subs, new Map(), period)
    expect([...eff.keys()]).toEqual(['mystery'])
  })

  it('an "add" amendment filed before the restatement does not survive it', () => {
    const subs = [
      sub({ accession: 'orig', filedAt: '2026-07-15' }),
      sub({ accession: 'early-add', filedAt: '2026-07-20', type: '13F-HR/A' }),
      sub({ accession: 'restated', filedAt: '2026-08-01', type: '13F-HR/A' }),
    ]
    const covers = new Map([
      cover('early-add', { isAmendment: true, amendmentKind: 'add' }),
      cover('restated', { isAmendment: true, amendmentKind: 'restatement' }),
    ])
    expect([...effectiveFilings(subs, covers, period).keys()]).toEqual(['restated'])
  })

  it('filings for another period or of another type never count', () => {
    const subs = [
      sub({ accession: 'target' }),
      sub({ accession: 'old', period: '2026-03-31', cik: '2' }),
      sub({ accession: 'notice', type: '13F-NT', cik: '3' }),
    ]
    expect([...effectiveFilings(subs, new Map(), period).keys()]).toEqual(['target'])
  })
})

describe('foldInfoRow', () => {
  const effective = new Map([['a', '1']])

  it('folds only plain share rows of effective filings', () => {
    const totals = new Map()
    foldInfoRow(totals, info({ shares: 100, valueUsd: 20_000 }), effective)
    foldInfoRow(totals, info({ shares: 50, valueUsd: 10_000 }), effective) // same manager, accumulates
    foldInfoRow(totals, info({ shares: 999, sharesType: 'PRN' }), effective) // bond principal
    foldInfoRow(totals, info({ shares: 999, putCall: 'Put' }), effective) // an option on the shares
    foldInfoRow(totals, info({ shares: 999, accession: 'not-effective' }), effective)
    foldInfoRow(totals, info({ shares: 0 }), effective)
    foldInfoRow(totals, info({ shares: NaN }), effective)
    expect(totals.get('037833100')?.get('1')).toEqual({ shares: 150, valueUsd: 30_000 })
    expect(totals.get('037833100')?.size).toBe(1)
  })
})

describe('aggregate', () => {
  it('totals per CUSIP, counts holders, and ranks the top N by shares', () => {
    const totals = new Map([
      ['037833100', new Map([
        ['1', { shares: 300, valueUsd: 3 }],
        ['2', { shares: 500, valueUsd: 5 }],
        ['3', { shares: 100, valueUsd: 1 }],
      ])],
    ])
    const names = new Map([['1', 'Alpha'], ['2', 'Beta']])
    const out = aggregate(totals, names, 2)
    const agg = out.get('037833100')
    expect(agg?.totalShares).toBe(900)
    expect(agg?.holderCount).toBe(3)
    expect(agg?.topHolders.map((h) => h.name)).toEqual(['Beta', 'Alpha']) // top 2 only
    expect(aggregate(totals, new Map(), 3).get('037833100')?.topHolders[2].name).toBe('CIK 3')
  })
})

// ── CUSIP derivation rules ──────────────────────────────────────────────────

const holding = (o: Partial<HoldingForCusip>): HoldingForCusip => ({
  family: 'Vanguard', asOf: '2026-06-30', name: 'Apple Inc', cusip: '037833100',
  balance: 100, valueUsd: 20_000, ...o,
})

describe('nameMatches', () => {
  it('requires EQUAL cores after stripping trailing corporate suffixes — never a prefix', () => {
    expect(nameMatches('Apple Inc.', 'APPLE INC')).toBe(true)
    expect(nameMatches('Coca-Cola', 'COCA COLA CO/THE')).toBe(true)
    expect(nameMatches('DEERE & CO', 'Deere & Company')).toBe(true)
    expect(nameMatches('HONEYWELL INTERNATIONAL INC', 'Honeywell International Inc')).toBe(true)
    // The measured first-trial failure: a prefix match handed "Apple" the
    // Apple Hospitality REIT's CUSIP as a second survivor.
    expect(nameMatches('Apple Inc.', 'Apple Hospitality REIT Inc')).toBe(false)
    expect(nameMatches('Apple Inc.', 'Big Apple Inc')).toBe(false)
    // Substantive words are identity, only suffixes strip: "Southern Co" is
    // not "Southern Copper", and "Honeywell International" is not "Honeywell".
    expect(nameMatches('SOUTHERN CO', 'Southern Co/The')).toBe(true)
    expect(nameMatches('SOUTHERN CO', 'Southern Copper Corp')).toBe(false)
    expect(nameMatches('HONEYWELL INTERNATIONAL INC', 'Honeywell Corp')).toBe(false)
    // Filers abbreviate CLASS as CL; both spellings normalize alike.
    expect(nameMatches('BERKSHIRE HATHAWAY INC', 'BERKSHIRE HATHAWAY INC CL B')).toBe(true)
  })
})

describe('agreeingFamilies', () => {
  it('counts only families whose implied price sits within the band around the MEDIAN', () => {
    // Two families, prices close: both count.
    expect(agreeingFamilies([
      holding({ family: 'A', balance: 100, valueUsd: 20_000 }),
      holding({ family: 'B', balance: 50, valueUsd: 10_500 }), // $210 vs $200: 5%
    ])).toEqual(['A', 'B'])
    // One filer's unit error does NOT veto the CUSIP the others agree on —
    // the first full run lost MSFT, GOOGL and TSLA to exactly this.
    expect(agreeingFamilies([
      holding({ family: 'A', balance: 100, valueUsd: 20_000 }),
      holding({ family: 'B', balance: 100, valueUsd: 20_200 }),
      holding({ family: 'C', balance: 100, valueUsd: 20 }), // value filed in thousands: implied $0.20
    ])).toEqual(['A', 'B'])
    // Two families wildly apart: the median sits between them, neither is
    // near it, and nothing counts — two disagreeing rows cannot vouch for
    // each other.
    expect(agreeingFamilies([
      holding({ family: 'A', balance: 100, valueUsd: 20_000 }),
      holding({ family: 'B', balance: 100, valueUsd: 1_300 }), // a different company's price
    ])).toEqual([])
    // A row with no usable price and value counts no family.
    expect(agreeingFamilies([
      holding({ family: 'A', balance: 100, valueUsd: 20_000 }),
      holding({ family: 'B', balance: null, valueUsd: null }),
    ])).toEqual(['A'])
    expect(agreeingFamilies([holding({ family: 'A', balance: null, valueUsd: null })])).toEqual([])
  })
})

describe('resolveCusips', () => {
  const catalog = [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'GOOG', name: 'Alphabet' },
    { symbol: 'META', name: 'Meta Platforms' },
  ]

  it('resolves only with two independent fund families on one CUSIP', () => {
    const two = resolveCusips(catalog, [
      holding({ family: 'Vanguard' }),
      holding({ family: 'Invesco' }),
    ])
    expect(two.resolved.get('AAPL')).toEqual({ cusip: '037833100', families: ['Invesco', 'Vanguard'] })

    const one = resolveCusips(catalog, [holding({}), holding({})])
    expect(one.resolved.has('AAPL')).toBe(false)
    expect(one.unresolved.find((u) => u.symbol === 'AAPL')?.reason).toContain('two independent fund families')
  })

  it('class words keep Alphabet\'s two listings apart, and an ambiguous survivor set resolves to nothing', () => {
    const rows = [
      holding({ family: 'Vanguard', name: 'Alphabet Inc Class A', cusip: '02079K305', balance: 10, valueUsd: 2_000 }),
      holding({ family: 'Invesco', name: 'Alphabet Inc Class A', cusip: '02079K305', balance: 20, valueUsd: 4_000 }),
      holding({ family: 'Vanguard', name: 'Alphabet Inc Class C', cusip: '02079K107', balance: 10, valueUsd: 2_010 }),
      holding({ family: 'Invesco', name: 'Alphabet Inc Class C', cusip: '02079K107', balance: 20, valueUsd: 4_020 }),
    ]
    const r = resolveCusips(catalog, rows)
    expect(r.resolved.get('GOOGL')?.cusip).toBe('02079K305')
    expect(r.resolved.get('GOOG')?.cusip).toBe('02079K107')

    // A classless symbol whose rows carry two CUSIPs that each pass every
    // check resolves to NOTHING — ambiguity refuses, it never picks.
    const amb = resolveCusips([{ symbol: 'FOO', name: 'Foo' }], [
      holding({ family: 'Vanguard', name: 'Foo Inc', cusip: '111111111', balance: 10, valueUsd: 2_000 }),
      holding({ family: 'Invesco', name: 'Foo Inc', cusip: '111111111', balance: 20, valueUsd: 4_000 }),
      holding({ family: 'Vanguard', name: 'Foo Inc', cusip: '222222222', balance: 10, valueUsd: 2_010 }),
      holding({ family: 'Invesco', name: 'Foo Inc', cusip: '222222222', balance: 20, valueUsd: 4_020 }),
    ])
    expect(amb.resolved.size).toBe(0)
    expect(amb.unresolved[0].reason).toContain('ambiguous')
  })

  it('another company\'s class words do not poison a classless symbol (Meta is Class A)', () => {
    const r = resolveCusips(catalog, [
      holding({ family: 'Vanguard', name: 'Meta Platforms Inc Class A', cusip: '30303M102' }),
      holding({ family: 'Invesco', name: 'Meta Platforms Inc Class A', cusip: '30303M102', balance: 50, valueUsd: 10_000 }),
    ])
    expect(r.resolved.get('META')?.cusip).toBe('30303M102')
  })

  it('reads a filer\'s "CL B" as that symbol\'s class words', () => {
    const r = resolveCusips([{ symbol: 'BRK-B', name: 'BERKSHIRE HATHAWAY INC' }], [
      holding({ family: 'Vanguard', name: 'Berkshire Hathaway Inc Class B', cusip: '084670702', balance: 10, valueUsd: 4_870 }),
      holding({ family: 'Invesco', name: 'BERKSHIRE HATHAWAY INC CL B', cusip: '084670702', balance: 20, valueUsd: 9_740 }),
    ])
    expect(r.resolved.get('BRK-B')?.cusip).toBe('084670702')
  })

  it('two families at irreconcilable prices cannot vouch for the CUSIP', () => {
    const r = resolveCusips(catalog, [
      holding({ family: 'Vanguard', balance: 100, valueUsd: 20_000 }),
      holding({ family: 'Invesco', balance: 100, valueUsd: 2_000 }), // 10× apart: not the same security
    ])
    expect(r.resolved.has('AAPL')).toBe(false)
    expect(r.unresolved.find((u) => u.symbol === 'AAPL')?.reason).toContain('agreeing per-share prices')
  })

  it('a class-share symbol outside CLASS_WORDS fails loudly instead of resolving', () => {
    const r = resolveCusips([{ symbol: 'HEI-A', name: 'Heico' }], [])
    expect(r.unresolved[0].reason).toContain('CLASS_WORDS')
    expect(CLASS_WORDS['BRK-B']).toBe('class b') // the ones the catalog needs today
    expect(CLASS_WORDS.GOOGL).toBe('class a')
  })
})

// ── Pass 2: the 13F set's class titles decide what fund names cannot ────────
// Measured on the full run: filers name BOTH Berkshire lines "Berkshire
// Hathaway Inc" (one at ~$500, one at ~$749,000), so no fund-name rule can
// separate them — but the 13F set titles them "COM CL B" / "COM CL A".

describe('classCandidateCusips + cusipForClassByTitles', () => {
  const rows = [
    holding({ family: 'Vanguard', name: 'Berkshire Hathaway Inc', cusip: '084670702', balance: 10, valueUsd: 5_000 }),
    holding({ family: 'Invesco', name: 'Berkshire Hathaway Inc', cusip: '084670702', balance: 20, valueUsd: 10_000 }),
    holding({ family: 'Vanguard', name: 'Berkshire Hathaway Inc', cusip: '084670108', balance: 1, valueUsd: 749_000 }),
    holding({ family: 'Invesco', name: 'Berkshire Hathaway Inc', cusip: '084670108', balance: 2, valueUsd: 1_498_000 }),
  ]

  it('collects every name-core candidate that clears the family and price checks', () => {
    const candidates = classCandidateCusips({ symbol: 'BRK-B', name: 'BERKSHIRE HATHAWAY INC' }, rows)
    expect(candidates.map((c) => c.cusip).sort()).toEqual(['084670108', '084670702'])
  })

  it('the dominant 13F class title decides — and anything short of one clear match refuses', () => {
    const candidates = classCandidateCusips({ symbol: 'BRK-B', name: 'BERKSHIRE HATHAWAY INC' }, rows)
    const tallies = new Map([
      ['084670702', new Map([['COM CL B', 120], ['CL B', 30]])],
      ['084670108', new Map([['COM CL A', 40]])],
    ])
    expect(cusipForClassByTitles('class b', candidates, tallies)).toBe('084670702')
    // Two candidates both titled with the class word: refuse.
    expect(cusipForClassByTitles('class b', candidates, new Map([
      ['084670702', new Map([['COM CL B', 120]])],
      ['084670108', new Map([['CL B NEW', 50]])],
    ]))).toBeNull()
    // Too few title rows to trust.
    expect(cusipForClassByTitles('class b', candidates, new Map([
      ['084670702', new Map([['COM CL B', 2]])],
    ]))).toBeNull()
  })
})

// ── The generated file, and the clock and wording the surfaces show ─────────

describe('stockHolders.generated.json', () => {
  const file = GENERATED as unknown as StockHoldersFile

  it('the provenance clock matches the file it describes', () => {
    expect(file.builtOn).toBe(STOCK_HOLDERS_BUILT_ON)
    expect(getStockHoldersProvenance(new Date(`${STOCK_HOLDERS_BUILT_ON}T12:00:00Z`)).stale).toBe(false)
  })

  it('every entry keeps the build\'s own rules: a reviewed CUSIP, two families, dated fund rows', () => {
    const entries = Object.entries(file.stocks)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.length + file.unresolved.length).toBeGreaterThanOrEqual(79)
    for (const [symbol, e] of entries) {
      expect(e.cusip, symbol).toMatch(/^[0-9A-Z]{9}$/)
      expect(e.cusipFamilies.length, symbol).toBeGreaterThanOrEqual(2)
      expect(['fund-names', '13f-class-title'], symbol).toContain(e.cusipVia)
      for (const f of e.funds) {
        expect(f.asOf, `${symbol} fund ${f.symbol}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(f.shares, `${symbol} fund ${f.symbol}`).toBeGreaterThan(0)
      }
      if (e.institutional) {
        expect(e.institutional.totalShares, symbol).toBeGreaterThan(0)
        expect(e.institutional.topHolders.length, symbol).toBeLessThanOrEqual(10)
        expect(e.institutional.holderCount, symbol).toBeGreaterThanOrEqual(e.institutional.topHolders.length)
      }
    }
  })

  it('pins the identifiers independent sources agree on, and the class decisions', () => {
    expect(file.stocks.AAPL.cusip).toBe('037833100') // confirmed by two fund families' filings
    expect(file.stocks.AAPL.multiClass).toBe(false)
    expect(file.stocks['BRK-B'].cusip).toBe('084670702') // the ~$500 B line, not the ~$749,000 A line
    expect(file.stocks['BRK-B'].cusipVia).toBe('13f-class-title')
    expect(file.stocks['BRK-B'].multiClass).toBe(true)
    expect(file.stocks.GOOGL.cusip).toBe('02079K305') // the Class A line
    expect(file.stocks.GOOGL.multiClass).toBe(true)
  })
})

describe('wording and arithmetic the cards show', () => {
  it('institutionalPctOfOutstanding divides and refuses honestly', () => {
    expect(institutionalPctOfOutstanding(9_700_000_000, 14_532_259_000)).toBeCloseTo(66.75, 1)
    expect(institutionalPctOfOutstanding(1, null)).toBeNull()
    expect(institutionalPctOfOutstanding(1, 0)).toBeNull()
  })

  it('the notes derive their figures and say the lags', () => {
    expect(fundHoldersScopeNote(103)).toContain('the 103 funds this app tracks')
    expect(fundHoldersScopeNote(103)).toContain('60 days')
    expect(thirteenFPeriodNote('2026-06-30')).toContain('quarter ended 2026-06-30')
    expect(thirteenFPeriodNote('2026-06-30')).toContain('45 days')
    expect(unresolvedInPlainWords(null)).toContain('catalog')
    expect(unresolvedInPlainWords('ambiguous: 2 CUSIPs')).toContain('more than one possible')
    expect(unresolvedInPlainWords('no filing row names the company')).toContain('left out rather than guessed')
  })
})

describe('wiring (drift fails, not review)', () => {
  it('the route serves the generated file and fetches nothing at request time', () => {
    const src = read('src/app/live-data/stock-holders/route.ts')
    expect(src).toContain("from '@/lib/data/stockHolders.generated.json'")
    expect(src).not.toMatch(/\bfetch\(/)
  })

  it('the company-facts route computes the share structure from the same facts file', () => {
    const src = read('src/app/live-data/company-facts/route.ts')
    expect(src).toContain('computeShareStructure(gaap, dei)')
    expect(src).toContain('shareStructure: null') // the failure path carries the field too
  })

  it('the stock page mounts both sections, and the cards render every honesty note', () => {
    expect(read('src/app/(dashboard)/equities/[symbol]/page.tsx')).toContain('<StockOwnershipCards symbol={symbol} />')
    const cards = read('src/components/markets/StockOwnershipCards.tsx')
    for (const name of [
      'INSTITUTIONAL_AS_FILED_NOTE', 'TREASURY_NOT_REPORTED_NOTE', 'STRUCTURE_DATES_DIFFER_NOTE',
      'MULTI_CLASS_NO_PCT_NOTE', 'MULTI_CLASS_COUNTS_NOTE',
      'fundHoldersScopeNote', 'thirteenFPeriodNote', 'unresolvedInPlainWords',
    ]) expect(cards).toContain(name)
  })

  it('the data-methods page carries the section, dated (D163: same PR as the figures)', () => {
    const methods = read('src/lib/legal/dataMethods.ts')
    expect(methods).toContain("id: 'stock-ownership'")
    expect(methods).toContain('Form 13F')
  })
})
