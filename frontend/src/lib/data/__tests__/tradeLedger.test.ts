import { describe, expect, it } from 'vitest'
import { INSTRUMENT_BY_KEY, type InstrumentClass } from '../instruments'
import { REALIZED_METHOD_LABEL } from '../costBasis'
import {
  MAX_NOTE_LENGTH, MAX_REASON_LENGTH, buildLedgerView, parseCancelInput, parsePortfolioInput,
  parseTradeInput, trackableInstrument, type StoredCancellation, type StoredTrade,
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
