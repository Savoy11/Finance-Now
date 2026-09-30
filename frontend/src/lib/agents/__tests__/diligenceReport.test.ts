import { describe, expect, it } from 'vitest'
import { AGENT_DEFAULTS } from '../prompts'

/**
 * D34 (owner, 2026-09-29): the equity due-diligence report carries no numeric
 * score. It asked the agent for a `riskScore` (0–10, higher = more concerning)
 * until this date. Offered a rename — the Pump Report's identical field became
 * `suspicionScore` on 2026-09-08 — the owner chose removal instead:
 * "Remove it entirely; the backend of the risk assessment is most likely not correct".
 *
 * So this guards against the number coming back under ANY name, not only the old
 * one: a `concernScore` or `redFlagScore` would be the same unreviewed estimate
 * in a new label. The findings, their sources and the red-flag list remain the
 * report's evidence.
 */

const diligence = AGENT_DEFAULTS.find((a) => a.id === 'equity-diligence')

/** The JSON schema the agent is told to emit, between the REPORT markers. */
function reportSchema(prompt: string): string {
  const m = prompt.match(/<REPORT>([\s\S]*?)<\/REPORT>/)
  return m ? m[1] : ''
}

/** Every key in that schema whose name contains "score", whatever its prefix. */
function scoreKeys(prompt: string): string[] {
  return [...reportSchema(prompt).matchAll(/"([A-Za-z]+)"\s*:/g)]
    .map((m) => m[1])
    .filter((k) => /score/i.test(k))
}

describe('D34 — the equity diligence report carries no score', () => {
  it('finds the agent and its report schema', () => {
    // Guards the guard: if the agent is renamed or the markers move, the
    // assertions below must fail rather than pass against an empty string.
    expect(diligence, 'equity-diligence agent is missing from AGENT_DEFAULTS').toBeDefined()
    const schema = reportSchema(diligence!.systemPrompt)
    expect(schema).toContain('"executiveSummary"')
    expect(schema).toContain('"findings"')
    expect(schema).toContain('"redFlags"')
  })

  it('asks for no riskScore', () => {
    expect(reportSchema(diligence!.systemPrompt)).not.toMatch(/"riskScore"/)
  })

  it('asks for no score field under any other name', () => {
    expect(scoreKeys(diligence!.systemPrompt)).toEqual([])
  })

  it('guards the guard: a score re-added under a new name is caught', () => {
    const tainted = diligence!.systemPrompt.replace(
      '"executiveSummary"',
      '"concernScore": <0-10>,\n  "executiveSummary"',
    )
    expect(scoreKeys(tainted)).toEqual(['concernScore'])
    expect(reportSchema(tainted.replace('concernScore', 'riskScore'))).toMatch(/"riskScore"/)
  })
})
