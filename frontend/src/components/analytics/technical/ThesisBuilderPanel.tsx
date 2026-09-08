'use client'

import { useState } from 'react'
import { PenLine, Trash2, Target, ShieldAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { useThesisStore, computeRiskReward } from '@/store/useThesisStore'

// ─── Thesis Builder (save chart setups) ─────────────────────────────────────────

export function ThesisBuilderPanel({ assetId, symbol, range, price, signal }: {
  assetId: string; symbol: string; range: string; price: number | null; signal: string | null
}) {
  const { theses, addThesis, removeThesis } = useThesisStore()
  const [open, setOpen] = useState(false)
  const [entryThesis, setEntryThesis] = useState('')
  const [target, setTarget] = useState('')
  const [invalidation, setInvalidation] = useState('')
  const [notes, setNotes] = useState('')

  const rr = price != null ? computeRiskReward(String(price), target, invalidation) : null
  const canSave = entryThesis.trim().length > 0

  function save() {
    if (!canSave) return
    addThesis({ assetId, symbol, range, priceAtSave: price, signalAtSave: signal, entryThesis: entryThesis.trim(), target: target.trim(), invalidation: invalidation.trim(), notes: notes.trim() })
    setEntryThesis(''); setTarget(''); setInvalidation(''); setNotes(''); setOpen(false)
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Chart Notes / Thesis</span>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-bg-elevated transition-colors"
        >
          <PenLine size={12} /> {open ? 'Cancel' : `New thesis for ${symbol}`}
        </button>
      </div>

      {open && (
        <div className="rounded-lg border border-border bg-bg-elevated/40 p-3 flex flex-col gap-2.5">
          <div className="text-[10px] text-text-muted">
            Snapshot: {symbol} · {range} · {price != null ? '$' + price.toLocaleString(undefined, { maximumFractionDigits: price > 100 ? 2 : 4 }) : 'n/a'} · signal {signal ?? 'n/a'}
          </div>
          <textarea
            value={entryThesis} onChange={e => setEntryThesis(e.target.value)}
            placeholder="Entry thesis — why this setup? (required)"
            rows={2}
            className="w-full text-xs bg-bg-card border border-border rounded px-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target (e.g. 75000)" className="text-xs bg-bg-card border border-border rounded px-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue" />
            <input value={invalidation} onChange={e => setInvalidation(e.target.value)} placeholder="Invalidation (e.g. 58000)" className="text-xs bg-bg-card border border-border rounded px-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue" />
          </div>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs bg-bg-card border border-border rounded px-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {rr != null ? <>Risk/Reward <span className={clsx('font-semibold', rr >= 2 ? 'text-emerald-400' : rr >= 1 ? 'text-amber-400' : 'text-red-400')}>{rr.toFixed(2)}:1</span></> : 'Enter numeric target + invalidation for R/R'}
            </span>
            <button
              onClick={save} disabled={!canSave}
              className="px-3 py-1.5 rounded-lg bg-accent-blue text-white text-xs font-medium disabled:opacity-40 hover:bg-blue-600 transition-colors"
            >
              Save thesis
            </button>
          </div>
        </div>
      )}

      {theses.length === 0 ? (
        <p className="text-[11px] text-text-muted text-center py-2">No saved theses yet. Saved locally in your browser.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {theses.map((t) => {
            const tRr = computeRiskReward(String(t.priceAtSave ?? ''), t.target, t.invalidation)
            return (
              <div key={t.id} className="rounded-lg border border-border bg-bg-elevated/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-xs text-text-primary">{t.symbol}</span>
                    <span className="text-[10px] text-text-muted">{t.range}</span>
                    {t.priceAtSave != null && <span className="text-[10px] text-text-muted">@ ${t.priceAtSave.toLocaleString(undefined, { maximumFractionDigits: t.priceAtSave > 100 ? 2 : 4 })}</span>}
                    {tRr != null && <span className={clsx('text-[10px] font-semibold', tRr >= 2 ? 'text-emerald-400' : tRr >= 1 ? 'text-amber-400' : 'text-red-400')}>{tRr.toFixed(1)}:1</span>}
                  </div>
                  <button onClick={() => removeThesis(t.id)} className="text-text-muted hover:text-red-400 transition-colors shrink-0" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-[11px] text-text-secondary mt-1">{t.entryThesis}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-text-muted">
                  {t.target && <span><Target size={9} className="inline mb-0.5 text-emerald-400" /> {t.target}</span>}
                  {t.invalidation && <span><ShieldAlert size={9} className="inline mb-0.5 text-amber-400" /> {t.invalidation}</span>}
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                {t.notes && <p className="text-[10px] text-text-muted italic mt-1">{t.notes}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
