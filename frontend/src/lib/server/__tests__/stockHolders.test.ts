import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isoFromSetDate, normalizeAmendmentKind, dominantPeriod, effectiveFilings, foldInfoRow, aggregate,
  type SubmissionRow, type CoverRow, type InfoRow,
} from '../../../../scripts/lib/form13f'
import {
  CLASS_WORDS, MIN_F13_NAME_ROWS, agreeingFamilies, classWordFor, nameMatches,
  remainingCandidate, resolveListed, type F13CusipEvidence, type HoldingForCusip,
} from '../../../../scripts/lib/stockCusips'
import { allowedBrowseCount } from '../nport'
import GENERATED from '../../data/stockHolders.generated.json'
import {
  STOCK_HOLDERS_BUILT_ON, fundHoldersScopeNote, getStockHoldersProvenance, hydrateStockHolders,
  institutionalPctOfOutstanding, thirteenFPeriodNote, unresolvedInPlainWords,
  type StockHoldersFile,
} from '../../data/stockHolders'
import { EQUITY_BY_SYMBOL } from '../../data/equityCatalog'

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

describe('resolveListed', () => {
  const listed = (symbol: string, name: string, shareClasses = 1) => ({ symbol, name, shareClasses })
  const ev = (o: { names?: Array<[string, number]>; titles?: Array<[string, number]>; holders?: number; price?: number | null }): F13CusipEvidence => ({
    holderCount: o.holders ?? 100,
    names: new Map(o.names ?? []),
    titles: new Map(o.titles ?? []),
    avgPrice: o.price ?? null,
  })
  const NO_F13 = new Map<string, F13CusipEvidence>()

  it('two independent fund families on one CUSIP resolve it (via fund-names)', () => {
    const r = resolveListed([listed('AAPL', 'Apple Inc.')], [
      holding({ family: 'Vanguard' }),
      holding({ family: 'Invesco' }),
    ], NO_F13)
    expect(r.resolved.get('AAPL')).toEqual({ cusip: '037833100', families: ['Invesco', 'Vanguard'], via: 'fund-names' })
  })

  it('one fund family alone is not enough — unless the 13F filers name the company too', () => {
    const rows = [holding({ family: 'Vanguard' }), holding({ family: 'Vanguard' })]
    const alone = resolveListed([listed('AAPL', 'Apple Inc.')], rows, NO_F13)
    expect(alone.resolved.has('AAPL')).toBe(false)
    expect(alone.unresolved[0].reason).toContain('two independent fund families')

    const corroborated = resolveListed([listed('AAPL', 'Apple Inc.')], rows, new Map([
      ['037833100', ev({ names: [['APPLE INC', 2_000]] })],
    ]))
    expect(corroborated.resolved.get('AAPL')?.via).toBe('fund+13f-names')
  })

  it('the 13F filers carry a CUSIP on their own — a stock no tracked fund holds still resolves', () => {
    const r = resolveListed([listed('SMLL', 'Small Example Corp')], [], new Map([
      ['111111111', ev({ names: [['SMALL EXAMPLE CORP', 12]], titles: [['COM', 12]] })],
    ]))
    expect(r.resolved.get('SMLL')).toEqual({ cusip: '111111111', families: [], via: '13f-names' })
    // Below the filer floor, the 13F set cannot carry it alone.
    const thin = resolveListed([listed('SMLL', 'Small Example Corp')], [], new Map([
      ['111111111', ev({ names: [['SMALL EXAMPLE CORP', MIN_F13_NAME_ROWS - 1]], titles: [['COM', MIN_F13_NAME_ROWS - 1]] })],
    ]))
    expect(thin.resolved.has('SMLL')).toBe(false)
  })

  it('a mismatching 13F name silences the 13F side without vetoing the fund families', () => {
    // 13F filers abbreviate by their own conventions ("TEXAS INSTRS INC",
    // "DISNEY WALT CO" — measured), so a mismatch is not a contradiction:
    // two fund families still carry the CUSIP\u2026
    const rows = [holding({ family: 'Vanguard' }), holding({ family: 'Invesco' })]
    const r = resolveListed([listed('AAPL', 'Apple Inc.')], rows, new Map([
      ['037833100', ev({ names: [['ABBREVIATED SPELLING CO', 500]] })],
    ]))
    expect(r.resolved.get('AAPL')?.via).toBe('fund-names')
    // \u2026but it cannot CORROBORATE a single family, and the preferred/unit/
    // note lines a company\u2019s name also covers never carry a classless
    // listing on titles that say they are not the common stock.
    const one = resolveListed([listed('AAPL', 'Apple Inc.')], [holding({ family: 'Vanguard' })], new Map([
      ['037833100', ev({ names: [['ABBREVIATED SPELLING CO', 500]] })],
    ]))
    expect(one.resolved.has('AAPL')).toBe(false)
    const pfd = resolveListed([listed('NEE2', 'NextEra Energy, Inc.')], [], new Map([
      ['65339F655', ev({ names: [['NEXTERA ENERGY INC', 300]], titles: [['UNIT', 280]] })],
    ]))
    expect(pfd.resolved.has('NEE2')).toBe(false)
  })

  it('class words keep Alphabet\u2019s two listings apart, and ambiguity refuses', () => {
    const rows = [
      holding({ family: 'Vanguard', name: 'Alphabet Inc Class A', cusip: '02079K305', balance: 10, valueUsd: 2_000 }),
      holding({ family: 'Invesco', name: 'Alphabet Inc Class A', cusip: '02079K305', balance: 20, valueUsd: 4_000 }),
      holding({ family: 'Vanguard', name: 'Alphabet Inc Class C', cusip: '02079K107', balance: 10, valueUsd: 2_010 }),
      holding({ family: 'Invesco', name: 'Alphabet Inc Class C', cusip: '02079K107', balance: 20, valueUsd: 4_020 }),
    ]
    const r = resolveListed([listed('GOOGL', 'Alphabet Inc.', 2), listed('GOOG', 'Alphabet Inc.', 2)], rows, NO_F13)
    expect(r.resolved.get('GOOGL')?.cusip).toBe('02079K305')
    expect(r.resolved.get('GOOG')?.cusip).toBe('02079K107')

    // A classless single-class symbol whose rows carry two price-consistent
    // CUSIPs resolves to NOTHING \u2014 ambiguity refuses, it never picks.
    const amb = resolveListed([listed('FOO2', 'Foo')], [
      holding({ family: 'Vanguard', name: 'Foo Inc', cusip: '111111111', balance: 10, valueUsd: 2_000 }),
      holding({ family: 'Invesco', name: 'Foo Inc', cusip: '111111111', balance: 20, valueUsd: 4_000 }),
      holding({ family: 'Vanguard', name: 'Foo Inc', cusip: '222222222', balance: 10, valueUsd: 2_010 }),
      holding({ family: 'Invesco', name: 'Foo Inc', cusip: '222222222', balance: 20, valueUsd: 4_020 }),
    ], NO_F13)
    expect(amb.resolved.size).toBe(0)
    expect(amb.unresolved[0].reason).toContain('ambiguous')
  })

  it('class lines every filer names identically are decided by the 13F set\u2019s own class titles (the Berkshire shape)', () => {
    // Fund rows name BOTH lines "Berkshire Hathaway Inc" \u2014 measured \u2014 so a
    // class-worded symbol has no word-bearing fund row at all; the 13F side
    // carries it, and only where its dominant TITLE carries the class words.
    const rows = [
      holding({ family: 'Vanguard', name: 'Berkshire Hathaway Inc', cusip: '084670702', balance: 10, valueUsd: 5_000 }),
      holding({ family: 'Invesco', name: 'Berkshire Hathaway Inc', cusip: '084670702', balance: 20, valueUsd: 10_000 }),
    ]
    const f13 = new Map([
      ['084670702', ev({ names: [['BERKSHIRE HATHAWAY INC', 4_000]], titles: [['COM CL B', 3_500], ['CL B', 400]] })],
      ['084670108', ev({ names: [['BERKSHIRE HATHAWAY INC DEL', 900]], titles: [['COM CL A', 800]] })],
    ])
    const r = resolveListed([listed('BRK-B', 'BERKSHIRE HATHAWAY INC', 1)], rows, f13)
    expect(r.resolved.get('BRK-B')).toEqual({ cusip: '084670702', families: [], via: '13f-names' })
    // With the B title on BOTH candidates, the conflict refuses.
    const conflicted = new Map([
      ['084670702', ev({ names: [['BERKSHIRE HATHAWAY INC', 4_000]], titles: [['COM CL B', 3_500]] })],
      ['084670108', ev({ names: [['BERKSHIRE HATHAWAY INC', 900]], titles: [['CL B NEW', 800]] })],
    ])
    expect(resolveListed([listed('BRK-B', 'BERKSHIRE HATHAWAY INC', 1)], rows, conflicted).resolved.has('BRK-B')).toBe(false)
  })

  it('a classless listing of a multi-class company takes the one identifier its siblings left (the HEICO shape)', () => {
    // When filers write the class ("Heico Corp Class A"), the sibling-claim
    // filter splits the lines and HEI resolves on its own rows.
    const wordedRows = [
      holding({ family: 'Vanguard', name: 'Heico Corp', cusip: '422806109', balance: 10, valueUsd: 2_500 }),
      holding({ family: 'Invesco', name: 'Heico Corp', cusip: '422806109', balance: 20, valueUsd: 5_000 }),
      holding({ family: 'Vanguard', name: 'Heico Corp Class A', cusip: '422806208', balance: 10, valueUsd: 2_000 }),
      holding({ family: 'Invesco', name: 'Heico Corp Class A', cusip: '422806208', balance: 20, valueUsd: 4_000 }),
    ]
    const stocks = [listed('HEI', 'HEICO CORP', 2), listed('HEI-A', 'HEICO CORP', 2)]
    const split = resolveListed(stocks, wordedRows, NO_F13)
    expect(split.resolved.get('HEI-A')?.cusip).toBe('422806208')
    expect(split.resolved.get('HEI')?.via).toBe('fund-names')

    // When NO filer writes the class anywhere, HEI\u2019s candidates stay
    // ambiguous until HEI-A takes its line through the 13F titles \u2014 then the
    // one identifier left is HEI\u2019s, by elimination, gated on the SEC list\u2019s
    // own share-class count.
    const namelessRows = wordedRows.map((h) => ({ ...h, name: 'Heico Corp' }))
    const f13 = new Map([
      ['422806109', ev({ names: [['HEICO CORP', 600]], titles: [['COM', 550]] })],
      ['422806208', ev({ names: [['HEICO CORP', 400]], titles: [['CL A', 380]] })],
    ])
    const r = resolveListed(stocks, namelessRows, f13)
    expect(r.resolved.get('HEI-A')?.cusip).toBe('422806208')
    expect(r.resolved.get('HEI')?.cusip).toBe('422806109')
    expect(r.resolved.get('HEI')?.via).toBe('sibling-elimination')
    // The same rows for a single-class company stay ambiguous.
    const single = resolveListed([listed('HEI', 'HEICO CORP', 1)], namelessRows, NO_F13)
    expect(single.resolved.has('HEI')).toBe(false)
  })

  it('two listings claiming the same identifier both resolve to nothing (the Blue Owl shape)', () => {
    // Blue Owl Capital INC and Blue Owl Capital CORP are different
    // registrants whose name cores collide once the suffixes strip \u2014
    // measured: both symbols claimed one CUSIP on the first unified run.
    const rows = [
      holding({ family: 'Vanguard', name: 'Blue Owl Capital Inc', cusip: '09581B103', balance: 100, valueUsd: 1_800 }),
      holding({ family: 'Invesco', name: 'Blue Owl Capital Inc', cusip: '09581B103', balance: 200, valueUsd: 3_600 }),
    ]
    const r = resolveListed([
      listed('OWL', 'Blue Owl Capital Inc.'),
      listed('OBDC', 'Blue Owl Capital Corp'),
    ], rows, NO_F13)
    expect(r.resolved.size).toBe(0)
    expect(r.unresolved.filter((u) => u.reason.includes('cannot tell their companies apart'))).toHaveLength(2)
  })

  it('another company\u2019s class words do not poison a classless symbol (Meta is Class A)', () => {
    const r = resolveListed([
      listed('META', 'Meta Platforms, Inc.'),
      listed('GOOGL', 'Alphabet Inc.', 2),
    ], [
      holding({ family: 'Vanguard', name: 'Meta Platforms Inc Class A', cusip: '30303M102' }),
      holding({ family: 'Invesco', name: 'Meta Platforms Inc Class A', cusip: '30303M102', balance: 50, valueUsd: 10_000 }),
    ], NO_F13)
    expect(r.resolved.get('META')?.cusip).toBe('30303M102')
  })

  it('two families at irreconcilable prices cannot vouch for the CUSIP', () => {
    const r = resolveListed([listed('AAPL', 'Apple Inc.')], [
      holding({ family: 'Vanguard', balance: 100, valueUsd: 20_000 }),
      holding({ family: 'Invesco', balance: 100, valueUsd: 2_000 }), // 10\u00d7 apart: not the same security
    ], NO_F13)
    expect(r.resolved.has('AAPL')).toBe(false)
  })

  it('classWordFor reads a dash suffix as the class, and the hand map covers dashless pairs', () => {
    expect(classWordFor('BRK-B')).toBe('class b') // the ticker says its own class
    expect(classWordFor('HEI-A')).toBe('class a')
    expect(classWordFor('LEN-B')).toBe('class b')
    expect(classWordFor('TSLA')).toBeNull() // ends in a letter, but no dash \u2014 single class
    expect(classWordFor('GOOGL')).toBe('class a') // dashless pairs come from the hand map
    expect(classWordFor('GOOG')).toBe('class c')
    expect(classWordFor('FOX')).toBe('class b')
    expect(classWordFor('NWSA')).toBe('class a')
    expect(CLASS_WORDS['BRK-B']).toBeUndefined() // dash symbols need no hand entry
  })

  it('sibling elimination takes the one candidate left \u2014 and refuses anything else', () => {
    const candidates = [
      { cusip: '111111111', families: ['Vanguard', 'Invesco'] },
      { cusip: '222222222', families: ['Vanguard', 'iShares'] },
    ]
    expect(remainingCandidate(candidates, new Set(['111111111']))).toEqual({ cusip: '222222222', families: ['Vanguard', 'iShares'] })
    expect(remainingCandidate(candidates, new Set())).toBeNull() // two left: still ambiguous
    expect(remainingCandidate(candidates, new Set(['111111111', '222222222']))).toBeNull() // none left
  })
})

