'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { History } from 'lucide-react'
import { STALE_TIME_MEDIUM } from '@/lib/constants'
import type { SecurityActivityResponse } from '@/app/api/user/security-activity/route'

// "Security activity" on the Settings page (T-474, D245): the account's own
// rows from the D235 audit log, in the vocabulary's plain words — how an
// account holder notices a sign-in attempt they did not make. Renders NOTHING
// without a signed-in session (the D233 posture, same as TwoFactorPanel
// beside it): in local mode there is no account, the route answers 401, and
// the card is dark until the launch flip. The view only displays what is
// stored — events, times and plain-words detail; no IP or browser string
// exists to show (D235's deliberate line).

// The year is always shown: the list is the newest 50 rows with no time
// bound, so on a quiet account a refused sign-in from a year ago would
// otherwise read like last week's — on the one surface built for noticing
// sign-ins you did not make (2026-11-26 audit).
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function SecurityActivityPanel() {
  const { data: session, status: sessionStatus } = useSession()
  const signedIn = sessionStatus === 'authenticated' && Boolean(session?.user)

  // retry: false — the expected failure is the route's 401 in local mode,
  // which will not change by asking again; it reads as "render nothing".
  const { data } = useQuery({
    queryKey: ['security-activity'],
    enabled: signedIn,
    retry: false,
    staleTime: STALE_TIME_MEDIUM,
    queryFn: async (): Promise<SecurityActivityResponse | null> => {
      const res = await fetch('/api/user/security-activity')
      if (!res.ok) return null
      const body = (await res.json().catch(() => null)) as SecurityActivityResponse | null
      return body?.ok ? body : null
    },
  })

  if (!signedIn || !data) return null

  return (
    <section aria-labelledby="security-activity-heading" className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <History size={14} className="text-text-muted" aria-hidden />
        <h3 id="security-activity-heading" className="text-sm font-medium text-text-primary">Security activity</h3>
      </div>
      <p className="text-xs text-text-muted mb-3">
        What has happened to this account — sign-ins and refused sign-ins, password and two-step changes,
        module grants, data downloads. The record cannot be edited or removed, by anyone; your full copy is
        in “Your data” below.
      </p>

      {!data.recording ? (
        <p className="text-xs text-text-muted">
          Nothing is being recorded yet — the security log’s table has not been created on this database
          (migration 0013, <code className="text-[11px]">npm run db:migrate</code>).
        </p>
      ) : data.rows.length === 0 ? (
        <p className="text-xs text-text-muted">No recorded events for this account yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {data.rows.map((r, i) => (
            <li key={`${r.at}-${i}`} className="py-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-text-secondary">
                {r.label}
                {r.detail && <span className="text-text-muted"> — {r.detail}</span>}
                {r.actor === 'owner-command' && <span className="text-text-muted"> (by the owner)</span>}
              </span>
              <span className="font-mono tabular-nums text-text-muted shrink-0">{when(r.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
