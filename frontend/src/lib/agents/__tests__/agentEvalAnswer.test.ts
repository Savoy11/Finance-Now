import { describe, expect, it } from 'vitest'
import { CUT_OFF_NOTICE as RUNNER_NOTICE } from '../runner'
import { CUT_OFF_NOTICE, answerForWorksheet, wasCutOff } from '../../../../scripts/lib/agentEvalAnswer.mjs'

// The agent-eval worksheet showed only an answer's first 12,000 characters, so a long
// answer's cut-off notice, which comes last, could never be seen (2026-10-18).

describe('the agent-eval worksheet’s answers', () => {
  it('reads the same cut-off notice the runner writes', () => {
    expect(CUT_OFF_NOTICE).toBe(RUNNER_NOTICE)
  })

  it('knows a cut-off answer from a finished one', () => {
    expect(wasCutOff(`Findings…\n\n${RUNNER_NOTICE}`)).toBe(true)
    expect(wasCutOff(`Findings…\n\n${RUNNER_NOTICE}\n`)).toBe(true)
    expect(wasCutOff('Findings… Conclusion.')).toBe(false)
  })

  it('keeps a long answer’s ending, where the notice would be', () => {
    const long = 'a'.repeat(20000) + `\n\n${RUNNER_NOTICE}`
    const shown = answerForWorksheet(long)
    expect(shown).toContain(RUNNER_NOTICE)
    expect(shown.length).toBeLessThan(12200)
    expect(shown).toMatch(/characters left out here/)
  })

  it('shows a short answer whole', () => {
    expect(answerForWorksheet('Short answer.')).toBe('Short answer.')
  })
})
