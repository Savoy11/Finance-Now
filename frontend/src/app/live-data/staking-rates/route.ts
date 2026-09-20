import { NextResponse } from 'next/server'
import { collectStakingRates } from '@/lib/server/stakingRates'

// The collector moved to lib/server/stakingRates.ts on 2026-09-18 so that
// /api/v1/staking/opportunities could read the SAME rates, sources and gaps
// instead of maintaining its own broken copy — the reasoning is on the module.
// This route is now the HTTP face of it and nothing else.
export type { StakingRatesResponse } from '@/lib/server/stakingRates'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await collectStakingRates())
}
