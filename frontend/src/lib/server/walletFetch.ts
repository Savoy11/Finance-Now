import 'server-only'

/**
 * Timeout budget for the wallet balance routes.
 *
 * These routes call public, keyless chain endpoints that go down without
 * notice. With no timeout the request inherits Node's default socket
 * behaviour, so an unreachable upstream held the response for ~10 s in the
 * 2026-07-27 app audit and can hold it far longer than that — the page just
 * spins. A wallet balance is worth waiting a few seconds for and no more:
 * failing fast with the route's structured error envelope lets the UI say
 * "couldn't reach the chain" instead of hanging.
 */
export const WALLET_FETCH_TIMEOUT_MS = 5_000

/**
 * Ceiling for a whole fallback LADDER, however many rungs it has.
 *
 * Per-request timeouts alone would let N dead endpoints cost N × the per-request
 * budget, so the ladder also stops STARTING new rungs once this has elapsed.
 *
 * Sized so a single slow-but-working endpoint still wins: it must exceed one
 * rung's timeout comfortably, and it deliberately does NOT scale with the number
 * of rungs — adding endpoints should improve the odds of an answer, not extend
 * how long a user waits for a failure. This comment used to reason in terms of
 * "three RPCs", which silently became wrong the moment a fourth was added.
 *
 * A rung skipped because this expired is NOT a failed rung. describeLadderFailure
 * reports the two separately.
 */
export const WALLET_LADDER_BUDGET_MS = 12_000

/**
 * Turn a thrown fetch error into text a user can act on.
 *
 * `AbortSignal.timeout()` rejects with a DOMException whose message
 * ("signal timed out", "The operation was aborted due to timeout", …) varies by
 * runtime and tells the reader nothing. Anything else passes through, because
 * the upstream's own message ("HTTP 503", "tenant disabled") is the useful one.
 */
export function walletFetchErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return `Upstream did not respond within ${WALLET_FETCH_TIMEOUT_MS / 1000}s`
    }
    return err.message || 'Unknown error'
  }
  return 'Unknown error'
}

/** One rung that was tried and failed. `endpoint` is display text, not a URL to reuse. */
export interface LadderAttempt {
  endpoint: string
  error: string
}

/**
 * Describe a fallback ladder that produced nothing.
 *
 * Written to survive the ladder CHANGING. The old message was
 * `all RPC endpoints failed (last: …)`, which has three problems that only show
 * up later:
 *
 *   - It never said how many endpoints there were, so one dead rung and three
 *     dead rungs read identically. That is what made a 2026-09-10 outage
 *     diagnosis wrong twice: "all endpoints failed" sounds like the provider is
 *     down, and it was actually two stale hostnames.
 *   - It named only the LAST failure, so the reason the first rung failed — the
 *     one that matters, since it is the primary — was discarded.
 *   - Any count written into the text goes stale the moment someone adds a rung.
 *
 * So `total` is passed in from the live list (`rpcs.length`) and every figure
 * here is derived from it. Add a fourth endpoint and the message says 4 on its
 * own, with no edit here and none at the call site.
 *
 * Attempts that never ran because the ladder budget expired are reported
 * SEPARATELY from attempts that ran and failed. Collapsing them would claim an
 * endpoint is broken when it was simply never asked — the same
 * distinction the staking upstream probe draws between `timeout` and
 * `blocked-here`.
 */
export function describeLadderFailure(
  total: number,
  attempts: readonly LadderAttempt[],
  opts: { budgetExhausted?: boolean; label?: string } = {},
): string {
  const label = opts.label ?? 'RPC endpoint'
  const plural = (n: number) => `${n} ${label}${n === 1 ? '' : 's'}`

  if (total === 0) return `no ${label}s are configured for this chain`

  const head = `0 of ${plural(total)} answered`
  const notReached = total - attempts.length

  const scope =
    notReached > 0
      ? ` (${attempts.length} tried, ${notReached} not reached${
          opts.budgetExhausted ? ` — ladder budget of ${WALLET_LADDER_BUDGET_MS / 1000}s exhausted` : ''
        })`
      : ''

  // Every failure, in the order tried, so the PRIMARY rung's reason survives.
  const detail = attempts.length
    ? ` — ${attempts.map((a) => `${a.endpoint}: ${a.error}`).join('; ')}`
    : ''

  return `${head}${scope}${detail}`
}
