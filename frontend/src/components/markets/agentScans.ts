// The AI scans mounted on market pages: a button that runs one whitelisted agent
// over a whole universe and shows its report.
//
// Two exist. The Equity Screener's "AI Outlier Scan" sits on the Stock Registry
// and the Equity Scanner. The Macro Screener's "AI Movers Scan" sits on the Macro
// Scanner (2026-10-01): NT6 approved that capability on 2026-08-12, then folded it
// into the per-section scanner work on 2026-08-18, and the scanner shipped
// without it — so the agent stayed reachable only through a /research deep link
// (P3 review X5).
//
// Both panels render through one component (AgentScanPanel), so a fix to the
// panel reaches both. lib/agents/__tests__/researchAgents.test.ts holds every scan
// here to the run route's whitelist and to its agent's market.

export type AgentScanMarket = 'equities' | 'macro'

export interface AgentScan {
  /** An agent id the /api/agents/research route whitelists. */
  agentId: string
  /** The module whose pages mount this scan; must equal the agent's own market. */
  market: AgentScanMarket
  /** The agent's name as the AI Agents tab shows it. */
  agentName: string
  title: string
  blurb: string
  /** The task sent to the agent. Its system prompt carries the method and the rules. */
  task: string
  reportTitle: string
  progress: string
  /** Shown beside the run button: what the report can and cannot rest on. */
  coverage?: string
}

export const EQUITY_OUTLIER_SCAN: AgentScan = {
  agentId: 'equity-screener',
  market: 'equities',
  agentName: 'Equity Screener',
  title: 'AI Outlier Scan',
  blurb: 'Scans the whole universe for sector-relative outliers and explains opportunities vs traps.',
  task: 'Scan the equities universe for the most statistically significant outliers. Call get_stock_outliers first, then investigate the most notable names and classify each as an opportunity, a trap, or fairly-explained. Group by theme and end with a short watch list.',
  reportTitle: 'Outlier Report',
  progress: 'Computing outliers and analyzing…',
}

export const MACRO_MOVERS_SCAN: AgentScan = {
  agentId: 'macro-screener',
  market: 'macro',
  agentName: 'Macro Screener',
  title: 'AI Movers Scan',
  blurb: 'Sweeps commodities, currencies and rates for the biggest moves and explains what is driving them.',
  // Points the agent at its own method rather than restating it, so the prompt in
  // the AI Agents tab stays the one place the method lives. The no-estimates line
  // is repeated on purpose: macro quotes are key-gated, and on most setups many
  // instruments come back unpriced.
  task: 'Sweep the macro universe for the biggest moves and regime signals and explain what is driving them. Follow your method: list the universe, quote every instrument you can, read the official yield curve, then look into the biggest standouts. Where an instrument returns no price, say so and leave it out of the ranking rather than estimating it.',
  reportTitle: 'Movers Report',
  progress: 'Pricing the macro universe and reading the drivers…',
  coverage: 'Prices come from the same quote sources as this page. An instrument with no price is reported as unpriced, never estimated.',
}

export const AGENT_SCANS: readonly AgentScan[] = [EQUITY_OUTLIER_SCAN, MACRO_MOVERS_SCAN]

export interface AgentScanTool {
  name: string
}

export type AgentScanResult =
  | { ok: true; report: string; toolsUsed: AgentScanTool[] }
  | { ok: false; error: string }

/**
 * Run a scan through /api/agents/research and read the answer. Never throws: a
 * refused request, a body that is not JSON and a dropped connection all come back
 * as `{ ok: false, error }` with the route's own message where it sent one.
 * `fetchImpl` is injectable so the request and every failure path are testable.
 */
export async function runAgentScan(scan: AgentScan, fetchImpl: typeof fetch = fetch): Promise<AgentScanResult> {
  let res: Response
  try {
    res = await fetchImpl('/api/agents/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: scan.task, agentId: scan.agentId }),
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
  let data: { error?: unknown; report?: unknown; toolsUsed?: unknown }
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: `The scan returned no readable answer (HTTP ${res.status}).` }
  }
  if (!res.ok || data.error) {
    return { ok: false, error: typeof data.error === 'string' && data.error ? data.error : `Scan failed (HTTP ${res.status}).` }
  }
  if (typeof data.report !== 'string' || !data.report.trim()) {
    return { ok: false, error: 'The agent finished without writing a report.' }
  }
  const toolsUsed = Array.isArray(data.toolsUsed)
    ? data.toolsUsed.filter((t): t is AgentScanTool => !!t && typeof (t as AgentScanTool).name === 'string')
    : []
  return { ok: true, report: data.report, toolsUsed }
}

/** Each tool the agent called, once, in the order it was first called. */
export function distinctToolNames(tools: readonly AgentScanTool[]): string[] {
  return Array.from(new Set(tools.map((t) => t.name)))
}
