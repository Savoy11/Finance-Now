import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * T-172 (2026-09-26). /live-data/staking-discovery could answer `ok: true, pools: []`
 * after an upstream outage with nothing in the payload saying so — `sources.yearn: 0`
 * reads the same whether Yearn answered with nothing or did not answer. staking-rates
 * closed the same gap with its `upstreams` field; this pins the discovery route's.
 *
 * Source-mirror tests, comments stripped, because the route runs against four live
 * hosts and the property under test is the SHAPE of every return path.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const route = strip(readFileSync(join(process.cwd(), 'src/app/live-data/staking-discovery/route.ts'), 'utf8'))
const panel = strip(readFileSync(join(process.cwd(), 'src/app/(dashboard)/staking/LivePoolsPanel.tsx'), 'utf8'))

describe('staking-discovery reports each upstream outcome', () => {
  it('the response type carries upstreams and degraded, both required', () => {
    const iface = route.match(/export interface StakingDiscoveryResponse \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(iface).toMatch(/^\s*upstreams:\s*Record<DiscoverySource, string>/m)
    expect(iface).toMatch(/^\s*degraded:\s*boolean/m)
    expect(iface).not.toMatch(/upstreams\?:|degraded\?:/) // required, not optional
  })

  it('every NextResponse.json return in GET carries upstreams', () => {
    const get = route.slice(route.indexOf('export async function GET'))
    const returns = get.match(/NextResponse\.json\(([\s\S]*?)\)\n/g) ?? []
    expect(returns.length).toBeGreaterThanOrEqual(2)
    for (const r of returns) {
      // Either the call spells the field out, or it passes a variable whose
      // declaration does — `const response: StakingDiscoveryResponse = { … upstreams, … }`.
      // tsc already forces the latter (the field is required); this keeps the scan honest
      // about what it can and cannot see.
      if (/upstreams/.test(r)) continue
      const id = r.match(/NextResponse\.json\((\w+)\)/)?.[1]
      expect(id, `${r.trim()} — neither a literal with upstreams nor a typed variable`).toBeTruthy()
      const decl = get.match(new RegExp(`const ${id}: StakingDiscoveryResponse = \\{[\\s\\S]*?\\n  \\}`))?.[0] ?? ''
      expect(decl, `${id} is not declared as StakingDiscoveryResponse in GET`).toMatch(/upstreams/)
    }
  })

  it("a fulfilled leg reports 'live (n)' and a rejected one 'failed: <reason>'", () => {
    expect(route).toMatch(/r\.status === 'fulfilled' \? `live \(\$\{r\.value\.length\}\)` : `failed: /)
  })

  it('degraded is derived from the settled results, not from the pool count', () => {
    expect(route).toMatch(/degraded:\s*anyUpstreamFailed/)
    expect(route).toMatch(/anyUpstreamFailed = results\.some\(r => r\.status === 'rejected'\)/)
  })

  it('the panel renders the degraded state as unreachable sources, not as no pools', () => {
    expect(panel).toMatch(/data\?\.degraded|data\.degraded/)
    expect(panel).toMatch(/upstreams/)
  })

  it('guards the guard: the return-path scan would see an ungated return', () => {
    const s = "  return NextResponse.json({ ok: true, pools })\n  return NextResponse.json({ ...x, upstreams })\n"
    const returns = s.match(/NextResponse\.json\([\s\S]*?\)\n/g) ?? []
    expect(returns.length).toBe(2)
    expect(returns.filter((r) => /upstreams/.test(r)).length).toBe(1)
  })
})
