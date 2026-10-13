import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { listRoutes, hostsInSource, ownerOfRoute, driftItems, readRoutes } from '../../../../scripts/lib/routeHosts.mjs'
import { DATA_SOURCES } from '@/lib/data/dataSources'

/**
 * T-432 (2026-10-13). `npm run data-sources -- --verify` is what makes the data-source
 * registry name every host a route fetches, and sourceTerms.test.ts can only check a host
 * that registry names. The check read `live-data/<id>/route.ts` alone, so the ten routes a
 * folder further down were never opened, the five wallet routes among them: twenty hosts,
 * thirteen with no terms entry, and nothing said so. These hold the walk to every folder.
 */

const LIVE_DATA = path.join(process.cwd(), 'src/app/live-data')

describe('listRoutes', () => {
  it('finds nested route folders, not only top-level ones', () => {
    const routes = listRoutes(LIVE_DATA)
    for (const nested of ['wallet/btc', 'wallet/eth', 'wallet/sol', 'wallet/tron', 'wallet/xrp', 'pump-report/metrics']) {
      expect(routes).toContain(nested)
    }
    expect(routes).toContain('markets')
  })
})

describe('hostsInSource', () => {
  it('drops the port, so s1.ripple.com:51234 is compared as s1.ripple.com', () => {
    expect([...hostsInSource(`const XRPL = 'https://s1.ripple.com:51234/'`)]).toEqual(['s1.ripple.com'])
  })

  it('ignores a URL in a comment and a template-literal host', () => {
    const src = [
      `// was https://api.yearn.finance/v1 until 2026-09-26`,
      'const u = `https://${host}/api`',
      `const live = 'https://api.coingecko.com/api/v3'`,
    ].join('\n')
    expect([...hostsInSource(src)]).toEqual(['api.coingecko.com'])
  })
})

describe('ownerOfRoute', () => {
  it('gives a nested route to the entry whose route ends in /* above it', () => {
    expect(ownerOfRoute('wallet/btc', DATA_SOURCES)?.id).toBe('wallet')
  })

  it('prefers an entry naming the exact nested route', () => {
    expect(ownerOfRoute('pump-report/metrics', DATA_SOURCES)?.id).toBe('pump-report-metrics')
  })

  it('still resolves a top-level route by its own id', () => {
    expect(ownerOfRoute('markets', DATA_SOURCES)?.id).toBe('markets')
  })
})

describe('the registry against the route code', () => {
  it('names every host every route fetches, nested routes included', () => {
    expect(driftItems(DATA_SOURCES, readRoutes(LIVE_DATA))).toEqual([])
  })

  it('names each wallet host one by one, so none escapes the terms check', () => {
    const wallet = DATA_SOURCES.find((e) => e.id === 'wallet')!
    // A hostless "summary" provider exempts its entry from the drift check; the wallet entry
    // had one, which is half of how its hosts went unchecked.
    expect(wallet.providers.every((p) => p.host)).toBe(true)
  })

  it('reports a wallet host the registry stops naming', () => {
    const trimmed = DATA_SOURCES.map((e) =>
      e.id === 'wallet' ? { ...e, providers: e.providers.filter((p) => p.host !== 'blockstream.info') } : e,
    )
    expect(driftItems(trimmed, readRoutes(LIVE_DATA))).toEqual([
      '"wallet/btc" fetches blockstream.info not named in "wallet"',
    ])
  })
})
