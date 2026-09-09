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
 * Ceiling for a whole fallback LADDER (the EVM route tries up to three public
 * RPCs in order). Per-request timeouts alone would let three dead endpoints
 * cost 3 × the per-request budget, so the ladder also stops starting new rungs
 * once this has elapsed. Deliberately more than two rungs' worth and less than
 * three: a single slow-but-working endpoint should still win.
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
