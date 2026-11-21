import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CASH_SYMBOLS, MAX_IMPORT_ROWS, classifyImport, coinSuggestions, distinctValues, guessDateOrder, guessIncomeKind,
  guessLayout, guessSide, headerSignature, importCancelReason, importFingerprints, importIssues, layoutProblem, looseIdentity,
  normaliseTicker, parseImportRequest, planImport, readCsv, readDate, readLayout, readNumber, rowsToSave,
  symbolChoice, withActionChoices,
  type ImportLayout,
} from '../tradeImport'
import { MAX_REASON_LENGTH, parseTradeInput, type StoredTrade } from '../tradeLedger'

const NOW = new Date('2026-11-07T12:00:00Z')

// Made-up files shaped like real exports: a title line above the column names,
// newest first, a money market row, a dividend, a totals line, quoted commas.
const BROKER = [
  '\uFEFFBrokerage account ending 1234',
  '',
  'Trade Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount',
  '11/03/2026,Sell,VTI,"VANGUARD TOTAL STOCK MARKET, ETF",-2,"$301.25",$0.00,"$602.50"',
  '10/15/2026,Qualified Dividend,VTI,VANGUARD TOTAL STOCK MARKET ETF,,,,$12.34',
  '10/01/2026,Buy,BRK.B,BERKSHIRE HATHAWAY CL B,1.5,$480.10,$1.00,"-$721.15"',
  '10/01/2026,Buy,VTI,VANGUARD TOTAL STOCK MARKET ETF,10,$290.00,,"-$2,900.00"',
  '09/30/2026,Buy,SPAXX**,FIDELITY GOVERNMENT MONEY MARKET,100,$1.00,,-$100.00',
  'Transactions Total,,,,,,,"-$3,106.31"',
].join('\r\n')

const COINS = [
  'Timestamp,Transaction Type,Asset,Quantity Transacted,Price at Transaction,Fees and/or Spread,Notes',
  '2026-05-01 14:03:22 UTC,Buy,BTC,0.0125,"$64,000.00",$2.50,Bought BTC',
  '2026-05-02 09:00:00 UTC,Advanced Trade Buy,ETH,1.2E-2,$3100,0.45,',
  '2026-05-03 10:00:00 UTC,Staking Income,ETH,0.0001,$3150,,',
  '2026-05-04 10:00:00 UTC,Send,BTC,0.002,,,To my wallet',
  '2026-05-05 10:00:00 UTC,Deposit,USD,500,1,,',
].join('\n')

function brokerLayout(table = readCsv(BROKER)): ImportLayout {
  return withActionChoices(guessLayout(table), table)
}

