import { describe, expect, it } from 'vitest'
import { computeSignalSummary } from '../indicators'
import type { OhlcvCandle } from '../indicators'

/**
 * E-note-6 (P3 production review) — correctness of the SIGNAL AGGREGATION.
 *
 * computeSignalSummary runs ~25 indicators and then folds their verdicts into
 * one score, three counts and an overall band. Hand-computing all 25 indicator
 * values would be brittle and would test the indicator library, not the fold.
 * What is worth pinning is the fold itself, and the way to pin it honestly is
 * to recompute the reported numbers FROM the signal list the same call
 * produced. A miscount, a wrong denominator, or an off-by-one band boundary all
 * fail here; a change to how RSI is calculated correctly does not.
 */

const WEIGHT: Record<string, number> = {
  strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2,
}

/** ≥200 bars so EMA200 — the longest lookback in the panel — actually reports. */
function series(priceAt: (i: number) => number, n = 260): OhlcvCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = priceAt(i)
    const prev = i === 0 ? close : priceAt(i - 1)
    return {
      time: 1_700_000_000 + i * 86_400,
      open: prev,
      high: Math.max(prev, close) * 1.01,
      low: Math.min(prev, close) * 0.99,
      close,
      volume: 1_000_000 + (i % 7) * 50_000,
    }
  })
}

// A clean 0.5%/bar advance with a small ripple, so the indicators see a real
// uptrend rather than a straight line (several of them are undefined on a
// perfectly flat series).
const uptrend = series(i => 100 * Math.pow(1.005, i) * (1 + 0.004 * Math.sin(i / 3)))
const downtrend = series(i => 100 * Math.pow(0.995, i) * (1 + 0.004 * Math.sin(i / 3)))

describe('computeSignalSummary — vote aggregation', () => {
  for (const [name, candles] of [['uptrend', uptrend], ['downtrend', downtrend]] as const) {
    describe(name, () => {
      const s = computeSignalSummary(candles)

      it('produces a full indicator panel', () => {
        expect(s.signals.length).toBeGreaterThan(15)
      })

      it('partitions every signal into exactly one of buy / neutral / sell', () => {
        expect(s.buy + s.neutral + s.sell).toBe(s.signals.length)
      })

      it('counts buy and sell as their strong variants folded in', () => {
        const buy = s.signals.filter(x => x.signal === 'buy' || x.signal === 'strong_buy').length
        const sell = s.signals.filter(x => x.signal === 'sell' || x.signal === 'strong_sell').length
        const neutral = s.signals.filter(x => x.signal === 'neutral').length
        expect(s.buy).toBe(buy)
        expect(s.sell).toBe(sell)
        expect(s.neutral).toBe(neutral)
      })

      it('scores as the weighted mean over NON-NEUTRAL votes only', () => {
        // The denominator is the decisive votes, not all of them. That is the
        // load-bearing choice: a panel of 20 neutrals and one strong_buy reads
        // strong_buy, rather than being diluted to 0.095 and reported neutral.
        const total = s.signals.reduce((acc, x) => acc + WEIGHT[x.signal], 0)
        const decisive = Math.max(s.signals.filter(x => x.signal !== 'neutral').length, 1)
        expect(s.score).toBeCloseTo(total / decisive, 10)
      })

      it('keeps the score inside the -2..+2 range the type documents', () => {
        expect(s.score).toBeGreaterThanOrEqual(-2)
        expect(s.score).toBeLessThanOrEqual(2)
      })

      it('reports an overall verdict consistent with its own bands', () => {
        const expected =
          s.score >= 1.5 ? 'strong_buy' :
          s.score >= 0.5 ? 'buy' :
          s.score <= -1.5 ? 'strong_sell' :
          s.score <= -0.5 ? 'sell' : 'neutral'
        expect(s.overall).toBe(expected)
      })

      it('emits no NaN into a rendered figure', () => {
        // `description` is printed verbatim on both TA pages; a NaN there is a
        // shipped bug, not an internal one.
        for (const sig of s.signals) {
          expect(Number.isNaN(sig.value)).toBe(false)
          expect(sig.description).not.toContain('NaN')
        }
      })
    })
  }

  it('leans bullish on a sustained advance and bearish on a sustained decline', () => {
    const up = computeSignalSummary(uptrend)
    const down = computeSignalSummary(downtrend)

    expect(up.score).toBeGreaterThan(0)
    expect(up.buy).toBeGreaterThan(up.sell)
    expect(['strong_sell', 'sell']).not.toContain(up.overall)

    expect(down.score).toBeLessThan(0)
    expect(down.sell).toBeGreaterThan(down.buy)
    expect(['strong_buy', 'buy']).not.toContain(down.overall)
  })

  it('documents why a relentless advance still reports "neutral" overall', () => {
    // This is the panel behaving correctly, not a bug, and it is worth pinning
    // because it looks wrong at a glance. On a 0.5%/bar climb the panel splits:
    // the TREND indicators (EMA 50, ADX, Aroon, SAR, Vortex, Elder Ray) say buy,
    // while the MEAN-REVERSION oscillators (RSI, Williams %R, MFI, Stochastic,
    // Connors RSI) correctly say overbought. 15 buys against 7 sells averages to
    // ~0.36 — inside the ±0.5 neutral band.
    //
    // So "neutral" here means "the indicators disagree", not "nothing is
    // happening", and the buy/sell counts rendered beside it are what carry that.
    // Anyone tempted to widen the bands so a chart like this reads strong_buy
    // should note that doing so would suppress the overbought half of a real
    // disagreement.
    const up = computeSignalSummary(uptrend)
    expect(up.overall).toBe('neutral')
    expect(up.buy).toBeGreaterThan(up.sell)
    expect(up.score).toBeGreaterThan(0)
    expect(up.score).toBeLessThan(0.5)
  })

  it('is directionally symmetric — mirroring the series flips the verdict', () => {
    const up = computeSignalSummary(uptrend)
    const down = computeSignalSummary(downtrend)
    expect(Math.sign(up.score)).toBe(-Math.sign(down.score))
  })

  it('does not let a flat series report conviction', () => {
    // A motionless price has no trend to read. Historically Elder Ray's
    // floating-point residue reported strong_sell here; the epsilon guard in
    // computeSignalSummary is what this pins.
    const flat = series(() => 100)
    const s = computeSignalSummary(flat)
    expect(s.overall).toBe('neutral')
    expect(Math.abs(s.score)).toBeLessThan(0.5)
  })
})
