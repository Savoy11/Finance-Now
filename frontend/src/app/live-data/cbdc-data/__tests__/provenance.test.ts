import { describe, expect, it } from 'vitest'
import {
  CBDC_FALLBACK_COMPILED,
  CBDC_FALLBACK_STALE_AFTER_DAYS,
  cbdcFallbackAgeDays,
  cbdcFallbackIsStale,
  getCbdcFallbackProvenance,
} from '../route'

const compiled = new Date(`${CBDC_FALLBACK_COMPILED}T00:00:00Z`)
const plusDays = (n: number) => new Date(compiled.getTime() + n * 86_400_000)

describe('CBDC fallback provenance', () => {
  it('ages from the compile date, not the request time', () => {
    expect(cbdcFallbackAgeDays(compiled)).toBe(0)
    expect(cbdcFallbackAgeDays(plusDays(45))).toBe(45)
  })

  it('never reports a negative age for a clock behind the compile date', () => {
    expect(cbdcFallbackAgeDays(plusDays(-10))).toBe(0)
  })

  it('goes stale strictly past the window, not on it', () => {
    expect(cbdcFallbackIsStale(plusDays(CBDC_FALLBACK_STALE_AFTER_DAYS))).toBe(false)
    expect(cbdcFallbackIsStale(plusDays(CBDC_FALLBACK_STALE_AFTER_DAYS + 1))).toBe(true)
  })

  it('reports the compile date as verifiedAt — never "now"', () => {
    const p = getCbdcFallbackProvenance(plusDays(400))
    expect(p.verifiedAt).toBe(CBDC_FALLBACK_COMPILED)
    expect(p.ageDays).toBe(400)
    expect(p.stale).toBe(true)
  })

  it('never claims high confidence — the notes are pinned to 2023-2024', () => {
    expect(getCbdcFallbackProvenance(compiled).confidence).toBe('medium')
    expect(getCbdcFallbackProvenance(plusDays(400)).confidence).toBe('low')
  })
})
