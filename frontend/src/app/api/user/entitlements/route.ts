import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { entitlements } from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId, getSessionUserId } from '@/lib/auth/session'
import { recordAudit } from '@/lib/server/auditLog'
import {
  buildEntitlementsResponse, canUserToggle, isModuleId, toggleRefusalReason,
  type EntitlementMode, type EntitlementRowLike,
} from '@/lib/modules/entitlements'

// Module entitlements, served from the database (T-083, D234, 2026-11-21) —
// auth.md Goal B step 4, on the posture the owner chose: standard modules are
// personal on/off toggles synced to the account; Portfolio Builder is granted
// per account (owner command now, billing later), and a session's own toggle
// can never self-grant it. In local mode (sign-in off, today) everything
// behaves as it always has, so this route changes nothing before launch.
//
//   GET  /api/user/entitlements          → mode + what the account has
//   PUT  /api/user/entitlements          → { moduleId, enabled } for a togglable module
//
// The table has existed since migration 0000 ("Absence of a row means 'use the
// default'"); no new migration. The account comes from the session, else the
// shared local user, like every other /api/user store.

export const dynamic = 'force-dynamic'

async function resolveAccount(): Promise<{ userId: string; mode: EntitlementMode } | null> {
  const sessionUserId = await getSessionUserId()
  if (sessionUserId) return { userId: sessionUserId, mode: 'session' }
  const userId = await getCurrentUserId()
  return userId ? { userId, mode: 'local' } : null
}

async function readRows(userId: string): Promise<EntitlementRowLike[]> {
  return db
    .select({ moduleId: entitlements.moduleId, enabled: entitlements.enabled, expiresAt: entitlements.expiresAt })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
}

const migrate = () =>
  NextResponse.json(
    { ok: false, error: 'The entitlements table is missing: run `npm run db:migrate`.' },
    { status: 503 },
  )

export async function GET() {
  if (!isDbConfigured) {
    return NextResponse.json({ ok: false, error: 'There is no database set up.' }, { status: 503 })
  }
  const account = await resolveAccount()
  if (!account) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })
  try {
    const rows = await readRows(account.userId)
    return NextResponse.json(buildEntitlementsResponse(rows, account.mode, new Date()))
  } catch (e) {
    if (isSchemaBehindError(e)) return migrate()
    throw e
  }
}

export async function PUT(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ ok: false, error: 'There is no database set up.' }, { status: 503 })
  }
  const account = await resolveAccount()
  if (!account) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const moduleId = body?.moduleId
  const enabled = body?.enabled
  if (!isModuleId(moduleId) || typeof enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Send { moduleId, enabled }.' }, { status: 400 })
  }
  // The rule with the security weight: a session's toggle cannot reach a
  // premium module, so no account can grant itself Portfolio Builder.
  if (!canUserToggle(moduleId, account.mode)) {
    return NextResponse.json({ ok: false, error: toggleRefusalReason(moduleId) }, { status: 400 })
  }

  try {
    const now = new Date()
    await db
      .insert(entitlements)
      .values({ userId: account.userId, moduleId, enabled, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [entitlements.userId, entitlements.moduleId],
        set: { enabled, updatedAt: now },
        // A preference toggle never touches expiresAt: that column is the
        // grant term, billing's to write (and in session mode this branch can
        // only ever be a standard module's row anyway).
      })
    await recordAudit({
      userId: account.userId, actor: 'user', event: 'module_toggled',
      detail: `${moduleId} ${enabled ? 'on' : 'off'}`,
    })
    const rows = await readRows(account.userId)
    return NextResponse.json(buildEntitlementsResponse(rows, account.mode, now))
  } catch (e) {
    if (isSchemaBehindError(e)) return migrate()
    throw e
  }
}

// A row is upserted, never deleted: toggling back on sets enabled = true on the
// same row, and updatedAt keeps when the preference last changed.
