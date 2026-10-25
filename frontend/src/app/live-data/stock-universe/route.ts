import { NextRequest, NextResponse } from 'next/server'
import { getProviderKey } from '@/lib/api/live/providers'
import { EQUITY_CATALOG, EQUITY_BY_SYMBOL, mapSectorName, type SectorId } from '@/lib/data/equityCatalog'
import { fetchStockPerShare } from '@/lib/server/stockPerShare'
import { stockFigures, type DividendState } from '@/lib/data/stockPerShare'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'

// The equities universe for the Stock Registry.
//   GET /live-data/stock-universe            → full universe (daily-refreshed)
//   GET /live-data/stock-universe?symbol=IBM → single entry (detail-page lookup)
//
// With an FMP key it pulls the whole active common-stock universe from FMP's
// stock-screener (sector-tagged, sorted by market cap) and caches it for a day
// — so index changes and new listings appear automatically. Curated catalog
// entries overlay their hand-written descriptions/betas as enrichment. Without
// a key (or on failure) it falls back to the curated catalog so the page always
// renders. `configured` tells the client whether the live universe is active.
//
// P/E and dividend yield come from each company's SEC annual report on every path
// (D167, lib/data/stockPerShare.ts): never the catalog's hand-typed figures, and
// never FMP's dividend. `?symbols=A,B` returns those catalog stocks only, for
// pages that need a few (portfolio income, Compare).

export const dynamic = 'force-dynamic'

export interface UniverseEntry {
  symbol: string
  name: string
  sector: SectorId
  industry: string
  /** Reference market cap in billions USD (daily from FMP, or curated). */
  marketCapB: number
  /** Reference price USD — live quotes override on the visible page. */
  referencePrice: number
  /**
   * P/E and dividend yield against `referencePrice`, worked out from the company's SEC
   * annual report (D167). A page with a live price works them out again from `eps` and
   * `dividendsPerShare` through stockFigures(); filters and sorts use these.
   */
  peRatio: number | null
  dividendYieldPct: number | null
  /** Earnings per share for the fiscal year ending `perShareAsOf` (diluted, else basic). */
  eps: number | null
  epsBasis: 'diluted' | 'basic' | null
  /** Dividends per share for that same fiscal year, when `dividendState` is 'paid'. */
  dividendsPerShare: number | null
  dividendState: DividendState
  perShareAsOf: string | null
  beta: number
  exchange: string | null
  /** Present only for curated names. */
  description?: string
  website?: string
}

export interface StockUniverseResponse {
  ok: boolean
  configured: boolean          // true when the live FMP universe is active
  source: 'fmp' | 'catalog'
  count: number
  entries: UniverseEntry[]
  /** How many entries carry an SEC earnings figure (D167). */
  peEnriched?: number
  /** False when the SEC could not be reached, so every P/E and yield is unknown. */
  secReached?: boolean
  updatedAt: string
  error?: string
}

const MAX_UNIVERSE = 4000

interface FmpScreenerRow {
  symbol: string
  companyName: string | null
  marketCap: number | null
  sector: string | null
  industry: string | null
  beta: number | null
  price: number | null
  lastAnnualDividend: number | null
  exchangeShortName: string | null
  isEtf?: boolean
  isFund?: boolean
  isActivelyTrading?: boolean
}

const NO_PER_SHARE = {
  peRatio: null, dividendYieldPct: null, eps: null, epsBasis: null,
  dividendsPerShare: null, dividendState: 'unknown' as DividendState, perShareAsOf: null,
}

/**
 * P/E and dividend yield for every entry from its SEC annual report (D167), against the
 * entry's reference price. Mutates in place and never throws: an unreachable SEC leaves the
 * figures unknown and the universe intact. Returns how many carry an earnings figure.
 */
async function applyPerShare(entries: UniverseEntry[]): Promise<{ withEps: number; reached: boolean }> {
  const nonPayers = new Set(EQUITY_CATALOG.filter((e) => e.dividendYieldPct === null).map((e) => e.symbol))
  const { bySymbol, reached } = await fetchStockPerShare(entries.map((e) => e.symbol), nonPayers)
  let withEps = 0
  for (const entry of entries) {
    const ps = bySymbol.get(entry.symbol)
    if (!ps) continue
    const f = stockFigures(ps, entry.referencePrice)
    entry.peRatio = f.pe
    entry.dividendYieldPct = f.dividendYieldPct
    entry.eps = ps.eps?.val ?? null
    entry.epsBasis = ps.eps?.basis ?? null
    entry.dividendsPerShare = ps.dps?.val ?? null
    entry.dividendState = ps.dividend
    entry.perShareAsOf = ps.asOf
    if (ps.eps) withEps++
  }
  return { withEps, reached }
}

