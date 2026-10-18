import { describe, expect, it } from 'vitest'
import { EQUITY_CATALOG, EQUITY_REFERENCE_AS_OF, catalogUniverseNote } from '../equityCatalog'

// The note the outlier scan carries when it ran over the hand-kept list. On
// 2026-10-17 the Equity Screener agent quoted Palantir's P/E of 250 and Tesla's
// of 200 as current: the note it read gave no date for those figures and said to
// add an FMP key that was already saved.

describe('catalogUniverseNote', () => {
  const now = new Date('2026-10-17T12:00:00Z')

  it('dates the figures and says they are not live', () => {
    const note = catalogUniverseNote(true, now)
    expect(note).toContain(EQUITY_REFERENCE_AS_OF)
    expect(note).toContain('102 days before this screen')
    expect(note).toContain('not live')
  })

  it('counts the list from the catalog itself', () => {
    expect(catalogUniverseNote(true, now)).toContain(`hand-kept list of ${EQUITY_CATALOG.length} stocks`)
  })

  it('names the paid plan as the cure, with or without a key saved', () => {
    expect(catalogUniverseNote(true, now)).toContain('paid FMP plan, and the FMP key saved did not return it')
    expect(catalogUniverseNote(false, now)).toContain('paid FMP plan, and no FMP key is saved')
    expect(catalogUniverseNote(true, now)).not.toMatch(/add an FMP key/i)
  })
})
