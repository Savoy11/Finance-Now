import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planFallbackRefresh } from '../../../../scripts/lib/stakingFallbackRefresh.mjs'

/**
 * FALLBACK carries two kinds of number, and the difference is the whole point:
 * the keys in FALLBACK_MEASURED were read from a live upstream on
 * FALLBACK_MEASURED_ON, and the rest are undated hand-written estimates that
 * have never been checked.
 *
 * That distinction only survives while FALLBACK_MEASURED and FALLBACK agree, so
 * it is asserted here rather than trusted. The failure it guards against is a
 * later edit that renames or drops a key and leaves the measured list behind —
 * which would quietly re-date a legacy estimate as verified, the exact staleness
 * lie the table's header comment exists to prevent.
 *
 * Line endings are normalised on read: the repo is LF in git but a Windows
 * checkout is CRLF, and the multi-line block regexes below cannot match `\r\n`.
 * Same reason as stakingUpstreamProbe.test.ts.
 */
const root = join(__dirname, '..', '..', '..', '..')
const routeSrc = readFileSync(
  join(root, 'src/lib/server/stakingRates.ts'),
  'utf8',
).replace(/\r\n/g, '\n')

/** Keys and values in the FALLBACK table. */
function fallbackTable(): Record<string, number> {
  const block = /const FALLBACK: Record<string, number> = \{([\s\S]*?)\n\}/.exec(routeSrc)
  expect(block, 'could not locate the FALLBACK table').toBeTruthy()
  const out: Record<string, number> = {}
  for (const m of block![1].matchAll(/^[ \t]*([a-z0-9_]+):[ \t]*([0-9.]+)[ \t]*,/gm)) {
    out[m[1]] = parseFloat(m[2])
  }
  return out
}

/** Keys listed in FALLBACK_MEASURED. */
function measuredKeys(): string[] {
  const block = /const FALLBACK_MEASURED: ReadonlySet<string> = new Set\(\[([\s\S]*?)\n\]\)/.exec(routeSrc)
  expect(block, 'could not locate FALLBACK_MEASURED').toBeTruthy()
  return [...block![1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1])
}

describe('the staking catalog’s live-rate keys', () => {
  // A liveAprKey names a rate this collector publishes. One that names nothing reads as
  // "no live rate" without saying why; and a defunct provider has no rate to look up at
  // all. Stride's three keys went with its rung on 2026-10-14, when it was marked defunct.
  it('each names a key in the FALLBACK table', async () => {
    const { STAKING_PROVIDERS } = await import('@/lib/data/stakingProviders')
    const table = fallbackTable()
    const dangling = STAKING_PROVIDERS.flatMap((p) => Object.entries(p.assets)
      .filter(([, a]) => a?.liveAprKey && !(a.liveAprKey in table))
      .map(([coin, a]) => `${p.id}/${coin} → ${a!.liveAprKey}`))
    expect(dangling).toEqual([])
  })

  it('no defunct provider points at a live rate', async () => {
    const { STAKING_PROVIDERS } = await import('@/lib/data/stakingProviders')
    const live = STAKING_PROVIDERS.filter((p) => p.defunct).flatMap((p) => Object.entries(p.assets)
      .filter(([, a]) => a?.liveAprKey).map(([coin]) => `${p.id}/${coin}`))
    expect(live).toEqual([])
  })
})

