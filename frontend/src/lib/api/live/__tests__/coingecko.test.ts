import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// getProviderKey reads a config file; stub it so these tests exercise the
// resolver's own logic rather than the filesystem.
vi.mock('../providers', () => ({ getProviderKey: vi.fn() }))

import { coingeckoBase, coingeckoHeaders, coingeckoKey } from '../coingecko'
import { getProviderKey } from '../providers'

const mockKey = vi.mocked(getProviderKey)
const originalBase = process.env.COINGECKO_BASE_URL

beforeEach(() => { mockKey.mockReturnValue(undefined) })
afterEach(() => {
  if (originalBase === undefined) delete process.env.COINGECKO_BASE_URL
  else process.env.COINGECKO_BASE_URL = originalBase
  vi.clearAllMocks()
})

describe('coingeckoBase', () => {
  it('defaults to the public v3 API', () => {
    delete process.env.COINGECKO_BASE_URL
    expect(coingeckoBase()).toBe('https://api.coingecko.com/api/v3')
  })

  it('honours an override — the whole point of the shared resolver', () => {
    process.env.COINGECKO_BASE_URL = 'https://pro-api.coingecko.com/api/v3'
    expect(coingeckoBase()).toBe('https://pro-api.coingecko.com/api/v3')
  })

  it('strips trailing slashes so callers can always append "/path"', () => {
    process.env.COINGECKO_BASE_URL = 'https://example.test/api/v3///'
    expect(coingeckoBase()).toBe('https://example.test/api/v3')
  })

  it('falls back to the default on an empty override', () => {
    process.env.COINGECKO_BASE_URL = ''
    expect(coingeckoBase()).toBe('https://api.coingecko.com/api/v3')
  })
})

describe('coingeckoKey', () => {
  it('uses the resolved provider key', () => {
    mockKey.mockReturnValue('real-key')
    expect(coingeckoKey()).toBe('real-key')
  })

  it('treats the scaffold placeholder as absent', () => {
    // Sending it produces a 401 that reads like a bad key rather than no key.
    mockKey.mockReturnValue('your-coingecko-api-key')
    expect(coingeckoKey()).toBeUndefined()
  })

  it('is undefined when nothing is configured', () => {
    mockKey.mockReturnValue(undefined)
    expect(coingeckoKey()).toBeUndefined()
  })
})

describe('coingeckoHeaders', () => {
  it('sends only Accept when no key is configured', () => {
    expect(coingeckoHeaders()).toEqual({ Accept: 'application/json' })
  })

  it('adds the demo key header when one is configured', () => {
    mockKey.mockReturnValue('real-key')
    expect(coingeckoHeaders()).toEqual({
      Accept: 'application/json',
      'x-cg-demo-api-key': 'real-key',
    })
  })

  it('never sends the placeholder as a key header', () => {
    mockKey.mockReturnValue('your-coingecko-api-key')
    expect(coingeckoHeaders()['x-cg-demo-api-key']).toBeUndefined()
  })
})
