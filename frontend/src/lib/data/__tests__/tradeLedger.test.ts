import { describe, expect, it } from 'vitest'
import { INSTRUMENT_BY_KEY, type InstrumentClass } from '../instruments'
import { REALIZED_METHOD_LABEL } from '../costBasis'
import {
  MAX_NOTE_LENGTH, MAX_REASON_LENGTH, buildLedgerView, formatLivePrice, formatUnitPrice, formatUnits, formatUsd,
  formatUsdChange, parseCancelInput, parsePortfolioInput, parseTradeInput, trackableInstrument,
  tradeKindLabel, trimDecimal, valueLedger, type StoredCancellation, type StoredTrade,
} from '../tradeLedger'

/**
 * T-027 step 2 (owner decision D65, 2026-10-04). The trade routes store only
 * what parseTradeInput returns and send back what buildLedgerView builds, so
 * these pin what is let in, what is refused and why, and how saved trades and
 * cancellations become the figures a screen will print.
 */

const NOW = new Date('2026-10-04T12:00:00Z')
const keyOfClass = (cls: InstrumentClass) => Object.values(INSTRUMENT_BY_KEY).find((i) => i.class === cls)!.key

const buy = { instrument: 'bitcoin', side: 'buy', quantity: '0.5', pricePerUnit: '60000', executedAt: '2026-03-14' }
const parse = (over: Record<string, unknown> = {}) => parseTradeInput({ ...buy, ...over }, NOW)
const refusal = (over: Record<string, unknown>) => {
  const r = parse(over)
  if (r.ok) throw new Error(`expected a refusal for ${JSON.stringify(over)}`)
  return r.error
}

describe('parseTradeInput', () => {
  it('lets a plain purchase in, with no fee and no note', () => {
    const r = parse()
    expect(r).toEqual({
      ok: true,
      value: {
        instrumentKey: 'bitcoin', nameHint: '', side: 'buy', quantity: '0.5', pricePerUnit: '60000',
        feeUsd: '0', executedAt: new Date('2026-03-14T00:00:00Z'), opening: false, note: null,
      },
    })
  })

  it('lets a starting position in without a date (D65)', () => {
    const r = parseTradeInput({ instrument: 'sec:VTI', side: 'transfer_in', opening: true, quantity: '12', pricePerUnit: '210.5' }, NOW)
    expect(r.ok && r.value).toMatchObject({ instrumentKey: 'sec:VTI', side: 'transfer_in', opening: true, executedAt: null })
  })

  it('takes a stock or a coin the catalog does not know, as the instrument resolver would class it', () => {
    expect(parse({ instrument: 'sec:ZZZZ' }).ok).toBe(true)
    expect(parse({ instrument: 'some-new-coin' }).ok).toBe(true)
  })

  it('keeps commodities, currencies and rates out, saying why', () => {
    for (const cls of ['commodity', 'currency', 'rate'] as const) {
      expect(refusal({ instrument: keyOfClass(cls) })).toMatch(/coins, stocks and funds, which are priced in dollars per unit/)
    }
  })

  it('places every class the instrument layer knows on one side or the other', () => {
    const allowed = new Set<InstrumentClass>(['crypto', 'equity', 'etf', 'mutual'])
    for (const i of Object.values(INSTRUMENT_BY_KEY)) {
      expect(trackableInstrument(i.key).ok, i.key).toBe(allowed.has(i.class))
    }
  })

  it('refuses a key that is not one', () => {
    for (const instrument of ['', 'BTC!', 'sec:', 'sec:THIS-TICKER-IS-FAR-TOO-LONG']) {
      expect(parse({ instrument }).ok, instrument).toBe(false)
    }
  })

  it('refuses a kind of trade the ledger does not know', () => {
    expect(refusal({ side: 'split' })).toMatch(/buy, sell, transfer_in, transfer_out/)
  })

  it('takes amounts only as decimal strings, so no digit is lost', () => {
    expect(refusal({ quantity: 0.5 })).toMatch(/decimal string/)
    for (const quantity of ['-1', 'abc', '1e5', '1.2.3', '']) expect(parse({ quantity }).ok, quantity).toBe(false)
    expect(refusal({ quantity: '0' })).toBe('The quantity must be more than 0.')
    expect(refusal({ quantity: '0.0000000000000000001' })).toMatch(/more than 18 decimal places/)
    expect(parse({ quantity: '1.0000000000000000000' }).ok).toBe(true)
    expect(refusal({ quantity: '1'.repeat(21) })).toMatch(/too large/)
    expect(refusal({ pricePerUnit: '1.000000001' })).toMatch(/more than 8 decimal places/)
    expect(refusal({ pricePerUnit: '1'.repeat(13) })).toMatch(/too large/)
    expect(parse({ pricePerUnit: '0' }).ok).toBe(true)
    expect(refusal({ feeUsd: '0.001' })).toMatch(/more than 2 decimal places/)
    expect(parse({ feeUsd: '1.50' }).ok && parse({ feeUsd: '1.50' })).toMatchObject({ value: { feeUsd: '1.50' } })
  })

  it('records a starting position only as a transfer in', () => {
    expect(refusal({ opening: true })).toBe('A starting position is recorded as a transfer in.')
    expect(refusal({ opening: 'yes' })).toMatch(/true or false/)
  })

  it('needs a real date for anything but a starting position', () => {
    expect(refusal({ executedAt: undefined })).toMatch(/Only a starting position may leave it out/)
    expect(refusal({ executedAt: 'yesterday' })).toMatch(/is not a date/)
    expect(refusal({ executedAt: 20260314 })).toMatch(/ISO date/)
    expect(refusal({ executedAt: '0026-03-14' })).toMatch(/earlier than 1900/)
    expect(refusal({ executedAt: '2026-10-06T00:00:00Z' })).toMatch(/in the future/)
    // Up to a day ahead is allowed, for a trade made today in a time zone ahead of the server's.
    expect(parse({ executedAt: '2026-10-05T06:00:00Z' }).ok).toBe(true)
  })

  it('keeps a note, trimmed, and refuses one that is too long', () => {
    expect(parse({ note: '  rebalance  ' })).toMatchObject({ value: { note: 'rebalance' } })
    expect(parse({ note: '   ' })).toMatchObject({ value: { note: null } })
    expect(refusal({ note: 'x'.repeat(MAX_NOTE_LENGTH + 1) })).toMatch(/at most/)
  })

  it('refuses what is not a trade at all', () => {
    for (const body of [null, 'buy', [], 42]) expect(parseTradeInput(body, NOW).ok).toBe(false)
  })
})

