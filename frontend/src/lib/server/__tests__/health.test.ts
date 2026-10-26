import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkHealth, healthStatusCode } from '@/lib/server/health'

// GET /api/health (hosting brief §4 item 6): what the host's checks and the uptime check (D74) read.

const NOW = new Date('2026-10-26T12:00:00Z')

describe('the health report', () => {
  it('is ok with no database configured: the app runs live-only without one', async () => {
    const probe = vi.fn()
    const r = await checkHealth({ databaseConfigured: false, probeDatabase: probe, now: NOW })
    expect(r).toEqual({ ok: true, status: 'ok', database: 'not-configured', checkedAt: '2026-10-26T12:00:00.000Z' })
    expect(probe).not.toHaveBeenCalled()
    expect(healthStatusCode(r)).toBe(200)
  })

  it('is ok when the database answers', async () => {
    const r = await checkHealth({ databaseConfigured: true, probeDatabase: async () => [{ '?column?': 1 }], now: NOW })
    expect(r).toMatchObject({ ok: true, status: 'ok', database: 'ok' })
    expect(healthStatusCode(r)).toBe(200)
  })

  it('is degraded, 503, when the configured database fails or does not answer in time', async () => {
    const failed = await checkHealth({ databaseConfigured: true, probeDatabase: async () => { throw new Error('ECONNREFUSED') } })
    expect(failed).toMatchObject({ ok: false, status: 'degraded', database: 'error' })
    expect(healthStatusCode(failed)).toBe(503)
    const slow = await checkHealth({ databaseConfigured: true, probeDatabase: () => new Promise(() => {}), timeoutMs: 20 })
    expect(slow).toMatchObject({ ok: false, database: 'error' })
  })

  it('says nothing about why the database failed, so no error text or address leaks', async () => {
    const r = await checkHealth({ databaseConfigured: true, probeDatabase: async () => { throw new Error('password authentication failed for postgres://u:p@db') } })
    expect(JSON.stringify(r)).not.toMatch(/password|postgres:|ECONN/)
  })

  it('the route calls no data source and is never cached', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/health/route.ts'), 'utf8')
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(src).toMatch(/'Cache-Control': 'no-store'/)
    expect(src).not.toMatch(/fetch\(|live-data|pinnedFetch/)
  })
})
