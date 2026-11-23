import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'

// ─── Security audit log (T-088's last piece + T-185; D235, migration 0013) ───
// An append-only record of account-security events: sign-ins and their
// refusals, account creation, password resets, two-factor changes, module
// grants and toggles, and data exports. Migration 0013 also creates a
// BEFORE UPDATE OR DELETE trigger that raises an exception, so a row can
// never be edited or removed — tamper-evident by the database itself (WORM),
// the shape T-185 specified. The writer is lib/server/auditLog.ts; the event
// vocabulary is lib/auth/auditEvents.ts.
//
// ⚠ user_id carries NO foreign key, deliberately. Every other user table
// CASCADEs away with its user; an audit log must do the opposite — the record
// of what happened to an account survives the account, and a cascade DELETE
// would be refused by the WORM trigger anyway, which would make deleting a
// user impossible. The column is still named user_id on purpose: "Download
// my data" finds tables by that column, so an account's own audit rows are
// in its export without anyone remembering them (T-452).
//
// No IP address or browser string is kept — that would be new personal data
// the draft Privacy Policy does not yet name. Events, times and plain-words
// detail only; nothing secret ever goes in `detail`.

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  /** The account the event is about; null for an owner action tied to none. */
  userId: uuid('user_id'),
  /** Who did it: 'user' (their own request) or 'owner-command' (a CLI on the server). */
  actor: text('actor').notNull(),
  /** An id from lib/auth/auditEvents.ts, e.g. 'signed_in', 'two_factor_enabled'. */
  event: text('event').notNull(),
  /** Plain words, never a secret: "builder on", "part=trades". */
  detail: text('detail'),
}, (t) => ({
  byUser: index('audit_log_user_idx').on(t.userId, t.at),
}))

export type AuditLogRow = typeof auditLog.$inferSelect
