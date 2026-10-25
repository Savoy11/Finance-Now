import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { matchLlamaPools, usableRate } from '../stakingRates'

// 2026-10-25: a live reading of 0 is no rate, on the page as in the fallback refresh.
// DefiLlama's MaticX pool read 0 from 2026-10-20 with $2.6M still in it, and the staking page
// showed "live 0%" while stakingFallbackRefresh.mjs already treated the same 0 as no rate.
// Fixtures are the pools as they read that day.

const maticx = { symbol: 'MATICX', chain: 'Polygon', apy: 0, apyBase: 0, tvlUsd: 2_625_081 }
const maticxElsewhere = { symbol: 'MATICX', chain: 'Polygon', apy: 0, apyBase: null, tvlUsd: 18_929 }
const rsweth = { symbol: 'RSWETH', chain: 'Ethereum', apy: 7530.08596, apyBase: 7530.08596, tvlUsd: 32_153_211 }
const ezeth = { symbol: 'EZETH', chain: 'Ethereum', apy: 2.39, apyBase: 2.39, tvlUsd: 400_000_000 }

describe('usableRate', () => {
  it('refuses zero, a negative, a non-number and anything above the bound', () => {
    expect(usableRate(0, 40)).toBeNull()
    expect(usableRate(-0.5, 40)).toBeNull()
    expect(usableRate(Number.NaN, 40)).toBeNull()
    expect(usableRate(40.01, 40)).toBeNull()
    expect(usableRate(7530.08596, 40)).toBeNull()
  })

  it('passes any positive reading up to and including the bound', () => {
    expect(usableRate(0.01, 40)).toBe(0.01)
    expect(usableRate(3.45, 40)).toBe(3.45)
    expect(usableRate(40, 40)).toBe(40)
  })
})

describe('matchLlamaPools', () => {
  it('leaves a pool that reads 0 off the live rates, and says what it read', () => {
    const { rates, refused } = matchLlamaPools([maticx, maticxElsewhere, ezeth])
    expect(rates.stader_matic).toBeUndefined()
    expect(refused.stader_matic).toBe(0)
    expect(rates.renzo_eth).toBe(2.39)
  })

  it('reports an out-of-range reading as refused, not as an unmatched symbol', () => {
    const { rates, refused } = matchLlamaPools([rsweth])
    expect(rates.swell_eth).toBeUndefined()
    expect(refused.swell_eth).toBe(7530.09)
  })

  it('puts a key whose symbol matches no pool in neither list', () => {
    const { rates, refused } = matchLlamaPools([ezeth])
    expect('stader_matic' in rates || 'stader_matic' in refused).toBe(false)
  })
})

describe('every collector reads through usableRate', () => {
  const src = readFileSync(join(__dirname, '..', 'stakingRates.ts'), 'utf8')
  // Comments may name the old helper; only code is held to the rule.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('has no bound check that lets a 0 through', () => {
    // `clamp(v, 0, hi)` accepted v >= 0, which is how "live 0%" got published.
    expect(code).not.toMatch(/\bclamp\(/)
    expect(code).not.toMatch(/v >= 0|>= lo/)
  })

  it('turns every upstream number into a rate only through usableRate', () => {
    const assigned = code.match(/const (?:pct|apr) = [^\n]+/g) ?? []
    expect(assigned.length).toBeGreaterThanOrEqual(6)
    for (const line of assigned) expect(line, line).toMatch(/usableRate\(/)
  })

  it('names refused DefiLlama pools apart from unmatched symbols', () => {
    expect(src).toMatch(/no usable rate: /)
    expect(src).toMatch(/no match: /)
  })
})
