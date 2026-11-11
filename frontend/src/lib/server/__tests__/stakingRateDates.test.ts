import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectStakingRates } from '../stakingRates'
import { GET as opportunities } from '@/app/api/v1/staking/opportunities/route'

// T-465 (owner decision D224): every staking rate that is not live says where it came from and
// how old it is. The collector dates each figure it takes from its backup table (its measured
// date, or null for one never measured), and a figure worked out from a live reading is not the
// table's. These run the real collector against made-up answers from its sources.

/** Answers each source by address: `lido` answers with a rate, everything else fails. */
function sources(opts: { lido?: number } = {}) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url)
    if (u.includes('eth-api.lido.fi') && opts.lido != null) {
      return new Response(JSON.stringify({ data: { smaApr: opts.lido } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new TypeError('fetch failed')
  })
}

let measuredOn = ''
beforeEach(async () => {
  vi.stubEnv('FN_API_KEYS', '')
  vi.stubEnv('FN_ADMIN_TOKEN', '')
  vi.stubEnv('CAEP_ADMIN_TOKEN', '')
  // The table's measured date moves every week (D186), so the clock is set from it.
  vi.stubGlobal('fetch', sources())
  measuredOn = (await collectStakingRates()).fallbackProvenance.measuredOn
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${measuredOn}T12:00:00Z`))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('the collector dates every figure it takes from its backup table', () => {
  it('a measured key served from the table carries its measured date; a key never measured carries null', async () => {
    vi.stubGlobal('fetch', sources())
    const r = await collectStakingRates()
    expect(r.sources.lido_eth).toBe('estimate')
    expect(r.fallbackProvenance.byKey.lido_eth).toBe(measuredOn)
    expect(r.rates.lido_eth).toBeGreaterThan(0)
    // No source publishes Cosmos Hub's rate in a form the app can read: kept, with no date (D224).
    expect(r.fallbackProvenance.byKey).toHaveProperty('native_atom', null)
    expect(r.gaps.native_atom).toBe('no-upstream')
    // Every key in byKey is a key the table holds, and nothing live is in it.
    for (const key of Object.keys(r.fallbackProvenance.byKey)) expect(r.sources[key], key).toBe('estimate')
    const dated = Object.values(r.fallbackProvenance.byKey).filter(Boolean).length
    expect(dated).toBe(r.fallbackProvenance.measuredKeys)
  })

  it('a figure worked out from a live reading is not the table’s, and has no table date', async () => {
    vi.stubGlobal('fetch', sources({ lido: 3 }))
    const r = await collectStakingRates()
    expect(r.sources.lido_eth).toBe('live')
    expect(r.fallbackProvenance.byKey).not.toHaveProperty('lido_eth')
    // Coinbase's ETH rate is Lido's less half a point, worked out just now.
    expect(r.rates.coinbase_eth).toBe(2.5)
    expect(r.gaps.coinbase_eth).toBe('derived-estimate')
    expect(r.fallbackProvenance.byKey).not.toHaveProperty('coinbase_eth')
    // Ankr's is worked out from Lido's too when its own source (DefiLlama) did not answer.
    expect(r.rates.ankr_eth).toBe(3.1)
    expect(r.fallbackProvenance.byKey).not.toHaveProperty('ankr_eth')
    expect(r.gaps.ankr_eth).toBe('upstream-failed')
  })

  it('when the reading it is worked out from did not answer, the figure is the table’s and says the source failed', async () => {
    // Mutation: report `derived-estimate` from the key's fixed reason, as before T-465, and
    // Coinbase's ETH rate reads "calculated from a live reading" while showing the table's figure.
    vi.stubGlobal('fetch', sources())
    const r = await collectStakingRates()
    expect(r.gaps.coinbase_eth).toBe('upstream-failed')
    expect(r.fallbackProvenance.byKey).toHaveProperty('coinbase_eth', null)
  })

  it('Polygon’s native rate is never worked out from anything, and says so', async () => {
    vi.stubGlobal('fetch', sources({ lido: 3 }))
    const r = await collectStakingRates()
    expect(r.gaps.native_matic).toBe('no-upstream')
    expect(r.fallbackProvenance.byKey).toHaveProperty('native_matic', null)
  })

  it('a measured figure too old to show is withheld, and still carries its date', async () => {
    vi.setSystemTime(new Date(Date.parse(`${measuredOn}T00:00:00Z`) + 30 * 86_400_000))
    vi.stubGlobal('fetch', sources())
    const r = await collectStakingRates()
    expect(r.gaps.lido_eth).toBe('estimate-expired')
    expect(r.rates).not.toHaveProperty('lido_eth')
    expect(r.fallbackProvenance.byKey.lido_eth).toBe(measuredOn)
    // A figure worked out from a live reading this request is today's, and never expires.
    vi.stubGlobal('fetch', sources({ lido: 3 }))
    const live = await collectStakingRates()
    expect(live.rates.ankr_eth).toBe(3.1)
    expect(live.gaps.ankr_eth).not.toBe('estimate-expired')
  })
})

describe('the public API says where each rate came from (T-465)', () => {
  const call = async () => {
    const res = await opportunities(new NextRequest('https://localhost:3000/api/v1/staking/opportunities?coin=eth', { headers: { host: 'localhost:3000' } }))
    expect(res.status).toBe(200)
    return res.json() as Promise<{ opportunities: Record<string, unknown>[]; note: string; referenceData: { verifiedAt: string } }>
  }
  const row = (body: { opportunities: Record<string, unknown>[] }, provider: string) =>
    body.opportunities.find((o) => o.provider === provider)!

  it('dates a backup rate by its measurement, and a catalog rate by nothing of its own', async () => {
    vi.stubGlobal('fetch', sources())
    const body = await call()
    expect(row(body, 'lido')).toMatchObject({ aprSource: 'estimate', aprBasis: 'backup-measured', aprMeasuredOn: measuredOn })
    // Coinbase's ETH rate, with Lido down: the table's own undated figure, no longer "derived".
    expect(row(body, 'coinbase')).toMatchObject({ aprSource: 'estimate', aprBasis: 'backup-undated', aprMeasuredOn: null })
    expect(body.note).toMatch(/backup-undated/)
    expect(body.referenceData.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('marks a rate worked out from Lido’s live reading as derived, with no date', async () => {
    vi.stubGlobal('fetch', sources({ lido: 3 }))
    const body = await call()
    expect(row(body, 'lido')).toMatchObject({ aprSource: 'live', aprBasis: 'live', aprMeasuredOn: null })
    expect(row(body, 'coinbase')).toMatchObject({ aprSource: 'derived', aprBasis: 'derived', aprMeasuredOn: null })
    // Ankr's ETH rate, its own source (DefiLlama) down, is Lido's plus a tenth: worked out, not
    // the table's, though its reason is the failed source. Mutation: read "derived" off the
    // reason, as before T-465, and it reads as a plain estimate.
    expect(row(body, 'ankr')).toMatchObject({ apr: 3.1, aprSource: 'derived', aprBasis: 'derived', aprMeasuredOn: null })
  })

  it('a withheld reading serves the catalog figure and says so', async () => {
    vi.setSystemTime(new Date(Date.parse(`${measuredOn}T00:00:00Z`) + 30 * 86_400_000))
    vi.stubGlobal('fetch', sources())
    const body = await call()
    expect(row(body, 'lido')).toMatchObject({ aprSource: 'estimate-expired', aprBasis: 'catalog', aprMeasuredOn: null })
  })
})

describe('the surfaces read those dates', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

  it('the staking page dates each rate by where it came from, not by the catalog', () => {
    const page = read('src/app/(dashboard)/staking/page.tsx')
    expect(page).toContain('ratesData?.fallbackProvenance?.byKey')
    expect(page).toContain('backupDates={backupDates}')
    expect(page).toMatch(/aprBasis\(shown, liveKey, rates, backupDates\)/)
    // The notice's old sentence dated every non-live rate by the catalog's compile date.
    expect(page).not.toMatch(/every other rate, lock-up and minimum is a curated estimate/)
    expect(page).not.toMatch(/new Date\(STAKING_DATA_LAST_VERIFIED\)\.toLocaleDateString\(\)/)
  })

  it('the MCP server names a backup rate’s measured date, or that it has none', () => {
    const mcp = read('../mcp-server/src/index.ts')
    expect(mcp).toMatch(/opp\.aprBasis === 'backup-measured' && opp\.aprMeasuredOn/)
    expect(mcp).toContain("' (backup rate, no measured date)'")
  })
})
