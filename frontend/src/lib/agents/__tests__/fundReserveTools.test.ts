import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTool, salesChargeFact, toolsForAgent } from '../tools'
import { getFund, fundSalesCharge, fundYieldFact } from '@/lib/data/fundCatalog'

// T-457 (a), D210: the in-app agents read what the fund pages and the Reserve Monitor show,
// through the same routes, with where each figure comes from and how old it is.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Answers each route the tools read from a table of path prefixes. */
function routes(table: Record<string, unknown | ((url: string) => Response)>) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input)
    const hit = Object.entries(table).find(([prefix]) => url.includes(prefix))
    if (!hit) return json({ ok: false, error: `no stub for ${url}` }, 404)
    return typeof hit[1] === 'function' ? (hit[1] as (u: string) => Response)(url) : json(hit[1])
  }))
}

afterEach(() => { vi.unstubAllGlobals() })

const holdingsFor = (symbol: string, extra: Record<string, unknown> = {}) => ({
  ok: true, symbol, updatedAt: '2026-11-07T00:00:00Z', source: 'sec', full: true, asOf: '2026-09-30',
  holdings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weightPct: 7.12345, shares: null, marketValue: null },
    { symbol: 'AAPL', name: 'Apple Inc', weightPct: 6.5, shares: null, marketValue: null },
    { symbol: 'MSFT', name: 'Microsoft Corp', weightPct: 6.1, shares: null, marketValue: null },
  ],
  sectorWeights: [],
  assetAllocation: [{ class: 'Stocks', weightPct: 99.6 }, { class: 'Cash', weightPct: 0.4 }],
  assetAllocationCoverage: { coveredPct: 100, unclassifiedCount: 0 },
  holdingsCount: 504,
  rateSensitivity: null,
  ...extra,
})
const prospectusFor = (symbol: string) => ({
  ok: true, symbol, updatedAt: '2026-11-07T00:00:00Z',
  prospectus: { kind: 'summary', filedAt: '2026-04-28', indexUrl: 'https://www.sec.gov/x-index.htm', url: 'https://www.sec.gov/x.htm' },
})