describe('parsePortfolioInput', () => {
  it('needs a name to create a portfolio, and an id must be a UUID', () => {
    expect(parsePortfolioInput({ name: '  Brokerage  ', description: ' taxable ' })).toEqual({ ok: true, value: { name: 'Brokerage', description: 'taxable' } })
    expect(parsePortfolioInput({ description: 'x' }).ok).toBe(false)
    expect(parsePortfolioInput({ name: 'A', id: 'not-a-uuid' }).ok).toBe(false)
    expect(parsePortfolioInput({ name: 'A', id: '6f1c2a4e-0b7d-4c55-9a3e-2f8b1d9c0e11' }).ok).toBe(true)
  })

  it('changes only what is sent, and refuses an empty change', () => {
    expect(parsePortfolioInput({ description: 'new' }, { partial: true })).toEqual({ ok: true, value: { description: 'new' } })
    expect(parsePortfolioInput({}, { partial: true }).ok).toBe(false)
    expect(parsePortfolioInput({ name: '   ' }, { partial: true }).ok).toBe(false)
  })
})

describe('parseCancelInput', () => {
  it('takes no body, or a reason up to its limit', () => {
    expect(parseCancelInput(undefined)).toEqual({ ok: true, value: { reason: '' } })
    expect(parseCancelInput({ reason: ' typed the wrong price ' })).toEqual({ ok: true, value: { reason: 'typed the wrong price' } })
    expect(parseCancelInput({ reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }).ok).toBe(false)
    expect(parseCancelInput({ reason: 5 }).ok).toBe(false)
  })
})

