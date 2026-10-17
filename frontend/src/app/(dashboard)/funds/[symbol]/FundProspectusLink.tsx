'use client'

import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import type { FundProspectusResponse } from '@/app/live-data/fund-prospectus/route'
import type { FundProspectus } from '@/lib/server/fundProspectus'

/** The fund's prospectus on EDGAR, or null while loading, on failure, or when it
 *  files none. One query shared by every surface on the page that links it. */
export function useFundProspectus(symbol: string): FundProspectus | null {
  const { data } = useQuery<FundProspectusResponse>({
    queryKey: ['fund-prospectus', symbol],
    queryFn: () => fetch(`/live-data/fund-prospectus?${new URLSearchParams({ symbol })}`).then((r) => r.json()),
    staleTime: 1000 * 60 * 60 * 12,
  })
  return data?.prospectus ?? null
}

// "A link to the prospectus" (D92, T-420 item 2): the fund's own filing on SEC
// EDGAR, chosen in lib/server/fundProspectus.ts. Renders nothing while loading,
// on failure, or for a fund that files no prospectus there (SPY, GLD): a link
// is shown only when it is this fund's document.
export function FundProspectusLink({ symbol }: { symbol: string }) {
  const p = useFundProspectus(symbol)
  if (!p) return null
  const label = p.kind === 'summary' ? 'Summary prospectus' : 'Prospectus (registration statement)'
  return (
    <>
      {' · '}
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Filed with the SEC on ${p.filedAt}`}
        className="text-accent-blue/80 hover:text-accent-blue inline-flex items-center gap-0.5"
      >
        {label}, SEC {p.filedAt} <ExternalLink size={10} aria-hidden />
      </a>
    </>
  )
}
