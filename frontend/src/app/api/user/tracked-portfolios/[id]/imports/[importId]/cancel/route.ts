import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId } from '@/lib/auth/session'
import { isUuid, parseCancelInput } from '@/lib/data/tradeLedger'
import { dbUnavailable, ownedTrackedPortfolio } from '@/lib/server/trackedPortfolios'
import { cancelImport, notMigratedForImports } from '@/lib/server/tradeImports'

// Cancel a whole import (T-447, owner decision D200: one step may cancel a whole import).
//   POST /api/user/tracked-portfolios/[id]/imports/[importId]/cancel  {reason?}
// Nothing is changed or removed: each of the import's trades that is not
// cancelled already gets a cancellation row, exactly as cancelling one trade
// does, with a reason naming the file. The trades stay listed, marked
// cancelled, and the lot engine leaves them out. The file can then be imported
// again, since a cancelled trade's row no longer counts as already imported.

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string; importId: string }> }) {
  const { id, importId } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 })
  if (!isUuid(importId)) return NextResponse.json({ ok: false, error: 'Invalid import id' }, { status: 400 })

  let body: unknown = undefined
  const text = await request.text()
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
    }
  }
  const parsed = parseCancelInput(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })

  try {
    if (!(await ownedTrackedPortfolio(userId, id))) {
      return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    }
    const result = await cancelImport(userId, id, importId, parsed.value.reason)
    if (result.status === 'not-found') return NextResponse.json({ ok: false, error: 'Import not found' }, { status: 404 })
    return NextResponse.json({ ok: true, cancelled: result.cancelled, alreadyCancelled: result.alreadyCancelled }, { status: 201 })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigratedForImports()
    throw e
  }
}
