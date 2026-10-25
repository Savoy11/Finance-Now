import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FUND_CATALOG, YIELD_CHECK_AFTER_DAYS, YIELD_SHOWN_FOR_DAYS, fundShownYield } from '@/lib/data/fundCatalog'
import {
  accuracyReport, clockRows, fundRows, stockRows, summarize, ACCURACY_HORIZON_DAYS, FILED_FIGURE_DUE_DAYS, STOCK_FIGURES_DUE_DAYS,
} from '../../../../scripts/lib/accuracyCheck'

// The quarterly accuracy check (owner, 2026-10-25, D166): every posted figure with a date, when
// its re-read falls due, and how. Each rule is driven across its edge by a fixture.

const utc = (d: string) => Date.parse(`${d}T00:00:00Z`)
const plus = (d: string, n: number) => utc(d) + n * 86_400_000
const vanguard = {
  symbol: 'VOO', website: 'https://investor.vanguard.com/x', yieldPct: 1,
  yieldRead: { asOf: '2026-09-30', kind: 'sec' as const, source: 'https://investor.vanguard.com/x' },
}

describe('fund figures', () => {
  it('lists a shown yield, due a quarter after its date and withheld a month after that', () => {
    const at = (n: number) => fundRows([vanguard], plus('2026-09-30', n))[0]
    expect(at(1)).toMatchObject({ group: 'fund-yield', item: 'VOO', asOf: '2026-09-30', dueOn: '2027-01-01', withheldOn: '2027-01-31', status: 'ok' })
    expect(at(YIELD_CHECK_AFTER_DAYS + 1 - ACCURACY_HORIZON_DAYS).status).toBe('soon')
    expect(at(YIELD_CHECK_AFTER_DAYS).status).toBe('soon')
    expect(at(YIELD_CHECK_AFTER_DAYS + 1).status).toBe('due')
    expect(at(YIELD_SHOWN_FOR_DAYS).status).toBe('due')
    // Still listed once withheld, so a missed check is never forgotten.
    expect(at(YIELD_SHOWN_FOR_DAYS + 1).status).toBe('withheld')
  })

  it('agrees with the fund pages about when a yield stops being shown', () => {
    for (const n of [YIELD_SHOWN_FOR_DAYS, YIELD_SHOWN_FOR_DAYS + 1]) {
      const now = plus('2026-09-30', n)
      const shown = fundShownYield(vanguard, new Date(now)).shown
      expect(fundRows([vanguard], now)[0].status === 'withheld', `day ${n}`).toBe(!shown)
    }
  })

  it('never lists a yield the app does not post', () => {
    const ishares = { ...vanguard, symbol: 'IVV', website: 'https://www.ishares.com/x' }
    const unread = { ...vanguard, symbol: 'VT', yieldRead: undefined }
    expect(fundRows([ishares, unread], plus('2026-09-30', 1))).toEqual([])
  })

  it('dates page-read and filed asset figures', () => {
    const rows = fundRows([
      { symbol: 'A', website: 'https://www.ishares.com/x', yieldPct: null, aumRead: { asOf: '2026-09-30', source: 'x' } },
      { symbol: 'B', website: 'https://www.ishares.com/x', yieldPct: null, aumAsOf: '2026-06-30' },
    ], utc('2026-10-25'))
    expect(rows).toEqual([
      expect.objectContaining({ group: 'fund-assets-page', item: 'A', dueOn: '2027-01-01' }),
      expect.objectContaining({ group: 'fund-assets-filed', item: 'B', dueOn: new Date(plus('2026-06-30', FILED_FIGURE_DUE_DAYS)).toISOString().slice(0, 10) }),
    ])
  })

  it('covers every shown yield in the real catalog', () => {
    const now = utc('2026-10-25')
    const shown = FUND_CATALOG.filter((f) => fundShownYield(f, new Date(now)).shown).map((f) => f.symbol).sort()
    const listed = fundRows(FUND_CATALOG, now).filter((r) => r.group === 'fund-yield').map((r) => r.item).sort()
    expect(listed.length).toBeGreaterThan(0)
    expect(listed).toEqual(shown)
  })
})

