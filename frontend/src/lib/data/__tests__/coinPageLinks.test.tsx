import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ASSET_CATALOG } from '../assetCatalog'
import { STAKING_COIN_INFO, STAKING_PROVIDERS, type StakingCoinId } from '../stakingProviders'
import { DEFILLAMA_STABLECOINS, MONITORED_STABLECOINS } from '../stablecoinMeta'
import { coingeckoIdFor } from '@/lib/api/live/coingeckoIds'
import {
  RESERVE_COIN_PAGE, STAKING_COIN_PAGE, coinPageForReserve, coinPageForStaking, isStakingCoinId,
  stakesTheCoin, stakingCoinForPage, stakingPageRows, stakingRowsFor,
} from '../coinPageLinks'
import { CoinStakingLine } from '@/components/assets/CoinStakingLine'
import { ReserveMonitorPanel } from '@/components/analytics/reserves'
import { aprBasis, aprDisplay, basisCounts, resolveLiveAprKey } from '@/lib/utils/aprDisplay'
import type { StakingRatesResponse } from '@/app/live-data/staking-rates/route'

// T-463: the coin pages, the Staking page and the Reserve Monitor link to each other through
// hand-kept maps, each checked here against the coin catalog, never matched by ticker (D190).

const catalog = new Map(ASSET_CATALOG.map((a) => [a.id, a]))
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('the Staking page’s coins and their pages', () => {
  it('links each to a page that exists and is that coin', () => {
    for (const [coin, page] of Object.entries(STAKING_COIN_PAGE) as [StakingCoinId, string | null][]) {
      if (page === null) continue
      const asset = catalog.get(page)
      expect(asset, `${coin} → ${page}`).toBeTruthy()
      expect(asset!.symbol, `${coin} → ${page}`).toBe(STAKING_COIN_INFO[coin].symbol)
    }
  })

  it('leaves unlinked only the coins with no page, and says so if one gains a page', () => {
    // Mutation: a page added for Cosmos would stay unlinked without this.
    const unlinked = (Object.keys(STAKING_COIN_PAGE) as StakingCoinId[]).filter((c) => STAKING_COIN_PAGE[c] === null)
    expect(unlinked.sort()).toEqual(['atom', 'ksm', 'osmo'])
    for (const coin of unlinked) {
      expect(ASSET_CATALOG.some((a) => a.symbol === STAKING_COIN_INFO[coin].symbol), coin).toBe(false)
    }
  })

  it('maps Polygon by its page, not its ticker, and back', () => {
    expect(coinPageForStaking('matic')).toBe('pol')
    expect(stakingCoinForPage('pol')).toBe('matic')
    expect(stakingCoinForPage('eth')).toBe('eth')
    expect(stakingCoinForPage('usdc')).toBeNull()
    const pages = Object.values(STAKING_COIN_PAGE).filter(Boolean)
    expect(new Set(pages).size).toBe(pages.length)
  })

  it('reads a coin from the address only when it is one the page lists', () => {
    expect(isStakingCoinId('eth')).toBe(true)
    expect(isStakingCoinId('pol')).toBe(false)
    expect(isStakingCoinId('toString')).toBe(false)
    expect(isStakingCoinId(null)).toBe(false)
  })
})

describe('the providers a coin page counts', () => {
  it('are the live ones staking the coin itself, as the Staking page lists them by default', () => {
    for (const coin of Object.keys(STAKING_COIN_INFO) as StakingCoinId[]) {
      for (const { provider, asset } of stakingRowsFor(coin)) {
        expect(provider.defunct, provider.id).toBeFalsy()
        expect(stakesTheCoin(provider, asset), `${provider.id}/${coin}`).toBe(true)
      }
    }
    // Celsius, the defunct example, is never counted.
    expect(stakingRowsFor('eth').some((r) => r.provider.id === 'celsius')).toBe(false)
    // A governance or lending offer is left out, as the page leaves it out by default.
    const adjacent = STAKING_PROVIDERS.flatMap((p) => Object.entries(p.assets)
      .filter(([, a]) => a && !p.defunct && !stakesTheCoin(p, a))
      .map(([coin]) => [p.id, coin as StakingCoinId] as const))
    for (const [id, coin] of adjacent) expect(stakingRowsFor(coin).some((r) => r.provider.id === id), `${id}/${coin}`).toBe(false)
  })

  it('the Staking page draws its rows from the same list', () => {
    // Since the code audit of 2026-11-12 (D226) the page filters nowhere itself: its cards and
    // its notice both read stakingPageRows, which the coin page's count reads too.
    const page = read('src/app/(dashboard)/staking/page.tsx')
    expect(page).toContain('stakingPageRows({ coin: coinFilter, category: categoryFilter, showAdjacent, showDefunct })')
    expect(page).toContain('rows={rows}')
    expect(page).not.toMatch(/stakesTheCoin\(/)
    expect(page).not.toMatch(/YIELD_TYPE_META\[resolveYieldType\([^)]*\)\]\.stakesQueriedAsset/)
    for (const coin of Object.keys(STAKING_COIN_INFO) as StakingCoinId[]) {
      expect(stakingRowsFor(coin)).toEqual(stakingPageRows({ coin }))
    }
  })
})

