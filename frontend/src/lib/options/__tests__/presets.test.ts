import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { atTheMoney, buildPreset, roundToStrike, strikesAround, wingsAround, PRESETS, type PresetId } from '../presets'
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

describe('strikesAround keeps strikes apart, on one grid, anchored at the money', () => {
  it('at $5, 95% and 100% no longer land on one strike, and the at-the-money one stays put', () => {
    expect(roundToStrike(5 * 0.95)).toBe(roundToStrike(5)) // the collision it fixes
    expect(strikesAround(5, [0.95, 1.0])).toEqual([4.5, 5])
    expect(atTheMoney(5)).toBe(5)
  })

  it('wingsAround gives a butterfly equal wings where rounding each strike did not', () => {
    expect(wingsAround(87.3, 0.05)).toEqual([83, 87, 91]) // was 83/87/92
    expect(wingsAround(24.6, 0.05)).toEqual([23.5, 24.5, 25.5]) // was 23.5/24.5/26
    expect(wingsAround(200, 0.05)).toEqual([190, 200, 210]) // unchanged
  })

  it('every multi-strike preset keeps its strikes in order at awkward prices', () => {
    // $1.20 left this list on 2026-11-10 (D221): the condor and the credit spreads are refused
    // there now, which the test below for refusals holds.
    for (const price of [3, 5, 9.9, 24.6, 87.3, 199, 640]) {
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

// ── Code review 2026-11-10 (D221) ───────────────────────────────────────────
// Every preset at a spread of awkward prices: its shape, where its strikes sit against the
// price, its grid, its stated maximum loss against the payoff arithmetic, and equal butterfly
// wings. The review found the call butterfly lopsided at about a quarter of all prices, so
// its note ("Max loss is the net debit paid") was false there, and strikes drifting above
// the price on cheap stocks.

type Place = 'below' | 'atm' | 'above'
const SHAPES: Record<PresetId, Array<[side: 'long' | 'short', type: 'call' | 'put', place: Place]>> = {
  'long-call': [['long', 'call', 'atm']],
  'long-put': [['long', 'put', 'atm']],
  'covered-call': [['short', 'call', 'above']],
  'cash-secured-put': [['short', 'put', 'below']],
  'protective-put': [['long', 'put', 'below']],
  'collar': [['long', 'put', 'below'], ['short', 'call', 'above']],
  'bull-call-spread': [['long', 'call', 'atm'], ['short', 'call', 'above']],
  'bear-put-spread': [['long', 'put', 'atm'], ['short', 'put', 'below']],
  'bull-put-spread': [['long', 'put', 'below'], ['short', 'put', 'below']],
  'bear-call-spread': [['short', 'call', 'above'], ['long', 'call', 'above']],
  'long-straddle': [['long', 'call', 'atm'], ['long', 'put', 'atm']],
  'long-strangle': [['long', 'put', 'below'], ['long', 'call', 'above']],
  'iron-condor': [['long', 'put', 'below'], ['short', 'put', 'below'], ['short', 'call', 'above'], ['long', 'call', 'above']],
  'iron-butterfly': [['long', 'put', 'below'], ['short', 'put', 'atm'], ['short', 'call', 'atm'], ['long', 'call', 'above']],
  'long-call-butterfly': [['long', 'call', 'below'], ['short', 'call', 'atm'], ['short', 'call', 'atm'], ['long', 'call', 'above']],
}
const RANK: Record<Place, number> = { below: 0, atm: 1, above: 2 }
// Awkward prices: the strike grid's edges (25, 100, 250), the review's examples, and a sweep.
const PRICES = [2.6, 3.1, 5, 9.9, 24.6, 25.4, 26, 87.3, 97.65, 99, 101, 199, 249, 251, 640,
  ...Array.from({ length: 140 }, (_, i) => Math.round((3 + i * 7.13) * 100) / 100)]
const gridStep = (price: number) => (price < 25 ? 0.5 : price < 100 ? 1 : price < 250 ? 5 : 10)
const zeroPremium = (legs: Array<{ side: 'long' | 'short'; type: 'call' | 'put'; strike: number }>) =>
  legs.map((l) => ({ ...l, premium: 0, contracts: 1 }))

describe('every preset, at awkward prices (code review 2026-11-10, D221)', () => {
  it('has a shape for every preset', () => {
    expect(Object.keys(SHAPES).sort()).toEqual(PRESETS.map((p) => p.id).sort())
  })

  it('keeps each structure: sides, types, and which side of the price each strike sits', () => {
    for (const price of PRICES) {
      const g = gridStep(price)
      for (const { id } of PRESETS) {
        const legs = buildPreset(id, price).legs
        const shape = SHAPES[id]
        const at = `${id} at $${price}`
        expect(legs.map((l) => `${l.side} ${l.type}`), at).toEqual(shape.map(([s, t]) => `${s} ${t}`))
        legs.forEach((l, i) => {
          const place = shape[i][2]
          expect(Math.abs(l.strike / g - Math.round(l.strike / g)), `${at}: $${l.strike} on the $${g} grid`).toBeLessThan(1e-9)
          if (place === 'atm') expect(Math.abs(l.strike - price), `${at}: at-the-money $${l.strike}`).toBeLessThanOrEqual(g / 2 + 1e-9)
          if (place === 'below') expect(l.strike, `${at}: $${l.strike} below the price`).toBeLessThan(price)
          if (place === 'above') expect(l.strike, `${at}: $${l.strike} above the price`).toBeGreaterThan(price)
        })
        // Strikes run in the shape's order: below < at < above, and a second leg on the same
        // side sits further out (a spread's two strikes are never one).
        for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) {
          const [a, b] = [RANK[shape[i][2]], RANK[shape[j][2]]]
          if (a < b) expect(legs[i].strike, at).toBeLessThan(legs[j].strike)
          if (a === b && a !== 1) expect(legs[i].strike, at).toBeLessThan(legs[j].strike)
          if (a === b && a === 1) expect(legs[i].strike, at).toBe(legs[j].strike)
        }
      }
    }
  })

  it('states a maximum loss only as the payoff arithmetic gives it, before premium', () => {
    for (const price of PRICES) {
      for (const { id } of PRESETS) {
        const p = buildPreset(id, price)
        if (p.maxLossUsd === undefined || p.withShares) continue
        const fromPayoff = summarizePayoff({ legs: zeroPremium(p.legs) }).maxLossUsd
        expect(p.maxLossUsd, `${id} at $${price}`).toBeCloseTo(fromPayoff as number, 6)
      }
    }
  })

  it('gives both butterflies equal wings, so the call butterfly can lose only what was paid', () => {
    for (const price of PRICES) {
      for (const id of ['iron-butterfly', 'long-call-butterfly'] as const) {
        const k = buildPreset(id, price).legs.map((l) => l.strike)
        expect(k[1] - k[0], `${id} at $${price}: ${k.join('/')}`).toBeCloseTo(k[3] - k[2], 9)
      }
      const fly = buildPreset('long-call-butterfly', price).legs
      expect(summarizePayoff({ legs: zeroPremium(fly) }).maxLossUsd, `call butterfly at $${price}`).toBe(0)
    }
  })

  it('refuses a structure whose strikes would reach $0, and says so, instead of drifting above the price', () => {
    expect(() => buildPreset('iron-condor', 1.2)).toThrow(/\$0/)
    expect(() => buildPreset('bull-put-spread', 1.2)).toThrow(/\$0/)
    // A structure that fits keeps working at the same price.
    expect(buildPreset('long-call', 1.2).legs[0].strike).toBe(1)
  })

  it('every page that builds a preset catches the refusal and shows it (code audit 2026-11-12, D226)', () => {
    // The switched-off Trade Risk Scorer page called buildPreset bare, so a low price would have
    // thrown on a click. Mutation: drop either page's try and this fails.
    const pages: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(name) && !p.includes('__tests__')) pages.push(p)
      }
    }
    walk(join(process.cwd(), 'src/app'))
    walk(join(process.cwd(), 'src/components'))
    const callers = pages.filter((p) => /\bbuildPreset\(/.test(readFileSync(p, 'utf8')))
    expect(callers.length).toBeGreaterThanOrEqual(2)
    for (const p of callers) {
      const src = readFileSync(p, 'utf8')
      expect(src, p).toMatch(/try \{\s*preset = buildPreset\([^)]*\)\s*\} catch \(e\) \{\s*[^}]*setPresetNote\(/)
      expect(src.match(/\bbuildPreset\(/g)?.length, p).toBe(1)
    }
  })
})
