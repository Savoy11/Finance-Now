'use client'

import { useId, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import { CLASS_LABELS } from '@/lib/data/instruments'
import { TRACKABLE_CLASSES, formatUnits, parseTradeInput, type LedgerView } from '@/lib/data/tradeLedger'
import { useInstrumentSearch, type InstrumentCandidate } from '@/components/portfolio/useInstrumentSearch'
import type { TradeInput } from '@/lib/api/trackedPortfolios'

// The form for recording one trade in a tracked portfolio (T-027, D65), or a
// split (T-421). It checks the entry with the same rules the server applies
// (parseTradeInput) before sending it, so a mistake is explained here rather
// than after a round trip, and the server still checks it again.

type Kind = 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'starting' | 'split'

const KINDS: Array<{ id: Kind; label: string; hint: string }> = [
  { id: 'buy', label: 'Buy', hint: 'Units bought, at the price paid per unit. The fee is added to their cost.' },
  { id: 'sell', label: 'Sell', hint: 'Units sold, at the price received per unit. The fee comes off what you received. FIFO sells your oldest units first.' },
  { id: 'starting', label: 'Starting position', hint: 'What you already owned before you began recording: how many, and the average price you paid. It counts as your oldest units, so it is sold first.' },
  { id: 'transfer_in', label: 'Transfer in', hint: 'Units moved in from elsewhere, carrying the cost you paid for them.' },
  { id: 'transfer_out', label: 'Transfer out', hint: 'Units moved out without being sold. Their cost leaves with them; there is no gain or loss.' },
  { id: 'split', label: 'Split', hint: 'A split or reverse split: how many units you have after it for every so many before, such as 2 for 1, or 1 for 10. Every unit held before its date is changed by that ratio and keeps its cost, so the cost per unit changes.' },
]

/** Today on the reader's own calendar, as the date input writes it. */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inputCls = 'w-full bg-bg-elevated border border-border rounded-sm px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent-blue'
const labelCls = 'block text-xs text-text-muted mb-1 font-medium'

export function TradeForm({ view, onSubmit, busy }: {
  view: LedgerView
  /** Saves the trade; resolves to the server's reason if it refused, or null once saved. */
  onSubmit: (trade: TradeInput) => Promise<string | null>
  busy: boolean
}) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [instrument, setInstrument] = useState<InstrumentCandidate | null>(null)
  const [kind, setKind] = useState<Kind>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('')
  const [unitsAfter, setUnitsAfter] = useState('')
  const [unitsBefore, setUnitsBefore] = useState('')
  const [cash, setCash] = useState('')
  const [date, setDate] = useState(localToday)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const results = useInstrumentSearch(instrument ? '' : query, { classes: TRACKABLE_CLASSES })

  // What the screen already knows about the chosen holding: units held, and
  // whether it has a starting position (a second one is refused).
  const holding = useMemo(
    () => (instrument ? view.holdings.find((h) => h.instrumentKey === instrument.key) : undefined),
    [instrument, view.holdings],
  )
  const hasStartingPosition = useMemo(
    () => !!instrument && view.trades.some((t) => t.instrumentKey === instrument.key && t.opening && !t.cancelled),
    [instrument, view.trades],
  )

  const starting = kind === 'starting'
  const isSplit = kind === 'split'
  const needsPrice = kind !== 'transfer_out' && !isSplit
  const showsFee = !starting && !isSplit
  const priceLabel = starting ? 'Average price paid per unit (USD)'
    : kind === 'sell' ? 'Price received per unit (USD)'
    : kind === 'transfer_in' ? 'Cost per unit you paid (USD)'
    : 'Price paid per unit (USD)'

  // A starting position's date is often unknown, so today's date is not filled
  // in for it; switching back to a dated kind puts today back.
  function pickKind(next: Kind) {
    const today = localToday()
    if (next === 'starting' && date === today) setDate('')
    if (next !== 'starting' && !date) setDate(today)
    setKind(next)
  }

  function choose(c: InstrumentCandidate) {
    setInstrument(c)
    setQuery('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!instrument) { setError('Choose what was traded first.'); return }
    if (starting && hasStartingPosition) { setError('This holding already has a starting position. Cancel that one first if it is wrong.'); return }
    // A split is a ratio, not an amount: it sends no units, price or fee.
    const trade: TradeInput = isSplit
      ? {
        instrument: instrument.key,
        name: instrument.name,
        side: 'split',
        unitsAfter: unitsAfter.trim(),
        unitsBefore: unitsBefore.trim(),
        ...(cash.trim() ? { cashInLieuUsd: cash.trim() } : {}),
        ...(date ? { executedAt: date } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }
      : {
        instrument: instrument.key,
        name: instrument.name,
        side: starting ? 'transfer_in' : kind,
        opening: starting,
        quantity: quantity.trim(),
        pricePerUnit: needsPrice ? price.trim() : '0',
        ...(showsFee && fee.trim() ? { feeUsd: fee.trim() } : {}),
        ...(date ? { executedAt: date } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }
    // The server's own rules, checked here first.
    const checked = parseTradeInput(trade)
    if (!checked.ok) { setError(checked.error); return }
    setError(null)
    const refused = await onSubmit(trade)
    if (refused) { setError(refused); return }
    setQuantity('')
    setPrice('')
    setFee('')
    setUnitsAfter('')
    setUnitsBefore('')
    setCash('')
    setNote('')
    if (starting) pickKind('buy')
  }

  return (
    <form onSubmit={submit} className="bg-bg-card border border-border rounded-xl p-5 space-y-4" aria-label="Record a trade">
      <h3 className="text-sm font-semibold text-text-primary">Record a trade</h3>

      {/* What was traded */}
      <div>
        <span className={labelCls} id={`${uid}-instrument`}>What was traded</span>
        {instrument ? (
          <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-text-primary">{instrument.symbol}</span>
            <span className="text-xs text-text-muted truncate">{instrument.name}</span>
            <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded-sm bg-bg-card border border-border">{CLASS_LABELS[instrument.class]}</span>
            {holding && holding.basis.quantityHeld !== '0' && (
              <span className="text-xs text-text-secondary ml-auto whitespace-nowrap">You hold {formatUnits(holding.basis.quantityHeld)}</span>
            )}
            <button type="button" onClick={() => setInstrument(null)}
              className={clsx('p-1 text-text-muted hover:text-text-primary rounded-sm', !holding && 'ml-auto')}
              aria-label={`Change from ${instrument.symbol}`}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
              <input className={clsx(inputCls, 'pl-8 py-2')} aria-labelledby={`${uid}-instrument`}
                placeholder="Search for a coin, stock, ETF or fund…"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {query.trim().length > 0 && (
              <div className="mt-1 border border-border rounded-lg overflow-hidden divide-y divide-border/50 max-h-48 overflow-y-auto">
                {results.length === 0
                  ? <div className="py-3 text-center text-xs text-text-muted">No coin, stock, ETF or fund matches. Commodities, currencies and rates cannot be tracked.</div>
                  : results.map((c) => (
                    <button type="button" key={c.key} onClick={() => choose(c)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors text-left">
                      <span className="text-xs font-semibold text-text-primary">{c.symbol}</span>
                      <span className="text-xs text-text-muted truncate flex-1">{c.name}</span>
                      <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded-sm bg-bg-card border border-border">{CLASS_LABELS[c.class]}</span>
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Kind */}
      <fieldset>
        <legend className={labelCls}>Kind of trade</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const disabled = k.id === 'starting' && hasStartingPosition
            return (
              <button type="button" key={k.id} disabled={disabled} onClick={() => pickKind(k.id)}
                aria-pressed={kind === k.id}
                title={disabled ? 'This holding already has a starting position.' : undefined}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  kind === k.id ? 'bg-accent-blue/15 border-accent-blue text-text-primary' : 'border-border text-text-secondary hover:text-text-primary',
                  disabled && 'opacity-40 cursor-not-allowed')}>
                {k.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-text-muted mt-2 leading-relaxed">{KINDS.find((k) => k.id === kind)!.hint}</p>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isSplit ? (
          <>
            <div>
              <span className={labelCls} id={`${uid}-ratio`}>Ratio</span>
              <div className="flex items-center gap-2" role="group" aria-labelledby={`${uid}-ratio`}>
                <input className={inputCls} inputMode="numeric" placeholder="2" aria-label="Units after the split"
                  value={unitsAfter} onChange={(e) => setUnitsAfter(e.target.value)} />
                <span className="text-xs text-text-muted whitespace-nowrap">for every</span>
                <input className={inputCls} inputMode="numeric" placeholder="1" aria-label="Units before the split"
                  value={unitsBefore} onChange={(e) => setUnitsBefore(e.target.value)} />
              </div>
              <p className="text-[11px] text-text-muted mt-1">Units after, for every so many before: 2 for 1 doubles them, 1 for 10 is a reverse split.</p>
            </div>
            <div>
              <label className={labelCls} htmlFor={`${uid}-cash`}>Cash for a fraction (USD, optional)</label>
              <input id={`${uid}-cash`} className={inputCls} inputMode="decimal" placeholder="0.00"
                value={cash} onChange={(e) => setCash(e.target.value)} />
              <p className="text-[11px] text-text-muted mt-1">If your broker paid cash instead of a fraction of a unit, enter it. The fraction counts as sold for that amount.</p>
            </div>
          </>
        ) : (
          <div>
            <label className={labelCls} htmlFor={`${uid}-qty`}>Units</label>
            <input id={`${uid}-qty`} className={inputCls} inputMode="decimal" placeholder="e.g. 10 or 0.25"
              value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        )}
        {needsPrice && (
          <div>
            <label className={labelCls} htmlFor={`${uid}-price`}>{priceLabel}</label>
            <input id={`${uid}-price`} className={inputCls} inputMode="decimal" placeholder="e.g. 250.40"
              value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        )}
        {showsFee && (
          <div>
            <label className={labelCls} htmlFor={`${uid}-fee`}>Fee (USD, optional)</label>
            <input id={`${uid}-fee`} className={inputCls} inputMode="decimal" placeholder="0.00"
              value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor={`${uid}-date`}>{starting ? 'Date bought (optional)' : isSplit ? 'Date it took effect' : 'Date'}</label>
          <input id={`${uid}-date`} type="date" className={inputCls} max={localToday()}
            value={date} onChange={(e) => setDate(e.target.value)} />
          {starting && <p className="text-[11px] text-text-muted mt-1">Leave it blank if you don&apos;t know it. A starting position counts as your oldest units either way.</p>}
          {isSplit && <p className="text-[11px] text-text-muted mt-1">The first day the units traded at the new price. Trades on that day are already in the new units.</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor={`${uid}-note`}>Note (optional)</label>
          <input id={`${uid}-note`} className={inputCls} placeholder="e.g. monthly purchase"
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={busy}
          className="px-4 py-2 bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
          {busy ? 'Saving…' : isSplit ? 'Save split' : 'Save trade'}
        </button>
      </div>
    </form>
  )
}
