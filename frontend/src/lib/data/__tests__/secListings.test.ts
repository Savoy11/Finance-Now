import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  NO_WIDE_FILTERS, dividendForScreen, filterWide, listedExchange, looksLikeFundName, normalizeTicker,
  parseExchangeFile, rankSearch, selectCommonListings, sortWide, type SecExchangeRow, type WideRow,
} from '../secListings'

// T-450 (D205): the Stock Registry's wider list, every NYSE and Nasdaq common stock the SEC
// names. The rows below are shaped like the SEC's company_tickers_exchange.json; the names are
// real companies, the tickers their real ones, so a reader can check a rule against the market.

const row = (cik: number, name: string, ticker: string, exchange: string | null): SecExchangeRow => ({ cik, name, ticker, exchange })

describe('reading the SEC’s file', () => {
  it('finds the columns by name, so a reordering does not shift them', () => {
    const rows = parseExchangeFile({
      fields: ['ticker', 'exchange', 'name', 'cik'],
      data: [['AAPL', 'Nasdaq', 'Apple Inc.', 320193]],
    })
    expect(rows).toEqual([{ cik: 320193, name: 'Apple Inc.', ticker: 'AAPL', exchange: 'Nasdaq' }])
  })

  it('reads the SEC’s own order of columns, with a missing exchange as null', () => {
    const rows = parseExchangeFile({
      fields: ['cik', 'name', 'ticker', 'exchange'],
      data: [[320193, 'Apple Inc.', 'AAPL', 'Nasdaq'], [1000045, 'NICHOLAS FINANCIAL INC', 'NICK', null], [0, 'bad', 'X', 'NYSE'], 'not a row'],
    })
    expect(rows).toEqual([
      { cik: 320193, name: 'Apple Inc.', ticker: 'AAPL', exchange: 'Nasdaq' },
      { cik: 1000045, name: 'NICHOLAS FINANCIAL INC', ticker: 'NICK', exchange: null },
    ])
  })

  it('refuses a file without the four columns rather than reading it by position', () => {
    expect(parseExchangeFile({ fields: ['cik', 'name', 'ticker'], data: [[1, 'A', 'A']] })).toBeNull()
    expect(parseExchangeFile({ data: [] })).toBeNull()
    expect(parseExchangeFile(null)).toBeNull()
    expect(parseExchangeFile([])).toBeNull()
  })

  it('names the two exchanges however they are written, and nothing else', () => {
    expect(listedExchange('NYSE')).toBe('NYSE')
    expect(listedExchange(' nasdaq ')).toBe('Nasdaq')
    expect(listedExchange('OTC')).toBeNull()
    expect(listedExchange('CBOE')).toBeNull()
    expect(listedExchange(null)).toBeNull()
  })

  it('writes a class letter after a dash, the app’s form', () => {
    expect(normalizeTicker('brk.b')).toBe('BRK-B')
    expect(normalizeTicker(' BF/B ')).toBe('BF-B')
  })
})

