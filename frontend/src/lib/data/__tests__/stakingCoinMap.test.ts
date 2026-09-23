import { describe, it, expect } from 'vitest'
import { COIN_SYMBOL_MAP, ALL_STAKING_SYMBOLS } from '../stakingDiscovery'

/**
 * T-399 (2026-09-22). This map was nine base symbols, which made it — not the
 * upstreams — the binding constraint on three of the four staking-discovery
 * rungs. Measured against live payloads before the widening: Pendle resolved 0
 * of 28 eligible markets, Beefy 8 of 76, and WSTETH alone accounted for 71
 * DefiLlama pools over $1m that were being discarded.
 *
 * `symbolToCoinId` in the route does `base.startsWith(s)` over this map, so these
 * tests mirror that. The map is also flattened into ALL_STAKING_SYMBOLS, which
 * gates the DefiLlama rung by EXACT membership — two different matching rules over
 * one list, which is why an entry must be a literal symbol and not a fragment.
 */

const base = (s: string) => s.split('-')[0].split('/')[0].toUpperCase()
const resolve = (symbol: string): string | null => {
  const b = base(symbol)
  for (const [coinId, syms] of Object.entries(COIN_SYMBOL_MAP)) {
    if (syms.some((s) => b.startsWith(s))) return coinId
  }
  return null
}

describe('staking coin map — liquid staking derivatives resolve', () => {
  it.each([
    ['wstETH', 'eth'], ['stETH', 'eth'], ['rETH', 'eth'], ['cbETH', 'eth'],
    ['weETH', 'eth'], ['ezETH', 'eth'], ['rsETH', 'eth'], ['swETH', 'eth'],
    ['osETH', 'eth'], ['sfrxETH', 'eth'], ['pufETH', 'eth'], ['WBETH', 'eth'],
    ['jitoSOL', 'sol'], ['mSOL', 'sol'], ['bSOL', 'sol'], ['jupSOL', 'sol'],
    ['sAVAX', 'avax'], ['slisBNB', 'bnb'],
  ])('%s resolves to %s', (symbol, coin) => {
    expect(resolve(symbol)).toBe(coin)
  })

  it('still resolves the plain base symbols it always did', () => {
    for (const [coin, syms] of Object.entries(COIN_SYMBOL_MAP)) {
      expect(resolve(syms[0]), `${syms[0]} should resolve to ${coin}`).toBe(coin)
    }
  })

  it('handles the LP-pair form the upstreams actually send', () => {
    // DefiLlama symbols arrive as "WSTETH-WETH"; the route takes the part before
    // the first dash or slash. Pinned because the split is what makes a pair
    // resolve to its base asset rather than to nothing.
    expect(resolve('WSTETH-WETH')).toBe('eth')
    expect(resolve('JITOSOL/SOL')).toBe('sol')
  })
})

describe('staking coin map — synthetics are deliberately NOT staking derivatives', () => {
  /**
   * ⚠ THIS IS THE JUDGEMENT THE WIDENING RESTS ON, so it is pinned rather than
   * left to a comment.
   *
   * A liquid-staking or restaking token represents A STAKED POSITION in the
   * underlying coin, which is what a staking-discovery surface is for. A synthetic
   * merely TRACKS the price. Filing one under `eth` would present a debt or synth
   * position as a staking opportunity — a category error, not a rounding error.
   *
   * Both of these appear in live DefiLlama data, so this is a real boundary and
   * not a hypothetical one. If a future pass is tempted to add "everything ending
   * in ETH", this test is the reason not to.
   */
  it.each([
    ['alETH', 'Alchemix synthetic, minted against collateral — not staked ETH'],
    ['msETH', 'Metronome synth — tracks ETH, does not stake it'],
  ])('%s does not resolve (%s)', (symbol) => {
    expect(resolve(symbol)).toBeNull()
  })

  it('does not resolve BTC derivatives, because there is no btc coin here at all', () => {
    // WBTC (81 pools) and CBBTC (45) are the two most common unresolved symbols in
    // the live data. They are out of scope rather than excluded — adding them would
    // mean adding a `btc` key and deciding what a BTC staking opportunity even is.
    expect(resolve('WBTC')).toBeNull()
    expect(resolve('cbBTC')).toBeNull()
  })
})

describe('the map stays usable by both matching rules', () => {
  it('every entry is upper-case, so startsWith and Set.has agree', () => {
    const offenders = Object.values(COIN_SYMBOL_MAP).flat().filter((s) => s !== s.toUpperCase())
    expect(offenders, `these would never match an upper-cased base: ${offenders.join(', ')}`).toEqual([])
  })

  it('ALL_STAKING_SYMBOLS is the flattened map, with no entry lost to de-duplication', () => {
    const flat = Object.values(COIN_SYMBOL_MAP).flat()
    expect(ALL_STAKING_SYMBOLS.size).toBe(new Set(flat).size)
    // A duplicate across two coins would silently give one of them away to
    // whichever key iterates first.
    expect(flat.length, `duplicate symbol across coins: ${flat.filter((s, i) => flat.indexOf(s) !== i).join(', ')}`)
      .toBe(new Set(flat).size)
  })

  it('no entry is a prefix of an entry belonging to a DIFFERENT coin', () => {
    // startsWith + first-match-wins means a short symbol under an earlier key
    // would swallow a longer one under a later key. 'SOL' must not capture a
    // hypothetical 'SOLANA-something' filed under another coin, and so on.
    const all = Object.entries(COIN_SYMBOL_MAP).flatMap(([c, syms]) => syms.map((s) => [c, s] as const))
    const clashes: string[] = []
    for (const [coinA, a] of all) {
      for (const [coinB, b] of all) {
        if (coinA === coinB || a === b) continue
        if (b.startsWith(a)) clashes.push(`${b} (${coinB}) is captured by ${a} (${coinA})`)
      }
    }
    expect(clashes, clashes.join('\n  ')).toEqual([])
  })
})
