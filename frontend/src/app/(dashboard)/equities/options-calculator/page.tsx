'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Calculator, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { FeatureNotice } from '@/components/legal/FeatureNotice'
import { buildPreset, PRESETS, type PresetId } from '@/lib/options/presets'
import {
  chartRange, payoffSeries, summarizePayoff, type CalcLeg, type CalcPosition,
} from '@/lib/options/payoff'
import { positionGreeks, type PositionGreeks } from '@/lib/options/greeks'
import { CHART_THEME } from '@/lib/utils/chart'
import { STALE_TIME_SHORT } from '@/lib/constants'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'

// Options Calculator (T-420 item 4; owner decision D93, 2026-10-07).
//
// Arithmetic on a position the user enters: payoff at expiry, maximum gain
// and loss, breakevens, and the position's Greeks from the volatility the user
// enters. It replaces nothing: the graded Trade Risk Scorer at
// /equities/options stays switched off (D64), and nothing here may grade a
// trade or call one "safer" (D92; docs/assessments/
// risk-ratings-by-asset-type-2026-10-07.md §5.8). A test fails if this page
// imports the risk engine.
//
// Every option figure is typed in by the user: Finance Now carries no options
// chain (P2-O1). The underlying price is the one number the page can fetch,
// labelled live or reference. Do NOT infer a premium or a volatility: a
// made-up input gives a confident answer built on nothing.

// ─── Form state (strings, so partial typing never fights the parser) ─────────

interface LegForm {
  side: 'long' | 'short'
  type: 'call' | 'put'
  strike: string
  premium: string
  contracts: string
  iv: string
}

const emptyLeg = (): LegForm => ({ side: 'long', type: 'call', strike: '', premium: '', contracts: '1', iv: '' })

const num = (s: string): number | undefined => {
  if (s.trim() === '') return undefined
  const v = Number(s)
  return Number.isFinite(v) ? v : undefined
}

const MAX_LEGS = 4

interface Parsed {
  position: CalcPosition | null
  underlying: number | null
  days: number | null
  problems: string[]
}

