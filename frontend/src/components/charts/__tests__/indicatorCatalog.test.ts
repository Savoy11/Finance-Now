import { describe, it, expect } from 'vitest'
import {
  INDICATOR_CATALOG,
  VOLUME_DEPENDENT_KEYS,
  PRICE_ONLY_INDICATORS,
  isVolumeDependent,
} from '../indicatorCatalog'
import { INDICATOR_RENDER } from '../indicatorRegistry'

// The catalog says what the TA pages OFFER; the registry says what can be DRAWN.
// Nothing at runtime couples them — a page maps over the catalog and looks each
// key up in the registry — so an offered-but-unrenderable indicator would show
// as a chip that toggles on and draws nothing. These tests are that coupling.

describe('indicator catalog', () => {
  it('offers no indicator the registry cannot render', () => {
    const missing = INDICATOR_CATALOG
      .map((i) => i.key)
      .filter((key) => typeof INDICATOR_RENDER[key] !== 'function')
    expect(missing).toEqual([])
  })

  it('has no duplicate keys', () => {
    const keys = INDICATOR_CATALOG.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every indicator a label and a non-trivial tip', () => {
    for (const { key, label, tip } of INDICATOR_CATALOG) {
      expect(label, `${key} label`).toBeTruthy()
      // The tip is the only in-product explanation of what the indicator means;
      // a stub would be worse than none because it looks like documentation.
      expect(tip.length, `${key} tip`).toBeGreaterThan(40)
    }
  })

  it('classifies only real volume consumers as volume-dependent', () => {
    // Guards the macro page's exclusion rule. `elderray` and `bop` sound
    // volume-based but are pure OHLC, and wrongly excluding them would strip
    // working indicators from the volume-less pages.
    expect(isVolumeDependent('elderray')).toBe(false)
    expect(isVolumeDependent('bop')).toBe(false)
    // `chaikin` is an EMA spread of the volume-weighted A/D line — transitive.
    expect(isVolumeDependent('chaikin')).toBe(true)
    expect(isVolumeDependent('vwap')).toBe(true)
  })

  it('lists only catalog keys as volume-dependent', () => {
    const keys = new Set<string>(INDICATOR_CATALOG.map((i) => i.key))
    for (const k of VOLUME_DEPENDENT_KEYS) expect(keys.has(k), k).toBe(true)
  })

  it('PRICE_ONLY_INDICATORS is the catalog minus exactly the volume set', () => {
    expect(PRICE_ONLY_INDICATORS.length).toBe(INDICATOR_CATALOG.length - VOLUME_DEPENDENT_KEYS.length)
    expect(PRICE_ONLY_INDICATORS.some((i) => isVolumeDependent(i.key))).toBe(false)
  })
})
