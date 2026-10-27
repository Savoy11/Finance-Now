import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { CORS } from '@/app/api/_cors'
import { clientKey, dailyBudgetExceeded, isLocalRequest, rateLimited } from './apiGuard'
import { sameSecret } from './ownerAccess'

// Keys and rate limits for the public API, /api/v1 (T-087, owner decision D173, 2026-10-26:
// "Build the API key and rate limit").
//
// Until then /api/v1 had no key and no limit, sent CORS to every site, and spent the owner's
// own provider keys on whoever called it (the P3 review's D2: "ship it, gate it, or fence it
// at deploy"). Now:
//
// - Data routes need a key: `Authorization: Bearer <key>` or `x-api-key: <key>`. Keys are
//   issued by the owner (`npm run api:key`) and listed in FN_API_KEYS on the server, never in
//   the repository.
// - Each key gets API_PER_MINUTE requests a minute and API_PER_DAY a day; past either the
//   answer is 429 with Retry-After.
// - The endpoint list (/api/v1) and the OpenAPI spec stay open: they hold no data and spend no
//   provider quota. They are rate-limited per client address.
// - With no keys set, the API answers only on the owner's machine (localhost), the rule the
//   owner's tools already follow, so a deployed build without keys is closed, not open.
// - The app's own AI tools call /api/v1 from the server. They send an internal token instead
//   of a key (internalApiToken), and their spend is already bounded by the agent routes'
//   own limits (apiGuard), so they are not counted here.

export const API_PER_MINUTE = 60
export const API_PER_DAY = 2_000
/** Shortest key accepted, so a typo or a placeholder can never be a working key. */
export const API_KEY_MIN_LENGTH = 24
export const INTERNAL_HEADER = 'x-fn-internal'

export interface ApiKey {
  /** A label for the key, from "name:key" in FN_API_KEYS; the key's position otherwise. */
  name: string
  key: string
}

/**
 * The keys in FN_API_KEYS: comma-separated, each "name:key" or just "key". An entry shorter
 * than API_KEY_MIN_LENGTH is ignored rather than accepted.
 */
export function parseApiKeys(raw: string | undefined): ApiKey[] {
  if (!raw) return []
  const out: ApiKey[] = []
  raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((entry, i) => {
    const at = entry.indexOf(':')
    const name = at > 0 ? entry.slice(0, at).trim() : `key-${i + 1}`
    const key = at > 0 ? entry.slice(at + 1).trim() : entry
    if (key.length >= API_KEY_MIN_LENGTH) out.push({ name, key })
  })
  return out
}

export function configuredApiKeys(): ApiKey[] {
  return parseApiKeys(process.env.FN_API_KEYS)
}

declare global {
  var __fnInternalApiToken: string | undefined
}

/**
 * The token the app's own AI tools send to /api/v1. Derived from a server secret when one is
 * set (FN_ADMIN_TOKEN, then AUTH_SECRET), so every copy of the app agrees; otherwise random
 * per process, which is enough for the single process the app runs as.
 */
export function internalApiToken(): string {
  const secret = process.env.FN_ADMIN_TOKEN || process.env.CAEP_ADMIN_TOKEN || process.env.AUTH_SECRET
  if (secret) return crypto.createHmac('sha256', secret).update('finance-now-internal-api-v1').digest('hex')
  globalThis.__fnInternalApiToken ??= crypto.randomBytes(32).toString('hex')
  return globalThis.__fnInternalApiToken
}

/** The key a request presents, from either header. */
export function presentedKey(req: NextRequest): string {
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  return bearer || req.headers.get('x-api-key')?.trim() || ''
}

function deny(status: number, error: string, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json({ error }, { status, headers: { ...CORS, ...extra } })
}

function limited(caller: string): NextResponse | null {
  if (rateLimited(`api-v1:${caller}`, API_PER_MINUTE)) {
    return deny(429, `Rate limit: ${API_PER_MINUTE} requests a minute per key. Try again shortly.`, { 'Retry-After': '60' })
  }
  if (dailyBudgetExceeded(`api-v1-day:${caller}`, API_PER_DAY)) {
    return deny(429, `Daily limit: ${API_PER_DAY} requests a day per key. It resets within 24 hours.`, { 'Retry-After': '3600' })
  }
  return null
}

/**
 * Call first in every /api/v1 handler. Returns the refusal, or null to proceed.
 * `open` marks the endpoint list and the spec, which need no key.
 */
export function guardApiV1(req: NextRequest, opts: { open?: boolean } = {}): NextResponse | null {
  const internal = req.headers.get(INTERNAL_HEADER)
  if (internal && sameSecret(internal, internalApiToken())) return null

  if (opts.open) return limited(`ip:${clientKey(req)}`)

  const keys = configuredApiKeys()
  if (keys.length === 0) {
    if (isLocalRequest(req)) return limited(`ip:${clientKey(req)}`)
    return deny(401, 'This API is closed on this server: no API keys are set. The owner issues keys with `npm run api:key` and lists them in FN_API_KEYS.', { 'WWW-Authenticate': 'Bearer' })
  }
  const supplied = presentedKey(req)
  if (!supplied) {
    return deny(401, 'An API key is required: send it as "Authorization: Bearer <key>" or "x-api-key: <key>".', { 'WWW-Authenticate': 'Bearer' })
  }
  const match = keys.find((k) => sameSecret(supplied, k.key))
  if (!match) return deny(401, 'That API key is not valid.', { 'WWW-Authenticate': 'Bearer error="invalid_token"' })
  return limited(`key:${match.name}`)
}
