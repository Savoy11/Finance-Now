import { NextRequest, NextResponse } from 'next/server'
import { readAffiliateClicks, recordAffiliateClick } from '@/lib/server/affiliateClicks'
import { STAKING_PROVIDERS } from '@/lib/data/stakingProviders'

export const dynamic = 'force-dynamic'

/**
 * Aggregate affiliate click counting.
 *
 * `POST { providerId }` increments one counter. `GET` returns the totals.
 *
 * ⚠ This route lives OUTSIDE `/api/user/` on purpose, and needed a matching
 * exclusion in next.config.mjs's rewrite: the data is not user-scoped. There is
 * no user attached to a count, which is the entire design — see
 * `lib/server/affiliateClicks.ts`.
 */

/** Only ids that exist in the catalog are counted, so the file cannot be filled with junk. */
function isKnownProvider(id: unknown): id is string {
  return typeof id === 'string' && STAKING_PROVIDERS.some((p) => p.id === id)
}

export async function POST(req: NextRequest) {
  let providerId: unknown
  try {
    providerId = (await req.json())?.providerId
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 })
  }

  if (!isKnownProvider(providerId)) {
    return NextResponse.json({ ok: false, error: 'Unknown provider' }, { status: 400 })
  }

  // The response is 200 whether or not the write succeeded. This endpoint is
  // fired alongside a navigation the reader has already started; failing it
  // would surface an error for something they did not ask for and cannot act
  // on. `recorded` reports the truth without making it their problem.
  const recorded = recordAffiliateClick(providerId)
  return NextResponse.json({ ok: true, recorded })
}

export async function GET() {
  const file = readAffiliateClicks()
  const total = Object.values(file.counts).reduce((a, b) => a + b, 0)
  return NextResponse.json({
    ok: true,
    counts: file.counts,
    total,
    since: file.since || null,
    updatedAt: file.updatedAt || null,
    note: 'Aggregate counts only. No user, session, IP, cookie or per-click timestamp is recorded.',
  })
}
