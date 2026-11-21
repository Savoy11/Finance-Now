import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CURVE_YIELD_INSTRUMENTS, ECB_PAIR_INSTRUMENTS, KEYED_SCANNER_INSTRUMENTS, MACRO_INSTRUMENTS, SCANNER_INSTRUMENTS,
} from '@/app/(dashboard)/macro/macroInstruments'
import { RATES_CATALOG } from '../ratesCatalog'
import { ECB_PAIRS } from '../fxReference'

// T-129 D (owner, 2026-10-24): the Macro Scanner runs when asked, as the Equity
// Scanner does. The Treasury yields, which no provider sends any history for
// (D3), left it then and came back with T-446 (D202), read from the official curve.
describe('Macro Scanner universe and trigger', () => {
  const page = readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/macro/scanner/page.tsx'), 'utf8')

  it('sweeps the Treasury yields from the official curve, never a provider', () => {
    const yields = RATES_CATALOG.filter((r) => r.quoteBasis === 'pct').map((r) => r.symbol)
    expect(yields.length).toBeGreaterThan(0)
    expect(CURVE_YIELD_INSTRUMENTS.map((m) => m.symbol)).toEqual(yields)
    expect(CURVE_YIELD_INSTRUMENTS.map((m) => m.curveMaturity)).toEqual(['3M', '5Y', '10Y', '30Y'])
    expect(SCANNER_INSTRUMENTS.filter((m) => yields.includes(m.symbol)).map((m) => m.symbol)).toEqual(yields)
    // Mutation: send a curve yield to security-ohlcv, or count its high/low votes, and this fails.
    expect(page).toMatch(/m\.curveMaturity\s*\?\s*fetch\(`\/live-data\/treasury-yield-history/)
    expect(page).toContain("computeSignalSummary(candles, closesOnly(m) ? 'close' : 'ohlc')")
  })

  // T-445 (D203): every pair but the Dollar Index reads the ECB's daily rates, the
  // EM pairs and crosses included, since their reason for leaving (a provider's
  // gappy series) does not apply to rates the ECB publishes every working day.
  it('sweeps every currency pair from the ECB’s daily rates, counting only closing votes', () => {
    expect(ECB_PAIR_INSTRUMENTS.map((m) => m.symbol)).toEqual(ECB_PAIRS.map((p) => p.symbol))
    for (const m of ECB_PAIR_INSTRUMENTS) expect(SCANNER_INSTRUMENTS, m.symbol).toContain(m)
    expect(page).toMatch(/m\.ecbPair\s*\?\s*fetch\(`\/live-data\/fx-pair-history/)
    // Mutation: count an ECB pair or a curve yield as a keyed request and this fails.
    expect(KEYED_SCANNER_INSTRUMENTS.some((m) => m.ecbPair !== null || m.curveMaturity !== null)).toBe(false)
    expect(KEYED_SCANNER_INSTRUMENTS.map((m) => m.symbol)).toContain('DX-Y.NYB')
  })

  it('says on the page what it scans and what it leaves out, with no stale claim that the yields are skipped', () => {
    expect(page).toContain('{KEYED_SCANNER_INSTRUMENTS.length} keyed')
    expect(page).not.toMatch(/are not scanned/)
    expect(MACRO_INSTRUMENTS.filter((m) => !m.liquid).every((m) => m.group === 'Commodities')).toBe(true)
  })

  it('still sweeps every liquid instrument', () => {
    const expected = MACRO_INSTRUMENTS.filter((m) => m.liquid).map((m) => m.symbol)
    expect(SCANNER_INSTRUMENTS.map((m) => m.symbol)).toEqual(expected)
    expect(SCANNER_INSTRUMENTS.map((m) => m.symbol)).toContain('ZN=F')
  })

  it('fetches nothing until Run scan, and not again on focus', () => {
    expect(page).toContain('enabled: hasRun')
    expect(page).toContain('refetchOnWindowFocus: false')
    expect(page).toMatch(/useState\(false\)[\s\S]*hasRun/)
    expect(page).toContain("'Run scan'")
  })
})
