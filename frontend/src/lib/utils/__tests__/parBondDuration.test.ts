import { describe, expect, it } from 'vitest'
import { modifiedDuration, parStartPrice, rateMoveEffect, treasuryPrice } from '../parBondDuration'

describe('treasuryPrice', () => {
  it('prices a note at par when the coupon equals the yield', () => {
    expect(treasuryPrice(10, 4, 4)).toBeCloseTo(100, 8)
    expect(parStartPrice(30, 4.5)).toBeCloseTo(100, 8)
  })

  it('matches textbook prices for a 10-year 4% note', () => {
    expect(treasuryPrice(10, 4, 5)).toBeCloseTo(92.2054, 3)
    expect(treasuryPrice(10, 4, 3)).toBeCloseTo(108.5843, 3)
  })

  it('prices a bill as one payment, below par', () => {
    expect(treasuryPrice(0.25, 0, 4)).toBeCloseTo(100 / Math.pow(1.02, 0.5), 8)
  })

  it('refuses a maturity that is not positive', () => {
    expect(() => treasuryPrice(0, 4, 4)).toThrow()
  })
})

describe('modifiedDuration', () => {
  it('uses the closed form for a par note', () => {
    expect(modifiedDuration(10, 4)).toBeCloseTo((1 - Math.pow(1.02, -20)) / 0.04, 10)
    expect(modifiedDuration(30, 4)).toBeCloseTo(17.384, 2)
  })

  it('is close to the maturity for a bill', () => {
    expect(modifiedDuration(0.25, 4)).toBeCloseTo(0.245, 3)
  })

  it('has the right limit at a zero yield', () => {
    expect(modifiedDuration(10, 0)).toBe(10)
  })

  it('agrees with a small exact repricing', () => {
    const d = modifiedDuration(10, 4)
    const bump = (treasuryPrice(10, 4, 4.0001) / 100 - 1) * 100 / 0.0001
    expect(-bump).toBeCloseTo(d, 2)
  })
})

describe('rateMoveEffect', () => {
  it('reprices a 10-year par note exactly for a 1-point move each way', () => {
    const e = rateMoveEffect(10, 4)
    expect(e.ifRisesPct).toBeCloseTo(-7.7946, 3)
    expect(e.ifFallsPct).toBeCloseTo(8.5843, 3)
  })

  it('shows the curve: a fall gains more than a rise loses', () => {
    for (const years of [2, 5, 10, 30]) {
      const e = rateMoveEffect(years, 4)
      expect(e.ifFallsPct).toBeGreaterThan(-e.ifRisesPct)
    }
  })

  it('longer maturities move more', () => {
    const moves = [0.25, 2, 5, 10, 30].map((y) => rateMoveEffect(y, 4).ifRisesPct)
    for (let i = 1; i < moves.length; i++) expect(moves[i]).toBeLessThan(moves[i - 1])
  })

  it('does not take a yield below zero, and says how far it fell instead', () => {
    const e = rateMoveEffect(5, 0.4)
    expect(e.fallMovePct).toBeCloseTo(0.4, 10)
    expect(e.movePct).toBe(1)
  })
})
