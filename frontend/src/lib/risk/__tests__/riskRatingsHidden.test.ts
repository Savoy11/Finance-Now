import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { NextRequest } from 'next/server'
import { RISK_RATINGS_SHOWN } from '../visibility'
import { AGENT_TOOLS, WITHHELD_TOOLS, runTool, toolsForAgent, type ToolSet } from '@/lib/agents/tools'
import { MODULES, flattenNavItems } from '@/lib/modules/registry'
import { getDiversificationWarnings, type ComputedHolding, type PortfolioMetrics } from '@/lib/data/portfolioUtils'
import { GET as optionsScoreGet, POST as optionsScorePost } from '@/app/api/v1/options/score/route'

/**
 * Owner decision D64, 2026-10-04: every risk rating the app shows is switched
 * off until the risk engine is rebuilt and the compliance research on whether
 * and how risk can be rated for each asset type is done. The code stays, so
 * nothing here checks that it is gone: it checks that no reader reaches it.
 *
 * If you are restoring a surface on purpose, this file is the list to work
 * through, one decision at a time (lib/risk/visibility.ts says what each
 * surface needs). riskScoringRemoved.test.ts guards the earlier, separate
 * removals (RP-6, D14, D26), which this does not reopen.
 */

const repo = (rel: string) => path.join(process.cwd(), rel)

/** Source with comments stripped, so a removal note naming the thing is not mistaken for the thing. */
const code = (rel: string) =>
  fs.readFileSync(repo(rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

afterEach(() => { vi.unstubAllGlobals() })

describe('D64: risk ratings are switched off', () => {
  it('the switch is off', () => {
    expect(RISK_RATINGS_SHOWN).toBe(false)
  })

  it('the options scoring API answers 503 to both methods', async () => {
    const post = await optionsScorePost(new Request('http://localhost/api/v1/options/score', {
      method: 'POST',
      body: JSON.stringify({ underlyingPrice: 100, daysToExpiry: 30, legs: [{ side: 'long', type: 'call', strike: 100, bid: 1, ask: 1.1 }] }),
    }) as unknown as NextRequest)
    expect(post.status).toBe(503)
    expect((await post.json()).error).toMatch(/not available/)
    const get = await optionsScoreGet()
    expect(get.status).toBe(503)
  })

  it('no agent is offered the options scoring tool, whatever its toolset', () => {
    expect(WITHHELD_TOOLS.has('score_options_trade')).toBe(true)
    const toolsets: ToolSet[] = ['crypto', 'equities', 'macro', 'all']
    for (const set of toolsets) {
      expect(toolsForAgent(set).map((t) => t.name), set).not.toContain('score_options_trade')
    }
    expect(AGENT_TOOLS.map((t) => t.name)).not.toContain('score_options_trade')
  })

  it('a model naming the withheld tool anyway gets the reason, and nothing is fetched', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const out = await runTool('score_options_trade', { underlyingPrice: 100 }, 'http://localhost') as { error?: string }
    expect(out.error).toMatch(/switched off/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('the options page is out of the menu and its address redirects', () => {
    const hrefs = MODULES.flatMap((m) => flattenNavItems(m.navItems)).map((i) => i.href)
    expect(hrefs).not.toContain('/equities/options')
    expect(code('next.config.mjs')).toMatch(/source: '\/equities\/options', destination: '\/equities'/)
  })

  it('the MCP server registers no options scoring tool, and does not describe itself as having one', () => {
    const mcp = code('../mcp-server/src/index.ts')
    expect(mcp).not.toContain("'score_options_trade'")
    // Every client receives the server's description when it connects. It ended
    // "and an options-trade risk scorer" until 2026-10-04, after the tool was off.
    expect(mcp).not.toMatch(/risk scorer/i)
  })

  it('the agent prompts no longer send anyone to the scorer', () => {
    const prompts = code('src/lib/agents/prompts.ts')
    expect(prompts).not.toMatch(/use score_options_trade/)
    expect(prompts).not.toMatch(/Trade Risk Scorer \(\/equities\/options\): describe/)
  })

  it('a high portfolio risk score is not put into words', () => {
    const metrics = { weightedRisk: 8.5, largestPosition: null, stablecoinPct: 0, categoryBreakdown: [{}, {}] } as unknown as PortfolioMetrics
    const holdings = [{}, {}, {}] as unknown as ComputedHolding[]
    const warnings = getDiversificationWarnings(holdings, metrics)
    expect(warnings.map((w) => w.message).join(' ')).not.toMatch(/risk score|leans aggressive/)
  })

  it('the Portfolios page, the fund page and the fund list each read the switch', () => {
    // The surfaces keep their rating code behind the switch. A page that stopped
    // reading it would be showing ratings again, whatever the switch says.
    for (const f of [
      'src/app/(dashboard)/portfolios/page.tsx',
      'src/app/(dashboard)/funds/[symbol]/page.tsx',
      'src/app/live-data/fund-universe/route.ts',
    ]) {
      expect(code(f), f).toContain('RISK_RATINGS_SHOWN')
    }
  })

  it('the fund page adds its Risk Profile line only through the switch', () => {
    const src = code('src/app/(dashboard)/funds/[symbol]/page.tsx')
    expect(src).toMatch(/RISK_RATINGS_SHOWN \? \[\{ label: 'Risk Profile'/)
  })

  it('guards the guard: the comment stripper keeps code and drops comments', () => {
    const src = code('src/lib/modules/registry.ts')
    expect(src).toContain('export const MODULES')
    expect(src).not.toContain('Options Scorer HIDDEN')
  })
})
