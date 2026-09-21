import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * Guard: every route handler that reaches an upstream must bound how long it
 * will wait.
 *
 * Node's fetch has no default timeout. A route calling a host that accepts the
 * connection and then never answers holds the request open indefinitely, and the
 * surface it feeds shows a spinner rather than a failure — the page cannot say
 * "unavailable" because nothing ever told it. That is the failure mode this
 * project treats as worse than an error.
 *
 * Measured before this guard existed (2026-09-20): of 45 route files making
 * outbound calls, only 10 bounded them. The XRP wallet route had already been
 * caught burning 10.2 s on an unreachable upstream
 * (docs/audits/app-audit-2026-07-27.md), and network-fees paid an 11 s penalty
 * per call while mempool.space refused this machine's exit node.
 *
 * A SOURCE SCAN rather than a behavioural test, for the same reason as
 * tiingoUncached: the constraint is a property of how the fetch is WRITTEN. A
 * mock upstream would exercise whatever timing the mock invents, not the absence
 * of a ceiling in the real call.
 *
 * ⚠ The fix is NOT to route these through pinnedFetch, which also takes a
 * signal. A custom dispatcher opts the request out of Next's fetch cache, so
 * `next: { revalidate }` silently stops working — trading an unbounded hang for
 * every call hitting the upstream. See lib/server/fetchBudget.ts.
 */

const ROOT = process.cwd()

const routeFiles = execSync(
  'git ls-files "src/app/live-data/**/route.ts" "src/app/api/**/route.ts"',
  { cwd: ROOT, encoding: 'utf8' },
).split('\n').filter(Boolean)

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** Routes that fetch an upstream at all. */
const fetching = routeFiles.filter((f) => /\bfetch\(/.test(read(f)))

describe('every route that fetches an upstream bounds how long it waits', () => {
  it('finds the route files to check — anti-vacuity', () => {
    // If a refactor moves route handlers, this suite would otherwise pass by
    // examining nothing at all, which is the way a guard like this dies.
    expect(routeFiles.length).toBeGreaterThan(50)
    expect(fetching.length).toBeGreaterThan(30)
  })

  it('has no route making an unbounded outbound call', () => {
    // ⚠ COUNTED PER CALL SITE, NOT PER FILE, and that distinction is the whole
    // guard. The first version of this test asked only whether the file
    // contained `AbortSignal.timeout` anywhere. Mutation-testing it showed it
    // was blind: deleting one of markets/route.ts's three timeouts left two
    // matches and the file still passed.
    //
    // That is the identical mistake DATA-AVAILABILITY.md records against the
    // `revalidate` convention — a file-level grep reported config/route.ts as
    // compliant on the strength of one call site out of seventeen. Writing it
    // down did not stop it being repeated hours later, so it is encoded here
    // instead of documented.
    const unbounded = fetching
      .map((f) => {
        const src = read(f)
        const calls = (src.match(/\bfetch\(/g) ?? []).length
        const bounded = (src.match(/AbortSignal\.timeout/g) ?? []).length
        return { f, calls, bounded }
      })
      .filter((r) => r.bounded < r.calls)
      .map((r) => `${r.f} — ${r.calls} fetch call(s), ${r.bounded} bounded`)

    expect(
      unbounded,
      'These routes call fetch() more often than they bound it. Node waits forever ' +
      'on an upstream that accepts the connection and never answers, and the surface ' +
      'shows a spinner instead of an honest failure. Add ' +
      '`signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS)` alongside the ' +
      'existing `next: { revalidate }` — NOT via pinnedFetch, which would disable ' +
      'the route cache. See lib/server/fetchBudget.ts.',
    ).toEqual([])
  })
})

describe('the shared budget is a ceiling, not a latency target', () => {
  it('is generous enough not to break upstreams that are merely slow', () => {
    // fund-universe measured ~12 s on 2026-09-19 building a 29,009-fund
    // directory, and SEC EDGAR is routinely seconds. A tighter global value
    // would break working surfaces to fix a hypothetical one. Routes wanting a
    // real budget set their own — wallet uses 5 s, staking-discovery 6 s.
    const src = read('src/lib/server/fetchBudget.ts')
    const m = src.match(/EXTERNAL_FETCH_TIMEOUT_MS\s*=\s*([0-9_]+)/)
    expect(m, 'EXTERNAL_FETCH_TIMEOUT_MS is no longer declared as a literal').not.toBeNull()

    const ms = Number(m![1].replace(/_/g, ''))
    expect(ms).toBeGreaterThanOrEqual(13_000)
    expect(ms).toBeLessThanOrEqual(30_000)
  })
})
