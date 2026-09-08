import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(root, p), 'utf-8')

/**
 * Phase 6 of the risk-scale spec renamed this field. The guard is textual
 * because the value is produced by a model against a prompt, not by typed code:
 * if the prompt template and the reader ever disagree on the key, the score
 * silently reads 0 and the UI shows a clean bar for an unscored report.
 */
describe('pump-report suspicionScore (Phase 6 rename)', () => {
  const route = read('app/live-data/pump-report/investigate/route.ts')
  const tab = read('components/pump-report/PumpReportTab.tsx')

  it('asks the model for suspicionScore in the prompt template', () => {
    expect(route).toContain('"suspicionScore": <0.0-10.0>')
    expect(route).not.toContain('"riskScore": <0.0-10.0>')
  })

  it('declares suspicionScore on the report interface', () => {
    expect(route).toMatch(/^\s*suspicionScore: number$/m)
    expect(route).not.toMatch(/^\s*riskScore: number$/m)
  })

  it('reads the same key the prompt asks for', () => {
    expect(tab).toContain('report.suspicionScore')
    expect(tab).not.toMatch(/report\.riskScore/)
  })

  it('leaves no riskScore key anywhere in the pump-report surface', () => {
    // Comments explaining the rename are fine; a live `riskScore:` key or a
    // `.riskScore` read is not.
    for (const src of [route, tab]) {
      expect(src).not.toMatch(/(?<!\/\/.*)\briskScore:\s/)
      expect(src).not.toMatch(/\.riskScore\b/)
    }
  })

  it('labels the bar as suspicion, not risk — RP-6 forbids publishing a risk figure', () => {
    expect(tab).toContain('Fraud Suspicion')
    expect(tab).not.toContain('>Fraud Risk<')
  })
})
