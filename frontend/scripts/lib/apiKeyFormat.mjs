// How an API key for /api/v1 is made and listed (D173). Pure, so the test can hold the
// format to what lib/server/apiKeys.ts accepts.

/** A new key: "fnk_" and 32 random bytes in base64url, 47 characters. */
export function newApiKey(randomBytes) {
  return `fnk_${randomBytes(32).toString('base64url')}`
}

/** A label FN_API_KEYS can carry: letters, digits, dots, dashes and underscores. */
export function cleanName(name) {
  const n = String(name ?? '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return n || 'key'
}

/** The entry to add to FN_API_KEYS for this key. */
export function envEntry(name, key) {
  return `${cleanName(name)}:${key}`
}
