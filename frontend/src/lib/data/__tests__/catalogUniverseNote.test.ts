import { describe, expect, it } from 'vitest'
import { EQUITY_CATALOG, catalogUniverseNote } from '../equityCatalog'

// The note the outlier scan carries when it ran over the hand-kept list. On
// 2026-10-17 the Equity Screener agent quoted Palantir's P/E of 250 and Tesla's
// of 200 as current: the note it read gave no date for those figures and said to
// add an FMP key that was already saved. Since D170 (2026-10-25) the screen's
// figures are worked out against live quotes, and the note says so.

describe('catalogUniverseNote', () => {
  it('says the figures are against live quotes, never a stored price', () => {
    const note = catalogUniverseNote(true)
    expect(note).toContain('against live quotes')
    expect(note).not.toMatch(/reference|beta/i)
  })

  it('counts the list from the catalog itself', () => {
    expect(catalogUniverseNote(true)).toContain(`hand-kept list of ${EQUITY_CATALOG.length} stocks`)
  })

  it('names the paid plan as the cure, with or without a key saved', () => {
    expect(catalogUniverseNote(true)).toContain('paid FMP plan, and the FMP key saved did not return it')
    expect(catalogUniverseNote(false)).toContain('paid FMP plan, and no FMP key is saved')
    expect(catalogUniverseNote(true)).not.toMatch(/add an FMP key/i)
  })
})
