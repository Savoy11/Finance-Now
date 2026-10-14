import { describe, expect, it } from 'vitest'
import { COINMETRICS_ASSETS, COINMETRICS_ATTRIBUTION } from '../coinMetrics'
import { COINGECKO_IDS } from '../coingeckoIds'

// The hand-kept map from coin ids to Coin Metrics assets (T-434, D108). Each entry was
// checked against DefiLlama's prices and, for stablecoins, against the coin's launch
// date on 2026-10-14. These keep it a checked list rather than a symbol lookup.

describe('COINMETRICS_ASSETS', () => {
  it('maps only coins the app tracks', () => {
    const unknown = Object.keys(COINMETRICS_ASSETS).filter((id) => !(id in COINGECKO_IDS))
    expect(unknown).toEqual([])
  })

  it('never maps two coins to one asset', () => {
    const assets = Object.values(COINMETRICS_ASSETS)
    expect(new Set(assets).size).toBe(assets.length)
  })

  it('maps every coin to its own id except the two whose Coin Metrics names differ', () => {
    // A third difference is a new identity claim: check its series against another
    // source before adding it here.
    const renamed = Object.entries(COINMETRICS_ASSETS).filter(([id, asset]) => id !== asset)
    expect(Object.fromEntries(renamed)).toEqual({ iota: 'miota', tao: 'tao_bittensor' })
  })

  it.each([
    // Not carried by Coin Metrics on 2026-10-14.
    'ton', 'pi', 'tel', 'memecore', 'eurcv', 'xsgd', 'usdm', 'vbusd',
    // Carried, but the series stopped updating (MKR and AMPL on 2026-03-25, USDK on 2023-04-17).
    'mkr', 'ampl', 'usdk',
  ])('leaves out %s, measured as missing or stopped', (id) => {
    expect(id in COINGECKO_IDS, `${id} is a catalog coin`).toBe(true)
    expect(COINMETRICS_ASSETS).not.toHaveProperty(id)
  })
})

describe('COINMETRICS_ATTRIBUTION', () => {
  it('names the maker, links the material and refers to the licence, as CC BY-NC 4.0 requires', () => {
    expect(COINMETRICS_ATTRIBUTION.text).toContain('Coin Metrics')
    expect(COINMETRICS_ATTRIBUTION.href).toMatch(/^https:\/\/docs\.coinmetrics\.io\//)
    expect(COINMETRICS_ATTRIBUTION.license).toEqual({
      text: 'CC BY-NC 4.0', href: 'https://creativecommons.org/licenses/by-nc/4.0/',
    })
  })
})
