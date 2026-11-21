'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { STALE_TIME_SHORT } from '@/lib/constants'

// "Two-step sign-in" on the Settings page (T-088, D233). Renders NOTHING without a
// signed-in session: in local mode (today, with the wall off — D174) there is no
// account to protect, so the card is dark until launch, the same posture as D232's
// sign-up page. The routes behind it refuse local mode too (getSessionUserId).
//
// The enrollment hands over the secret as an otpauth:// link (phones register the
// scheme) and a manual setup key — no QR code, which would be this app's first
// drawing dependency; every authenticator's "enter a setup key" box takes the key.

interface Status {
  available: boolean
  reason?: string
  enrolled: boolean
  confirmedAt: string | null
  pending: boolean
  recoveryCodesLeft: number
}

type Mode = 'idle' | 'enrolling' | 'show-codes' | 'disable' | 'regenerate'

async function post(path: string, body?: object): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'The request didn’t go through. Try again.' }
  }
}

export function TwoFactorPanel() {
  const { data: session, status: sessionStatus } = useSession()
  const [mode, setMode] = useState<Mode>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Enrollment in progress:
  const [otpauth, setOtpauth] = useState<{ otpauthUri: string; manualKey: string } | null>(null)
  const [code, setCode] = useState('')
  // Shown exactly once, straight from the confirm/regenerate response:
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  const signedIn = sessionStatus === 'authenticated' && Boolean(session?.user)

  // React Query, per the client fetching convention (CLAUDE.md, Tech Stack).
  // retry: false — the expected failure is the route's 401 in local mode, which
  // will not change by asking again; it reads as "render nothing".
  const { data: status, refetch } = useQuery({
    queryKey: ['two-factor-status'],
    enabled: signedIn,
    retry: false,
    staleTime: STALE_TIME_SHORT,
    queryFn: async (): Promise<Status | null> => {
      const res = await fetch('/api/user/two-factor')
      if (!res.ok) return null
      const body = await res.json().catch(() => null)
      return body?.ok ? (body as Status) : null
    },
  })
  const refresh = async () => { await refetch() }

  // Dark until launch: no session (local mode) → no card at all.
  if (!signedIn || !status) return null

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    await fn()
    setBusy(false)
  }

  const begin = () => act(async () => {
    const res = await post('/api/user/two-factor/begin')
    if (!res.ok) return setError(res.error ?? 'Could not start.')
    setOtpauth(res as unknown as { otpauthUri: string; manualKey: string })
    setCode('')
    setMode('enrolling')
  })

  const confirm = () => act(async () => {
    const res = await post('/api/user/two-factor/confirm', { code })
    if (!res.ok) return setError(res.error ?? 'That code didn’t work.')
    setRecoveryCodes(res.recoveryCodes as string[])
    setOtpauth(null)
    setCode('')
    setMode('show-codes')
    await refresh()
  })

  const disable = () => act(async () => {
    const res = await post('/api/user/two-factor/disable', { code })
    if (!res.ok) return setError(res.error ?? 'That code didn’t work.')
    setCode('')
    setMode('idle')
    await refresh()
  })

  const regenerate = () => act(async () => {
    const res = await post('/api/user/two-factor/recovery-codes', { code })
    if (!res.ok) return setError(res.error ?? 'That code didn’t work.')
    setRecoveryCodes(res.recoveryCodes as string[])
    setCode('')
    setMode('show-codes')
    await refresh()
  })

  const downloadCodes = () => {
    if (!recoveryCodes) return
    const text = `Finance Now recovery codes — each works once. Keep them somewhere safe.\n\n${recoveryCodes.join('\n')}\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'finance-now-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const codeInput = (label: string) => (
    <input
      type="text"
      inputMode="text"
      autoComplete="one-time-code"
      value={code}
      onChange={(e) => setCode(e.target.value)}
      placeholder={label}
      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-200 tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-accent-blue w-44"
    />
  )

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={15} className="text-accent-blue" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-300">Two-step sign-in</h2>
        <span className="text-xs text-slate-500">— a code from your phone, as well as your password</span>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 space-y-3 text-xs text-slate-400">
        {!status.available ? (
          <p>{status.reason}</p>
        ) : mode === 'show-codes' && recoveryCodes ? (
          <div className="space-y-2">
            <p className="text-slate-200 font-medium">Your recovery codes — shown only this once.</p>
            <p>
              Each signs you in once if you lose your phone. Keep them somewhere safe, not on this computer alone.
              We store only a scrambled form, so nobody can show them to you again.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono text-[11px] text-slate-200">
              {recoveryCodes.map((c) => <span key={c} className="px-2 py-1 rounded bg-slate-800/80 text-center">{c}</span>)}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={downloadCodes} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-accent-blue transition-colors">
                Save as a file
              </button>
              <button type="button" onClick={() => { setRecoveryCodes(null); setMode('idle') }} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-accent-blue transition-colors">
                I’ve saved them
              </button>
            </div>
          </div>
        ) : mode === 'enrolling' && otpauth ? (
          <div className="space-y-2">
            <p className="text-slate-200 font-medium">1. Add this account to your authenticator app</p>
            <p>
              On your phone, open the link below, or type the setup key into your app
              (Google Authenticator, Microsoft Authenticator, 1Password and the like all take one).
            </p>
            <p>
              <a href={otpauth.otpauthUri} className="text-accent-blue hover:underline break-all">Open in an authenticator app</a>
            </p>
            <p className="font-mono text-[11px] text-slate-200 bg-slate-800/80 rounded px-2 py-1.5 break-all">{otpauth.manualKey}</p>
            <p className="text-slate-200 font-medium pt-1">2. Enter the 6-digit code the app shows</p>
            <div className="flex gap-2 items-center">
              {codeInput('123456')}
              <button type="button" onClick={confirm} disabled={busy || !code} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-accent-blue disabled:opacity-50 transition-colors">
                {busy ? 'Checking…' : 'Turn on'}
              </button>
              <button type="button" onClick={() => { setMode('idle'); setOtpauth(null); setError(null) }} className="text-slate-500 hover:text-slate-300">
                Cancel
              </button>
            </div>
          </div>
        ) : status.enrolled ? (
          <div className="space-y-2">
            <p className="text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck size={13} aria-hidden />
              On since {status.confirmedAt ? new Date(status.confirmedAt).toLocaleDateString() : '—'} ·{' '}
              {status.recoveryCodesLeft} recovery {status.recoveryCodesLeft === 1 ? 'code' : 'codes'} left
            </p>
            <p>
              Signing in asks for your password and then a code from your authenticator app. If the phone is lost, a
              recovery code signs you in once; if those are gone too, the site owner can turn this off for you.
            </p>
            {(mode === 'disable' || mode === 'regenerate') ? (
              <div className="flex gap-2 items-center">
                {codeInput('Current or recovery code')}
                <button
                  type="button"
                  onClick={mode === 'disable' ? disable : regenerate}
                  disabled={busy || !code}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-accent-blue disabled:opacity-50 transition-colors"
                >
                  {busy ? 'Checking…' : mode === 'disable' ? 'Turn off' : 'New codes'}
                </button>
                <button type="button" onClick={() => { setMode('idle'); setCode(''); setError(null) }} className="text-slate-500 hover:text-slate-300">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => { setMode('regenerate'); setCode('') }} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-accent-blue transition-colors flex items-center gap-1.5">
                  <KeyRound size={12} aria-hidden /> New recovery codes
                </button>
                <button type="button" onClick={() => { setMode('disable'); setCode('') }} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-red-500/60 hover:text-red-300 transition-colors">
                  Turn off
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p>
              Off. With two-step sign-in, a stolen password alone cannot open your account: signing in also asks for a
              6-digit code from an authenticator app on your phone. You get ten one-time recovery codes for a lost phone.
            </p>
            <button type="button" onClick={begin} disabled={busy} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-accent-blue disabled:opacity-50 transition-colors">
              {busy ? 'Starting…' : 'Turn on two-step sign-in'}
            </button>
          </div>
        )}
        {error && <p className="text-amber-400" role="alert">{error}</p>}
      </div>
    </section>
  )
}
