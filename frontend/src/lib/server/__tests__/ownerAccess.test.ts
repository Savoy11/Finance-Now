import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { guardSensitiveRoute } from '@/lib/server/apiGuard'
import { OWNER_COOKIE, OWNER_COOKIE_MAX_AGE_S, ownerCookieMatches, ownerCookieValue } from '@/lib/server/ownerAccess'
import { DELETE, GET, POST } from '@/app/api/owner/route'

// Owner access off localhost (hosting brief §4 item 2). Before this, setting FN_ADMIN_TOKEN on a
// host made every owner tool answer 401, because no page sends the token; without it they
// answered 403 off localhost. The guard now also accepts the cookie /owner issues for the token.

const TOKEN = 'a-long-admin-token-for-tests-0123456789'
let n = 0
// Each request gets its own client address, so the guard's per-minute limit never decides a test.
const req = (url: string, init: { host?: string; cookie?: string; headers?: Record<string, string>; method?: string; body?: unknown } = {}) => {
  const host = init.host ?? 'financenow.test'
  const headers: Record<string, string> = { host, 'x-forwarded-for': `10.0.0.${++n % 250}`, ...(init.headers ?? {}) }
  if (init.cookie) headers.cookie = init.cookie
  return new NextRequest(`https://${host}${url}`, {
    method: init.method ?? 'GET', headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}
const cookieFor = (token: string) => `${OWNER_COOKIE}=${ownerCookieValue(token)}`

beforeEach(() => {
  vi.stubEnv('FN_ADMIN_TOKEN', '')
  vi.stubEnv('CAEP_ADMIN_TOKEN', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('the guard', () => {
  it('without a token: localhost only, as before', () => {
    expect(guardSensitiveRoute(req('/api/agents/chat', { host: 'localhost:3000' }), 'test-a', 100)).toBeNull()
    const off = guardSensitiveRoute(req('/api/agents/chat'), 'test-a', 100)!
    expect(off.status).toBe(403)
    // A forged owner cookie does nothing when no token is set.
    expect(guardSensitiveRoute(req('/api/agents/chat', { cookie: cookieFor('') }), 'test-a', 100)!.status).toBe(403)
  })

  it('with a token: the header, the bearer form or the owner cookie, and nothing else', () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    expect(guardSensitiveRoute(req('/x', { headers: { 'x-fn-token': TOKEN } }), 'test-b', 100)).toBeNull()
    expect(guardSensitiveRoute(req('/x', { headers: { authorization: `Bearer ${TOKEN}` } }), 'test-b', 100)).toBeNull()
    expect(guardSensitiveRoute(req('/x', { cookie: cookieFor(TOKEN) }), 'test-b', 100)).toBeNull()
    // No credential, a wrong one, a cookie for another token, or the raw token as the cookie.
    for (const r of [
      req('/x'),
      req('/x', { headers: { 'x-fn-token': 'wrong' } }),
      req('/x', { cookie: cookieFor('another-token') }),
      req('/x', { cookie: `${OWNER_COOKIE}=${TOKEN}` }),
      req('/x', { host: 'localhost:3000' }), // localhost alone no longer passes once a token is set
    ]) {
      const res = guardSensitiveRoute(r, 'test-b', 100)!
      expect(res.status).toBe(401)
    }
  })

  it('refuses the owner cookie on a request the browser marks as cross-site', () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    const r = req('/x', { cookie: cookieFor(TOKEN), headers: { 'sec-fetch-site': 'cross-site' } })
    expect(ownerCookieMatches(r, TOKEN)).toBe(false)
    expect(guardSensitiveRoute(r, 'test-c', 100)!.status).toBe(401)
    expect(ownerCookieMatches(req('/x', { cookie: cookieFor(TOKEN), headers: { 'sec-fetch-site': 'same-origin' } }), TOKEN)).toBe(true)
  })

  it('tells the owner where to unlock', async () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    expect(await guardSensitiveRoute(req('/x'), 'test-d', 100)!.json()).toEqual({ error: expect.stringContaining('/owner') })
  })

  it('never puts the token in the cookie, and a new token voids the old cookie', () => {
    expect(ownerCookieValue(TOKEN)).not.toContain(TOKEN)
    expect(ownerCookieValue(TOKEN)).toMatch(/^[0-9a-f]{64}$/)
    expect(ownerCookieValue(TOKEN)).not.toBe(ownerCookieValue(`${TOKEN}x`))
  })
})

describe('/api/owner', () => {
  it('reports how the tools are reached: by token, on the owner’s machine, or not at all', async () => {
    expect(await (await GET(req('/api/owner', { host: 'localhost:3000' }))).json()).toEqual({ mode: 'local', unlocked: false })
    expect(await (await GET(req('/api/owner'))).json()).toEqual({ mode: 'closed', unlocked: false })
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    expect(await (await GET(req('/api/owner'))).json()).toEqual({ mode: 'token', unlocked: false })
    expect(await (await GET(req('/api/owner', { cookie: cookieFor(TOKEN) }))).json()).toEqual({ mode: 'token', unlocked: true })
  })

  it('sets an HttpOnly, SameSite=Strict, Secure cookie for the right token, and never echoes it', async () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    const res = await POST(req('/api/owner', { method: 'POST', body: { token: TOKEN } }))
    expect(res.status).toBe(200)
    const set = res.headers.get('set-cookie') ?? ''
    expect(set).toContain(`${OWNER_COOKIE}=${ownerCookieValue(TOKEN)}`)
    expect(set).toMatch(/HttpOnly/i)
    expect(set).toMatch(/SameSite=strict/i)
    expect(set).toMatch(/Secure/i)
    expect(set).toContain(`Max-Age=${OWNER_COOKIE_MAX_AGE_S}`)
    expect(set).not.toContain(TOKEN)
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('refuses a wrong or missing token, sets nothing, and limits tries', async () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    for (const body of [{ token: 'wrong' }, {}, { token: 42 }]) {
      const res = await POST(req('/api/owner', { method: 'POST', body }))
      expect(res.status).toBe(401)
      expect(res.headers.get('set-cookie')).toBeNull()
    }
    // Five tries a minute from one address, then 429.
    const from = (i: number) => new NextRequest('https://financenow.test/api/owner', {
      method: 'POST', headers: { host: 'financenow.test', 'x-forwarded-for': '192.0.2.77' }, body: JSON.stringify({ token: `guess-${i}` }),
    })
    const codes = []
    for (let i = 0; i < 6; i++) codes.push((await POST(from(i))).status)
    expect(codes).toEqual([401, 401, 401, 401, 401, 429])
  })

  it('has nothing to unlock without a token, and refuses a cross-site unlock', async () => {
    const none = await POST(req('/api/owner', { method: 'POST', body: { token: TOKEN } }))
    expect(none.status).toBe(409)
    expect(none.headers.get('set-cookie')).toBeNull()
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    const cross = await POST(req('/api/owner', { method: 'POST', body: { token: TOKEN }, headers: { 'sec-fetch-site': 'cross-site' } }))
    expect(cross.status).toBe(403)
    expect(cross.headers.get('set-cookie')).toBeNull()
  })

  it('locks this browser by expiring the cookie, deleting nothing else', async () => {
    vi.stubEnv('FN_ADMIN_TOKEN', TOKEN)
    const res = await DELETE(req('/api/owner', { method: 'DELETE', cookie: cookieFor(TOKEN) }))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${OWNER_COOKIE}=;.*Max-Age=0`, 'i'))
  })

  it('the owner page posts the token once and keeps it only in its form', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(auth)/owner/page.tsx'), 'utf8')
    expect(page).toMatch(/fetch\('\/api\/owner'/)
    expect(page).not.toMatch(/localStorage|sessionStorage|document\.cookie/)
    expect(page).toMatch(/setToken\(''\)/)
  })
})
