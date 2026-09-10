import { describe, it, expect } from 'vitest'
import { describeLadderFailure, WALLET_LADDER_BUDGET_MS, type LadderAttempt } from '../walletFetch'

const a = (endpoint: string, error: string): LadderAttempt => ({ endpoint, error })

/**
 * The property under test is that the message stays TRUE as the ladder changes.
 * A count written into the string is correct exactly once — on the day it was
 * written — and every one of these tests exists to stop that creeping back in.
 */
describe('describeLadderFailure', () => {
  it('derives the total from the list, so adding an endpoint updates it with no edit', () => {
    const three = describeLadderFailure(3, [a('h1', 'x'), a('h2', 'y'), a('h3', 'z')])
    const four = describeLadderFailure(4, [a('h1', 'x'), a('h2', 'y'), a('h3', 'z'), a('h4', 'w')])
    expect(three).toContain('0 of 3 RPC endpoints answered')
    expect(four).toContain('0 of 4 RPC endpoints answered')
    // The important part: nothing in this file or the caller had to change.
    expect(three).not.toContain('4')
  })

  it('names EVERY failure in order, not just the last one', () => {
    // The primary rung's reason is the one worth reading, and the old message
    // (`all RPC endpoints failed (last: …)`) discarded it.
    const msg = describeLadderFailure(3, [
      a('ethereum.publicnode.com', 'HTTP 502'),
      a('eth.drpc.org', 'Upstream did not respond within 5s'),
      a('cloudflare-eth.com', 'rpc error -32046'),
    ])
    expect(msg).toContain('ethereum.publicnode.com: HTTP 502')
    expect(msg).toContain('eth.drpc.org: Upstream did not respond within 5s')
    expect(msg).toContain('cloudflare-eth.com: rpc error -32046')
    expect(msg.indexOf('ethereum.publicnode.com')).toBeLessThan(msg.indexOf('cloudflare-eth.com'))
  })

  it('separates rungs that FAILED from rungs never reached', () => {
    // Collapsing these claims an endpoint is broken when it was never asked.
    const msg = describeLadderFailure(4, [a('h1', 'boom'), a('h2', 'boom')], { budgetExhausted: true })
    expect(msg).toContain('0 of 4 RPC endpoints answered')
    expect(msg).toContain('2 tried, 2 not reached')
    expect(msg).toContain(`${WALLET_LADDER_BUDGET_MS / 1000}s exhausted`)
  })

  it('says nothing about a budget when every rung was actually tried', () => {
    const msg = describeLadderFailure(2, [a('h1', 'x'), a('h2', 'y')])
    expect(msg).not.toContain('not reached')
    expect(msg).not.toContain('budget')
  })

  it('reports an empty ladder as a configuration fault, not a failure', () => {
    // "0 of 0 answered" would read as the endpoints failing. None exist.
    const msg = describeLadderFailure(0, [])
    expect(msg).toContain('no RPC endpoints are configured')
    expect(msg).not.toContain('0 of 0')
  })

  it('keeps the singular readable for a one-rung ladder', () => {
    expect(describeLadderFailure(1, [a('only', 'nope')])).toContain('0 of 1 RPC endpoint answered')
  })

  it('takes a label, so non-RPC ladders can reuse it verbatim', () => {
    const msg = describeLadderFailure(2, [a('p1', 'x')], { label: 'price provider' })
    expect(msg).toContain('0 of 2 price providers answered')
  })

  it('never hardcodes a count anywhere in its own source', () => {
    // The guard against the exact regression this function exists to prevent.
    for (const n of [1, 2, 3, 5, 9]) {
      const attempts = Array.from({ length: n }, (_, i) => a(`h${i}`, 'e'))
      expect(describeLadderFailure(n, attempts)).toContain(`0 of ${n} RPC endpoint`)
    }
  })
})
