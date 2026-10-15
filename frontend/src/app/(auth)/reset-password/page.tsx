'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { APP_NAME } from '@/lib/constants'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy'

// Choose a new password from an owner-issued reset link (T-435, D123). The link carries
// its token after `#`, which the browser never sends to the server, so it is read here,
// at submit, and posted once; after a successful reset it is cleared from the address bar.
// Lives outside the dashboard so it works while sign-in is on and the person cannot sign in.

function tokenFromFragment(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? ''
}

const inputClass =
  'w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30 transition-colors'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const token = tokenFromFragment()
    if (!token) {
      setError('This page needs the full reset link you were given, including everything after the #.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'The password could not be reset.')
        return
      }
      window.history.replaceState(null, '', window.location.pathname)
      setDone(true)
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }, [password, confirm])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <div className="size-14 rounded-xl bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
          <Activity size={28} className="text-accent-blue" aria-hidden />
        </div>
        <h1 className="font-mono font-bold text-2xl text-text-primary tracking-wider">{APP_NAME}</h1>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={28} className="text-emerald-400" aria-hidden />
          <p className="text-sm text-text-primary">Your password has been changed.</p>
          <p className="text-xs text-text-muted">The link is now spent, along with any other reset link for this account.</p>
          <Link href="/login" className="text-xs text-accent-blue hover:underline">Go to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="text-center mb-2">
            <h2 className="text-base font-semibold text-text-primary">Choose a new password</h2>
            <p className="text-xs text-text-muted mt-1">At least {MIN_PASSWORD_LENGTH} characters. The link works once.</p>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              <AlertTriangle size={14} aria-hidden className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-text-secondary mb-1.5">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-text-secondary mb-1.5">Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
            </div>
          </div>

          <button type="submit" disabled={busy}
            className={clsx(
              'flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-sm font-medium text-sm transition-all',
              'bg-accent-blue hover:bg-accent-blue-dim text-white disabled:opacity-60 disabled:cursor-not-allowed',
              'focus:outline-hidden focus:ring-2 focus:ring-accent-blue/50',
            )}>
            {busy ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Saving…</> : 'Set new password'}
          </button>
        </form>
      )}
    </div>
  )
}
