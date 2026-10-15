import { isSealedEnvelope, open, seal, SecretBoxError, SECRETS_KEY_ENV } from './secretBox'

/**
 * Text ↔ object for `.provider-config.json`, plain or sealed (T-437, D122). Pure, so every
 * case is testable without a file.
 *
 * The rule this exists to keep: **a file that cannot be read is never treated as empty.**
 * The store used to swallow every read error and return `{}`, so a corrupt file read as
 * "no keys", and the next save wrote over it, losing every key. Encryption would have made
 * that the normal outcome of a missing or mistyped key. Every unreadable case therefore
 * throws, with a message the owner can act on, and the caller declines to write.
 */

/** The file exists and could not be read safely; nothing may be written over it. */
export class ConfigUnreadableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigUnreadableError'
  }
}

export interface DecodedConfig {
  raw: Record<string, unknown>
  encrypted: boolean
}

const FILE = '.provider-config.json'

const asObject = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigUnreadableError(`${FILE} ${what} is not a JSON object; it was left untouched.`)
  }
  return value as Record<string, unknown>
}

export function decodeConfigText(text: string, key: Buffer | null): DecodedConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ConfigUnreadableError(`${FILE} is not valid JSON; it was left untouched. Fix or move it by hand.`)
  }
  const obj = asObject(parsed, 'content')

  if (!isSealedEnvelope(obj)) {
    // An envelope in a scheme this build does not know (a later version, say) must not be
    // mistaken for a plain config and then overwritten.
    if (typeof obj.format === 'string' && obj.format.startsWith('fn-')) {
      throw new ConfigUnreadableError(`${FILE} is encrypted with an unknown scheme (${obj.format}); it was left untouched.`)
    }
    return { raw: obj, encrypted: false }
  }

  if (!key) {
    throw new ConfigUnreadableError(
      `${FILE} is encrypted, but ${SECRETS_KEY_ENV} is not set in the server’s environment. ` +
        'Saved keys are unavailable, and saving is paused so nothing is overwritten, until it is set and the server restarted.',
    )
  }
  let plain: string
  try {
    plain = open(obj, key)
  } catch (e) {
    throw new ConfigUnreadableError(`${FILE} ${e instanceof SecretBoxError ? e.message : 'could not be decrypted.'} Saving is paused so nothing is overwritten.`)
  }
  let inner: unknown
  try {
    inner = JSON.parse(plain)
  } catch {
    throw new ConfigUnreadableError(`${FILE} decrypted, but its content is not valid JSON; it was left untouched.`)
  }
  return { raw: asObject(inner, 'decrypted content'), encrypted: true }
}

/** Sealed when a key is given, plain JSON otherwise. */
export function encodeConfigText(raw: unknown, key: Buffer | null): string {
  const json = JSON.stringify(raw, null, 2)
  return key ? JSON.stringify(seal(json, key), null, 2) : json
}
