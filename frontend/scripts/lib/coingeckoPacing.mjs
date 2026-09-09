// CoinGecko pacing for the live-data audit — pure, clock-injectable.
//
// Extracted from scripts/test-live-data.mjs so it can be tested. Three
// owner-machine runs on 2026-09-09 each shipped a pacing model that read as
// correct and wasn't, and the symptom every time was a healthy route reported
// as broken. That is worth a test rather than another run.
//
// ── The model, and the two ways it has been wrong ──
//
// 1. ADJACENCY (before 2026-09-09). Paused only when the immediately preceding
//    check also hit CoinGecko, reasoning that "a gap after an unrelated route
//    buys nothing". Backwards: a rate limit is a RATE OVER A WINDOW, and
//    slotting an unrelated route between two CoinGecko calls lowers the
//    CoinGecko rate not at all — it just cancels the pause.
//
// 2. ONE CHECK == ONE CALL (the sliding window that replaced it). Closer, and
//    it did fix `alerts` and `portfolio-history`. But `coin-list` issues THREE
//    upstream page requests inside a single check (250ms apart, in
//    lib/server/coingeckoPages.ts) while the window recorded one, so the run
//    spent three requests of budget it had not accounted for and the next
//    check — `coin-discovery` — took the 429 that belonged to its neighbour.
//
// Hence a WEIGHT per check: how many upstream requests it actually issues.
//
// ⚠ The weight is an upper bound, not a measurement, and deliberately so. A
// check on a fallback ladder (`ohlcv`) may be served by Binance and spend no
// CoinGecko budget at all, and the harness cannot know which rung answered
// until after the request. Over-counting costs the run some seconds;
// under-counting costs it a 429 that reads as a broken route. Those are not
// symmetric, so this errs high on purpose — do not "optimise" it by only
// charging for calls that turned out to be CoinGecko's.

/**
 * The spacing a cap actually implies.
 *
 * ⚠ THE GAP AND THE CAP ARE NOT INDEPENDENT KNOBS, and treating them as two
 * unrelated numbers was the third wrong pacing model. A cap of "10 per 60s" with
 * a 1.8s minimum gap permits ten calls inside EIGHTEEN seconds — a peak of
 * ~33/min — because nothing spreads them across the window. The cap only binds
 * once the calls are already slow, which is exactly when you do not need it.
 *
 * Measured on the 2026-09-09 owner run: seven real CoinGecko requests landed in
 * 19.4s, a peak of 22/min, under a cap the harness reported as 10/min. The
 * seventh was refused. Moving the cap between 8 and 10 barely changed that,
 * which is why two rounds of cap-tuning did not fix `coin-discovery`.
 *
 * So the floor spacing is DERIVED: to average N calls per window, space them
 * window/N apart. Then the cap is what it claims to be, and the sliding window
 * stays as the backstop for bursts a single check makes internally (coin-list
 * fires three pages 250ms apart no matter what the harness does).
 */
export function derivedMinGapMs(windowMs, maxPerWindow) {
  return Math.ceil(windowMs / Math.max(1, maxPerWindow))
}

/**
 * @param {object} opts
 * @param {number} opts.minGapMs      Minimum spacing between CoinGecko calls.
 * @param {number} opts.windowMs      Sliding window the cap applies over.
 * @param {number} opts.maxPerWindow  Most calls allowed inside one window.
 * @param {() => number} [opts.now]   Clock, injectable for tests.
 * @param {(ms: number) => Promise<void>} [opts.sleep]  Delay, injectable.
 */
export function createCoinGeckoPacer({ minGapMs, windowMs, maxPerWindow, now, sleep }) {
  const clock = now ?? (() => Date.now())
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))

  /** Timestamps of upstream calls already issued, oldest first. */
  const calls = []
  let pacedMs = 0

  const dropExpired = () => {
    while (calls.length && clock() - calls[0] > windowMs) calls.shift()
  }

  /**
   * Hold until `weight` more upstream calls fit the budget, then record them.
   * @param {number} [weight] Upstream requests this check will issue.
   */
  async function pace(weight = 1) {
    const w = Math.max(1, Math.floor(weight))

    // Window must have room for the WHOLE check, not just its first request —
    // charging a 3-page check one slot is exactly the bug this replaced.
    dropExpired()
    while (calls.length + w > maxPerWindow && calls.length > 0) {
      const waitMs = windowMs - (clock() - calls[0]) + 250
      if (waitMs > 0) { pacedMs += waitMs; await wait(waitMs) }
      dropExpired()
    }

    // Minimum spacing since the last call, whatever ran in between.
    const last = calls[calls.length - 1]
    if (last != null) {
      const waitMs = minGapMs - (clock() - last)
      if (waitMs > 0) { pacedMs += waitMs; await wait(waitMs) }
    }

    const at = clock()
    for (let i = 0; i < w; i++) calls.push(at)
  }

  return {
    pace,
    get pacedMs() { return pacedMs },
    /** Calls currently inside the window — for assertions, not for callers. */
    get windowLoad() { dropExpired(); return calls.length },
  }
}
