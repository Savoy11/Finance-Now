import { describe, it, expect } from 'vitest'
import {
  halvingPosition, drawdownComparison, growthFromLows, growthScaleDecades, growthBarPct, formatMultiple,
  rotationRead, piCycleState, CYCLE_COPY,
} from '../cycleMetrics'
import {
  CYCLE_HISTORY, cycleHistoryAgeDays, cycleHistoryIsStale, getCycleHistoryProvenance, peakLabel, troughLabel,
} from '@/lib/data/cycleHistory'

describe('halvingPosition', () => {
  it('measures months since the 2024 halving with an injected clock', () => {
    const p = halvingPosition('2024-04-20', new Date('2025-10-20T00:00:00Z'))
    expect(p.monthsSince).toBeGreaterThan(17.5)
    expect(p.monthsSince).toBeLessThan(18.5)
  })

  it('clamps the nominal-cycle position to 100 after 48 months', () => {
    const p = halvingPosition('2024-04-20', new Date('2030-01-01T00:00:00Z'))
    expect(p.pctThroughNominalCycle).toBe(100)
  })

  it('derives the historical peak window from COMPLETED cycles only', () => {
    // The open 2024 cycle must not feed its own statistics back to the reader
    // as history — and genesis (null months) must not produce a NaN bound.
    const p = halvingPosition('2024-04-20', new Date('2026-08-29T00:00:00Z'))
    expect(p.historicalPeakWindowMonths).toEqual([12, 18])
    expect(p.historicalPeakWindowMonths.every(Number.isFinite)).toBe(true)
  })
})

describe('drawdownComparison', () => {
  it('appends a live row only when a real value exists', () => {
    expect(drawdownComparison(null).some(r => r.label === 'BTC now')).toBe(false)
    const rows = drawdownComparison(-52.3)
    const live = rows.find(r => r.label === 'BTC now')!
    expect(live.drawdownPct).toBe(-52.3)
    expect(live.open).toBe(true)
  })

  it('never renders a positive live drawdown', () => {
    // At a fresh all-time high athChangePct can read slightly positive from
    // rounding; the distance below the high is then zero, not a gain.
    const live = drawdownComparison(0.4).find(r => r.label === 'BTC now')!
    expect(live.drawdownPct).toBe(0)
  })

  it('marks exactly the open cycle rows as open', () => {
    const rows = drawdownComparison(null)
    expect(rows.filter(r => r.open)).toHaveLength(1)
    expect(rows.find(r => r.open)!.label).toContain('2024')
  })
})

describe('vocabulary guard', () => {
  it('panel copy never uses advice or verdict wording', () => {
    // Same enforcement as assetClassProfiles: this panel explains, it never
    // recommends. "buy zone", "accumulation zone", "top is in" are the shapes
    // the RP-3 / item-4 line exists to keep out.
    const forbidden = /\b(should|recommend|buy|sell|accumulate|accumulation zone|top is in|bottom is in|bullish|bearish|undervalued|overvalued|opportunity)\b/i
    for (const [key, text] of Object.entries(CYCLE_COPY)) {
      expect(text, `advice wording in CYCLE_COPY.${key}`).not.toMatch(forbidden)
    }
    for (const c of CYCLE_HISTORY) {
      expect(c.note, `advice wording in cycle note ${c.halving}`).not.toMatch(forbidden)
    }
  })
})

describe('cycle history rows', () => {
  it('each drawdown matches its own peak and trough to within a point', () => {
    // The table prints the prices and the drawdown chart reads maxDrawdownPct,
    // so editing one without the other shows two different falls for one
    // cycle. The prices are rounded (~$), hence a point of slack.
    for (const c of CYCLE_HISTORY) {
      const fromPrices = (c.troughUsd / c.peakUsd - 1) * 100
      expect(Math.abs(fromPrices - c.maxDrawdownPct), `${c.halving} cycle`).toBeLessThanOrEqual(1)
    }
  })

  it('prints its labels from the numbers, and marks only the open low "so far"', () => {
    expect(peakLabel(CYCLE_HISTORY[1])).toBe('Nov 2013 · ~$1,150')
    expect(troughLabel(CYCLE_HISTORY[1])).toBe('Jan 2015 · ~$170')
    for (const c of CYCLE_HISTORY) {
      expect(troughLabel(c).endsWith('(so far)'), `${c.halving} cycle`).toBe(!!c.open)
    }
  })
})

describe('growthFromLows', () => {
  it('pairs each cycle’s low with the next cycle’s high, from the table itself', () => {
    const rows = growthFromLows(null)
    expect(rows).toHaveLength(CYCLE_HISTORY.length - 1)
    rows.forEach((r, i) => {
      expect(r.multiple).toBeCloseTo(CYCLE_HISTORY[i + 1].peakUsd / CYCLE_HISTORY[i].troughUsd)
      expect(r.live).toBe(false)
    })
    expect(rows.map((r) => r.label)).toEqual(['2011 → 2013', '2015 → 2017', '2018 → 2021', '2022 → 2025'])
  })

  it('appends the live row only when a real price exists', () => {
    for (const price of [null, NaN, 0, -1]) {
      expect(growthFromLows(price).some((r) => r.live)).toBe(false)
    }
    const live = growthFromLows(85_100).at(-1)!
    expect(live.live).toBe(true)
    expect(live.label).toBe('2026 → now')
    expect(live.multiple).toBeCloseTo(85_100 / 57_700)
  })
})

