import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { NextRequest } from 'next/server'
import { LOCK_EXEMPT_PATHS, siteLockAllows, siteLockResponse } from '@/lib/server/siteLock'
import { INTERNAL_HEADER, internalApiToken, selfRequestHeaders } from '@/lib/server/apiKeys'
import { OWNER_COOKIE, ownerCookieValue } from '@/lib/server/ownerAccess'
import { config, middleware } from '@/middleware'

// The site is locked to its owner until launch (hosting brief §4 item 1, D174). Under D22 the
// first page load by anyone else is launch, and the free licences the app runs on hold only while
// the owner is the only user (D96). Sign-in stays off until launch, so the lock is the owner cookie.

const TOKEN = 'a-long-admin-token-for-tests-0123456789'
const req = (url: string, init: { host?: string; cookie?: string; headers?: Record<string, string> } = {}) => {
  const host = init.host ?? 'financenow.test'
  const headers: Record<string, string> = { host, ...(init.headers ?? {}) }
  if (init.cookie) headers.cookie = init.cookie
  return new NextRequest(`https://${host}${url}`, { headers })
}
const ownerCookie = `${OWNER_COOKIE}=${ownerCookieValue(TOKEN)}`

beforeEach(() => {
  vi.stubEnv('FN_ADMIN_TOKEN', '')
  vi.stubEnv('CAEP_ADMIN_TOKEN', '')
  vi.stubEnv('FN_SITE_OPEN', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('on the owner’s machine', () => {
  it('changes nothing: pages and routes answer with no cookie and no token', () => {
    expect(siteLockResponse(req('/headlines', { host: 'localhost:3000' }))).toBeNull()
    expect(siteLockResponse(req('/live-data/markets', { host: '127.0.0.1:3000' }))).toBeNull()
  })
})

describe('on any other host', () => {
  it('sends a page to /owner, marked locked, and never caches the answer', () => {
    const res = siteLockResponse(req('/headlines'))!
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://financenow.test/owner?locked=1')
    expect(res.headers.get('cache-control')).toBe('no-store')
    // The legal pages too: a visitor reading them is a page load by someone else (D22).
    expect(siteLockResponse(req('/about/privacy'))!.status).toBe(307)
  })

  it('redirects to the address the browser used, not the server’s internal one', () => {
    const behindProxy = new NextRequest('http://0.0.0.0:8080/headlines', {
      headers: { host: 'staging.financenow.test', 'x-forwarded-proto': 'https' },
    })
    expect(siteLockResponse(behindProxy)!.headers.get('location')).toBe('https://staging.financenow.test/owner?locked=1')
  })

  it('answers a route 401, which says where to unlock', async () => {
    for (const path of ['/live-data/markets', '/api/user/portfolios', '/api/agents/chat']) {
      const res = siteLockResponse(req(path))!
      expect(res.status).toBe(401)
      expect((await res.json()).error).toMatch(/locked to its owner until launch.*\/owner/)
    }
  })

  it('keeps open only the unlock page, its route, the health probe and the app icon', () => {
    expect([...LOCK_EXEMPT_PATHS]).toEqual(['/owner', '/api/owner', '/api/health', '/icon'])
    for (const path of LOCK_EXEMPT_PATHS) expect(siteLockResponse(req(path))).toBeNull()
    // A prefix match is a path segment, not a string prefix.
    expect(siteLockResponse(req('/ownerx'))).not.toBeNull()
    expect(siteLockResponse(req('/api/healthz'))).not.toBeNull()
  })

  it('opens for the owner cookie, and only a real one for the token set', () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    expect(siteLockResponse(req('/headlines', { cookie: ownerCookie }))).toBeNull()
    expect(siteLockResponse(req('/live-data/markets', { cookie: ownerCookie }))).toBeNull()
    expect(siteLockResponse(req('/headlines', { cookie: `${OWNER_COOKIE}=${ownerCookieValue('another-token-entirely-0123')}` }))).not.toBeNull()
    expect(siteLockResponse(req('/headlines', { cookie: `${OWNER_COOKIE}=${'0'.repeat(64)}` }))).not.toBeNull()
    // The cookie arriving on a request the browser marks cross-site does not count.
    expect(siteLockResponse(req('/headlines', { cookie: ownerCookie, headers: { 'sec-fetch-site': 'cross-site' } }))).not.toBeNull()
  })

  it('has no cookie to accept when no admin token is set', () => {
    expect(siteLockResponse(req('/headlines', { cookie: `${OWNER_COOKIE}=${ownerCookieValue('')}` }))).not.toBeNull()
  })

  it('lets through the app’s own calls to itself, and nothing that merely names the header', () => {
    expect(siteLockAllows(req('/live-data/stock-universe', { headers: selfRequestHeaders() }))).toBe(true)
    expect(siteLockAllows(req('/live-data/stock-universe', { headers: { [INTERNAL_HEADER]: internalApiToken() + 'x' } }))).toBe(false)
    expect(siteLockAllows(req('/live-data/stock-universe', { headers: { [INTERNAL_HEADER]: '' } }))).toBe(false)
  })

  it('passes a public API request that carries a key on to the API’s own key check', () => {
    expect(siteLockAllows(req('/api/v1/prices', { headers: { authorization: 'Bearer some-key-the-route-will-check' } }))).toBe(true)
    expect(siteLockAllows(req('/api/v1/prices', { headers: { 'x-api-key': 'some-key-the-route-will-check' } }))).toBe(true)
    expect(siteLockAllows(req('/api/v1/prices'))).toBe(false)
    expect(siteLockAllows(req('/api/v1'))).toBe(false)
    // A key opens the public API only, never a page or another route.
    expect(siteLockAllows(req('/live-data/markets', { headers: { 'x-api-key': 'some-key-the-route-will-check' } }))).toBe(false)
    expect(siteLockAllows(req('/headlines', { headers: { authorization: 'Bearer some-key-the-route-will-check' } }))).toBe(false)
  })

  it('opens to everyone only with FN_SITE_OPEN=true, which is the launch', () => {
    for (const v of ['1', 'yes', 'TRUE', 'false']) {
      vi.stubEnv('FN_SITE_OPEN', v)
      expect(siteLockAllows(req('/headlines'))).toBe(false)
    }
    vi.stubEnv('FN_SITE_OPEN', 'true')
    expect(siteLockResponse(req('/headlines'))).toBeNull()
    expect(siteLockResponse(req('/live-data/markets'))).toBeNull()
  })
})

describe('the middleware', () => {
  it('runs the lock before anything else, on every path but Next’s build files', () => {
    expect(middleware(req('/headlines')).status).toBe(307)
    expect(middleware(req('/live-data/markets')).status).toBe(401)
    expect(middleware(req('/headlines', { host: 'localhost:3000' })).headers.get('x-middleware-next')).toBe('1')
    expect(config.runtime).toBe('nodejs')
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)'])
    const m = new RegExp(`^${config.matcher[0]}$`)
    for (const path of ['/headlines', '/live-data/markets', '/api/v1/prices', '/owner']) expect(m.test(path)).toBe(true)
    for (const path of ['/_next/static/chunks/a.js', '/_next/image', '/favicon.ico']) expect(m.test(path)).toBe(false)
  })
})

// A server-side call from the app to its own address arrives at the lock like any other request,
// so it must carry the internal token or it is refused on a host. Every server file that reads the
// app's own origin and fetches is held to sending selfRequestHeaders() on each fetch.
const SRC = join(__dirname, '../../..')
function serverFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') serverFiles(p, out)
    } else if (/\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}
const ORIGIN = /nextUrl\.origin|new URL\((req|request)\.url\)\.origin|fetch\(origin\b/

describe('the app’s calls to itself', () => {
  const selfCallers = serverFiles(SRC)
    .map((p) => ({ path: relative(SRC, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }))
    .filter((f) => !/^['"]use client['"]/.test(f.text.trimStart()) && ORIGIN.test(f.text) && f.text.includes('fetch('))

  it('are found where they are known to be', () => {
    expect(selfCallers.map((f) => f.path).sort()).toEqual([
      'app/api/v1/news/route.ts',
      'app/live-data/stock-outliers/route.ts',
      'app/live-data/stock-rating/route.ts',
      'lib/agents/tools.ts',
    ])
  })

  it('each send the internal token on every fetch', () => {
    for (const f of selfCallers) {
      const calls = [...f.text.matchAll(/\bfetch\(/g)].map((m) => f.text.slice(m.index, m.index! + 260))
      expect(calls.length, f.path).toBeGreaterThan(0)
      for (const call of calls) expect(call, `${f.path}: ${call.slice(0, 80)}`).toContain('selfRequestHeaders(')
    }
  })
})
