'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { LEFT_OUT, ON_THIS_DEVICE } from '@/lib/data/userExport'

// "Your data" on the Settings page (T-452, D199): download a copy of everything the server keeps
// for your account. The draft Privacy Policy (§11) promises a copy on request; this lets anyone
// take it without asking. /api/user/export serves the signed-in account's own data only. Until
// sign-in is on (at launch), that is the owner's local account.

type Part = 'json' | 'trades' | 'holdings'

const PARTS: { part: Part; label: string; hint: string }[] = [
  { part: 'json', label: 'Everything (JSON)', hint: 'Every record kept for your account, in one file' },
  { part: 'trades', label: 'Trades (CSV)', hint: 'Your tracked portfolios’ trades, for a spreadsheet' },
  { part: 'holdings', label: 'Holdings (CSV)', hint: 'Your what-if portfolios’ holdings, for a spreadsheet' },
]

export function YourDataPanel() {
  const [busy, setBusy] = useState<Part | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(part: Part) {
    setBusy(part)
    setError(null)
    try {
      const res = await fetch(part === 'json' ? '/api/user/export' : `/api/user/export?part=${part}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? `The download did not work (HTTP ${res.status}).`)
        return
      }
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `finance-now-${part}`
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
    } catch {
      setError('The download did not work. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Download size={15} className="text-accent-blue" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-300">Your data</h2>
        <span className="text-xs text-slate-500">— download a copy of everything kept for your account</span>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PARTS.map(({ part, label, hint }) => (
            <button
              key={part}
              type="button"
              onClick={() => download(part)}
              disabled={busy !== null}
              title={hint}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:border-accent-blue hover:text-white disabled:opacity-50 transition-colors"
            >
              {busy === part ? 'Preparing…' : label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-amber-400" role="alert">{error}</p>}
        <ul className="text-[11px] text-slate-500 leading-relaxed list-disc pl-4 space-y-0.5">
          {LEFT_OUT.map((l) => <li key={l.what}><span className="text-slate-400">{l.what}:</span> {l.why}</li>)}
          <li>{ON_THIS_DEVICE}</li>
        </ul>
      </div>
    </section>
  )
}