// ── The generated file, and the clock and wording the surfaces show ─────────

describe('stockHolders.generated.json', () => {
  const file = GENERATED as unknown as StockHoldersFile

  it('the provenance clock matches the file it describes', () => {
    expect(file.builtOn).toBe(STOCK_HOLDERS_BUILT_ON)
    expect(getStockHoldersProvenance(new Date(`${STOCK_HOLDERS_BUILT_ON}T12:00:00Z`)).stale).toBe(false)
  })

  it('covers the listed universe, not just the catalog (the owner\'s 2026-11-24 confirmation ask)', () => {
    const covered = Object.keys(file.stocks).length
    expect(covered).toBeGreaterThan(3_000) // thousands of NYSE & Nasdaq common stocks, not 79
    expect(file.universe.listed).toBeGreaterThanOrEqual(covered)
    expect(file.universe.source).toContain('company_tickers_exchange.json')
    // Every catalog stock is in (the original scope survives the widening)…
    const catalogSymbols = Object.keys(EQUITY_BY_SYMBOL)
    for (const s of catalogSymbols) expect(file.stocks[s], s).toBeDefined()
    // …and so are plenty of stocks beyond it.
    expect(covered - catalogSymbols.length).toBeGreaterThan(2_000)
  })

  it('every entry keeps the build\'s own rules: a reviewed CUSIP, two families, dated fund rows', () => {
    const entries = Object.entries(file.stocks)
    expect(entries.length).toBeGreaterThan(0)
    for (const [symbol, e] of entries) {
      expect(e.cusip, symbol).toMatch(/^[0-9A-Z]{9}$/)
      expect(['fund-names', 'fund+13f-names', '13f-names', 'sibling-elimination'], symbol).toContain(e.cusipVia)
      // How many independent fund families must back the CUSIP depends on
      // which filings settled it; a pure-13F resolution can have none.
      const familyFloor = e.cusipVia === 'fund-names' ? 2 : e.cusipVia === 'fund+13f-names' ? 1 : 0
      expect(e.cusipFamilies.length, symbol).toBeGreaterThanOrEqual(familyFloor)
      for (const [fundSymbol, shares, , , asOf] of e.funds) {
        expect(asOf, `${symbol} fund ${fundSymbol}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(shares, `${symbol} fund ${fundSymbol}`).toBeGreaterThan(0)
      }
      if (e.institutional) {
        expect(e.institutional.totalShares, symbol).toBeGreaterThan(0)
        expect(e.institutional.top.length, symbol).toBeLessThanOrEqual(10)
        expect(e.institutional.holderCount, symbol).toBeGreaterThanOrEqual(e.institutional.top.length)
      }
    }
  })

  it('no two symbols share a CUSIP, and every top holder\'s name is in the managers dictionary', () => {
    const seen = new Map<string, string>()
    for (const [symbol, e] of Object.entries(file.stocks)) {
      const prior = seen.get(e.cusip)
      expect(prior, `${symbol} and ${prior} share ${e.cusip}`).toBeUndefined()
      seen.set(e.cusip, symbol)
      for (const [cik] of e.institutional?.top ?? []) {
        expect(file.managers[cik], `${symbol} holder CIK ${cik}`).toBeTruthy()
      }
    }
  })

  it('pins the identifiers independent sources agree on, and the class decisions', () => {
    expect(file.stocks.AAPL.cusip).toBe('037833100') // confirmed by two fund families' filings
    expect(file.stocks.AAPL.multiClass).toBe(false)
    expect(file.stocks['BRK-B'].cusip).toBe('084670702') // the ~$500 B line, not the ~$749,000 A line
    expect(['13f-names', 'fund+13f-names'], 'BRK-B via').toContain(file.stocks['BRK-B'].cusipVia)
    expect(file.stocks['BRK-B'].multiClass).toBe(true)
    expect(file.stocks.GOOGL.cusip).toBe('02079K305') // the Class A line
    expect(file.stocks.GOOGL.multiClass).toBe(true)
  })

  it('hydrating a stock puts names and field words back on the compact rows', () => {
    const aapl = hydrateStockHolders(file, 'AAPL')
    expect(aapl).not.toBeNull()
    expect(aapl!.institutional!.topHolders[0].name).toBeTruthy()
    expect(aapl!.institutional!.topHolders[0].name).not.toMatch(/^CIK /)
    expect(aapl!.funds[0].symbol).toBeTruthy()
    expect(aapl!.funds[0].asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(hydrateStockHolders(file, 'NOT-A-TICKER')).toBeNull()
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
    expect(unresolvedInPlainWords(null)).toContain('NYSE and Nasdaq')
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
