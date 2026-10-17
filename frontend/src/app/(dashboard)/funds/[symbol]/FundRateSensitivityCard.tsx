'use client'

import { useQuery } from '@tanstack/react-query'
import { STALE_TIME_LONG } from '@/lib/constants'
import { describeRateSensitivity } from '@/lib/utils/fundRateSensitivity'
import type { FundHoldingsResponse } from '@/app/live-data/fund-holdings/route'

// Duration for bond funds (D92, T-420 item 2), from the fund's own N-PORT
// filing, which /live-data/fund-holdings already fetches for the holdings. The
// query key and URL match FundHoldingsSection's default ("auto") request, so the
// two share one fetch. Renders nothing for a fund whose filing carries no
// interest-rate section (under 25% in debt) or whose exposure is negligible:
// a missing line, never a guessed one (the catalog has no duration field).
export function FundRateSensitivityCard({ symbol }: { symbol: string }) {
  const { data } = useQuery<FundHoldingsResponse>({
    queryKey: ['fund-holdings', symbol, 'auto'],
    queryFn: () => fetch(`/live-data/fund-holdings?${new URLSearchParams({ symbol })}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
  })
  const s = data?.rateSensitivity
  if (!s) return null
  const { headline, method } = describeRateSensitivity(s)
  return (
    <div className="rounded-card border border-border bg-bg-card p-4">
      <h2 className="text-sm font-medium text-text-secondary mb-3">If Rates Move</h2>
      <p className="text-xs text-text-primary leading-relaxed">{headline}</p>
      <p className="mt-3 pt-3 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">{method}</p>
    </div>
  )
}