function curatedEntry(symbol: string): UniverseEntry | undefined {
  const e = EQUITY_BY_SYMBOL[symbol.toUpperCase()]
  if (!e) return undefined
  return {
    symbol: e.symbol, name: e.name, sector: e.sector, industry: e.industry,
    marketCapB: e.marketCapB, referencePrice: e.referencePrice,
    // Filled from SEC filings by applyPerShare; the catalog's typed figures are never served.
    ...NO_PER_SHARE, beta: e.beta, exchange: null,
    description: e.description, website: e.website,
  }
}

function catalogUniverse(): UniverseEntry[] {
  return EQUITY_CATALOG.map((e) => curatedEntry(e.symbol)!).sort((a, b) => b.marketCapB - a.marketCapB)
}

/** Convert one FMP screener row to a UniverseEntry, enriched with curated data. */
function toEntry(row: FmpScreenerRow): UniverseEntry | null {
  const symbol = row.symbol?.toUpperCase()
  if (!symbol || row.marketCap == null || row.marketCap <= 0) return null
  const curated = EQUITY_BY_SYMBOL[symbol]
  const price = row.price ?? curated?.referencePrice ?? 0
  return {
    symbol,
    name: curated?.name ?? row.companyName ?? symbol,
    sector: curated?.sector ?? mapSectorName(row.sector),
    industry: curated?.industry ?? row.industry ?? '—',
    marketCapB: row.marketCap / 1e9,
    referencePrice: price,
    ...NO_PER_SHARE,   // from SEC filings, by applyPerShare (D167)
    beta: row.beta ?? curated?.beta ?? 1,
    exchange: row.exchangeShortName ?? null,
    description: curated?.description,
    website: curated?.website,
  }
}