describe('reading the file', () => {
  const t = readCsv(BROKER)

  it('finds the column names below a title line, and sets the title and the totals line aside', () => {
    expect(t.headers).toEqual(['Trade Date', 'Action', 'Symbol', 'Description', 'Quantity', 'Price', 'Fees & Comm', 'Amount'])
    expect(t.headerLine).toBe(3)
    expect(t.rows.map((r) => r.line)).toEqual([4, 5, 6, 7, 8, 9])
    // The totals line has the same width, so it is read as a row and refused later (no symbol): never silently a trade.
    expect(t.setAside).toEqual([{ line: 1, text: 'Brokerage account ending 1234', reason: 'Above the column names.' }])
  })

  it('keeps a quoted comma inside its cell', () => {
    expect(t.rows[0].cells[3]).toBe('VANGUARD TOTAL STOCK MARKET, ETF')
    expect(t.rows[3].cells[7]).toBe('-$2,900.00')
  })

  it('sets aside a line with the wrong number of cells, with the reason', () => {
    const short = readCsv('Date,Action,Symbol,Quantity,Price\n2026-01-02,Buy,VTI,1,200\nTotal,5\n')
    expect(short.rows).toHaveLength(1)
    expect(short.setAside[0]).toMatchObject({ line: 3, reason: 'Has 2 cells where the column names line has 5.' })
  })

  it('reads semicolons and tabs, a quoted line break, and a trailing delimiter', () => {
    expect(readCsv('Date;Action;Symbol;Quantity;Price\n2026-01-02;Buy;VTI;1;200').rows[0].cells).toEqual(['2026-01-02', 'Buy', 'VTI', '1', '200'])
    expect(readCsv('Date\tAction\tSymbol\tQuantity\n2026-01-02\tBuy\tVTI\t1').delimiter).toBe('\t')
    const multi = readCsv('Date,Action,Symbol,Note\n2026-01-02,Buy,VTI,"two\nlines"\n2026-01-03,Buy,VTI,x')
    expect(multi.rows.map((r) => r.line)).toEqual([2, 4])
    expect(multi.rows[0].cells[3]).toBe('two\nlines')
    expect(readCsv('Date,Action,Symbol,\n2026-01-02,Buy,VTI,\n').rows[0].cells).toEqual(['2026-01-02', 'Buy', 'VTI'])
  })

  it('finds the column names when the last columns are empty on most rows (audit 2026-11-07)', () => {
    // Most rows leave Fees and Note empty, so they are narrower than the column names. Matching
    // the most common width exactly took the first trade for the column names, set the real
    // ones aside, and set aside every row whose fee or note was filled.
    const file = [
      'Account report,Account 1234,Generated 2026-11-07',
      'Date,Action,Symbol,Quantity,Price,Fees,Note',
      '2026-01-02,Buy,AAPL,10,150,,',
      '2026-01-03,Buy,MSFT,5,400,,',
      '2026-01-04,Sell,AAPL,2,160,1.00,partial',
      '2026-01-05,Buy,VOO,1,500,,',
    ].join('\n')
    const t = readCsv(file)
    expect(t.headers).toEqual(['Date', 'Action', 'Symbol', 'Quantity', 'Price', 'Fees', 'Note'])
    expect(t.headerLine).toBe(2)
    expect(t.rows.map((r) => r.line)).toEqual([3, 4, 5, 6])
    expect(t.rows[2].cells).toEqual(['2026-01-04', 'Sell', 'AAPL', '2', '160', '1.00', 'partial'])
    expect(t.setAside).toEqual([{ line: 1, text: 'Account report,Account 1234,Generated 2026-11-07', reason: 'Above the column names.' }])
    const plan = planImport(t, withActionChoices(guessLayout(t), t), NOW)
    expect(plan.layoutProblem).toBeNull()
    expect(plan.ready).toBe(4)
  })

  it('fingerprints the layout by its column names, not their case', () => {
    expect(headerSignature(['Trade Date', 'Symbol'])).toBe(headerSignature([' trade date', 'SYMBOL ']))
    expect(headerSignature(['Symbol', 'Trade Date'])).not.toBe(headerSignature(['Trade Date', 'Symbol']))
  })
})

describe('numbers and dates are read as written, never guessed', () => {
  it('reads dollars, accounting negatives and spreadsheet exponents without floating point', () => {
    expect(readNumber('$1,234.50')).toEqual({ ok: true, value: { negative: false, digits: '1234.50' } })
    expect(readNumber('(45.00)')).toEqual({ ok: true, value: { negative: true, digits: '45.00' } })
    expect(readNumber('-$0.10')).toEqual({ ok: true, value: { negative: true, digits: '0.10' } })
    expect(readNumber('1.2E-5')).toEqual({ ok: true, value: { negative: false, digits: '0.000012' } })
    expect(readNumber('3E+2')).toEqual({ ok: true, value: { negative: false, digits: '300' } })
    expect(readNumber('.5')).toEqual({ ok: true, value: { negative: false, digits: '0.5' } })
    expect(readNumber('0.1')).toEqual({ ok: true, value: { negative: false, digits: '0.1' } })
  })

  it('refuses a decimal comma, another currency and anything that is not a number', () => {
    // Mutation: accept "12,5" as 12.5 or 125 and this fails.
    expect(readNumber('12,5')).toMatchObject({ ok: false })
    expect(readNumber('1.234,56')).toMatchObject({ ok: false })
    expect(readNumber('€12.00')).toMatchObject({ ok: false, error: expect.stringContaining('not in US dollars') })
    expect(readNumber('12 EUR')).toMatchObject({ ok: false })
    expect(readNumber('n/a')).toMatchObject({ ok: false })
    expect(readNumber('')).toMatchObject({ ok: false })
  })

  it('reads a date in the order chosen, and refuses one that is not real in that order', () => {
    expect(readDate('11/03/2026', 'MDY')).toEqual({ ok: true, value: '2026-11-03' })
    expect(readDate('11/03/2026', 'DMY')).toEqual({ ok: true, value: '2026-03-11' })
    expect(readDate('2026-05-01 14:03:22 UTC', 'YMD')).toEqual({ ok: true, value: '2026-05-01' })
    expect(readDate('2026-05-01T14:03:22Z', 'YMD')).toEqual({ ok: true, value: '2026-05-01' })
    expect(readDate('3/7/26', 'MDY')).toEqual({ ok: true, value: '2026-03-07' })
    expect(readDate('13/01/2026', 'MDY')).toMatchObject({ ok: false })
    expect(readDate('02/30/2026', 'MDY')).toMatchObject({ ok: false })
    expect(readDate('Mar 7, 2026', 'MDY')).toMatchObject({ ok: false })
  })

  it('guesses the date order from the values', () => {
    expect(guessDateOrder(['2026-01-02'])).toBe('YMD')
    expect(guessDateOrder(['01/02/2026', '25/02/2026'])).toBe('DMY')
    expect(guessDateOrder(['01/02/2026', '02/25/2026'])).toBe('MDY')
  })
})

