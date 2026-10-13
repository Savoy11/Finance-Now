import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  listRoutes, hostsInSource, ownerOfRoute, driftItems, readRoutes, NOT_FETCHED, NOT_DATA_SOURCES,
} from '../../../../scripts/lib/routeHosts.mjs'
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

/**
 * T-433 (2026-10-13). Any entry with a hostless provider used to be skipped outright, and so
 * were config and news: 23 of 56 entries. newsapi.org, gnews.io and the LLM key-test hosts
 * never reached the terms check, and finnhub.io, a live quote rung, was named by no entry.
 * A hostless provider is now only a description; the exceptions are two named lists.
 */
describe('no blanket exemption', () => {
  const entry = (id: string, providers: { name: string; host?: string }[], route = `/live-data/${id}`) =>
    ({ id, route, providers: providers.map((p) => ({ ...p, role: 'primary' as const, auth: 'none' as const })) })
  // These fake route lists hold no LLM hosts, so the stale-exception check would list all of them.
  const drift = (...args: Parameters<typeof driftItems>) => driftItems(...args).filter((i) => !i.startsWith('NOT_DATA_SOURCES'))

  it('reports an unnamed host behind a hostless provider', () => {
    const entries = [entry('feed', [{ name: 'Some RSS feeds' }])]
    expect(drift(entries, [{ id: 'feed', hosts: new Set(['example.org']) }])).toEqual([
      '"feed" fetches example.org not named in "feed"',
    ])
  })

  it('holds the connectivity test to hosts some other entry names', () => {
    const entries = [entry('config', [{ name: 'Every configured provider' }]), entry('quotes', [{ name: 'Q', host: 'api.example.com' }])]
    expect(drift(entries, [{ id: 'config', hosts: new Set(['api.example.com']) }])).toEqual([])
    expect(drift(entries, [{ id: 'config', hosts: new Set(['api.example.com', 'unnamed.example.net']) }])).toEqual([
      '"config" checks unnamed.example.net, which no registry entry names',
    ])
  })

  it('names every quote rung, Finnhub included', () => {
    const hosts = DATA_SOURCES.find((e) => e.id === 'security-quotes')!.providers.map((p) => p.host)
    expect(hosts).toEqual(expect.arrayContaining(['financialmodelingprep.com', 'finnhub.io', 'api.twelvedata.com', 'api.tiingo.com', 'www.alphavantage.co']))
  })
})

describe('the two named exceptions', () => {
  const routes = readRoutes(LIVE_DATA)
  const config = routes.find((r) => r.id === 'config')!

  it('excuses exactly the LLM providers the Integrations test calls (D104)', () => {
    const llmHosts = [...config.hosts].filter((h) => h in NOT_DATA_SOURCES)
    expect(llmHosts.sort()).toEqual(Object.keys(NOT_DATA_SOURCES).sort())
  })

  it('reports an exception that no longer matches the code', () => {
    const trimmed = routes.map((r) => (r.id === 'news' ? { ...r, hosts: new Set([...r.hosts].filter((h) => h !== 'www.congress.gov')) } : r))
    expect(driftItems(DATA_SOURCES, trimmed)).toContain('NOT_FETCHED excuses www.congress.gov in "news", which no longer writes it')
    const noLlm = routes.map((r) => (r.id === 'config' ? { ...r, hosts: new Set([...r.hosts].filter((h) => h !== 'api.cohere.com')) } : r))
    expect(driftItems(DATA_SOURCES, noLlm)).toContain('NOT_DATA_SOURCES excuses api.cohere.com, which no route fetches')
  })

  it('gives every exception a reason', () => {
    for (const reasons of [NOT_DATA_SOURCES, ...Object.values(NOT_FETCHED)]) {
      for (const [host, why] of Object.entries(reasons as Record<string, string>)) expect(why.length, host).toBeGreaterThan(20)
    }
  })
})
