import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STAKING_PROVIDERS } from '../../data/stakingProviders'
import { LLAMA_SLUG } from '../../../../scripts/lib/stakingFactRows'

/**
 * `npm run staking-worksheet` (scripts/gen-staking-catalog-worksheet.ts) pre-fills a
 * re-verification worksheet for T-394. Read as source, like the other script mirrors,
 * because what matters is what it must NOT do (write the catalog, move the date) and
 * what must stay true (every DefiLlama slug it carries belongs to a real provider —
 * a stale id would silently drop that provider's TVL column).
 */
const src = readFileSync(join(process.cwd(), 'scripts/gen-staking-catalog-worksheet.ts'), 'utf8')
const root = join(process.cwd(), '..')
const gitignore = readFileSync(join(root, '.gitignore'), 'utf8')

describe('staking catalog worksheet generator', () => {
  it('takes its DefiLlama slugs from the shared list the Staking Facts Check page reads', () => {
    expect(src).toMatch(/import \{ LLAMA_SLUG \} from '\.\/lib\/stakingFactRows'/)
    expect(src).not.toMatch(/const LLAMA_SLUG/)
  })

  it('maps DefiLlama slugs only for providers that exist in the catalog', () => {
    const ids = Object.keys(LLAMA_SLUG)
    expect(ids.length).toBeGreaterThan(10)
    const known = new Set(STAKING_PROVIDERS.map((p) => p.id))
    for (const id of ids) expect(known.has(id), `LLAMA_SLUG names '${id}', not a provider id`).toBe(true)
  })

  it('maps no CeFi exchange — an exchange balance sheet is not a staking TVL', () => {
    const ids = Object.keys(LLAMA_SLUG)
    const cefi = new Set(STAKING_PROVIDERS.filter((p) => p.category === 'cefi').map((p) => p.id))
    for (const id of ids) expect(cefi.has(id), `${id} is a CeFi exchange`).toBe(false)
  })

  it('only reads the catalog: writes its two worksheets and nothing else', () => {
    const writes = [...src.matchAll(/writeFileSync\(\s*([A-Z_]+)/g)].map((m) => m[1])
    expect(writes.sort()).toEqual(['OUT_CSV', 'OUT_MD'])
    expect(src).not.toMatch(/stakingProviders\.ts['"]/)
    expect(src).not.toMatch(/STAKING_DATA_LAST_VERIFIED\s*=/)
  })

  it('its outputs are gitignored, so a half-filled worksheet cannot be committed by accident', () => {
    expect(gitignore).toContain('staking-catalog-worksheet.csv')
    expect(gitignore).toContain('staking-catalog-worksheet.md')
  })
})
