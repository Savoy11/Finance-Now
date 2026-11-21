import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COST_BENCHMARK_ER_PCT, COST_HORIZON_YEARS, COST_RETURN_PCT, PER_WHAT_IF_USD,
  portfolioFundCosts, trackedCostPositions, whatIfCostPositions,
} from '../portfolioCosts'
import { feeImpact } from '../feeImpact'
import { FUND_CATALOG, fundSalesCharge, getFund } from '../fundCatalog'

const params = (principal: number) => ({ principal, years: COST_HORIZON_YEARS, annualReturnPct: COST_RETURN_PCT })

describe('portfolioFundCosts (T-448)', () => {
  // VOO charges the 0.03% benchmark itself; AGTHX charges 0.59% with a verified 5.75% front load.
  const positions = [
    { key: 'sec:VOO', symbol: 'VOO', valueUsd: 6_000 },
    { key: 'sec:AGTHX', symbol: 'AGTHX', valueUsd: 4_000 },
    { key: 'sec:AAPL', symbol: 'AAPL', valueUsd: 5_000 },
    { key: 'bitcoin', symbol: 'BTC', valueUsd: 2_000 },
    { key: 'sec:GC=F', symbol: 'GC=F', valueUsd: 1_000 },
  ]
  const costs = portfolioFundCosts(positions)

  it('counts funds only: a stock, a coin and a futures contract carry no fund fee', () => {
    expect(costs.funds.map((f) => f.symbol)).toEqual(['VOO', 'AGTHX'])
    expect(costs.fundValueUsd).toBe(10_000)
    expect(costs.feeNotOnFile).toEqual([])
  })

  it('weights the expense ratio by value and costs it in dollars a year', () => {
    // (6,000 × 0.03% + 4,000 × 0.59%) = $1.80 + $23.60 = $25.40 a year, 0.254% of $10,000.
    expect(costs.annualCostUsd).toBeCloseTo(25.4, 10)
    expect(costs.weightedExpenseRatioPct).toBeCloseTo(0.254, 10)
  })

  it('agrees with the fund page and the Fund Registry: the same engine, the same assumptions', () => {
    // Mutation: compute the ten-year figure any other way and this fails.
    expect(costs.funds.find((f) => f.symbol === 'VOO')?.horizonCostUsd).toBe(feeImpact(getFund('VOO'), params(6_000))?.costUsd)
    expect(costs.funds.find((f) => f.symbol === 'AGTHX')?.horizonCostUsd).toBe(feeImpact(getFund('AGTHX'), params(4_000))?.costUsd)
    expect(costs.horizonCostUsd).toBe(
      (feeImpact(getFund('VOO'), params(6_000))?.costUsd ?? NaN) + (feeImpact(getFund('AGTHX'), params(4_000))?.costUsd ?? NaN),
    )
    expect(COST_HORIZON_YEARS).toBe(10)
    expect(COST_BENCHMARK_ER_PCT).toBe(0.03)
  })

  it('counts a verified front load in the ten-year figure, as the fund page does', () => {
    const agthx = costs.funds.find((f) => f.symbol === 'AGTHX')!
    expect(agthx.includesLoad).toBe(true)
    expect(agthx.unverifiedLoad).toBe(false)
    // The load is paid at purchase, never yearly: the yearly cost is the expense ratio alone.
    expect(agthx.annualCostUsd).toBeCloseTo(23.6, 10)
  })

  it('leaves a front load out on funds already held: it was paid at purchase (audit 2026-11-07)', () => {
    // AGTHX worth $50,000 in a tracked portfolio was shown $10,687 over ten years, its 5.75% load
    // counted again on money already invested; the expense ratio alone gives about $5,357.
    const held = portfolioFundCosts([{ key: 'sec:AGTHX', symbol: 'AGTHX', valueUsd: 50_000 }], { held: true }).funds[0]
    const bought = portfolioFundCosts([{ key: 'sec:AGTHX', symbol: 'AGTHX', valueUsd: 50_000 }]).funds[0]
    expect(held.includesLoad).toBe(false)
    expect(held.frontLoadPaid).toBe(true)
    expect(held.horizonCostUsd).toBe(feeImpact(getFund('AGTHX'), { ...params(50_000), alreadyHeld: true })?.costUsd)
    expect(Math.round(held.horizonCostUsd)).toBe(5_357)
    expect(Math.round(bought.horizonCostUsd)).toBe(10_687)
    expect(bought.includesLoad).toBe(true)
    expect(bought.frontLoadPaid).toBe(false)
    // The yearly cost is the expense ratio either way.
    expect(held.annualCostUsd).toBe(bought.annualCostUsd)
    // VOO has no load: held or not, the same figure.
    const voo = (h: boolean) => portfolioFundCosts([{ key: 'sec:VOO', symbol: 'VOO', valueUsd: 50_000 }], { held: h }).funds[0]
    expect(voo(true).horizonCostUsd).toBe(voo(false).horizonCostUsd)
    expect(voo(true).frontLoadPaid).toBe(false)
  })

  it('does not call a held fund\'s unverified front load an understatement, since it is behind the holder', () => {
    for (const f of FUND_CATALOG) {
      const charge = fundSalesCharge(f)
      const line = portfolioFundCosts([{ key: `sec:${f.symbol}`, symbol: f.symbol, valueUsd: 1_000 }], { held: true }).funds[0]
      expect(line.unverifiedLoad, f.symbol).toBe(charge != null && charge.maxPct == null && charge.kind !== 'front')
    }
    const card = readFileSync(join(process.cwd(), 'src/components/portfolio/PortfolioCostsCard.tsx'), 'utf8')
    expect(card).toContain("portfolioFundCosts(positions, { held: basis === 'tracked' })")
  })

  it('flags an unverified load wherever the fund page would', () => {
    for (const f of FUND_CATALOG) {
      const line = portfolioFundCosts([{ key: `sec:${f.symbol}`, symbol: f.symbol, valueUsd: 1_000 }]).funds[0]
      const charge = fundSalesCharge(f)
      expect(line.unverifiedLoad, f.symbol).toBe(charge != null && charge.maxPct == null)
    }
  })

  it('leaves out a fund with no value and names it, never valuing it at cost', () => {
    const c = portfolioFundCosts([
      { key: 'sec:VOO', symbol: 'VOO', valueUsd: null },
      { key: 'sec:BND', symbol: 'BND', valueUsd: 1_000 },
    ])
    expect(c.unpricedFunds).toEqual(['VOO'])
    expect(c.funds.map((f) => f.symbol)).toEqual(['BND'])
  })

  it('names a security it cannot place instead of counting it as free', () => {
    const c = portfolioFundCosts([{ key: 'sec:ZZZZQ', symbol: 'ZZZZQ', valueUsd: 1_000 }])
    expect(c.feeNotOnFile).toEqual(['ZZZZQ'])
    expect(c.funds).toEqual([])
    expect(c.weightedExpenseRatioPct).toBeNull()
  })

  it('has no figure at all when nothing held is a fund', () => {
    const c = portfolioFundCosts([{ key: 'sec:AAPL', symbol: 'AAPL', valueUsd: 1_000 }])
    expect(c.weightedExpenseRatioPct).toBeNull()
    expect(c.annualCostUsd).toBe(0)
    expect(c.horizonCostUsd).toBe(0)
  })
})

