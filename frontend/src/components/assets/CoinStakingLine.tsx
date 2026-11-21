'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Coins } from 'lucide-react'
import { STAKING_COIN_INFO } from '@/lib/data/stakingProviders'
import { stakingCoinForPage, stakingRowsFor } from '@/lib/data/coinPageLinks'
import { aprDisplay, resolveLiveAprKey } from '@/lib/utils/aprDisplay'
import { STALE_TIME_LONG } from '@/lib/constants'
import type { StakingRatesResponse } from '@/app/live-data/staking-rates/route'

// One line on a stakeable coin's page (T-463): how many of the staking catalog's providers stake
// this coin and how many of their rates are live now, linking to the Staking page showing only
// this coin. A count and a link only: no rates listed here, none in order of rate, no "best"
// (the ranking line, item 4). Same rows the Staking page shows for the coin by default.

export function CoinStakingLine({ assetId }: { assetId: string }) {
  const coin = stakingCoinForPage(assetId)
  const { data } = useQuery<StakingRatesResponse>({
    queryKey: ['staking-rates'],
    queryFn: () => fetch('/live-data/staking-rates').then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
    enabled: coin !== null,
  })
  if (!coin) return null
  const rows = stakingRowsFor(coin)
  if (rows.length === 0) return null
  const live = data
    ? rows.filter(({ provider, asset }) => aprDisplay(asset.staticApr, resolveLiveAprKey(provider, coin, asset), data.rates ?? {}, data.sources ?? {}, data.gaps).live).length
    : null
  const symbol = STAKING_COIN_INFO[coin].symbol
  const n = rows.length

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-bg-card px-3 py-2 text-xs text-text-secondary" data-testid="coin-staking-line">
      <Coins size={13} className="text-accent-blue shrink-0" aria-hidden />
      <span>
        Staking: {n} provider{n === 1 ? '' : 's'} in our catalog stake {symbol}
        {live !== null && <>; {live} of their rates {live === 1 ? 'is' : 'are'} live now</>}.
      </span>
      <Link href={`/staking?coin=${coin}`} className="font-medium text-accent-blue hover:underline">
        See them on the Staking page
      </Link>
    </div>
  )
}
