// The owner commands' audit-log insert (T-088, T-185, D235). The app's writer
// is lib/server/auditLog.ts; this is the same row from a CLI's own postgres
// client. The same invariant holds: RECORDING NEVER BREAKS THE COMMAND — a
// database without migration 0013 gets a one-line note and the command's work
// stands.

import type { Sql } from 'postgres'
import type { AuditEventId } from '../../src/lib/auth/auditEvents'

export async function insertAudit(
  sql: Sql,
  entry: { userId?: string | null; event: AuditEventId; detail?: string },
): Promise<void> {
  try {
    await sql`
      insert into audit_log (user_id, actor, event, detail)
      values (${entry.userId ?? null}, 'owner-command', ${entry.event}, ${entry.detail ?? null})`
  } catch (e) {
    const code = (e as { code?: string })?.code
    console.error(code === '42P01'
      ? 'Note: not recorded in the audit log — migration 0013 has not run (`npm run db:migrate`).'
      : `Note: not recorded in the audit log: ${(e as Error)?.message ?? e}`)
  }
}
