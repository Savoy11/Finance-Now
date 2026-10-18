import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * Two faults the 2026-10-17 agent evaluation found in how the runner hands back an
 * answer, both invisible to the agents themselves:
 *
 *  - Web search splits a sentence into text blocks, one per quoted passage. The runner
 *    joined them with line breaks, so every sentence that quoted a source broke across
 *    lines on the Research page, the Brief and the AI scans.
 *  - An answer stopped at the length limit came back as though it were whole. The
 *    Diligence report ended in the middle of its findings with nothing to say so.
 */

const script: unknown[] = []
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: async () => script.shift() }
  },
}))
vi.mock('@/lib/agents/config', () => ({
  loadAgentConfig: () => ({
    provider: 'anthropic', model: 'test-model', temperature: 0, systemPrompt: 'test',
    toolset: 'equities', enabled: true, isCustomized: false,
  }),
}))
vi.mock('@/lib/api/live/providers', () => ({ getProviderKey: () => 'test-key' }))

const { runAgent, anthropicAnswerText, CUT_OFF_NOTICE } = await import('../runner')

const run = () => runAgent({ agentId: 'equity-research', messages: [{ role: 'user', content: 'NVDA?' }], origin: 'http://x' })

afterEach(() => { script.length = 0 })

describe('the answer text', () => {
  it('keeps a sentence whole when web search splits it around a quotation', async () => {
    script.push({
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'The filing says ' },
        { type: 'text', text: 'NVIDIA entered into multiple residual value guaranties', citations: [{ type: 'web_search_result_location', url: 'https://www.sec.gov/x' }] },
        { type: 'text', text: ' with SB Energy.\n\nA second paragraph.' },
      ],
    })
    const out = await run()
    expect(out.text).toBe('The filing says NVIDIA entered into multiple residual value guaranties with SB Energy.\n\nA second paragraph.')
  })

  it('says so when the answer reached its length limit', async () => {
    script.push({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"findings": [' }] })
    const out = await run()
    expect(out.text).toBe(`{"findings": [\n\n${CUT_OFF_NOTICE}`)
    expect(out.stopReason).toBe('max_tokens')
  })

  it('adds nothing to an answer that finished', () => {
    expect(anthropicAnswerText([{ type: 'text', text: 'Done.' }], 'end_turn')).toBe('Done.')
  })

  it('still says so when the limit was reached before any text', () => {
    expect(anthropicAnswerText([{ type: 'server_tool_use' }], 'max_tokens')).toBe(CUT_OFF_NOTICE)
  })

  it('reads text blocks only', () => {
    expect(anthropicAnswerText([
      { type: 'server_tool_use' },
      { type: 'web_search_tool_result' },
      { type: 'text', text: 'Answer.' },
    ], 'end_turn')).toBe('Answer.')
  })
})
