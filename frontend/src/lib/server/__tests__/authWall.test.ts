import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { requireAuthOn, walledPath } from '../authWall'

// The sign-in wall ships DARK (D232): FN_REQUIRE_AUTH unset means nothing
// changes anywhere. These tests hold the flag, the path split and the
// middleware's behaviour on both sides of the flag, because the wall's whole
// point is what it does at launch — when nobody will be watching tests.

const authMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/config', () => ({ auth: authMock }))

// The owner's machine passes the site lock, so the wall is what decides.
const req = (path: string) => new NextRequest(`http://localhost:3000${path}`, { headers: { host: 'localhost:3000' } })

afterEach(() => {
  delete process.env.FN_REQUIRE_AUTH
  authMock.mockReset()
})

describe('requireAuthOn', () => {
  it('is on only for the exact string "true"', () => {
    expect(requireAuthOn({})).toBe(false)
    expect(requireAuthOn({ FN_REQUIRE_AUTH: 'false' })).toBe(false)
    expect(requireAuthOn({ FN_REQUIRE_AUTH: '1' })).toBe(false)
    expect(requireAuthOn({ FN_REQUIRE_AUTH: 'true' })).toBe(true)
  })
})

describe('walledPath', () => {
  it('walls pages, including the root', () => {
    for (const p of ['/', '/headlines', '/portfolios', '/portfolios/tracked', '/equities/AAPL', '/settings']) {
      expect(walledPath(p), p).toBe(true)
    }
  })
  it('a dot below the root is a page, not a file — a dotted ticker cannot open the wall', () => {
    // Found by the 2026-11-21 audit: any dotted last segment read as an asset,
    // so /equities/BRK.B (a real ticker form) reached every detail page signed out.
    for (const p of ['/equities/BRK.B', '/assets/usd.coin', '/funds/X.Y', '/macro/rates/10.year']) {
      expect(walledPath(p), p).toBe(true)
    }
  })
  it('never walls the auth pages, the legal pages, the routes or assets', () => {
    for (const p of [
      '/login', '/signup', '/reset-password', '/owner',
      '/about', '/about/privacy', '/about/terms',
      '/api/auth/session', '/api/auth/signup', '/api/v1/prices', '/api/user/portfolios',
      '/live-data/markets', '/robots.txt', '/apple-touch-icon.png',
    ]) {
      expect(walledPath(p), p).toBe(false)
    }
  })
  it('does not treat a lookalike prefix as open', () => {
    expect(walledPath('/loginfake')).toBe(true)
    expect(walledPath('/aboutus')).toBe(true)
  })
})

describe('the middleware behind the flag', () => {
  it('does nothing while the flag is unset — the dark path never touches Auth.js', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(req('/headlines'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(authMock).not.toHaveBeenCalled()
  })

  it('redirects a signed-out page request to /login when the flag is on', async () => {
    process.env.FN_REQUIRE_AUTH = 'true'
    authMock.mockResolvedValue(null)
    const { middleware } = await import('@/middleware')
    const res = await middleware(req('/headlines'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('lets a signed-in session through', async () => {
    process.env.FN_REQUIRE_AUTH = 'true'
    authMock.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    const { middleware } = await import('@/middleware')
    const res = await middleware(req('/headlines'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('leaves /login, the legal pages and the routes unwalled even when on', async () => {
    process.env.FN_REQUIRE_AUTH = 'true'
    authMock.mockResolvedValue(null)
    const { middleware } = await import('@/middleware')
    for (const p of ['/login', '/signup', '/about/privacy', '/live-data/markets', '/api/v1/prices']) {
      const res = await middleware(req(p))
      expect(res.headers.get('x-middleware-next'), p).toBe('1')
    }
  })

  it('fails closed when the session cannot be verified', async () => {
    process.env.FN_REQUIRE_AUTH = 'true'
    authMock.mockRejectedValue(new Error('no AUTH_SECRET'))
    const { middleware } = await import('@/middleware')
    const res = await middleware(req('/headlines'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/login')
  })
})

describe('the launch recipe is environment-only', () => {
  it('no page carries a hardcoded login/signup disable constant any more', () => {
    const auth = join(__dirname, '../../../app/(auth)')
    for (const f of ['login/page.tsx', 'login/LoginForm.tsx', 'signup/page.tsx', 'signup/SignupForm.tsx']) {
      expect(readFileSync(join(auth, f), 'utf8'), f).not.toMatch(/const (LOGIN|SIGNUP)_DISABLED/)
    }
  })
  it('the wall runs after the site lock and loads Auth.js lazily', () => {
    const src = readFileSync(join(__dirname, '../../../middleware.ts'), 'utf8')
    expect(src.indexOf('siteLockResponse(req)')).toBeGreaterThan(-1)
    expect(src.indexOf('siteLockResponse(req)')).toBeLessThan(src.indexOf('requireAuthOn()'))
    expect(src).toMatch(/await import\('@\/lib\/auth\/config'\)/)
  })
})
