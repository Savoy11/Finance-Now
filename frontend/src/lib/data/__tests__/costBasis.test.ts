import { describe, expect, it } from 'vitest'
import type { TradeSide, TradeTransaction } from '@/lib/db/schema/invest'
import {
  COST_BASIS_METHOD, REALIZED_METHOD_LABEL, computeCostBasis, toCents,
  type LedgerTrade,
} from '../costBasis'

/**
 * T-027 step 1 (owner decisions D12 and D65, 2026-10-04). FIFO for every
 * portfolio; a starting position is the oldest lot; gains are plain, not
 * adjusted for tax rules. The figures are exact, so the expected values below
 * are exact strings, not numbers compared within a tolerance.
 */

const NOW = new Date('2026-10-04T12:00:00Z')
const iso = (d: string) => (d.includes('T') ? d : `${d}T15:00:00Z`)
const out = (d: string) => new Date(iso(d)).toISOString()

function trade(side: TradeSide, id: string, quantity: string, price: string, date: string | null, extra: Partial<LedgerTrade> = {}): LedgerTrade {
  return { id, side, quantity, pricePerUnit: price, feeUsd: '0', executedAt: date === null ? null : iso(date), ...extra }
}
const buy = (id: string, q: string, p: string, d: string, extra?: Partial<LedgerTrade>) => trade('buy', id, q, p, d, extra)
const sell = (id: string, q: string, p: string, d: string, extra?: Partial<LedgerTrade>) => trade('sell', id, q, p, d, extra)
const start = (id: string, q: string, avg: string, d: string | null) => trade('transfer_in', id, q, avg, d, { opening: true })

const run = (trades: LedgerTrade[]) => computeCostBasis(trades, NOW)

// The test's own exact arithmetic, kept apart from the engine's.
const DP = 26
function dec(s: string): bigint {
  const [whole, frac = ''] = s.replace('-', '').split('.')
  const v = BigInt(whole + frac.padEnd(DP, '0'))
  return s.startsWith('-') ? -v : v
}
function sum(...values: string[]): bigint {
  return values.reduce((s, v) => s + dec(v), BigInt(0))
}

describe('computeCostBasis — FIFO (D12, D65)', () => {
  it('uses up the oldest lot first, and splits a lot sold in part by quantity', () => {
    const r = run([
      buy('b1', '10', '100', '2026-01-02', { feeUsd: '1' }),
      buy('b2', '10', '120', '2026-02-02'),
      sell('s1', '15', '130', '2026-03-02', { feeUsd: '2' }),
    ])
    expect(r.method).toBe(COST_BASIS_METHOD)
    // The buy fee is part of b1's cost; the sale fee comes off the proceeds.
    expect(r.sales.map((m) => [m.lotId, m.quantity, m.costUsd])).toEqual([['b1', '10', '1001'], ['b2', '5', '600']])
    expect(sum(...r.sales.map((m) => m.proceedsUsd))).toBe(dec('1948'))
    expect(r.realizedGainUsd).toBe('347')
    expect(sum(...r.sales.map((m) => m.gainUsd))).toBe(dec('347'))
    expect(r.lots).toEqual([{ tradeId: 'b2', acquiredAt: out('2026-02-02'), startingPosition: false, quantity: '5', costUsd: '600' }])
    expect([r.quantityHeld, r.costHeldUsd, r.averageCostUsd]).toEqual(['5', '600', '120'])
    expect(r.issues).toEqual([])
  })

  it('sells the oldest units in a same-day round trip, not the ones bought that morning', () => {
    const r = run([
      buy('b1', '10', '100', '2026-01-05'),
      buy('b2', '5', '200', '2026-06-01T14:00:00Z'),
      sell('s1', '5', '210', '2026-06-01T19:00:00Z'),
    ])
    // 5 × (210 − 100), not 5 × (210 − 200).
    expect(r.realizedGainUsd).toBe('550')
    expect(r.sales.map((m) => [m.lotId, m.quantity])).toEqual([['b1', '5']])
    expect(r.lots.map((l) => [l.tradeId, l.quantity, l.costUsd])).toEqual([['b1', '5', '500'], ['b2', '5', '1000']])
    expect(r.averageCostUsd).toBe('150')
  })

  it('counts a purchase before a sale made at the same moment', () => {
    const at = '2026-05-01T10:00:00Z'
    const r = run([sell('s1', '5', '12', at), buy('b1', '5', '10', at)])
    expect(r.realizedGainUsd).toBe('10')
    expect(r.unmatched).toEqual([])
    expect(r.issues).toEqual([])
  })

  it('gives the same answer whatever order the trades arrive in', () => {
    const trades = [
      buy('b1', '10', '100', '2026-01-02', { feeUsd: '1' }),
      buy('b2', '10', '120', '2026-02-02'),
      sell('s1', '15', '130', '2026-03-02', { feeUsd: '2' }),
      sell('s2', '2', '90', '2026-04-02'),
    ]
    expect(run([...trades].reverse())).toEqual(run(trades))
  })

  it('takes a database row as it is', () => {
    const row: TradeTransaction = {
      id: 'r1', userId: 'u', portfolioId: 'p', instrumentId: 'i', side: 'buy',
      quantity: '2.000000000000000000', pricePerUnit: '50.00000000', feeUsd: '0.50',
      executedAt: new Date('2026-02-01T00:00:00Z'), opening: false, note: null, createdAt: new Date('2026-02-01T00:00:00Z'),
    }
    const r = run([row])
    expect(r.lots).toEqual([{ tradeId: 'r1', acquiredAt: '2026-02-01T00:00:00.000Z', startingPosition: false, quantity: '2', costUsd: '100.5' }])
    expect(r.averageCostUsd).toBe('50.25')
  })

  it('holds nothing and gains nothing with no trades', () => {
    const r = run([])
    expect([r.quantityHeld, r.costHeldUsd, r.averageCostUsd, r.realizedGainUsd]).toEqual(['0', '0', null, '0'])
  })
})

