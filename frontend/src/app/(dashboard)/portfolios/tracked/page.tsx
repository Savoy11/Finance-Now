'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, ReceiptText } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TRACKED_LIST_KEY, TrackedPortfolioDetail } from '@/components/portfolio/tracked/TrackedPortfolioDetail'
import { formatRecordedDate } from '@/components/portfolio/tracked/TradesTable'
import { retryUnlessAnswered, trackedApi, TrackedApiError } from '@/lib/api/trackedPortfolios'
import { REALIZED_METHOD_LABEL } from '@/lib/data/costBasis'
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '@/lib/data/tradeLedger'

// Tracked portfolios (T-027, owner decision D65): records of real trades, kept
// apart from the what-if portfolios on /portfolios, which are never converted.
// This page lists them and makes new ones; one opens in TrackedPortfolioDetail.

const inputCls = 'w-full bg-bg-elevated border border-border rounded px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue'

export default function TrackedPortfoliosPage() {
  const uid = useId()
  const qc = useQueryClient()
  const list = useQuery({ queryKey: TRACKED_LIST_KEY, queryFn: () => trackedApi.list(), retry: retryUnlessAnswered })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = list.data?.find((p) => p.id === selectedId) ?? null
  // A 503 means the database is missing or behind; its message says what to run.
  const setupError = list.error instanceof TrackedApiError && list.error.needsSetup ? list.error : null

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setCreateError('A portfolio needs a name.'); return }
    setSaving(true)
    try {
      const made = await trackedApi.create({ name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) })
      await qc.invalidateQueries({ queryKey: TRACKED_LIST_KEY })
      setName('')
      setDescription('')
      setCreateError(null)
      setCreating(false)
      setSelectedId(made.id)
    } catch (err) {
      setCreateError(err instanceof Error && err.message ? err.message : 'The portfolio was not created.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Tracked portfolios"
          icon={<ReceiptText size={20} aria-hidden />}
          subtitle="Record what you bought and sold, and see what it cost and what it gained"
          description="A tracked portfolio keeps a record of real trades: buys, sells, transfers, and one starting position for anything you already owned. It works out what your holdings cost and the gain or loss on what you sold, oldest units first, and values what you hold at live prices."
          details={[
            { label: 'Method', text: `Realized gains: ${REALIZED_METHOD_LABEL}. Every tracked portfolio uses it.` },
            { label: 'Starting positions', text: 'Anything owned before you began recording is entered once per holding, as how many and the average price paid. It counts as your oldest units, so a sale uses it first. A gain on those units rests on the average price you entered, and the holdings table shows how much of each realized figure that is.' },
            { label: 'Corrections', text: 'A trade is never edited or removed. Cancel a mistake, which stays listed and counts for nothing, and record the right trade.' },
            { label: 'What can be tracked', text: 'Coins, stocks, ETFs and mutual funds. Commodities, currencies and rates cannot.' },
            { label: 'Not handled yet', text: 'Stock splits. After a split, units and prices here will not match your broker’s.' },
            { label: 'Live pricing', text: 'Value and unrealized gain use live prices: CoinGecko for coins, the keyed quote ladder for stocks and funds. A holding with no live price is left out of those totals, never valued at its cost.' },
            { label: 'Not tax figures', text: 'Gains are plain differences between what was paid and what was received, for your own records. They are not adjusted for tax rules.' },
            { label: 'Persistence', text: 'Saved to your account database through /api/user/tracked-portfolios.' },
          ]}
        />
        {!selected && !setupError && !creating && (
          <button type="button" onClick={() => setCreating(true)}
            className="px-4 py-2 bg-accent-blue hover:bg-blue-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors flex-shrink-0">
            <Plus size={16} aria-hidden /> New tracked portfolio
          </button>
        )}
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        What-if portfolios stay on <Link href="/portfolios" className="text-accent-blue hover:underline">Portfolios</Link>.
        They are separate from these and are never converted.
      </p>

      {setupError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3" role="alert">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div className="text-xs text-text-secondary leading-relaxed space-y-1">
            <p className="font-medium text-amber-300">Tracked portfolios can’t be used yet</p>
            <p>{setupError.message}</p>
          </div>
        </div>
      )}
      {list.isError && !setupError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3" role="alert">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-text-secondary leading-relaxed">
            {list.error instanceof Error && list.error.message ? list.error.message : 'Tracked portfolios could not be loaded.'}
          </p>
        </div>
      )}
      {list.isPending && <p className="text-xs text-text-muted">Loading tracked portfolios…</p>}

      {selected ? (
        <TrackedPortfolioDetail key={selected.id} portfolio={selected} onBack={() => setSelectedId(null)} />
      ) : list.data && (
        <>
          {creating && (
            <form onSubmit={create} className="bg-bg-card border border-border rounded-xl p-5 space-y-3" aria-label="New tracked portfolio">
              <h2 className="text-sm font-semibold text-text-primary">New tracked portfolio</h2>
              <div>
                <label htmlFor={`${uid}-name`} className="block text-xs text-text-muted mb-1 font-medium">Name</label>
                <input id={`${uid}-name`} className={inputCls} maxLength={MAX_NAME_LENGTH} autoFocus
                  placeholder="e.g. Brokerage account" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-description`} className="block text-xs text-text-muted mb-1 font-medium">Description (optional)</label>
                <input id={`${uid}-description`} className={inputCls} maxLength={MAX_DESCRIPTION_LENGTH}
                  value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {createError && <p className="text-xs text-red-400" role="alert">{createError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setCreating(false); setCreateError(null) }}
                  className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {list.data.length === 0 && !creating ? (
            <div className="text-center py-16">
              <ReceiptText size={44} className="mx-auto mb-4 text-text-muted opacity-30" aria-hidden />
              <p className="text-text-muted">No tracked portfolios yet.</p>
              <p className="text-sm text-text-muted mt-1">Make one, then enter what you already own as starting positions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.data.map((p) => (
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                  className="text-left bg-bg-card border border-border hover:border-border-hover rounded-xl p-4 transition-colors min-w-0">
                  <div className="font-semibold text-text-primary truncate">{p.name}</div>
                  {p.description && <div className="text-xs text-text-muted mt-1 line-clamp-2 break-words">{p.description}</div>}
                  <div className="text-[11px] text-text-muted mt-3">
                    {p.tradeCount} {p.tradeCount === 1 ? 'trade' : 'trades'} · started {formatRecordedDate(p.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