describe('guessing the layout', () => {
  it('matches the usual column names', () => {
    const l = guessLayout(readCsv(BROKER))
    expect(l.columns).toEqual({
      date: 'Trade Date', symbol: 'Symbol', quantity: 'Quantity', price: 'Price',
      action: 'Action', fee: 'Fees & Comm', note: 'Description', amount: 'Amount',
    })
    expect(l.dateOrder).toBe('MDY')
    expect(l.sideFrom).toBe('column')
    const c = guessLayout(readCsv(COINS))
    expect(c.columns).toMatchObject({ date: 'Timestamp', symbol: 'Asset', quantity: 'Quantity Transacted', price: 'Price at Transaction', action: 'Transaction Type' })
    expect(c.dateOrder).toBe('YMD')
  })

  it('reads buy or sell from the sign of the units when there is no kind column', () => {
    const t = readCsv('Date,Symbol,Quantity,Price\n2026-01-02,VTI,10,200\n2026-02-02,VTI,-4,210')
    const l = guessLayout(t)
    expect(l.sideFrom).toBe('quantity-sign')
    const plan = planImport(t, l, NOW)
    expect(plan.rows.map((r) => (r.status === 'ready' ? r.trade.side : r.status))).toEqual(['buy', 'sell'])
  })

  it('suggests what each kind of row means: income as income, and anything else not a trade of units left out', () => {
    expect(guessSide('YOU BOUGHT APPLE INC (AAPL)')).toBe('buy')
    expect(guessSide('Advanced Trade Sell')).toBe('sell')
    // T-451: a reinvested dividend is income once and a purchase once, never both on one row.
    expect(guessSide('Reinvest Dividend')).toBe('income')
    expect(guessSide('Reinvest Shares')).toBe('buy')
    expect(guessSide('REINVESTMENT')).toBe('buy')
    expect(guessSide('Qualified Dividend')).toBe('income')
    expect(guessSide('DIVIDEND RECEIVED')).toBe('income')
    expect(guessSide('Bank Interest')).toBe('income')
    expect(guessSide('Long Term Cap Gain')).toBe('income')
    expect(guessSide('Margin Interest')).toBe('skip')
    expect(guessSide('Staking Income')).toBe('income_units')
    expect(guessSide('Learning Reward')).toBe('income_units')
    expect(guessSide('Foreign Tax Paid')).toBe('skip')
    expect(guessSide('Convert')).toBe('skip')
    expect(guessSide('Send')).toBe('transfer_out')
    expect(guessSide('Receive')).toBe('transfer_in')
    expect(guessSide('Deposit')).toBe('skip')
    expect(guessSide('Journal')).toBe('skip')
  })

  it('lists each value once, with its count, and keeps a saved choice over the guess', () => {
    const t = readCsv(BROKER)
    expect(distinctValues(t, 'Action').slice(0, 2)).toEqual([{ value: 'Buy', rows: 3 }, { value: 'Qualified Dividend', rows: 1 }])
    const l = withActionChoices({ ...guessLayout(t), actions: { Sell: 'transfer_out', Older: 'buy' } }, t)
    expect(l.actions).toMatchObject({ Sell: 'transfer_out', Buy: 'buy', 'Qualified Dividend': 'income', Older: 'buy' })
  })
})

