import 'server-only'

import { db, isDbConfigured } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import type { AuditActor, AuditEventId } from '@/lib/auth/auditEvents'

// The audit log's one writer (T-088, T-185, D235). Append-only by the database
// itself: migration 0013's trigger refuses every UPDATE and DELETE on the
// table, so this module only ever inserts.
//
// The invariant that shapes everything here: RECORDING MUST NEVER BREAK THE
// ACTION. A sign-in that fails because its log insert failed turns an audit
// aid into an outage, and a database without migration 0013 reads as "not
// logging yet" (said once in the server log) — the mustResetPassword pattern.
// So recordAudit swallows every failure after saying so, and callers await it
// without try/catch.

export interface AuditEntry {
  /** The account the event is about; omit for an owner action tied to none. */
  userId?: string | null
  actor: AuditActor
  event: AuditEventId
  /** Plain words, never a secret: "builder on", "part=trades". */
  detail?: string
}

let reportedBehind = false

export async function recordAudit(entry: AuditEntry): Promise<void> {
  if (!isDbConfigured) return
  try {
    await db.insert(auditLog).values({
      userId: entry.userId ?? null,
      actor: entry.actor,
      event: entry.event,
      detail: entry.detail ?? null,
    })
  } catch (e) {
    if (isSchemaBehindError(e)) {
      if (!reportedBehind) {
        reportedBehind = true
        console.warn('[audit] The audit log is idle until migration 0013 is applied: run `npm run db:migrate`.')
      }
      return
    }
    // Anything else: the action already happened; say so and carry on.
    console.error('[audit] Could not record an audit event:', (e as Error)?.message ?? e)
  }
}
