import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sumUsd, toCents } from '../costBasis'
import { buildLedgerView, valueLedger, type StoredCancellation, type StoredTrade } from '../tradeLedger'
import { buildSalesList } from '../salesList'
import { SALES_CSV_HEADER } from '../userExport'

/**
 * T-460 (owner decision D222, 2026-11-10): every sale on a tracked portfolio with the
 * purchases it used up, by calendar year, with buy and sell dates and days held and no
 * tax label. The figures are the lot engine's own; these pin the joining, the dates,
 * the grouping, and that the years add up to the Realized total.
 */

const NOW = new Date('2026-11-10T12:00:00Z')

let seq = 0
function trade(key: string, side: StoredTrade['side'], quantity: string, price: string, date: string | null, extra: Partial<StoredTrade> = {}): StoredTrade {
  seq += 1
  return {
    id: extra.id ?? `t${String(seq).padStart(3, '0')}`,
    instrumentKey: key,
    symbol: key === 'bitcoin' ? 'BTC' : key.replace(/^sec:/, ''),
    name: key,
    side,
    quantity,
    pricePerUnit: price,
    feeUsd: '0',
    executedAt: date === null ? null : new Date(`${date}T00:00:00Z`),
    opening: false,
    note: null,
    createdAt: new Date(`2026-11-01T00:00:${String(seq % 60).padStart(2, '0')}Z`),
    split: null,
    income: null,
    ...extra,
  }
}

const list = (trades: StoredTrade[], cancellations: StoredCancellation[] = []) => buildSalesList(buildLedgerView(trades, cancellations, NOW), NOW)