describe('growth chart scale', () => {
  it('spans enough powers of ten for the largest rise, and never fewer than one', () => {
    expect(growthScaleDecades(growthFromLows(null))).toBe(3) // 575× needs a 1,000× mark
    expect(growthScaleDecades([])).toBe(1)
  })

  it('measures bars from 1×, so a bar’s length counts tenfold rises', () => {
    expect(growthBarPct(1, 3)).toBe(0)
    expect(growthBarPct(10, 3)).toBeCloseTo(100 / 3)
    expect(growthBarPct(1_000, 3)).toBe(100)
    expect(growthBarPct(5_000, 3)).toBe(100)
  })

  it('draws no bar below the low rather than a negative one', () => {
    expect(growthBarPct(0.9, 3)).toBe(0)
    expect(growthBarPct(NaN, 3)).toBe(0)
  })

  it('formats whole multiples from 10× up and one decimal below', () => {
    expect(formatMultiple(575)).toBe('575×')
    expect(formatMultiple(115.88)).toBe('116×')
    expect(formatMultiple(1_250)).toBe('1,250×')
    expect(formatMultiple(8.14)).toBe('8.1×')
    expect(formatMultiple(9.96)).toBe('10×')
    expect(formatMultiple(0.94)).toBe('0.9×')
  })
})

describe('cycle history provenance', () => {
  it('reports age and staleness from an injected now', () => {
    expect(cycleHistoryAgeDays(new Date('2026-08-30T12:00:00Z'))).toBe(1)
    expect(cycleHistoryIsStale(new Date('2026-09-30T00:00:00Z'))).toBe(false)
    expect(cycleHistoryIsStale(new Date('2027-06-01T00:00:00Z'))).toBe(true)
  })

  it('provenance names its source and carries the whole-table date', () => {
    const p = getCycleHistoryProvenance(new Date('2026-08-30T00:00:00Z'))
    expect(p.verifiedAt).toBe('2026-08-29')
    expect(p.source.toLowerCase()).toContain('hand-compiled')
    expect(p.stale).toBe(false)
  })
})

describe('rotationRead (30-day variant)', () => {
  const row = (id: string, over: Partial<import('../cycleMetrics').RotationInput> = {}) => ({
    id, marketCapRank: 10, priceChange30d: 5, isStablecoin: false, ...over,
  })
  const universe = (n: number, change: number) => [
    row('btc', { marketCapRank: 1, priceChange30d: 0 }),
    ...Array.from({ length: n }, (_, i) => row(`alt${i}`, { marketCapRank: i + 2, priceChange30d: change })),
  ]

  it('reads 100% when every eligible coin beats BTC, 0% when none do', () => {
    expect(rotationRead(universe(20, 10))!.pctOutperformingBtc).toBe(100)
    expect(rotationRead(universe(20, -10))!.pctOutperformingBtc).toBe(0)
  })

  it('returns null without BTC — there is nothing to outperform', () => {
    const rows = universe(20, 10).filter((r) => r.id !== 'btc')
    expect(rotationRead(rows)).toBeNull()
  })

  it('returns null under 10 eligible coins rather than a percentage over noise', () => {
    expect(rotationRead(universe(9, 10))).toBeNull()
    expect(rotationRead(universe(10, 10))).not.toBeNull()
  })

  it('excludes stablecoins and out-of-rank coins from the denominator', () => {
    const rows = [
      ...universe(10, 10),
      row('usdt', { isStablecoin: true, priceChange30d: 0.1 }),
      row('tiny', { marketCapRank: 300, priceChange30d: 400 }),
    ]
    const r = rotationRead(rows)!
    expect(r.eligible).toBe(10)
    expect(r.pctOutperformingBtc).toBe(100)
  })

  it('counts missing 30d data as untested, never as underperformance', () => {
    const rows = [...universe(12, 10), row('gap1', { priceChange30d: null }), row('gap2', { priceChange30d: null })]
    const r = rotationRead(rows)!
    expect(r.eligible).toBe(12)
    expect(r.untested).toBe(2)
    // The two gaps did not drag the percentage down.
    expect(r.pctOutperformingBtc).toBe(100)
  })

  it('ties do not count as outperformance', () => {
    const rows = [row('btc', { marketCapRank: 1, priceChange30d: 5 }), ...Array.from({ length: 12 }, (_, i) => row(`alt${i}`, { marketCapRank: i + 2, priceChange30d: 5 }))]
    expect(rotationRead(rows)!.pctOutperformingBtc).toBe(0)
  })
})

describe('piCycleState', () => {
  it('returns null under 350 daily closes — no padded-tail average', () => {
    expect(piCycleState(Array(349).fill(100))).toBeNull()
    expect(piCycleState(Array(350).fill(100))).not.toBeNull()
  })

  it('reads uncrossed on a flat series (111DMA = half of 2×350DMA)', () => {
    const s = piCycleState(Array(400).fill(100))!
    expect(s.ma111).toBeCloseTo(100)
    expect(s.ma350x2).toBeCloseTo(200)
    expect(s.crossed).toBe(false)
    expect(s.gapPct).toBe(-50)
  })

  it('detects the cross when recent price runs far enough above the long base', () => {
    // 350 days at 100, then 111 days at 250: ma111=250, 2*ma350≈2*(147.6)=295 → not crossed.
    // Push recent to 350: ma111=350, 2*ma350≈2*(179.3)=358.6 → still short. At 400: 2*195.2=390.4 < 400 → crossed.
    const series = (recent: number) => [...Array(350).fill(100), ...Array(111).fill(recent)]
    expect(piCycleState(series(250))!.crossed).toBe(false)
    expect(piCycleState(series(400))!.crossed).toBe(true)
  })

  it('ignores non-finite and non-positive closes rather than averaging them', () => {
    const dirty = [...Array(360).fill(100), NaN, 0, -5, Infinity]
    const s = piCycleState(dirty)!
    expect(s.daysOfHistory).toBe(360)
    expect(s.ma111).toBeCloseTo(100)
  })
})