describe('computeCostBasis — plain gains, not adjusted for tax rules (D65)', () => {
  it('keeps a loss as a loss when the same thing is bought back soon after', () => {
    const r = run([
      buy('b1', '10', '100', '2026-03-01'),
      sell('s1', '10', '80', '2026-03-10'),
      buy('b2', '10', '85', '2026-03-20'),
    ])
    // A wash-sale adjustment would move the 200 loss into b2's cost (1,050).
    expect(r.realizedGainUsd).toBe('-200')
    expect(r.lots.map((l) => [l.tradeId, l.costUsd])).toEqual([['b2', '850']])
  })

  it('names the method, and that it is not a tax figure', () => {
    expect(REALIZED_METHOD_LABEL).toMatch(/FIFO/)
    expect(REALIZED_METHOD_LABEL).toMatch(/not adjusted for tax rules/)
  })

  it('splits nothing into holding periods and adjusts nothing for wash sales', () => {
    const r = run([buy('b1', '1', '10', '2025-01-01'), sell('s1', '1', '20', '2026-03-01')])
    const keys = [...Object.keys(r), ...Object.keys(r.sales[0]), ...Object.keys(r.lots[0] ?? {})]
    expect(keys.filter((k) => /term|wash|tax|period/i.test(k))).toEqual([])
  })
})

describe('computeCostBasis — starting positions (D65)', () => {
  it('sells a starting position first, even with no date, and marks the gain from it', () => {
    const r = run([
      buy('b1', '5', '100', '2026-01-05'),
      sell('s1', '12', '120', '2026-02-01'),
      start('o1', '10', '50', null),
    ])
    expect(r.sales.map((m) => [m.lotId, m.quantity, m.costUsd, m.proceedsUsd, m.fromStartingPosition])).toEqual([
      ['o1', '10', '500', '1200', true],
      ['b1', '2', '200', '240', false],
    ])
    expect(r.realizedGainUsd).toBe('740')
    expect(r.realizedFromStartingPositionUsd).toBe('700')
    expect(r.lots.map((l) => [l.tradeId, l.quantity, l.costUsd])).toEqual([['b1', '3', '300']])
    expect(r.issues).toEqual([])
  })

  it('keeps an undated starting position as undated', () => {
    const r = run([start('o1', '4', '25', null)])
    expect(r.lots).toEqual([{ tradeId: 'o1', acquiredAt: null, startingPosition: true, quantity: '4', costUsd: '100' }])
  })

  it('still sells the starting position first when a trade is dated before it, and says so', () => {
    const r = run([
      start('o1', '10', '50', '2026-03-01'),
      buy('b1', '5', '100', '2026-01-05'),
      sell('s1', '10', '60', '2026-04-01'),
    ])
    expect(r.sales.map((m) => m.lotId)).toEqual(['o1'])
    expect(r.realizedGainUsd).toBe('100')
    expect(r.issues.map((i) => [i.code, i.tradeId])).toEqual([['dated-before-starting-position', 'b1']])
  })

  it('keeps a second starting position as its own lot, undated first, and flags it', () => {
    const r = run([start('o2', '5', '20', '2026-01-01'), start('o1', '5', '10', null)])
    expect(r.lots.map((l) => l.tradeId)).toEqual(['o1', 'o2'])
    expect(r.issues.map((i) => [i.code, i.tradeId])).toEqual([['second-starting-position', 'o2']])
  })
})

