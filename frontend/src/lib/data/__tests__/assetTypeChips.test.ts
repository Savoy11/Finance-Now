import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ASSET_CATALOG } from '../assetCatalog'
import { ASSET_LIST } from '../assetList'

// TS-1 and TS-2 (docs/assessments/tokenized-securities-2026-09-21.md §7B).
// USDY is a tokenized Treasury note, not a stablecoin, and the Coins page's
// type filter must not offer a chip that can match no coin.

const REGISTRY = path.join(process.cwd(), 'src/app/(dashboard)/assets/AssetRegistryClient.tsx')

/** The `value`s of TYPE_CHIPS, read from the page source (it is a client component). */
function chipValues(): string[] {
  const src = fs.readFileSync(REGISTRY, 'utf8')
  const block = src.match(/const TYPE_CHIPS[\s\S]*?\n\]/)
  if (!block) throw new Error('TYPE_CHIPS not found in AssetRegistryClient.tsx')
  return [...block[0].matchAll(/value:\s*'([\w-]+)'/g)].map((m) => m[1])
}

describe('USDY', () => {
  it('is filed as a tokenized security in both lists', () => {
    expect(ASSET_CATALOG.find((a) => a.id === 'usdy')?.assetType).toBe('tokenized')
    expect(ASSET_LIST.find((a) => a.id === 'usdy')?.category).toBe('tokenized')
  })
})

describe('tokenized entries', () => {
  it('carry no peg, since a tokenized security has none to keep', () => {
    for (const a of ASSET_CATALOG.filter((x) => x.assetType === 'tokenized')) {
      expect(a.pegTarget, a.id).toBeUndefined()
      expect(a.pegDeviation, a.id).toBeNull()
      expect(a.pegDeviationBps ?? null, a.id).toBeNull()
    }
  })
})

describe('the Coins page type chips', () => {
  it('can each match at least one coin in the catalog', () => {
    const types = new Set(ASSET_CATALOG.map((a) => a.assetType))
    const values = chipValues()
    expect(values.length).toBeGreaterThan(1)
    for (const v of values) {
      if (v === 'all') continue
      expect(types.has(v as (typeof ASSET_CATALOG)[number]['assetType']), `the ${v} chip matches no coin`).toBe(true)
    }
  })
})
