/**
 * Which Anthropic models accept a `temperature` setting.
 *
 * Claude Opus 4.7 and every model after it refuse one with a 400 ("`temperature`
 * is deprecated for this model."): it is removed outright on Sonnet 5, Opus 4.7,
 * 4.8, 5 and 5.5 and Fable, and Sonnet 5.5 and Haiku 5.5 allow only the default.
 * Claude 4.6 and older still accept it.
 *
 * Found 2026-10-17 by the agent evaluation (D20): all eleven agents were refused,
 * because every request sent the agent's saved temperature to Claude Sonnet 5, the
 * default model since 2026-09-17. Every AI surface (the Assistant, Research, the
 * Daily Brief, the AI scans, Pump Report) had been failing the same way since then.
 * No test reaches the paid API, so nothing caught it.
 *
 * The rule is an allow-list of the older models, read from the model id. An id it
 * does not recognise, including a model released after this was written, gets no
 * temperature: leaving it out is always accepted, and sending it may not be.
 * Pure; `__tests__/sampling.test.ts`.
 */

/** claude-opus-4-6, claude-sonnet-4-20250514, claude-haiku-4-5-20251001, claude-sonnet-5 … */
const FAMILY_FIRST = /^claude-(?:opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-|\[|$)/

/** The older form: claude-3-haiku-…, claude-3-5-sonnet-…, claude-3-7-sonnet-… */
const VERSION_FIRST = /^claude-\d+(?:-\d+)?-(?:opus|sonnet|haiku)(?:-|\[|$)/

export function anthropicAcceptsTemperature(model: string): boolean {
  const id = String(model ?? '').trim().toLowerCase().replace(/^anthropic\./, '')
  // Every model named version-first is a Claude 3.x model, and all of them accept it.
  if (VERSION_FIRST.test(id)) return true
  const m = FAMILY_FIRST.exec(id)
  if (!m) return false
  const major = Number(m[1])
  const minor = m[2] === undefined ? 0 : Number(m[2])
  return major < 4 || (major === 4 && minor <= 6)
}

/**
 * The sampling fields to spread into an Anthropic request: `{ temperature }` for a
 * model that accepts it, and nothing for one that does not.
 */
export function anthropicSampling(model: string, temperature: number | undefined): { temperature?: number } {
  if (typeof temperature !== 'number' || !Number.isFinite(temperature)) return {}
  return anthropicAcceptsTemperature(model) ? { temperature } : {}
}