describe('computeCostBasis — what it will not guess', () => {
  it('assumes no cost for units sold beyond what was held', () => {
    const r = run([buy('b1', '5', '10', '2026-01-01'), sell('s1', '8', '12', '2026-02-01')])
    expect(r.sales.map((m) => [m.lotId, m.quantity, m.proceedsUsd, m.gainUsd])).toEqual([['b1', '5', '60', '10']])
    expect(r.unmatched).toEqual([{ saleId: 's1', quantity: '3', proceedsUsd: '36' }])
    expect(r.realizedGainUsd).toBe('10')
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]).toMatchObject({ code: 'sold-more-than-held', tradeId: 's1' })
    expect(r.issues[0].message).toMatch(/Sold 3 more units/)
  })

  it('moves cost out with a transfer, makes no gain, and reports the transfer fee on its own', () => {
    const r = run([
      buy('b1', '10', '100', '2026-01-01'),
      trade('transfer_out', 'x1', '4', '0', '2026-02-01', { feeUsd: '1.5' }),
      trade('transfer_out', 'x2', '10', '0', '2026-03-01'),
    ])
    expect(r.transfersOut).toEqual([
      { tradeId: 'x1', quantity: '4', costUsd: '400', feeUsd: '1.5' },
      { tradeId: 'x2', quantity: '6', costUsd: '600', feeUsd: '0' },
    ])
    expect(r.realizedGainUsd).toBe('0')
    expect(r.quantityHeld).toBe('0')
    expect(r.issues.map((i) => [i.code, i.tradeId])).toEqual([['moved-more-than-held', 'x2']])
  })

  it('carries the stated cost on a transfer in, plus its fee', () => {
    const r = run([trade('transfer_in', 'i1', '2', '50', '2026-01-01', { feeUsd: '0.5' })])
    expect([r.costHeldUsd, r.averageCostUsd]).toEqual(['100.5', '50.25'])
  })

  it('leaves out a row it cannot read, says why, and still works out the rest', () => {
    const r = run([
      buy('ok', '1', '10', '2026-01-01'),
      buy('zero', '0', '10', '2026-01-01'),
      buy('negative', '-1', '10', '2026-01-01'),
      buy('too-fine', '0.0000000000000000001', '10', '2026-01-01'),
      buy('bad-price', '1', 'abc', '2026-01-01'),
      buy('bad-fee', '1', '10', '2026-01-01', { feeUsd: '-1' }),
      buy('bad-date', '1', '10', '2026-01-01', { executedAt: 'not a date' }),
      sell('no-date', '1', '10', '2026-01-01', { executedAt: null }),
      buy('start-as-buy', '1', '10', '2026-01-01', { opening: true }),
      trade('split' as TradeSide, 'unknown-side', '2', '0', '2026-01-01'),
    ])
    expect(r.issues.every((i) => i.code === 'invalid-trade')).toBe(true)
    expect(r.issues.map((i) => i.tradeId)).toEqual([
      'zero', 'negative', 'too-fine', 'bad-price', 'bad-fee', 'bad-date', 'no-date', 'start-as-buy', 'unknown-side',
    ])
    expect(r.issues.every((i) => i.message.startsWith('Left out:'))).toBe(true)
    expect(r.lots.map((l) => l.tradeId)).toEqual(['ok'])
  })

  it('accepts trailing zeros past the column scale, but not digits', () => {
    const r = run([buy('b1', '1.0000000000000000000', '10.000000000', '2026-01-01', { feeUsd: '0.000' })])
    expect(r.issues).toEqual([])
    expect(r.costHeldUsd).toBe('10')
  })

  it('flags a trade dated after now, and still counts it', () => {
    const r = run([buy('b1', '1', '10', '2026-12-01')])
    expect(r.issues.map((i) => [i.code, i.tradeId])).toEqual([['future-date', 'b1']])
    expect(r.quantityHeld).toBe('1')
  })
})

