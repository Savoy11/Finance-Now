import { describe, expect, it } from 'vitest'
import { detectSetups, SETUP_INPUTS, SETUPS_FROM_CLOSES, type SetupKey } from '../scanSetups'
import type { OhlcvCandle } from '../indicators'

// What each scanner setup reads, MEASURED (2026-10-13, T-423, D103).
//
// The crypto scanner reads DefiLlama's closing prices, where open, high and low
// are the close and volume is 0. A detector that reads a high or a volume still
// runs on that, without an error: a breakout over the prior closes instead of the
// prior highs, a volume spike that can never fire. So SETUP_INPUTS decides which
// setups run on closes, and it is held to a measurement: run every detector over
// many windows of a varied series, then again with the ranges pinned to the close
// or the volume zeroed, and see which setups fired differently.

// A seeded random walk with changing drift and volatility, so every detector
// fires somewhere. Deterministic: the same series on every run.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(423)
const LENGTH = 3000
const real: OhlcvCandle[] = []
let close = 100
for (let i = 0; i < LENGTH; i++) {
  const regime = Math.floor(i / 150) % 4
  const drift = [0.002, -0.002, 0, 0.0005][regime]
  const vol = [0.02, 0.03, 0.006, 0.015][regime]
  close = close * (1 + drift + vol * (rand() - 0.5) * 2)
  const spread = close * (0.005 + rand() * 0.03)
  real.push({
    time: 1_700_000_000 + i * 86_400,
    open: close * (1 + (rand() - 0.5) * 0.01),
    high: close + spread * rand() + close * 0.002,
    low: close - spread * rand() - close * 0.002,
    close,
    volume: 1000 * (1 + rand()) * (rand() < 0.08 ? 4 : 1),
  })
}
const noRange = real.map((c) => ({ ...c, open: c.close, high: c.close, low: c.close }))
const noVolume = real.map((c) => ({ ...c, volume: 0 }))

const WINDOW = 120
const keysAt = (series: OhlcvCandle[], end: number) =>
  new Set(detectSetups(series.slice(end - WINDOW, end)).map((s) => s.key))

const ALL = Object.keys(SETUP_INPUTS) as SetupKey[]
const fired = new Set<SetupKey>()
const readsRange = new Set<SetupKey>()
const readsVolume = new Set<SetupKey>()
for (let end = WINDOW; end <= LENGTH; end++) {
  const a = keysAt(real, end)
  const r = keysAt(noRange, end)
  const v = keysAt(noVolume, end)
  for (const k of ALL) {
    if (a.has(k)) fired.add(k)
    if (a.has(k) !== r.has(k)) readsRange.add(k)
    if (a.has(k) !== v.has(k)) readsVolume.add(k)
  }
}

describe('setup input flags match what each detector actually reads', () => {
  it('every setup fired at least once on the real series', () => {
    // Otherwise a flag could pass only because its detector never ran.
    expect([...fired].sort()).toEqual([...ALL].sort())
  })

  it.each(ALL)('%s', (key) => {
    expect(!!SETUP_INPUTS[key].needsRange, `${key} needsRange`).toBe(readsRange.has(key))
    expect(!!SETUP_INPUTS[key].needsVolume, `${key} needsVolume`).toBe(readsVolume.has(key))
  })
})

describe("detectSetups(candles, 'close')", () => {
  it('reports only SETUPS_FROM_CLOSES, and the same ones on closes as on candles', () => {
    for (let end = WINDOW; end <= LENGTH; end += 7) {
      const onCandles = detectSetups(real.slice(end - WINDOW, end), 'close')
      const onCloses = detectSetups(noRange.slice(end - WINDOW, end).map((c) => ({ ...c, volume: 0 })), 'close')
      expect(onCandles.every((s) => SETUPS_FROM_CLOSES.includes(s.key))).toBe(true)
      expect(onCloses).toEqual(onCandles)
    }
  })

  it('leaves the default (every setup) unchanged', () => {
    const anyNotFromCloses = (() => {
      for (let end = WINDOW; end <= LENGTH; end++) {
        if (detectSetups(real.slice(end - WINDOW, end)).some((s) => !SETUPS_FROM_CLOSES.includes(s.key))) return true
      }
      return false
    })()
    expect(anyNotFromCloses).toBe(true)
  })
})
