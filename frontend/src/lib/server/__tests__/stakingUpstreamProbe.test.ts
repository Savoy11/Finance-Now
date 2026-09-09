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

  it('keeps the probe timeout in step with the route budget', () => {
    // A probe that waits longer than the route reports a source as healthy that
    // the route will abort on — and a shorter one invents timeouts.
    const routeBudget = /const T = ([0-9_]+)/.exec(routeSrc)?.[1]?.replace(/_/g, '')
    const probeBudget = /const TIMEOUT_MS = ([0-9_]+)/.exec(probeSrc)?.[1]?.replace(/_/g, '')
    expect(routeBudget).toBeTruthy()
    expect(probeBudget).toBe(routeBudget)
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