describe('buildLedgerView', () => {
  let n = 0
  const at = (d: string | null) => (d === null ? null : new Date(`${d}T15:00:00Z`))
  function stored(instrumentKey: string, side: StoredTrade['side'], quantity: string, price: string, date: string | null, extra: Partial<StoredTrade> = {}): StoredTrade {
    n += 1
    return {
      id: `t${n}`, instrumentKey, symbol: instrumentKey === 'bitcoin' ? 'BTC' : instrumentKey.replace('sec:', ''),
      name: instrumentKey, side, quantity, pricePerUnit: price, feeUsd: '0', executedAt: at(date),
      opening: false, note: null, createdAt: new Date(`2026-10-01T00:00:0${n % 10}Z`), ...extra,
    }
  }
  const cancel = (tradeId: string): StoredCancellation => ({ tradeId, reason: 'wrong price', createdAt: new Date('2026-10-02T00:00:00Z') })

  it('lists every trade, cancelled ones marked, and leaves cancelled ones out of the figures', () => {
    const b1 = stored('sec:VTI', 'buy', '10', '200', '2026-01-05')
    const wrong = stored('sec:VTI', 'buy', '10', '2000', '2026-02-05')
    const right = stored('sec:VTI', 'buy', '10', '220', '2026-02-05')
    const s1 = stored('sec:VTI', 'sell', '15', '250', '2026-03-05')
    const view = buildLedgerView([s1, right, wrong, b1], [cancel(wrong.id)], NOW)

    expect(view.method).toBe('fifo')
    expect(view.methodLabel).toBe(REALIZED_METHOD_LABEL)
    expect(view.trades.map((t) => [t.id, t.cancelled?.reason ?? null])).toEqual([
      [b1.id, null], [wrong.id, 'wrong price'], [right.id, null], [s1.id, null],
    ])
    const vti = view.holdings[0].basis
    // FIFO over the trades that count: 10 at 200 and 5 of the 10 at 220 are sold at 250.
    expect(vti.realizedGainUsd).toBe('650')
    expect(vti.lots.map((l) => [l.tradeId, l.quantity, l.costUsd])).toEqual([[right.id, '5', '1100']])
  })

  it('puts an undated starting position first, and keeps a holding that has been sold to nothing', () => {
    const later = stored('bitcoin', 'buy', '1', '30000', '2026-01-01')
    const start = stored('bitcoin', 'transfer_in', '2', '20000', null, { opening: true })
    const sold = stored('sec:AAPL', 'buy', '3', '150', '2026-01-01')
    const soldOut = stored('sec:AAPL', 'sell', '3', '180', '2026-02-01')
    const view = buildLedgerView([later, soldOut, sold, start], [], NOW)

    expect(view.trades[0].id).toBe(start.id)
    expect(view.trades[0].executedAt).toBeNull()
    expect(view.holdings.map((h) => [h.symbol, h.basis.quantityHeld, h.basis.realizedGainUsd])).toEqual([
      ['AAPL', '0', '90'],
      ['BTC', '3', '0'],
    ])
    expect(view.holdings[1].basis.lots[0]).toMatchObject({ tradeId: start.id, startingPosition: true, acquiredAt: null })
  })

  it('shows what cancelling a purchase does to a later sale, rather than hiding it', () => {
    const b = stored('sec:MSFT', 'buy', '4', '300', '2026-01-01')
    const s = stored('sec:MSFT', 'sell', '4', '350', '2026-02-01')
    const view = buildLedgerView([b, s], [cancel(b.id)], NOW)
    const basis = view.holdings[0].basis
    expect(basis.unmatched).toEqual([{ saleId: s.id, quantity: '4', proceedsUsd: '1400' }])
    expect(basis.issues.map((i) => i.code)).toEqual(['sold-more-than-held'])
  })
})