describe('buildSalesList', () => {
  it('lists a sale with each purchase it used up, oldest first, with dates and days held', () => {
    const a = trade('sec:VOO', 'buy', '10', '100', '2025-01-02', { id: 'a', feeUsd: '1.00' })
    const b = trade('sec:VOO', 'buy', '10', '120', '2025-06-01', { id: 'b' })
    const s = trade('sec:VOO', 'sell', '15', '130', '2026-03-01', { id: 's', feeUsd: '3.00' })
    const r = list([s, b, a])
    expect(r.saleCount).toBe(1)
    const sale = r.years[0].sales[0]
    expect(sale).toMatchObject({ saleId: 's', symbol: 'VOO', soldHow: 'sale', soldOn: '2026-03-01', unmatched: null })
    expect(sale.parts.map((p) => [p.lotId, p.boughtOn, p.daysHeld, p.quantity, p.boughtHow])).toEqual([
      ['a', '2025-01-02', 423, '10', 'buy'],
      ['b', '2025-06-01', 273, '5', 'buy'],
    ])
    // Cost: 10 × 100 + the $1 fee, then half of the second lot. Proceeds: 15 × 130 − $3, shared by units.
    expect(sale.parts.map((p) => toCents(p.costUsd))).toEqual(['1001.00', '600.00'])
    expect(sale.parts.map((p) => toCents(p.proceedsUsd))).toEqual(['1298.00', '649.00'])
    expect(toCents(sale.proceedsUsd)).toBe('1947.00')
    expect(toCents(sale.gainUsd)).toBe('346.00')
  })

  it('groups by calendar year, newest first, and marks the year still in progress', () => {
    const r = list([
      trade('bitcoin', 'buy', '2', '30000', '2024-02-28', { id: 'buy' }),
      trade('bitcoin', 'sell', '1', '40000', '2024-03-01', { id: 's24' }),
      trade('bitcoin', 'sell', '0.5', '60000', '2025-12-31', { id: 's25' }),
      trade('bitcoin', 'sell', '0.5', '90000', '2026-01-01', { id: 's26' }),
    ])
    expect(r.years.map((y) => [y.year, y.inProgress, y.sales.map((s) => s.saleId)])).toEqual([
      [2026, true, ['s26']],
      [2025, false, ['s25']],
      [2024, false, ['s24']],
    ])
    // A leap day sits between the two dates: 28 Feb to 1 Mar 2024 is 2 days.
    expect(r.years[2].sales[0].parts[0].daysHeld).toBe(2)
  })

  it('adds up, year by year, to the Realized total, and each year is proceeds less cost', () => {
    const trades = [
      trade('bitcoin', 'buy', '1', '20000', '2024-01-10'),
      trade('bitcoin', 'buy', '1', '50000', '2025-01-10'),
      trade('bitcoin', 'sell', '0.3', '45000', '2025-05-05', { feeUsd: '4.99' }),
      trade('bitcoin', 'sell', '1.2', '70000', '2026-02-02', { feeUsd: '7.01' }),
      trade('sec:VTI', 'buy', '3', '250.12345678', '2025-02-02'),
      trade('sec:VTI', 'sell', '3', '240', '2026-04-04'),
    ]
    const view = buildLedgerView(trades, [], NOW)
    const r = buildSalesList(view, NOW)
    expect(r.gainUsd).toBe(valueLedger(view, {}).totals.realizedGainUsd)
    expect(sumUsd(r.years.map((y) => y.gainUsd))).toBe(r.gainUsd)
    for (const y of r.years) {
      expect(sumUsd([y.proceedsUsd, `-${y.costUsd}`])).toBe(y.gainUsd)
    }
    expect(r.years[0].sales.map((s) => s.symbol)).toEqual(['BTC', 'VTI'])
  })

  it('shows a starting position with no date as not entered, with no days held', () => {
    const r = list([
      trade('sec:AAPL', 'transfer_in', '10', '50', null, { id: 'start', opening: true }),
      trade('sec:AAPL', 'sell', '4', '200', '2026-05-05', { id: 's' }),
    ])
    expect(r.years[0].sales[0].parts).toEqual([
      expect.objectContaining({ lotId: 'start', boughtHow: 'starting-position', boughtOn: null, daysHeld: null, fromStartingPosition: true, soldBeforeBought: false }),
    ])
  })

  it('flags a sale dated before the starting position it used, rather than giving negative days', () => {
    // D65: the starting position is the oldest lot whatever its date, so this sale uses it up.
    const r = list([
      trade('sec:AAPL', 'transfer_in', '10', '50', '2026-06-01', { id: 'start', opening: true }),
      trade('sec:AAPL', 'sell', '1', '200', '2026-05-05', { id: 's' }),
    ])
    expect(r.years[0].sales[0].parts[0]).toMatchObject({ boughtOn: '2026-06-01', daysHeld: null, soldBeforeBought: true })
  })

  it('lists the fraction a split paid out in cash as a small sale, dated the split, from the original purchase', () => {
    const r = list([
      trade('sec:NVDA', 'buy', '3', '900', '2024-01-02', { id: 'buy' }),
      trade('sec:NVDA', 'split', '0', '0', '2024-06-10', { id: 'split', split: { unitsAfter: 3, unitsBefore: 2, cashInLieuUsd: '60.00' } }),
    ])
    const sale = r.years[0].sales[0]
    expect(sale).toMatchObject({ saleId: 'split', soldHow: 'split-cash', soldOn: '2024-06-10' })
    expect(sale.parts[0]).toMatchObject({ lotId: 'buy', boughtOn: '2024-01-02', daysHeld: 160, quantity: '0.5' })
    expect(toCents(sale.proceedsUsd)).toBe('60.00')
  })

  it('reports units sold with no purchase apart, and leaves them out of every gain', () => {
    const r = list([
      trade('bitcoin', 'buy', '1', '30000', '2026-01-01'),
      trade('bitcoin', 'sell', '1.5', '40000', '2026-02-01', { id: 's' }),
    ])
    const y = r.years[0]
    expect(y.sales[0].unmatched).toEqual({ quantity: '0.5', proceedsUsd: '20000' })
    expect(toCents(y.unmatchedProceedsUsd)).toBe('20000.00')
    expect(toCents(y.proceedsUsd)).toBe('40000.00')
    expect(toCents(y.gainUsd)).toBe('10000.00')
  })

  it('lists units moved out apart: not a sale, in no total', () => {
    const r = list([
      trade('bitcoin', 'buy', '2', '30000', '2026-01-01'),
      trade('bitcoin', 'transfer_out', '1', '0', '2026-03-03', { id: 'out' }),
    ])
    expect(r.saleCount).toBe(0)
    expect(r.years).toHaveLength(1)
    expect(r.years[0].sales).toEqual([])
    expect(r.years[0].movedOut).toEqual([expect.objectContaining({ tradeId: 'out', movedOn: '2026-03-03', quantity: '1', costUsd: '30000' })])
    expect(r.years[0].gainUsd).toBe('0')
  })

  it('leaves out a cancelled sale, as the Realized total does', () => {
    const s = trade('bitcoin', 'sell', '1', '50000', '2026-04-04', { id: 's' })
    const r = list([trade('bitcoin', 'buy', '1', '30000', '2026-01-01'), s], [{ tradeId: 's', reason: 'typo', createdAt: NOW }])
    expect(r.saleCount).toBe(0)
    expect(r.years).toEqual([])
  })

  it('names units received as income as such, and a transfer in as one', () => {
    const r = list([
      trade('ethereum', 'income_units', '0.1', '3000', '2026-01-05', { id: 'reward' }),
      trade('ethereum', 'transfer_in', '1', '2000', '2026-01-06', { id: 'in' }),
      trade('ethereum', 'sell', '1.1', '3500', '2026-02-01'),
    ])
    expect(r.years[0].sales[0].parts.map((p) => [p.lotId, p.boughtHow])).toEqual([['reward', 'income-units'], ['in', 'transfer-in']])
  })

  it('orders two sales on one day as the trades are listed', () => {
    const r = list([
      trade('bitcoin', 'buy', '2', '30000', '2026-01-01'),
      trade('bitcoin', 'sell', '1', '40000', '2026-02-01', { id: 'first' }),
      trade('bitcoin', 'sell', '1', '41000', '2026-02-01', { id: 'second' }),
    ])
    expect(r.years[0].sales.map((s) => s.saleId)).toEqual(['first', 'second'])
  })
})

describe('no tax label (D222)', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const files = ['../salesList.ts', '../../../components/portfolio/tracked/SalesList.tsx'].map((f) => strip(readFileSync(join(__dirname, f), 'utf8')))

  it('carries no short- or long-term label, year mark or tax figure, on the page, in the module or in the spreadsheet', () => {
    // Mutation: label a sale "long-term" or add a held_over_a_year column and this fails.
    const banned = /long[- ]?term|short[- ]?term|more than a year|over a year|over_a_year|capital gain|wash[- ]sale|tax rate|taxable/i
    for (const code of files) expect(code).not.toMatch(banned)
    expect(SALES_CSV_HEADER.join(',')).not.toMatch(banned)
    expect(SALES_CSV_HEADER).toContain('days_held')
  })

  it('names the method and says it is not a tax form, on the page', () => {
    const page = files[1]
    expect(page).toMatch(/view\.methodLabel/)
    expect(page).toMatch(/not a tax form/)
  })
})