describe('positions for the two kinds of portfolio', () => {
  it('reads a what-if portfolio per $10,000, by target allocation', () => {
    const p = whatIfCostPositions([
      { cgId: 'sec:VOO', symbol: 'VOO', targetAlloc: 60 },
      { cgId: 'sec:BND', symbol: 'BND', targetAlloc: 40 },
    ])
    expect(PER_WHAT_IF_USD).toBe(10_000)
    expect(p.map((x) => x.valueUsd)).toEqual([6_000, 4_000])
  })

  it('reads a tracked portfolio at live values, skipping holdings sold out', () => {
    const p = trackedCostPositions([
      { instrumentKey: 'sec:VOO', symbol: 'VOO', quantityHeld: '10', valueUsd: '5900.50' },
      { instrumentKey: 'sec:BND', symbol: 'BND', quantityHeld: '0', valueUsd: null },
      { instrumentKey: 'sec:VXUS', symbol: 'VXUS', quantityHeld: '3', valueUsd: null },
    ])
    expect(p).toEqual([
      { key: 'sec:VOO', symbol: 'VOO', valueUsd: 5900.5 },
      { key: 'sec:VXUS', symbol: 'VXUS', valueUsd: null },
    ])
  })
})

describe('the card says what the figures are, never what to do (no warning or threshold)', () => {
  const card = readFileSync(join(__dirname, '../../../components/portfolio/PortfolioCostsCard.tsx'), 'utf8')

  it('uses no word that grades a fee', () => {
    // The do-not-fix registry records the Portfolio Builder's deliberate absence of a fee
    // warning; this card is a figure, not a verdict (D92). Mutation: add "expensive" and this fails.
    expect(card).not.toMatch(/\b(expensive|cheap|too high|high-fee|low-fee|warning|consider switching|should)\b/i)
  })

  it('is shown on both portfolio screens', () => {
    const whatIf = readFileSync(join(__dirname, '../../../app/(dashboard)/portfolios/page.tsx'), 'utf8')
    const tracked = readFileSync(join(__dirname, '../../../components/portfolio/tracked/TrackedPortfolioDetail.tsx'), 'utf8')
    expect(whatIf).toMatch(/<PortfolioCostsCard[^>]*basis="what-if"/)
    expect(tracked).toMatch(/<PortfolioCostsCard[^>]*basis="tracked"/)
  })
})

describe('the methods page says how the card works it out (D163)', () => {
  it('has a paragraph on the portfolio costs card, read from the same constants', async () => {
    const { DATA_METHODS } = await import('@/lib/legal/dataMethods')
    const section = DATA_METHODS.find((s) => s.id === 'fund-costs')
    const text = section?.paragraphs.join(' ') ?? ''
    expect(text).toContain("A portfolio's costs card")
    expect(text).toContain(`over ${COST_HORIZON_YEARS} years against a ${COST_BENCHMARK_ER_PCT}% index fund at ${COST_RETURN_PCT}% a year`)
    expect(text).toContain('per $10,000 invested in its mix')
    expect(text).toContain('no threshold and gives no warning')
  })
})
