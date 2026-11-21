import { describe, it, expect } from 'vitest'
import {
  base32Decode, base32Encode, formatManualKey, generateTotpSecret, hotp, looksLikeTotpCode,
  normalizeCodeInput, otpauthUri, totpCode, totpStep, verifyTotp, TOTP_STEP_SECONDS,
} from '../totp'

// T-088 / D233: the one-time-code arithmetic, held to the RFCs' own published test
// vectors rather than to another implementation. RFC 4226 (HOTP) Appendix D and
// RFC 6238 (TOTP) Appendix B both use the ASCII secret "12345678901234567890".

const RFC_SECRET_BYTES = new Uint8Array(Buffer.from('12345678901234567890', 'ascii'))
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('base32 (RFC 4648)', () => {
  it('encodes the RFC vectors (unpadded)', () => {
    const cases: [string, string][] = [
      ['', ''], ['f', 'MY'], ['fo', 'MZXQ'], ['foo', 'MZXW6'],
      ['foob', 'MZXW6YQ'], ['fooba', 'MZXW6YTB'], ['foobar', 'MZXW6YTBOI'],
    ]
    for (const [plain, encoded] of cases) {
      expect(base32Encode(new Uint8Array(Buffer.from(plain, 'ascii')))).toBe(encoded)
    }
  })
  it('encodes the RFC secret to the well-known base32 form, and decodes it back', () => {
    expect(base32Encode(RFC_SECRET_BYTES)).toBe(RFC_SECRET_BASE32)
    expect(Buffer.from(base32Decode(RFC_SECRET_BASE32)!).toString('ascii')).toBe('12345678901234567890')
  })
  it('tolerates lowercase, spaces and padding; refuses other characters', () => {
    expect(base32Decode('mzxw 6ytb oi==')).toEqual(base32Decode('MZXW6YTBOI'))
    expect(base32Decode('MZXW8')).toBeNull() // 8 is not in the alphabet
    expect(base32Decode('')).toBeNull()
  })
})

describe('HOTP (RFC 4226 Appendix D)', () => {
  it('produces the ten published 6-digit codes for counters 0–9', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']
    expected.forEach((code, counter) => {
      expect(hotp(RFC_SECRET_BYTES, counter), `counter ${counter}`).toBe(code)
    })
  })
})

describe('TOTP (RFC 6238 Appendix B, SHA-1 rows)', () => {
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ]
  it('produces the published 8-digit codes', () => {
    for (const [seconds, code] of vectors) {
      expect(hotp(RFC_SECRET_BYTES, Math.floor(seconds / TOTP_STEP_SECONDS), 8), `T=${seconds}`).toBe(code)
    }
  })
  it('the default 6 digits are the same codes’ last six', () => {
    for (const [seconds, code] of vectors) {
      expect(totpCode(RFC_SECRET_BASE32, new Date(seconds * 1000)), `T=${seconds}`).toBe(code.slice(-6))
    }
  })
})

describe('verifyTotp', () => {
  const now = new Date(1111111111 * 1000)
  it('accepts the current code, and one step either side for clock drift', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, '050471', now).ok).toBe(true) // current (14050471)
    expect(verifyTotp(RFC_SECRET_BASE32, '081804', now).ok).toBe(true) // previous step (07081804, T=…109)
    const next = totpCode(RFC_SECRET_BASE32, new Date(now.getTime() + TOTP_STEP_SECONDS * 1000))!
    expect(verifyTotp(RFC_SECRET_BASE32, next, now).ok).toBe(true)
    const twoBack = totpCode(RFC_SECRET_BASE32, new Date(now.getTime() - 2 * TOTP_STEP_SECONDS * 1000))!
    expect(verifyTotp(RFC_SECRET_BASE32, twoBack, now).ok).toBe(false)
  })
  it('tolerates spaces and dashes in what was typed', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, '050 471', now).ok).toBe(true)
    expect(verifyTotp(RFC_SECRET_BASE32, '050-471', now).ok).toBe(true)
  })
  it('reports which step matched, and refuses a replay at or before notAfterStep', () => {
    const v = verifyTotp(RFC_SECRET_BASE32, '050471', now)
    expect(v).toEqual({ ok: true, matchedStep: totpStep(now) })
    // The same code again, with its step recorded as used: refused, drift window or not.
    expect(verifyTotp(RFC_SECRET_BASE32, '050471', now, { notAfterStep: v.matchedStep }).ok).toBe(false)
    // The previous step's code is refused too — notAfterStep is a floor, not one step.
    expect(verifyTotp(RFC_SECRET_BASE32, '081804', now, { notAfterStep: v.matchedStep }).ok).toBe(false)
  })
  it('refuses garbage without arithmetic', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12345a']) {
      expect(verifyTotp(RFC_SECRET_BASE32, bad, now).ok).toBe(false)
    }
    expect(verifyTotp('not base32!!', '123456', now).ok).toBe(false)
  })
})

describe('secrets and enrollment strings', () => {
  it('generates 20-byte (32-character) base32 secrets, each fresh', () => {
    const a = generateTotpSecret()
    expect(a).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(a)!.length).toBe(20)
    expect(generateTotpSecret()).not.toBe(a)
  })
  it('the otpauth URI carries the standard fields and survives odd account names', () => {
    const uri = otpauthUri(RFC_SECRET_BASE32, 'a b@x.com', 'Finance Now')
    expect(uri).toBe(
      'otpauth://totp/Finance%20Now:a%20b%40x.com'
      + `?secret=${RFC_SECRET_BASE32}&issuer=Finance+Now&algorithm=SHA1&digits=6&period=30`,
    )
  })
  it('the manual key is the secret in groups of four', () => {
    expect(formatManualKey('ABCDEFGH2345')).toBe('ABCD EFGH 2345')
    expect(formatManualKey(RFC_SECRET_BASE32).replace(/ /g, '')).toBe(RFC_SECRET_BASE32)
  })
  it('looksLikeTotpCode takes six digits, however separated, and nothing else', () => {
    expect(looksLikeTotpCode('123456')).toBe(true)
    expect(looksLikeTotpCode('123 456')).toBe(true)
    expect(normalizeCodeInput('12-34 56')).toBe('123456')
    for (const bad of ['12345', '1234567', 'ABCDE-FGHJK', '', undefined, 123456]) {
      expect(looksLikeTotpCode(bad)).toBe(false)
    }
  })
})
