import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * `npm run discovery-upstreams` (scripts/probe-discovery-upstreams.mjs) exists to
 * answer T-399: three of the four /live-data/staking-discovery upstreams
 * contribute zero pools, and the route cannot say why because the three possible
 * causes need three different cures.
 *
 * A mirror is only useful while it matches. A stale one is worse than none — it
 * looks authoritative while reporting on a source the app no longer fetches, or
 * silently omits one it does. These tests fail on either kind of drift.
 *
 * Both files are read as TEXT rather than imported: the route is a Next handler
 * and the probe performs network I/O at module scope.
 */

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

const routeSrc = read('src/app/live-data/staking-discovery/route.ts')
const probeSrc = read('scripts/probe-discovery-upstreams.mjs')

/** Every absolute http(s) URL passed to the route's JSON fetcher. */
function fetchedUrls(src: string): Set<string> {
  const urls = new Set<string>()
  // `[^(]*` rather than `<[^>]*>` for the type parameter: the route's Beefy TVL
  // call is getJson<Record<string, Record<string, number>>>(...), and a `[^>]*`
  // stops dead at the first `>`. That exact miss is what this test caught on its
  // first run — the URL list looked complete and was one short.
  for (const m of src.matchAll(/getJson[^(]*\(\s*'(https:\/\/[^']+)'/g)) urls.add(m[1])
  return urls
}

/** Every upstream URL the probe declares, including Beefy's enrichments. */
function probedUrls(src: string): Set<string> {
  const urls = new Set<string>()
  for (const m of src.matchAll(/^\s*url:\s*'(https:\/\/[^']+)'/gm)) urls.add(m[1])
  for (const m of src.matchAll(/\{\s*key:\s*'\w+',\s*url:\s*'(https:\/\/[^']+)'\s*\}/g)) urls.add(m[1])
  return urls
}

const routeUrls = fetchedUrls(routeSrc)
const probeUrls = probedUrls(probeSrc)

describe('the discovery probe mirrors the route', () => {
  it('both extractors actually matched something (guards the guard)', () => {
    // Anti-vacuity. A regex that silently matches nothing makes every comparison
    // below trivially pass, which is the failure mode that lets a mirror rot
    // while its tests stay green.
    expect(routeUrls.size, 'the route URL extractor matched nothing').toBeGreaterThanOrEqual(4)
    expect(probeUrls.size, 'the probe URL extractor matched nothing').toBeGreaterThanOrEqual(4)
  })

  it('probes every upstream the route fetches', () => {
    const missing = [...routeUrls].filter((u) => !probeUrls.has(u))
    expect(missing, `the route fetches these and the probe does not:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('probes nothing the route does not fetch', () => {
    // The other drift direction: a rung dropped from the route but left in the
    // probe goes on being reported as a broken source the app no longer uses —
    // which is how a dead rung gets "fixed" twice and a live one never does.
    const extra = [...probeUrls].filter((u) => !routeUrls.has(u))
    expect(extra, `the probe fetches these and the route does not:\n  ${extra.join('\n  ')}`).toEqual([])
  })

  it('measures against the route\'s own filter defaults', () => {
    // The funnel is meaningless if the probe applies a different threshold than
    // the route. min_tvl in particular is $1,000,000 — high enough that it is a
    // plausible cause of an empty result all by itself, which is exactly what
    // the probe is there to distinguish.
    const routeTvl = /min_tvl'\)\s*\?\?\s*'(\d+)'/.exec(routeSrc)?.[1]
    const routeApy = /min_apy'\)\s*\?\?\s*'([\d.]+)'/.exec(routeSrc)?.[1]
    expect(routeTvl, 'could not read min_tvl from the route').toBeTruthy()
    expect(routeApy, 'could not read min_apy from the route').toBeTruthy()

    const probeTvl = /argOf\('min-tvl',\s*([0-9_]+)\)/.exec(probeSrc)?.[1]?.replace(/_/g, '')
    const probeApy = /argOf\('min-apy',\s*([\d.]+)\)/.exec(probeSrc)?.[1]
    expect(probeTvl).toBe(routeTvl)
    expect(probeApy).toBe(routeApy)
  })

  it('knows the route budget it reproduces under --parallel', () => {
    const routeBudget = /UPSTREAM_TIMEOUT_MS\s*=\s*([0-9_]+)/.exec(routeSrc)?.[1]?.replace(/_/g, '')
    const probeBudget = /ROUTE_BUDGET_MS\s*=\s*([0-9_]+)/.exec(probeSrc)?.[1]?.replace(/_/g, '')
    expect(routeBudget, 'could not read UPSTREAM_TIMEOUT_MS from the route').toBeTruthy()
    expect(probeBudget).toBe(routeBudget)
  })

  it('mirrors symbolToCoinId rather than reimplementing it differently', () => {
    // The probe duplicates these six lines because the route is a Next handler.
    // The map itself is IMPORTED, so only the matching rule can drift — and a
    // different rule would move the funnel's last stage without anyone noticing.
    expect(probeSrc).toContain("split('-')[0].split('/')[0].toUpperCase()")
    expect(probeSrc).toContain('symbols.some((s) => base.startsWith(s))')
    expect(routeSrc).toContain("split('-')[0].split('/')[0].toUpperCase()")
    expect(routeSrc).toContain('symbols.some(s => base.startsWith(s))')
  })
})

describe('the probe reports rather than writes', () => {
  it('contains no write, no git, and no fetch outside its own probe helper', () => {
    // Same split as the fee and llama-symbol probes: an automated URL rewrite is
    // how a yield from the wrong protocol lands on a coin. Stated in the header
    // AND enforced here, because a stated intention is not a control.
    expect(probeSrc).not.toMatch(/writeFileSync|appendFileSync|execSync|spawnSync/)
  })

  it('exits 2 when our own egress did the blocking, not 1', () => {
    // "You ran this in the wrong place" and "the sources are broken" must not
    // share an exit code — the whole point of the verdict vocabulary is that
    // blocked-here says nothing about the source.
    expect(probeSrc).toContain('process.exit(2)')
    expect(probeSrc).toMatch(/blocked-here/)
  })
})
