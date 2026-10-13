import { describe, expect, it } from 'vitest'
import { ALL_INDICATORS, INDICATOR_RENDER, indicatorsFor, NOT_FROM_CLOSES, type IndicatorMeta } from '../indicatorRegistry'

// What each indicator reads, MEASURED (2026-10-13, T-423, D103).
//
// The crypto charts now draw DefiLlama's closing prices where CoinGecko has no
// candles, and those carry one price per period: open, high and low are the
// close, and volume is 0. An indicator that reads a range or a volume still
// renders on that, as a flat or invented series, without any error. So which
// indicators may be offered is decided by these flags, and the flags are held to
// a measurement: render each indicator on a varied series, then again with the
// ranges pinned to the close or the volume zeroed, and see whether it moved.

const N = 300
const real = Array.from({ length: N }, (_, i) => {
  const close = 100 + 10 * Math.sin(i / 7) + i * 0.1
  return {
    time: 1_700_000_000 + i * 86_400,
    open: close - 1 + Math.cos(i),
    high: close + 2 + Math.sin(i / 3),
    low: close - 2 - Math.cos(i / 5),
    close,
    volume: 1000 + 200 * Math.sin(i / 4),
  }
})
const closes = real.map((c) => c.close)
const noRange = real.map((c) => ({ ...c, open: c.close, high: c.close, low: c.close }))
const noVolume = real.map((c) => ({ ...c, volume: 0 }))

const drawn = (spec: ReturnType<(typeof INDICATOR_RENDER)[string]>) =>
  JSON.stringify([...(spec.lines ?? []).map((l) => l.data), ...(spec.histograms ?? []).map((h) => h.data)])

const reads = (key: string, altered: typeof real) =>
  drawn(INDICATOR_RENDER[key](altered, closes)) !== drawn(INDICATOR_RENDER[key](real, closes))

const meta: readonly IndicatorMeta[] = ALL_INDICATORS

describe('indicator input flags match what each indicator actually reads', () => {
  it('describes exactly the indicators the engine can draw', () => {
    expect(meta.map((i) => i.key).sort()).toEqual(Object.keys(INDICATOR_RENDER).sort())
  })

  it.each(meta.map((i) => [i.key, i] as const))('%s', (key, m) => {
    expect(!!m.needsRange, `${key} needsRange`).toBe(reads(key, noRange))
    expect(!!m.needsVolume, `${key} needsVolume`).toBe(reads(key, noVolume))
  })

  it('offers a series of closing prices only what reads closes alone', () => {
    const offered = indicatorsFor(false, false)
    for (const i of offered) {
      expect(reads(i.key, noRange) || reads(i.key, noVolume), i.key).toBe(false)
    }
    expect(offered.length + NOT_FROM_CLOSES.length).toBe(meta.length)
  })
})
