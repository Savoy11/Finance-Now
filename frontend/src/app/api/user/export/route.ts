import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/session'
import { collectUserExport, type ExportQuery } from '@/lib/server/userExportCollect'
import { buildUserExport, exportFileName, holdingsCsv, tradesCsv, type Row } from '@/lib/data/userExport'

// "Download my data" (T-452, D199): a copy of everything the server keeps for the signed-in
// account. The Settings page's "Your data" section calls it; the owner's command
// (npm run user:export) answers the same request for someone else by email.
//
//   GET /api/user/export                    → one JSON file
//   GET /api/user/export?part=trades        → trades as a spreadsheet (CSV)
//   GET /api/user/export?part=holdings      → what-if portfolio holdings as a spreadsheet (CSV)
//
// The account is ALWAYS the session's own (getCurrentUserId). Nothing in the request can name
// another one, and userExport.test.ts fails if this file reads a user, email or id from it.
// It reads only, and deletes nothing.

export const dynamic = 'force-dynamic'

const query: ExportQuery = async (table, column, value) =>
  (await db.execute(sql`select * from ${sql.identifier(table)} where ${sql.identifier(column)} = ${value}`)) as unknown as Row[]

export async function GET(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { ok: false, error: 'There is no database set up, so there is no saved data to download.' },
      { status: 503 },
    )
  }
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })

  const part = new URL(request.url).searchParams.get('part') ?? 'json'
  if (part !== 'json' && part !== 'trades' && part !== 'holdings') {
    return NextResponse.json({ ok: false, error: 'part must be json, trades or holdings' }, { status: 400 })
  }

  const now = new Date()
  const collected = await collectUserExport(query, userId)
  const headers = {
    'Content-Disposition': `attachment; filename="${exportFileName(part, now)}"`,
    'Cache-Control': 'no-store',
  }
  if (part === 'trades') {
    return new NextResponse(tradesCsv(collected), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } })
  }
  if (part === 'holdings') {
    return new NextResponse(holdingsCsv(collected), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } })
  }
  return new NextResponse(JSON.stringify(buildUserExport(collected, now), null, 2), {
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
