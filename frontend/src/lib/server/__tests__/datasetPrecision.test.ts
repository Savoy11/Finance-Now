import { describe, expect, it } from 'vitest'
import { precisionCut, storedDecimals, withinStoredPrecision } from '../../../../scripts/lib/datasetPrecision.mjs'

// The SEC Risk/Return data set stores four decimal places while declaring the filing's own
// precision (T-417, 2026-10-14). These hold the rule that tells its cut from a fee change.

describe('the data set’s stored precision', () => {
  it('counts the decimal places a stored value carries', () => {
    expect(storedDecimals('0.0001')).toBe(4)
    expect(storedDecimals('0.0039')).toBe(4)
    expect(storedDecimals('1')).toBe(0)
    expect(storedDecimals('')).toBe(0)
  })

  it('calls a value cut only when the filing declared more places than were kept', () => {
    expect(precisionCut('0.0001', '6')).toBe(true) // FXAIX, measured 2026-10-14
    expect(precisionCut('0.0039', '4')).toBe(false) // iShares rows: declared four, kept four
    expect(precisionCut('0.0066', 'INF')).toBe(false) // exact as filed
    expect(precisionCut('0.0001', '')).toBe(false)
    expect(precisionCut('0.0001', undefined)).toBe(false)
  })
})

describe('a difference the cut can explain', () => {
  it('FXAIX: 0.015% in the catalog against a stored 0.0001 at six declared places', () => {
    expect(withinStoredPrecision(0.015, 0.01, '0.0001', '6', 100)).toBe(true)
  })

  it('a 0.035% fee stored as 0.0003', () => {
    expect(withinStoredPrecision(0.035, 0.03, '0.0003', '6', 100)).toBe(true)
  })

  it('never hides a real fee change of a hundredth of a percent', () => {
    // 0.40 against 0.39 differs by exactly one stored unit: a change, not a cut.
    expect(withinStoredPrecision(0.4, 0.39, '0.0039', '6', 100)).toBe(false)
    expect(withinStoredPrecision(0.04, 0.03, '0.0003', '6', 100)).toBe(false)
    expect(withinStoredPrecision(0.41, 0.39, '0.0039', '6', 100)).toBe(false)
  })

  it('needs the cut: the same small difference on a row kept at its declared precision is real', () => {
    expect(withinStoredPrecision(0.015, 0.01, '0.0001', '4', 100)).toBe(false)
    expect(withinStoredPrecision(0.015, 0.01, '0.0001', 'INF', 100)).toBe(false)
  })

  it('a match is not a difference, and a missing figure is not one either', () => {
    expect(withinStoredPrecision(0.01, 0.01, '0.0001', '6', 100)).toBe(false)
    expect(withinStoredPrecision(null, 0.01, '0.0001', '6', 100)).toBe(false)
    expect(withinStoredPrecision(0.015, null, '0.0001', '6', 100)).toBe(false)
  })

  it('works for a data set already in percent', () => {
    // A `percent` value of "0.01" carries two places; one unit is 0.01 percentage points.
    expect(withinStoredPrecision(0.015, 0.01, '0.01', '3', 1)).toBe(true)
    expect(withinStoredPrecision(0.02, 0.01, '0.01', '3', 1)).toBe(false)
  })
})