async function fetchFmpUniverse(key: string): Promise<UniverseEntry[]> {
  // Active common stocks (no ETFs/funds), largest first. NOTE: FMP's screener /
  // constituent-list endpoints are PAID (402 on the free tier); this only
  // returns a broad universe on a paid plan. Free keys fall back to the curated
  // catalog. Exchanges/countries are left open so a paid plan's international
  // coverage flows through.
  const url =
    'https://financialmodelingprep.com/stable/company-screener' +
    `?limit=${MAX_UNIVERSE}&isEtf=false&isFund=false&isActivelyTrading=true&apikey=${key}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`FMP screener ${res.status}${res.status === 402 ? ' (paid endpoint — the broad universe needs an FMP paid plan)' : ''}`)
  const rows = await res.json() as FmpScreenerRow[]
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('FMP screener returned no rows')

  const seen = new Set<string>()
  const entries: UniverseEntry[] = []
  for (const row of rows) {
    if (row.isEtf || row.isFund) continue
    const entry = toEntry(row)
    if (!entry || seen.has(entry.symbol)) continue
    seen.add(entry.symbol)
    entries.push(entry)
  }
  // Ensure curated names are always present even if the screener omitted them.
  for (const e of EQUITY_CATALOG) {
    if (!seen.has(e.symbol.toUpperCase())) { entries.push(curatedEntry(e.symbol)!); seen.add(e.symbol.toUpperCase()) }
  }
  entries.sort((a, b) => b.marketCapB - a.marketCapB)
  return entries
}

export async function GET(req: NextRequest) {
  const symbolParam = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase()
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  const key = getProviderKey('fmp')

  // Search mode: substring over symbol+name of the whole universe (top 10).
  // With an FMP key that is the full screener list (day-cached — this filters
  // cached data, it does not re-download); keyless it is honestly the curated
  // catalog, the same coverage the registry itself has without a key.
  if (q && !symbolParam) {
    let pool: UniverseEntry[]
    let source: 'fmp' | 'catalog' = 'catalog'
    if (key) {
      try { pool = await fetchFmpUniverse(key); source = 'fmp' }
      catch { pool = catalogUniverse() }
    } else {
      pool = catalogUniverse()
    }
    const entries = pool.filter(e =>
      e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    ).slice(0, 10)
    const { reached } = await applyPerShare(entries)
    return NextResponse.json({ ok: true, configured: !!key, source, count: entries.length, entries, secReached: reached, updatedAt: new Date().toISOString() } satisfies StockUniverseResponse)
  }

  // A few catalog stocks (portfolio income, Compare): their reference facts and SEC figures.
  const symbolsParam = req.nextUrl.searchParams.get('symbols')
  if (symbolsParam && !symbolParam) {
    const wanted = [...new Set(symbolsParam.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))].slice(0, 100)
    const entries = wanted.map((s) => curatedEntry(s)).filter((e): e is UniverseEntry => !!e)
    const { reached } = await applyPerShare(entries)
    return NextResponse.json({ ok: true, configured: !!key, source: 'catalog', count: entries.length, entries, secReached: reached, updatedAt: new Date().toISOString() } satisfies StockUniverseResponse)
  }

  // Single-symbol lookup (detail page). Try curated first, then FMP profile.
  if (symbolParam) {
    const curated = curatedEntry(symbolParam)
    if (curated) {
      const { reached } = await applyPerShare([curated])
      return NextResponse.json({ ok: true, configured: !!key, source: 'catalog', count: 1, entries: [curated], secReached: reached, updatedAt: new Date().toISOString() } satisfies StockUniverseResponse)
    }
    if (key) {
      try {
        // FMP /stable profile — works on the free tier (single symbol).
        const res = await fetch(`https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(symbolParam)}&apikey=${key}`, {
          headers: { Accept: 'application/json' }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        })
        if (res.ok) {
          const rows = await res.json() as Array<{ symbol: string; companyName: string; sector: string; industry: string; marketCap: number; price: number; beta: number; lastDividend: number; exchange: string; website: string }>
          const p = rows[0]
          if (p) {
            const entry: UniverseEntry = {
              symbol: p.symbol.toUpperCase(), name: p.companyName ?? p.symbol,
              sector: mapSectorName(p.sector), industry: p.industry ?? '—',
              marketCapB: (p.marketCap ?? 0) / 1e9, referencePrice: p.price ?? 0,
              ...NO_PER_SHARE,
              beta: p.beta ?? 1, exchange: p.exchange ?? null, website: p.website || undefined,
            }
            const { reached } = await applyPerShare([entry])
            return NextResponse.json({ ok: true, configured: true, source: 'fmp', count: 1, entries: [entry], secReached: reached, updatedAt: new Date().toISOString() } satisfies StockUniverseResponse)
          }
        }
      } catch { /* fall through to not-found */ }
    }
    return NextResponse.json({ ok: false, configured: !!key, source: 'catalog', count: 0, entries: [], updatedAt: new Date().toISOString(), error: `Unknown symbol ${symbolParam}` }, { status: 404 })
  }

  // Full universe.
  if (!key) {
    const entries = catalogUniverse()
    const { withEps, reached } = await applyPerShare(entries)
    return NextResponse.json({ ok: true, configured: false, source: 'catalog', count: entries.length, entries, peEnriched: withEps, secReached: reached, updatedAt: new Date().toISOString() } satisfies StockUniverseResponse)
  }
  try {
    const entries = await fetchFmpUniverse(key)
    // applyPerShare never throws: a SEC hiccup costs the P/E and yield columns, not the universe.
    const { withEps, reached } = await applyPerShare(entries)
    return NextResponse.json({ ok: true, configured: true, source: 'fmp', count: entries.length, entries, peEnriched: withEps, secReached: reached, updatedAt: new Date().toISOString() } satisfies StockUniverseResponse)
  } catch (e) {
    const entries = catalogUniverse()
    const { withEps, reached } = await applyPerShare(entries)
    return NextResponse.json({
      ok: true, configured: false, source: 'catalog', count: entries.length, entries, peEnriched: withEps, secReached: reached,
      updatedAt: new Date().toISOString(), error: e instanceof Error ? e.message : 'FMP universe unavailable',
    } satisfies StockUniverseResponse)
  }
}