describe('tickers and coins', () => {
  it('writes tickers as the app does and refuses what is not one', () => {
    expect(normaliseTicker(' brk.b ')).toBe('BRK-B')
    expect(normaliseTicker('BRK/B')).toBe('BRK-B')
    expect(normaliseTicker('SPAXX**')).toBe('SPAXX')
    expect(normaliseTicker('VTI')).toBe('VTI')
    expect(normaliseTicker('-AAPL261218C150')).toBeNull()
    expect(normaliseTicker('AAPL  261218C00150000')).toBeNull()
  })

  it('never picks a coin by its ticker: a coins file needs the choice made', () => {
    // D190. Mutation: default a coin symbol to its catalog coin and this fails.
    const t = readCsv(COINS)
    const l = withActionChoices({ ...guessLayout(t), holds: 'coins' }, t)
    expect(symbolChoice(l, 'BTC')).toBeNull()
    const plan = planImport(t, l, NOW)
    expect(plan.rows[0]).toMatchObject({ status: 'refused', reason: 'Choose which coin "BTC" is.' })
    expect(plan.ready).toBe(0)
    // The catalog's coins are offered, for the person to pick.
    expect(coinSuggestions('btc').map((c) => c.coinId)).toContain('bitcoin')
  })

  it('treats a currency code as cash, left out unless chosen otherwise', () => {
    expect(CASH_SYMBOLS.has('USD')).toBe(true)
    const t = readCsv(COINS)
    const l = withActionChoices({ ...guessLayout(t), holds: 'coins', actions: { Deposit: 'buy' } }, t)
    const usd = planImport(t, l, NOW).rows.find((r) => r.symbol === 'USD')
    expect(usd).toMatchObject({ status: 'left-out', reason: '"USD" is cash, not a holding.' })
  })
})

describe('planning the import', () => {
  it('turns each row into the trade the trade route takes, and says why the rest are not', () => {
    const plan = planImport(readCsv(BROKER), brokerLayout(), NOW)
    const byLine = Object.fromEntries(plan.rows.map((r) => [r.line, r]))
    expect(byLine[4]).toMatchObject({
      status: 'ready',
      trade: { instrument: 'sec:VTI', side: 'sell', quantity: '2', pricePerUnit: '301.25', feeUsd: '0.00', executedAt: '2026-11-03', note: 'VANGUARD TOTAL STOCK MARKET, ETF' },
    })
    // T-451: a dividend row is cash income from the file's amount column.
    expect(byLine[5]).toMatchObject({ status: 'ready', trade: { instrument: 'sec:VTI', side: 'income', amountUsd: '12.34', incomeKind: 'dividend', executedAt: '2026-10-15' } })
    expect((byLine[5] as { trade: object }).trade).not.toHaveProperty('quantity')
    expect(byLine[6]).toMatchObject({ status: 'ready', trade: { instrument: 'sec:BRK-B', quantity: '1.5', feeUsd: '1.00' } })
    expect(byLine[7]).toMatchObject({ status: 'ready', trade: { feeUsd: '0' } })
    expect(byLine[8]).toMatchObject({ status: 'ready', trade: { instrument: 'sec:SPAXX' } })
    expect(byLine[9]).toMatchObject({ status: 'refused', reason: 'The kind of trade is empty.' })
    expect([plan.ready, plan.leftOut, plan.refused]).toEqual([5, 0, 1])
  })

  it('sends every ready row through the trade route\'s own checks', () => {
    // Mutation: drop the parseTradeInput call in planRow and the future-dated row is ready.
    const t = readCsv('Date,Action,Symbol,Quantity,Price\n2027-06-01,Buy,VTI,1,200\n2026-01-02,Buy,VTI,0.1234567890123456789,200\n2026-01-02,Buy,VTI,1,200.123456789')
    const plan = planImport(t, withActionChoices(guessLayout(t), t), NOW)
    expect(plan.rows.map((r) => r.status)).toEqual(['refused', 'refused', 'refused'])
    expect(plan.rows[0]).toMatchObject({ reason: expect.stringContaining('in the future') })
    expect(plan.rows[1]).toMatchObject({ reason: expect.stringContaining('decimal places') })
    for (const r of planImport(readCsv(BROKER), brokerLayout(), NOW).rows) {
      if (r.status === 'ready') expect(parseTradeInput(r.trade, NOW).ok).toBe(true)
    }
  })

  it('reads a coins file once each symbol is chosen', () => {
    const t = readCsv(COINS)
    const l: ImportLayout = withActionChoices({
      ...guessLayout(t), holds: 'coins',
      symbols: { BTC: { kind: 'coin', coinId: 'bitcoin', name: 'Bitcoin' }, ETH: { kind: 'coin', coinId: 'ethereum', name: 'Ethereum' } },
    }, t)
    const rows = planImport(t, l, NOW).rows
    expect(rows[0]).toMatchObject({ status: 'ready', trade: { instrument: 'bitcoin', quantity: '0.0125', pricePerUnit: '64000.00', feeUsd: '2.50' } })
    expect(rows[1]).toMatchObject({ status: 'ready', trade: { instrument: 'ethereum', quantity: '0.012', feeUsd: '0.45' } })
    // T-451: a staking reward is units received, at the file's price that day (D201).
    expect(rows[2]).toMatchObject({ status: 'ready', trade: { instrument: 'ethereum', side: 'income_units', quantity: '0.0001', pricePerUnit: '3150' } })
    // A transfer out needs no price.
    expect(rows[3]).toMatchObject({ status: 'ready', trade: { side: 'transfer_out', pricePerUnit: '0' } })
  })

  it('names a layout problem and makes nothing ready while it stands', () => {
    const t = readCsv(BROKER)
    const l = brokerLayout(t)
    expect(layoutProblem({ ...l, columns: { ...l.columns, price: 'Nope' } }, t)).toBe('The file has no column named "Nope" (the price column).')
    expect(layoutProblem({ ...l, columns: { ...l.columns, price: 'Quantity' } }, t)).toBe('The same column is chosen for two things.')
    expect(planImport(t, { ...l, columns: { ...l.columns, symbol: '' } }, NOW)).toMatchObject({ ready: 0, layoutProblem: 'Choose the symbol column.' })
  })
})

