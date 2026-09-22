import { describe, it, expect } from 'vitest'
import { toClickRows } from '../AffiliateClicksPanel'

/**
 * The owner-only affiliate click view (queue item T-121).
 *
 * The invariant worth pinning is not the formatting — it is that the rows shown
 * always account for the total shown. The counter file outlives the catalog: a
 * provider can be renamed or retired while its recorded clicks stay on disk, so
 * "resolve the id to a name" has a real failure case, and the tidy-looking fix
 * (drop what you cannot name) would make the panel under-report without saying
 * so. These tests exist so that shortcut fails here instead of quietly shipping.
 */

const PROVIDERS = [
  { id: 'lido', name: 'Lido' },
  { id: 'kraken', name: 'Kraken' },
  { id: 'rocket-pool', name: 'Rocket Pool' },
] as const

describe('toClickRows', () => {
  it('resolves ids to catalog names', () => {
    const rows = toClickRows({ lido: 3 }, PROVIDERS)
    expect(rows).toEqual([{ id: 'lido', count: 3, name: 'Lido' }])
  })

  it('KEEPS a count whose id is no longer in the catalog, with a null name', () => {
    // The whole point: a retired provider's clicks stay on disk.
    const rows = toClickRows({ lido: 2, 'celsius-legacy': 5 }, PROVIDERS)
    expect(rows.map((r) => r.id)).toContain('celsius-legacy')
    expect(rows.find((r) => r.id === 'celsius-legacy')?.name).toBeNull()
  })

  it('rows always sum to the total the panel prints beside them', () => {
    // This is the assertion the "drop unknown ids" shortcut breaks, and it is
    // the reason the panel can be trusted as a count rather than a sample.
    const counts = { lido: 4, kraken: 1, 'gone-from-catalog': 7, 'also-gone': 2 }
    const rows = toClickRows(counts, PROVIDERS)
    const printedTotal = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(rows.reduce((a, r) => a + r.count, 0)).toBe(printedTotal)
    expect(rows).toHaveLength(4)
  })

  it('orders by count descending, breaking ties on id so the order is stable', () => {
    const rows = toClickRows({ kraken: 2, lido: 9, 'rocket-pool': 2 }, PROVIDERS)
    expect(rows.map((r) => r.id)).toEqual(['lido', 'kraken', 'rocket-pool'])
  })

  it('handles an empty counter without inventing a row', () => {
    expect(toClickRows({}, PROVIDERS)).toEqual([])
  })

  it('does not mutate or reorder the catalog it is given', () => {
    const before = PROVIDERS.map((p) => p.id)
    toClickRows({ kraken: 1, lido: 1 }, PROVIDERS)
    expect(PROVIDERS.map((p) => p.id)).toEqual(before)
  })
})
