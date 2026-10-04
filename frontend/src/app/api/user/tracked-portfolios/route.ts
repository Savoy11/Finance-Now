import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId } from '@/lib/auth/session'
import { parsePortfolioInput } from '@/lib/data/tradeLedger'
import {
  createTrackedPortfolio, dbUnavailable, listTrackedPortfolios, notMigrated,
  type TrackedPortfolioSummary,
} from '@/lib/server/trackedPortfolios'

// Tracked portfolios (T-027 step 2, owner decision D65): portfolios that are a
// real record of trades, kept apart from the what-if portfolios on /portfolios.
//   GET  /api/user/tracked-portfolios  → this user's tracked portfolios
//   POST /api/user/tracked-portfolios  → create {id?, name, description?}
// A client-supplied UUID is accepted so a store can be optimistic, as on
// /api/user/portfolios. The trades live under [id]/trades.

export const dynamic = 'force-dynamic'

export interface TrackedPortfoliosResponse {
  ok: boolean
  portfolios?: TrackedPortfolioSummary[]
  portfolio?: TrackedPortfolioSummary
  error?: string
}

/** Postgres SQLSTATE for a unique violation: here, a client id that is already taken. */
const UNIQUE_VIOLATION = '23505'
const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null
  return err?.code === UNIQUE_VIOLATION || err?.cause?.code === UNIQUE_VIOLATION
}

export async function GET() {
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    return NextResponse.json<TrackedPortfoliosResponse>({ ok: true, portfolios: await listTrackedPortfolios(userId) })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigrated()
    throw e
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
  }
  const parsed = parsePortfolioInput(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })

  try {
    const portfolio = await createTrackedPortfolio(userId, parsed.value)
    return NextResponse.json<TrackedPortfoliosResponse>({ ok: true, portfolio }, { status: 201 })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigrated()
    if (isUniqueViolation(e)) return NextResponse.json({ ok: false, error: 'A portfolio with that id already exists.' }, { status: 409 })
    throw e
  }
}
