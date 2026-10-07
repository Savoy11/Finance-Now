import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId } from '@/lib/auth/session'
import { isUuid, parsePortfolioInput } from '@/lib/data/tradeLedger'
import {
  dbUnavailable, deleteTrackedPortfolio, notMigrated, renameTrackedPortfolio,
} from '@/lib/server/trackedPortfolios'

// One tracked portfolio (T-027 step 2, D65).
//   PATCH  /api/user/tracked-portfolios/[id]  → change {name?, description?}
//   DELETE /api/user/tracked-portfolios/[id]  → remove it at the user's request,
//          with its trades and their cancellations (the foreign keys cascade)
// Neither touches a what-if portfolio: an id without the tracked marker is a
// 404 here, the same as another user's id or a missing one.

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
  }
  const parsed = parsePortfolioInput(body, { partial: true })
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  if (parsed.value.id !== undefined && parsed.value.id !== id) {
    return NextResponse.json({ ok: false, error: 'A portfolio id cannot be changed.' }, { status: 400 })
  }

  try {
    const portfolio = await renameTrackedPortfolio(userId, id, parsed.value)
    if (!portfolio) return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    return NextResponse.json({ ok: true, portfolio })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigrated()
    throw e
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 })

  try {
    if (!(await deleteTrackedPortfolio(userId, id))) {
      return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigrated()
    throw e
  }
}
