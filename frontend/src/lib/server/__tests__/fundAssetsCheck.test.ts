import { describe, it, expect } from 'vitest'
import { assetsReport, compareFiled, toCatalogAumB } from '../../../../scripts/lib/fundAssetsCheck'
import { REREAD_STEPS } from '../../../../scripts/lib/accuracyCheck'

// D168 (2026-10-25): the catalog's filed asset figures against each fund's newest NPORT-P.
// Fixtures are AGG's and SGOV's rows as the first run found them.

const agg = { symbol: 'AGG', aumB: 136, aumAsOf: '2026-05-31', aumSource: '0001410368-26-075254' }

describe('compareFiled', () => {
  it('reports a newer filing with the figure at the catalog’s precision', () => {
    const line = compareFiled(agg, { kind: 'nport', asOf: '2026-08-31', netAssets: 138_041_000_000, accession: '0001410368-26-108090', filedAt: '2026-10-24' })
    expect(line).toMatchObject({ status: 'newer', proposedAumB: 138, changePct: 1.5, filed: { asOf: '2026-08-31', accession: '0001410368-26-108090' } })
  })

  it('calls the same period current and an earlier one older, never newer', () => {
    expect(compareFiled(agg, { kind: 'nport', asOf: '2026-05-31', netAssets: 136e9, accession: 'x', filedAt: null }).status).toBe('same')
    expect(compareFiled(agg, { kind: 'nport', asOf: '2026-02-28', netAssets: 130e9, accession: 'x', filedAt: null }).status).toBe('older')
  })

  it('never proposes a figure from a filing that states no period or no net assets', () => {
    const line = compareFiled(agg, { kind: 'nport', asOf: null, netAssets: 1e9, accession: 'x', filedAt: null })
    expect(line).toMatchObject({ status: 'error' })
    expect(line.proposedAumB).toBeUndefined()
  })

  it('passes a trust that files no N-PORT through with the reason', () => {
    expect(compareFiled({ ...agg, symbol: 'GLD' }, { kind: 'not-nport', why: 'not in the SEC’s fund ticker map' })).toMatchObject({ status: 'not-nport', why: 'not in the SEC’s fund ticker map' })
  })

  it('rounds to three significant figures, as the catalog writes them', () => {
    expect(toCatalogAumB(105_960_000_000)).toBe(106)
    expect(toCatalogAumB(22_712_000_000)).toBe(22.7)
    expect(toCatalogAumB(724_734_128)).toBe(0.725)
    expect(toCatalogAumB(48_191_440)).toBe(0.0482)
  })
})

describe('the report', () => {
  it('brings every newer filing to the owner and lists trusts to read from their own filings', () => {
    const lines = [
      compareFiled(agg, { kind: 'nport', asOf: '2026-08-31', netAssets: 138e9, accession: 'A1', filedAt: null }),
      compareFiled({ ...agg, symbol: 'GLD' }, { kind: 'not-nport', why: 'x' }),
    ]
    const text = assetsReport(lines, '2026-10-25')
    expect(text).toContain('bring to the owner before any change')
    expect(text).toMatch(/AGG +136B as of 2026-05-31 → +138B as of 2026-08-31 \(\+1\.5%\), A1/)
    expect(text).toContain('GLD (2026-05-31)')
  })

  it('is the re-read the quarterly report names for filed figures (D168), not fund-facts', () => {
    const steps = REREAD_STEPS['fund-assets-filed'].join(' ')
    expect(steps).toContain('npm run fund-assets-check')
    expect(steps).not.toContain('fund-facts')
  })
})
