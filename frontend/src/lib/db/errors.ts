// ─── Database error helpers ──────────────────────────────────────────────────
// Pure (no client import), so they are tested on their own (__tests__/errors.test.ts).

/** Postgres SQLSTATE for "undefined_table": the relation does not exist. */
const UNDEFINED_TABLE = '42P01'

/**
 * True when a query failed because its table does not exist, which on this app
 * means a migration has not been applied yet (`npm run db:migrate`). Drizzle
 * wraps the driver's error in DrizzleQueryError and keeps the original as
 * `cause`, so both levels are checked.
 */
export function isMissingTableError(e: unknown): boolean {
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null | undefined
  return err?.code === UNDEFINED_TABLE || err?.cause?.code === UNDEFINED_TABLE
}
