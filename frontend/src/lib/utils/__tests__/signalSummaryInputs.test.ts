import { describe, expect, it } from 'vitest'
import { computeSignalSummary, SIGNALS_FROM_CLOSES, type OhlcvCandle } from '../indicators'

// Which signal-summary votes read only closing prices, MEASURED (2026-10-13,
// T-423, D103).
//
// The crypto scanner and the multi-timeframe grid read DefiLlama's closing
// prices: open, high and low are the close, and volume is 0. A vote that reads a
// range or a volume still votes on that, without any error. So on closes the
// summary counts only SIGNALS_FROM_CLOSES, and that set is held to a measurement:
// compute every vote on a varied series, then again with the ranges pinned to the
// close or the volume zeroed, at many end points, and see which votes moved.

const N = 400
const real: OhlcvCandle[] = Array.from({ length: N }, (_, i) => {
  const close = 100 + 10 * Math.sin(i / 7) + 4 * Math.sin(i / 2.3) + i * 0.1
  return {
    time: 1_700_000_000 + i * 86_400,
    open: close - 1 + Math.cos(i),
    high: close + 2 + Math.sin(i / 3),
    low: close - 2 - Math.cos(i / 5),
    close,
    volume: 1000 + 200 * Math.sin(i / 4) + 150 * Math.cos(i / 1.7),
  }
})
const noRange = real.map((c) => ({ ...c, open: c.close, high: c.close, low: c.close }))
const noVolume = real.map((c) => ({ ...c, volume: 0 }))

// Every end point from where all the votes exist (EMA 200, Connors RSI 100) to the last bar.
const ENDS = Array.from({ length: N - 220 }, (_, k) => 220 + k + 1)

const votes = (series: OhlcvCandle[], end: number) =>
  new Map(computeSignalSummary(series.slice(0, end)).signals.map((s) => [s.name, `${s.value}|${s.signal}`]))

const allNames = [...votes(real, N).keys()]

/** Names of votes that differ, or vanish, at any end point when `altered` replaces the real series. */
function moved(altered: OhlcvCandle[]): Set<string> {
  const out = new Set<string>()
  for (const end of ENDS) {
    const a = votes(real, end)
    const b = votes(altered, end)
    for (const name of allNames) if (a.get(name) !== b.get(name)) out.add(name)
  }
  return out
}

const readsRange = moved(noRange)
const readsVolume = moved(noVolume)

describe('SIGNALS_FROM_CLOSES is the set of votes that read closes alone', () => {
  it('names only votes the summary actually casts', () => {
    // A renamed vote would otherwise drop out of the closes summary in silence.
    for (const name of SIGNALS_FROM_CLOSES) expect(allNames, name).toContain(name)
  })

  it('matches the measurement exactly', () => {
    const fromCloses = allNames.filter((n) => !readsRange.has(n) && !readsVolume.has(n)).sort()
    expect([...SIGNALS_FROM_CLOSES].sort()).toEqual(fromCloses)
  })

  it('measured something on both sides', () => {
    // Guards the measurement itself: a series too smooth to move any vote would
    // call every vote closes-only and pass the test above.
    expect(readsRange.size).toBeGreaterThan(0)
    expect(readsVolume.size).toBeGreaterThan(0)
  })
})

describe("computeSignalSummary(candles, 'close')", () => {
  it('counts only the closes-only votes, and gives the same verdict on closes as on candles', () => {
    for (const end of [260, 330, N]) {
      const onCandles = computeSignalSummary(real.slice(0, end), 'close')
      const onCloses = computeSignalSummary(noRange.slice(0, end).map((c) => ({ ...c, volume: 0 })), 'close')
      expect(onCandles.signals.map((s) => s.name).every((n) => SIGNALS_FROM_CLOSES.has(n))).toBe(true)
      expect(onCloses).toEqual(onCandles)
    }
  })

  it('leaves the default (every vote) unchanged', () => {
    const full = computeSignalSummary(real)
    expect(full.signals.length).toBe(allNames.length)
    expect(full.signals.length).toBeGreaterThan(SIGNALS_FROM_CLOSES.size)
  })

  it('recounts the tallies over the votes it keeps', () => {
    const s = computeSignalSummary(real, 'close')
    expect(s.buy + s.neutral + s.sell).toBe(s.signals.length)
  })
})
