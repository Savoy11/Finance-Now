import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The probe (`npm run staking-upstreams`) mirrors the URL list inside
 * /live-data/staking-rates so it can ask the same 17 sources the same questions
 * without a dev server. A mirror is only useful while it matches: a URL fixed in
 * the route and not in the probe sends the next diagnosis after a source that is
 * no longer used, which is worse than having no probe — it looks authoritative.
 *
 * So the two lists are compared here rather than trusted to stay in step. This
 * is a text comparison on purpose: the route's URLs sit inside a
 * `Promise.allSettled` argument list, and extracting them into a shared module
 * would mean refactoring a route that ships live APRs for the benefit of a
 * maintenance script. Reading both files is the cheaper guarantee.
 */

const root = join(__dirname, '..', '..', '..', '..')

/**
 * Read a source file with its line endings normalised to LF.
 *
 * The repo is uniformly LF in git (`* text=auto` in .gitattributes), but the
 * WORKING TREE follows each machine's `core.autocrlf` — so on a Windows clone
 * every line arrives as CRLF. That is invisible to a matcher working inside a
 * single line, which is why the URL scrape below never noticed it, but it
 * silently breaks any pattern spanning a line boundary: `const \[\n` cannot
 * match `const [\r\n`. The `allSettled` regex therefore returned null and both
 * structural guards below failed — on every Windows full-suite run since they
 * arrived in #160, while passing in CI on LF the whole time.
 *
 * A guard that holds only on the CI platform has stopped guarding for whoever
 * is actually editing the file, which is exactly the positional-binding mistake
 * #160 exists to catch. Normalise on the way in, so the assertions describe the
 * source rather than the checkout.
 */
function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')
}

const routeSrc = readSrc('src/app/live-data/staking-rates/route.ts')
const probeSrc = readSrc('scripts/probe-staking-upstreams.mjs')

/** Every https:// URL that is actually fetched, ignoring ones inside comments. */
function fetchedUrls(src: string): Set<string> {
  const urls = new Set<string>()
  for (const line of src.split('\n')) {
    const code = line.trimStart()
    if (code.startsWith('//') || code.startsWith('*')) continue
    for (const m of line.matchAll(/'(https:\/\/[^']+)'/g)) urls.add(m[1])
  }
  return urls
}

const routeUrls = fetchedUrls(routeSrc)
const probeUrls = fetchedUrls(probeSrc)

describe('staking-rates route internals', () => {
  /**
   * The destructured bindings and the fetch list are positional: entry N of
   * `Promise.allSettled` lands in binding N. Removing a fetch without removing
   * its binding (or vice versa) silently shifts every later upstream onto the
   * wrong response — and TypeScript cannot see it, because every entry has the
   * same `PromiseSettledResult<Response>` type. That exact mistake happened
   * while trimming the dead rungs on 2026-09-09: the Celestia fetch sat after
   * Injective, outside the contiguous block being removed, so its binding went
   * and its fetch stayed. Silent, and wrong in a way no test then covered.
   */
  // [\s\S] rather than the `s` (dotAll) flag: this tsconfig targets below es2018,
  // where that flag is a compile error. vitest transpiles it happily, so only
  // `tsc`/`next build` catches it — which is why both run before a push.
  const block = /const \[\n([\s\S]*?)\n {2}\] = await Promise\.allSettled\(\[\n([\s\S]*?)\n {2}\]\)/.exec(routeSrc)

  it('binds exactly as many results as it fetches', () => {
    expect(block, 'could not locate the allSettled block').toBeTruthy()
    const bindings = block![1].split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean)
    const fetches = [...block![2].matchAll(/timedFetch\('([^']+)'/g)].map((m) => m[1])
    expect(bindings.length).toBe(fetches.length)
    expect(bindings.length).toBeGreaterThan(0)
  })

  it('reports on every upstream it binds', () => {
    // The `upstreams` diagnostic table must cover each binding, or a failing
    // source becomes invisible again — the thing #156 existed to fix.
    const bindings = block![1].split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean)
    const reported = [...routeSrc.matchAll(/\{ name: '[a-z0-9-]+',\s+res: (\w+),/g)].map((m) => m[1])
    expect([...reported].sort()).toEqual([...bindings].sort())
  })
})