describe('staking FALLBACK provenance', () => {
  it('every measured key exists in the FALLBACK table', () => {
    const table = fallbackTable()
    const missing = measuredKeys().filter((k) => !(k in table))
    expect(missing, `measured keys absent from FALLBACK: ${missing.join(', ')}`).toEqual([])
  })

  it('lists no key twice', () => {
    const keys = measuredKeys()
    expect(keys.length).toBe(new Set(keys).size)
  })

  it('measures some but deliberately not all of the table', () => {
    // The split IS the design. All-measured would mean the header comment's
    // legacy warning is stale; none-measured would mean the refresh was lost.
    const table = fallbackTable()
    const measured = measuredKeys()
    expect(measured.length).toBeGreaterThan(0)
    expect(measured.length).toBeLessThan(Object.keys(table).length)
  })

  it('carries a dated FALLBACK_MEASURED_ON', () => {
    const m = /const FALLBACK_MEASURED_ON = '(\d{4}-\d{2}-\d{2})'/.exec(routeSrc)
    expect(m, 'FALLBACK_MEASURED_ON missing or not an ISO date').toBeTruthy()
  })

  it('reports the measured/unmeasured split in the response', () => {
    // A constant nobody serves is a constant nobody can act on: the point of
    // recording provenance is that a surface showing an `estimate` rate can say
    // whether that estimate was ever checked.
    expect(routeSrc).toMatch(/fallbackProvenance:\s*\{/)
    expect(routeSrc).toContain('measuredOn: FALLBACK_MEASURED_ON')
    expect(routeSrc).toContain('measuredKeys: FALLBACK_MEASURED.size')
  })

  it('the refresh script reads its rules from the tested module', () => {
    // The tests below exercise planFallbackRefresh; they prove nothing about the
    // command unless the command actually calls it.
    const script = readFileSync(join(process.cwd(), 'scripts/refresh-staking-fallbacks.mjs'), 'utf8')
    expect(script).toMatch(/import \{ planFallbackRefresh \} from '\.\/lib\/stakingFallbackRefresh\.mjs'/)
    expect(script).toMatch(/if \(refusal\) \{[\s\S]*?process\.exit\(1\)/)
  })

  it('keeps every measured value plausible for a staking APR', () => {
    // Guards a decimal slip in a hand-edit (a 4.86 becoming 486). Deliberately
    // wide: real readings in this table span 0.17% to 14.3%, and a tight band
    // would fail on an honest market move rather than on a typo.
    const table = fallbackTable()
    for (const k of measuredKeys()) {
      expect(table[k], `${k} = ${table[k]}`).toBeGreaterThan(0)
      expect(table[k], `${k} = ${table[k]}`).toBeLessThan(60)
    }
  })
})

describe('the fallback refresh writes only a whole reading (2026-10-13)', () => {
  // FALLBACK_MEASURED_ON is one date for every measured key. Run against the real
  // route source, so a change to its shape fails here rather than on the day the
  // refresh is needed.
  const keys = measuredKeys()
  const TODAY = '2099-01-02'
  const reading = (overrides: Record<string, { rate?: number; source?: string }> = {}) => {
    const rates: Record<string, number> = {}
    const sources: Record<string, string> = {}
    for (const k of keys) {
      rates[k] = overrides[k]?.rate ?? 3.21
      sources[k] = overrides[k]?.source ?? 'live'
    }
    return { rates, sources, upstreams: { 'lido-eth': 'live (1/1)' } }
  }

  it('writes, and dates, a reading where every measured key came back live', () => {
    const plan = planFallbackRefresh(routeSrc, reading(), TODAY)
    expect(plan.measured).toEqual(keys)
    expect(plan.refusal).toBeNull()
    expect(plan.next).toContain(`const FALLBACK_MEASURED_ON = '${TODAY}'`)
    expect(plan.next).toMatch(new RegExp(`^\\s*${keys[0]}:\\s*3\\.21,`, 'm'))
  })

  it('refuses when some keys were not read live, rather than re-dating their old values', () => {
    // The case that prompted this: Stride and Injective down, four keys unread.
    const unread = keys.slice(0, 4)
    const plan = planFallbackRefresh(
      routeSrc,
      reading(Object.fromEntries(unread.map((k) => [k, { source: 'estimate' }]))),
      TODAY,
    )
    expect(plan.skipped).toEqual(unread)
    expect(plan.refusal).toContain(`4 of the ${keys.length} measured keys were not read live`)
  })

  it('refuses when nothing came back live', () => {
    const plan = planFallbackRefresh(
      routeSrc,
      reading(Object.fromEntries(keys.map((k) => [k, { source: 'estimate' }]))),
      TODAY,
    )
    expect(plan.refusal).toBe('not one measured key came back live.')
  })

  it('treats a live zero as no rate: skipped with a reason, never written, and the write refused', () => {
    // A live 0 is "no rate reported". Writing it would publish 0% APR as measured.
    const plan = planFallbackRefresh(routeSrc, reading({ [keys[0]]: { rate: 0 } }), TODAY)
    expect(plan.skipped).toEqual([`${keys[0]} (live upstream reported 0 — no rate, prior value kept)`])
    expect(plan.changed.map((c) => c.key)).not.toContain(keys[0])
    expect(plan.refusal).not.toBeNull()
  })
})