describe('which listings count: NYSE and Nasdaq common stock (owner, D205)', () => {
  const noFunds = (_s: string, _n: string) => false
  const pick = (rows: SecExchangeRow[], isFund = noFunds, keep?: (s: string) => boolean) => selectCommonListings(rows, isFund, keep)

  it('keeps NYSE and Nasdaq listings and counts the rest as listed elsewhere', () => {
    const { listings, leftOut } = pick([
      row(320193, 'Apple Inc.', 'AAPL', 'Nasdaq'),
      row(19617, 'JPMORGAN CHASE & CO', 'JPM', 'NYSE'),
      row(1001, 'Some OTC Co', 'SOTC', 'OTC'),
      row(1002, 'Cboe-listed Co', 'CBX', 'CBOE'),
      row(1003, 'No exchange Co', 'NOEX', null),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['AAPL', 'JPM'])
    expect(leftOut['other-exchange']).toBe(3)
  })

  it('keeps a class share written with one letter after a dash', () => {
    const { listings } = pick([
      row(1067983, 'BERKSHIRE HATHAWAY INC', 'BRK-B', 'NYSE'),
      row(1067983, 'BERKSHIRE HATHAWAY INC', 'BRK-A', 'NYSE'),
      row(14693, 'BROWN FORMAN CORP', 'BF-B', 'NYSE'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['BRK-B', 'BRK-A', 'BF-B'])
  })

  it('leaves out preferred series, warrants and units written with a longer suffix', () => {
    const { listings, leftOut } = pick([
      row(19617, 'JPMORGAN CHASE & CO', 'JPM', 'NYSE'),
      row(19617, 'JPMORGAN CHASE & CO', 'JPM-PD', 'NYSE'),
      row(2001, 'A SPAC Corp', 'SPAC-WT', 'NYSE'),
      row(2001, 'A SPAC Corp', 'SPAC-UN', 'NYSE'),
      row(2002, 'Digits Co', 'AB1', 'Nasdaq'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['JPM'])
    expect(leftOut['not-common']).toBe(4)
  })

  it('reads a single -P, -R, -U or -W after a dash as a preferred share, right, unit or warrant', () => {
    // As the SEC writes them: Entergy Texas's and Tri-Continental's preferred are ETI-P and TY-P,
    // and a unit written ALDF.U arrives as ALDF-U once the dot is read as a dash.
    const { listings, leftOut } = pick([
      row(1427437, 'ENTERGY TEXAS, INC.', 'ETI-P', 'NYSE'),
      row(99188, 'TRI-CONTINENTAL Corp', 'TY-P', 'NYSE'),
      row(6001, 'Aldel Acquisition', 'ALDF.U', 'NYSE'),
      row(6002, 'Rights Co', 'RTS-R', 'NYSE'),
      row(6003, 'Warrants Co', 'WTS-W', 'NYSE'),
      row(63754, 'MCCORMICK & CO INC', 'MKC-V', 'NYSE'),
      row(1645590, 'PETROBRAS', 'PBR-A', 'NYSE'),
      row(1124198, 'ENERGY CO OF MINAS GERAIS', 'CIG-C', 'NYSE'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['MKC-V', 'PBR-A', 'CIG-C'])
    expect(leftOut['not-common']).toBe(5)
  })

  it('leaves out a preferred share, note, right, unit or warrant beside the company’s own ticker', () => {
    const { listings, leftOut } = pick([
      row(1423689, 'AGNC Investment Corp.', 'AGNC', 'Nasdaq'),
      row(1423689, 'AGNC Investment Corp.', 'AGNCP', 'Nasdaq'),
      row(1423689, 'AGNC Investment Corp.', 'AGNCM', 'Nasdaq'),
      row(1423689, 'AGNC Investment Corp.', 'AGNCL', 'Nasdaq'),
      row(1423689, 'AGNC Investment Corp.', 'AGNCZ', 'Nasdaq'),
      row(3001, 'Acquisition Corp', 'ACQR', 'Nasdaq'),
      row(3001, 'Acquisition Corp', 'ACQRU', 'Nasdaq'),
      row(3001, 'Acquisition Corp', 'ACQRW', 'Nasdaq'),
      row(3001, 'Acquisition Corp', 'ACQRR', 'Nasdaq'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['AGNC', 'ACQR'])
    expect(leftOut['not-common']).toBe(7)
  })

  it('keeps a second class lettered A, B, C or K beside the company’s own ticker', () => {
    const { listings } = pick([
      row(1754301, 'Fox Corp', 'FOXA', 'Nasdaq'),
      row(1754301, 'Fox Corp', 'FOX', 'Nasdaq'),
      row(887733, 'CENTRAL GARDEN & PET CO', 'CENT', 'Nasdaq'),
      row(887733, 'CENTRAL GARDEN & PET CO', 'CENTA', 'Nasdaq'),
      row(1712184, 'Liberty Latin America Ltd.', 'LILA', 'Nasdaq'),
      row(1712184, 'Liberty Latin America Ltd.', 'LILAK', 'Nasdaq'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['FOXA', 'FOX', 'CENT', 'CENTA', 'LILA', 'LILAK'])
  })

  it('leaves out notes and exchange-traded notes a company lists under its own number', () => {
    // From the SEC's list as the app had it on 2026-11-06: JPMorgan's ETNs, Bank of Montreal's
    // leveraged notes, Southern Co's and Duke's notes, KKR's notes. Each sits after the
    // company's main ticker and is not a class of it.
    const { listings, leftOut } = pick([
      row(19617, 'JPMORGAN CHASE & CO', 'JPM', 'NYSE'),
      row(927628, 'BANK OF MONTREAL /CAN/', 'BMO', 'NYSE'),
      row(92122, 'SOUTHERN CO', 'SO', 'NYSE'),
      row(1326160, 'Duke Energy CORP', 'DUK', 'NYSE'),
      row(1404912, 'KKR & Co. Inc.', 'KKR', 'NYSE'),
      row(19617, 'JPMORGAN CHASE & CO', 'AMJB', 'NYSE'),
      row(19617, 'JPMORGAN CHASE & CO', 'VYLD', 'NYSE'),
      row(927628, 'BANK OF MONTREAL /CAN/', 'FNGU', 'NYSE'),
      row(92122, 'SOUTHERN CO', 'SOJC', 'NYSE'),
      row(1326160, 'Duke Energy CORP', 'DUKB', 'NYSE'),
      row(1404912, 'KKR & Co. Inc.', 'KKRS', 'NYSE'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['JPM', 'BMO', 'SO', 'DUK', 'KKR'])
    expect(leftOut['not-common']).toBe(6)
  })

  it('keeps every class of a company’s main stock, however the exchange writes it', () => {
    const { listings } = pick([
      row(1067983, 'BERKSHIRE HATHAWAY INC', 'BRK-B', 'NYSE'),
      row(1567892, 'News Corp', 'NWSA', 'Nasdaq'),
      row(1611983, 'Liberty Broadband Corp', 'LBRDK', 'Nasdaq'),
      row(1645590, 'PETROBRAS', 'PBR', 'NYSE'),
      row(1336917, 'Under Armour, Inc.', 'UAA', 'NYSE'),
      row(1067983, 'BERKSHIRE HATHAWAY INC', 'BRK-A', 'NYSE'),
      row(1567892, 'News Corp', 'NWS', 'Nasdaq'),
      row(1611983, 'Liberty Broadband Corp', 'LBRDA', 'Nasdaq'),
      row(1645590, 'PETROBRAS', 'PBR-A', 'NYSE'),
      row(1336917, 'Under Armour, Inc.', 'UA', 'NYSE'),
    ])
    expect(listings.map((l) => l.symbol)).toEqual(['BRK-B', 'NWSA', 'LBRDK', 'PBR', 'UAA', 'BRK-A', 'NWS', 'LBRDA', 'PBR-A', 'UA'])
    expect(listings.every((l) => l.shareClasses === 2)).toBe(true)
  })

  it('keeps GOOGL, an L beside GOOG, only because it is curated', () => {
    const rows = [row(1652044, 'Alphabet Inc.', 'GOOGL', 'Nasdaq'), row(1652044, 'Alphabet Inc.', 'GOOG', 'Nasdaq')]
    expect(pick(rows).listings.map((l) => l.symbol)).toEqual(['GOOG'])
    expect(pick(rows, noFunds, (s) => s === 'GOOGL').listings.map((l) => l.symbol)).toEqual(['GOOGL', 'GOOG'])
  })

  it('needs the sibling: a five-letter ticker ending in W with no shorter ticker beside it stays', () => {
    // Plenty of commons end in W, U or R (a name, not a security type): the rule fires only
    // when the company also lists the four-letter stem.
    const { listings } = pick([row(4001, 'Widgetco', 'WIDGW', 'Nasdaq')])
    expect(listings.map((l) => l.symbol)).toEqual(['WIDGW'])
  })

  it('leaves out funds: a ticker the app knows as one, or a name saying ETF, ETN or Fund', () => {
    const known = new Set(['GLD'])
    const { listings, leftOut } = pick([
      row(1222333, 'SPDR GOLD TRUST', 'GLD', 'NYSE'),
      row(1980994, 'iShares Bitcoin Trust ETF', 'IBIT', 'Nasdaq'),
      row(1559909, 'PIMCO Dynamic Income Fund', 'PDI', 'NYSE'),
      row(5001, 'Some Exchange-Traded Notes', 'XNOTE', 'NYSE'),
      row(1591763, 'Fundamental Global Inc.', 'FGF', 'Nasdaq'),
      row(1018724, 'AMAZON COM INC', 'AMZN', 'Nasdaq'),
    ], (s) => known.has(s))
    expect(listings.map((l) => l.symbol)).toEqual(['FGF', 'AMZN'])
    expect(leftOut.fund).toBe(4)
  })

  it('never leaves out a curated stock, whatever the rules would say', () => {
    const { listings } = pick([row(9001, 'A Curated Fund-Named Co', 'CURA', 'NYSE')], () => true, (s) => s === 'CURA')
    expect(listings.map((l) => l.symbol)).toEqual(['CURA'])
  })

  it('keeps the file’s own order, one row per ticker, and counts a company’s listed classes', () => {
    const { listings } = pick([
      row(1652044, 'Alphabet Inc.', 'GOOGL', 'Nasdaq'),
      row(320193, 'Apple Inc.', 'AAPL', 'Nasdaq'),
      row(1652044, 'Alphabet Inc.', 'GOOG', 'Nasdaq'),
      row(320193, 'Apple Inc.', 'AAPL', 'Nasdaq'),
    ], noFunds, (s) => s === 'GOOGL')
    expect(listings.map((l) => [l.symbol, l.shareClasses])).toEqual([['GOOGL', 2], ['AAPL', 1], ['GOOG', 2]])
  })

  it('reads a fund’s name as a fund only on the whole word', () => {
    expect(looksLikeFundName('Vanguard Total Stock Market ETF')).toBe(true)
    expect(looksLikeFundName('iPath Series B ETNs')).toBe(true)
    expect(looksLikeFundName('Adams Diversified Equity Fund, Inc.')).toBe(true)
    expect(looksLikeFundName('An exchange-traded product')).toBe(true)
    expect(looksLikeFundName('Fundamental Global Inc.')).toBe(false)
    expect(looksLikeFundName('Refunds Inc')).toBe(false)
  })
})

describe('screening the wider list on the SEC figures', () => {
  const r = (symbol: string, over: Partial<WideRow> = {}): WideRow => ({
    symbol, name: `${symbol} Corp`, exchange: 'NYSE', eps: null, dividendsPerShare: null, dividendState: 'unknown', shares: null, ...over,
  })
  const rows: WideRow[] = [
    r('AAA', { eps: 5, dividendsPerShare: 2, dividendState: 'paid', shares: { val: 2_000_000_000 } }),
    r('BBB', { exchange: 'Nasdaq', eps: -1, dividendState: 'none', shares: { val: 50_000_000 } }),
    r('CCC', { eps: 1.5, dividendState: 'unknown', shares: { val: 300_000_000 } }),
    r('DDD', { exchange: 'Nasdaq', name: 'Ford-ish Motors' }),
  ]

  it('filters on exchange, earnings, dividends and share count', () => {
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, exchange: 'Nasdaq' }).map((x) => x.symbol)).toEqual(['BBB', 'DDD'])
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, epsMin: 0 }).map((x) => x.symbol)).toEqual(['AAA', 'CCC'])
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, withEarningsOnly: true }).map((x) => x.symbol)).toEqual(['AAA', 'BBB', 'CCC'])
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, payersOnly: true }).map((x) => x.symbol)).toEqual(['AAA'])
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, sharesMinM: 100, sharesMaxM: 1000 }).map((x) => x.symbol)).toEqual(['CCC'])
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, query: 'ford' }).map((x) => x.symbol)).toEqual(['DDD'])
  })

  it('counts a company paying none as 0 dividends, and leaves an unknown figure out of any bound', () => {
    expect(dividendForScreen({ dividendState: 'none', dividendsPerShare: null })).toBe(0)
    expect(dividendForScreen({ dividendState: 'unknown', dividendsPerShare: null })).toBeNull()
    expect(filterWide(rows, { ...NO_WIDE_FILTERS, dpsMax: 1 }).map((x) => x.symbol)).toEqual(['BBB'])
  })

  it('keeps the SEC’s order for the list sort, and reverses it on the second click', () => {
    expect(sortWide(rows, 'list', true).map((x) => x.symbol)).toEqual(['AAA', 'BBB', 'CCC', 'DDD'])
    expect(sortWide(rows, 'list', false).map((x) => x.symbol)).toEqual(['DDD', 'CCC', 'BBB', 'AAA'])
  })

  it('sorts a missing figure last whichever way the column runs', () => {
    expect(sortWide(rows, 'eps', false).map((x) => x.symbol)).toEqual(['AAA', 'CCC', 'BBB', 'DDD'])
    expect(sortWide(rows, 'eps', true).map((x) => x.symbol)).toEqual(['BBB', 'CCC', 'AAA', 'DDD'])
    expect(sortWide(rows, 'dps', false).map((x) => x.symbol)).toEqual(['AAA', 'BBB', 'CCC', 'DDD'])
    expect(sortWide(rows, 'shares', false).map((x) => x.symbol)).toEqual(['AAA', 'CCC', 'BBB', 'DDD'])
  })

  it('does not sort or screen on a price over the whole list: the screen reads no price at all', () => {
    // Only the rows on screen have a live quote, so a sort or filter on price, market cap,
    // P/E or yield would order fifty stocks as though it had seen thousands. The wider list's
    // sort keys and filters are the SEC figures alone.
    const src = readFileSync(join(process.cwd(), 'src/lib/data/secListings.ts'), 'utf8')
    const block = src.slice(src.indexOf('export const WIDE_SORT_KEYS'), src.indexOf('export type WideSortKey'))
    expect(block).not.toMatch(/price|marketCap|pe\b|yield/i)
    const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/equities/SecWideList.tsx'), 'utf8')
    for (const label of ['Price', 'Chg %', 'Mkt Cap', 'P/E', 'Yield']) {
      expect(page).toContain(`<OnScreenHeader label="${label}" />`)
      expect(page).not.toContain(`<SortHeader label="${label}"`)
    }
    expect(page).not.toMatch(/RangeFilter label="(Price|Mkt cap|P\/E|Yield)/i)
  })
})

