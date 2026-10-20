import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { providerRefusal } from '../providerRefusal'
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/agents/prompts'

/**
 * The Integrations Test button says why a provider refused a key (2026-10-19). It said only
 * "HTTP 400" when Anthropic refused a new key, which could not tell a malformed key from the
 * wrong kind of key. These hold the reason and keep the key itself out of it.
 */

describe('providerRefusal', () => {
  it("reads Anthropic's and the OpenAI-compatible providers' error message", () => {
    expect(providerRefusal({ type: 'error', error: { type: 'invalid_request_error', message: 'Bad key format' } }, 'k')).toBe('Bad key format')
    expect(providerRefusal({ error: { message: 'Incorrect API key provided', code: 'invalid_api_key' } }, 'k')).toBe('Incorrect API key provided')
    expect(providerRefusal({ error: 'Forbidden' }, 'k')).toBe('Forbidden')
    expect(providerRefusal({ message: 'Unauthorized' }, 'k')).toBe('Unauthorized')
  })

  it('never repeats the key, even when a provider echoes it', () => {
    const key = 'sk-ant-secret-123'
    expect(providerRefusal({ error: { message: `Key ${key} is not valid` } }, key)).toBe('Key [key] is not valid')
  })

  it('says nothing when there is nothing to say, and cuts a long body short', () => {
    expect(providerRefusal(null, 'k')).toBe('')
    expect(providerRefusal('<html>…</html>', 'k')).toBe('')
    expect(providerRefusal({ error: { message: 'x'.repeat(500) } }, 'k')).toHaveLength(200)
  })
})

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/termsGatedFetch', () => ({ termsGatedFetch: fetchMock }))
vi.mock('@/lib/api/live/providers', () => ({
  getAllProviders: () => [{ id: 'anthropic', name: 'Anthropic', config: {} }],
  saveProviderConfig: vi.fn(),
  addCustomProvider: vi.fn(),
  removeCustomProvider: vi.fn(),
  updateCustomProvider: vi.fn(),
  providerConfigStatus: () => ({ error: null }),
}))

describe('the Test button for an AI provider', () => {
  beforeEach(() => fetchMock.mockReset())
  afterEach(() => vi.unstubAllEnvs())

  async function press(apiKey: string) {
    vi.stubEnv('FN_ADMIN_TOKEN', '')
    vi.stubEnv('CAEP_ADMIN_TOKEN', '')
    const { POST } = await import('@/app/live-data/config/route')
    const req = new NextRequest('http://localhost:3000/live-data/config', {
      method: 'POST',
      headers: { host: 'localhost:3000' },
      body: JSON.stringify({ providerId: 'anthropic', action: 'test', apiKey }),
    })
    return (await POST(req)).json()
  }

  it("shows Anthropic's reason beside the status", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Bad key format' } }), { status: 400 }))
    expect(await press('sk-ant-new')).toEqual({ ok: false, error: 'HTTP 400: Bad key format' })
  })

  it('keeps "invalid key" on a 401, with the reason', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 }))
    expect((await press('sk-ant-old')).error).toBe('HTTP 401 — invalid key: invalid x-api-key')
  })

  it('tests Anthropic with the kind of request the agents make, not a model list', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'OK' }] }), { status: 200 }))
    const out = await press('sk-ant-new')
    expect(out.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(DEFAULT_ANTHROPIC_MODEL)
    expect(body.max_tokens).toBeLessThanOrEqual(32)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('/v1/models')
  })

  it('fails a key not scoped to a workspace, which a model list let through (2026-10-19)', async () => {
    // The message Anthropic sent the owner's script that day, for a key the old test passed.
    const message = 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace.'
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }), { status: 400 }))
    const out = await press('sk-ant-user-key')
    expect(out.ok).toBe(false)
    expect(out.error).toContain('HTTP 400: This API key is not scoped to a workspace')
  })

  it('falls back to the status alone when the body says nothing', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway</html>', { status: 502 }))
    expect((await press('sk-ant-new')).error).toBe('HTTP 502')
  })
})