describe('stock figures (D167)', () => {
  const ps = (asOf: string | null, dividend: 'paid' | 'none' | 'unknown' = 'paid') => ({
    eps: asOf ? { val: 7.46, end: asOf, basis: 'diluted' as const } : null,
    dps: null, dividend, asOf,
  })

  it('falls due a year and 75 days after the fiscal year the figures are for', () => {
    const rows = stockRows(new Map([['AAPL', ps('2025-09-27')]]), utc('2026-10-25'))
    expect(rows[0]).toMatchObject({ group: 'stock-per-share', item: 'AAPL', asOf: '2025-09-27', dueOn: new Date(plus('2025-09-27', STOCK_FIGURES_DUE_DAYS)).toISOString().slice(0, 10), status: 'ok' })
    expect(stockRows(new Map([['AAPL', ps('2025-09-27')]]), plus('2025-09-27', STOCK_FIGURES_DUE_DAYS))[0].status).toBe('due')
  })

  it('lists a stock with no usable figure as due, saying the pages show a dash', () => {
    expect(stockRows(new Map([['V', ps(null, 'unknown')]]), utc('2026-10-25'))[0]).toMatchObject({ asOf: 'none', status: 'due', note: expect.stringMatching(/show a dash/) })
  })

  it('notes a dividend missing from the data', () => {
    expect(stockRows(new Map([['CRM', ps('2026-01-31', 'unknown')]]), utc('2026-10-25'))[0].note).toMatch(/dividend not in the SEC data/)
    expect(stockRows(new Map([['AMZN', ps('2025-12-31', 'none')]]), utc('2026-10-25'))[0].note).toBeUndefined()
  })
})

describe('clocks', () => {
  const clock = { file: 'src/lib/data/x.ts', anchorName: 'X_LAST_VERIFIED', anchorDate: '2026-06-01', windowDays: 90, ack: null }

  it('falls due the day the clock fires, as staleness:check counts it', () => {
    expect(clockRows([clock], utc('2026-08-30'))[0]).toMatchObject({ dueOn: '2026-08-31', status: 'soon', days: 1 })
    expect(clockRows([clock], utc('2026-08-31'))[0]).toMatchObject({ status: 'due' })
  })

  it('names a valid acknowledgement and ignores one older than its anchor', () => {
    expect(clockRows([{ ...clock, ack: { date: '2026-09-01', note: 'x' } }], utc('2026-10-01'))[0].note).toMatch(/let it fire \(2026-09-01\)/)
    expect(clockRows([{ ...clock, ack: { date: '2026-05-01', note: 'x' } }], utc('2026-10-01'))[0].note).toBeUndefined()
  })
})

describe('the report', () => {
  it('lists what is due in full, counts the rest, and gives the re-read command', () => {
    const now = plus('2026-09-30', YIELD_CHECK_AFTER_DAYS + 5)
    const later = { ...vanguard, symbol: 'VTI', yieldRead: { ...vanguard.yieldRead, asOf: '2026-12-31' } }
    const summary = summarize(fundRows([vanguard, later], now))
    expect(summary.fundsToReread).toEqual(['VOO'])
    const md = accuracyReport(summary, '2027-01-05')
    expect(md).toContain('| VOO | 2026-09-30 | 2027-01-01 (withheld 2027-01-31) | DUE |')
    expect(md).toContain('npm run fund-figures-prefill -- --only VOO')
    expect(md).toMatch(/1 ok; the next falls due/)
    expect(md).not.toContain('| VTI |')
  })
})

describe('the quarterly workflow', () => {
  const yml = readFileSync(join(process.cwd(), '..', '.github', 'workflows', 'quarterly-accuracy-check.yml'), 'utf8')

  it('runs at the start of each quarter and on demand', () => {
    expect(yml).toMatch(/cron:\s*'[0-9]+ [0-9]+ 1 1,4,7,10 \*'/)
    expect(yml).toMatch(/workflow_dispatch/)
    expect(yml).toContain('npm run accuracy-check -- --sec --out')
  })

  it('may open an issue and read the repo, and nothing else: no deletion, no push', () => {
    expect(yml).toMatch(/permissions:\s*\n\s*contents: read\s*\n\s*issues: write/)
    expect(yml).not.toMatch(/contents: write|git push|deleteRef|delete|prune|cleanup/i)
  })
})
