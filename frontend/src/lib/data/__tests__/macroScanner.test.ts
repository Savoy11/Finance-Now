import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CURVE_YIELD_INSTRUMENTS, MACRO_INSTRUMENTS, SCANNER_INSTRUMENTS,
} from '@/app/(dashboard)/macro/macroInstruments'
import { RATES_CATALOG } from '../ratesCatalog'

// T-129 D (owner, 2026-10-24): the Macro Scanner runs when asked, as the Equity
// Scanner does, and never asks for the Treasury yields, which no provider sends
// any history for (D3).
describe('Macro Scanner universe and trigger', () => {
  it('sweeps no Treasury yield, and lists every one apart', () => {
    const yields = RATES_CATALOG.filter((r) => r.quoteBasis === 'pct').map((r) => r.symbol)
    expect(yields.length).toBeGreaterThan(0)
    expect(CURVE_YIELD_INSTRUMENTS.map((m) => m.symbol)).toEqual(yields)
    expect(SCANNER_INSTRUMENTS.filter((m) => yields.includes(m.symbol))).toEqual([])
  })

  it('still sweeps every liquid instrument that has a candle source', () => {
    const expected = MACRO_INSTRUMENTS.filter((m) => m.liquid && !m.curveYield).map((m) => m.symbol)
    expect(SCANNER_INSTRUMENTS.map((m) => m.symbol)).toEqual(expected)
    // The bond futures have history and stay in.
    expect(SCANNER_INSTRUMENTS.map((m) => m.symbol)).toContain('ZN=F')
  })

  it('fetches nothing until Run scan, and not again on focus', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/macro/scanner/page.tsx'), 'utf8')
    expect(page).toContain('enabled: hasRun')
    expect(page).toContain('refetchOnWindowFocus: false')
    expect(page).toMatch(/useState\(false\)[\s\S]*hasRun/)
    expect(page).toContain("'Run scan'")
  })
})
