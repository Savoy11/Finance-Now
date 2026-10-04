'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { SourceLine } from '@/components/ui/SourceLine'
import { STALE_TIME_SHORT } from '@/lib/constants'
import { isSecurityKey } from '@/lib/data/instruments'
import { fetchInstrumentPrices } from '@/lib/api/instrumentPrices'
import { retryUnlessAnswered, trackedApi, type TradeInput, type TrackedPortfolioSummary } from '@/lib/api/trackedPortfolios'
import {
  MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, formatUsd, formatUsdChange, valueLedger,
} from '@/lib/data/tradeLedger'
import { HoldingsTable } from './HoldingsTable'
import { TradeForm } from './TradeForm'
import { TradesTable } from './TradesTable'

// One tracked portfolio (T-027, owner decision D65): what is held and what it
// cost, what it is worth at live prices, the FIFO gains, the form for recording
// a trade, and every trade recorded. Cost and gains come from the server's
// ledger view; live prices are applied here, and a holding with no live price
// is left out of the totals, never valued at its cost.

export const TRACKED_LIST_KEY = ['tracked-portfolios'] as const

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

const isZero = (usd: string) => formatUsd(usd) === '$0.00'
const toneCls = (usd: string) => (isZero(usd) ? 'text-text-primary' : usd.startsWith('-') ? 'text-red-400' : 'text-emerald-400')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const inputCls = 'w-full bg-bg-elevated border border-border rounded px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue'

function Tile({ label, value, valueCls, children }: {
  label: string
  value: string
  valueCls?: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 min-w-0">
      <div className="text-[11px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={clsx('text-xl font-semibold font-mono mt-1 break-words', valueCls ?? 'text-text-primary')}>{value}</div>
      {children && <div className="text-[11px] text-text-muted mt-1 leading-snug">{children}</div>}
    </div>
  )
}

