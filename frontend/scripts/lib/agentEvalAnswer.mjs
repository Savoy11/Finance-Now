/**
 * How the agent-eval worksheet shows an answer (scripts/run-agent-eval.mjs). Pure, and
 * tested in lib/agents/__tests__/agentEvalAnswer.test.ts.
 *
 * The worksheet kept only an answer's first 12,000 characters. The runner marks an
 * answer stopped at its length limit by ending it with CUT_OFF_NOTICE, so a long answer
 * that was cut off could never show it: on 2026-10-18 the Equity Diligence report ran to
 * 16,641 characters, and whether it finished could not be read from the worksheet.
 */

/** The runner's last line on an answer stopped at its length limit (lib/agents/runner.ts; a test keeps the two equal). */
export const CUT_OFF_NOTICE = '(This answer was cut off at its length limit before it finished.)'

export function wasCutOff(text) {
  return typeof text === 'string' && text.trimEnd().endsWith(CUT_OFF_NOTICE)
}

/** The answer whole when it fits; otherwise its opening and its ending, so the last lines are never hidden. */
export function answerForWorksheet(text, limit = 12000, tail = 3000) {
  if (text.length <= limit) return text
  const left = text.length - limit
  return `${text.slice(0, limit - tail)}\n\n… ${left} characters left out here; the answer's last ${tail} follow …\n\n${text.slice(-tail)}`
}
