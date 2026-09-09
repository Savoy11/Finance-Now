import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `npm run llama-symbols` mirrors LLAMA_MAP from /live-data/staking-rates so it
 * can resolve the keys that stopped matching a DeFiLlama pool, without a dev
 * server. Same reasoning as stakingUpstreamProbe.test.ts: a mirror is only
 * useful while it matches. A symbol corrected in the route and not in the probe
 * would send the next diagnosis after a token the route no longer asks for —
 * and it would look authoritative doing it.
 *
 * Text comparison on purpose. LLAMA_MAP is a route-local const, and exporting it
 * for a maintenance script means a route that serves live APRs takes a change
 * for the script's benefit. Reading both files is the cheaper guarantee.
 */

const root = join(__dirname, '..', '..', '..', '..')
const routeSrc = readFileSync(join(root, 'src/app/live-data/staking-rates/route.ts'), 'utf8')
const probeSrc = readFileSync(join(root, 'scripts/probe-llama-symbols.mjs'), 'utf8')

/**
 * Pull `key` -> sorted symbols out of a LLAMA_MAP literal, skipping comments.
 * Line-based rather than one regex over the block: an earlier attempt used a
 * `[^}]*?` body match and broke on the first entry containing a brace.
 */
function llamaEntries(src: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of src.split('\n')) {
    const code = line.trimStart()
    if (code.startsWith('//') || code.startsWith('*')) continue
    const key = code.match(/\bkey:\s*'([a-z0-9_]+)'/)
    if (!key) continue
    const symsRaw = code.match(/symbols:\s*\[([^\]]*)\]/)
    if (!symsRaw) continue
    const syms = [...symsRaw[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toUpperCase()).sort()
    const chain = code.match(/\bchain:\s*'([A-Za-z]+)'/)
    out.set(key[1], `${syms.join('+')}@${chain ? chain[1] : 'any'}`)
  }
  return out
}

const routeMap = llamaEntries(routeSrc)
const probeMap = llamaEntries(probeSrc)

describe('DeFiLlama symbol probe mirrors the route', () => {
  it('reads a non-trivial map from both files (guards the parser itself)', () => {
    // A parser that silently matched nothing would make every test below pass,
    // so this asserts a FLOOR — deliberately well under the real count, since
    // the map legitimately shrinks (six keys went on 2026-09-09 when a probe run
    // showed no pool answers them). Pinning it to the exact size would turn every
    // justified removal into a test failure and teach the next reader to edit the
    // number without reading it.
    expect(routeMap.size).toBeGreaterThan(10)
    expect(probeMap.size).toBe(routeMap.size)
  })

  it('covers every key the route maps', () => {
    const missing = [...routeMap.keys()].filter((k) => !probeMap.has(k))
    expect(missing, `probe is missing keys the route uses: ${missing.join(', ')}`).toEqual([])
  })

  it('asks for no key the route has dropped', () => {
    const extra = [...probeMap.keys()].filter((k) => !routeMap.has(k))
    expect(extra, `probe still asks for removed keys: ${extra.join(', ')}`).toEqual([])
  })

  it('agrees on the symbols and chain of every key', () => {
    const drift = [...routeMap.entries()]
      .filter(([k, v]) => probeMap.get(k) !== v)
      .map(([k, v]) => `${k}: route=${v} probe=${probeMap.get(k)}`)
    expect(drift, `symbol/chain drift:\n${drift.join('\n')}`).toEqual([])
  })

  it('reproduces the route\'s matcher, chain preference included', () => {
    // The probe calling something "no match" is only meaningful if it matched
    // the way the route does: exact symbol, then narrow to the named chain only
    // when that chain has hits — never falling back to a different chain's pool.
    expect(probeSrc).toMatch(/function routeMatch/)
    expect(probeSrc).toMatch(/toUpperCase\(\) === sym/)
    expect(probeSrc).toMatch(/if \(byChain\.length\) cands = byChain/)
  })

  it('treats an unreachable DeFiLlama as inconclusive, not as broken symbols', () => {
    // Same distinction the staking probe draws: exit 2 says "you ran this in the
    // wrong place", exit 1 says "the symbols really are wrong". Collapsing them
    // is how a blocked sandbox run gets filed as a data defect.
    expect(probeSrc).toMatch(/process\.exit\(2\)/)
    expect(probeSrc).toMatch(/PROVES NOTHING ABOUT THE SYMBOLS/)
  })

  it('writes nothing — resolution is a human read, like the fee scripts', () => {
    expect(probeSrc).not.toMatch(/writeFileSync|appendFileSync|\bfs\.write/)
  })
})
