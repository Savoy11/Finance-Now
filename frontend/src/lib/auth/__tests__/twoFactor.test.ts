import { describe, it, expect } from 'vitest'
import {
  RECOVERY_CODE_COUNT, TOTP_MAX_FAILURES, TOTP_THROTTLE_MS,
  checkEnrollmentCode, checkSignInCode, generateRecoveryCodes, hashRecoveryCode,
  looksLikeRecoveryCode, normalizeRecoveryCode, recordFailure, recordSuccess, throttled,
  type RecoveryCodeRow, type ThrottleState, type TwoFactorRow,
} from '../twoFactor'
import { totpCode } from '../totp'
import { parseTwoFactorCommand } from '../../../../scripts/lib/twoFactorCommand'

// T-088 / D233: the two-factor sign-in rules — recovery codes, the sign-in
// decision, the wrong-code throttle, and the owner command's arguments.

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const NOW = new Date('2026-11-20T12:00:00Z')
const row = (over: Partial<TwoFactorRow> = {}): TwoFactorRow =>
  ({ secret: SECRET, confirmedAt: new Date('2026-11-01T00:00:00Z'), lastUsedStep: null, ...over })
const rc = (id: string, code: string, usedAt: Date | null = null): RecoveryCodeRow =>
  ({ id, codeHash: hashRecoveryCode(code), usedAt })

describe('recovery codes', () => {
  it('come ten at a time, XXXXX-XXXXX, with no misreadable characters, each fresh', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT)
    for (const c of codes) {
      expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
      expect(c.code).not.toMatch(/[IO01]/)
      expect(c.codeHash).toBe(hashRecoveryCode(c.code))
    }
    expect(new Set(codes.map((c) => c.code)).size).toBe(RECOVERY_CODE_COUNT)
  })
  it('hash the normalized form, so case, spaces and dashes do not matter when typing one back', () => {
    expect(normalizeRecoveryCode(' ab2de-fg3hk ')).toBe('AB2DEFG3HK')
    expect(hashRecoveryCode('ab2de fg3hk')).toBe(hashRecoveryCode('AB2DE-FG3HK'))
  })
  it('are recognized by shape', () => {
    expect(looksLikeRecoveryCode('AB2DE-FG3HK')).toBe(true)
    expect(looksLikeRecoveryCode('ab2defg3hk')).toBe(true)
    for (const bad of ['123456', 'AB2DE-FG3H', 'AB2DE-FG3H1', '', undefined]) {
      expect(looksLikeRecoveryCode(bad)).toBe(false)
    }
  })
})

describe('checkSignInCode', () => {
  it('accepts the current authenticator code and names its step', () => {
    const result = checkSignInCode(row(), [], totpCode(SECRET, NOW)!, NOW)
    expect(result).toMatchObject({ ok: true, kind: 'totp' })
  })
  it('refuses a replay once the matched step is recorded', () => {
    const code = totpCode(SECRET, NOW)!
    const first = checkSignInCode(row(), [], code, NOW)
    if (!first.ok || first.kind !== 'totp') throw new Error('expected a totp match')
    expect(checkSignInCode(row({ lastUsedStep: first.matchedStep }), [], code, NOW).ok).toBe(false)
  })
  it('accepts an unspent recovery code and says which row to spend', () => {
    const codes = [rc('a', 'AB2DE-FG3HK'), rc('b', 'CD4EF-GH5JK')]
    expect(checkSignInCode(row(), codes, 'ab2de fg3hk', NOW))
      .toEqual({ ok: true, kind: 'recovery', spentCodeId: 'a', codesLeft: 1 })
  })
  it('refuses a spent recovery code', () => {
    const codes = [rc('a', 'AB2DE-FG3HK', new Date('2026-11-10T00:00:00Z'))]
    expect(checkSignInCode(row(), codes, 'AB2DE-FG3HK', NOW).ok).toBe(false)
  })
  it('gates nothing while the enrollment is unconfirmed', () => {
    expect(checkSignInCode(row({ confirmedAt: null }), [], totpCode(SECRET, NOW)!, NOW).ok).toBe(false)
  })
  it('refuses what is neither code shape', () => {
    expect(checkSignInCode(row(), [rc('a', 'AB2DE-FG3HK')], 'wrong', NOW).ok).toBe(false)
  })
})

describe('checkEnrollmentCode', () => {
  it('takes only the authenticator’s own code', () => {
    expect(checkEnrollmentCode(SECRET, totpCode(SECRET, NOW)!, NOW).ok).toBe(true)
    expect(checkEnrollmentCode(SECRET, 'AB2DE-FG3HK', NOW).ok).toBe(false)
    expect(checkEnrollmentCode(SECRET, '000000', NOW).ok).toBe(
      totpCode(SECRET, NOW) === '000000', // all but one-in-a-million runs: false
    )
  })
})

describe('the wrong-code throttle', () => {
  it('starts the wait only at the limit, and a right code clears the slate', () => {
    let state: ThrottleState | undefined
    for (let i = 1; i < TOTP_MAX_FAILURES; i++) {
      state = recordFailure(state, NOW)
      expect(state).toEqual({ failures: i, retryAt: null })
      expect(throttled(state, NOW)).toBe(false)
    }
    state = recordFailure(state, NOW)
    expect(state.retryAt).toBe(NOW.getTime() + TOTP_THROTTLE_MS)
    expect(throttled(state, NOW)).toBe(true)
    expect(throttled(state, new Date(NOW.getTime() + TOTP_THROTTLE_MS))).toBe(false)
    expect(recordSuccess()).toBeUndefined()
    expect(throttled(undefined, NOW)).toBe(false)
  })
})

describe('npm run auth:2fa arguments', () => {
  it('parses each form', () => {
    expect(parseTwoFactorCommand(['--status'])).toEqual({ kind: 'status' })
    expect(parseTwoFactorCommand(['--disable', '--user', 'Someone@X.com']))
      .toEqual({ kind: 'disable', email: 'someone@x.com' })
  })
  it('refuses what it cannot mean', () => {
    for (const argv of [[], ['--disable'], ['--disable', '--user'], ['--disable', '--user', 'nobody'],
      ['--status', '--disable'], ['--status', '--user', 'a@b.c'], ['--wat'], ['--disable', '--user', 'a@b.c', 'extra']]) {
      expect(parseTwoFactorCommand(argv), argv.join(' ')).toHaveProperty('error')
    }
  })
})
