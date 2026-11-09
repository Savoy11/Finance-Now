import { describe, it, expect } from 'vitest'
import { buildPreset, roundToStrike, strikeLadder, PRESETS, type PresetId } from '../presets'
import { summarizePayoff } from '../payoff'

describe('roundToStrike', () => {
  it('uses finer increments for cheaper underlyings', () => {
    expect(roundToStrike(18.7)).toBe(18.5)   // 0.5 grid
    expect(roundToStrike(52.4)).toBe(52)     // 1 grid
    expect(roundToStrike(187)).toBe(185)     // 5 grid
    expect(roundToStrike(432)).toBe(430)     // 10 grid
  })

  it('returns 0 for junk input rather than NaN', () => {
    expect(roundToStrike(0)).toBe(0)
    expect(roundToStrike(-5)).toBe(0)
    expect(roundToStrike(NaN)).toBe(0)
  })
})

describe('buildPreset', () => {
  const S = 200 // 5-dollar strike grid

  it('throws on a non-positive underlying', () => {
    expect(() => buildPreset('covered-call', 0)).toThrow(RangeError)
    expect(() => buildPreset('iron-condor', -10)).toThrow(RangeError)
  })

  it('covered call: one short call above spot, no fabricated max loss', () => {
    const p = buildPreset('covered-call', S)
    expect(p.legs).toEqual([{ side: 'short', type: 'call', strike: 210 }])
    // Max loss depends on the shares, which we don't model — must stay unset.
    expect(p.maxLossUsd).toBeUndefined()
    expect(p.note).toMatch(/100 shares/)
  })

  it('cash-secured put: one short put below spot, max loss = strike x 100', () => {
    const p = buildPreset('cash-secured-put', S)
    expect(p.legs).toEqual([{ side: 'short', type: 'put', strike: 190 }])
    expect(p.maxLossUsd).toBe(19_000)
  })

  it('bull call spread: long below short, max loss left for the debit', () => {
    const p = buildPreset('bull-call-spread', S)
    expect(p.legs).toEqual([
      { side: 'long', type: 'call', strike: 200 },
      { side: 'short', type: 'call', strike: 210 },
    ])
    expect(p.maxLossUsd).toBeUndefined()
  })

  it('iron condor: four legs, wings outside shorts, max loss = wing width x 100', () => {
    const p = buildPreset('iron-condor', S)
    expect(p.legs).toHaveLength(4)
    const puts = p.legs.filter((l) => l.type === 'put')
    const calls = p.legs.filter((l) => l.type === 'call')
    const longPut = puts.find((l) => l.side === 'long')!
    const shortPut = puts.find((l) => l.side === 'short')!
    const shortCall = calls.find((l) => l.side === 'short')!
    const longCall = calls.find((l) => l.side === 'long')!
    expect(longPut.strike).toBeLessThan(shortPut.strike)
    expect(shortPut.strike).toBeLessThan(shortCall.strike)
    expect(shortCall.strike).toBeLessThan(longCall.strike)
    expect(p.maxLossUsd).toBe(
      Math.max(shortPut.strike - longPut.strike, longCall.strike - shortCall.strike) * 100,
    )
  })

  it('never prefills market data — structure only', () => {
    for (const { id } of PRESETS) {
      for (const leg of buildPreset(id as PresetId, S).legs) {
        expect(Object.keys(leg).sort()).toEqual(['side', 'strike', 'type'])
        expect(leg.strike).toBeGreaterThan(0)
      }
    }
  })

  it('strikes stay on the grid at awkward prices', () => {
    for (const { id } of PRESETS) {
      for (const leg of buildPreset(id as PresetId, 87.3).legs) {
        expect(leg.strike % 1).toBe(0) // 1-dollar grid under 100
      }
    }
  })

  it('keeps every preset to four legs, the switched-off scorer\'s form', () => {
    for (const { id } of PRESETS) expect(buildPreset(id as PresetId, S).legs.length, id).toBeLessThanOrEqual(4)
  })

  it('has one entry per id, and every id builds', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(() => buildPreset(id, S)).not.toThrow()
  })
})

