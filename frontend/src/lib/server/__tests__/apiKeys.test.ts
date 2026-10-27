import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  API_KEY_MIN_LENGTH, API_PER_DAY, API_PER_MINUTE, INTERNAL_HEADER,
  guardApiV1, internalApiToken, parseApiKeys,
} from '@/lib/server/apiKeys'
import { cleanName, envEntry, newApiKey } from '../../../../scripts/lib/apiKeyFormat.mjs'

// The public API's keys and rate limits (T-087, D173, 2026-10-26). Before this, /api/v1 had no
// key and no limit and spent the owner's provider keys on any caller.

const KEY_A = 'fnk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const KEY_B = 'fnk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
let n = 0
const req = (opts: { host?: string; headers?: Record<string, string>; path?: string } = {}) => {
  const host = opts.host ?? 'financenow.test'
  return new NextRequest(`https://${host}${opts.path ?? '/api/v1/prices'}`, {
    headers: { host, 'x-forwarded-for': `198.51.100.${++n % 250}`, ...(opts.headers ?? {}) },
  })
}
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

beforeEach(() => {
  vi.stubEnv('FN_API_KEYS', '')
  vi.stubEnv('FN_ADMIN_TOKEN', '')
  vi.stubEnv('CAEP_ADMIN_TOKEN', '')
  vi.stubEnv('AUTH_SECRET', '')
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe('the key list (FN_API_KEYS)', () => {
  it('reads "name:key" and bare keys, and refuses anything too short to be a real key', () => {
    expect(parseApiKeys(`mcp:${KEY_A}, ${KEY_B} ,short:abc, , tooshort`)).toEqual([
      { name: 'mcp', key: KEY_A },
      { name: 'key-2', key: KEY_B },
    ])
    expect(parseApiKeys(undefined)).toEqual([])
    expect(parseApiKeys('')).toEqual([])
  })
})

describe('the gate', () => {
  it('with no keys set: the owner’s machine only, as the owner’s tools are', () => {
    expect(guardApiV1(req({ host: 'localhost:3000' }))).toBeNull()
    const off = guardApiV1(req())!
    expect(off.status).toBe(401)
    expect(off.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('with keys set: either header, a listed key, and nothing else, on every host', async () => {
    vi.stubEnv('FN_API_KEYS', `mcp:${KEY_A}`)
    expect(guardApiV1(req({ headers: { authorization: `Bearer ${KEY_A}` } }))).toBeNull()
    expect(guardApiV1(req({ headers: { 'x-api-key': KEY_A } }))).toBeNull()
    const none = guardApiV1(req())!
    expect(none.status).toBe(401)
    expect(none.headers.get('www-authenticate')).toBe('Bearer')
    expect((await none.json()).error).toMatch(/Authorization: Bearer <key>/)
    for (const r of [
      req({ headers: { 'x-api-key': KEY_B } }),
      req({ headers: { authorization: `Bearer ${KEY_A}x` } }),
      req({ host: 'localhost:3000' }), // localhost alone no longer passes once keys are set
    ]) expect(guardApiV1(r)!.status).toBe(401)
  })

  it('keeps the endpoint list and the spec open, rate-limited by address', () => {
    vi.stubEnv('FN_API_KEYS', `mcp:${KEY_A}`)
    expect(guardApiV1(req({ path: '/api/v1' }), { open: true })).toBeNull()
  })

  it('lets the app’s own AI tools through on the internal token, and nothing that only resembles it', () => {
    vi.stubEnv('FN_API_KEYS', `mcp:${KEY_A}`)
    expect(guardApiV1(req({ headers: { [INTERNAL_HEADER]: internalApiToken() } }))).toBeNull()
    expect(guardApiV1(req({ headers: { [INTERNAL_HEADER]: 'guess' } }))!.status).toBe(401)
    // Derived from a server secret when one is set, so every copy of the app agrees.
    vi.stubEnv('AUTH_SECRET', 'a-server-secret')
    const derived = internalApiToken()
    expect(derived).toMatch(/^[0-9a-f]{64}$/)
    expect(internalApiToken()).toBe(derived)
    expect(derived).not.toContain('a-server-secret')
  })

  it(`limits each key to ${API_PER_MINUTE} a minute and ${API_PER_DAY} a day, answering 429 with Retry-After`, () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
    const k = 'fnk_limitlimitlimitlimitlimitlimitlimitlimit'
    vi.stubEnv('FN_API_KEYS', `limit:${k}`)
    const call = () => guardApiV1(req({ headers: { 'x-api-key': k } }))
    for (let i = 0; i < API_PER_MINUTE; i++) expect(call()).toBeNull()
    const minute = call()!
    expect(minute.status).toBe(429)
    expect(minute.headers.get('retry-after')).toBe('60')
    // A new minute; the day keeps counting. The 60 served above count toward it; the one the
    // minute limit refused does not, so the day refuses its 2,001st served request.
    let served = API_PER_MINUTE + 1
    let daily: Response | null = null
    // Bounded, so a broken daily limit fails here instead of looping forever.
    while (!daily && served < API_PER_DAY * 2) {
      vi.advanceTimersByTime(61_000)
      for (let i = 0; i < API_PER_MINUTE && !daily; i++) {
        const r = call()
        served++
        if (r) daily = r
      }
    }
    expect(daily, 'the daily limit never refused').not.toBeNull()
    expect(daily!.status).toBe(429)
    expect(daily!.headers.get('retry-after')).toBe('3600')
    expect(served).toBe(API_PER_DAY + 2) // 2,000 served, the 2,001st refused, plus the one refused by the minute
  })
})

describe('every route is gated', () => {
  const dir = join(ROOT, 'src/app/api/v1')
  const routes: string[] = []
  const walk = (d: string) => readdirSync(d).forEach((f) => {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f === 'route.ts') routes.push(relative(ROOT, p).replace(/\\/g, '/'))
  })
  walk(dir)
  const OPEN = ['src/app/api/v1/route.ts', 'src/app/api/v1/openapi.json/route.ts']

  it('finds the routes (a check that sees none proves nothing)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(13)
  })

  it.each(routes)('%s calls guardApiV1 first in every handler, open only for the list and the spec', (rel) => {
    const src = read(rel)
    const handlers = [...src.matchAll(/export async function (GET|POST)\((\w+)[^)]*\)[^{]*\{\n([^\n]*)\n([^\n]*)/g)]
    expect(handlers.length).toBeGreaterThan(0)
    for (const [, , param, first, second] of handlers) {
      expect(first.trim()).toBe(OPEN.includes(rel) ? `const denied = guardApiV1(${param}, { open: true })` : `const denied = guardApiV1(${param})`)
      expect(second.trim()).toBe('if (denied) return denied')
    }
  })

  it('lets a browser send either key header', () => {
    expect(read('src/app/api/_cors.ts')).toMatch(/'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'/)
  })
})

describe('the callers', () => {
  it('the app’s AI tools send the internal token on every call to the public API', () => {
    const tools = read('src/lib/agents/tools.ts')
    expect(tools).toMatch(/return path\.startsWith\('\/api\/v1'\) \? \{ \.\.\.extra, \[INTERNAL_HEADER\]: internalApiToken\(\) \} : extra/)
    expect(tools).toMatch(/fetch\(origin \+ path, \{ headers: selfHeaders\(path/)
    expect(tools).toMatch(/headers: selfHeaders\('\/api\/v1\/options\/score'/)
    expect([...tools.matchAll(/fetch\(origin \+/g)].length).toBe(2)
  })

  it('the MCP server sends FN_API_KEY on both its GET and its POST', () => {
    const mcp = read('../mcp-server/src/index.ts')
    expect(mcp).toMatch(/const AUTH: Record<string, string> = API_KEY \? \{ Authorization: `Bearer \$\{API_KEY\}` \} : \{\}/)
    expect(mcp).toMatch(/fetch\(`\$\{API\}\$\{path\}`, \{ headers: AUTH \}\)/)
    expect(mcp).toMatch(/headers: \{ \.\.\.AUTH, 'Content-Type': 'application\/json' \}/)
  })

  it('the live-data check sends FN_API_KEY to the public API when one is set', () => {
    expect(read('scripts/test-live-data.mjs')).toMatch(/const auth = key && path\.startsWith\('\/api\/v1'\) \? \{ Authorization: `Bearer \$\{key\}` \} : \{\}/)
  })
})

describe('npm run api:key', () => {
  it('makes a key the server accepts, and the line to list it', () => {
    const key = newApiKey(randomBytes)
    expect(key).toMatch(/^fnk_[A-Za-z0-9_-]{43}$/)
    expect(key.length).toBeGreaterThanOrEqual(API_KEY_MIN_LENGTH)
    expect(newApiKey(randomBytes)).not.toBe(key)
    expect(parseApiKeys(envEntry('Claude Desktop', key))).toEqual([{ name: 'Claude-Desktop', key }])
    expect(cleanName('  ')).toBe('key')
    expect(JSON.parse(read('package.json')).scripts['api:key']).toBe('node scripts/api-key.mjs')
  })

  it('stores nothing and writes no file', () => {
    expect(read('scripts/api-key.mjs')).not.toMatch(/writeFile|appendFile|mkdir|node:fs/)
  })
})
