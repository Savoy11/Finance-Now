'use client'

import { useQuery } from '@tanstack/react-query'
import { Coins } from 'lucide-react'
import { STAKING_PROVIDERS } from '@/lib/data/stakingProviders'
import { sponsoredProviders } from '@/lib/data/affiliates'
import { STALE_TIME_LONG } from '@/lib/constants'

/**
 * The owner-only view of affiliate click counts (queue item T-121).
 *
 * ── Why it renders nothing rather than an error when denied ────────────────
 *
 * `GET /api/affiliate/clicks` is behind `guardSensitiveRoute`: localhost-only
 * unless `FN_ADMIN_TOKEN` is set and presented. A viewer who is not the owner
 * gets 401 or 403, and this panel then renders NOTHING.
 *
 * That is deliberate and it is not the "locked page disguised as a broken one"
 * failure the Integrations page fixed in C-note-10. There, the denial hid the
 * page's whole purpose and had to be surfaced. Here the denial IS the answer —
 * the panel is owner-only by definition — and the settings page already shows
 * its own access error from `/live-data/config`, which fails the same way for
 * the same viewer. A second copy of that message would just repeat it.
 *
 * ── What it deliberately does not show ─────────────────────────────────────
 *
 * There is nothing per-click to show. The counter stores a provider id, a
 * number, and two DAYS — no user, session, IP, cookie or per-click timestamp —
 * so no timeline, no per-user view and no funnel can be built here, now or
 * later. The dates are day-precision on purpose (see lib/server/affiliateClicks.ts,
 * corrected 2026-09-21), which is why this panel says "day" rather than
 * rendering a time.
 */

interface ClicksResponse {
  ok: boolean
  counts: Record<string, number>
  total: number
  since: string | null
  updatedAt: string | null
}

export interface ClickRow {
  id: string
  count: number
  /** null when the id is not in the catalog — the row still renders. */
  name: string | null
}

/**
 * Counts to display rows, ordered by count.
 *
 * ⚠ A count whose id is NOT in the catalog is KEPT, with a null name. Dropping
 * it would be the obvious tidy-up and it would silently break the one thing
 * this panel is for: the rows would no longer sum to the total beside them, and
 * the owner would read a smaller number than was actually recorded. An id can
 * fall out of the catalog — a provider gets renamed or retired while its
 * historical clicks remain on disk — so this is a real case, not a defensive one.
 *
 * Ties break on id so the order is stable rather than dependent on object key
 * order, which makes the rendering testable.
 */
export function toClickRows(
  counts: Record<string, number>,
  providers: ReadonlyArray<{ id: string; name: string }>,
): ClickRow[] {
  return Object.entries(counts)
    .map(([id, count]) => ({
      id,
      count,
      name: providers.find((p) => p.id === id)?.name ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}

export function AffiliateClicksPanel() {
  // React Query rather than useEffect + setState: it is the documented client
  // fetching convention (CLAUDE.md, Tech Stack) and it keeps this component out
  // of the react-hooks/set-state-in-effect warning set, which the review
  // invariants say to judge by ADDED instances rather than by total.
  //
  // `retry: false` because the expected failure here is a 401/403 from
  // guardSensitiveRoute — a viewer who is not the owner. Retrying that would
  // hammer a gated endpoint to re-learn an answer that will not change.
  const { data } = useQuery({
    queryKey: ['affiliate-clicks'],
    queryFn: async (): Promise<ClicksResponse | 'denied'> => {
      const res = await fetch('/api/affiliate/clicks')
      if (res.status === 401 || res.status === 403) return 'denied'
      if (!res.ok) throw new Error(`affiliate clicks: ${res.status}`)
      return res.json()
    },
    staleTime: STALE_TIME_LONG,
    retry: false,
  })

  if (!data || data === 'denied' || !data.ok) return null

  const rows = toClickRows(data.counts, STAKING_PROVIDERS)
  const monetised = sponsoredProviders(STAKING_PROVIDERS).length

  return (
    <section className="rounded-card border border-border bg-bg-card p-5 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Coins size={15} className="text-amber-400" aria-hidden /> Affiliate clicks
        <span className="ml-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-text-muted">
          owner only
        </span>
      </h2>

      {rows.length === 0 ? (
        <p className="text-xs leading-relaxed text-text-secondary">
          No paid link has been clicked.{' '}
          {monetised === 0
            ? 'That is expected rather than a failure: no provider currently carries an affiliate URL, so there is no paid link to click.'
            : 'Paid links exist but none has been followed yet.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between py-1.5 text-xs">
                <span className="text-text-secondary">
                  {r.name ?? (
                    <>
                      {r.id}{' '}
                      <span className="text-[10px] uppercase tracking-wider text-amber-400">
                        not in catalog
                      </span>
                    </>
                  )}
                </span>
                <span className="font-semibold tabular-nums text-text-primary">{r.count}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-baseline justify-between border-t border-border pt-2 text-xs">
            <span className="text-text-muted">Total</span>
            <span className="font-semibold tabular-nums text-text-primary">{data.total}</span>
          </p>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-text-muted">
        {data.since ? `Counting since ${data.since}` : 'Counting has not started'}
        {data.updatedAt && `, last click ${data.updatedAt}`}. Dates are days, not times —
        aggregate counts are all that is stored, so there is no per-click history to show
        and none can be reconstructed later.
      </p>
    </section>
  )
}