describe('staking upstream probe mirrors the route', () => {
  it('probes a non-trivial number of upstreams', () => {
    // Guards against a regex that silently matches nothing and passes. Not a
    // fixed count: rungs get removed when a source dies (nine went on
    // 2026-09-09), and a hardcoded total turns that into a test failure instead
    // of the intended cleanup.
    expect(probeUrls.size).toBeGreaterThanOrEqual(3)
  })

  it('probes every upstream the route fetches', () => {
    const missing = [...routeUrls].filter((u) => !probeUrls.has(u))
    expect(missing, `route fetches these but the probe does not:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('probes nothing the route does not fetch', () => {
    // Catches the other drift direction: a rung removed from the route (as the
    // dead api.avax.network probe was) but left in the probe, where it would go
    // on being reported as a broken source the app no longer depends on.
    const extra = [...probeUrls].filter((u) => !routeUrls.has(u))
    expect(extra, `probe fetches these but the route does not:\n  ${extra.join('\n  ')}`).toEqual([])
  })

  it('knows the route budget it is measuring against', () => {
    // The probe deliberately allows LONGER than the route when running one host at
    // a time — that is how it learns a host's true latency instead of inheriting
    // the route's contention. But it must still know the route's number, since
    // that is the threshold it reports `over-budget` against. Drift there would
    // silently move the line between "this host is too slow for the route" and
    // "this host is fine".
    const routeBudget = /const T = ([0-9_]+)/.exec(routeSrc)?.[1]?.replace(/_/g, '')
    const probeThreshold = /const ROUTE_BUDGET_MS = ([0-9_]+)/.exec(probeSrc)?.[1]?.replace(/_/g, '')
    expect(routeBudget).toBeTruthy()
    expect(probeThreshold).toBe(routeBudget)
  })

  it('probes sequentially by default', () => {
    // The correction the 2026-09-09 audit forced. The route fires all 17 at once
    // under a shared budget, and upstreams 1-5 answered while 6-17 "timed out" in
    // array order — queueing, not host health. A probe that fans out the same way
    // reproduces those false timeouts and reports them as dead hosts, which is the
    // misattribution this whole probe exists to prevent. Parallel must stay
    // opt-in, and reachable only behind the flag.
    expect(probeSrc).toContain("PARALLEL = process.argv.includes('--parallel')")
    const fanOut = /await Promise\.all\(UPSTREAMS\.map\(probe\)\)/.test(probeSrc)
    if (fanOut) {
      // Allowed, but only inside the --parallel branch.
      const guarded = /if \(PARALLEL\) \{\s*results = await Promise\.all\(UPSTREAMS\.map\(probe\)\)/.test(probeSrc)
      expect(guarded, 'Promise.all over all upstreams must sit inside the PARALLEL branch').toBe(true)
    }
    // And the default path must actually await one at a time.
    expect(probeSrc).toMatch(/for \(const u of UPSTREAMS\) \{\s*const r = await probe\(u\)/)
  })

  it('names upstreams the same way the route reports them', () => {
    // The probe's rows and the audit's `upstreams` map have to be joinable by
    // eye, or reading one against the other is guesswork.
    const routeNames = [...routeSrc.matchAll(/\{ name: '([a-z0-9-]+)',\s+res:/g)].map((m) => m[1])
    const probeNames = [...probeSrc.matchAll(/\{ name: '([a-z0-9-]+)', url:/g)].map((m) => m[1])
    expect(routeNames.length).toBeGreaterThanOrEqual(3)
    expect([...probeNames].sort()).toEqual([...routeNames].sort())
  })
})
