import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { anthropicAcceptsTemperature, anthropicSampling } from '../sampling'
import { DEFAULT_ANTHROPIC_MODEL, PROVIDER_MODELS } from '../prompts'

/**
 * Claude Sonnet 5 and every newer model refuse a `temperature` with a 400, and the
 * app sent one on every request from 2026-09-17, when Sonnet 5 became the default,
 * until the agent evaluation of 2026-10-17 found all eleven agents refused. These
 * hold the rule (sampling.ts) and that no Anthropic request sends a bare
 * temperature again. No test reaches the paid API, which is how this went unseen.
 */

describe('which models accept a temperature', () => {
  it('refuses it for Claude Sonnet 5 and every model after Opus 4.6', () => {
    for (const id of [
      'claude-sonnet-5', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-opus-5-5', 'claude-haiku-5-5',
      'claude-opus-4-7', 'claude-opus-4-8', 'claude-fable-5', 'claude-fable-5-1', 'claude-mythos-5-1',
    ]) expect(anthropicAcceptsTemperature(id), id).toBe(false)
  })

  it('keeps it for Claude 4.6 and older, in every id form', () => {
    for (const id of [
      'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-20250514', 'claude-opus-4-1-20250805', 'claude-3-5-sonnet-20241022',
      'claude-3-7-sonnet-20250219', 'claude-3-haiku-20240307', 'anthropic.claude-sonnet-4-6',
      'claude-sonnet-4-6[1m]', ' Claude-Opus-4-6 ',
    ]) expect(anthropicAcceptsTemperature(id), id).toBe(true)
  })

  it('leaves it out for an id it does not recognise, since leaving it out is always accepted', () => {
    for (const id of ['', 'claude-something-new', 'claude-opus', 'gpt-4o', 'claude-sonnet-46']) {
      expect(anthropicAcceptsTemperature(id), id).toBe(false)
    }
  })

  it('sends no temperature with the default model, the case that failed', () => {
    expect(anthropicSampling(DEFAULT_ANTHROPIC_MODEL, 0.3)).toEqual({})
  })

  it('decides every model the settings page offers', () => {
    const decided = PROVIDER_MODELS.anthropic.map((m) => [m.id, anthropicAcceptsTemperature(m.id)])
    // The Haiku 4.5 entry is the one that still takes it; the Claude 5 models do not.
    expect(decided.filter(([, ok]) => ok).map(([id]) => id)).toEqual(
      PROVIDER_MODELS.anthropic.filter((m) => /haiku-4-5/.test(m.id)).map((m) => m.id),
    )
  })

  it('passes a real number through for a model that takes it, and nothing else', () => {
    expect(anthropicSampling('claude-opus-4-6', 0.2)).toEqual({ temperature: 0.2 })
    expect(anthropicSampling('claude-opus-4-6', 0)).toEqual({ temperature: 0 })
    expect(anthropicSampling('claude-opus-4-6', undefined)).toEqual({})
    expect(anthropicSampling('claude-opus-4-6', Number.NaN)).toEqual({})
  })
})

describe('no Anthropic request sends a bare temperature', () => {
  const SRC = join(process.cwd(), 'src')
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue
        sourceFiles(full, out)
      } else if (/\.tsx?$/.test(entry)) out.push(full)
    }
    return out
  }
  // Each `client.messages.create({ … })` call in a file that imports the Anthropic SDK,
  // up to the first `})`, which closes the request object in every call site here.
  const calls = sourceFiles(SRC)
    .filter((f) => readFileSync(f, 'utf8').includes("from '@anthropic-ai/sdk'"))
    .flatMap((f) => {
      const src = readFileSync(f, 'utf8')
      const out: Array<{ file: string; body: string }> = []
      let at = src.indexOf('messages.create(')
      while (at !== -1) {
        const end = src.indexOf('})', at)
        out.push({ file: f.slice(SRC.length + 1), body: src.slice(at, end === -1 ? undefined : end) })
        at = src.indexOf('messages.create(', at + 1)
      }
      return out
    })

  it('finds the Anthropic calls to check', () => {
    // The agent runner and the three Pump Report routes, today.
    expect(calls.length).toBeGreaterThanOrEqual(4)
  })

  it('routes every temperature through anthropicSampling', () => {
    for (const c of calls) {
      expect(c.body, c.file).not.toMatch(/\btemperature\s*[:,\n}]/)
    }
  })
})
