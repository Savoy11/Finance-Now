import { NextResponse } from 'next/server'
import type { LatestPairRate } from '@/lib/data/fxReference'
import { fetchLatestPairRates } from '@/lib/server/ecbReference'

// Every currency pair in the catalog at the European Central Bank's newest daily
// reference rate (T-445, D203):
//   GET /live-data/fx-reference-pairs
// Keyed by the pair's slug (eur-usd, usd-jpy …), each with its date, and the
// change since the ECB's previous working day. A pair without the euro is worked
// out from the two euro rates of the same day (lib/data/fxReference.ts). The
// Dollar Index is not here: it is ICE's, and the ECB does not publish it.
//
// The pages show a pair's live quote where the keyed ladder has one, and this
// otherwise, labelled as the daily ECB rate it is.

export const dynamic = 'force-dynamic'

export interface FxReferencePairsResponse {
  ok: boolean
  /** The newest publication date among the pairs (YYYY-MM-DD). */
  date?: string
  pairs?: Record<string, LatestPairRate>
  /** Slugs the newest days could not price. */
  missing?: string[]
  source?: 'ecb-frankfurter'
  error?: string
}

export async function GET(): Promise<NextResponse<FxReferencePairsResponse>> {
  try {
    const { date, pairs, missing } = await fetchLatestPairRates()
    return NextResponse.json({ ok: true, date, pairs, missing, source: 'ecb-frankfurter' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'ECB reference rates unavailable' })
  }
}
