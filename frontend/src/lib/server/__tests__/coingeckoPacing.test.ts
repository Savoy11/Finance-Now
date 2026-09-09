import { describe, it, expect } from 'vitest'
// Plain .mjs helper shared with the audit harness — imported directly so the
// tested code IS the code that runs, not a copy of it.
import { createCoinGeckoPacer } from '../../../../scripts/lib/coingeckoPacing.mjs'

/**
 * Guards scripts/test-live-data.mjs's self-throttling.
 *
 * This is not incidental: on 2026-09-09 the audit reported `coin-discovery`,
 * `alerts` and `portfolio-history` as broken across three separate owner-machine
 * runs, and every time it was the harness exceeding CoinGecko's keyless limit
 * itself. Two pacing models shipped looking correct before this one, so the
 * model is pinned here rather than re-derived from the next failing run.
 */

/** Fake clock — pacer never really sleeps, so the whole window is exercised instantly. */
function fakeClock() {
  let t = 1_000_000
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms },
    advance: (ms: number) => { t += ms },
    at: () => t,
  }
}

const OPTS = { minGapMs: 1_800, windowMs: 60_000, maxPerWindow: 8 }

describe('CoinGecko audit pacing', () => {
  it('spaces consecutive calls by the minimum gap', async () => {
    const c = fakeClock()
    const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
    const t0 = c.at()
    await p.pace()
    await p.pace()
    expect(c.at() - t0).toBe(1_800)
  })

  it('still pauses when an unrelated check ran in between — a rate is not adjacency', async () => {
    const c = fakeClock()
    const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
    await p.pace()
    c.advance(300)          // a non-CoinGecko route runs (e.g. risk-scores before alerts)
    const before = c.at()
    await p.pace()
    // The old adjacency model gave this one NO pause at all, and `alerts` 429'd.
    expect(c.at() - before).toBe(1_500)
  })

  it('charges a multi-page check its real number of upstream calls', async () => {
    const c = fakeClock()
    const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
    await p.pace(3)         // coin-list: three pages inside one check
    expect(p.windowLoad).toBe(3)
  })

  it('never lets the window exceed the cap, even when a weighted check straddles it', async () => {
    const c = fakeClock()
    const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
    for (let i = 0; i < 7; i++) await p.pace()
    expect(p.windowLoad).toBe(7)
    await p.pace(3)         // would reach 10 — must wait for room first
    expect(p.windowLoad).toBeLessThanOrEqual(OPTS.maxPerWindow)
  })

  it("replays the failing run's order and throttles where the old model did not", async () => {
    // The exact CoinGecko-backed sequence from the 2026-09-09 run, in order.
    // coin-discovery is the check that 429'd, and coin-list is the one that
    // actually spent the budget: three pages booked as a single call.
    const NAMES = ['markets', 'ohlcv-btc', 'ohlcv-xrp', 'ohlcv-eth',
                   'chart', 'coin-list', 'coin-search', 'coin-discovery']
    const MIN_GAPS_ONLY = (NAMES.length - 1) * OPTS.minGapMs

    const replay = async (coinListWeight: number) => {
      const c = fakeClock()
      const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
      let peak = 0
      for (const name of NAMES) {
        await p.pace(name === 'coin-list' ? coinListWeight : 1)
        peak = Math.max(peak, p.windowLoad)
      }
      return { pacedMs: p.pacedMs, peak }
    }

    // The model that shipped and still failed: coin-list booked as one call.
    // Eight checks, eight slots, cap of eight — so nothing ever waits on the
    // window, and the run issues TEN upstream requests believing it issued eight.
    const asShipped = await replay(1)
    expect(asShipped.pacedMs).toBe(MIN_GAPS_ONLY)

    // Weighted: the budget sees the real cost, so the window forces a wait
    // before the two checks that follow coin-list — coin-search and the one
    // that took the 429.
    const weighted = await replay(3)
    expect(weighted.peak).toBeLessThanOrEqual(OPTS.maxPerWindow)
    expect(weighted.pacedMs).toBeGreaterThan(MIN_GAPS_ONLY)
  })

  it('reports what it cost, so the delay is never mistaken for slowness', async () => {
    const c = fakeClock()
    const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
    await p.pace()
    await p.pace()
    expect(p.pacedMs).toBe(1_800)
  })

  it('treats a weight below 1 as 1 rather than as free', async () => {
    const c = fakeClock()
    const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
    await p.pace(0)
    expect(p.windowLoad).toBe(1)
  })
})
