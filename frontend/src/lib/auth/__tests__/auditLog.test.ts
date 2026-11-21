import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { AUDIT_EVENTS, isAuditEventId, type AuditEventId } from '../auditEvents'

// T-088's last piece + T-185 (D235, 2026-11-21): the append-only security audit
// log. Three things held here: the table is tamper-evident by migration (WORM
// trigger) and survives its account (no foreign key); recording never breaks
// the action it records; and the event vocabulary cannot drift from the call
// sites — an event nobody records, or a recording with an unknown event, fails.

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

// Every event, pinned to the file(s) that record it. Adding an event means
// adding its call site here; removing a call site means removing its event.
const CALL_SITES: Record<AuditEventId, string[]> = {
  account_created: ['../../../app/api/auth/signup/route.ts'],
  signed_in: ['../config.ts'],
  signin_failed: ['../config.ts'],
  signin_refused_reset: ['../config.ts'],
  signin_code_failed: ['../config.ts'],
  signin_code_throttled: ['../config.ts'],
  password_reset: ['../../../app/api/auth/reset-password/route.ts'],
  reset_link_issued: ['../../../../scripts/auth-reset.ts'],
  two_factor_enabled: ['../../../app/api/user/two-factor/confirm/route.ts'],
  two_factor_disabled: ['../../../app/api/user/two-factor/disable/route.ts', '../../../../scripts/auth-2fa.ts'],
  recovery_codes_regenerated: ['../../../app/api/user/two-factor/recovery-codes/route.ts'],
  recovery_code_used: ['../twoFactorStore.ts'],
  module_toggled: ['../../../app/api/user/entitlements/route.ts'],
  module_granted: ['../../../../scripts/entitlements.ts'],
  module_revoked: ['../../../../scripts/entitlements.ts'],
  data_exported: ['../../../app/api/user/export/route.ts', '../../../../scripts/user-export.ts'],
}

describe('the event vocabulary and its call sites', () => {
  it('every event is recorded somewhere, in the file the map names', () => {
    for (const [event, files] of Object.entries(CALL_SITES)) {
      for (const file of files) {
        expect(read(file), `${event} in ${file}`).toContain(`'${event}'`)
      }
    }
    expect(Object.keys(CALL_SITES).sort()).toEqual(Object.keys(AUDIT_EVENTS).sort())
  })
  it('every recordAudit/insertAudit call names a known event', () => {
    const files = new Set(Object.values(CALL_SITES).flat())
    for (const file of files) {
      const src = read(file)
      // The two shapes a call site uses: `event: 'x'`, and each arm of
      // `event: cond ? 'a' : 'b'`.
      for (const m of src.matchAll(/event:\s*'([a-z_]+)'/g)) {
        expect(isAuditEventId(m[1]), `${m[1]} in ${file}`).toBe(true)
      }
      for (const m of src.matchAll(/event:\s*[^'\n]*\?\s*'([a-z_]+)'\s*:\s*'([a-z_]+)'/g)) {
        expect(isAuditEventId(m[1]), `${m[1]} in ${file}`).toBe(true)
        expect(isAuditEventId(m[2]), `${m[2]} in ${file}`).toBe(true)
      }
    }
  })
  it('sign-in failures are logged only for an email that matched an account', () => {
    const config = read('../config.ts')
    // signin_failed is recorded after the user row was found, inside the !ok branch.
    expect(config.indexOf("event: 'signin_failed'")).toBeGreaterThan(config.indexOf('if (!user?.passwordHash) return null'))
  })
})

describe('the table (migration 0013)', () => {
  const migration = readFileSync(resolve(__dirname, '../../../../drizzle/0013_audit-log.sql'), 'utf8')

  it('creates the table and the WORM trigger that refuses every UPDATE and DELETE', () => {
    expect(migration).toMatch(/CREATE TABLE "audit_log"/)
    expect(migration).toMatch(/CREATE FUNCTION audit_log_immutable\(\) RETURNS trigger/)
    expect(migration).toMatch(/RAISE EXCEPTION 'audit_log is append-only/)
    expect(migration).toMatch(/BEFORE UPDATE OR DELETE ON "audit_log"/)
    // The migrator splits on these; the trigger statements must be their own.
    expect(migration.match(/--> statement-breakpoint/g)?.length).toBeGreaterThanOrEqual(3)
  })
  it('audit rows survive their account: user_id carries NO foreign key, deliberately', async () => {
    const { auditLog } = await import('@/lib/db/schema')
    const config = getTableConfig(auditLog)
    expect(config.columns.some((c) => c.name === 'user_id')).toBe(true)
    expect(config.foreignKeys).toHaveLength(0)
  })
  it('an account’s own audit rows are in its data export, found by the user_id column', async () => {
    const { userExportTables } = await import('@/lib/server/userExportCollect')
    expect(userExportTables()).toContain('audit_log')
  })
})

// ─── recordAudit never breaks the action ─────────────────────────────────────

const dbMock = vi.hoisted(() => ({
  inserted: [] as unknown[],
  fail: null as unknown,
  configured: true,
}))
vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => {
        if (dbMock.fail) return Promise.reject(dbMock.fail)
        dbMock.inserted.push(v)
        return Promise.resolve()
      },
    }),
  },
  get isDbConfigured() { return dbMock.configured },
}))

describe('recordAudit', () => {
  beforeEach(() => {
    dbMock.inserted = []
    dbMock.fail = null
    dbMock.configured = true
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  const load = async () => (await import('../../server/auditLog')).recordAudit

  it('writes the row as given, with nulls where nothing was said', async () => {
    const recordAudit = await load()
    await recordAudit({ userId: 'u1', actor: 'user', event: 'signed_in' })
    await recordAudit({ actor: 'owner-command', event: 'reset_link_issued', detail: 'forced' })
    expect(dbMock.inserted).toEqual([
      { userId: 'u1', actor: 'user', event: 'signed_in', detail: null },
      { userId: null, actor: 'owner-command', event: 'reset_link_issued', detail: 'forced' },
    ])
  })
  it('a missing table (migration 0013 unrun) is a one-line note, never a thrown error', async () => {
    const recordAudit = await load()
    dbMock.fail = Object.assign(new Error('relation "audit_log" does not exist'), { code: '42P01' })
    await expect(recordAudit({ actor: 'user', event: 'signed_in' })).resolves.toBeUndefined()
  })
  it('any other failure is said and swallowed — recording never breaks the action', async () => {
    const recordAudit = await load()
    dbMock.fail = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    await expect(recordAudit({ actor: 'user', event: 'signed_in' })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
  it('with no database configured it does nothing at all', async () => {
    const recordAudit = await load()
    dbMock.configured = false
    await recordAudit({ actor: 'user', event: 'signed_in' })
    expect(dbMock.inserted).toEqual([])
  })
})
