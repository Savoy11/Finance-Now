// What GET /api/health reports (hosting brief §4 item 6, 2026-10-26): the host's own
// checks and the outside uptime check (D74) need a page that says whether the app is up.
//
// It answers from this process alone and calls no data source, so a provider's outage
// never makes the site look down, and a check every minute spends no one's quota. The one
// thing it asks is whether the database answers, because the saved portfolios, watchlists
// and accounts stop working without it. No database configured is not a fault: the app runs
// live-only without one (DATABASE_URL unset), so that is reported and stays 200.

export type DatabaseHealth = 'ok' | 'not-configured' | 'error'

export interface HealthReport {
  ok: boolean
  /** ok: everything checked answered. degraded: the app answers but its database does not. */
  status: 'ok' | 'degraded'
  database: DatabaseHealth
  checkedAt: string
}

/** How long the database gets to answer before the check calls it down. */
export const DATABASE_CHECK_TIMEOUT_MS = 2_000

export async function checkHealth(opts: {
  databaseConfigured: boolean
  probeDatabase: () => Promise<unknown>
  timeoutMs?: number
  now?: Date
}): Promise<HealthReport> {
  let database: DatabaseHealth = 'not-configured'
  if (opts.databaseConfigured) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), opts.timeoutMs ?? DATABASE_CHECK_TIMEOUT_MS)
    })
    try {
      await Promise.race([opts.probeDatabase(), timeout])
      database = 'ok'
    } catch {
      database = 'error'
    } finally {
      clearTimeout(timer)
    }
  }
  const ok = database !== 'error'
  return { ok, status: ok ? 'ok' : 'degraded', database, checkedAt: (opts.now ?? new Date()).toISOString() }
}

/** 503 only when the database is configured and does not answer, so an uptime check alerts on it. */
export function healthStatusCode(report: HealthReport): number {
  return report.ok ? 200 : 503
}