describe('the Staking page’s notice (code audit 2026-11-12, D226)', () => {
  // Counted as the page counts: each drawn row's basis.
  const count = (coin: StakingCoinId | 'all', resp: { rates: Record<string, number>; sources: Record<string, 'live' | 'estimate'>; byKey: Record<string, string | null> }) =>
    basisCounts(stakingPageRows({ coin }).map(({ provider, coinId, asset }) => {
      const liveKey = resolveLiveAprKey(provider, coinId, asset)
      return aprBasis(aprDisplay(asset.staticApr, liveKey, resp.rates, resp.sources, {}), liveKey, resp.rates, resp.byKey)
    }))

  it('counts the rows drawn, one kind each, under the coin filter', () => {
    const c = count('all', { rates: {}, sources: {}, byKey: {} })
    expect(c.rows).toBe(stakingPageRows({ coin: 'all' }).length)
    expect(c.live + c.derived + c.measured + c.undated + c.withheld + c.catalog).toBe(c.rows)
    expect(count('eth', { rates: {}, sources: {}, byKey: {} }).rows).toBe(stakingRowsFor('eth').length)
  })

  it('never counts a backup figure no row reads', () => {
    // Mutation: count the collector's keys (the old backupCounts) and the undated figure rises.
    const used = new Set(stakingPageRows({ coin: 'all' }).map(({ provider, coinId, asset }) => resolveLiveAprKey(provider, coinId, asset)))
    const unread = ['kraken_eth', 'binance_eth', 'native_ksm', 'ankr_sol'].filter((k) => !used.has(k))
    expect(unread.length).toBeGreaterThan(0)
    const base = { rates: { lido_eth: 2.5 }, sources: { lido_eth: 'estimate' as const }, byKey: { lido_eth: null } as Record<string, string | null> }
    const withUnread = {
      rates: { ...base.rates, ...Object.fromEntries(unread.map((k) => [k, 3])) },
      sources: { ...base.sources, ...Object.fromEntries(unread.map((k) => [k, 'estimate' as const])) },
      byKey: { ...base.byKey, ...Object.fromEntries(unread.map((k) => [k, null])) },
    }
    expect(count('all', withUnread)).toEqual(count('all', base))
  })

  it('prints the rows’ counts, and the header’s live figure is the rows’ too', () => {
    const page = read('src/app/(dashboard)/staking/page.tsx')
    expect(page).toContain('rateSummary(counts)')
    expect(page).toContain('const liveCount = counts.live')
    expect(page).not.toMatch(/backupCounts|Object\.values\(sources\)/)
  })
})

describe('the Staking page', () => {
  const page = read('src/app/(dashboard)/staking/page.tsx')

  it('opens on the coin in its address, keeps the Live Pools tab, and links each card’s coin to its page', () => {
    expect(page).toMatch(/const coinFilter: StakingCoinId \| 'all' = isStakingCoinId\(coinParam\) \? coinParam : 'all'/)
    expect(page).toMatch(/router\.replace\(query \? `\/staking\?\$\{query\}` : '\/staking', \{ scroll: false \}\)/)
    expect(page).toContain("params.get('tab') === 'pools'")
    expect(page).toMatch(/coinPageForStaking\(coinId\)/)
  })
})

