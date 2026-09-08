import { describe, expect, it } from 'vitest'
import {
  WALLET_FETCH_TIMEOUT_MS,
  WALLET_LADDER_BUDGET_MS,
  walletFetchErrorMessage,
} from '../walletFetch'

describe('walletFetchErrorMessage', () => {
  it('replaces an opaque timeout with something a reader can act on', () => {
    const e = new Error('signal timed out')
    e.name = 'TimeoutError'
    expect(walletFetchErrorMessage(e)).toBe('Upstream did not respond within 5s')
  })

  it('treats a plain abort the same way', () => {
    const e = new Error('The operation was aborted.')
    e.name = 'AbortError'
    expect(walletFetchErrorMessage(e)).toContain('did not respond')
  })

  it("keeps the upstream's own message — it is the useful one", () => {
    expect(walletFetchErrorMessage(new Error('HTTP 503'))).toBe('HTTP 503')
    expect(walletFetchErrorMessage(new Error('tenant disabled'))).toBe('tenant disabled')
  })

  it('handles a non-Error throw without producing "undefined"', () => {
    expect(walletFetchErrorMessage('boom')).toBe('Unknown error')
    expect(walletFetchErrorMessage(new Error(''))).toBe('Unknown error')
  })
})

describe('wallet timeout budgets', () => {
  it('bounds a three-rung ladder below three full per-request budgets', () => {
    // The point of the ladder ceiling: three dead endpoints must not cost
    // 3 × the per-request timeout.
    expect(WALLET_LADDER_BUDGET_MS).toBeLessThan(3 * WALLET_FETCH_TIMEOUT_MS)
    // ...while still leaving room for two rungs, so one slow-but-working
    // endpoint behind one dead one still wins.
    expect(WALLET_LADDER_BUDGET_MS).toBeGreaterThan(2 * WALLET_FETCH_TIMEOUT_MS)
  })
})
