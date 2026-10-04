// ─── Database error helpers ──────────────────────────────────────────────────
// Pure (no client import), so they are tested on their own (__tests__/errors.test.ts).

/** Postgres SQLSTATE for "undefined_table": the relation does not exist. */
const UNDEFINED_TABLE = '42P01'
/** Postgres SQLSTATE for "undefined_column": the table is there, the column is not. */
const UNDEFINED_COLUMN = '42703'

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

/**
 * True when a query failed because a table or a column it names does not exist
 * yet: the database is behind the schema, and `npm run db:migrate` is the cure.
 * Migration 0005 (trade history) both adds tables and adds a column to an
 * existing one, so its routes need the column case as well.
 */
export function isSchemaBehindError(e: unknown): boolean {
  if (isMissingTableError(e)) return true
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null | undefined
  return err?.code === UNDEFINED_COLUMN || err?.cause?.code === UNDEFINED_COLUMN
}