describe('search over thousands of stocks', () => {
  const pool = [
    { symbol: 'FCX', name: 'Freeport-McMoRan Inc.' },
    { symbol: 'AFL', name: 'AFLAC INC' },
    { symbol: 'FDX', name: 'FEDEX CORP' },
    { symbol: 'F', name: 'FORD MOTOR CO' },
    { symbol: 'SFM', name: 'Sprouts Farmers Market' },
    { symbol: 'XYZ', name: 'Block, Inc.' },
  ]
  it('puts the exact ticker first, then tickers starting with it, then names, then the rest', () => {
    expect(rankSearch(pool, 'f').map((x) => x.symbol)).toEqual(['F', 'FCX', 'FDX', 'SFM', 'AFL'])
    expect(rankSearch(pool, 'ford').map((x) => x.symbol)).toEqual(['F'])
    expect(rankSearch(pool, 'block').map((x) => x.symbol)).toEqual(['XYZ'])
  })
  it('caps at the limit and returns nothing for an empty query', () => {
    expect(rankSearch(pool, 'f', 2)).toHaveLength(2)
    expect(rankSearch(pool, '  ')).toEqual([])
  })
  it('reads a query with regex characters as text', () => {
    expect(rankSearch([{ symbol: 'BRK-B', name: 'Berkshire (B)' }], '(b)').map((x) => x.symbol)).toEqual(['BRK-B'])
  })
})
