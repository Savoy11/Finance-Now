'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Newspaper } from 'lucide-react'
import { SourceLine } from '@/components/ui/SourceLine'
import { STALE_TIME_MEDIUM } from '@/lib/constants'
import { newsCanName } from '@/lib/data/macroNewsMatchers'
import { timeAgoCompact } from '@/lib/utils/format'
import type { MacroNewsResponse } from '@/app/live-data/macro-news/route'

// The macro stories that name this instrument (T-456 b, D211), from the same feed and the same
// matching rules as Macro News. One request serves every instrument page: React Query shares it.

const SHOWN = 6

export function InstrumentNewsCard({ href, name }: { href: string; name: string }) {
  const recognisable = newsCanName(href)
  const { data, isLoading, isError } = useQuery<MacroNewsResponse>({
    queryKey: ['macro-news', 'all'],
    queryFn: () => fetch('/live-data/macro-news?limit=80').then((r) => r.json()),
    enabled: recognisable,
    staleTime: STALE_TIME_MEDIUM,
  })
  const stories = useMemo(
    () => (data?.articles ?? []).filter((a) => a.related.some((r) => r.href === href)).slice(0, SHOWN),
    [data, href],
  )

  return (
    <section aria-labelledby="instrument-news-heading" className="rounded-card border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-accent-blue" aria-hidden />
          <h2 id="instrument-news-heading" className="text-sm font-semibold text-text-primary">News that names {name}</h2>
        </div>
        <Link href="/macro/news" className="text-[11px] text-text-muted hover:text-accent-blue">All macro news →</Link>
      </div>

      {!recognisable ? (
        <p className="text-xs text-text-muted leading-relaxed">
          Stories are linked to an instrument when they name it, and the feed has no way to recognise {name} by name yet,
          so none are linked here. Macro News has every story.
        </p>
      ) : isLoading ? (
        <p className="text-xs text-text-muted">Loading stories…</p>
      ) : isError || data?.ok === false ? (
        <p className="text-xs text-amber-400">The macro news feeds could not be reached right now.</p>
      ) : stories.length === 0 ? (
        <p className="text-xs text-text-muted">No recent story names {name}.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {stories.map((a) => (
            <li key={a.id} className="py-2 space-y-0.5">
              <a href={a.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 text-sm text-text-primary hover:text-accent-blue">
                <span>{a.title}</span>
                <ExternalLink size={11} className="mt-1 shrink-0 text-text-muted group-hover:text-accent-blue" aria-hidden />
              </a>
              <p className="text-[11px] text-text-muted">{a.source} · {timeAgoCompact(a.publishedAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {recognisable && <SourceLine id="macro-news" />}
    </section>
  )
}
