import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * FALLBACK carries two kinds of number, and the difference is the whole point:
 * 27 keys were read from a live upstream on FALLBACK_MEASURED_ON, and 24 are
 * undated hand-written estimates that have never been checked.
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
  join(root, 'src/app/live-data/staking-rates/route.ts'),
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
