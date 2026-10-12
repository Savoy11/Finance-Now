import { describe, it, expect, vi, afterEach } from 'vitest'
import { COINGECKO_ATTRIBUTION } from '@/lib/data/dataSources'

/**
 * D101: an AI answer quoting CoinGecko figures shows CoinGecko's credit. The runner is
 * where the credits of every tool a run called are gathered into the answer, so this runs
 * it end to end: a scripted model asks for a coin price, the tool reads the agent API, and
 * the answer comes back carrying the credit, once, however many times the tool ran.
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
    toolset: 'crypto', enabled: true, isCustomized: false,
  }),
}))
vi.mock('@/lib/api/live/providers', () => ({ getProviderKey: () => 'test-key' }))

const { runAgent } = await import('../runner')

const toolTurn = (id: string) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'get_prices', input: { coins: ['btc'] } }],
})
const finalTurn = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'BTC is $101.50.' }] }

afterEach(() => { vi.unstubAllGlobals(); script.length = 0 })

describe('runAgent returns the credits its tools gathered', () => {
  it('carries CoinGecko’s credit once, after two price calls', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ prices: { btc: 101.5 }, attributions: [COINGECKO_ATTRIBUTION] }), { status: 200 })))
    script.push(toolTurn('a'), toolTurn('b'), finalTurn)
    const out = await runAgent({ agentId: 'research-analyst', messages: [{ role: 'user', content: 'BTC?' }], origin: 'http://x' })
    expect(out.text).toBe('BTC is $101.50.')
    expect(out.toolsUsed.map((t) => t.name)).toEqual(['get_prices', 'get_prices'])
    expect(out.credits).toEqual([COINGECKO_ATTRIBUTION])
  })

  it('carries none when the answer used no tool', async () => {
    script.push(finalTurn)
    const out = await runAgent({ agentId: 'research-analyst', messages: [{ role: 'user', content: 'hi' }], origin: 'http://x' })
    expect(out.credits).toEqual([])
  })
})
