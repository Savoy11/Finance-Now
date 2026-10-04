'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { RebalanceNotes } from '@/lib/data/rebalanceNotes'

// Printable rebalance notes (T-066). Mounted only for the length of one print:
// it renders into a portal on <body>, marks <html> with data-print, and asks the
// browser to print. globals.css hides everything else on the page while that
// mark is set, and hides this portal on screen at all times. No file is made or
// downloaded; the browser's own print dialog decides between paper and PDF.

function usd(n: number) {
  return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
}

/** The printed sheet itself: plain markup, black on white, no effects. */
export function RebalanceNotesSheet({ notes }: { notes: RebalanceNotes }) {
  const prepared = new Date(notes.preparedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <div className="bg-white p-8 font-sans text-[12px] leading-relaxed text-black">
      <h1 className="text-xl font-semibold">{notes.title}</h1>
      <p className="mt-1 text-[13px]">{notes.planName}</p>
      <p className="mt-1 text-gray-700">Prepared {prepared}</p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-gray-700">Compared with</dt>
        <dd>{notes.comparedWith}</dd>
        <dt className="text-gray-700">Value used</dt>
        <dd>
          {usd(notes.valueUsd)}
          {notes.pricedPct < 99 && ` (only ${notes.pricedPct}% of the portfolio could be valued; the rest is left out)`}
        </dd>
        <dt className="text-gray-700">Band</dt>
        <dd>±{notes.bandPct}% for each holding</dd>
      </dl>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-400 text-left">
            <th className="py-1 pr-3 font-semibold">Holding</th>
            <th className="py-1 pr-3 text-right font-semibold">Target</th>
            <th className="py-1 pr-3 text-right font-semibold">Actual</th>
            <th className="py-1 pr-3 text-right font-semibold">Drift</th>
            <th className="py-1 text-right font-semibold">Trade to target</th>
          </tr>
        </thead>
        <tbody>
          {notes.rows.map((r) => (
            <tr key={r.symbol} className="border-b border-gray-200">
              <td className="py-1 pr-3"><span className="font-semibold">{r.symbol}</span> <span className="text-gray-700">{r.name}</span></td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.targetPct.toFixed(1)}%</td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.currentPct.toFixed(1)}%</td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.driftPts > 0 ? '+' : ''}{r.driftPts.toFixed(1)} pts</td>
              <td className="py-1 text-right tabular-nums">
                {r.action === 'hold' ? 'within band' : `${r.action === 'sell' ? 'Sell' : 'Buy'} ${usd(r.tradeUsd)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {notes.tradeCount > 0 && (
        <p className="mt-3">
          Buys {usd(notes.buysUsd)} · Sells {usd(notes.sellsUsd)} · Total traded {usd(notes.turnoverUsd)}
        </p>
      )}
      {notes.unplanned.length > 0 && (
        <p className="mt-2">
          Held but not in this plan: {notes.unplanned.map((u) => `${u.symbol} ${u.currentPct.toFixed(1)}%`).join(', ')}
        </p>
      )}

      <p className="mt-5 border-t border-gray-300 pt-3 text-gray-700">{notes.note}</p>
    </div>
  )
}

export function RebalanceNotesPrint({ notes, onDone }: { notes: RebalanceNotes; onDone: () => void }) {
  // Held in a ref so a parent re-render never re-runs the print effect, which
  // would open the dialog a second time.
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })

  useEffect(() => {
    const root = document.documentElement
    root.dataset.print = 'rebalance-notes'
    const finish = () => {
      delete root.dataset.print
      done.current()
    }
    window.addEventListener('afterprint', finish, { once: true })
    // One frame first, so the portal is on the page when the dialog snapshots it.
    const frame = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', finish)
      delete root.dataset.print
    }
  }, [])

  return createPortal(
    <div className="rebalance-print">
      <RebalanceNotesSheet notes={notes} />
    </div>,
    document.body,
  )
}
