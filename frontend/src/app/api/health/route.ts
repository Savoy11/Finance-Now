import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { checkHealth, healthStatusCode } from '@/lib/server/health'

export const dynamic = 'force-dynamic'

// For the host's checks and the outside uptime check (D74). Calls no data source; see
// lib/server/health.ts for what it reports and why. Never cached.

export async function GET() {
  const report = await checkHealth({
    databaseConfigured: isDbConfigured,
    probeDatabase: () => db.execute(sql`select 1`),
  })
  return NextResponse.json(report, { status: healthStatusCode(report), headers: { 'Cache-Control': 'no-store' } })
}
