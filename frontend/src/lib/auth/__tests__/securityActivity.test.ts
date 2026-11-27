import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUDIT_EVENTS } from '../auditEvents'

// T-474 (D245): Settings → Security activity — the D235 audit log read back to
// the one account it is about. These tests drive the route against a mocked
// database (the auditLog.test.ts idiom) and pin the wiring: session-only (the
// D233 rule — never the shared local user), "not recording yet" on a database
// without migration 0013, the vocabulary's plain words on every row, and the
// card dark without a session.

const state = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; at: Date; userId: string | null; actor: string; event: string; detail: string | null }>,
  fail: null as unknown,
  configured: true,
  userId: 'u1' as string | null,
  queried: [] as unknown[],
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (w: unknown) => {
          state.queried.push(w)
          return {
            orderBy: () => ({
              limit: () => (state.fail ? Promise.reject(state.fail) : Promise.resolve(state.rows)),
            }),
          }
        },
      }),
    }),
  },
  get isDbConfigured() { return state.configured },
}))

vi.mock('@/lib/auth/session', () => ({
  getSessionUserId: async () => state.userId,
}))

const load = async () => await import('../../../app/api/user/security-activity/route')

describe('GET /api/user/security-activity', () => {
  beforeEach(() => {
    state.rows = []
    state.fail = null
    state.configured = true
    state.userId = 'u1'
    state.queried = []
  })

  it('answers 401 with no session — the shared local user never sees a log (D233)', async () => {
    state.userId = null
    const res = await (await load()).GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('returns the account’s rows in the vocabulary’s plain words, detail and actor intact', async () => {
    state.rows = [
      { id: '1', at: new Date('2026-11-25T03:12:00Z'), userId: 'u1', actor: 'user', event: 'signin_failed', detail: null },
      { id: '2', at: new Date('2026-11-24T18:00:00Z'), userId: 'u1', actor: 'owner-command', event: 'module_granted', detail: 'builder on' },
      // A future version’s event outside today’s vocabulary still shows — the row happened.
      { id: '3', at: new Date('2026-11-24T17:00:00Z'), userId: 'u1', actor: 'user', event: 'passkey_added', detail: null },
    ]
    const res = await (await load()).GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.recording).toBe(true)
    expect(body.rows[0].label).toBe(AUDIT_EVENTS.signin_failed)
    expect(body.rows[0].at).toBe('2026-11-25T03:12:00.000Z')
    expect(body.rows[1]).toMatchObject({ label: AUDIT_EVENTS.module_granted, detail: 'builder on', actor: 'owner-command' })
    expect(body.rows[2].label).toBe('passkey_added')
  })

  it('a database without migration 0013 reads "not recording yet", never an error', async () => {
    state.fail = Object.assign(new Error('relation "audit_log" does not exist'), { code: '42P01' })
    const res = await (await load()).GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, recording: false, rows: [] })
  })

  it('no database configured answers 503, like its neighbours', async () => {
    state.configured = false
    const res = await (await load()).GET()
    expect(res.status).toBe(503)
  })
})

describe('the wiring (drift fails, not review)', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../../', p), 'utf8')

  it('the route is session-only and reads newest-first with a bound', () => {
    const src = read('app/api/user/security-activity/route.ts')
    expect(src).toContain('getSessionUserId')
    // Never the shared local user: that resolver must not appear.
    expect(src).not.toContain('getCurrentUserId')
    expect(src).toContain('desc(auditLog.at)')
    expect(src).toContain('SECURITY_ACTIVITY_MAX_ROWS')
    // Display-only: the route must never write.
    expect(src).not.toMatch(/\binsert\b|\bupdate\b|\bdelete\b/i)
  })

  it('the Settings page mounts the card beside the two-step panel', () => {
    const page = read('app/(dashboard)/settings/page.tsx')
    expect(page).toContain('<SecurityActivityPanel />')
  })

  it('the card is dark without a session and renders the stored words, nothing invented', () => {
    const panel = read('components/settings/SecurityActivityPanel.tsx')
    expect(panel).toContain("fetch('/api/user/security-activity')")
    expect(panel).toContain('if (!signedIn || !data) return null')
    expect(panel).toContain('{r.label}')
    // The not-recording state is said, not hidden.
    expect(panel).toContain('migration 0013')
    // Every timestamp carries its year: the newest-50 list has no time bound,
    // so an old refused sign-in must not read like a recent one (2026-11-26
    // audit).
    expect(panel).toContain("year: 'numeric'")
  })
})