export function TrackedPortfolioDetail({ portfolio, onBack }: {
  portfolio: TrackedPortfolioSummary
  onBack: () => void
}) {
  const uid = useId()
  const qc = useQueryClient()
  const ledgerKey = ['tracked-ledger', portfolio.id]

  const ledger = useQuery({
    queryKey: ledgerKey,
    queryFn: () => trackedApi.ledger(portfolio.id),
    retry: retryUnlessAnswered,
  })
  const view = ledger.data?.view
  const details = ledger.data?.portfolio ?? portfolio

  // Live prices for what is still held; a holding sold to nothing needs none.
  const heldKeys = useMemo(
    () => (view?.holdings ?? []).filter((h) => h.basis.quantityHeld !== '0').map((h) => h.instrumentKey).sort(),
    [view],
  )
  const prices = useQuery({
    queryKey: ['tracked-prices', heldKeys.join(',')],
    queryFn: () => fetchInstrumentPrices(heldKeys),
    enabled: heldKeys.length > 0,
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 60_000,
  })
  const pricesPending = heldKeys.length > 0 && prices.isPending
  const valued = useMemo(() => (view ? valueLedger(view, prices.data?.prices ?? {}) : null), [view, prices.data])

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'details' | 'remove' | 'trade' | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ledgerKey }),
      qc.invalidateQueries({ queryKey: TRACKED_LIST_KEY }),
    ])
  }

  async function addTrade(trade: TradeInput): Promise<string | null> {
    setBusy('trade')
    try {
      await trackedApi.addTrade(portfolio.id, trade)
      await refresh()
      toast.success('Trade saved')
      return null
    } catch (e) {
      return errorText(e, 'The trade was not saved.')
    } finally {
      setBusy(null)
    }
  }

  async function cancelTrade(tradeId: string, reason: string): Promise<string | null> {
    setCancellingId(tradeId)
    try {
      await trackedApi.cancelTrade(portfolio.id, tradeId, reason)
      await refresh()
      toast.success('Trade cancelled')
      return null
    } catch (e) {
      return errorText(e, 'The trade was not cancelled.')
    } finally {
      setCancellingId(null)
    }
  }

  function startEditing() {
    setName(details.name)
    setDescription(details.description)
    setDetailsError(null)
    setEditing(true)
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setDetailsError('A portfolio needs a name.'); return }
    setBusy('details')
    try {
      await trackedApi.update(portfolio.id, { name: name.trim(), description: description.trim() })
      await refresh()
      setEditing(false)
    } catch (err) {
      setDetailsError(errorText(err, 'The changes were not saved.'))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!confirm(`Remove "${details.name}" and every trade recorded in it? This cannot be undone.`)) return
    setBusy('remove')
    try {
      await trackedApi.remove(portfolio.id)
      await qc.invalidateQueries({ queryKey: TRACKED_LIST_KEY })
      toast.success('Tracked portfolio removed')
      onBack()
    } catch (err) {
      toast.error(errorText(err, 'The portfolio was not removed.'))
      setBusy(null)
    }
  }

  const totals = valued?.totals
  const unpricedSecurities = !!valued?.holdings.some((h) => h.quantityHeld !== '0' && h.valueUsd === null && isSecurityKey(h.instrumentKey))

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={14} aria-hidden /> All tracked portfolios
      </button>

      {editing ? (
        <form onSubmit={saveDetails} className="bg-bg-card border border-border rounded-xl p-4 space-y-3" aria-label="Rename this portfolio">
          <div>
            <label htmlFor={`${uid}-name`} className="block text-xs text-text-muted mb-1 font-medium">Name</label>
            <input id={`${uid}-name`} className={inputCls} maxLength={MAX_NAME_LENGTH} autoFocus
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${uid}-description`} className="block text-xs text-text-muted mb-1 font-medium">Description (optional)</label>
            <input id={`${uid}-description`} className={inputCls} maxLength={MAX_DESCRIPTION_LENGTH}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {detailsError && <p className="text-xs text-red-400" role="alert">{detailsError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">Cancel</button>
            <button type="submit" disabled={busy === 'details'}
              className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
              {busy === 'details' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-text-primary break-words">{details.name}</h2>
            {details.description && <p className="text-sm text-text-muted mt-1 break-words">{details.description}</p>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button type="button" onClick={startEditing} aria-label="Rename this portfolio" title="Rename"
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
              <Edit2 size={15} aria-hidden />
            </button>
            <button type="button" onClick={() => void remove()} disabled={busy === 'remove'}
              aria-label="Remove this portfolio and its trades" title="Remove"
              className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-bg-elevated disabled:opacity-50 transition-colors">
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {ledger.isPending && <p className="text-xs text-text-muted">Loading trades…</p>}
      {ledger.isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3" role="alert">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-text-secondary leading-relaxed">{errorText(ledger.error, 'The trades could not be loaded.')}</p>
        </div>
      )}

      {view && valued && totals && (
        <>
          {/* One column on a phone: a dollar figure is never cut short. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Cost of holdings" value={formatUsd(totals.costHeldUsd)}>
              {totals.heldCount === 0 ? 'Nothing held' : `${plural(totals.heldCount, 'holding')}, fees included`}
            </Tile>
            <Tile label="Value now"
              value={totals.heldCount === 0 ? '$0.00' : totals.pricedCount > 0 ? formatUsd(totals.valueUsd) : '—'}>
              {totals.heldCount === 0 ? 'Nothing held'
                : pricesPending ? 'Fetching live prices…'
                : totals.pricedCount === totals.heldCount ? 'At live prices'
                : `${totals.pricedCount} of ${plural(totals.heldCount, 'holding')} priced`}
            </Tile>
            <Tile label="Unrealized"
              value={totals.heldCount === 0 ? '$0.00' : totals.pricedCount > 0 ? formatUsdChange(totals.unrealizedUsd) : '—'}
              valueCls={totals.pricedCount > 0 ? toneCls(totals.unrealizedUsd) : undefined}>
              {totals.pricedCount > 0 && totals.pricedCount < totals.heldCount
                ? 'Priced holdings only: value now less what they cost'
                : 'Value now less what the holdings cost'}
            </Tile>
            <Tile label="Realized" value={formatUsdChange(totals.realizedGainUsd)} valueCls={toneCls(totals.realizedGainUsd)}>
              On units sold. {view.methodLabel}.
              {!isZero(totals.realizedFromStartingPositionUsd) && (
                <> {formatUsdChange(totals.realizedFromStartingPositionUsd)} of it from starting positions.</>
              )}
            </Tile>
          </div>

          {!pricesPending && totals.unpriced.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-text-secondary leading-relaxed">
                No live price right now for {totals.unpriced.join(', ')}, so {totals.unpriced.length === 1 ? 'it is' : 'they are'} left
                out of Value now and Unrealized. A holding is never valued at its cost.
                {unpricedSecurities && (
                  <> Stock and fund prices need a market data key: see <Link href="/settings" className="text-accent-blue hover:underline">Integrations</Link>.</>
                )}
              </p>
            </div>
          )}

          <SourceLine id="tracked-portfolios" asOf={prices.data?.updatedAt} />

          <section className="space-y-2" aria-labelledby={`${uid}-holdings`}>
            <h3 id={`${uid}-holdings`} className="text-sm font-semibold text-text-primary">Holdings</h3>
            <HoldingsTable holdings={valued.holdings} methodLabel={view.methodLabel} />
          </section>

          <TradeForm view={view} onSubmit={addTrade} busy={busy === 'trade'} />

          <section className="space-y-2" aria-labelledby={`${uid}-trades`}>
            <h3 id={`${uid}-trades`} className="text-sm font-semibold text-text-primary">
              Trades <span className="text-text-muted font-normal">({view.trades.length})</span>
            </h3>
            <TradesTable trades={view.trades} onCancel={cancelTrade} busyId={cancellingId} />
          </section>

          <p className="text-[11px] text-text-muted leading-relaxed">
            Gains here are plain differences between what was paid and what was received, for your own records.
            They are not adjusted for tax rules and are not tax figures.
          </p>
        </>
      )}
    </div>
  )
}
