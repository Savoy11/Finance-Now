import { describe, it, expect } from 'vitest'
import {
  YEARLY_AFTER_DAYS, actualWeightsFromTracked, formatReturnPct, moneyFlows, moneyWeightedRate, portfolioReturn,
  trackedBriefSymbols, trackedClassSplit, trackedLookThroughPositions,
} from '../trackedPortfolioViews'
import type { HoldingValue, LedgerView, TradeView } from '../tradeLedger'

// T-453 (D207, D208): a tracked portfolio read by the Daily Brief, the look-through, the
// Portfolio Builder's drift check, and a figure for what the money has earned.

const NOW = new Date('2026-11-07T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

function holding(instrumentKey: string, symbol: string, quantityHeld: string, costHeldUsd: string, valueUsd: string | null): HoldingValue {
  return {
    instrumentKey, symbol, name: symbol, quantityHeld, costHeldUsd, averageCostUsd: null,
    priceUsd: valueUsd === null ? null : 1, valueUsd, unrealizedUsd: null,
    realizedGainUsd: '0', realizedFromStartingPositionUsd: '0', incomeUsd: '0', incomeLast12MonthsUsd: '0', issues: [],
  }
}

let n = 0
function trade(side: TradeView['side'], quantity: string, price: string, executedAt: string | null, extra: Partial<TradeView> = {}): TradeView {
  n += 1
  return {
    id: `t${n}`, instrumentKey: 'sec:VOO', symbol: 'VOO', name: 'VOO', side, quantity, pricePerUnit: price, feeUsd: '0',
    executedAt, opening: false, note: null, createdAt: executedAt ?? NOW.toISOString(), split: null, income: null, cancelled: null,
    ...extra,
  }
}

const HOLDINGS: HoldingValue[] = [
  holding('bitcoin', 'BTC', '0.1', '5000', '7000'),
  holding('tether', 'USDT', '1000', '1000', '1000'),
  holding('sec:VOO', 'VOO', '10', '4000', '6000'),
  holding('sec:AGTHX', 'AGTHX', '20', '1500', '2000'),
  holding('sec:AAPL', 'AAPL', '5', '700', '1000'),
  holding('sec:ZZZZ', 'ZZZZ', '3', '300', '400'),       // a security outside the catalog
  holding('sec:QQQQ', 'QQQQ', '2', '200', null),        // held, no live price
  holding('ethereum', 'ETH', '0', '0', null),            // sold to nothing
]

describe('the Daily Brief reads tracked holdings: tickers only (a)', () => {
  it('names each holding still held with its class, never its units or cost', () => {
    const view = { holdings: HOLDINGS.map((h) => ({ instrumentKey: h.instrumentKey, symbol: h.symbol, name: h.name, basis: { quantityHeld: h.quantityHeld } })) } as unknown as LedgerView
    const symbols = trackedBriefSymbols(view)
    expect(symbols).toEqual([
      'BTC (crypto)', 'USDT (crypto)', 'VOO (etf)', 'AGTHX (mutual)', 'AAPL (equity)', 'ZZZZ (stock or fund)', 'QQQQ (stock or fund)',
    ])
    expect(symbols.join(' ')).not.toMatch(/\d{2,}|\$/)
  })
})

describe('how the money splits, and what the funds hold (b)', () => {
  it('splits by live value: coins by their category, everything else by class, the unpriced named', () => {
    const split = trackedClassSplit(HOLDINGS)
    expect(split.valueUsd).toBe(17400)
    expect(split.slices.map((s) => [s.label, s.valueUsd])).toEqual([
      ['Layer 1', 7000], ['ETF', 6000], ['Mutual fund', 2000], ['Stablecoins', 1000], ['Stock', 1000], ['Stocks and funds outside the catalog', 400],
    ])
    expect(split.slices.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 10)
    expect(split.unpriced).toEqual(['QQQQ'])
  })

  it('looks through catalog funds by their share of live value, and holds the rest directly', () => {
    const { positions, funds, unpriced } = trackedLookThroughPositions(HOLDINGS)
    expect(funds).toEqual(['VOO', 'AGTHX'])
    expect(positions.find((p) => p.symbol === 'VOO')).toMatchObject({ isFund: true })
    expect(positions.find((p) => p.symbol === 'VOO')!.weightPct).toBeCloseTo((6000 / 17400) * 100, 10)
    expect(positions.find((p) => p.symbol === 'ZZZZ')).toMatchObject({ isFund: false })
    expect(positions.reduce((s, p) => s + p.weightPct, 0)).toBeCloseTo(100, 10)
    expect(unpriced).toEqual(['QQQQ'])
  })
})

describe('the drift check reads a tracked portfolio (c)', () => {
  it('weights each priced holding by live value, and says how much was left out by cost', () => {
    const a = actualWeightsFromTracked(HOLDINGS)
    expect(a.valueUsd).toBe(17400)
    expect(a.weights.VOO).toBe(34.5)
    expect(a.weights.BTC).toBe(40.2)
    expect(a.weights.QQQQ).toBeUndefined()
    // QQQQ cost $200 of the $12,700 held at cost.
    expect(a.unpricedPct).toBe(1.6)
    expect(a.pricedPct).toBe(98.4)
    expect(a.unpriced).toEqual(['QQQQ'])
  })
})

describe('the money put in and taken out (d)', () => {
  it('counts buys, transfers in and starting positions in, sales and cash income out, and nothing else', () => {
    const { flows, transferOut } = moneyFlows([
      trade('transfer_in', '10', '100', null, { opening: true, feeUsd: '1.00' }),
      trade('buy', '2', '150.5', daysAgo(100), { feeUsd: '0.50' }),
      trade('sell', '1', '200', daysAgo(50), { feeUsd: '2.00' }),
      trade('income', '0', '0', daysAgo(40), { income: { amountUsd: '12.34', kind: 'dividend' } }),
      trade('income_units', '0.1', '210', daysAgo(30)),
      trade('split', '0', '0', daysAgo(20), { split: { unitsAfter: 2, unitsBefore: 1, cashInLieuUsd: null } }),
      trade('buy', '100', '1', daysAgo(10), { cancelled: { at: NOW.toISOString(), reason: 'typo' } }),
    ])
    expect(transferOut).toBe(false)
    expect(flows.map((f) => [f.direction, f.amountUsd])).toEqual([
      ['in', expect.stringMatching(/^1001(\.0+)?$/)],
      ['in', expect.stringMatching(/^301\.5(0+)?$/)],
      ['out', expect.stringMatching(/^198(\.0+)?$/)],
      ['out', '12.34'],
    ])
    expect(moneyFlows([trade('transfer_out', '1', '0', daysAgo(5))]).transferOut).toBe(true)
  })
})

describe('what the money has earned (d, owner D208: yearly only once a year old)', () => {
  it('is the yearly rate that grows the money put in to what was taken out and is held now', () => {
    // $1,000 two years ago and $1,000 one year ago, worth $2,310 now: 10% a year
    // (1,000 × 1.1² + 1,000 × 1.1 = 2,310).
    const r = portfolioReturn(
      [trade('buy', '10', '100', daysAgo(730)), trade('buy', '10', '100', daysAgo(365))],
      { valueUsd: '2310', unpriced: [] }, NOW,
    )
    expect(r.kind).toBe('yearly')
    if (r.kind !== 'yearly') return
    expect(r.ratePct).toBeCloseTo(10, 4)
    expect(Number(r.investedUsd)).toBe(2000)
    expect(Number(r.gainUsd)).toBe(310)
  })

  it('counts a sale and cash income as money taken out', () => {
    // $1,000 two years ago; $500 taken out a year ago (a sale) and $50 of income: at 10%,
    // 1,000 × 1.21 = 550 × 1.1 + 605 now.
    const r = portfolioReturn([
      trade('buy', '10', '100', daysAgo(730)),
      trade('sell', '5', '100', daysAgo(365)),
      trade('income', '0', '0', daysAgo(365), { income: { amountUsd: '50', kind: 'dividend' } }),
    ], { valueUsd: '605', unpriced: [] }, NOW)
    expect(r.kind === 'yearly' && r.ratePct).toBeCloseTo(10, 4)
  })

  it('goes below zero on a loss', () => {
    const r = portfolioReturn([trade('buy', '10', '100', daysAgo(365))], { valueUsd: '800', unpriced: [] }, NOW)
    expect(r.kind === 'yearly' && r.ratePct).toBeCloseTo(-20, 4)
  })

  it('shows the plain total return before the first money is a year old', () => {
    const r = portfolioReturn([trade('buy', '10', '100', daysAgo(YEARLY_AFTER_DAYS - 1))], { valueUsd: '1100', unpriced: [] }, NOW)
    expect(r).toMatchObject({ kind: 'total', why: 'under-a-year' })
    expect(r.kind === 'total' && r.pct).toBeCloseTo(10, 10)
  })

  it('shows the plain total when the starting position has no date', () => {
    const r = portfolioReturn([
      trade('transfer_in', '10', '100', null, { opening: true }),
      trade('buy', '10', '100', daysAgo(800)),
    ], { valueUsd: '2500', unpriced: [] }, NOW)
    expect(r).toMatchObject({ kind: 'total', why: 'undated-start', since: null })
    expect(r.kind === 'total' && r.pct).toBeCloseTo(25, 10)
  })

  it('gives no figure while a holding has no live price, after a transfer out, or with nothing put in', () => {
    expect(portfolioReturn([trade('buy', '1', '100', daysAgo(400))], { valueUsd: '0', unpriced: ['VOO'] }, NOW))
      .toEqual({ kind: 'none', why: 'unpriced', unpriced: ['VOO'] })
    expect(portfolioReturn([trade('buy', '1', '100', daysAgo(400)), trade('transfer_out', '1', '0', daysAgo(10))], { valueUsd: '0', unpriced: [] }, NOW))
      .toEqual({ kind: 'none', why: 'transfer-out' })
    expect(portfolioReturn([], { valueUsd: '0', unpriced: [] }, NOW)).toEqual({ kind: 'none', why: 'nothing-put-in' })
  })

  it('finds no rate where the money only went one way', () => {
    expect(moneyWeightedRate([{ years: 1, amount: -100 }, { years: 0, amount: -5 }])).toBeNull()
    expect(moneyWeightedRate([{ years: 1, amount: -100 }, { years: 0, amount: 0 }])).toBeNull()
  })

  it('writes the figure with a true minus sign', () => {
    expect(formatReturnPct(7.25)).toBe('+7.3%')
    expect(formatReturnPct(-2.04)).toBe('−2.0%')
    expect(formatReturnPct(0.01)).toBe('0.0%')
  })
})
