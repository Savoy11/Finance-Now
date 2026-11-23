import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// ─── One-time codes for two-factor sign-in (T-088, D233) ─────────────────────
//
// The standard authenticator-app scheme, implemented here rather than taken as a
// dependency: TOTP (RFC 6238) over HOTP (RFC 4226) with HMAC-SHA1, 6 digits, a
// 30-second step — what Google Authenticator, Microsoft Authenticator, Aegis,
// 1Password and the rest all speak. It is ~60 lines of arithmetic over
// node:crypto, and __tests__/totp.test.ts holds it to the RFC's own published
// test vectors, which is a stronger check than trusting a package's README.
// SHA-1 here is the RFC's keyed HMAC, not a collision-prone signature — the
// algorithm every authenticator app defaults to.
//
// No 'server-only' import: the owner's command (scripts/auth-2fa.ts) runs under
// tsx, outside Next, the same reason lib/auth/passwordReset.ts has none. The
// secret still never reaches the client except once, at enrollment, over the
// enrollment response.

/** RFC 4648 base32 alphabet — what otpauth:// secrets are written in. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const TOTP_DIGITS = 6
export const TOTP_STEP_SECONDS = 30
/** Steps accepted either side of now, for clock drift between phone and server. */
export const TOTP_DRIFT_STEPS = 1

/** 20 random bytes (RFC 4226 §4's minimum is 16; SHA-1's block-fit is 20), as base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** Tolerant of lowercase, spaces and '=' padding; null for anything else that is not base32. */
export function base32Decode(s: string): Uint8Array | null {
  const clean = s.toUpperCase().replace(/[\s=]/g, '')
  if (clean.length === 0) return null
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** RFC 4226 HOTP: HMAC-SHA1 over the big-endian counter, dynamically truncated. */
export function hotp(secretBytes: Uint8Array, counter: number, digits: number = TOTP_DIGITS): string {
  const buf = Buffer.alloc(8)
  // The counter fits well inside Number.MAX_SAFE_INTEGER for any real time step.
  buf.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', Buffer.from(secretBytes)).update(buf).digest()
  const offset = mac[mac.length - 1] & 0x0f
  const code =
    (((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]) %
    10 ** digits
  return String(code).padStart(digits, '0')
}

/** The TOTP time step a moment falls in. */
export function totpStep(now: Date, stepSeconds: number = TOTP_STEP_SECONDS): number {
  return Math.floor(now.getTime() / 1000 / stepSeconds)
}

/** The code an authenticator app shows for this secret at this moment. */
export function totpCode(secret: string, now: Date, digits: number = TOTP_DIGITS): string | null {
  const bytes = base32Decode(secret)
  if (!bytes || bytes.length === 0) return null
  return hotp(bytes, totpStep(now), digits)
}

/** Six digits, with spaces or dashes allowed between them ("123 456" is a code). */
export function looksLikeTotpCode(input: unknown): input is string {
  return typeof input === 'string' && new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(normalizeCodeInput(input))
}

/** What was typed, with the separators people copy along removed. */
export function normalizeCodeInput(input: string): string {
  return input.replace(/[\s-]/g, '')
}

export interface TotpVerification {
  ok: boolean
  /** The step the code matched, so the caller can refuse a replay of it. */
  matchedStep?: number
}

/**
 * Whether a typed code is this secret's code now, or one step either side of now
 * (clock drift). `notAfterStep` refuses any step at or before it — the caller
 * passes the last step that already signed someone in, so a code seen over a
 * shoulder cannot be replayed inside its 30 seconds (RFC 6238 §5.2).
 */
export function verifyTotp(
  secret: string,
  input: string,
  now: Date,
  opts: { driftSteps?: number; notAfterStep?: number | null } = {},
): TotpVerification {
  const bytes = base32Decode(secret)
  const code = normalizeCodeInput(input)
  if (!bytes || bytes.length === 0 || !new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) return { ok: false }
  const drift = opts.driftSteps ?? TOTP_DRIFT_STEPS
  const current = totpStep(now)
  for (let step = current - drift; step <= current + drift; step++) {
    if (step < 0) continue
    if (opts.notAfterStep != null && step <= opts.notAfterStep) continue
    if (codesEqual(hotp(bytes, step), code)) return { ok: true, matchedStep: step }
  }
  return { ok: false }
}

/** Constant-time comparison, so a mismatch's timing says nothing about where it diverged. */
function codesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/**
 * The otpauth:// URI an authenticator app enrolls from — shown as a link (phones
 * register the scheme) beside the manual key; there is no QR code on purpose,
 * since drawing one would be this app's first client-side dependency for it.
 */
export function otpauthUri(secret: string, accountName: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** The secret in groups of four, the shape apps' "enter a setup key" boxes expect. */
export function formatManualKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}
