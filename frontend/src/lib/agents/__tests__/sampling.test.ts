import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'

/**
 * No Claude request sends a sampling setting (D215, 2026-11-09).
 *
 * @anthropic-ai/sdk 1.x sends API version 2026-10-21, which refuses `temperature`, `top_p` and
 * `top_k` with a 400 on every model, even at their defaults. Before it, the app sent a temperature
 * only to Claude 4.6 and older (`anthropicSampling`, now removed): Claude Sonnet 5 and every model
 * after Opus 4.6 already refused one, which is how all eleven agents failed from 2026-09-17 until
 * the agent evaluation of 2026-10-17 found it. The owner chose to stop sending it to Claude at all.
 * Other providers (OpenAI-compatible) still get the agent's temperature. No test reaches the paid
 * API, so this reads the request code.
 */

const ROOT = process.cwd()

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      sourceFiles(full, out)
    } else if (/\.(tsx?|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

/** Each Claude request call's full argument text, by balancing parentheses, with its file. */
function claudeCalls(): Array<{ file: string; text: string }> {
  const files = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'scripts'))]
    .map((f) => ({ file: f.slice(ROOT.length + 1), code: stripComments(readFileSync(f, 'utf8')) as string }))
    .filter((f) => /from '@anthropic-ai\/sdk/.test(f.code))
  const out: Array<{ file: string; text: string }> = []
  for (const f of files) {
    for (const m of f.code.matchAll(/\bmessages\.(?:create|stream|parse|countTokens)\(/g)) {
      const open = (m.index ?? 0) + m[0].length - 1
      let depth = 0, end = open
      for (let i = open; i < f.code.length; i++) {
        if (f.code[i] === '(') depth += 1
        else if (f.code[i] === ')') { depth -= 1; if (depth === 0) { end = i; break } }
      }
      out.push({ file: f.file, text: f.code.slice(open, end + 1) })
    }
  }
  return out
}

describe('no Claude request sends temperature, top_p or top_k', () => {
  const calls = claudeCalls()

  it('finds the Claude calls to check', () => {
    // The agent runner, the three Pump Report routes and the site-terms and pre-fill scripts, today.
    expect(calls.length).toBeGreaterThanOrEqual(6)
  })

  it('sends none of them, directly or spread in', () => {
    for (const c of calls) {
      expect(c.text, c.file).not.toMatch(/\b(?:temperature|top_p|top_k|topP|topK)\b/)
      expect(c.text, `${c.file}: a spread could carry a sampling setting`).not.toMatch(/\.\.\.\s*\w*[Ss]ampling\b/)
    }
  })

  it('still sends the agent’s temperature to other providers', () => {
    const runner = stripComments(readFileSync(join(ROOT, 'src/lib/agents/runner.ts'), 'utf8')) as string
    expect(runner).toMatch(/chat\.completions\.create\(\{[\s\S]*?temperature: cfg\.temperature/)
  })

  it('says on the AI Agents tab that Claude ignores the slider', () => {
    const page = readFileSync(join(ROOT, 'src/app/(dashboard)/agent-config/page.tsx'), 'utf8')
    expect(page).toMatch(/provider === 'anthropic' && \(/)
    expect(page).toContain('Claude takes no temperature setting on any model')
  })
})