describe('computeCostBasis — exact arithmetic', () => {
  it('keeps the eighteenth decimal of a quantity, where a float would drop it', () => {
    const r = run([buy('b1', '1.000000000000000001', '2000', '2026-01-01'), sell('s1', '1', '2100', '2026-02-01')])
    expect(r.realizedGainUsd).toBe('100')
    expect(r.lots).toEqual([{
      tradeId: 'b1', acquiredAt: out('2026-01-01'), startingPosition: false,
      quantity: '0.000000000000000001', costUsd: '0.000000000000002',
    }])
    expect(r.averageCostUsd).toBe('2000')
  })

  it('rounds the average cost to 8 decimals, halves away from zero', () => {
    expect(run([buy('b1', '1', '0.00000001', '2026-01-01'), buy('b2', '1', '0.00000002', '2026-01-02')]).averageCostUsd).toBe('0.00000002')
    expect(run([buy('b1', '3', '10', '2026-01-01', { feeUsd: '0.01' })]).averageCostUsd).toBe('10.00333333')
  })

  it('never gains or loses a fraction of a cent across a long, messy history', () => {
    // A fixed pseudo-random history: odd quantities, prices and fees, sales
    // past what is held, transfers, and repeated timestamps.
    let seed = 20261004
    const rand = () => { // mulberry32
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join('')
    const sides: TradeSide[] = ['buy', 'buy', 'buy', 'sell', 'sell', 'transfer_in', 'transfer_out']
    const trades: LedgerTrade[] = []
    let day = 0
    for (let i = 0; i < 80; i++) {
      if (rand() < 0.7) day += 1
      const side = sides[Math.floor(rand() * sides.length)]
      trades.push({
        id: `t${String(i).padStart(3, '0')}`, side,
        quantity: `${Math.floor(rand() * 7)}.${digits(18)}`,
        pricePerUnit: `${Math.floor(rand() * 5000)}.${digits(8)}`,
        feeUsd: `${Math.floor(rand() * 3)}.${digits(2)}`,
        executedAt: new Date(Date.UTC(2025, 0, 1 + day)).toISOString(),
      })
    }
    const r = run(trades)
    const amount = (t: LedgerTrade) => dec(t.quantity) * dec(t.pricePerUnit) / BigInt(`1${'0'.repeat(DP)}`)
    const fee = (t: LedgerTrade) => dec(t.feeUsd)
    const of = (s: TradeSide) => trades.filter((t) => t.side === s)

    // Every dollar paid in sits in a lot, went out with a sale, or left with a transfer.
    const paidIn = [...of('buy'), ...of('transfer_in')].reduce((s, t) => s + amount(t) + fee(t), BigInt(0))
    expect(sum(r.costHeldUsd, ...r.sales.map((m) => m.costUsd), ...r.transfersOut.map((x) => x.costUsd))).toBe(paidIn)

    // Every dollar a sale brought in is either matched to a lot or reported as unmatched.
    const proceeds = of('sell').reduce((s, t) => s + amount(t) - fee(t), BigInt(0))
    expect(sum(...r.sales.map((m) => m.proceedsUsd), ...r.unmatched.map((u) => u.proceedsUsd))).toBe(proceeds)

    // Every unit that came in is still held, was sold or was moved out.
    const unitsIn = [...of('buy'), ...of('transfer_in')].reduce((s, t) => s + dec(t.quantity), BigInt(0))
    expect(sum(r.quantityHeld, ...r.sales.map((m) => m.quantity), ...r.transfersOut.map((x) => x.quantity))).toBe(unitsIn)

    // The realized total is the sum of its parts, and the test was not vacuous.
    expect(sum(...r.sales.map((m) => m.gainUsd))).toBe(dec(r.realizedGainUsd))
    expect(r.sales.length).toBeGreaterThan(10)
    expect(r.unmatched.length + r.issues.filter((i) => i.code === 'moved-more-than-held').length).toBeGreaterThan(0)
  })
})

describe('toCents', () => {
  it('rounds to cents, halves away from zero, and shows both decimals', () => {
    expect(toCents('347')).toBe('347.00')
    expect(toCents('649.33333333333333333333333334')).toBe('649.33')
    expect(toCents('1298.665')).toBe('1298.67')
    expect(toCents('0.005')).toBe('0.01')
    expect(toCents('-0.005')).toBe('-0.01')
    expect(toCents('-0.004')).toBe('0.00')
    expect(toCents('-200')).toBe('-200.00')
  })

  it('refuses what is not a dollar figure', () => {
    expect(() => toCents('12 dollars')).toThrow(/not a dollar figure/)
  })
})
