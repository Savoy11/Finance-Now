import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTool, toolsForAgent } from '../tools'
import {
  INSTITUTIONAL_AS_FILED_NOTE, MULTI_CLASS_NO_PCT_NOTE, PCT_WITHHELD_SPLIT_NOTE,
  TREASURY_NOT_REPORTED_NOTE, fundHoldersScopeNote, thirteenFPeriodNote, unresolvedInPlainWords,
} from '@/lib/data/stockHolders'

// T-476 (D245): the agents read what the stock page's "Who Holds It" cards
// show, through the same routes — and the figures travel WITH their limits
// (the D136 lesson), so an answer cannot quote the number and drop the
// caveat. In-app only: /api/v1 and the MCP server stay parked on T-457.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Answers each route the tool reads from a table of path prefixes. */
function routes(table: Record<string, unknown | ((url: string) => Response)>) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input)
    const hit = Object.entries(table).find(([prefix]) => url.includes(prefix))
    if (!hit) return json({ ok: false, error: `no stub for ${url}` }, 404)
    return typeof hit[1] === 'function' ? (hit[1] as (u: string) => Response)(url) : json(hit[1])
  }))
}

afterEach(() => { vi.unstubAllGlobals() })

const holdersFor = (symbol: string, extra: Record<string, unknown> = {}) => ({
  ok: true, symbol, builtOn: '2026-11-24', period: '2026-06-30', managersInPeriod: 8857,
  fundsRead: 103, stocksCovered: 4269, unresolvedReason: null,
  updatedAt: '2026-11-25T00:00:00Z', source: 'SEC Form 13F data set + N-PORT filings',
  entry: {
    cusip: '037833100', cusipFamilies: ['Vanguard', 'State Street'], cusipVia: 'fund-names', multiClass: false,
    institutional: {
      totalShares: 9_700_000_000, holderCount: 6_111,
      topHolders: [
        { name: 'Vanguard Group Inc', cik: '102909', shares: 1_400_000_000, valueUsd: 350_000_000_000 },
        { name: 'BlackRock Inc', cik: '1364742', shares: 1_100_000_000, valueUsd: 270_000_000_000 },
      ],
    },
    funds: [
      { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', shares: 190_000_000, valueUsd: 48_000_000_000, pctVal: 6.5, asOf: '2026-09-30' },
    ],
  },
  ...extra,
})

const factsFor = (extra: Record<string, unknown> = {}) => ({
  ok: true,
  shareStructure: {
    issued: { shares: 14_600_000_000, asOf: '2026-10-17' },
    treasury: null, treasuryReported: false, treasuryPctOfIssued: null,
    outstanding: { shares: 14_532_259_000, asOf: '2026-10-17' },
    reconciles: null,
    ...extra,
  },
})

const universeFor = (symbol: string, shareChange: number | null) => ({
  ok: true, entries: [{ symbol, shareChange }],
})

describe('get_stock_holders', () => {
  it('is offered to the equity agents and the Assistant, not the crypto or macro ones', () => {
    const names = (set: Parameters<typeof toolsForAgent>[0]) => toolsForAgent(set).map((t) => t.name)
    expect(names('equities')).toContain('get_stock_holders')
    expect(names('all')).toContain('get_stock_holders')
    expect(names('crypto')).not.toContain('get_stock_holders')
    expect(names('macro')).not.toContain('get_stock_holders')
  })

  it('returns the figures WITH every limit the card shows beside them', async () => {
    routes({
      '/live-data/stock-holders': holdersFor('AAPL'),
      '/live-data/company-facts': factsFor(),
      '/live-data/stock-universe': universeFor('AAPL', 1.01),
    })
    const out = await runTool('get_stock_holders', { symbol: 'aapl' }, 'http://x') as Record<string, any>

    // The share split, with Apple's no-treasury state as a sentence, never a dash.
    expect(out.shareSplit.outstanding.shares).toBe(14_532_259_000)
    expect(out.shareSplit.treasury.none).toBe(TREASURY_NOT_REPORTED_NOTE)

    // The institutional figures, the percent worked out, and both notes.
    expect(out.institutional.totalSharesReported).toBe(9_700_000_000)
    expect(out.institutional.reportingManagers).toBe(6_111)
    expect(out.institutional.pctOfOutstanding).toBe(66.7) // 9.70B / 14.532B, rounded to one decimal
    expect(out.institutional.largestManagers[0]).toMatchObject({ name: 'Vanguard Group Inc', cik: '102909' })
    expect(out.institutional.notes).toContain(thirteenFPeriodNote('2026-06-30'))
    expect(out.institutional.notes).toContain(INSTITUTIONAL_AS_FILED_NOTE)

    // The fund rows carry their dates and the scope note's derived counts.
    expect(out.funds.rows[0]).toMatchObject({ symbol: 'VOO', asOf: '2026-09-30' })
    expect(out.funds.note).toBe(fundHoldersScopeNote(103))
    expect(out.builtOn).toBe('2026-11-24')
    expect(String(out.reportingNote)).toContain('Quote the notes with the figures')
  })

  it('a multi-class stock reports shares with no percent, and says why', async () => {
    routes({
      '/live-data/stock-holders': holdersFor('BRK-B', {
        entry: { ...holdersFor('BRK-B').entry, multiClass: true },
      }),
      '/live-data/company-facts': factsFor(),
      '/live-data/stock-universe': universeFor('BRK-B', 1.0),
    })
    const out = await runTool('get_stock_holders', { symbol: 'BRK-B' }, 'http://x') as Record<string, any>
    expect(out.institutional.pctOfOutstanding).toBeNull()
    expect(out.institutional.pctNote).toBe(MULTI_CLASS_NO_PCT_NOTE)
  })

  it('a split signal withholds the percent by D170\'s band, exactly as the card does', async () => {
    routes({
      '/live-data/stock-holders': holdersFor('BKNG'),
      '/live-data/company-facts': factsFor(),
      '/live-data/stock-universe': universeFor('BKNG', 0.04), // a 25-for-1 split's signature
    })
    const out = await runTool('get_stock_holders', { symbol: 'BKNG' }, 'http://x') as Record<string, any>
    expect(out.institutional.pctOfOutstanding).toBeNull()
    expect(out.institutional.pctNote).toBe(PCT_WITHHELD_SPLIT_NOTE)
    // The shares themselves still report — only the ratio between unlike units is withheld.
    expect(out.institutional.totalSharesReported).toBe(9_700_000_000)
  })

  it('an unresolved stock answers in the page\'s own plain words, never an empty object', async () => {
    routes({
      '/live-data/stock-holders': holdersFor('XYZ', { entry: null, unresolvedReason: 'ambiguous: 2 CUSIPs survive' }),
      '/live-data/company-facts': factsFor(),
      '/live-data/stock-universe': universeFor('XYZ', null),
    })
    const out = await runTool('get_stock_holders', { symbol: 'XYZ' }, 'http://x') as Record<string, any>
    expect(out.institutional.notCovered).toBe(unresolvedInPlainWords('ambiguous: 2 CUSIPs survive'))
    expect(out.funds.notCovered).toBe(unresolvedInPlainWords('ambiguous: 2 CUSIPs survive'))
    expect(out.stocksCovered).toBe(4269)
  })

  it('a failed share-figures fetch degrades that section alone, with the reason', async () => {
    routes({
      '/live-data/stock-holders': holdersFor('AAPL'),
      '/live-data/company-facts': () => json({ ok: false, error: 'No SEC registrant found' }, 404),
      '/live-data/stock-universe': universeFor('AAPL', 1.0),
    })
    const out = await runTool('get_stock_holders', { symbol: 'AAPL' }, 'http://x') as Record<string, any>
    expect(String(out.shareSplit.error)).toContain('No SEC registrant found')
    // No outstanding count means no percent — never a guess.
    expect(out.institutional.pctOfOutstanding).toBeNull()
    expect(out.institutional.totalSharesReported).toBe(9_700_000_000)
  })

  it('rejects a non-ticker instead of fetching', async () => {
    routes({})
    const out = await runTool('get_stock_holders', { symbol: 'not a ticker!!' }, 'http://x') as Record<string, any>
    expect(out.error).toContain('ticker')
  })
})
