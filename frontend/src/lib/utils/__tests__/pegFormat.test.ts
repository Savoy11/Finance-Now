import { describe, expect, it } from 'vitest'
import { getPegDeviationColorClass, PEG_TIGHT_BPS, PEG_LOOSE_BPS } from '../pegFormat'

describe('getPegDeviationColorClass', () => {
  it('mutes an unknown deviation — "we don\'t know" must not read as "healthy"', () => {
    expect(getPegDeviationColorClass(null)).toBe('text-text-muted')
  })

  it('bands on absolute drift, in either direction', () => {
    expect(getPegDeviationColorClass(0)).toBe('text-emerald-400')
    expect(getPegDeviationColorClass(-5)).toBe('text-emerald-400')
    expect(getPegDeviationColorClass(25)).toBe('text-amber-400')
    expect(getPegDeviationColorClass(-25)).toBe('text-amber-400')
    expect(getPegDeviationColorClass(120)).toBe('text-red-400')
    expect(getPegDeviationColorClass(-120)).toBe('text-red-400')
  })

  it('steps exactly on the thresholds, not around them', () => {
    expect(getPegDeviationColorClass(PEG_TIGHT_BPS - 1)).toBe('text-emerald-400')
    expect(getPegDeviationColorClass(PEG_TIGHT_BPS)).toBe('text-amber-400')
    expect(getPegDeviationColorClass(PEG_LOOSE_BPS - 1)).toBe('text-amber-400')
    expect(getPegDeviationColorClass(PEG_LOOSE_BPS)).toBe('text-red-400')
  })
})
