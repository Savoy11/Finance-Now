'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Banknote, Gem, Globe, Percent } from 'lucide-react'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { PageHeader } from '@/components/ui/PageHeader'
import { STALE_TIME_LONG, STALE_TIME_SHORT } from '@/lib/constants'
import { SourceLine } from '@/components/ui/SourceLine'
import { RATES_CATALOG } from '@/lib/data/ratesCatalog'
import { curveYieldSourceLabel, yieldFromCurve, type CurveYield } from '@/lib/data/ratesFromCurve'
import type { YieldCurveResponse } from '@/app/live-data/treasury-yield-curve/route'

// Macro Markets overview — the module's landing page while the three area
// toolsets build out (owner spec: docs/ROADMAP.md, "Macro Markets").
// Commodity and currency rows are live via the security-quotes route. The four
// Treasury yields are read from the official par curve, as /macro/rates reads
// them (D3, lib/data/ratesFromCurve.ts): no free provider quotes ^IRX/^FVX/
// ^TNX/^TYX, so asking the quote ladder for them left this strip all dashes
// while the rates page showed the same yields (found 2026-11-06). Anything that
// can't be priced renders an explicit dash, never a made-up value.

interface MacroSymbol {
  symbol: string
  label: string
  /** How to render the quote value. A 'pct-yield' row reads the Treasury curve, never a quote. */
  kind: 'usd' | 'pct-yield' | 'fx'
}

interface MacroArea {
  title: string
  icon: typeof Gem
  accent: string
  blurb: string
  /** Set once the area's registry page exists — the card title links to it. */
  href?: string
  symbols: MacroSymbol[]
}

const AREAS: MacroArea[] = [
  {
    title: 'Commodities',
    icon: Gem,
    accent: '#f59e0b',
    blurb: 'Metals, energy, and agriculture futures with the same registry, detail, TA, and backtest tooling the Equities module has.',
    href: '/macro/commodities',
    symbols: [
      { symbol: 'GC=F', label: 'Gold', kind: 'usd' },
      { symbol: 'SI=F', label: 'Silver', kind: 'usd' },
      { symbol: 'CL=F', label: 'WTI Crude', kind: 'usd' },
      { symbol: 'NG=F', label: 'Nat Gas', kind: 'usd' },
      { symbol: 'HG=F', label: 'Copper', kind: 'usd' },
    ],
  },
  {
    title: 'Currencies',
    icon: Banknote,
    accent: '#22c55e',
    blurb: 'Major and EM FX pairs, dollar index, and a converter — intraday via live quotes, daily ECB reference crosses.',
    href: '/macro/currencies',
    symbols: [
      { symbol: 'EURUSD=X', label: 'EUR/USD', kind: 'fx' },
      { symbol: 'GBPUSD=X', label: 'GBP/USD', kind: 'fx' },
      { symbol: 'JPY=X', label: 'USD/JPY', kind: 'fx' },
      { symbol: 'DX-Y.NYB', label: 'Dollar Index', kind: 'fx' },
    ],
  },
  {
    title: 'Bonds & Rates',
    icon: Percent,
    accent: '#64748b',
    blurb: 'The official treasury yield curve, daily Treasury yields, live bond futures, and the bond ETF shelf. CUSIP-level bond quotes are licensed data — the page says so rather than pretending.',
    href: '/macro/rates',
    symbols: [
      { symbol: '^IRX', label: '3-Month', kind: 'pct-yield' },
      { symbol: '^FVX', label: '5-Year', kind: 'pct-yield' },
      { symbol: '^TNX', label: '10-Year', kind: 'pct-yield' },
      { symbol: '^TYX', label: '30-Year', kind: 'pct-yield' },
    ],
  },
]

/** Only these go to the quote ladder; the yields come from the curve. */
const QUOTED_SYMBOLS = AREAS.flatMap((a) => a.symbols.filter((s) => s.kind !== 'pct-yield').map((s) => s.symbol))

/** A yield row's reading from the curve, or null (a dash). */
function curveYield(symbol: string, curve: YieldCurveResponse | undefined): CurveYield | null {
  const entry = RATES_CATALOG.find((r) => r.symbol === symbol)
  if (!entry || !curve?.ok) return null
  return yieldFromCurve(entry, curve.latest ?? null)
}

interface Quote {
  price: number | null
  changePercent: number | null
}
interface QuotesResponse {
  ok: boolean
  quotes?: Record<string, { price: number | null; changePercent: number | null }>
}

