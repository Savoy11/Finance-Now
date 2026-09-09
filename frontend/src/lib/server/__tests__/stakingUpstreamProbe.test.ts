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
const routeSrc = readFileSync(join(root, 'src/app/live-data/staking-rates/route.ts'), 'utf8')
const probeSrc = readFileSync(join(root, 'scripts/probe-staking-upstreams.mjs'), 'utf8')

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

describe('staking upstream probe mirrors the route', () => {
  it('probes a non-trivial number of upstreams', () => {
    // Guards against a regex that silently matches nothing and passes.
    expect(probeUrls.size).toBeGreaterThanOrEqual(17)
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
    expect(routeNames.length).toBeGreaterThanOrEqual(17)
    expect([...probeNames].sort()).toEqual([...routeNames].sort())
  })
})
