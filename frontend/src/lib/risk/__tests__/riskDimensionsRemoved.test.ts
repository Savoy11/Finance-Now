import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Owner decision D26 (2026-09-25): the six per-provider staking risk dimensions —
 * custody, counterparty, contract, slashing, liquidity, regulatory, each 1–10 — are
 * REMOVED from every surface. D14 had removed every composite of them and kept the
 * six as "reference inputs"; D26 removes the inputs too, on RP-6's reasoning.
 *
 * What made this sharper than a taste call: the /staking page had never rendered
 * them. They reached a person only through the public API, the MCP tool and the
 * in-app agent tool — through an AI agent narrating "custody risk 2 out of 10" —
 * which is where a reference number most easily turns into advice.
 *
 * Same discipline as riskScoringRemoved.test.ts: read source, strip comments so a
 * tombstone naming the old identifier cannot mask a real return, and guard the guard.
 */

const root = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const DIMS = ['custodyRisk', 'counterpartyRisk', 'contractRisk', 'slashingRisk', 'liquidityRisk', 'regulatoryRisk']

describe('D26 — the six staking risk dimensions stay removed', () => {
  it('the catalog carries no RiskProfile, no risks blocks, no assetRisks and no mergedRisks', () => {
    const src = strip(read('lib/data/stakingProviders.ts'))
    expect(src).not.toMatch(/export interface RiskProfile/)
    expect(src).not.toMatch(/\brisks:\s*\{/)
    expect(src).not.toMatch(/\bassetRisks\b/)
    expect(src).not.toMatch(/export function mergedRisks/)
    for (const d of DIMS) expect(src, d).not.toContain(d)
  })

  it('the v1 API publishes no risk figures', () => {
    const src = strip(read('app/api/v1/staking/opportunities/route.ts'))
    // The FIELD, anchored to a line start — prose may name the removed field on purpose.
    expect(src).not.toMatch(/^\s*riskBreakdown:/m)
    expect(src).not.toMatch(/mergedRisks|effectiveRisks/)
    for (const d of DIMS) expect(src, d).not.toContain(d)
  })

  it('the OpenAPI spec describes none', () => {
    const src = strip(read('app/api/v1/openapi.json/route.ts'))
    expect(src).not.toMatch(/^\s*riskBreakdown:/m)
    expect(src).not.toMatch(/six curated risk/i)
  })

  it('the MCP tool and the agent tool report facts only', () => {
    const mcp = strip(readFileSync(join(process.cwd(), '..', 'mcp-server', 'src', 'index.ts'), 'utf8'))
    expect(mcp).not.toMatch(/riskBreakdown/)
    expect(mcp).not.toMatch(/Risk dimensions \(1–10/)
    expect(mcp).not.toMatch(/const DIMENSIONS = \['custody'/)
    const tools = strip(read('lib/agents/tools.ts'))
    expect(tools).not.toMatch(/six curated risk/i)
    expect(tools).toMatch(/NO risk scores, ratings or dimensions/)
  })

  it('staking-discovery derives none', () => {
    const lib = strip(read('lib/data/stakingDiscovery.ts'))
    expect(lib).not.toMatch(/RISK_PRESETS|adjustRiskFromSignals/)
    const route = strip(read('app/live-data/staking-discovery/route.ts'))
    expect(route).not.toMatch(/RISK_PRESETS|adjustRiskFromSignals|\brisks\b/)
  })

  it('the scorer is gone and not re-exported', () => {
    expect(existsSync(join(root, 'lib/risk/profiles/stakingAdapter.ts'))).toBe(false)
    expect(strip(read('lib/risk/index.ts'))).not.toMatch(/stakingAdapter/)
  })

  it('what D26 kept is still there: custodyModel is a fact, not a score', () => {
    const src = strip(read('lib/data/stakingProviders.ts'))
    expect(src).toMatch(/custodyModel:\s*'custodial' \| 'non-custodial' \| 'smart-contract'/)
    expect(src).toMatch(/defunct\?: boolean/)
  })

  it('guards the guard: the stripper leaves code and a dimension name would be seen', () => {
    const tainted = strip(read('lib/data/stakingProviders.ts')) + '\n  risks: { custodyRisk: 5 },\n'
    expect(tainted).toMatch(/\brisks:\s*\{/)
    expect(tainted).toContain('custodyRisk')
    // and a comment mentioning one is NOT seen — tombstones must not trip this
    expect(strip('// custodyRisk was removed\nconst x = 1\n')).not.toContain('custodyRisk')
  })
})