function fmtValue(kind: MacroSymbol['kind'], price: number): string {
  if (kind === 'pct-yield') return `${price.toFixed(2)}%`
  if (kind === 'fx') return price >= 10 ? price.toFixed(2) : price.toFixed(4)
  return price >= 100 ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${price.toFixed(2)}`
}

function MacroContent() {
  const { data, isLoading, isError } = useQuery<Record<string, Quote>>({
    queryKey: ['macro-overview-quotes'],
    queryFn: async () => {
      const res = await fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(QUOTED_SYMBOLS.join(','))}`)
      const json: QuotesResponse = await res.json()
      if (!json.ok || !json.quotes) throw new Error('quotes unavailable')
      return json.quotes
    },
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 1000 * 60 * 2,
  })

  // The same query key as /macro/rates, so the two pages share one cached curve.
  const { data: curve, isLoading: curveLoading } = useQuery<YieldCurveResponse>({
    queryKey: ['treasury-yield-curve'],
    queryFn: () => fetch('/live-data/treasury-yield-curve').then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
  })

  return (
    <div className="space-y-6 max-w-(--breakpoint-xl) mx-auto">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
          <Globe size={18} className="text-accent-blue" aria-hidden />
        </div>
        <PageHeader
          title="Macro Markets"
          subtitle="Commodities, currencies, and rates — live now, toolsets building out"
          description="One module, three areas, mirroring the Crypto and Equities toolsets: registries with live quotes, detail pages with charts and news, shared technical analysis and backtests, and macro-aware AI agents. Quotes ride the same keyed data plumbing as the rest of the suite — each card below reports how many of its instruments are actually priced right now."
          details={[
            { label: 'Build order', text: 'Commodities first, then Currencies, then Bonds & Rates — richest free data first.' },
            { label: 'Data honesty', text: 'Everything shown is live or explicitly unavailable. Individual bond quotes (CUSIP-level) have no free source and will never be fabricated.' },
          ]}
        />
      </div>

      {isError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-text-secondary leading-relaxed">
          Live macro quotes are unavailable right now — the quote source could not be reached. Values will appear when the feed recovers.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {AREAS.map((area) => (
          <div key={area.title} className="rounded-card border border-border bg-bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
              <area.icon size={15} style={{ color: area.accent }} aria-hidden />
              {area.href ? (
                <Link href={area.href} className="text-sm font-medium text-text-primary flex-1 hover:text-accent-blue transition-colors">
                  {area.title}
                </Link>
              ) : (
                <h2 className="text-sm font-medium text-text-primary flex-1">{area.title}</h2>
              )}
              {/* D-12 fix: this chip was a hardcoded "Live" string, shown
                  even when a no-key deploy dashed every quote (the route
                  returns ok:true with empty quotes, so no error fires).
                  Derived from the priced count instead — the commodities
                  page's own "N priced live" pattern. */}
              {(() => {
                // A curve yield is a daily official reading, so it is counted
                // as "daily", never as "live".
                const fromCurve = area.symbols.every((s) => s.kind === 'pct-yield')
                const priced = area.symbols.filter((s) =>
                  s.kind === 'pct-yield' ? curveYield(s.symbol, curve) != null : data?.[s.symbol]?.price != null,
                ).length
                const loading = fromCurve ? curveLoading : isLoading
                const any = priced > 0
                return (
                  <span className={clsx('px-2 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wider border',
                    any ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-bg-elevated border-border text-text-muted')}>
                    {loading ? '…' : any ? `${priced}/${area.symbols.length} ${fromCurve ? 'daily' : 'live'}` : fromCurve ? 'no reading' : 'no live quotes'}
                  </span>
                )
              })()}
            </div>
            <div className="divide-y divide-border/40">
              {area.symbols.map((s) => {
                if (s.kind === 'pct-yield') {
                  const cy = curveYield(s.symbol, curve)
                  return (
                    <div key={s.symbol} className="px-4 py-2 flex items-center gap-3 text-sm">
                      <span className="text-xs text-text-secondary flex-1">{s.label}</span>
                      {cy ? (
                        <>
                          <span className="font-mono tabular-nums text-text-primary">{fmtValue(s.kind, cy.yieldPct)}</span>
                          {/* A daily curve reading has no intraday change: say so rather than show none. */}
                          <span className="font-mono text-xs w-16 text-right text-text-muted" title={curveYieldSourceLabel(cy)}>daily</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-text-muted">{curveLoading ? '…' : '—'}</span>
                      )}
                    </div>
                  )
                }
                const q = data?.[s.symbol]
                const up = (q?.changePercent ?? 0) >= 0
                return (
                  <div key={s.symbol} className="px-4 py-2 flex items-center gap-3 text-sm">
                    <span className="text-xs text-text-secondary flex-1">{s.label}</span>
                    {q?.price != null ? (
                      <>
                        <span className="font-mono tabular-nums text-text-primary">{fmtValue(s.kind, q.price)}</span>
                        {q.changePercent != null && (
                          <span className={clsx('font-mono tabular-nums text-xs w-16 text-right', up ? 'text-emerald-400' : 'text-red-400')}>
                            {up ? '+' : ''}{q.changePercent.toFixed(2)}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-mono text-xs text-text-muted">{isLoading ? '…' : '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="px-4 py-3 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">{area.blurb}</p>
          </div>
        ))}
      </div>

      {/* Attribution comes from the registry, not hand-written prose — prose
          drifts when a provider changes and nothing forces it to be updated.
          The quoting-convention note stays, since that's about how to READ the
          numbers, not where they came from. */}
      <SourceLine id="macro-quotes" className="justify-center" />
      <SourceLine id="treasury-yield-curve" className="justify-center" />
      <p className="text-[11px] text-text-muted text-center leading-relaxed">
        Treasury yields are the official par curve, published once a day, not intraday quotes; futures are front-month continuous contracts.
      </p>
    </div>
  )
}

export default function MacroPage() {
  return (
    <ModuleGate module="macro">
      <MacroContent />
    </ModuleGate>
  )
}
