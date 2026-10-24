import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The Coins page's "24h Breadth" card printed "-33.00%" under 21 advancers and 54
 * decliners (T-129, 2026-10-24): it passed advancers minus decliners to MetricCard's
 * `trend`, which formats as a percentage. A count is not a percentage.
 */
const src = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(dashboard)/assets/AssetRegistryClient.tsx'), 'utf8',
).replace(/\/\/.*$/gm, '')

describe('Coins page breadth card', () => {
  it('passes no trend, so no count is shown as a percentage', () => {
    const card = src.slice(src.indexOf('title="24h Breadth"'), src.indexOf('title="Matches"'))
    expect(card.length).toBeGreaterThan(0)
    expect(card).not.toMatch(/\btrend=/)
  })

  it('says how many coins the counts cover', () => {
    expect(src).toContain('advancers vs decliners, of ${kpi.breadthKnown} with a 24h change')
  })
})
