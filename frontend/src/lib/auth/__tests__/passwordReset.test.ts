import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getTableColumns } from 'drizzle-orm'
import {
  generateResetToken, hashResetToken, looksLikeResetToken, resetTokenExpiry, resetLink, isResetTokenUsable,
  applyPasswordReset, INVALID_LINK_MESSAGE, RESET_TOKEN_TTL_MINUTES,
  type PasswordResetStore, type ResetTokenRow,
} from '../passwordReset'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../passwordPolicy'
import { parseResetCommand } from '../../../../scripts/lib/resetCommand'
import { users } from '@/lib/db/schema'

// T-435 / D123 (2026-10-15): password reset without email. The owner issues a one-time link
// and can force any account, or every account, to reset before it signs in again.

const NOW = new Date('2026-10-15T12:00:00Z')
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000)
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('reset tokens', () => {
  it('are 32 random bytes, base64url, stored only as a SHA-256', () => {
    const { token, tokenHash } = generateResetToken()
    expect(looksLikeResetToken(token)).toBe(true)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashResetToken(token)).toBe(tokenHash)
    expect(tokenHash).not.toContain(token)
    expect(generateResetToken().token).not.toBe(token)
  })
  it('reject anything not shaped like one', () => {
    for (const bad of [undefined, 42, '', 'short', `${'a'.repeat(43)}=`, 'a'.repeat(44), `${'a'.repeat(42)}+`]) {
      expect(looksLikeResetToken(bad)).toBe(false)
    }
  })
  it('expire after the stated window', () => {
    expect(resetTokenExpiry(NOW).getTime() - NOW.getTime()).toBe(RESET_TOKEN_TTL_MINUTES * 60_000)
  })
  it('travel in the link’s fragment, never its query string', () => {
    const link = resetLink('http://localhost:3000/', 'abc_DEF-123')
    expect(link).toBe('http://localhost:3000/reset-password#token=abc_DEF-123')
    expect(link).not.toContain('?')
  })
  it('are usable only unspent and before expiry', () => {
    const row = (over: Partial<ResetTokenRow>): ResetTokenRow => ({ id: 't', userId: 'u', expiresAt: minutes(10), usedAt: null, ...over })
    expect(isResetTokenUsable(row({}), NOW)).toBe(true)
    expect(isResetTokenUsable(row({ usedAt: minutes(-1) }), NOW)).toBe(false)
    expect(isResetTokenUsable(row({ expiresAt: NOW }), NOW)).toBe(false)
    expect(isResetTokenUsable(null, NOW)).toBe(false)
  })
})

