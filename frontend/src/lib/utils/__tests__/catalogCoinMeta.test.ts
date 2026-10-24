import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { catalogCoinMeta, UNRANKED } from '../catalogCoinMeta'
import type { CoinListEntry } from '@/lib/types/coinList'

const entry = (id: string, symbol: string, name: string, rank: number): CoinListEntry =>
  ({ id, symbol, name, rank, price: 1, marketCap: 1, image: '' })

// The two cases measured on 2026-10-24: a shared ticker whose lower-ranked holder came
// later in the list, which a symbol-keyed Map lets win.
const LIST = [
  entry('dai', 'dai', 'Dai', 24),
  entry('memecore', 'm', 'MemeCore', 48),
  entry('dai-on-pulsechain', 'dai', 'DAI on PulseChain', 429),
  entry('mantis', 'm', 'Mantis', UNRANKED),
]

describe('catalogCoinMeta', () => {
  it('names a coin by its CoinGecko id, never by a ticker another coin shares', () => {
    const [dai, m] = catalogCoinMeta(['dai', 'm'], { dai: 'dai', m: 'memecore' }, LIST)
    expect(dai).toEqual({ id: 'dai', symbol: 'DAI', label: 'Dai', rank: 24 })
    expect(m).toEqual({ id: 'm', symbol: 'M', label: 'MemeCore', rank: 48 })
  })

  it('keeps the symbol and sorts last a coin the list does not carry', () => {
    const [x] = catalogCoinMeta(['xyz'], { xyz: 'not-in-list' }, LIST)
    expect(x).toEqual({ id: 'xyz', symbol: 'XYZ', label: 'XYZ', rank: UNRANKED })
  })

  it('works before the list has loaded', () => {
    expect(catalogCoinMeta(['dai'], { dai: 'dai' }, undefined)).toEqual([
      { id: 'dai', symbol: 'DAI', label: 'DAI', rank: UNRANKED },
    ])
  })
})

describe('no page matches the coin list by ticker', () => {
  // The two pages that did, and the shape that did it. A new reader of the list
  // should go through catalogCoinMeta.
  it.each([
    'src/app/(dashboard)/scanner/page.tsx',
    'src/app/(dashboard)/technical-analysis/page.tsx',
  ])('%s', (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
    expect(src).toContain('catalogCoinMeta(')
    expect(src).not.toMatch(/coins \?\? \[\]\)\.map\(\(?c\)? => \[c\.symbol/)
  })
})
