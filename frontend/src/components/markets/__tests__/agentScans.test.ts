import { describe, it, expect } from 'vitest'
import {
  runAgentScan, distinctToolNames, AGENT_SCANS, EQUITY_OUTLIER_SCAN, MACRO_MOVERS_SCAN,
} from '../agentScans'

/**
 * The AI scans on market pages (AgentScanPanel). The panel itself has no test
 * renderer here, so everything it decides lives in runAgentScan — what it sends,
 * and how each way a request can fail reaches the reader as a sentence rather
 * than a blank panel or a thrown error.
 */

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return respond()
  }) as unknown as typeof fetch
  return { calls, impl }
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('running a scan', () => {
  it('posts the scan’s own task and agent to the research route', async () => {
    const f = fakeFetch(() => json({ ok: true, report: 'Regime read…', toolsUsed: [] }))
    await runAgentScan(MACRO_MOVERS_SCAN, f.impl)
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0].url).toBe('/api/agents/research')
    expect(f.calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ task: MACRO_MOVERS_SCAN.task, agentId: 'macro-screener' })
  })

  it('returns the report and the tools the agent called', async () => {
    const tools = [{ name: 'get_macro_quote' }, { name: 'get_yield_curve' }, { name: 'get_macro_quote' }]
    const f = fakeFetch(() => json({ ok: true, report: 'Top movers…', toolsUsed: tools, agentId: 'macro-screener' }))
    const out = await runAgentScan(MACRO_MOVERS_SCAN, f.impl)
    expect(out).toEqual({ ok: true, report: 'Top movers…', toolsUsed: tools })
    if (out.ok) expect(distinctToolNames(out.toolsUsed)).toEqual(['get_macro_quote', 'get_yield_curve'])
  })

  it('passes the route’s own refusal through — a missing key or a disabled agent', async () => {
    const f = fakeFetch(() => json({ error: 'ANTHROPIC_API_KEY is not set' }, 503))
    expect(await runAgentScan(EQUITY_OUTLIER_SCAN, f.impl)).toEqual({ ok: false, error: 'ANTHROPIC_API_KEY is not set' })
  })

  it('names the status when a failure carries no message', async () => {
    const f = fakeFetch(() => json({}, 500))
    expect(await runAgentScan(MACRO_MOVERS_SCAN, f.impl)).toEqual({ ok: false, error: 'Scan failed (HTTP 500).' })
  })

  it('reads a body that is not JSON as a failure, not a crash', async () => {
    const f = fakeFetch(() => new Response('<html>Gateway Timeout</html>', { status: 504 }))
    expect(await runAgentScan(MACRO_MOVERS_SCAN, f.impl)).toEqual({ ok: false, error: 'The scan returned no readable answer (HTTP 504).' })
  })

  it('turns a dropped connection into a sentence', async () => {
    const impl = (async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
    expect(await runAgentScan(MACRO_MOVERS_SCAN, impl)).toEqual({ ok: false, error: 'Failed to fetch' })
  })

  it('does not show an empty report as a finished scan', async () => {
    const f = fakeFetch(() => json({ ok: true, report: '   ', toolsUsed: [] }))
    expect(await runAgentScan(MACRO_MOVERS_SCAN, f.impl)).toEqual({ ok: false, error: 'The agent finished without writing a report.' })
  })

  it('drops tool entries it cannot name', async () => {
    const f = fakeFetch(() => json({ ok: true, report: 'r', toolsUsed: [{ name: 'get_fx_rates' }, null, { id: 3 }, 'x'] }))
    const out = await runAgentScan(MACRO_MOVERS_SCAN, f.impl)
    expect(out.ok && out.toolsUsed).toEqual([{ name: 'get_fx_rates' }])
  })
})

describe('the scans', () => {
  it('each runs a different agent', () => {
    expect(new Set(AGENT_SCANS.map((s) => s.agentId)).size).toBe(AGENT_SCANS.length)
  })

  it('the macro scan asks for unpriced instruments to be named, never estimated', () => {
    // Macro quotes are key-gated and often missing; a movers ranking that filled
    // the gaps with guesses would read as a live market sweep.
    expect(MACRO_MOVERS_SCAN.task).toMatch(/no price, say so/)
    expect(MACRO_MOVERS_SCAN.task).toMatch(/rather than estimating/)
    expect(MACRO_MOVERS_SCAN.coverage).toMatch(/never estimated/)
  })
})
