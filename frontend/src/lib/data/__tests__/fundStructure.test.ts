import { describe, expect, it } from 'vitest'
import { FUND_CATALOG, getFund } from '../fundCatalog'
import { dailyMultiple, fundStructureFacts } from '../fundStructure'

const facts = (symbol: string) => {
  const f = getFund(symbol)
  if (!f) throw new Error(`${symbol} is not in the catalog`)
  return fundStructureFacts(f)
}
const labels = (symbol: string) => facts(symbol).map((x) => x.label)

describe('dailyMultiple', () => {
  it('reads the multiple from the tracked-index name', () => {
    expect(dailyMultiple('Nasdaq-100 (3× daily)')).toBe(3)
    expect(dailyMultiple('Nasdaq-100 (−3× daily)')).toBe(-3)
    expect(dailyMultiple('S&P 500 (-1x daily)')).toBe(-1)
  })
  it('returns null when no multiple is stated', () => {
    expect(dailyMultiple('S&P 500')).toBeNull()
    expect(dailyMultiple(null)).toBeNull()
  })
})

describe('fundStructureFacts', () => {
  it('states the daily multiple for leveraged and inverse funds', () => {
    expect(facts('TQQQ')[0].text).toContain('3× its index')
    expect(facts('SQQQ')[0].text).toContain('−3× its index')
    expect(facts('SH')[0].text).toContain('−1× its index')
  })

  it('every leveraged or inverse fund in the catalog gets the daily-reset fact with a stated multiple', () => {
    const daily = FUND_CATALOG.filter((f) => f.strategy === 'leveraged' || f.strategy === 'inverse')
    expect(daily.length).toBeGreaterThan(0)
    for (const f of daily) {
      const [first] = fundStructureFacts(f)
      expect(first?.label, f.symbol).toBe('Daily reset')
      expect(dailyMultiple(f.indexTracked), `${f.symbol} names no multiple`).not.toBeNull()
    }
  })

  it('covered-call funds get the options-income fact', () => {
    expect(labels('JEPI')).toEqual(['Options income'])
  })

  it('bond, commodity, currency and crypto funds say what they track', () => {
    expect(labels('BND')).toEqual(['Holds bonds'])
    expect(labels('GLD')).toEqual(['Tracks commodities'])
    expect(labels('FXE')).toEqual(['Tracks currencies'])
    expect(labels('IBIT')).toEqual(['Tracks crypto'])
  })

  it('a plain stock index fund gets no extra line', () => {
    expect(facts('VOO')).toEqual([])
  })

  it('uses no risk-tolerance words, which the label it replaces did', () => {
    const banned = /conservative|moderate|aggressive|speculative|suitab|safe|risky/i
    for (const f of FUND_CATALOG) {
      for (const x of fundStructureFacts(f)) {
        expect(`${x.label} ${x.text}`, f.symbol).not.toMatch(banned)
      }
    }
  })
})
