'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { APP_NAME } from '@/lib/constants'
import type { OwnerAccessStatus } from '@/app/api/owner/route'

// Owner access for this browser (lib/server/ownerAccess.ts). On a hosted copy the owner's
// tools (AI agents, the Pump Report, Integrations, prompts, video answers) need the admin
// token. Typing it here once sets a cookie that lasts 30 days on this browser; the token
// itself is not kept anywhere in the browser. Outside the dashboard, like the reset page,
// so it works whether or not sign-in is on.

const inputClass =
  'w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30 transition-colors'

const buttonClass = clsx(
  'flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-sm font-medium text-sm transition-all',
  'bg-accent-blue hover:bg-accent-blue-dim text-white disabled:opacity-60 disabled:cursor-not-allowed',
  'focus:outline-hidden focus:ring-2 focus:ring-accent-blue/50',
)

export default function OwnerAccessPage() {
  const [status, setStatus] = useState<OwnerAccessStatus | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/owner', { cache: 'no-store' })
      .then((res) => res.json() as Promise<OwnerAccessStatus>)
      .then((s) => { if (alive) setStatus(s) })
      .catch(() => { if (alive) setError('Could not reach the server. Try again.') })
    return () => { alive = false }
  }, [])

  const send = useCallback(async (method: 'POST' | 'DELETE') => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/owner', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ token }) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as Partial<OwnerAccessStatus> & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'That did not work.')
        return
      }
      setToken('')
      setStatus({ mode: data.mode ?? 'token', unlocked: !!data.unlocked })
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }, [token])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <div className="size-14 rounded-xl bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
          <Activity size={28} className="text-accent-blue" aria-hidden />
        </div>
        <h1 className="font-mono font-bold text-2xl text-text-primary tracking-wider">{APP_NAME}</h1>
      </div>

      <div className="text-center">
        <h2 className="text-base font-semibold text-text-primary">Owner access</h2>
        <p className="text-xs text-text-muted mt-1">
          The AI agents, the Pump Report, Integrations, prompt editing and video answers are the owner&rsquo;s tools.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          <AlertTriangle size={14} aria-hidden className="shrink-0" />
          {error}
        </div>
      )}

      {!status ? (
        <div className="flex justify-center"><Loader2 size={18} className="animate-spin text-text-muted" aria-label="Loading" /></div>
      ) : status.mode === 'local' ? (
        <p className="text-sm text-text-secondary text-center">
          This is your own machine and no admin token is set, so the tools already work here. Nothing to unlock.
        </p>
      ) : status.mode === 'closed' ? (
        <p className="text-sm text-text-secondary text-center">
          The tools are switched off on this server: no admin token is set. Set <code>FN_ADMIN_TOKEN</code> in the host&rsquo;s
          secret store and restart, then come back here.
        </p>
      ) : status.unlocked ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={28} className="text-emerald-400" aria-hidden />
          <p className="text-sm text-text-primary">This browser has owner access for 30 days.</p>
          <p className="text-xs text-text-muted">Changing the admin token on the server ends it on every browser.</p>
          <Link href="/settings" className="text-xs text-accent-blue hover:underline">Go to Integrations</Link>
          <button type="button" disabled={busy} onClick={() => void send('DELETE')} className="text-xs text-text-muted hover:text-text-primary underline">
            Lock this browser
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void send('POST') }} className="flex flex-col gap-4">
          <div>
            <label htmlFor="admin-token" className="block text-xs font-medium text-text-secondary mb-1.5">Admin token</label>
            <input id="admin-token" type="password" autoComplete="off" spellCheck={false} required value={token}
              onChange={(e) => setToken(e.target.value)} className={inputClass} />
            <p className="text-xs text-text-muted mt-1.5">
              The value of <code>FN_ADMIN_TOKEN</code> on this server. It is checked once and not kept in the browser.
            </p>
          </div>
          <button type="submit" disabled={busy || !token} className={buttonClass}>
            {busy ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Checking…</> : <><KeyRound size={14} aria-hidden /> Unlock this browser</>}
          </button>
        </form>
      )}
    </div>
  )
}
