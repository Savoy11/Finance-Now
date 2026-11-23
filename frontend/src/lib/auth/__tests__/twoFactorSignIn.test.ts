import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { TOTP_MAX_FAILURES } from '../twoFactor'

// T-088 / D233: the wiring contracts of two-factor sign-in — the order of checks in
// Auth.js, the login form's second step, the session-only account resolution of the
// /api/user/two-factor routes, and the store's missing-table behaviour (an unrun
// migration 0012 must read as "not enrolled", never a lockout).

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('sign-in order and codes', () => {
  const config = read('../config.ts')

  it('asks for the second factor only after the password matched, and after the forced-reset check', () => {
    const compare = config.indexOf('bcrypt.compare(')
    const reset = config.indexOf('await mustResetPassword(user.id)')
    const twoFactor = config.indexOf('await twoFactorRequired(user.id)')
    expect(compare).toBeGreaterThan(-1)
    expect(reset).toBeGreaterThan(compare)
    expect(twoFactor).toBeGreaterThan(reset)
  })
  it('throws each of the three codes, and declares the otp credential', () => {
    expect(config).toMatch(/code = 'totp_required'/)
    expect(config).toMatch(/code = 'totp_invalid'/)
    expect(config).toMatch(/code = 'totp_throttled'/)
    expect(config).toMatch(/otp: \{ label: 'Authentication code'/)
    expect(config).toMatch(/throw new TwoFactorRequiredError\(\)/)
    expect(config).toMatch(/throw new TwoFactorThrottledError\(\)/)
    expect(config).toMatch(/throw new TwoFactorInvalidError\(\)/)
  })
})

describe('the login form’s second step', () => {
  const form = read('../../../app/(auth)/login/LoginForm.tsx')

  it('answers all three codes and resubmits with the code', () => {
    expect(form).toMatch(/result\.code === 'totp_required'/)
    expect(form).toMatch(/result\.code === 'totp_invalid'/)
    expect(form).toMatch(/result\.code === 'totp_throttled'/)
    expect(form).toMatch(/\{ otp \}/)
  })
  it('marks the code box for autofill from messages/authenticators', () => {
    expect(form).toMatch(/autoComplete="one-time-code"/)
  })
})

describe('the /api/user/two-factor routes resolve the session only, never the shared local user', () => {
  const dir = resolve(__dirname, '../../../app/api/user/two-factor')
  const routeFiles = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? routeFiles(resolve(d, e.name)) : e.name === 'route.ts' ? [resolve(d, e.name)] : [])

  it('every route file uses getSessionUserId and none falls back to local mode', () => {
    const files = routeFiles(dir)
    expect(files.length).toBeGreaterThanOrEqual(5) // status, begin, confirm, disable, recovery-codes
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/getSessionUserId/)
      expect(src, f).not.toMatch(/getCurrentUserId|requireUserId/)
    }
  })
  it('the Settings panel renders nothing without a session, so the surface is dark until launch', () => {
    const panel = read('../../../components/settings/TwoFactorPanel.tsx')
    expect(panel).toMatch(/useSession/)
    expect(panel).toMatch(/if \(!signedIn[\s\S]*return null/)
  })
})

describe('migration 0012 and the owner command exist', () => {
  it('the migration creates both tables', () => {
    const sqlText = readFileSync(resolve(__dirname, '../../../../drizzle/0012_two-factor.sql'), 'utf8')
    expect(sqlText).toMatch(/CREATE TABLE "two_factor_secrets"/)
    expect(sqlText).toMatch(/CREATE TABLE "two_factor_recovery_codes"/)
  })
  it('npm run auth:2fa is wired to the script', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../../package.json'), 'utf8'))
    expect(pkg.scripts['auth:2fa']).toBe('tsx scripts/auth-2fa.ts')
  })
})

// ─── The store against a mocked database ─────────────────────────────────────
// Same shape as passwordReset.test.ts's mustResetPassword section: the chain
// resolves at .limit(), and the error path carries a Postgres code.

const dbMock = vi.hoisted(() => ({ result: [] as unknown[], fail: null as unknown, configured: true }))
vi.mock('@/lib/db', () => {
  const chain = {
    select: () => chain, from: () => chain, where: () => chain,
    limit: () => (dbMock.fail ? Promise.reject(dbMock.fail) : Promise.resolve(dbMock.result)),
  }
  return {
    db: chain,
    get isDbConfigured() { return dbMock.configured },
  }
})

describe('twoFactorStore on a database without migration 0012', () => {
  beforeEach(async () => {
    dbMock.result = []
    dbMock.fail = null
    dbMock.configured = true
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { resetTwoFactorThrottle } = await import('../twoFactorStore')
    resetTwoFactorThrottle()
  })
  const load = async () => import('../twoFactorStore')

  it('twoFactorRequired is true only for a confirmed enrollment', async () => {
    const { twoFactorRequired } = await load()
    dbMock.result = [{ secret: 'S', confirmedAt: new Date(), lastUsedStep: null, createdAt: new Date() }]
    expect(await twoFactorRequired('u1')).toBe(true)
    dbMock.result = [{ secret: 'S', confirmedAt: null, lastUsedStep: null, createdAt: new Date() }]
    expect(await twoFactorRequired('u1')).toBe(false)
    dbMock.result = []
    expect(await twoFactorRequired('u1')).toBe(false)
  })
  it('a missing table reads as "not enrolled", never a lockout', async () => {
    const { twoFactorRequired } = await load()
    dbMock.fail = Object.assign(new Error('relation "two_factor_secrets" does not exist'), { code: '42P01' })
    expect(await twoFactorRequired('u1')).toBe(false)
  })
  it('and the status says which migration to run', async () => {
    const { twoFactorStatus } = await load()
    dbMock.fail = Object.assign(new Error('relation "two_factor_secrets" does not exist'), { code: '42P01' })
    const status = await twoFactorStatus('u1')
    expect(status.available).toBe(false)
    expect(status.reason).toMatch(/migration 0012/)
    expect(status.enrolled).toBe(false)
  })
  it('any other database failure still throws', async () => {
    const { twoFactorRequired } = await load()
    dbMock.fail = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    await expect(twoFactorRequired('u1')).rejects.toThrow('connection refused')
  })
  it('with no database configured, nothing is required and the status says so', async () => {
    const { twoFactorRequired, twoFactorStatus } = await load()
    dbMock.configured = false
    expect(await twoFactorRequired('u1')).toBe(false)
    expect((await twoFactorStatus('u1')).available).toBe(false)
  })
  it('wrong codes throttle after the limit, counted in memory', async () => {
    const { verifyTwoFactorSignIn } = await load()
    dbMock.result = [] // no enrollment row: every try fails
    for (let i = 0; i < TOTP_MAX_FAILURES; i++) {
      expect(await verifyTwoFactorSignIn('u1', '123456', new Date())).toBe('bad')
    }
    expect(await verifyTwoFactorSignIn('u1', '123456', new Date())).toBe('throttled')
    // Another account is unaffected.
    expect(await verifyTwoFactorSignIn('u2', '123456', new Date())).toBe('bad')
  })
})
