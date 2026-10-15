import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

// T-437 / D122 (2026-10-15): provider and AI keys encrypted at rest in .provider-config.json.
// The store keeps one rule above all: a file it cannot read is never treated as empty and
// never written over. It used to swallow read errors and return {}, so the next save of a
// corrupt file lost every key, and encryption would have made that the normal result of a
// missing or mistyped key.

// An in-memory file system for providers.ts, so no test touches the disk.
const mem = vi.hoisted(() => {
  const files = new Map<string, string>()
  const fsImpl = {
    existsSync: (p: string) => files.has(p),
    readFileSync: (p: string) => {
      const v = files.get(p)
      if (v === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
      return v
    },
    writeFileSync: (p: string, data: string) => { files.set(p, String(data)) },
    renameSync: (from: string, to: string) => {
      const v = files.get(from)
      if (v === undefined) throw new Error(`ENOENT: ${from}`)
      files.set(to, v)
      files.delete(from) // the Map stands in for the disk; a rename moves the entry
    },
    chmodSync: () => {},
  }
  return { files, fsImpl }
})
vi.mock('fs', () => ({ default: mem.fsImpl, ...mem.fsImpl }))

import { parseSecretsKey, seal, open, isSealedEnvelope, SecretBoxError, SECRETS_KEY_ENV, ENVELOPE_FORMAT } from '../secretBox'
import { decodeConfigText, encodeConfigText, ConfigUnreadableError } from '../providerConfigCodec'
import { decodeProviderConfig, SECRETS_KEY_ENV as SCRIPT_KEY_ENV, ENVELOPE_FORMAT as SCRIPT_FORMAT } from '../../../../scripts/lib/providerConfigFile.mjs'

const keyB64 = () => randomBytes(32).toString('base64')
const SECRET = 'sk-test-0123456789abcdef'

describe('parseSecretsKey', () => {
  it('reads an unset or empty variable as no key', () => {
    expect(parseSecretsKey(undefined)).toBeNull()
    expect(parseSecretsKey('   ')).toBeNull()
  })
  it('accepts exactly 32 bytes of base64', () => {
    expect(parseSecretsKey(keyB64())?.length).toBe(32)
  })
  it('refuses a key that is set but wrong, rather than falling back to plain text', () => {
    expect(() => parseSecretsKey('not base64!')).toThrow(SecretBoxError)
    expect(() => parseSecretsKey(randomBytes(16).toString('base64'))).toThrow(/32/)
  })
})

describe('seal and open', () => {
  const key = parseSecretsKey(keyB64())!

  it('round-trips, and the ciphertext does not contain the secret', () => {
    const env = seal(`{"apiKey":"${SECRET}"}`, key)
    expect(isSealedEnvelope(env)).toBe(true)
    expect(JSON.stringify(env)).not.toContain(SECRET)
    expect(open(env, key)).toContain(SECRET)
  })
  it('uses a fresh nonce every time', () => {
    expect(seal('x', key).iv).not.toBe(seal('x', key).iv)
  })
  it('fails plainly on the wrong key, never returning garbage', () => {
    const env = seal('x', key)
    expect(() => open(env, parseSecretsKey(keyB64())!)).toThrow(SecretBoxError)
  })
  it('fails on any change to the ciphertext', () => {
    const env = seal('some secret text', key)
    const data = Buffer.from(env.data, 'base64')
    data[0] ^= 1
    expect(() => open({ ...env, data: data.toString('base64') }, key)).toThrow(SecretBoxError)
  })
})

describe('decodeConfigText', () => {
  const key = parseSecretsKey(keyB64())!
  const plain = JSON.stringify({ configs: { fmp: { apiKey: SECRET } } })

  it('reads a plain file as plain', () => {
    expect(decodeConfigText(plain, null)).toMatchObject({ encrypted: false, raw: { configs: { fmp: { apiKey: SECRET } } } })
  })
  it('reads a sealed file with its key', () => {
    expect(decodeConfigText(encodeConfigText(JSON.parse(plain), key), key)).toMatchObject({ encrypted: true, raw: { configs: { fmp: { apiKey: SECRET } } } })
  })
  it('names the missing variable when a sealed file meets no key', () => {
    const sealed = encodeConfigText(JSON.parse(plain), key)
    expect(() => decodeConfigText(sealed, null)).toThrow(ConfigUnreadableError)
    expect(() => decodeConfigText(sealed, null)).toThrow(SECRETS_KEY_ENV)
  })
  it('refuses a sealed file under the wrong key', () => {
    expect(() => decodeConfigText(encodeConfigText({}, key), parseSecretsKey(keyB64()))).toThrow(ConfigUnreadableError)
  })
  it('refuses corrupt JSON instead of reading it as empty', () => {
    expect(() => decodeConfigText('{"configs": {', null)).toThrow(ConfigUnreadableError)
  })
  it('refuses an envelope in a scheme it does not know', () => {
    expect(() => decodeConfigText(JSON.stringify({ format: 'fn-aes-256-gcm-v2', iv: '', tag: '', data: '' }), key)).toThrow(/unknown scheme/)
  })
  it('writes plain without a key and sealed with one', () => {
    expect(encodeConfigText({ a: SECRET }, null)).toContain(SECRET)
    expect(encodeConfigText({ a: SECRET }, key)).not.toContain(SECRET)
  })
})

describe('the scripts’ reader opens what the app seals', () => {
  it('shares the variable name and the format', () => {
    expect(SCRIPT_KEY_ENV).toBe(SECRETS_KEY_ENV)
    expect(SCRIPT_FORMAT).toBe(ENVELOPE_FORMAT)
  })
  it('decrypts the app’s envelope, and says why when it cannot', () => {
    const k = keyB64()
    const sealed = encodeConfigText({ configs: { tiingo: { apiKey: SECRET } } }, parseSecretsKey(k))
    expect(decodeProviderConfig(sealed, k)).toMatchObject({ encrypted: true, error: null, configs: { tiingo: { apiKey: SECRET } } })
    expect(decodeProviderConfig(sealed, undefined).error).toMatch(SECRETS_KEY_ENV)
    expect(decodeProviderConfig(sealed, keyB64()).error).toMatch(/could not be decrypted/)
    expect(decodeProviderConfig(JSON.stringify({ configs: { a: 1 } }), undefined)).toMatchObject({ encrypted: false, configs: { a: 1 } })
  })
})

// ── The store itself, on the in-memory file system ──
describe('the provider key store', () => {
  const CWD = '/mem/frontend'
  // providers.ts builds its path with path.join, which writes backslashes on Windows.
  const FILE = join(CWD, '.provider-config.json')
  const originalKey = process.env[SECRETS_KEY_ENV]

  beforeEach(() => {
    mem.files.clear()
    vi.resetModules()
    vi.spyOn(process, 'cwd').mockReturnValue(CWD)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete process.env[SECRETS_KEY_ENV]
  })
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalKey === undefined) delete process.env[SECRETS_KEY_ENV]
    else process.env[SECRETS_KEY_ENV] = originalKey
  })

  const store = () => import('../../api/live/providers')
  const plainFile = () => mem.files.set(FILE, JSON.stringify({ configs: { fmp: { apiKey: SECRET } }, customProviders: [] }))

  it('rewrites a plain file encrypted once a key is set, and still serves its keys', async () => {
    plainFile()
    process.env[SECRETS_KEY_ENV] = keyB64()
    const { getProviderKey, providerConfigStatus } = await store()
    expect(getProviderKey('fmp')).toBe(SECRET)
    expect(mem.files.get(FILE)).not.toContain(SECRET)
    expect(JSON.parse(mem.files.get(FILE)!).format).toBe(ENVELOPE_FORMAT)
    expect(providerConfigStatus()).toMatchObject({ encrypted: true, keySet: true, error: null })
  })

  it('saves sealed when a key is set', async () => {
    process.env[SECRETS_KEY_ENV] = keyB64()
    const { saveProviderConfig, getProviderKey } = await store()
    saveProviderConfig('tiingo', { apiKey: SECRET })
    expect(mem.files.get(FILE)).not.toContain(SECRET)
    expect(getProviderKey('tiingo')).toBe(SECRET)
  })

  it('never writes over an encrypted file it has no key for', async () => {
    mem.files.set(FILE, encodeConfigText({ configs: { fmp: { apiKey: SECRET } } }, parseSecretsKey(keyB64())))
    const before = mem.files.get(FILE)
    const { saveProviderConfig, recordProviderFetch, providerConfigStatus } = await store()
    saveProviderConfig('tiingo', { apiKey: 'another' })
    recordProviderFetch('fmp', { count: 3 }) // what every data route does
    expect(mem.files.get(FILE)).toBe(before)
    expect(providerConfigStatus().error).toMatch(SECRETS_KEY_ENV)
  })

  it('never writes over an encrypted file under the wrong key', async () => {
    mem.files.set(FILE, encodeConfigText({ configs: {} }, parseSecretsKey(keyB64())))
    const before = mem.files.get(FILE)
    process.env[SECRETS_KEY_ENV] = keyB64()
    const { saveProviderConfig } = await store()
    saveProviderConfig('tiingo', { apiKey: 'another' })
    expect(mem.files.get(FILE)).toBe(before)
  })

  it('never writes over a corrupt file (the bug that predates encryption)', async () => {
    mem.files.set(FILE, '{"configs": {"fmp": {"apiKey": "' + SECRET)
    const before = mem.files.get(FILE)
    const { saveProviderConfig } = await store()
    saveProviderConfig('tiingo', { apiKey: 'another' })
    expect(mem.files.get(FILE)).toBe(before)
  })

  it('pauses saving under a malformed key instead of storing plain text by mistake', async () => {
    plainFile()
    const before = mem.files.get(FILE)
    process.env[SECRETS_KEY_ENV] = 'too-short'
    const { saveProviderConfig, getProviderKey, providerConfigStatus } = await store()
    saveProviderConfig('tiingo', { apiKey: 'another' })
    expect(mem.files.get(FILE)).toBe(before)
    expect(getProviderKey('fmp')).toBe(SECRET) // reading a plain file still works
    expect(providerConfigStatus()).toMatchObject({ keySet: false })
    expect(providerConfigStatus().error).toMatch(SECRETS_KEY_ENV)
  })

  it('without a key, keeps working in plain text and says so', async () => {
    const { saveProviderConfig, providerConfigStatus } = await store()
    saveProviderConfig('tiingo', { apiKey: SECRET })
    expect(mem.files.get(FILE)).toContain(SECRET)
    expect(providerConfigStatus()).toMatchObject({ exists: true, encrypted: false, keySet: false, error: null })
  })
})