describe('the password rule', () => {
  it('is shared, and holds at its boundary', () => {
    expect(passwordProblem('x'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
    expect(passwordProblem('x'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(String(MIN_PASSWORD_LENGTH))
    expect(passwordProblem(undefined)).not.toBeNull()
  })
  it('is the one sign-up uses too', () => {
    expect(read('../../../app/api/auth/signup/route.ts')).toMatch(/from '@\/lib\/auth\/passwordPolicy'/)
    expect(read('../../../app/api/auth/signup/route.ts')).not.toMatch(/MIN_PASSWORD_LENGTH\s*=/)
  })
})

describe('applyPasswordReset', () => {
  const GOOD = 'a-long-enough-password'
  function fakeStore(row: ResetTokenRow | null) {
    const calls: string[] = []
    const store: PasswordResetStore & { calls: string[]; lookedUp: string[] } = {
      calls,
      lookedUp: [],
      async findToken(hash) { store.lookedUp.push(hash); calls.push('find'); return row },
      async setPassword(userId, hash) { calls.push(`set:${userId}:${hash}`) },
      async spendTokens(userId) { calls.push(`spend:${userId}`) },
    }
    return store
  }
  const live = (): ResetTokenRow => ({ id: 't1', userId: 'u1', expiresAt: minutes(30), usedAt: null })
  const hashPassword = async (p: string) => `hashed(${p})`

  it('sets the new password and spends every token of the account', async () => {
    const { token } = generateResetToken()
    const store = fakeStore(live())
    expect(await applyPasswordReset(store, { token, password: GOOD, hashPassword }, NOW)).toEqual({ ok: true })
    expect(store.calls).toEqual(['find', `set:u1:hashed(${GOOD})`, 'spend:u1'])
  })

  it('looks the token up by its hash, never by the token itself', async () => {
    const { token } = generateResetToken()
    const store = fakeStore(live())
    await applyPasswordReset(store, { token, password: GOOD, hashPassword }, NOW)
    expect(store.lookedUp).toEqual([hashResetToken(token)])
  })

  it.each([
    ['unknown', null],
    ['spent', { id: 't1', userId: 'u1', expiresAt: minutes(30), usedAt: minutes(-5) }],
    ['expired', { id: 't1', userId: 'u1', expiresAt: minutes(-1), usedAt: null }],
  ] as const)('refuses a %s link with the one message, and writes nothing', async (_name, row) => {
    const store = fakeStore(row as ResetTokenRow | null)
    const out = await applyPasswordReset(store, { token: generateResetToken().token, password: GOOD, hashPassword }, NOW)
    expect(out).toEqual({ ok: false, status: 400, message: INVALID_LINK_MESSAGE })
    expect(store.calls).toEqual(['find'])
  })

  it('does not even look up a malformed token', async () => {
    const store = fakeStore(live())
    expect(await applyPasswordReset(store, { token: 'nope', password: GOOD, hashPassword }, NOW)).toMatchObject({ ok: false, message: INVALID_LINK_MESSAGE })
    expect(store.calls).toEqual([])
  })

  it('checks the link before the password, so a bad link learns nothing about the rule', async () => {
    const store = fakeStore(null)
    const out = await applyPasswordReset(store, { token: generateResetToken().token, password: 'short', hashPassword }, NOW)
    expect(out).toMatchObject({ message: INVALID_LINK_MESSAGE })
  })

  it('refuses a weak password on a good link, and writes nothing', async () => {
    const store = fakeStore(live())
    const out = await applyPasswordReset(store, { token: generateResetToken().token, password: 'short', hashPassword }, NOW)
    expect(out).toMatchObject({ ok: false, status: 400 })
    expect((out as { message: string }).message).toMatch(String(MIN_PASSWORD_LENGTH))
    expect(store.calls).toEqual(['find'])
  })
})

describe('npm run auth:reset arguments', () => {
  it('parses each form', () => {
    expect(parseResetCommand(['--user', 'Someone@X.com'])).toEqual({ kind: 'user', email: 'someone@x.com', force: false })
    expect(parseResetCommand(['--user', 'a@b.c', '--force'])).toEqual({ kind: 'user', email: 'a@b.c', force: true })
    expect(parseResetCommand(['--all', '--force'])).toEqual({ kind: 'all' })
    expect(parseResetCommand(['--status'])).toEqual({ kind: 'status' })
  })
  it('makes every-account resets explicit', () => {
    expect(parseResetCommand(['--all'])).toHaveProperty('error')
  })
  it('refuses what it cannot mean', () => {
    for (const argv of [[], ['--user'], ['--user', '--force'], ['--user', 'nobody'], ['--all', '--status', '--force'], ['--status', '--force'], ['--wat']]) {
      expect(parseResetCommand(argv), argv.join(' ')).toHaveProperty('error')
    }
  })
})

describe('sign-in and the stored flag', () => {
  it('sign-in consults the forced-reset flag after the password matches, with its own code', () => {
    const config = read('../config.ts')
    const compare = config.indexOf('bcrypt.compare(')
    const check = config.indexOf('await mustResetPassword(user.id)')
    expect(compare).toBeGreaterThan(-1)
    expect(check).toBeGreaterThan(compare)
    expect(config).toMatch(/throw new MustResetPasswordError\(\)/)
    expect(config).toMatch(/code = 'must_reset_password'/)
    expect(read('../../../app/(auth)/login/page.tsx')).toMatch(/result\.code === 'must_reset_password'/)
  })

  it('users gains no reset column, so sign-in works before migration 0008 runs', () => {
    // Every select().from(users) names every column; a new one would break sign-in on a
    // database that has not been migrated. The flag lives in password_states instead.
    expect(Object.keys(getTableColumns(users)).sort()).toEqual(
      ['createdAt', 'email', 'emailVerified', 'id', 'image', 'name', 'passwordHash', 'updatedAt'],
    )
  })
})

describe('secrets stay out of logs and URLs', () => {
  it('the reset route logs neither the token nor the password', () => {
    const route = read('../../../app/api/auth/reset-password/route.ts')
    // What is logged, not how the line is labelled: string literals are blanked first.
    const logged = route.split('\n').filter((l) => /console\./.test(l)).map((l) => l.replace(/'[^']*'/g, "''"))
    expect(logged.length).toBeGreaterThan(0)
    // Neither the request's fields nor the raw error (whose message can carry query parameters).
    for (const line of logged) expect(line, line).not.toMatch(/\b(token|password|body|e)\b/)
  })
  it('the reset page reads the token from the fragment', () => {
    const page = read('../../../app/(auth)/reset-password/page.tsx')
    expect(page).toMatch(/window\.location\.hash/)
    expect(page).not.toMatch(/useSearchParams|\?token=/)
  })
  it('the owner command stores only the hash and shows the token only inside the link', () => {
    const script = read('../../../../scripts/auth-reset.ts')
    expect(script).toMatch(/values \(\$\{user\.id\}, \$\{tokenHash\}/)
    const tokenUses = script.match(/\$\{token\}|[(,\s]token[),\s]/g) ?? []
    expect(tokenUses.length).toBeGreaterThan(0)
    for (const line of script.split('\n').filter((l) => /\btoken\b/.test(l) && !l.trim().startsWith('//'))) {
      expect(line.includes('generateResetToken()') || line.includes('resetLink(base, token)'), line).toBe(true)
    }
  })
})

// The flag's database read: false when migration 0008 has not run, never a lockout.
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

describe('mustResetPassword', () => {
  beforeEach(() => {
    dbMock.result = []
    dbMock.fail = null
    dbMock.configured = true
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  const load = async () => (await import('../passwordResetStore')).mustResetPassword

  it('is true only when the flag is set', async () => {
    const must = await load()
    dbMock.result = [{ mustReset: true }]
    expect(await must('u1')).toBe(true)
    dbMock.result = [{ mustReset: false }]
    expect(await must('u1')).toBe(false)
    dbMock.result = []
    expect(await must('u1')).toBe(false)
  })
  it('is false, not an error, before migration 0008 runs', async () => {
    const must = await load()
    dbMock.fail = Object.assign(new Error('relation "password_states" does not exist'), { code: '42P01' })
    expect(await must('u1')).toBe(false)
  })
  it('still throws on any other database failure', async () => {
    const must = await load()
    dbMock.fail = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    await expect(must('u1')).rejects.toThrow('connection refused')
  })
})