describe('the structures added on 2026-11-09 (T-061, D216)', () => {
  const S = 200 // 5-dollar strike grid

  it('long call and long put: one leg at the money', () => {
    expect(buildPreset('long-call', S).legs).toEqual([{ side: 'long', type: 'call', strike: 200 }])
    expect(buildPreset('long-put', S).legs).toEqual([{ side: 'long', type: 'put', strike: 200 }])
  })

  it('protective put and collar are written against shares, and say so', () => {
    for (const id of ['covered-call', 'protective-put', 'collar'] as const) {
      const p = buildPreset(id, S)
      expect(p.withShares, id).toBe(true)
      expect(p.note, id).toMatch(/100 shares/)
    }
    expect(buildPreset('protective-put', S).legs).toEqual([{ side: 'long', type: 'put', strike: 190 }])
    expect(buildPreset('collar', S).legs).toEqual([
      { side: 'long', type: 'put', strike: 190 },
      { side: 'short', type: 'call', strike: 210 },
    ])
    for (const id of ['long-call', 'cash-secured-put', 'iron-condor'] as const) expect(buildPreset(id, S).withShares, id).toBeUndefined()
  })

  it('the two credit spreads: max loss is the gap between the strikes', () => {
    const bull = buildPreset('bull-put-spread', S)
    expect(bull.legs).toEqual([
      { side: 'long', type: 'put', strike: 180 },
      { side: 'short', type: 'put', strike: 190 },
    ])
    expect(bull.maxLossUsd).toBe(1000)
    const bear = buildPreset('bear-call-spread', S)
    expect(bear.legs).toEqual([
      { side: 'short', type: 'call', strike: 210 },
      { side: 'long', type: 'call', strike: 220 },
    ])
    expect(bear.maxLossUsd).toBe(1000)
  })

  it('the debit structures leave max loss to the premiums', () => {
    for (const id of ['long-call', 'long-put', 'bear-put-spread', 'long-straddle', 'long-strangle', 'long-call-butterfly'] as const) {
      expect(buildPreset(id, S).maxLossUsd, id).toBeUndefined()
    }
  })

  it('a call butterfly is long one, short two, long one, and pays off only near the middle', () => {
    const p = buildPreset('long-call-butterfly', S)
    expect(p.legs).toEqual([
      { side: 'long', type: 'call', strike: 190 },
      { side: 'short', type: 'call', strike: 200 },
      { side: 'short', type: 'call', strike: 200 },
      { side: 'long', type: 'call', strike: 210 },
    ])
    // With premiums of 0 the payoff is a tent: 0 outside the wings, 10 × 100 at the middle.
    const s = summarizePayoff({ legs: p.legs.map((l) => ({ ...l, premium: 0, contracts: 1 })) })
    expect(s.maxGainUsd).toBe(1000)
    expect(s.maxLossUsd).toBe(0)
  })

  it('an iron butterfly shares its middle strike, and its max loss is a wing', () => {
    const p = buildPreset('iron-butterfly', S)
    const shorts = p.legs.filter((l) => l.side === 'short')
    expect(shorts.map((l) => l.strike)).toEqual([200, 200])
    expect(p.maxLossUsd).toBe(1000)
  })
})

describe('strikeLadder keeps strikes apart at low prices', () => {
  it('at $5, 95% and 100% no longer land on one strike', () => {
    expect(roundToStrike(5 * 0.95)).toBe(roundToStrike(5)) // the collision it fixes
    expect(strikeLadder(5, [0.95, 1.0])).toEqual([5, 5.5])
  })

  it('every multi-strike preset keeps its strikes in order at awkward prices', () => {
    for (const price of [1.2, 3, 5, 9.9, 24.6, 87.3, 199, 640]) {
      for (const { id } of PRESETS) {
        const legs = buildPreset(id as PresetId, price).legs
        for (const l of legs) expect(l.strike, `${id} at ${price}`).toBeGreaterThan(0)
        // Within one type, a spread's two strikes differ unless the structure means one strike.
        const sameStrikeOnPurpose = ['long-straddle', 'iron-butterfly', 'long-call-butterfly']
        if (!sameStrikeOnPurpose.includes(id)) {
          const strikes = legs.map((l) => `${l.type}:${l.strike}`)
          expect(new Set(strikes).size, `${id} at ${price}`).toBe(strikes.length)
        }
      }
    }
  })

  it('the iron condor at $5 keeps four different strikes', () => {
    const strikes = buildPreset('iron-condor', 5).legs.map((l) => l.strike)
    expect(new Set(strikes).size).toBe(4)
    expect([...strikes].sort((a, b) => a - b)).toEqual(strikes)
  })

  it('leaves the existing presets as they were at ordinary prices', () => {
    expect(buildPreset('iron-condor', 200).legs.map((l) => l.strike)).toEqual([180, 190, 210, 220])
    expect(buildPreset('bull-call-spread', 87.3).legs.map((l) => l.strike)).toEqual([87, 92])
  })
})
