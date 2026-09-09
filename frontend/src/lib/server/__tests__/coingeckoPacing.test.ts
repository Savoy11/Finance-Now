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

/**
 * The cap these tests exercise the MODEL at. Deliberately 8 rather than the
 * shipped default: 8 is where the weighted and unweighted models visibly
 * differ on the failing sequence, which is the property under test. What the
 * shipped default actually permits is pinned separately, below.
 */
const OPTS = { minGapMs: 1_800, windowMs: 60_000, maxPerWindow: 8 }

/** Mirrors AUDIT_CG_PER_MIN's default in scripts/test-live-data.mjs. */
const SHIPPED_CAP = 10

/** The CoinGecko-backed sequence from the 2026-09-09 run that 429'd, in order. */
const FAILING_SEQUENCE: Array<[string, number]> = [
  ['markets', 1], ['ohlcv-btc', 1], ['ohlcv-xrp', 1], ['ohlcv-eth', 1],
  ['chart', 1], ['coin-list', 3], ['coin-search', 1], ['coin-discovery', 1],
]

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
    // coin-discovery is the check that 429'd; coin-list is the one that actually
    // spent the budget — three pages booked as a single call.
    const MIN_GAPS_ONLY = (FAILING_SEQUENCE.length - 1) * OPTS.minGapMs

    const replay = async (coinListWeight: number) => {
      const c = fakeClock()
      const p = createCoinGeckoPacer({ ...OPTS, now: c.now, sleep: c.sleep })
      let peak = 0
      for (const [name] of FAILING_SEQUENCE) {
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

  /**
   * What the SHIPPED default actually buys, stated rather than assumed.
   *
   * The owner set AUDIT_CG_PER_MIN=10 on 2026-09-09 to keep the audit fast,
   * knowing the consequence: the failing sequence weighs exactly 10, so at a cap
   * of 10 nothing is throttled and the harness reissues the pattern that 429'd.
   * The weighting is still correct — it is what makes the budget honest — but at
   * this cap it does not, on its own, prevent a repeat.
   *
   * This is pinned so nobody later reads "we fixed the pacing" and concludes
   * coin-discovery is protected. If it 429s again, the cap is the first number
   * to move, and 8 is the value the evidence supports.
   */
  it('records that the shipped cap does not throttle the failing sequence', async () => {
    const minGapsOnly = (FAILING_SEQUENCE.length - 1) * 1_800

    const run = async (cap: number) => {
      const c = fakeClock()
      const p = createCoinGeckoPacer({
        minGapMs: 1_800, windowMs: 60_000, maxPerWindow: cap, now: c.now, sleep: c.sleep,
      })
      for (const [, w] of FAILING_SEQUENCE) await p.pace(w)
      return p.pacedMs
    }

    // Exactly at the cap, so no wait is ever triggered.
    expect(await run(SHIPPED_CAP)).toBe(minGapsOnly)
    // One lower, and the same sequence is held back — the protection is real,
    // it just sits below where the cap is currently set.
    expect(await run(SHIPPED_CAP - 1)).toBeGreaterThan(minGapsOnly)
  })
})