function parse(f: {
  underlying: string; days: string; legs: LegForm[]; shares: string; shareCost: string
}): Parsed {
  const problems: string[] = []
  const underlying = num(f.underlying)
  if (underlying === undefined || underlying <= 0) problems.push('the underlying price (above 0)')
  const days = num(f.days)
  if (days === undefined || days < 0) problems.push('days to expiry (0 or more)')

  const legs: CalcLeg[] = []
  f.legs.forEach((l, i) => {
    const strike = num(l.strike), premium = num(l.premium), contracts = num(l.contracts)
    if (strike === undefined || strike <= 0) problems.push(`leg ${i + 1}: a strike above 0`)
    if (premium === undefined || premium < 0) problems.push(`leg ${i + 1}: a premium (0 or more)`)
    if (contracts === undefined || contracts <= 0 || !Number.isInteger(contracts)) problems.push(`leg ${i + 1}: whole contracts above 0`)
    if (strike === undefined || premium === undefined || contracts === undefined) return
    legs.push({ side: l.side, type: l.type, strike, premium, contracts })
  })

  const shares = num(f.shares)
  const shareCost = num(f.shareCost)
  if (shares !== undefined && shares !== 0 && (shareCost === undefined || shareCost < 0)) {
    problems.push('the price paid for the shares')
  }
  if (f.legs.length === 0 && !shares) problems.push('at least one leg')

  if (problems.length) return { position: null, underlying: underlying ?? null, days: days ?? null, problems }
  return {
    position: { legs, shares: shares || undefined, shareCost: shares ? shareCost : undefined },
    underlying: underlying!,
    days: days!,
    problems: [],
  }
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const usd = (x: number) =>
  `${x < 0 ? '−' : ''}$${Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const price = (x: number) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (x: number, digits = 2) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(digits)}`

// ─── Shared field bits (same look as the rest of the Equities section) ───────

const FIELD =
  'w-full rounded-sm border border-border bg-bg-elevated px-2 py-1.5 text-sm font-mono tabular-nums text-text-primary placeholder:text-text-muted/60 focus:border-accent-blue/50 focus:outline-hidden'
const LABEL = 'text-[11px] text-text-muted uppercase tracking-wider'

function Toggle<T extends string>({ value, options, onChange }: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5">
      {options.map(({ v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={clsx('px-2 py-1 rounded-sm text-[11px] font-medium transition-colors',
            value === v ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <label className={clsx('block', className)}>
      <span className={LABEL}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="decimal" className={clsx(FIELD, 'mt-1')} />
    </label>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="rounded-sm border border-border bg-bg-elevated/40 p-3">
      <div className={LABEL}>{label}</div>
      <div className={clsx('mt-1 text-lg font-mono tabular-nums',
        tone === 'gain' ? 'text-emerald-400' : tone === 'loss' ? 'text-red-400' : 'text-text-primary')}
      >
        {value}
      </div>
      {note && <div className="mt-0.5 text-[11px] text-text-muted">{note}</div>}
    </div>
  )
}

// The OCC's Options Disclosure Document, which brokers must give customers
// before they trade options (Rule 9b-1). A link, not a fetched source.
const OCC_ODD_URL = 'https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OptionsCalculatorPage() {
  return (
    <ModuleGate module="equities">
      <OptionsCalculatorInner />
    </ModuleGate>
  )
}

function OptionsCalculatorInner() {
  const [symbol, setSymbol] = useState('')
  const [underlying, setUnderlying] = useState('')
  const [days, setDays] = useState('30')
  const [ratePct, setRatePct] = useState('')
  const [divPct, setDivPct] = useState('')
  const [exDivDays, setExDivDays] = useState('')
  const [legs, setLegs] = useState<LegForm[]>([emptyLeg()])
  const [shares, setShares] = useState('')
  const [shareCost, setShareCost] = useState('')
  const [presetNote, setPresetNote] = useState<string | null>(null)

  // The one live number on the page: fetched on a button press, labelled.
  const cleanSymbol = symbol.trim().toUpperCase()
  const { data: quoteData, isFetching: quoteLoading, refetch: fetchQuote } = useQuery<SecurityQuotesResponse>({
    queryKey: ['security-quotes', cleanSymbol],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(cleanSymbol)}`).then((r) => r.json()),
    enabled: false,
    staleTime: STALE_TIME_SHORT,
  })
  const quote = quoteData?.quotes?.[cleanSymbol]
  const quoteIsLive = !!quote && quoteData?.source !== 'reference' && !quote.reference

  const prefillFromQuote = async () => {
    if (!cleanSymbol) return
    const res = await fetchQuote()
    const q = res.data?.quotes?.[cleanSymbol]
    if (q?.price != null) setUnderlying(String(q.price))
  }

  const applyPreset = (id: PresetId) => {
    const px = num(underlying)
    if (px === undefined || px <= 0) {
      setPresetNote('Enter (or fetch) the underlying price first: presets set their strikes from it.')
      return
    }
    const preset = buildPreset(id, px)
    setLegs(preset.legs.map((l) => ({ ...emptyLeg(), side: l.side, type: l.type, strike: String(l.strike) })))
    // A covered call is written against shares held; the others carry none.
    if (id === 'covered-call') { setShares('100'); setShareCost(String(px)) } else { setShares(''); setShareCost('') }
    setPresetNote(`${preset.note} Premiums and volatility stay blank: copy them from your broker's chain.`)
  }

  const setLeg = (i: number, patch: Partial<LegForm>) =>
    setLegs((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const parsed = useMemo(
    () => parse({ underlying, days, legs, shares, shareCost }),
    [underlying, days, legs, shares, shareCost],
  )

  const summary = useMemo(() => (parsed.position ? summarizePayoff(parsed.position) : null), [parsed.position])

  const series = useMemo(() => {
    if (!parsed.position || parsed.underlying == null) return []
    const { lo, hi } = chartRange(parsed.position, parsed.underlying)
    return payoffSeries(parsed.position, lo, hi, 160)
  }, [parsed.position, parsed.underlying])

  // Greeks need a volatility on every leg and time left; otherwise say what's missing.
  const greeks = useMemo((): { g: PositionGreeks | null; why: string | null } => {
    if (!parsed.position || parsed.underlying == null || parsed.days == null) return { g: null, why: null }
    if (parsed.position.legs.length === 0) return { g: null, why: 'Add an option leg to see Greeks.' }
    if (parsed.days <= 0) return { g: null, why: 'At expiry there is no time value, so the Greeks are not defined.' }
    const vols = legs.map((l) => num(l.iv))
    if (vols.some((v) => v === undefined || v <= 0)) return { g: null, why: 'Enter an implied volatility above 0 for every leg to see Greeks.' }
    return {
      g: positionGreeks(parsed.position, vols as number[], {
        spot: parsed.underlying, daysToExpiry: parsed.days,
        ratePct: num(ratePct) ?? 0, dividendYieldPct: num(divPct) ?? 0,
      }),
      why: null,
    }
  }, [parsed, legs, ratePct, divPct])

  const hasShortCall = parsed.position?.legs.some((l) => l.side === 'short' && l.type === 'call') ?? false
  const exDiv = num(exDivDays)
  const exDivBeforeExpiry = exDiv !== undefined && parsed.days != null && exDiv >= 0 && exDiv < parsed.days

  // Split the area fill at zero: gains one colour, losses another.
  const pnls = series.map((p) => p.pnl)
  const top = Math.max(0, ...pnls), bottom = Math.min(0, ...pnls)
  const zeroAt = top === bottom ? 0.5 : top / (top - bottom)

  return (
    <div className="space-y-6 max-w-(--breakpoint-xl) mx-auto">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-accent-blue" aria-hidden />
        <PageHeader
          title="Options Calculator"
          subtitle="Payoff, breakevens and Greeks for an options position you enter"
        />
      </div>

      <div className="text-xs text-text-muted leading-relaxed rounded-card border border-border bg-bg-card p-3 space-y-1.5">
        <p>
          This works out what a position <em>you</em> describe is worth at expiry, where it breaks
          even, the most it can gain or lose, and how it responds to price, time and volatility. It is
          arithmetic on your figures. It doesn&rsquo;t rate the trade or suggest one.
        </p>
        <p>
          Finance Now carries no options chain, so strikes, premiums and implied volatility come from
          your broker. The underlying price is the one number this page can fetch. Options carry
          particular risks; read the OCC&rsquo;s{' '}
          <a href={OCC_ODD_URL} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline inline-flex items-center gap-0.5">
            Characteristics and Risks of Standardized Options <ExternalLink size={10} aria-hidden />
          </a>{' '}
          before trading them.
        </p>
      </div>

      <SourceLine id="options-calculator" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Left: the position ── */}
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium text-text-secondary">Underlying</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <label className="block">
                <span className={LABEL}>Symbol (optional)</span>
                <div className="mt-1 flex gap-1">
                  <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" className={FIELD} />
                  <button
                    type="button"
                    onClick={prefillFromQuote}
                    disabled={!cleanSymbol || quoteLoading}
                    title="Fetch the current price"
                    className="px-2 rounded-sm border border-border bg-bg-elevated text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
                  >
                    <Search size={13} aria-hidden />
                  </button>
                </div>
              </label>
              <Field label="Price" value={underlying} onChange={setUnderlying} placeholder="0.00" />
              <Field label="Days to expiry" value={days} onChange={setDays} />
              <Field label="Interest rate %" value={ratePct} onChange={setRatePct} placeholder="0" />
              <Field label="Dividend yield %" value={divPct} onChange={setDivPct} placeholder="0" />
              <Field label="Ex-dividend in (days)" value={exDivDays} onChange={setExDivDays} placeholder="optional" />
            </div>
            {quote && (
              <p className="text-[11px] text-text-muted">
                Fetched {cleanSymbol}: <span className="font-mono">{quote.price}</span>{' '}
                {quoteIsLive
                  ? <span className="text-emerald-400">live via {quoteData?.source}</span>
                  : <span className="text-amber-400">reference price, live source unreachable</span>}
              </p>
            )}
            <p className="text-[11px] text-text-muted">
              The rate and dividend yield only affect the Greeks. Blank counts as 0%.
            </p>
          </div>

          <div className="rounded-card border border-border bg-bg-card p-4 space-y-2">
            <h2 className="text-sm font-medium text-text-secondary">Start from a structure</h2>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  title={p.description}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Presets fill in sides, types and strikes from the underlying price, and nothing else.
              {presetNote && <span className="block mt-1 text-amber-400/90">{presetNote}</span>}
            </p>
          </div>

          <div className="rounded-card border border-border bg-bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-secondary">Option legs</h2>
              <button
                type="button"
                onClick={() => setLegs((prev) => [...prev, emptyLeg()])}
                disabled={legs.length >= MAX_LEGS}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border bg-bg-elevated text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
              >
                <Plus size={12} aria-hidden /> Add leg
              </button>
            </div>
            {legs.map((leg, i) => (
              <div key={i} className="rounded-sm border border-border/60 bg-bg-elevated/40 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-text-muted">#{i + 1}</span>
                  <Toggle value={leg.side} options={[{ v: 'long', label: 'Buy' }, { v: 'short', label: 'Sell' }]} onChange={(v) => setLeg(i, { side: v })} />
                  <Toggle value={leg.type} options={[{ v: 'call', label: 'Call' }, { v: 'put', label: 'Put' }]} onChange={(v) => setLeg(i, { type: v })} />
                  <button
                    type="button"
                    onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                    title="Remove leg"
                    className="ml-auto p-1 rounded-sm text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    ['strike', 'Strike', ''], ['premium', 'Premium / share', ''],
                    ['contracts', 'Contracts', ''], ['iv', 'Implied vol %', 'for Greeks'],
                  ] as const).map(([key, label, ph]) => (
                    <label key={key} className="block">
                      <span className={LABEL}>{label}</span>
                      <input
                        value={leg[key]}
                        onChange={(e) => setLeg(i, { [key]: e.target.value })}
                        placeholder={ph}
                        inputMode="decimal"
                        className={clsx(FIELD, 'mt-1 px-1.5 text-xs')}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-text-muted">One contract covers 100 shares.</p>
          </div>

          <div className="rounded-card border border-border bg-bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium text-text-secondary">Shares held alongside <span className="text-text-muted font-normal">(optional)</span></h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shares (negative if short)" value={shares} onChange={setShares} placeholder="0" />
              <Field label="Price paid per share" value={shareCost} onChange={setShareCost} placeholder="0.00" />
            </div>
          </div>
        </div>

        {/* ── Right: the arithmetic ── */}
        <div className="space-y-4">
          {!summary ? (
            <div className="rounded-card border border-border bg-bg-card p-4">
              <h2 className="text-sm font-medium text-text-secondary">Results</h2>
              <p className="mt-2 text-xs text-text-muted">
                {parsed.problems.length ? <>Still needed: {parsed.problems.join('; ')}.</> : 'Fill in the position to see the results.'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-card border border-border bg-bg-card p-4 space-y-3">
                <h2 className="text-sm font-medium text-text-secondary">At expiry</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label={summary.netPremiumUsd >= 0 ? 'Net credit' : 'Net debit'}
                    value={usd(Math.abs(summary.netPremiumUsd))}
                    note={summary.netPremiumUsd >= 0 ? 'received when opened' : 'paid when opened'}
                  />
                  <Stat
                    label="Breakevens"
                    value={summary.breakevens.length ? summary.breakevens.map(price).join(' · ') : 'None'}
                    note="underlying price at expiry"
                  />
                  <Stat
                    label="Maximum gain"
                    value={summary.maxGainUsd === 'unlimited' ? 'Unlimited' : usd(summary.maxGainUsd)}
                    tone="gain"
                    note={summary.maxGainUsd === 'unlimited' ? 'grows as the price rises' : undefined}
                  />
                  <Stat
                    label="Maximum loss"
                    value={summary.maxLossUsd === 'unlimited' ? 'Unlimited' : usd(summary.maxLossUsd)}
                    tone="loss"
                    note={summary.maxLossUsd === 'unlimited' ? 'grows as the price rises' : undefined}
                  />
                </div>
              </div>

              <div className="rounded-card border border-border bg-bg-card p-4 space-y-2">
                <h2 className="text-sm font-medium text-text-secondary">Profit or loss at expiry</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="pnl-split" x1="0" y1="0" x2="0" y2="1">
                          <stop offset={zeroAt} stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset={zeroAt} stopColor="#ef4444" stopOpacity={0.25} />
                        </linearGradient>
                        <linearGradient id="pnl-line" x1="0" y1="0" x2="0" y2="1">
                          <stop offset={zeroAt} stopColor="#10b981" />
                          <stop offset={zeroAt} stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                      <XAxis
                        dataKey="price" type="number" domain={['dataMin', 'dataMax']}
                        tick={{ fill: CHART_THEME.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                        tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                      />
                      <YAxis
                        tick={{ fill: CHART_THEME.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                        tickLine={false} axisLine={false} width={70}
                        tickFormatter={(v: number) => usd(v).replace('.00', '')}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART_THEME.tooltip.background,
                          border: `1px solid ${CHART_THEME.tooltip.border}`,
                          borderRadius: '6px', fontSize: '12px', color: CHART_THEME.tooltip.text,
                        }}
                        labelFormatter={(v) => `Underlying ${price(Number(v))}`}
                        formatter={(v) => [usd(Number(v)), 'P/L at expiry']}
                      />
                      <ReferenceLine y={0} stroke="#475569" />
                      {parsed.underlying != null && (
                        <ReferenceLine x={parsed.underlying} stroke="#3b82f6" strokeDasharray="4 4"
                          label={{ value: 'now', fill: '#3b82f6', fontSize: 10, position: 'top' }} />
                      )}
                      {summary.breakevens.map((b) => (
                        <ReferenceLine key={b} x={b} stroke="#64748b" strokeDasharray="2 3" />
                      ))}
                      <Area type="linear" dataKey="pnl" stroke="url(#pnl-line)" strokeWidth={1.5}
                        fill="url(#pnl-split)" baseValue={0} dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-text-muted">
                  Dashed grey lines mark the breakevens; the blue line is the price you entered.
                </p>
              </div>

              <div className="rounded-card border border-border bg-bg-card p-4 space-y-2">
                <h2 className="text-sm font-medium text-text-secondary">Greeks <span className="text-text-muted font-normal">(the whole position, now)</span></h2>
                {greeks.g ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="Delta" value={signed(greeks.g.delta, 1)} note="moves like this many shares" />
                    <Stat label="Gamma" value={signed(greeks.g.gamma, 3)} note="delta change per $1" />
                    <Stat label="Theta" value={usd(greeks.g.thetaPerDay)} note="per day that passes" />
                    <Stat label="Vega" value={usd(greeks.g.vegaPerPoint)} note="per 1 point of volatility" />
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">{greeks.why ?? 'Fill in the position to see its Greeks.'}</p>
                )}
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Black-Scholes-Merton, from the volatility you entered. US equity options can be
                  exercised early and this model assumes they can&rsquo;t, so treat these as the
                  approximation broker chains also show.
                </p>
              </div>

              {hasShortCall && exDivBeforeExpiry && (
                <p className="text-[11px] text-text-muted leading-relaxed rounded-card border border-border bg-bg-card p-3">
                  The ex-dividend date you entered falls before expiry. A sold call can be exercised
                  early, and that most often happens just before an ex-dividend date.
                </p>
              )}
            </>
          )}
          <FeatureNotice feature="calculators" />
        </div>
      </div>
    </div>
  )
}
