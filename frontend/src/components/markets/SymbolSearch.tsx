'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import { EQUITY_CATALOG } from '@/lib/data/equityCatalog'
import { FUND_CATALOG } from '@/lib/data/fundCatalog'
import type { StockUniverseResponse } from '@/app/live-data/stock-universe/route'

// Moved here from the equity TA page on 2026-10-26 so the (hidden) equity backtests can take
// any ticker too (T-020, D172). One copy, so the two cannot drift apart.
//
// Combobox over the Stock Registry universe (all active common stocks when an
// FMP key is configured, curated catalog otherwise) plus the ETF catalog —
// with free-text passthrough, because the OHLCV chain (Tiingo → FMP) charts
// far more than the suggestion list: any US-listed stock, ETF, ADR, mutual
// fund (daily NAV), or international listing with an exchange suffix
// (7203.T, BMW.DE). An unknown ticker simply tries; no data shows the
// honest "no OHLCV source" notice rather than being blocked up front.

interface SymbolOption {
  symbol: string
  name: string
  kind: 'stock' | 'etf' | 'mutual'
}

export function SymbolSearch({ symbol, onSelect, directVerb = 'Chart' }: {
  symbol: string
  onSelect: (s: string) => void
  /** The verb on the free-text row: "Chart AAPL directly" on the TA page, "Backtest …" on the backtests. */
  directVerb?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const { data: universe } = useQuery<StockUniverseResponse>({
    queryKey: ['stock-universe'],
    queryFn: () => fetch('/live-data/stock-universe').then((r) => r.json()),
    staleTime: 1000 * 60 * 60, // server caches daily; don't refetch while typing
    enabled: open,
  })

  const options = useMemo<SymbolOption[]>(() => {
    const stocks: SymbolOption[] = (universe?.entries ?? EQUITY_CATALOG.map((e) => ({ symbol: e.symbol, name: e.name })))
      .map((e) => ({ symbol: e.symbol, name: e.name, kind: 'stock' as const }))
    const funds: SymbolOption[] = FUND_CATALOG.map((f) => ({
      symbol: f.symbol, name: f.name, kind: f.type === 'etf' ? 'etf' as const : 'mutual' as const,
    }))
    return [...stocks, ...funds]
  }, [universe])

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return []
    // Symbol prefix matches first (what traders type), then name substring.
    const bySymbol = options.filter((o) => o.symbol.toUpperCase().startsWith(q))
    const byName = options.filter((o) =>
      !o.symbol.toUpperCase().startsWith(q) && o.name.toUpperCase().includes(q))
    return [...bySymbol, ...byName].slice(0, 12)
  }, [options, query])

  const pick = (s: string) => {
    onSelect(s.toUpperCase())
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-bg-secondary border border-border rounded-sm px-2 py-1.5 focus-within:border-accent-blue/60">
        <Search size={13} className="text-text-muted shrink-0" aria-hidden />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter' && query.trim()) {
              e.preventDefault()
              pick(matches[highlight]?.symbol ?? query.trim())
            } else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={symbol}
          aria-label="Search any ticker"
          className="w-40 bg-transparent text-sm text-text-primary font-mono placeholder:text-text-primary focus:outline-hidden"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-80 bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {matches.map((m, i) => (
            <button
              key={`${m.kind}:${m.symbol}`}
              onMouseDown={(e) => { e.preventDefault(); pick(m.symbol) }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                i === highlight ? 'bg-accent-blue/10' : 'hover:bg-bg-elevated')}
            >
              <span className="font-mono font-semibold text-text-primary w-16 shrink-0">{m.symbol}</span>
              <span className="text-xs text-text-muted flex-1 truncate">{m.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">{m.kind}</span>
            </button>
          ))}
          <button
            onMouseDown={(e) => { e.preventDefault(); pick(query.trim()) }}
            className={clsx('w-full px-3 py-2 text-left text-xs border-t border-border/60 transition-colors',
              matches.length === 0 || highlight >= matches.length ? 'bg-accent-blue/10' : 'hover:bg-bg-elevated')}
          >
            <span className="text-text-secondary">{directVerb} </span>
            <span className="font-mono font-semibold text-text-primary">{query.trim().toUpperCase()}</span>
            <span className="text-text-muted"> directly — anything the configured provider covers works (ADRs, international suffixes like 7203.T)</span>
          </button>
        </div>
      )}
    </div>
  )
}
