'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { INSTRUMENTS, type InstrumentClass } from '@/lib/data/instruments'

// ─── Instrument search for the portfolio pickers ─────────────────────────────
//
// One search, shared by the what-if editor on /portfolios and the trade form
// on /portfolios/tracked, so the two cannot drift: a fix to one picker is a fix
// to both. Moved here from the Portfolios page on 2026-10-04 (T-027 step 3).

/** One row in a picker, whichever universe it came from. */
export interface InstrumentCandidate {
  key: string          // storage key: CoinGecko id, or 'sec:' + symbol
  symbol: string
  name: string
  class: InstrumentClass
  color?: string
  /** True when this came from a network lookup rather than the local catalogs. */
  remote: boolean
}

async function searchRemoteCandidates(q: string): Promise<InstrumentCandidate[]> {
  const [coins, stocks, funds] = await Promise.allSettled([
    fetch(`/live-data/coin-search?q=${encodeURIComponent(q)}`).then(r => r.json()) as Promise<{
      coins?: { cgId: string; symbol: string; name: string }[]
    }>,
    // ?q= searches the whole universe by name OR ticker (added for the Market
    // News search, #115) — this replaced an exact-symbol lookup here, which
    // could only find a stock you already knew the ticker of. Keyless it
    // answers from the curated catalog; the local matches already cover that,
    // so the dedupe below simply drops the echoes.
    fetch(`/live-data/stock-universe?q=${encodeURIComponent(q)}`).then(r => r.json()) as Promise<{
      ok?: boolean; entries?: { symbol: string; name: string }[]
    }>,
    // Every US-listed ETF + registered mutual fund share class (NASDAQ Trader
    // + SEC directories, keyless). The type comes from the directory, so an
    // added fund is labeled ETF / Mutual fund, not lumped in as a stock.
    fetch(`/live-data/fund-universe?q=${encodeURIComponent(q)}`).then(r => r.json()) as Promise<{
      ok?: boolean; entries?: { symbol: string; name: string; type: 'etf' | 'mutual' }[]
    }>,
  ])

  const out: InstrumentCandidate[] = []
  const seen = new Set<string>()
  const push = (c: InstrumentCandidate) => {
    if (!seen.has(c.key)) { seen.add(c.key); out.push(c) }
  }
  if (coins.status === 'fulfilled') {
    for (const c of (coins.value.coins ?? []).slice(0, 8)) {
      push({ key: c.cgId, symbol: c.symbol, name: c.name, class: 'crypto', remote: true })
    }
  }
  // Funds before stocks: an ETF can appear in BOTH directories under the same
  // 'sec:' key (FMP's screener carries ETF rows too), and first-in wins the
  // dedupe — it should be labeled ETF, not Stock.
  if (funds.status === 'fulfilled' && funds.value.ok) {
    for (const e of funds.value.entries ?? []) {
      push({ key: `sec:${e.symbol}`, symbol: e.symbol, name: e.name, class: e.type === 'etf' ? 'etf' : 'mutual', remote: true })
    }
  }
  if (stocks.status === 'fulfilled' && stocks.value.ok) {
    for (const e of stocks.value.entries ?? []) {
      push({ key: `sec:${e.symbol}`, symbol: e.symbol, name: e.name, class: 'equity', remote: true })
    }
  }
  return out
}

export function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Search the suite's whole universe, not just the curated catalogs.
 *
 * Local instruments answer instantly — all seven classes (coins, stocks,
 * ETFs, mutual funds, commodities, currencies, rates), or only the `classes`
 * given. On top of that, remote lookups widen the universe to what the app
 * actually tracks:
 *   · /live-data/coin-search — any coin CoinGecko carries (the Coin
 *     Discovery universe), priced by the same portfolio-prices route.
 *   · /live-data/stock-universe?q= — any quotable ticker (the Stock
 *     Registry universe). Keyless it answers only the curated catalog, so
 *     the remote rung simply adds nothing without an FMP key — the same
 *     asset that couldn't be found couldn't have been priced either.
 *   · /live-data/fund-universe?q= — every listed ETF and mutual fund class.
 * All are additive and deduplicated against local results; a remote failure
 * degrades to local-only rather than erroring the picker. `exclude` keeps out
 * instruments the caller already holds.
 */
const allows = (classes: ReadonlySet<InstrumentClass> | undefined, cls: InstrumentClass) => !classes || classes.has(cls)

export function useInstrumentSearch(
  query: string,
  { exclude = [], classes }: { exclude?: readonly string[]; classes?: ReadonlySet<InstrumentClass> } = {},
): InstrumentCandidate[] {
  // A joined key rather than the array, so a caller passing a fresh array each
  // render does not recompute the matches each render.
  const excludeKey = exclude.join('|')

  const localMatches: InstrumentCandidate[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const excluded = new Set(excludeKey ? excludeKey.split('|') : [])
    return INSTRUMENTS.filter(c =>
      !excluded.has(c.cgId) && allows(classes, c.class) &&
      (c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    ).slice(0, 20).map(c => ({
      key: c.cgId, symbol: c.symbol, name: c.name, class: c.class, color: c.color, remote: false,
    }))
  }, [query, excludeKey, classes])

  const debouncedSearch = useDebounced(query.trim(), 350)
  const { data: remoteData } = useQuery<InstrumentCandidate[]>({
    queryKey: ['portfolio-add-search', debouncedSearch],
    queryFn: () => searchRemoteCandidates(debouncedSearch),
    // Only reach out when the query is real and local coverage is thin —
    // 2 chars of "bt" already shows BTC locally; no need to hit the network.
    enabled: debouncedSearch.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return useMemo(() => {
    const seen = new Set(localMatches.map(c => c.key))
    for (const k of excludeKey ? excludeKey.split('|') : []) seen.add(k)
    // Local symbols too: CoinGecko search returns bitcoin even though the
    // catalog carries it — the catalog row (with its vetted metadata) wins.
    for (const c of localMatches) seen.add(c.symbol.toUpperCase())
    const remote = (remoteData ?? []).filter(c => {
      if (!allows(classes, c.class)) return false
      if (seen.has(c.key) || seen.has(c.symbol.toUpperCase())) return false
      seen.add(c.key)
      return true
    })
    return [...localMatches, ...remote].slice(0, 24)
  }, [localMatches, remoteData, excludeKey, classes])
}
