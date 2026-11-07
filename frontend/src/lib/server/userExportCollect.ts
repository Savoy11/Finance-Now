// Reads everything stored for one account, for "Download my data" (T-452, D199).
//
// The tables are found, not listed: every table in the Drizzle schema with a user_id column is
// read, except the ones lib/data/userExport.ts names in EXCLUDED_TABLES with a reason. So a
// table added later is in the export without anyone remembering to add it, and
// userExport.test.ts fails if a table could hold an account's rows and is neither read nor named.
//
// It takes the query as a function, so the API route (Drizzle) and the owner's command (the
// postgres client) share it. It only reads. No 'server-only' import: the owner's command runs
// it under tsx, outside Next.

import { is } from 'drizzle-orm'
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import { EXCLUDED_TABLES, type CollectedExport, type Row } from '@/lib/data/userExport'

/** Reads `select * from <table> where <column> = <value>`. Table and column are trusted names from the schema. */
export type ExportQuery = (table: string, column: string, value: string) => Promise<Row[]>

/** Every table in the schema with a user_id column, by name, sorted. */
export function tablesWithUserId(): string[] {
  const names: string[] = []
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    if (config.columns.some((c) => c.name === 'user_id')) names.push(config.name)
  }
  return names.sort()
}

/** The tables the export reads for an account: every user_id table but the excluded ones. */
export function userExportTables(): string[] {
  return tablesWithUserId().filter((t) => !(t in EXCLUDED_TABLES))
}

export async function collectUserExport(query: ExportQuery, userId: string): Promise<CollectedExport> {
  const notSetUp: string[] = []
  const tables: Record<string, Row[]> = {}

  const read = async (table: string, column: string, value: string): Promise<Row[] | null> => {
    try {
      return await query(table, column, value)
    } catch (e) {
      // A table a migration has not created yet holds nothing for anyone: say so, carry on.
      if (isSchemaBehindError(e)) return null
      throw e
    }
  }

  const accountRows = await read('users', 'id', userId)
  const account = accountRows?.[0] ?? null

  for (const table of userExportTables()) {
    const rows = await read(table, 'user_id', userId)
    if (rows === null) notSetUp.push(table)
    else tables[table] = rows
  }

  // The instruments the rows point at (global catalog rows have no user_id), so each holding and
  // trade can be read as a ticker rather than an id. The account's own instruments are in tables.
  const ids = new Set<string>()
  for (const rows of Object.values(tables)) {
    for (const r of rows) if (typeof r.instrument_id === 'string') ids.add(r.instrument_id)
  }
  const instruments: Row[] = []
  for (const id of [...ids].sort()) {
    const rows = await read('instruments', 'id', id)
    if (rows?.[0]) instruments.push(rows[0])
  }

  return { account, tables, notSetUp, instruments }
}
