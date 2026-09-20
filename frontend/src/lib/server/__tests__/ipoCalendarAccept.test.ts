import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guard: the IPO calendar must not ask Alpha Vantage for `text/csv`.
 *
 * Measured 2026-09-19 against a live key, three variants back to back:
 *
 *   Accept: text/csv   → HTTP 406
 *   Accept: * / *      → HTTP 200, body "symbol,name,ipoDate,priceRangeLow,…"
 *   (no Accept)        → HTTP 200, same CSV
 *
 * The endpoint returns CSV by default and rejects the one header value that
 * describes exactly what it sends. So the header was not a harmless nicety — it
 * was the whole failure.
 *
 * WHY THIS IS WORTH A GUARD, beyond the one-line fix: the bug was invisible in
 * the shape the project usually catches things. The route reported
 * `configured: true, reason: 'upstream'` — accurate, and it pointed at Alpha
 * Vantage rather than at us. T-384 therefore sat on the queue as "verify the IPO
 * calendar with a free Alpha Vantage key" for weeks, and a key would never have
 * fixed it. Re-adding `Accept: 'text/csv'` looks like tightening a request and
 * would silently restore a dead surface with an honest-looking error.
 *
 * A source scan rather than a behavioural test for the same reason as
 * tiingoUncached: the constraint is a property of how the fetch is WRITTEN, and
 * mocking the upstream would reproduce whatever Accept semantics the mock
 * invents rather than the ones Alpha Vantage actually enforces.
 */

const ROUTE = join(process.cwd(), 'src/app/live-data/ipo-calendar/route.ts')
const src = readFileSync(ROUTE, 'utf-8')

describe('the IPO calendar does not negotiate itself into a 406', () => {
  it('finds the Alpha Vantage IPO_CALENDAR fetch to check', () => {
    // Anti-vacuity: if the route moves or is rewritten, the assertions below
    // would pass over a file that no longer contains the fetch at all.
    expect(src).toContain('alphavantage.co/query')
    expect(src).toContain('function=IPO_CALENDAR')
  })

  it('sends no restrictive Accept header', () => {
    // Any Accept that is not */* re-creates the 406. `text/csv` is the specific
    // value that was there; the assertion is deliberately broader than that one
    // string, because `application/csv` or `text/plain` would fail the same way.
    const accepts = [...src.matchAll(/Accept:\s*'([^']+)'/g)].map((m) => m[1])
    const restrictive = accepts.filter((a) => a.trim() !== '*/*')
    expect(
      restrictive,
      `Alpha Vantage 406s on any specific Accept; it serves CSV to */* or to no header. Found: ${restrictive.join(', ')}`,
    ).toEqual([])
  })

  it('still caches, because Alpha Vantage is not Tiingo', () => {
    // The fix removed a header, not the cache. Alpha Vantage's free tier is
    // 25 requests/day, so the 6h revalidate is what keeps this route inside it —
    // and nothing in its terms forbids storage the way Tiingo §1.6(a) does.
    expect(src).toMatch(/revalidate:\s*REVALIDATE_SECONDS/)
  })
})
