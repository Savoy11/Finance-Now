import { afterEach, describe, expect, it, vi } from 'vitest'
import { quartersFact, runTool } from '../tools'
import type { Quarter } from '@/lib/utils/companyQuarters'

// T-461: get_stock_financials gives the agents the quarters the stock page shows, through the same
// route, with which figures were worked out and the rule against working out any more.

afterEach(() => { vi.unstubAllGlobals() })

const QUARTERS: Quarter[] = [
  {
    start: '2025-07-01', end: '2025-09-30',
    revenue: { value: 115e9, workedOut: false, concept: 'Revenues' },
    netIncome: { value: 10e9, workedOut: false, concept: 'NetIncomeLoss' },
    eps: { value: 0.6, workedOut: false, concept: 'EarningsPerShareDiluted' },
    revenueChangePct: 12.7451, netIncomeChangePct: null, epsChangePct: 20,
  },
  {
    start: '2024-10-01', end: '2024-12-31',
    revenue: { value: 108e9, workedOut: true, concept: 'Revenues' },
    netIncome: null,
    eps: null,
    revenueChangePct: 2.857, netIncomeChangePct: null, epsChangePct: null,
  },
]

describe('get_stock_financials: the last eight quarters (T-461)', () => {
  it('passes each quarter on with its worked-out marks and changes, rounded', () => {
    const out = quartersFact(QUARTERS) as { quarters: Record<string, unknown>[]; note: string }
    expect(out.quarters[0]).toEqual({
      periodStart: '2025-07-01', periodEnd: '2025-09-30',
      revenueUsd: { value: 115e9, workedOut: false }, revenueChangePct: 12.7,
      netIncomeUsd: { value: 10e9, workedOut: false }, netIncomeChangePct: null,
      eps: { value: 0.6, basis: 'diluted' }, epsChangePct: 20,
    })
    expect(out.quarters[1]).toMatchObject({ revenueUsd: { value: 108e9, workedOut: true }, eps: null })
    expect(out.note).toMatch(/never work one out/)
  })

  it('says a company with no 10-Q has none, and not to estimate them', () => {
    expect(quartersFact([])).toEqual({ none: expect.stringMatching(/Do not estimate/) })
  })

  it('reads the quarters from the company-facts route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true, symbol: 'ACME', company: 'Acme', fiscalYearEnd: '2024-12-31', fundamentals: {}, ratios: {}, annualSeries: [],
      quarters: QUARTERS,
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const out = await runTool('get_stock_financials', { symbol: 'acme' }, 'http://x') as Record<string, any>
    expect(out.lastQuarters.quarters).toHaveLength(2)
    expect(out).not.toHaveProperty('annualSeries')
  })
})
