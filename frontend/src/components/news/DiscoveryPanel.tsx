'use client'

import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { Search, ExternalLink, Loader2, Copy, Check, Info } from 'lucide-react'
import type { DiscoveredArticle, DiscoveryResult } from '@/lib/server/newsDiscovery'

// ─── Source Discovery panel ──────────────────────────────────────────────────
//
// Coverage from outlets the app does NOT carry. Shared by the crypto, equities and
// macro news pages — the only difference is `module`, which decides both the search
// focus and which outlets are excluded.
//
// ⚠ EVERY RESULT HERE IS AN UNVETTED SOURCE, and the UI says so rather than leaving
// it implied. The app has no terms verdict for these outlets, has not read their
// terms, and does not fetch them — Anthropic's server-side web_search performs the
// retrieval and returns titles, URLs and snippets. That is a different posture from
// the feed in the tab next door, and styling the two identically would quietly erase
// the difference. Hence the standing notice, the link-out-only treatment, and no
// sentiment or category badges: those belong to articles the app actually ingested.
//
// ⚠ SEARCHING COSTS MONEY. It runs on submit only — never on mount, never on an
// interval, never on a filter change. If you are tempted to add a useEffect that
// searches when `module` changes, that is the bill nobody decided to spend.

interface Props {
  module: 'crypto' | 'equities' | 'macro'
  /** Placeholder shown in the search box — module-specific phrasing reads better. */
  placeholder?: string
}

export function DiscoveryPanel({ module, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ module })
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`/live-data/news-discovery?${params}`)
      setResult((await res.json()) as DiscoveryResult)
    } catch (e) {
      // A transport failure is reported as such. It is NOT an empty result — "found
      // nothing" and "could not look" need different answers, and conflating them is
      // how a broken feature looks like a quiet one.
      setResult({
        ok: false,
        module,
        query,
        articles: [],
        excluded: [],
        searchesUsed: 0,
        error: e instanceof Error ? e.message : 'request failed',
      })
    } finally {
      setLoading(false)
    }
  }, [module, query])

  const copyDomain = useCallback(async (host: string) => {
    try {
      await navigator.clipboard.writeText(`https://${host}`)
      setCopied(host)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard blocked — the domain is on screen to copy by hand */
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* What this tab is, and what it is not. */}
      <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-medium">These are unvetted sources.</span> Results come from a
          web search run outside this app, from outlets it does not carry and whose terms it has
          not reviewed. Headlines link out — nothing is fetched or republished here. To read an
          outlet regularly, add its feed on the Integrations page, which checks its terms first.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            id={`discovery-query-${module}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) search()
            }}
            placeholder={placeholder ?? 'A topic, ticker or theme — or leave blank for what is notable now'}
            className="w-full rounded-lg border border-border bg-bg-elevated pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <button
          onClick={search}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {!result && !loading && (
        <p className="py-8 text-center text-sm text-text-muted">
          Search to find coverage from smaller outlets. Each search reaches the web, so it runs
          only when you ask.
        </p>
      )}

      {/* ok:false is a broken search; ok:true with nothing is a real answer. */}
      {result && !result.ok && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm text-red-300">
          <span className="font-medium">Search failed.</span> {result.error ?? 'Unknown error.'}
        </div>
      )}

      {result?.ok && result.articles.length === 0 && (
        <p className="py-8 text-center text-sm text-text-muted">
          Nothing found from outlets outside the ones already in the feed. That is a real
          answer, not an error — an empty result beats padding it with coverage you already have.
        </p>
      )}

      {result?.ok && result.articles.length > 0 && (
        <>
          <p className="text-xs text-text-muted">
            {result.articles.length} article{result.articles.length === 1 ? '' : 's'} from{' '}
            {new Set(result.articles.map((a) => a.sourceHost)).size} outlet
            {new Set(result.articles.map((a) => a.sourceHost)).size === 1 ? '' : 's'} · {result.searchesUsed}{' '}
            search{result.searchesUsed === 1 ? '' : 'es'} used · {result.excluded.length} domains excluded
          </p>
          <ul className="flex flex-col gap-3">
            {result.articles.map((a) => (
              <DiscoveredRow
                key={a.url}
                article={a}
                copied={copied === a.sourceHost}
                onCopy={() => copyDomain(a.sourceHost)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function DiscoveredRow({
  article,
  copied,
  onCopy,
}: {
  article: DiscoveredArticle
  copied: boolean
  onCopy: () => void
}) {
  return (
    <li className="rounded-xl border border-border bg-bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex-1 text-sm font-medium text-text-primary hover:text-accent-blue"
        >
          {article.title}
          <ExternalLink className="ml-1.5 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      </div>

      {article.snippet && (
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{article.snippet}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="font-medium text-text-secondary">{article.sourceName}</span>
        <span className="font-mono text-text-muted">{article.sourceHost}</span>
        {/* A missing date is shown as missing. The parser never invents one, and the
            UI must not imply it knows. */}
        <span className="text-text-muted">
          {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'date not reported'}
        </span>
        <button
          onClick={onCopy}
          title="Copy this outlet's address, to add its feed on the Integrations page"
          className={clsx(
            'ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
            copied ? 'text-emerald-400' : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Add as source'}
        </button>
      </div>
    </li>
  )
}