describe('the Reserve Monitor’s coins and their pages', () => {
  it('links each monitored coin to the page of the same coin, by CoinGecko id or, failing one, full name', () => {
    for (const key of MONITORED_STABLECOINS) {
      const page = RESERVE_COIN_PAGE[key]
      const asset = catalog.get(page)
      expect(asset, `${key} → ${page}`).toBeTruthy()
      const gecko = coingeckoIdFor(page)
      if (gecko) expect(gecko, key).toBe(DEFILLAMA_STABLECOINS[key].geckoId)
      else expect(asset!.name, key).toBe(DEFILLAMA_STABLECOINS[key].name)
    }
  })

  it('matches a row by DefiLlama’s number for the coin, never its ticker', () => {
    expect(coinPageForReserve('19')).toBe('gusd') // Gemini Dollar
    expect(coinPageForReserve('306')).toBeNull() // Gate USD, which also calls itself GUSD (D190)
    expect(coinPageForReserve('235')).toBe('frxusd')
    expect(coinPageForReserve('GUSD')).toBeNull()
  })

  it('the monitor’s rows link to those pages, a coin it does not watch to none', () => {
    // Drawn with the route's own shape: Gemini Dollar (DefiLlama 19) and a coin it does not
    // watch under the same ticker (Gate USD, 306). Mutation: draw the symbol without the link.
    const asset = (id: string, symbol: string, name: string) => ({
      id, symbol, name, pegType: 'peggedUSD', pegMechanism: 'fiat-backed', circulatingUsd: 1e9, price: 1,
      priceSource: 'DefiLlama', chains: [], supplyChange: { day: null, week: null, month: null }, chainSplit: null,
      composition: [], attester: 'X', attestationUrl: '#', lastAttestedDate: null, collateralizationRatio: null,
    })
    const client = new QueryClient()
    client.setQueryData(['live-reserves'], { ok: true, assets: [asset('19', 'GUSD', 'Gemini Dollar'), asset('306', 'GUSD', 'Gate USD')], updatedAt: '2026-11-11T00:00:00Z' })
    const html = renderToStaticMarkup(<QueryClientProvider client={client}><ReserveMonitorPanel /></QueryClientProvider>)
    expect(html.match(/href="\/assets\/gusd"/g)).toHaveLength(1)
    expect(html).not.toMatch(/href="\/assets\/(usdg|306)"/)
  })
})

describe('the line on a coin’s page', () => {
  const render = (assetId: string, rates?: Partial<StakingRatesResponse>) => {
    const client = new QueryClient()
    if (rates) client.setQueryData(['staking-rates'], { rates: {}, sources: {}, gaps: {}, ...rates })
    return renderToStaticMarkup(<QueryClientProvider client={client}><CoinStakingLine assetId={assetId} /></QueryClientProvider>)
      .replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim()
  }

  it('counts the providers and the live rates, and links to the Staking page on that coin', () => {
    const n = stakingRowsFor('eth').length
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><CoinStakingLine assetId="eth" /></QueryClientProvider>)
    expect(html).toContain('href="/staking?coin=eth"')
    expect(render('eth')).toContain(`Staking: ${n} providers in our catalog stake ETH.`)
    // Every row whose rate is Lido's (Lido, and wallets staking through it) is live with it.
    const onLido = stakingRowsFor('eth').filter(({ provider, asset }) => resolveLiveAprKey(provider, 'eth', asset) === 'lido_eth').length
    expect(onLido).toBeGreaterThan(0)
    expect(render('eth', { rates: { lido_eth: 2.5 }, sources: { lido_eth: 'live' } }))
      .toContain(`; ${onLido} of their rates ${onLido === 1 ? 'is' : 'are'} live now.`)
  })

  it('names Polygon’s coin by the Staking page’s filter', () => {
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><CoinStakingLine assetId="pol" /></QueryClientProvider>)
    expect(html).toContain('href="/staking?coin=matic"')
  })

  it('shows nothing on a coin the Staking page does not list', () => {
    expect(render('usdc')).toBe('')
  })

  it('gives a count and a link only: no rate, no order, no best', () => {
    // Mutation: list the top rate here and this fails (the ranking line, item 4).
    const text = render('eth', { rates: { lido_eth: 2.5 }, sources: { lido_eth: 'live' } })
    expect(text).not.toMatch(/%|best|highest|top/i)
  })
})
