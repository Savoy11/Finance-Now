import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId } from '@/lib/auth/session'
import { isUuid, parseCancelInput } from '@/lib/data/tradeLedger'
import { cancelTrade, dbUnavailable, notMigrated, ownedTrackedPortfolio } from '@/lib/server/trackedPortfolios'

// Cancel one trade (T-027 step 2, owner decision D65).
//   POST /api/user/tracked-portfolios/[id]/trades/[tradeId]/cancel  {reason?}
// This is how a mistake is corrected. Nothing is changed or removed: a row is
// added that names the trade, the lot engine leaves it out from then on, and
// the right trade is recorded as a new one. Under FIFO an offsetting sale
// would use up the oldest lot instead of the mistaken one, which is why a
// correction names what it cancels. A trade can be cancelled once.

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string; tradeId: string }> }) {
  const { id, tradeId } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 })
  if (!isUuid(tradeId)) return NextResponse.json({ ok: false, error: 'Invalid trade id' }, { status: 400 })

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
    const result = await cancelTrade(userId, id, tradeId, parsed.value.reason)
    if (result.status === 'not-found') return NextResponse.json({ ok: false, error: 'Trade not found' }, { status: 404 })
    if (result.status === 'already-cancelled') {
      return NextResponse.json({ ok: false, error: 'This trade is already cancelled.' }, { status: 409 })
    }
    const c = result.cancellation
    return NextResponse.json(
      { ok: true, cancelled: { tradeId: c.tradeId, at: c.createdAt.toISOString(), reason: c.reason } },
      { status: 201 },
    )
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigrated()
    throw e
  }
}
