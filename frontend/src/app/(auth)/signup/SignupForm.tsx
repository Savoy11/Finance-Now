'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Activity, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react'
import { APP_NAME, APP_FULL_NAME } from '@/lib/constants'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy'
import type { SIGNUP_CONSENT } from '@/lib/legal/signupConsent'
import { clsx } from 'clsx'

// Account creation (T-132, D232). The route (/api/auth/signup) refuses an
// account without the agreement to email notices (T-436, D127), so the box
// below is not decoration: unticked, the server answers 428 and nothing is
// created. The exact wording and its version come from page.tsx as one object
// (lib/legal/signupConsent.ts), so what is shown is what is stored.
//
// `open` is the sign-in wall's flag, read server-side by page.tsx: while
// sign-in is off (D174) this page redirects away like /login does.

type Consent = typeof SIGNUP_CONSENT

export function SignupForm({ open, consent }: { open: boolean; consent: Consent }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The clause is stored with **bold** marks (lib/legal/inline.ts); shown here as plain text.
  const clauseText = useMemo(() => consent.clause.replace(/\*\*/g, ''), [consent.clause])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      if (password !== confirm) {
        setError('The two passwords do not match.')
        return
      }
      if (!agreed) {
        setError('Creating an account needs the agreement to email notices below.')
        return
      }
      setIsLoading(true)
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name: name.trim() || undefined,
            electronicConsent: true,
            consentVersion: consent.version,
          }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          setError(body?.error ?? `Sign-up failed (HTTP ${res.status}).`)
          return
        }
        // The account exists; sign straight in with the same credentials.
        const result = await signIn('credentials', { email, password, redirect: false })
        if (result?.error) {
          router.push('/login')
          return
        }
        router.push('/headlines')
      } finally {
        setIsLoading(false)
      }
    },
    [agreed, confirm, consent.version, email, name, password, router]
  )

  useEffect(() => {
    if (!open) router.replace('/headlines')
  }, [open, router])

  return !open ? null : (
    <div className="flex flex-col gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="size-14 rounded-xl bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
          <Activity size={28} className="text-accent-blue" aria-hidden />
        </div>
        <div className="text-center">
          <h1 className="font-mono font-bold text-2xl text-text-primary tracking-wider">{APP_NAME}</h1>
          <p className="text-xs text-text-muted mt-1">{APP_FULL_NAME}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="text-center mb-2">
          <h2 className="text-base font-semibold text-text-primary">Create your account</h2>
          <p className="text-xs text-text-muted mt-1">
            To save portfolios, trades, watchlists, plans and wallets
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            <AlertTriangle size={14} aria-hidden />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-text-secondary mb-1.5">
              Name <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30 transition-colors"
              placeholder="How we should address you"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
              Password <span className="text-text-muted font-normal">(at least {MIN_PASSWORD_LENGTH} characters)</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="w-full px-3 py-2.5 pr-10 bg-bg-secondary border border-border rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30 transition-colors"
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-xs font-medium text-text-secondary mb-1.5">
              Confirm password
            </label>
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30 transition-colors"
              placeholder="••••••••••"
            />
          </div>

          <div className="rounded-sm border border-border bg-bg-secondary px-3 py-2.5">
            <label htmlFor="emailConsent" className="flex items-start gap-2.5 text-xs text-text-secondary">
              <input
                id="emailConsent"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
                className="mt-0.5 size-3.5 shrink-0 accent-blue-500"
              />
              <span>
                {consent.label}{' '}
                <Link href={consent.termsHref} className="text-accent-blue hover:underline" target="_blank">
                  Read section 6
                </Link>
              </span>
            </label>
            <details className="mt-2 pl-6">
              <summary className="cursor-pointer text-[11px] text-text-muted hover:text-text-secondary">
                The full clause you are agreeing to
              </summary>
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">{clauseText}</p>
            </details>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !agreed}
          className={clsx(
            'flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-sm font-medium text-sm transition-all',
            'bg-accent-blue hover:bg-accent-blue-dim text-white',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus:outline-hidden focus:ring-2 focus:ring-accent-blue/50'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </button>

        <p className="text-center text-xs text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-blue hover:underline">
            Sign in
          </Link>
        </p>
      </form>

      {/* Footer */}
      <div className="text-center text-[10px] text-text-muted">
        <p>© 2026 Finance Now. Institutional Analytics Platform.</p>
      </div>
    </div>
  )
}
