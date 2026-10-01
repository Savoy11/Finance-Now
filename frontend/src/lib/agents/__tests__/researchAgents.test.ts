import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { AGENT_DEFAULTS } from '../prompts'
import { AGENT_SCANS, EQUITY_OUTLIER_SCAN, MACRO_MOVERS_SCAN } from '@/components/markets/agentScans'

/**
 * NT5 guard — the Research page's agent picker, the run route's whitelist, and
 * the agent catalog must name the same agents.
 *
 * This is the NT12 pattern applied to a third boundary. The failure it prevents
 * has already happened here once: three agents existed in AGENT_DEFAULTS with
 * editable prompts and no invocation path, so they were configurable and
 * unrunnable for months without anything failing. A chip posting an id the
 * route rejects is the same bug pointing the other way.
 */

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

const ROUTE = read('src/app/api/agents/research/route.ts')
const PAGE = read('src/app/(dashboard)/research/page.tsx')

/** Ids inside the route's RESEARCH_AGENTS set literal. */
const whitelisted = (() => {
  const block = ROUTE.match(/const RESEARCH_AGENTS = new Set\(\[([\s\S]*?)\]\)/)
  expect(block, 'RESEARCH_AGENTS must be a Set literal the guard can read').not.toBeNull()
  return Array.from(block![1].matchAll(/'([a-z-]+)'/g)).map((m) => m[1])
})()

/**
 * The MARKET_AGENTS literal body. Extracted once and reused, because the page
 * also declares EXAMPLES with the same three market keys — matching market
 * groups across the whole file would pick up both.
 */
const MARKET_AGENTS_BODY = (() => {
  const block = PAGE.match(/const MARKET_AGENTS: Record<Market, AgentChoice\[\]> = \{([\s\S]*?)\n\}/)
  expect(block, 'MARKET_AGENTS must be a literal the guard can read').not.toBeNull()
  return block![1]
})()

/** Ids the picker offers, from MARKET_AGENTS. */
const offered = Array.from(MARKET_AGENTS_BODY.matchAll(/id: '([a-z-]+)'/g)).map((m) => m[1])

describe('NT5 — research agent wiring', () => {
  it('the guard actually parsed both files (guards the guard)', () => {
    expect(whitelisted.length).toBeGreaterThan(4)
    expect(offered.length).toBeGreaterThan(4)
  })

  it('every agent the picker offers is accepted by the run route', () => {
    const rejected = offered.filter((id) => !whitelisted.includes(id))
    expect(rejected, `picker offers agents the route would 400: ${rejected.join(', ')}`).toEqual([])
  })

  it('every whitelisted agent is reachable from the picker', () => {
    // The reverse direction is the NT5 defect itself: runnable in principle,
    // with no way for a user to get there.
    const unreachable = whitelisted.filter((id) => !offered.includes(id))
    expect(unreachable, `route accepts agents no UI can select: ${unreachable.join(', ')}`).toEqual([])
  })

  it('every offered agent exists in the agent catalog', () => {
    const known = new Set(AGENT_DEFAULTS.map((a) => a.id))
    const phantom = offered.filter((id) => !known.has(id))
    expect(phantom, `picker names agents with no definition: ${phantom.join(', ')}`).toEqual([])
  })

  it('each offered agent is filed under the market whose tools it can use', () => {
    // An equities agent listed under Macro would run with the wrong toolset and
    // produce a confidently irrelevant report rather than an error.
    const byId = new Map(AGENT_DEFAULTS.map((a) => [a.id, a]))
    const marketBlocks = Array.from(
      MARKET_AGENTS_BODY.matchAll(/^  (crypto|equities|macro): \[([\s\S]*?)^  \],$/gm),
    )
    expect(marketBlocks.length, 'expected three market groups in MARKET_AGENTS').toBe(3)
    for (const [, market, body] of marketBlocks) {
      for (const [, id] of body.matchAll(/id: '([a-z-]+)'/g)) {
        expect(byId.get(id)?.market, `${id} is offered under ${market}`).toBe(market)
      }
    }
  })

  it('the three NT5 agents are now invocable', () => {
    // Named explicitly: this is the finding NT5 closed, and a regression that
    // silently dropped one from the picker would still pass the symmetry checks
    // above (both sides would simply lose it together).
    for (const id of ['data-scraper', 'equity-data-scraper', 'equity-diligence']) {
      expect(whitelisted, `${id} must be runnable`).toContain(id)
      expect(offered, `${id} must be selectable`).toContain(id)
    }
  })
})

describe('AI scans on market pages — the same boundary, a fourth surface', () => {
  // A page's scan button posts an agent id like the picker does, so it can break
  // the same two ways: an id the route refuses, or an agent run off its market's
  // tools. And the macro screener was the NT5 defect's last case: whitelisted,
  // with a panel approved (NT6), reachable only by a deep link (P3 review X5).

  it('every scan runs an agent the route accepts', () => {
    expect(AGENT_SCANS.length, 'guards the guard: the scan list was read').toBeGreaterThan(1)
    for (const scan of AGENT_SCANS) expect(whitelisted, `${scan.title} posts ${scan.agentId}`).toContain(scan.agentId)
  })

  it('every scan sits in the module whose tools its agent uses', () => {
    const byId = new Map(AGENT_DEFAULTS.map((a) => [a.id, a]))
    for (const scan of AGENT_SCANS) {
      expect(byId.get(scan.agentId)?.market, `${scan.title} (${scan.agentId})`).toBe(scan.market)
    }
  })

  it('each scan is mounted on a page of its own module', () => {
    expect(read('src/app/(dashboard)/macro/scanner/page.tsx')).toContain(`<AgentScanPanel scan={MACRO_MOVERS_SCAN} />`)
    expect(read('src/components/markets/OutlierScanPanel.tsx')).toContain(`<AgentScanPanel scan={EQUITY_OUTLIER_SCAN} />`)
    expect(read('src/app/(dashboard)/equities/scanner/page.tsx')).toMatch(/<OutlierScanPanel \/>/)
    expect(MACRO_MOVERS_SCAN.market).toBe('macro')
    expect(EQUITY_OUTLIER_SCAN.market).toBe('equities')
  })

  it('the AI Agents tab no longer sends the macro screener to a deep link', () => {
    expect(read('src/app/(dashboard)/agent-config/page.tsx')).not.toMatch(/No panel yet/)
  })
})
