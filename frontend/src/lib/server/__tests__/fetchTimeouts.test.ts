import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * Drop whole-line `//` comments so prose is not counted as code.
 *
 * Hoisted out of the assertion below so it can be tested in its own right. It is a
 * DEFENSIVE measure — nothing in the tree currently trips the false positive it
 * prevents, because the comment that exposed it was also reworded. A defensive
 * mechanism with no test is indistinguishable from a decorative one, and mutation
 * testing proved exactly that: neutering it changed no result.
 */
export function stripWholeLineComments(s: string): string {
  return s
    .split('\n')
    .map((l) => (/^\s*\/\//.test(l) ? '' : l))
    .join('\n')
}

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

  // ── The stripper's own test. Without this, mutation testing showed it could be
  //    deleted outright with no test failing anywhere.
  describe('stripWholeLineComments', () => {
    it('drops prose that would otherwise be counted as a call site', () => {
      const src = ['// this route used a bare fetch() before 2026-09-20', 'await fetch(url, { signal: AbortSignal.timeout(1) })'].join('\n')
      const out = stripWholeLineComments(src)
      expect((out.match(/\bfetch\(/g) ?? []).length).toBe(1)
      expect((out.match(/AbortSignal\.timeout/g) ?? []).length).toBe(1)
    })

    it('leaves real code alone, including trailing comments on a code line', () => {
      const src = 'await fetch(url) // and a note mentioning fetch( here'
      // A trailing comment is NOT stripped — narrowness is deliberate. It would be
      // caught as a second call site, which is a false positive this does not solve
      // and must not be "fixed" with a regex that cannot see string literals.
      expect(stripWholeLineComments(src)).toBe(src)
    })

    // ⚠ THE REGRESSION THIS EXISTS TO PREVENT. The first version of the stripper also
    // removed /* … */ blocks. news/route.ts carries the Accept header `…text/xml, */*`,
    // whose `*/` closed a block comment opened far earlier and swallowed real code —
    // including an AbortSignal.timeout — making the guard report a bounded route as
    // unbounded. A regex that cannot see string literals must not delete code.
    it('never removes code, even when a string literal contains a comment terminator', () => {
      const src = [
        "  Accept: 'application/rss+xml, text/xml, */*',",
        '  signal: AbortSignal.timeout(10_000),',
      ].join('\n')
      expect(stripWholeLineComments(src)).toBe(src)
      expect((stripWholeLineComments(src).match(/AbortSignal\.timeout/g) ?? []).length).toBe(1)
    })
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
    // ⚠ WHOLE-LINE COMMENTS ARE DROPPED BEFORE COUNTING, and the narrowness is the
    // point. On 2026-09-20 this guard failed market-news/route.ts because a COMMENT
    // explaining that route's history contained the words "a bare fetch()" — the
    // guard read the prose as a call site and demanded a timeout for it. A guard
    // that does that produces false positives forever, and the workaround people
    // reach for is to stop writing the clear sentence, which makes the code worse to
    // make the test easier.
    //
    // ⚠ THE FIRST ATTEMPT AT THIS FIX WAS WORSE THAN THE BUG. It also stripped
    // /* … */ blocks with `\/\*[\s\S]*?\*\//g`, which is unsafe in a file containing
    // string literals: news/route.ts has the Accept header `…text/xml, */*`, and that
    // `*/` closed a block comment opened hundreds of lines earlier, swallowing real
    // code — including the `AbortSignal.timeout(10_000)` on the feed fetch. The guard
    // then reported a genuinely bounded route as unbounded. A regex that does not
    // understand strings must not be allowed to delete code.
    //
    // So this only drops lines whose first non-whitespace is `//`. Those cannot be
    // inside a string literal on that line, cannot span lines, and cannot execute.
    // It fixes the prose false-positive and can do nothing else.
    const stripComments = stripWholeLineComments

    const unbounded = fetching
      .map((f) => {
        const src = stripComments(read(f))
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
