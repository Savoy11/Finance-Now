import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

// The newest filing failing to load (code audit 2026-11-12, D226): the route says so, with its
// filing date, rather than letting the card present the quarter before as the newest.

const nport = vi.hoisted(() => ({
  filings: [] as { accession: string; cik: string; filedAt: string }[],
  failing: new Set<string>(),
}))

vi.mock('@/lib/server/nport', () => ({
  resolveFundSeries: async () => ({ seriesId: 'S000000001', classId: 'C000000001' }),
  listNportFilings: async () => nport.filings,
  fetchNportReport: async (ref: { accession: string; filedAt: string }) => {
    if (nport.failing.has(ref.accession)) throw new Error('SEC did not answer')
    // A quarter ending about two months before the filing date.
    const filed = new Date(`${ref.filedAt}T00:00:00Z`)
    const asOf = new Date(Date.UTC(filed.getUTCFullYear(), filed.getUTCMonth() - 1, 0)).toISOString().slice(0, 10)
    return {
      asOf, netAssets: 1e9, holdings: [], rateRisk: [],
      returns: [{ classId: 'C000000001', months: [1, 1, 1] }],
      flows: [null, null, null],
    }
  },
}))

const { GET } = await import('../route')

afterEach(() => { nport.failing.clear() })

const filing = (filedAt: string, n: number) => ({ accession: `0000000000-26-00000${n}`, cik: '1', filedAt })

describe('/live-data/fund-returns', () => {
  nport.filings = [filing('2026-08-28', 1), filing('2026-05-29', 2), filing('2026-02-27', 3), filing('2025-11-26', 4), filing('2025-08-28', 5)]
  const call = async () => (await GET(new NextRequest('http://x/live-data/fund-returns?symbol=VOO'))).json()

  it('names the newest filing when it could not be read', async () => {
    // Mutation: drop newestUnread and the card shows May's filing as the newest without a word.
    nport.failing.add(nport.filings[0].accession)
    const body = await call()
    expect(body.ok, JSON.stringify(body)).toBe(true)
    expect(body.newestUnread).toEqual({ filedAt: '2026-08-28' })
    expect(body.filingsFailed).toBe(1)
    expect(body.returns.filedAt).toBe('2026-05-29')
  })

  it('says nothing of the kind when only an older filing failed', async () => {
    nport.failing.add(nport.filings[2].accession)
    const body = await call()
    expect(body.newestUnread).toBeUndefined()
    expect(body.filingsFailed).toBe(1)
    expect(body.returns.filedAt).toBe('2026-08-28')
  })
})

describe('the fund page shows it', () => {
  it('says the figures may not be the latest, and never calls a failed filing older', () => {
    const card = readFileSync(join(process.cwd(), 'src/app/(dashboard)/funds/[symbol]/FundReturnsCard.tsx'), 'utf8')
    expect(card).toContain('data.newestUnread &&')
    expect(card).toContain('these may not be its latest figures')
    expect(card).not.toMatch(/older filing/)
  })
})
