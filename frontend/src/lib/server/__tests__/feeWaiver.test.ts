import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  classifyExpense, grossStatement, catalogDescriptions, STATED_GROSS, WAIVER_EPSILON_PCT,
} from '../../../../scripts/lib/feeWaiver.mjs'
import { FUND_CATALOG } from '@/lib/data/fundCatalog'

/**
 * T-412 / D36 (2026-09-30). `npm run fund-fees` compares the catalog against the fee an
 * investor pays today — the net under a waiver, the total otherwise — but until this
 * change it dropped whichever figure it did not compare, so a run could not tell a waiver
 * from a fee cut, and D36's second half (a waived row's description states the full fee)
 * was uncheckable for every fund it read. These pin the rules that fix it.
 */
describe('classifyExpense — which figure a fee is, and whether a waiver separates them', () => {
  it('a fund with only the total line is a plain total, never a waiver', () => {
    expect(classifyExpense({ grossPct: 0.39 })).toMatchObject({ chosenPct: 0.39, line: 'total', waiver: false })
  })

  it('a net below its total is a waiver, and the net is the figure the catalog records', () => {
    expect(classifyExpense({ netPct: 0.30, grossPct: 0.45 })).toMatchObject({
      chosenPct: 0.30, line: 'net', netPct: 0.30, grossPct: 0.45, waiver: true,
    })
  })

  it('a net equal to its total is not a waiver', () => {
    expect(classifyExpense({ netPct: 0.2, grossPct: 0.2 }).waiver).toBe(false)
  })

  it('a gap under half a basis point is rounding, not a waiver', () => {
    expect(classifyExpense({ netPct: 0.2, grossPct: 0.2 + WAIVER_EPSILON_PCT / 2 }).waiver).toBe(false)
    expect(classifyExpense({ netPct: 0.2, grossPct: 0.2 + WAIVER_EPSILON_PCT }).waiver).toBe(true)
  })

  it('a net with no total, or a net ABOVE its total, is unknown and says why — never a guess', () => {
    expect(classifyExpense({ netPct: 0.3 })).toMatchObject({ chosenPct: 0.3, waiver: null, note: 'net-without-total' })
    expect(classifyExpense({ netPct: 0.5, grossPct: 0.3 })).toMatchObject({ chosenPct: 0.5, waiver: null, note: 'net-above-total' })
  })

  it('a zero fee is a figure, not an absence', () => {
    // A falsy-zero slip here would report a 0.00% fund as having no fee at all.
    expect(classifyExpense({ grossPct: 0 })).toMatchObject({ chosenPct: 0, line: 'total', waiver: false })
    expect(classifyExpense({ netPct: 0, grossPct: 0.1 })).toMatchObject({ chosenPct: 0, waiver: true })
  })

  it('no figures at all is no answer', () => {
    expect(classifyExpense({})).toMatchObject({ chosenPct: null, line: null, waiver: null })
    expect(classifyExpense({ netPct: Number.NaN, grossPct: null }).chosenPct).toBeNull()
  })
})

describe('grossStatement — does a waived row state its full fee (D36)', () => {
  const sivr = 'Lower-cost physical silver alternative to SLV. Expense ratio is net of a fee waiver (0.45% gross).'

  it('recognises the catalog phrasing and checks the figure against the filing', () => {
    expect(grossStatement(sivr, 0.45)).toBe('stated')
    expect(grossStatement(sivr, 0.5)).toBe('stated-differs')
    expect(grossStatement(sivr, null)).toBe('stated')
  })

  it('a description without the phrasing is not stated', () => {
    expect(grossStatement('Broad US large-cap growth index fund.', 0.04)).toBe('not-stated')
  })

  it('a missing description is unknown, never "not stated"', () => {
    expect(grossStatement(undefined, 0.45)).toBe('unknown')
    expect(grossStatement(null, 0.45)).toBe('unknown')
  })

  it('accepts a gross with more after it — HEFA\'s reads "(0.70% gross, 0.32 of it …)"', () => {
    expect(grossStatement('Expense ratio is net of a contractual waiver (0.70% gross, 0.32 of it the underlying fund fee counted twice).', 0.7)).toBe('stated')
  })
})

describe('the script reads the catalog it checks', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/data/fundCatalog.ts'), 'utf8')
  const parsed = catalogDescriptions(src)

  it('reads every catalog row\'s description, exactly as the app sees it', () => {
    expect(parsed.size).toBe(FUND_CATALOG.length)
    for (const f of FUND_CATALOG) expect(parsed.get(f.symbol), f.symbol).toBe(f.description)
  })

  it('recognises every waiver the catalog already states — the same phrasing fundCatalog.test.ts enforces', () => {
    const waived = FUND_CATALOG.filter((f) => /waiver/i.test(f.description ?? ''))
    expect(waived.length).toBeGreaterThan(0)
    for (const f of waived) {
      expect(STATED_GROSS.test(f.description ?? ''), f.symbol).toBe(true)
      const gross = Number(STATED_GROSS.exec(f.description ?? '')?.[1])
      expect(grossStatement(parsed.get(f.symbol), gross), f.symbol).toBe('stated')
      expect(f.expenseRatioPct, `${f.symbol} records less than its gross`).toBeLessThan(gross)
    }
  })
})
