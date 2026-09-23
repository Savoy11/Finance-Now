import { NextResponse } from 'next/server'
import { CORS, options } from '../../_cors'
import { computeNetworkFees } from '@/lib/data/networkFees'

export const dynamic = 'force-dynamic'
export { options as OPTIONS }

// Gas fees for every supported network. Computed from the shared single source
// of truth (lib/data/networkFees), so this public API and the internal
// /live-data/network-fees route always agree.
//
// FIVE of the eighteen are live: BTC via mempool.space, plus ETH/BNB/Polygon/AVAX
// via keyless publicnode `eth_gasPrice` (FEE_PROVIDERS, :284-290). The other 13
// are static gas amounts priced at the live token price (source: 'estimate').
// This said "BTC is live; other networks are static" until 2026-09-22 — the live
// EVM gas landed on 2026-08-21 and three separate summaries went on describing
// the state before it. See DATA-AVAILABILITY.md.
export async function GET() {
  const { fees, priceSource, btcSatPerVbyte, updatedAt } = await computeNetworkFees()

  return NextResponse.json(
    {
      fees,
      btcSatPerVbyte,
      priceSource,
      updatedAt,
      note:
        "feeNative = typical token transfer cost in the network's gas token. " +
        'feeUsd = USD equivalent at the current live price. source=\'live\' means the ' +
        "fee amount itself is real-time; source='estimate' means a static gas amount priced live.",
    },
    { headers: CORS }
  )
}
