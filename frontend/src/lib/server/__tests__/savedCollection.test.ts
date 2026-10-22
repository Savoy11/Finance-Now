import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { docIdOf, readSavedCollection } from '../../../../scripts/lib/savedCollection'

/**
 * The three check-page plans read the page's database as the ArtifactData tool saves it.
 * The tool writes "BIL:yield" as "BIL%3Ayield.json", since Windows cannot hold ':' in a file
 * name, and until 2026-10-21 every plan took the file name as the id, so on the owner's
 * machine every reading looked like a figure the catalog no longer had. The fixture folder
 * holds files named as the tool names them.
 */
const FIXTURES = join(process.cwd(), 'src/lib/server/__tests__/fixtures/saved-collection')

describe('reading a saved collection', () => {
  it('turns a file name back into its document id', () => {
    expect(docIdOf('BIL%3Ayield.json')).toBe('BIL:yield')
    expect(docIdOf('binance%3Abtc%3Aerc20.json')).toBe('binance:btc:erc20')
    expect(docIdOf('VOO.json')).toBe('VOO')
    expect(docIdOf('100%.json')).toBe('100%') // not valid percent-encoding: kept as it is
  })

  it('keys every document by its decoded id, unwraps { data }, and reports what it cannot read', () => {
    const warnings: string[] = []
    const got = readSavedCollection(FIXTURES, 'readings', (m) => warnings.push(m))
    expect(Object.keys(got).sort()).toEqual(['BIL:yield', 'OLD', 'VT:assets'])
    expect(got['BIL:yield']).toMatchObject({ result: 'read', value: 3.66, asOf: '2026-10-20', kind: 'trailing' })
    expect(got['VT:assets']).toEqual({ result: 'cant-see' })
    expect(warnings).toEqual(['  skipped readings/broken.json: not readable JSON'])
    expect(readSavedCollection(FIXTURES, 'no-such-collection')).toEqual({})
  })

  it('is the one reader all three plans use', () => {
    for (const f of ['scripts/fund-figures-plan.ts', 'scripts/fee-check-plan.ts', 'scripts/staking-facts-plan.ts']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      expect(src, f).toMatch(/readSavedCollection\(dir, name\)/)
      expect(src, f).not.toMatch(/readdirSync/)
    }
  })
})