describe('valueLedger', () => {
  let n = 100
  function stored(instrumentKey: string, symbol: string, side: StoredTrade['side'], quantity: string, price: string, date: string | null, extra: Partial<StoredTrade> = {}): StoredTrade {
    n += 1
    return {
      id: `v${n}`, instrumentKey, symbol, name: symbol, side, quantity, pricePerUnit: price, feeUsd: '0',
      executedAt: date === null ? null : new Date(`${date}T15:00:00Z`), opening: false, note: null,
      createdAt: new Date('2026-10-01T00:00:00Z'), ...extra,
    }
  }
  const view = buildLedgerView([
    stored('sec:VTI', 'VTI', 'transfer_in', '10', '200', null, { opening: true }),
    stored('sec:VTI', 'VTI', 'buy', '5', '250', '2026-03-02', { feeUsd: '1.00' }),
    stored('sec:VTI', 'VTI', 'sell', '12', '300', '2026-06-01', { feeUsd: '2.00' }),
    stored('bitcoin', 'BTC', 'buy', '1', '60000', '2026-04-01'),
    stored('sec:AAPL', 'AAPL', 'buy', '3', '150', '2026-01-01'),
    stored('sec:AAPL', 'AAPL', 'sell', '3', '180', '2026-02-01'),
  ], [], NOW)

  it('values what is held at live prices, and leaves an unpriced holding unvalued', () => {
    const { holdings, totals } = valueLedger(view, { 'sec:VTI': 310, 'sec:AAPL': 200 })
    const vti = holdings.find((h) => h.symbol === 'VTI')!
    expect([vti.quantityHeld, vti.costHeldUsd, vti.valueUsd, vti.unrealizedUsd]).toEqual(['3', '750.6', '930', '179.4'])
    const btc = holdings.find((h) => h.symbol === 'BTC')!
    expect([btc.priceUsd, btc.valueUsd, btc.unrealizedUsd]).toEqual([null, null, null])
    // Sold to nothing: no value, and not counted as unpriced either.
    const aapl = holdings.find((h) => h.symbol === 'AAPL')!
    expect([aapl.quantityHeld, aapl.valueUsd, aapl.realizedGainUsd]).toEqual(['0', null, '90'])

    expect(totals).toEqual({
      costHeldUsd: '60750.6',
      pricedCostUsd: '750.6',
      valueUsd: '930',
      unrealizedUsd: '179.4',
      realizedGainUsd: '1187.6',
      realizedFromStartingPositionUsd: '998.33333333333333333333333333',
      heldCount: 2,
      pricedCount: 1,
      unpriced: ['BTC'],
    })
  })

  it('never values a holding at its cost when its price is missing or unusable', () => {
    for (const price of [undefined, Number.NaN, -1]) {
      const prices: Record<string, number> = price === undefined ? {} : { bitcoin: price }
      const { totals } = valueLedger(view, prices)
      expect(totals.unpriced).toContain('BTC')
      expect(totals.valueUsd).toBe('0')
    }
  })
})

describe('formatting for the screen', () => {
  it('writes dollars to the cent with separators, and signs a change', () => {
    expect(formatUsd('1234.5')).toBe('$1,234.50')
    expect(formatUsd('1234567.891')).toBe('$1,234,567.89')
    expect(formatUsd('-12')).toBe('-$12.00')
    expect(formatUsd('-0.004')).toBe('$0.00')
    expect(formatUsdChange('179.4')).toBe('+$179.40')
    expect(formatUsdChange('-200')).toBe('-$200.00')
    expect(formatUsdChange('0.001')).toBe('$0.00')
  })

  it('keeps a small unit price to every decimal stored, and a large one to the cent', () => {
    expect(formatUnitPrice('250.2')).toBe('$250.20')
    expect(formatUnitPrice('60000')).toBe('$60,000.00')
    expect(formatUnitPrice('0.5')).toBe('$0.50')
    expect(formatUnitPrice('0.00000002')).toBe('$0.00000002')
    expect([formatLivePrice(310), formatLivePrice(100), formatLivePrice(0.5), formatLivePrice(0.00001234), formatLivePrice(1e-9)])
      .toEqual(['$310.00', '$100.00', '$0.50', '$0.00001234', '$0.00'])
  })

  // The database pads amounts to their column's scale. Trimming must stop at the
  // decimal point: "10" without one is ten, never one.
  it('drops padding zeros after a decimal point and leaves whole numbers alone', () => {
    expect(['10.50000000', '100', '100.000', '0.00000000', '0.000000000000000001'].map(trimDecimal))
      .toEqual(['10.5', '100', '100', '0', '0.000000000000000001'])
  })

  it('groups units without touching their decimals', () => {
    expect(formatUnits('1234.5')).toBe('1,234.5')
    expect(formatUnits('1000000')).toBe('1,000,000')
    expect(formatUnits('0.000000000000000001')).toBe('0.000000000000000001')
  })

  it('names every kind of trade, and a starting position as one', () => {
    expect(tradeKindLabel({ side: 'transfer_in', opening: true })).toBe('Starting position')
    expect(['buy', 'sell', 'transfer_in', 'transfer_out'].map((side) => tradeKindLabel({ side: side as StoredTrade['side'], opening: false })))
      .toEqual(['Buy', 'Sell', 'Transfer in', 'Transfer out'])
  })
})

