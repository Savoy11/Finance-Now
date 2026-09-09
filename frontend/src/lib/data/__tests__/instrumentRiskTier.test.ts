import { describe, it, expect } from 'vitest'
import { INSTRUMENTS, SEC_PREFIX } from '../instruments'
import { FUND_CATALOG, fundRiskLevel, fundStrategy } from '../fundCatalog'

const tierOf = (symbol: string) => {
  const row = INSTRUMENTS.find((i) => i.key === `${SEC_PREFIX}${symbol}`)
  if (!row) throw new Error(`${symbol} is not in INSTRUMENTS`)
  return row.riskTier
}

describe('fund risk tier reads strategy, not category alone', () => {
  // The defect: fundRiskTier() branched on category only, so a 3× leveraged
  // fund, a −1× inverse fund and a plain S&P 500 tracker all landed on tier 4.
  // /portfolios prints that per holding as "4/10".
  it('ranks leveraged and inverse funds above the plain index fund they track', () => {
    const voo = tierOf('VOO')
    expect(voo).toBe(4) // unchanged: the category mapping is untouched

    for (const symbol of ['UPRO', 'SH', 'SOXL']) {
      expect(tierOf(symbol), `${symbol} must not match VOO`).toBeGreaterThan(voo)
    }
  })

  it('leaves every non-speculative category tier exactly where it was', () => {
    // Pinned so the strategy floor cannot quietly re-tier the rest of the catalog.
    const cases: [string, number][] = [
      ['VOO', 4],   // us-broad
      ['BND', 2],   // bond
      ['GLDM', 4],  // commodity
      ['MUB', 2],   // municipal bond
    ]
    for (const [symbol, tier] of cases) expect(tierOf(symbol), symbol).toBe(tier)
  })

  it('treats a speculative strategy as a floor, never a replacement', () => {
    // A leveraged bond fund must not come out as a tier-2 bond holding. No such
    // fund is in the catalog today, so this asserts the rule on the boundary
    // rather than on a symbol that could be removed.
    const levered = FUND_CATALOG.filter((f) => {
      const s = fundStrategy(f)
      return s === 'leveraged' || s === 'inverse'
    })
    expect(levered.length).toBeGreaterThan(0)
    for (const f of levered) {
      expect(tierOf(f.symbol), `${f.symbol} (${f.category})`).toBeGreaterThanOrEqual(7)
    }
  })

  // The drift guard. Two functions read fund structure — fundRiskLevel() for the
  // suitability band and fundRiskTier() for the 1-10 tier. They disagreed for
  // weeks because only one read `strategy`. This fails if that happens again.
  it('agrees with fundRiskLevel on which funds are speculative', () => {
    const cryptoTier = 7
    for (const f of FUND_CATALOG) {
      if (fundRiskLevel(f) !== 'speculative') continue
      expect(
        tierOf(f.symbol),
        `${f.symbol} is 'speculative' per fundRiskLevel but carries a lower tier`,
      ).toBeGreaterThanOrEqual(cryptoTier)
    }
  })
})
