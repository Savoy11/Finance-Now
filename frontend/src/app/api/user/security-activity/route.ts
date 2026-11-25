import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getSessionUserId } from '@/lib/auth/session'
import { AUDIT_EVENTS, isAuditEventId } from '@/lib/auth/auditEvents'

// Settings → Security activity (T-474, D245): the D235 audit log read back to
// the one account it is about. Until this route, the log was written by every
// security surface and read by nothing but "Download my data" — and the
// user-facing half of an append-only security log is an account holder
// noticing a "Sign-in failed" row they did not cause.
//
// Session-only, the D233 rule: getSessionUserId and never the shared local
// user, so in local mode (today) this answers 401 and the card shows nothing.
// Rows are the account's own and newest first — the exact query migration
// 0013's audit_log_user_idx was built for. A database without that migration
// reads as "not recording yet" (ok with recording:false), never an error: the
// writer's own posture.

export const dynamic = 'force-dynamic'

/** Enough to notice a pattern; the full history is in "Download my data" (T-452). */
export const SECURITY_ACTIVITY_MAX_ROWS = 50

export interface SecurityActivityRow {
  at: string
  event: string
  /** The vocabulary's plain-words sentence for the event (lib/auth/auditEvents.ts). */
  label: string
  detail: string | null
  /** 'user' (the account's own request) or 'owner-command'. */
  actor: string
}

export interface SecurityActivityResponse {
  ok: boolean
  /** False while migration 0013 has not run: nothing is being recorded yet. */
  recording: boolean
  rows: SecurityActivityRow[]
  error?: string
}

export async function GET() {
  if (!isDbConfigured) {
    return NextResponse.json(
      { ok: false, recording: false, rows: [], error: 'There is no database set up, so no security activity is recorded.' },
      { status: 503 },
    )
  }
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json(
      { ok: false, recording: false, rows: [], error: 'Sign in to see this account’s security activity.' },
      { status: 401 },
    )
  }
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.at))
      .limit(SECURITY_ACTIVITY_MAX_ROWS)
    const out: SecurityActivityResponse = {
      ok: true,
      recording: true,
      rows: rows.map((r) => ({
        at: r.at.toISOString(),
        event: r.event,
        // An event outside the vocabulary (a future version's) shows its id
        // rather than nothing — the row happened.
        label: isAuditEventId(r.event) ? AUDIT_EVENTS[r.event] : r.event,
        detail: r.detail,
        actor: r.actor,
      })),
    }
    return NextResponse.json(out)
  } catch (e) {
    if (isSchemaBehindError(e)) {
      return NextResponse.json({ ok: true, recording: false, rows: [] } satisfies SecurityActivityResponse)
    }
    throw e
  }
}
