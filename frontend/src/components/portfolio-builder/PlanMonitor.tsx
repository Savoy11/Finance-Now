'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, History, Info, Minus, Printer, Save,
} from 'lucide-react'
import { hydratePortfolios, usePortfolioStore } from '@/store/usePortfolioStore'
import { fetchInstrumentPrices } from '@/lib/api/instrumentPrices'
import { STALE_TIME_SHORT } from '@/lib/constants'
import {
  actualWeightsFromPortfolio, checkDrift, reviewPlan,
  type SavedPlan,
} from '@/lib/data/portfolioBuilder'
import { buildRebalanceNotes, type RebalanceNotes } from '@/lib/data/rebalanceNotes'
import { planHistory, snapshotFromDrift, type SavedCheck } from '@/lib/data/planHistory'
import { RebalanceNotesPrint } from './RebalanceNotesPrint'
import {
  TRACKED_LIST_KEY, retryUnlessAnswered, trackedApi, trackedLedgerKey, trackedPricesKey,
} from '@/lib/api/trackedPortfolios'
import { valueLedger } from '@/lib/data/tradeLedger'
import { actualWeightsFromTracked } from '@/lib/data/trackedPortfolioViews'
import { FeatureNotice } from '@/components/legal/FeatureNotice'

// Drift + suitability panel for one saved plan. A plan only earns its keep if
// it's checked against what the user actually holds, so this reads real
// portfolios (live-priced) and falls back to manual entry when there aren't any.
//
// Two things a check can become (D56, 2026-10-04): a saved check in the plan's
// history (T-065, lib/data/planHistory.ts), kept only when the user presses
// Save, and printed rebalance notes (T-066, lib/data/rebalanceNotes.ts), which
// restate the drift table on paper. Both carry the figures on screen, no others.
//
// A tracked portfolio (real trades, T-027) can be the one compared against since
// T-453 (D208): weighted by each holding's live value, with the short
// not-advice line beside the figures, since these are trades on real money.

type Source = 'portfolio' | 'manual'

/** A portfolio the plan can be compared against: a what-if one, or a tracked one with real trades. */
interface Choice { id: string; name: string; tracked: boolean }

/** Saved checks shown before "Show all". */
const HISTORY_SHOWN = 10

