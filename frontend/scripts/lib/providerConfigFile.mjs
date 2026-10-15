// Read .provider-config.json from a script, plain or sealed (T-437, D122).
//
// The app seals the file with AES-256-GCM under FN_SECRETS_KEY (src/lib/server/secretBox.ts,
// providerConfigCodec.ts). Scripts run under plain node and cannot import that TypeScript, so
// this is a deliberate mirror of the OPEN half only: scripts read keys, they never write the
// store. providerConfigFile.test.ts seals with the app's code and opens with this one, so the
// two cannot drift apart unnoticed.
//
// It returns an error rather than an empty config when the file cannot be read: a script
// that says "no key configured" while the key sits in an encrypted file it could not open
// sends the owner hunting for a key that is there.
import fs from 'node:fs'
import path from 'node:path'
import { createDecipheriv } from 'node:crypto'

export const SECRETS_KEY_ENV = 'FN_SECRETS_KEY'
export const ENVELOPE_FORMAT = 'fn-aes-256-gcm-v1'

/** @returns {{ configs: Record<string, any>, encrypted: boolean, error: string | null }} */
export function decodeProviderConfig(text, keyB64) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    return { configs: {}, encrypted: false, error: '.provider-config.json is not valid JSON.' }
  }
  if (obj?.format !== ENVELOPE_FORMAT) {
    if (typeof obj?.format === 'string' && obj.format.startsWith('fn-')) {
      return { configs: {}, encrypted: true, error: `.provider-config.json uses an unknown encryption scheme (${obj.format}).` }
    }
    return { configs: obj?.configs ?? obj ?? {}, encrypted: false, error: null }
  }
  if (!keyB64 || !keyB64.trim()) {
    return { configs: {}, encrypted: true, error: `.provider-config.json is encrypted and ${SECRETS_KEY_ENV} is not set in this shell.` }
  }
  const key = Buffer.from(keyB64.trim(), 'base64')
  if (key.length !== 32) {
    return { configs: {}, encrypted: true, error: `${SECRETS_KEY_ENV} must decode to 32 bytes; it decodes to ${key.length}.` }
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(obj.iv, 'base64'))
    decipher.setAAD(Buffer.from(ENVELOPE_FORMAT, 'utf8'))
    decipher.setAuthTag(Buffer.from(obj.tag, 'base64'))
    const plain = Buffer.concat([decipher.update(Buffer.from(obj.data, 'base64')), decipher.final()]).toString('utf8')
    const inner = JSON.parse(plain)
    return { configs: inner.configs ?? inner, encrypted: true, error: null }
  } catch {
    return { configs: {}, encrypted: true, error: `.provider-config.json could not be decrypted with this ${SECRETS_KEY_ENV}.` }
  }
}

/** process.cwd() is frontend/ when run through npm, matching providers.ts. */
export function readProviderConfigs(cwd = process.cwd(), env = process.env) {
  const p = path.join(cwd, '.provider-config.json')
  if (!fs.existsSync(p)) return { configs: {}, encrypted: false, error: null }
  return decodeProviderConfig(fs.readFileSync(p, 'utf8'), env[SECRETS_KEY_ENV])
}
