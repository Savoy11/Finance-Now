import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * T-410 (2026-09-26). Both Portfolio Builder surfaces used to carry their own
 * hand-typed list of tiltable sectors — seven entries each — beside an engine map
 * that decides what a tilt actually buys. When D27 added four sector funds, the
 * engine could buy eleven and the UI would have kept offering seven. The list is
 * now exported from the engine and derived from the map; this pins that neither
 * UI file grows a typed copy back.
 *
 * Source-mirror test, comments stripped, because the property is about the shape
 * of the source, not a runtime value.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (rel: string) => strip(readFileSync(join(process.cwd(), rel), 'utf8'))

const UI_FILES = [
  'src/app/(dashboard)/portfolio-builder/page.tsx',
  'src/components/portfolio-builder/AllocationBuilder.tsx',
]

describe('the tiltable-sector list lives in the engine, and the UI imports it', () => {
  it('the engine derives TILTABLE_SECTORS from SECTOR_ETF rather than listing it', () => {
    const engine = read('src/lib/data/portfolioBuilder.ts')
    expect(engine).toMatch(/export const TILTABLE_SECTORS = Object\.keys\(SECTOR_ETF\) as SectorId\[\]/)
  })

  for (const rel of UI_FILES) {
    it(`${rel.split('/').pop()} imports TILTABLE_SECTORS and carries no typed sector list`, () => {
      const src = read(rel)
      expect(src).toMatch(/import \{[^}]*\bTILTABLE_SECTORS\b[^}]*\} from '@\/lib\/data\/portfolioBuilder'/)
      // A local array literal of sector ids named like the list is the regression.
      expect(src).not.toMatch(/const TILTABLE(?:_SECTORS)?\s*(?::\s*SectorId\[\])?\s*=\s*\[/)
    })
  }

  it('guards the guard: the regex would catch the pre-T-410 typed lists', () => {
    const page = "const TILTABLE_SECTORS: SectorId[] = [\n  'technology', 'financials',\n]"
    const builder = "const TILTABLE: SectorId[] = ['technology', 'financials']"
    const re = /const TILTABLE(?:_SECTORS)?\s*(?::\s*SectorId\[\])?\s*=\s*\[/
    expect(page).toMatch(re)
    expect(builder).toMatch(re)
  })
})