describe('recognising rows already imported', () => {
  const trade = (q: string) => ({ executedAt: new Date('2026-10-01'), side: 'buy' as const, instrumentKey: 'sec:VTI', quantity: q, pricePerUnit: '290.00000000', feeUsd: '0' })

  it('gives two identical rows in one file two fingerprints, and the same file the same ones again', () => {
    const a = importFingerprints([trade('10'), trade('10.000'), trade('5')])
    expect(a[0]).not.toBe(a[1])
    expect(a[0].replace(/#\d+$/, '')).toBe(a[1].replace(/#\d+$/, ''))
    expect(importFingerprints([trade('10'), trade('10'), trade('5')])).toEqual(a)
  })

  it('matches a typed trade on day, kind, instrument, units and price, whatever its fee', () => {
    expect(looseIdentity(trade('10'))).toBe(looseIdentity({ ...trade('10.0'), pricePerUnit: '290' }))
  })

  it('keeps a whole-import cancellation reason within the limit and names the file', () => {
    expect(importCancelReason('trades.csv', '')).toBe('Whole import cancelled (trades.csv)')
    expect(importCancelReason('trades.csv', 'wrong account')).toBe('Whole import cancelled (trades.csv): wrong account')
    expect(importCancelReason('x'.repeat(200), 'y'.repeat(300)).length).toBeLessThanOrEqual(MAX_REASON_LENGTH)
  })
})

describe('income rows (T-451)', () => {
  const FILE = [
    'Date,Action,Symbol,Quantity,Price,Amount',
    '2026-03-15,Qualified Dividend,KO,,,$4.12',
    '2026-03-15,Qualified Dividend,KO,,,$4.12',
    '2026-03-16,Bank Interest,SPAXX,,,0.37',
    '2026-03-17,Dividend Adjustment,KO,,,-4.12',
  ].join('\n')

  it('reads cash income from the amount column, naming its kind, and refuses a negative amount', () => {
    const t = readCsv(FILE)
    const l = withActionChoices({ ...guessLayout(t), actions: { 'Dividend Adjustment': 'income' } }, t)
    const rows = planImport(t, l, NOW).rows
    expect(rows[0]).toMatchObject({ status: 'ready', trade: { side: 'income', amountUsd: '4.12', incomeKind: 'dividend' } })
    expect(rows[2]).toMatchObject({ status: 'ready', trade: { instrument: 'sec:SPAXX', incomeKind: 'interest', amountUsd: '0.37' } })
    expect(rows[3]).toMatchObject({ status: 'refused', reason: expect.stringContaining('below zero') })
    expect(guessIncomeKind('Long Term Cap Gain')).toBe('distribution')
  })

  it('asks for the amount column before reading income', () => {
    const t = readCsv(FILE)
    const l = withActionChoices(guessLayout(t), t)
    const { amount: _drop, ...columns } = l.columns
    void _drop
    expect(planImport(t, { ...l, columns }, NOW).rows[0]).toMatchObject({ status: 'refused', reason: 'Choose the amount column: cash income is read from it.' })
  })

  it('tells two dividends apart by their amount, and two equal ones by their order', () => {
    const parsed = parseImportRequest({ rows: planImport(readCsv(FILE), withActionChoices(guessLayout(readCsv(FILE)), readCsv(FILE)), NOW).rows
      .flatMap((r) => (r.status === 'ready' ? [{ line: r.line, trade: r.trade }] : [])) }, NOW)
    if (!parsed.ok) throw new Error(parsed.error)
    const [a, b] = parsed.value.rows
    const fps = importFingerprints([a.trade, b.trade, { ...a.trade, income: { amountUsd: '5', kind: 'dividend' as const } }])
    expect(new Set(fps).size).toBe(3)
    expect(fps[0]).toMatch(/\|4\.12#1$/)
    // A buy's fingerprint is as it was before income existed, so earlier imports are still recognised.
    expect(importFingerprints([{ executedAt: new Date('2026-01-02'), side: 'buy', instrumentKey: 'sec:VTI', quantity: '1', pricePerUnit: '2', feeUsd: '0' }]))
      .toEqual(['2026-01-02|buy|sec:VTI|1|2|0#1'])
  })
})

describe('saved layouts', () => {
  it('round-trips a layout and refuses a malformed one', () => {
    const l = { ...brokerLayout(), symbols: { BTC: { kind: 'coin' as const, coinId: 'bitcoin', name: 'Bitcoin' } } }
    expect(readLayout(JSON.parse(JSON.stringify(l)))).toEqual(l)
    expect(readLayout({ ...l, version: 2 })).toBeNull()
    expect(readLayout({ ...l, actions: { Buy: 'split' } })).toBeNull()
    expect(readLayout({ ...l, symbols: { BTC: { kind: 'coin', coinId: 'Not An Id', name: 'x' } } })).toBeNull()
    expect(readLayout(null)).toBeNull()
  })
})

describe('what the import route receives', () => {
  const ready = () => planImport(readCsv(BROKER), brokerLayout(), NOW).rows.flatMap((r) => (r.status === 'ready' ? [{ line: r.line, trade: r.trade }] : []))

  it('checks every row again, and one bad row refuses the whole request with its line', () => {
    const ok = parseImportRequest({ fileName: 'a.csv', headerSignature: 'x', rows: ready() }, NOW)
    expect(ok.ok && ok.value.rows).toHaveLength(5)
    // Mutation: skip parseTradeInput here and the bad price is accepted.
    const bad = parseImportRequest({ rows: [...ready(), { line: 99, trade: { ...ready()[0].trade, pricePerUnit: '-1' } }] }, NOW)
    expect(bad).toMatchObject({ ok: false, error: expect.stringMatching(/^Line 99: .*Nothing was saved\.$/) })
  })

  it('refuses a starting position or a split, a repeated line, and too many rows', () => {
    const t = ready()[0].trade
    expect(parseImportRequest({ rows: [{ line: 1, trade: { ...t, opening: true, side: 'transfer_in' } }] }, NOW)).toMatchObject({ ok: false })
    expect(parseImportRequest({ rows: [{ line: 1, trade: { ...t, side: 'split' } }] }, NOW)).toMatchObject({ ok: false })
    expect(parseImportRequest({ rows: [{ line: 1, trade: t }, { line: 1, trade: t }] }, NOW)).toMatchObject({ ok: false, error: 'Line 1 is sent twice.' })
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ line: i + 1, trade: t }))
    expect(parseImportRequest({ rows: many }, NOW)).toMatchObject({ ok: false })
    expect(parseImportRequest({ rows: [] }, NOW)).toMatchObject({ ok: false })
  })

  it('skips rows an earlier import saved, and holds back rows matching a typed trade unless included', () => {
    const parsed = parseImportRequest({ rows: ready() }, NOW)
    if (!parsed.ok) throw new Error(parsed.error)
    const rows = parsed.value.rows
    const fps = importFingerprints(rows.map((r) => r.trade))
    const typed = new Map([[looseIdentity(rows[2].trade), 1]])
    const statuses = classifyImport(rows, { importedFingerprints: new Set([fps[0]]), typedTrades: typed })
    expect(statuses.map((s) => s.status)).toEqual(['already-imported', 'new', 'looks-recorded', 'new', 'new'])
    expect(rowsToSave(statuses, new Set()).map((s) => s.line)).toEqual([5, 7, 8])
    expect(rowsToSave(statuses, new Set([6])).map((s) => s.line)).toEqual([5, 6, 7, 8])
    // Mutation: drop the occurrence count from the fingerprint and a second identical row reads as a repeat.
    const twice = classifyImport([rows[1], { ...rows[1], line: 50 }], { importedFingerprints: new Set([importFingerprints([rows[1].trade])[0]]), typedTrades: new Map() })
    expect(twice.map((s) => s.status)).toEqual(['already-imported', 'new'])
  })

  it('says, by line, what the lot engine would make of the rows once saved', () => {
    const parsed = parseImportRequest({ rows: ready() }, NOW)
    if (!parsed.ok) throw new Error(parsed.error)
    // The file sells 2 VTI on 2026-11-03 after buying 10 on 2026-10-01: fine. Without the buy, the sale is short.
    const onlySale = parsed.value.rows.filter((r) => r.line === 4)
    const issues = importIssues({ trades: [], cancellations: [] }, onlySale, NOW)
    expect(issues).toEqual([{ line: 4, message: expect.stringContaining('Sold 2 more units than were held') }])
    expect(importIssues({ trades: [], cancellations: [] }, parsed.value.rows, NOW)).toEqual([])
    // A trade already recorded counts: an earlier typed buy covers the sale.
    const typedBuy: StoredTrade = {
      id: 't1', instrumentKey: 'sec:VTI', symbol: 'VTI', name: 'VTI', side: 'buy', quantity: '5', pricePerUnit: '250', feeUsd: '0',
      executedAt: new Date('2026-01-02'), opening: false, note: null, createdAt: NOW, split: null, income: null,
    }
    expect(importIssues({ trades: [typedBuy], cancellations: [] }, onlySale, NOW)).toEqual([])
  })
})

