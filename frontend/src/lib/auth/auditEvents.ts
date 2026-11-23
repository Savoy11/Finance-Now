// ─── The audit log's event vocabulary (T-088, T-185, D235) ───────────────────
//
// Every row in audit_log names one of these. The vocabulary is pure and lives
// here (not in lib/server) so the owner's commands and the tests share it;
// auditLog.test.ts pins each event to the file that records it, so an event
// nobody writes, or a write with an unlisted event, fails the suite.
//
// What is logged, and the line drawn (D235): ACCOUNT-SECURITY events and the
// owner's administrative actions — not every portfolio or watchlist edit. The
// trade ledger is already its own append-only record (cancel, never delete),
// and logging every data edit would bury the sign-ins and grant changes this
// log exists to answer for. Widening it later is additive.

export type AuditActor = 'user' | 'owner-command'

export const AUDIT_EVENTS = {
  /** An account was created at /signup. */
  account_created: 'Account created',
  /** A password sign-in succeeded (after every check, two-factor included). */
  signed_in: 'Signed in',
  /** The password was wrong for an existing account. Never logged for an unknown email. */
  signin_failed: 'Sign-in failed: wrong password',
  /** The password was right, but the owner has forced a reset (T-435). */
  signin_refused_reset: 'Sign-in refused: password reset required',
  /** The password was right, but the second-step code was wrong or replayed. */
  signin_code_failed: 'Sign-in failed: wrong two-factor code',
  /** Too many wrong codes in a row; the account is waiting (lib/auth/twoFactor.ts). */
  signin_code_throttled: 'Sign-in held: too many wrong two-factor codes',
  /** A reset link was spent and the password changed. */
  password_reset: 'Password reset',
  /** The owner issued a reset link (npm run auth:reset). */
  reset_link_issued: 'Password reset link issued',
  /** Two-step sign-in was confirmed on. */
  two_factor_enabled: 'Two-step sign-in turned on',
  /** Two-step sign-in was turned off — by the account with a code, or the owner's command. */
  two_factor_disabled: 'Two-step sign-in turned off',
  /** A fresh set of recovery codes replaced the old one. */
  recovery_codes_regenerated: 'Recovery codes regenerated',
  /** A one-time recovery code signed the account in (or re-authenticated it). */
  recovery_code_used: 'Recovery code used',
  /** The account switched a standard module on or off (detail says which). */
  module_toggled: 'Module toggled',
  /** The owner granted a module to the account (npm run entitlements). */
  module_granted: 'Module granted',
  /** The owner revoked a module from the account. */
  module_revoked: 'Module revoked',
  /** A copy of the account's data was downloaded (detail names the part). */
  data_exported: 'Data exported',
} as const

export type AuditEventId = keyof typeof AUDIT_EVENTS

export function isAuditEventId(id: unknown): id is AuditEventId {
  return typeof id === 'string' && id in AUDIT_EVENTS
}
