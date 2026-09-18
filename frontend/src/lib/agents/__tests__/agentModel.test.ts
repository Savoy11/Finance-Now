import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DEFAULTS, DEFAULT_ANTHROPIC_MODEL, PROVIDER_MODELS } from '../prompts'

/**
 * D20 prerequisite (2026-09-17): the agent model lives in exactly one place.
 *
 * Before this, `claude-sonnet-4-6` was written out in fourteen places — eleven
 * agent defaults, three pump-report route fallbacks — and the eval worksheet
 * named it from a fifteenth. That is not a style complaint. The decision doc had
 * to carry a standing note saying which model the agents were on, because no
 * single line in the code answered it, and a swap done by hand half-lands: the
 * routes move, one fallback does not, and the worksheet dates the results to a
 * model that never ran.
 *
 * So the value check is not the point — every site would still evaluate to the
 * same string if someone pasted the literal back in. These read the SOURCE, and
 * fail on a literal re-appearing anywhere outside the picker list.
 */

const SRC = join(process.cwd(), 'src')
const PROMPTS = join(SRC, 'lib', 'agents', 'prompts.ts')

/** Every .ts/.tsx under src/, minus test files (which quote ids on purpose). */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      sourceFiles(full, out)
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** Any quoted Anthropic model id, e.g. 'claude-sonnet-5'. */
const MODEL_LITERAL = /'claude-[a-z0-9-]+'/g

describe('the agent model has one home', () => {
  const files = sourceFiles(SRC)

  it('scans a plausible number of source files', () => {
    // Anti-vacuity: if the walker returns nothing the checks below all pass
    // by describing an empty set, which is the failure mode this test exists
    // to avoid in the first place.
    expect(files.length).toBeGreaterThan(50)
    expect(files).toContain(PROMPTS)
  })

  it('the default is a model the Integrations picker actually offers', () => {
    // A default outside the list renders as a selected option that is not in
    // the dropdown — the user cannot get back to it after changing it once.
    const offered = PROVIDER_MODELS.anthropic.map((m) => m.id)
    expect(offered).toContain(DEFAULT_ANTHROPIC_MODEL)
    expect(DEFAULT_ANTHROPIC_MODEL).toMatch(/^claude-/)
  })

  it('every agent default reads the constant rather than a literal', () => {
    expect(AGENT_DEFAULTS.length).toBeGreaterThan(8)
    for (const agent of AGENT_DEFAULTS) {
      expect(agent.model, `${agent.id} is pinned to something else`).toBe(DEFAULT_ANTHROPIC_MODEL)
    }

    // The source-level half: as many `model: DEFAULT_ANTHROPIC_MODEL` lines as
    // there are agents, and no `model: 'claude-…'` literal among them.
    const src = readFileSync(PROMPTS, 'utf-8')
    const wired = src.match(/^\s*model: DEFAULT_ANTHROPIC_MODEL,$/gm) ?? []
    expect(wired.length).toBe(AGENT_DEFAULTS.length)
    expect(src).not.toMatch(/^\s*model: 'claude-/m)
  })

  it('no file outside the picker list hardcodes an Anthropic model id', () => {
    const offenders: string[] = []
    for (const file of files) {
      const hits = readFileSync(file, 'utf-8').match(MODEL_LITERAL)
      if (!hits) continue
      // prompts.ts is the one home: its PROVIDER_MODELS entries are the menu
      // the user picks from, so literals there are the data, not a duplicate.
      if (file === PROMPTS) continue
      offenders.push(`${file.replace(SRC, 'src')} → ${hits.join(', ')}`)
    }
    expect(offenders, `import DEFAULT_ANTHROPIC_MODEL instead:\n  ${offenders.join('\n  ')}`).toEqual([])
  })
})