function fmtUsd(n: number) {
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`
  return n < 0 ? `−${s}` : s
}

export function PlanMonitor({ saved }: { saved: SavedPlan }) {
  const portfolios = usePortfolioStore((s) => s.portfolios)
  const queryClient = useQueryClient()
  useEffect(() => { void hydratePortfolios() }, [])
  // Tracked portfolios are rows in the same portfolios table, so a plan can link one.
  // A database without their tables (migration 0005) answers 503: then there are none.
  const trackedList = useQuery({ queryKey: TRACKED_LIST_KEY, queryFn: () => trackedApi.list(), retry: retryUnlessAnswered })

  const choices = useMemo<Choice[]>(() => [
    ...portfolios.map((p) => ({ id: p.id, name: p.name, tracked: false })),
    ...(trackedList.data ?? []).map((p) => ({ id: p.id, name: p.name, tracked: true })),
  ], [portfolios, trackedList.data])

  // Portfolios are DB-backed with UUID ids, so a plan's comparison target
  // persists server-side (builder_plans.linked_portfolio_id): a saved link
  // wins over the default, and changing the select saves the new link.
  const linkedChoice = choices.find((c) => c.id === saved.linkedPortfolioId)
  const [source, setSource] = useState<Source>(choices.length > 0 ? 'portfolio' : 'manual')
  const [portfolioId, setPortfolioId] = useState<string>((linkedChoice ?? choices[0])?.id ?? '')
  const [manual, setManual] = useState<Record<string, string>>({})

  // What-if and tracked portfolios arrive from the server after first render,
  // and not together, so the state above may have been computed against a
  // partial list. As they arrive, adopt the persisted link (or the first
  // portfolio) and switch the source toggle over, unless the user has already
  // chosen themselves.
  const sourceTouched = useRef(false)
  const portfolioTouched = useRef(false)
  useEffect(() => {
    if (choices.length === 0) return
    if (!portfolioTouched.current) {
      const keep = choices.some((c) => c.id === portfolioId) ? portfolioId : choices[0].id
      setPortfolioId(linkedChoice ? linkedChoice.id : keep)
    }
    if (!sourceTouched.current) setSource('portfolio')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices.length, linkedChoice?.id])

  const linkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/user/builder-plans/${saved.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedPortfolioId: id }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Link not saved')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['builder-plans'] }),
  })

  const selectPortfolio = (id: string) => {
    portfolioTouched.current = true
    setPortfolioId(id)
    linkMutation.mutate(id)
  }

  const chosen = choices.find((c) => c.id === portfolioId)
  const portfolio = chosen && !chosen.tracked ? portfolios.find((p) => p.id === chosen.id) : undefined
  const trackedId = chosen?.tracked ? chosen.id : null
  const usingTracked = source === 'portfolio' && !!trackedId
  const usingPortfolio = source === 'portfolio' && (!!portfolio || usingTracked)

  const { data: priceResult, isLoading: whatIfPricesLoading } = useQuery({
    queryKey: ['builder-drift-prices', portfolio?.id, portfolio?.holdings.length],
    queryFn: () => fetchInstrumentPrices(portfolio!.holdings.map((h) => h.cgId)),
    enabled: source === 'portfolio' && !!portfolio && portfolio.holdings.length > 0,
    staleTime: STALE_TIME_SHORT,
  })

  // A tracked portfolio: its ledger, then live prices for what is still held, under
  // the same query keys as its own page, so the two share one cache.
  const ledger = useQuery({
    queryKey: trackedLedgerKey(trackedId ?? ''),
    queryFn: () => trackedApi.ledger(trackedId!),
    enabled: usingTracked,
    retry: retryUnlessAnswered,
  })
  const heldKeys = useMemo(
    () => (ledger.data?.view.holdings ?? []).filter((h) => h.basis.quantityHeld !== '0').map((h) => h.instrumentKey).sort(),
    [ledger.data],
  )
  const trackedPrices = useQuery({
    queryKey: trackedPricesKey(heldKeys),
    queryFn: () => fetchInstrumentPrices(heldKeys),
    enabled: usingTracked && heldKeys.length > 0,
    staleTime: STALE_TIME_SHORT,
  })
  const pricesLoading = usingTracked
    ? ledger.isPending || (heldKeys.length > 0 && trackedPrices.isPending)
    : whatIfPricesLoading

  const actual = useMemo(() => {
    if (usingTracked) {
      if (!ledger.data || (heldKeys.length > 0 && !trackedPrices.data)) return null
      const r = actualWeightsFromTracked(valueLedger(ledger.data.view, trackedPrices.data?.prices ?? {}).holdings)
      return Object.keys(r.weights).length > 0 ? r : null
    }
    if (usingPortfolio) {
      if (!priceResult) return null
      const r = actualWeightsFromPortfolio(portfolio!, priceResult.prices)
      return Object.keys(r.weights).length > 0 ? r : null
    }
    const weights: Record<string, number> = {}
    for (const [symbol, raw] of Object.entries(manual)) {
      const v = Number(raw)
      if (Number.isFinite(v) && v > 0) weights[symbol] = v
    }
    return Object.keys(weights).length > 0
      ? { weights, valueUsd: saved.plan.inputs.amount, pricedPct: 100, unpricedPct: 0, noCostBasisPct: 0 }
      : null
  }, [usingTracked, ledger.data, heldKeys, trackedPrices.data, usingPortfolio, priceResult, portfolio, manual, saved.plan.inputs.amount])
  const portfolioName = usingPortfolio ? chosen?.name ?? null : null

  const drift = useMemo(
    () => (actual ? checkDrift(saved.plan, actual.weights, actual.valueUsd) : null),
    [actual, saved.plan],
  )
  const findings = useMemo(
    () => reviewPlan(saved, actual ? { weights: actual.weights, valueUsd: actual.valueUsd } : undefined),
    [saved, actual],
  )

  const manualTotal = Object.values(manual).reduce((s, v) => s + (Number(v) || 0), 0)
  // Hand-entered weights that do not total 100% give drift figures that mean
  // nothing, so they can be looked at but not saved or printed.
  const checkUsable = !!drift && !!actual && (usingPortfolio || Math.abs(manualTotal - 100) <= 1)

  const historyQuery = useQuery({
    queryKey: ['builder-plan-history', saved.id],
    queryFn: async (): Promise<SavedCheck[]> => {
      const res = await fetch(`/api/user/builder-plans/${saved.id}/snapshots`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Saved checks could not be loaded')
      return json.checks as SavedCheck[]
    },
    staleTime: 30_000,
  })
  const history = useMemo(() => planHistory(historyQuery.data ?? []), [historyQuery.data])
  const [showAllHistory, setShowAllHistory] = useState(false)

  const saveCheck = useMutation({
    mutationFn: async () => {
      if (!drift || !actual) throw new Error('There is no check to save yet')
      const snapshot = snapshotFromDrift(drift, {
        portfolioName,
        valueUsd: actual.valueUsd, pricedPct: actual.pricedPct, bandPct: saved.plan.driftBandPct,
      })
      const res = await fetch(`/api/user/builder-plans/${saved.id}/snapshots`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'The check was not saved')
    },
    onSuccess: () => {
      toast.success('Check saved to this plan’s history')
      void queryClient.invalidateQueries({ queryKey: ['builder-plan-history', saved.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [printNotes, setPrintNotes] = useState<RebalanceNotes | null>(null)
  const printRebalanceNotes = () => {
    if (!drift || !actual) return
    setPrintNotes(buildRebalanceNotes({
      planName: saved.name, drift, portfolioName,
      valueUsd: actual.valueUsd, pricedPct: actual.pricedPct, bandPct: saved.plan.driftBandPct,
      preparedAt: new Date(),
    }))
  }

  return (
    <div className="border-t border-border/60 bg-bg-elevated/40 px-4 py-4 space-y-4">
      {/* Source picker */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-muted uppercase tracking-wider">Compare against</span>
        <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5">
          <button
            onClick={() => { sourceTouched.current = true; setSource('portfolio') }}
            disabled={choices.length === 0}
            className={clsx('px-2.5 py-1 rounded-sm text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              source === 'portfolio' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}
          >
            A portfolio
          </button>
          <button
            onClick={() => { sourceTouched.current = true; setSource('manual') }}
            className={clsx('px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
              source === 'manual' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}
          >
            Enter weights
          </button>
        </div>

        {source === 'portfolio' && (
          choices.length > 0 ? (
            <select
              value={portfolioId}
              onChange={(e) => selectPortfolio(e.target.value)}
              aria-label="Portfolio to compare against"
              className="rounded-sm border border-border bg-bg-card px-2 py-1 text-xs text-text-primary focus:border-accent-blue/50 focus:outline-hidden"
            >
              {portfolios.length > 0 && (
                <optgroup label="What-if portfolios">
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              )}
              {(trackedList.data?.length ?? 0) > 0 && (
                <optgroup label="Tracked portfolios (real trades)">
                  {trackedList.data!.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              )}
            </select>
          ) : (
            <span className="text-xs text-text-muted">No portfolios yet — build one on the Portfolios page, or enter weights by hand.</span>
          )
        )}

        {usingPortfolio && actual && (
          <span className="ml-auto text-xs text-text-muted font-mono tabular-nums">
            {fmtUsd(actual.valueUsd)} {actual.pricedPct < 99 ? 'marked to market' : 'live value'}
          </span>
        )}
      </div>

      {/* Manual weight entry */}
      {source === 'manual' && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {saved.plan.holdings.map((h) => (
              <label key={h.symbol} className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-text-primary w-12">{h.symbol}</span>
                <input
                  type="number" min={0} max={100} step="0.1"
                  value={manual[h.symbol] ?? ''}
                  onChange={(e) => setManual((m) => ({ ...m, [h.symbol]: e.target.value }))}
                  placeholder={h.weightPct.toFixed(1)}
                  className="w-20 rounded-sm border border-border bg-bg-card px-2 py-1 font-mono tabular-nums text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-hidden"
                />
                <span className="text-text-muted">%</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-text-muted">
            Entered {manualTotal.toFixed(1)}%.
            {manualTotal > 0 && Math.abs(manualTotal - 100) > 1 &&
              ' Weights should total 100% for the drift figures to mean anything.'}
            {' '}Holdings outside the plan can’t be entered here — link a portfolio to catch those.
          </p>
        </div>
      )}

      {usingPortfolio && pricesLoading && (
        <p className="text-xs text-text-muted">Fetching live prices…</p>
      )}

      {usingTracked && ledger.isError && (
        <p className="text-xs text-amber-400">
          This tracked portfolio’s trades could not be loaded: {ledger.error instanceof Error ? ledger.error.message : 'the request failed'}.
        </p>
      )}

      {usingTracked && !pricesLoading && !ledger.isError && !actual && (
        <p className="text-xs text-amber-400">
          {heldKeys.length === 0
            ? 'This tracked portfolio holds nothing right now, so there is nothing to compare.'
            : 'None of this portfolio’s holdings has a live price right now, so drift can’t be worked out. A holding is never valued at its cost.'}
        </p>
      )}

      {usingPortfolio && !usingTracked && !pricesLoading && !actual && (
        <p className="text-xs text-amber-400">
          None of this portfolio’s positions could be marked to market, so drift can’t be calculated.
          A position needs both a live price and an entry price; without both it is excluded rather than
          valued at cost, because a portfolio valued at cost restates its own targets and would report
          zero drift on every line.
        </p>
      )}

      {usingPortfolio && actual && actual.pricedPct < 99 && (
        <p className="text-xs text-amber-400">
          Only {actual.pricedPct}% of the portfolio{usingTracked ? ' (measured by what it cost)' : ''} could be marked to market; the rest is excluded from
          these weights
          {actual.unpricedPct > 0 && ` (${actual.unpricedPct}% has no live price`}
          {actual.unpricedPct > 0 && actual.noCostBasisPct > 0 && ','}
          {actual.noCostBasisPct > 0 &&
            `${actual.unpricedPct > 0 ? ' ' : ' ('}${actual.noCostBasisPct}% has no entry price, so it can’t be valued`}
          {(actual.unpricedPct > 0 || actual.noCostBasisPct > 0) && ')'}.
          {actual.noCostBasisPct > 0 && ' Add entry prices on the Portfolios page to include those positions.'}
        </p>
      )}

      {/* Drift table */}
      {drift && (
        <>
          {/* Real money (T-453, D208): the not-advice line sits beside the figures. */}
          {usingTracked && <FeatureNotice feature="portfolioBuilder" />}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className={clsx('flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-medium border',
              drift.rebalanceDue
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>
              {drift.rebalanceDue ? <AlertTriangle size={11} aria-hidden /> : <CheckCircle2 size={11} aria-hidden />}
              {drift.rebalanceDue ? 'Rebalance due' : 'Within bands'}
            </span>
            <span className="text-text-muted">
              Largest drift <span className="font-mono tabular-nums text-text-secondary">{drift.maxDriftPts.toFixed(1)} pts</span>
              {' '}against a ±{saved.plan.driftBandPct}% band
            </span>
            {drift.turnoverUsd > 0 && (
              <span className="text-text-muted">
                Turnover to correct <span className="font-mono tabular-nums text-text-secondary">{fmtUsd(drift.turnoverUsd)}</span>
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                  <th className="text-left font-medium py-1.5">Holding</th>
                  <th className="text-right font-medium py-1.5">Target</th>
                  <th className="text-right font-medium py-1.5">Actual</th>
                  <th className="text-right font-medium py-1.5">Drift</th>
                  <th className="text-right font-medium py-1.5">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {drift.items.map((i) => (
                  <tr key={i.symbol}>
                    <td className="py-1.5">
                      <span className="font-mono font-semibold text-text-primary">{i.symbol}</span>
                      <span className="ml-2 text-text-muted hidden sm:inline">{i.name}</span>
                    </td>
                    <td className="text-right font-mono tabular-nums text-text-muted py-1.5">{i.targetPct.toFixed(1)}%</td>
                    <td className="text-right font-mono tabular-nums text-text-secondary py-1.5">{i.currentPct.toFixed(1)}%</td>
                    <td className={clsx('text-right font-mono tabular-nums py-1.5',
                      i.action === 'hold' ? 'text-text-muted' : i.driftPts > 0 ? 'text-orange-400' : 'text-accent-blue')}>
                      {i.driftPts > 0 ? '+' : ''}{i.driftPts.toFixed(1)}
                    </td>
                    <td className="text-right py-1.5">
                      {i.action === 'hold' ? (
                        <span className="inline-flex items-center gap-1 text-text-muted"><Minus size={11} aria-hidden /> hold</span>
                      ) : (
                        <span className={clsx('inline-flex items-center gap-1 font-mono tabular-nums font-medium',
                          i.action === 'sell' ? 'text-orange-400' : 'text-emerald-400')}>
                          {i.action === 'sell'
                            ? <ArrowDownRight size={11} aria-hidden />
                            : <ArrowUpRight size={11} aria-hidden />}
                          {i.action === 'sell' ? 'Sell' : 'Buy'} {fmtUsd(Math.abs(i.tradeUsd))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {drift.unplanned.length > 0 && (
            <p className="text-xs text-text-muted">
              Held but not in this plan:{' '}
              {drift.unplanned.map((u) => `${u.symbol} ${u.currentPct.toFixed(1)}%`).join(', ')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => saveCheck.mutate()}
              disabled={!checkUsable || saveCheck.isPending}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-bg-card px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-accent-blue/50 hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={12} aria-hidden /> {saveCheck.isPending ? 'Saving…' : 'Save this check'}
            </button>
            <button
              onClick={printRebalanceNotes}
              disabled={!checkUsable}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-bg-card px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-accent-blue/50 hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer size={12} aria-hidden /> Print rebalance notes
            </button>
            <span className="text-[11px] text-text-muted">
              {checkUsable
                ? 'Saving keeps these figures in the plan’s history. The notes print the table above, with what it was compared with.'
                : 'Weights must total 100% before this check can be saved or printed.'}
            </span>
          </div>
        </>
      )}

      {printNotes && <RebalanceNotesPrint notes={printNotes} onDone={() => setPrintNotes(null)} />}

      {/* Plan history (T-065) */}
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
          <History size={12} aria-hidden /> History
        </h3>
        {historyQuery.isLoading ? (
          <p className="text-xs text-text-muted">Loading saved checks…</p>
        ) : historyQuery.isError ? (
          <p className="text-xs text-amber-400">{(historyQuery.error as Error).message}</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-text-muted">
            No saved checks yet. Save a check to start a record of how far this plan drifts over time, and
            when it comes back within its bands.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                    <th className="text-left font-medium py-1.5">Saved</th>
                    <th className="text-left font-medium py-1.5">Compared with</th>
                    <th className="text-right font-medium py-1.5">Largest drift</th>
                    <th className="text-left font-medium py-1.5 pl-4">Status</th>
                    <th className="text-right font-medium py-1.5">Turnover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(showAllHistory ? history : history.slice(0, HISTORY_SHOWN)).map((e) => (
                    <tr key={e.id}>
                      <td className="py-1.5 text-text-secondary">
                        {new Date(e.capturedAt).toLocaleDateString()}
                        <span className="ml-1.5 text-text-muted">
                          {new Date(e.capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-1.5 text-text-muted">{e.snapshot.portfolioName ?? 'Entered weights'}</td>
                      <td className="text-right font-mono tabular-nums text-text-secondary py-1.5">
                        {e.snapshot.maxDriftPts.toFixed(1)} pts
                        {e.maxDriftChangePts !== null && e.maxDriftChangePts !== 0 && (
                          <span className="ml-1 text-text-muted">
                            ({e.maxDriftChangePts > 0 ? '+' : ''}{e.maxDriftChangePts.toFixed(1)})
                          </span>
                        )}
                      </td>
                      <td className={clsx('py-1.5 pl-4', e.snapshot.rebalanceDue ? 'text-amber-400' : 'text-emerald-400')}>
                        {e.snapshot.rebalanceDue ? 'Rebalance due' : e.backWithinBands ? 'Back within bands' : 'Within bands'}
                      </td>
                      <td className="text-right font-mono tabular-nums text-text-muted py-1.5">
                        {e.snapshot.turnoverUsd > 0 ? fmtUsd(e.snapshot.turnoverUsd) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-text-muted">
              Each row is a check you saved: the largest drift from target, against a ±{saved.plan.driftBandPct}%
              band, with the change since the check before it in brackets.
              {history.length > HISTORY_SHOWN && (
                <>
                  {' '}
                  <button onClick={() => setShowAllHistory((v) => !v)} className="text-accent-blue hover:underline">
                    {showAllHistory ? 'Show the latest only' : `Show all ${history.length}`}
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>

      {/* Suitability findings */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Suitability review</h3>
        {findings.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 size={13} aria-hidden />
            Nothing to flag{actual ? '' : ' from the plan alone — link a portfolio to check risk drift, fees, and concentration'}.
          </p>
        ) : findings.map((f) => (
          <div key={f.id} className="flex items-start gap-2 text-xs leading-relaxed">
            {f.level === 'warn'
              ? <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" aria-hidden />
              : <Info size={13} className="text-accent-blue shrink-0 mt-0.5" aria-hidden />}
            <span>
              <span className="font-medium text-text-primary">{f.title}.</span>{' '}
              <span className="text-text-secondary">{f.message}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