describe('the import screen, routes and tables', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../../..', p), 'utf8')

  it('is on every tracked portfolio', () => {
    expect(read('src/components/portfolio/tracked/TrackedPortfolioDetail.tsx')).toMatch(/<ImportTradesPanel portfolioId=\{portfolio\.id\}/)
  })

  it('cancels a whole import only by adding cancellation rows, never by removing anything', () => {
    // The owner's rule (D200): one step may cancel a whole import, and nothing is removed.
    const server = read('src/lib/server/tradeImports.ts')
    expect(server).toMatch(/tx\.insert\(tradeCancellations\)/)
    expect(server).not.toMatch(/\.delete\(|\.update\(trade(Transactions|ImportRows|Imports)\)/)
    expect(read('src/app/api/user/tracked-portfolios/[id]/imports/[importId]/cancel/route.ts')).not.toMatch(/export async function DELETE/)
  })

  it('saves under a lock and checks for repeats again inside it', () => {
    const server = read('src/lib/server/tradeImports.ts')
    const save = server.slice(server.indexOf('export async function saveImport'))
    expect(save).toMatch(/pg_advisory_xact_lock/)
    expect(save.indexOf('pg_advisory_xact_lock')).toBeLessThan(save.indexOf('classifyImport'))
  })

  it('adds tables rather than columns, so every other trade route works before migration 0010', () => {
    const sql = read('drizzle/0010_trade-imports.sql')
    expect(sql).not.toMatch(/ALTER TABLE "(trade_transactions|portfolios|tracked_portfolios)" ADD COLUMN/)
    expect(sql.match(/CREATE TABLE "(\w+)"/g)?.sort()).toEqual(['CREATE TABLE "trade_import_layouts"', 'CREATE TABLE "trade_import_rows"', 'CREATE TABLE "trade_imports"'])
  })
})