describe('get_fund_details', () => {
  it('is offered to the equity agents and the Assistant, not the crypto or macro ones', () => {
    const names = (set: Parameters<typeof toolsForAgent>[0]) => toolsForAgent(set).map((t) => t.name)
    expect(names('equities')).toContain('get_fund_details')
    expect(names('all')).toContain('get_fund_details')
    expect(names('crypto')).not.toContain('get_fund_details')
    expect(names('macro')).not.toContain('get_fund_details')
  })

  it('gives the filing’s holdings, mix, size and date, the prospectus, and the catalog’s costs', async () => {
    routes({ '/live-data/fund-holdings': holdingsFor('VOO'), '/live-data/fund-prospectus': prospectusFor('VOO') })
    const out = await runTool('get_fund_details', { symbol: 'voo', top: 2 }, 'http://x') as Record<string, any>
    expect(out.symbol).toBe('VOO')
    expect(out.inCatalog).toBe(true)
    expect(out.catalog.expenseRatioPct).toBe(getFund('VOO')!.expenseRatioPct)
    expect(out.filing.source).toBe("the fund's own N-PORT filing to the SEC")
    expect(out.filing.asOf).toBe('2026-09-30')
    expect(out.filing.positions).toBe(504)
    expect(out.filing.largestHoldings).toEqual([
      { name: 'NVIDIA Corp', symbol: 'NVDA', weightPct: 7.12 },
      { name: 'Apple Inc', symbol: 'AAPL', weightPct: 6.5 },
    ])
    expect(out.filing.largestHoldingsTotalPct).toBe(13.6)
    expect(out.filing.assetMix).toEqual([{ class: 'Stocks', weightPct: 99.6 }, { class: 'Cash', weightPct: 0.4 }])
    expect(out.filing.duration).toBeNull()
    expect(out.prospectus).toEqual({ kind: 'summary', filedAt: '2026-04-28', url: 'https://www.sec.gov/x.htm' })
  })

  it('gives a bond fund’s duration from its filing', async () => {
    routes({
      '/live-data/fund-holdings': holdingsFor('BND', { rateSensitivity: { durationYears: 5.8, currencies: ['USD'], asOf: '2026-09-30' } }),
      '/live-data/fund-prospectus': prospectusFor('BND'),
    })
    const out = await runTool('get_fund_details', { symbol: 'BND' }, 'http://x') as Record<string, any>
    expect(out.filing.duration).toMatchObject({ years: 5.8, asOf: '2026-09-30' })
  })

  it('gives where a fund invests from its filing, and nothing for a fund without one (T-455)', async () => {
    const split = (slices: Array<[string, string, number]>, statedPct: number) =>
      ({ slices: slices.map(([code, label, pct]) => ({ code, label, pct })), statedPct, listedPct: 99.8, unstatedCount: 2 })
    routes({
      '/live-data/fund-holdings': holdingsFor('BNDX', {
        exposure: {
          asOf: '2026-09-30',
          countries: split([['JP', 'Japan', 20], ['FR', 'France', 12]], 97.5),
          currencies: split([['EUR', 'Euro', 40], ['JPY', 'Japanese Yen', 20]], 99.8),
          bonds: { bondsPct: 98, borrowers: split([['NUSS', 'Foreign governments', 70]], 98), maturities: split([['5-10', '5 to 10 years', 30]], 96) },
        },
      }),
      '/live-data/fund-prospectus': prospectusFor('BNDX'),
    })
    const out = await runTool('get_fund_details', { symbol: 'BNDX' }, 'http://x') as Record<string, any>
    expect(out.filing.whereItInvests).toMatchObject({
      asOf: '2026-09-30',
      countries: [{ name: 'Japan', code: 'JP', pct: 20 }, { name: 'France', code: 'FR', pct: 12 }],
      countriesStatedPct: 97.5,
      currencies: [{ name: 'Euro', code: 'EUR', pct: 40 }, { name: 'Japanese Yen', code: 'JPY', pct: 20 }],
      bonds: { bondsPct: 98, borrowers: [{ kind: 'Foreign governments', pct: 70 }], maturities: [{ repaid: '5 to 10 years', pct: 30 }] },
    })
    expect(out.filing.whereItInvests.note).toMatch(/never guessed/)
    expect(out.filing.whereItInvests.note).toMatch(/no credit ratings/)

    routes({ '/live-data/fund-holdings': holdingsFor('VOO', { exposure: null }), '/live-data/fund-prospectus': prospectusFor('VOO') })
    const none = await runTool('get_fund_details', { symbol: 'VOO' }, 'http://x') as Record<string, any>
    expect(none.filing.whereItInvests).toBeNull()
  })

  it('gives a yield only where the fund’s page shows one, as the pages do (D166)', async () => {
    routes({ '/live-data/fund-holdings': holdingsFor('IVV'), '/live-data/fund-prospectus': prospectusFor('IVV') })
    const out = await runTool('get_fund_details', { symbol: 'IVV' }, 'http://x') as Record<string, any>
    expect(fundYieldFact(getFund('IVV')!).shown).toBe(false)
    expect(out.catalog.yieldPct).toBeNull()
    expect(String(out.catalog.yieldNote)).not.toBe('')
  })

  it('never states a sales charge’s rate that has not been verified', async () => {
    const f = getFund('AGTHX')!
    const charge = fundSalesCharge(f)!
    routes({ '/live-data/fund-holdings': holdingsFor('AGTHX'), '/live-data/fund-prospectus': prospectusFor('AGTHX') })
    const out = await runTool('get_fund_details', { symbol: 'AGTHX' }, 'http://x') as Record<string, any>
    expect(out.catalog.salesCharge.kind).toBe(charge.kind)
    expect(out.catalog.salesCharge.maxPct).toBe(charge.maxPct ?? null)
    if (charge.maxPct == null) expect(out.catalog.salesCharge.note).toContain('has not been verified')
  })

  it('gives no rate for a sales charge whose rate is unverified, and says so', () => {
    expect(salesChargeFact({ kind: 'front' })).toEqual({ kind: 'front', maxPct: null, note: 'A sales charge applies; its rate has not been verified, so do not state one.' })
    expect(salesChargeFact({ kind: 'front', maxPct: 5.75, source: 'the prospectus', verifiedAt: '2026-09-10' }))
      .toEqual({ kind: 'front', maxPct: 5.75, note: 'Read from the prospectus on 2026-09-10.' })
  })

  it('says when the holdings are the catalog’s indicative list rather than a filing', async () => {
    routes({ '/live-data/fund-holdings': holdingsFor('VOO', { source: 'catalog', full: false, asOf: null }), '/live-data/fund-prospectus': prospectusFor('VOO') })
    const out = await runTool('get_fund_details', { symbol: 'VOO' }, 'http://x') as Record<string, any>
    expect(out.filing.source).toContain('not a filing')
  })

  it('names a fund outside the catalog, and a holdings or prospectus lookup that failed, rather than filling gaps', async () => {
    routes({
      '/live-data/fund-holdings': () => json({ ok: false, error: 'SEC unreachable' }, 502),
      '/live-data/fund-prospectus': { ok: true, symbol: 'ZZZZX', updatedAt: '', prospectus: null, reason: 'Not in the SEC list.' },
    })
    const out = await runTool('get_fund_details', { symbol: 'ZZZZX' }, 'http://x') as Record<string, any>
    expect(out.inCatalog).toBe(false)
    expect(out.catalog).toBeNull()
    expect(out.note).toContain('not in the app')
    expect(out.filing.error).toContain('SEC unreachable')
    expect(out.prospectus).toEqual({ none: 'Not in the SEC list.' })
  })

  it('refuses something that is not a ticker before asking any route', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const out = await runTool('get_fund_details', { symbol: '../etc' }, 'http://x') as Record<string, any>
    expect(out.error).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})

const coin = (symbol: string, extra: Record<string, unknown> = {}) => ({
  id: symbol, symbol, name: symbol, pegType: 'peggedUSD', pegMechanism: 'fiat-backed',
  circulatingUsd: 75_000_000_000.4, price: 0.9995, priceSource: 'DefiLlama', chains: ['Ethereum'],
  supplyChange: { day: 0.1, week: -0.52, month: 1.3 },
  chainSplit: { top: [{ chain: 'Ethereum', amount: 50e9, pct: 66.7 }], others: { count: 12, amount: 25e9, pct: 33.3 } },
  composition: [{ category: 'US Treasury bills', percentage: 80, amount: 6e10, description: '' }],
  attester: 'Deloitte', attestationUrl: 'https://example.com/report', lastAttestedDate: '2026-10-15', collateralizationRatio: 1.0,
  ...extra,
})

describe('get_stablecoin_reserves', () => {
  it('is offered to the crypto agents and the Assistant only', () => {
    const names = (set: Parameters<typeof toolsForAgent>[0]) => toolsForAgent(set).map((t) => t.name)
    expect(names('crypto')).toContain('get_stablecoin_reserves')
    expect(names('all')).toContain('get_stablecoin_reserves')
    expect(names('equities')).not.toContain('get_stablecoin_reserves')
  })

  it('gives the live price and supply beside the dated, hand-kept attestation facts', async () => {
    routes({ '/live-data/reserves': { ok: true, assets: [coin('USDC'), coin('EURC', { pegType: 'peggedEUR', price: 1.16, attestationUrl: '#', collateralizationRatio: null })], notFound: ['GUSD'], metaAsOf: '2026-11-05' } })
    const out = await runTool('get_stablecoin_reserves', {}, 'http://x') as Record<string, any>
    expect(out.coins).toHaveLength(2)
    const usdc = out.coins[0]
    expect(usdc).toMatchObject({
      symbol: 'USDC', priceUsd: 0.9995, pegDeviationBps: -5, circulatingUsd: 75_000_000_000,
      supplyChangePct: { day: 0.1, week: -0.52, month: 1.3 }, attester: 'Deloitte', lastAttestedDate: '2026-10-15',
      largestChains: [{ chain: 'Ethereum', pct: 66.7 }], otherChains: { count: 12, pct: 33.3 },
      reserveMix: [{ category: 'US Treasury bills', pct: 80 }],
    })
    // A euro coin's dollar price is not its distance from its own peg.
    expect(out.coins[1].pegDeviationBps).toBeNull()
    expect(out.coins[1].attestationUrl).toBeNull()
    expect(out.coins[1].collateralizationRatio).toBeNull()
    expect(out.attestationFactsAsOf).toBe('2026-11-05')
    expect(out.notFound).toEqual(['GUSD'])
    expect(out.note).toContain('kept by hand as of 2026-11-05')
    expect(out.note).toContain('do not grade')
  })

  it('answers for one coin, and names the monitored ones when asked for another', async () => {
    routes({ '/live-data/reserves': { ok: true, assets: [coin('USDC'), coin('USDT')], notFound: [], metaAsOf: '2026-11-05' } })
    const one = await runTool('get_stablecoin_reserves', { symbol: 'usdt' }, 'http://x') as Record<string, any>
    expect(one.coins.map((c: { symbol: string }) => c.symbol)).toEqual(['USDT'])
    const none = await runTool('get_stablecoin_reserves', { symbol: 'XYZ' }, 'http://x') as Record<string, any>
    expect(none.error).toContain('XYZ')
    expect(none.monitored).toEqual(['USDC', 'USDT'])
  })

  it('reports a failed reserve feed as a failure, never as no coins', async () => {
    routes({ '/live-data/reserves': { ok: false, assets: [], error: 'DefiLlama HTTP 503' } })
    const out = await runTool('get_stablecoin_reserves', {}, 'http://x') as Record<string, any>
    expect(out.error).toContain('DefiLlama HTTP 503')
  })
})
