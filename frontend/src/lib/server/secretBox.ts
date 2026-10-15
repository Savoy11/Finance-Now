import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Encryption at rest for the server-side secret stores (T-437, owner decision D122).
 *
 * `.provider-config.json` held every provider and AI key in plain text. A copy of it in a
 * backup, a OneDrive share or a stray commit handed all of them over at once, and mode
 * 0600 means little on Windows. The whole file is now sealed with AES-256-GCM under a key
 * that lives OUTSIDE it: a user environment variable, kept out of the OneDrive folder
 * (D122), and a host secret at launch.
 *
 * Pure: no files, no environment. Callers decide where the key and the text come from, so
 * every failure path is testable.
 */

/** The environment variable holding the key: 32 random bytes, base64. */
export const SECRETS_KEY_ENV = 'FN_SECRETS_KEY'

/** Names the scheme, and is bound into the ciphertext so an envelope cannot be relabelled. */
export const ENVELOPE_FORMAT = 'fn-aes-256-gcm-v1'

export interface SealedEnvelope {
  format: typeof ENVELOPE_FORMAT
  /** 12-byte GCM nonce, base64. Fresh on every seal. */
  iv: string
  /** 16-byte GCM authentication tag, base64. */
  tag: string
  /** Ciphertext, base64. */
  data: string
}

/** A key, an envelope or a decryption that is wrong in a way the owner must fix by hand. */
export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretBoxError'
  }
}

/**
 * The key from its environment value, or null when none is set. A value that is set but
 * is not 32 bytes of base64 throws: quietly falling back to plain text would store keys
 * unencrypted while the owner believed otherwise.
 */
export function parseSecretsKey(raw: string | undefined): Buffer | null {
  if (raw === undefined || raw.trim() === '') return null
  const trimmed = raw.trim()
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new SecretBoxError(`${SECRETS_KEY_ENV} is set but is not base64. It must be 32 random bytes, base64-encoded.`)
  }
  const key = Buffer.from(trimmed, 'base64')
  if (key.length !== 32) {
    throw new SecretBoxError(`${SECRETS_KEY_ENV} decodes to ${key.length} bytes; it must be exactly 32.`)
  }
  return key
}

export function isSealedEnvelope(value: unknown): value is SealedEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v.format === ENVELOPE_FORMAT && typeof v.iv === 'string' && typeof v.tag === 'string' && typeof v.data === 'string'
}

export function seal(plaintext: string, key: Buffer): SealedEnvelope {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(ENVELOPE_FORMAT, 'utf8'))
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { format: ENVELOPE_FORMAT, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

/** Throws SecretBoxError on a wrong key or any change to the envelope; never returns garbage. */
export function open(envelope: SealedEnvelope, key: Buffer): string {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
    decipher.setAAD(Buffer.from(ENVELOPE_FORMAT, 'utf8'))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    throw new SecretBoxError(
      `could not decrypt: ${SECRETS_KEY_ENV} is not the key this file was encrypted with, or the file was altered.`,
    )
  }
}
