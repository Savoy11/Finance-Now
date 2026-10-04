// Client calls for tracked portfolios (T-027, owner decision D65). Every call
// goes to the routes under /api/user/tracked-portfolios; a refusal comes back
// as a TrackedApiError carrying the route's own words and status, so the screen
// can show the reason (and tell "run the database update" apart from the rest).

import type { TrackedPortfoliosResponse } from '@/app/api/user/tracked-portfolios/route'
import type { LedgerResponse } from '@/app/api/user/tracked-portfolios/[id]/trades/route'
import type { TrackedPortfolioSummary } from '@/lib/server/trackedPortfolios'
import type { LedgerView, TradeView } from '@/lib/data/tradeLedger'

export type { TrackedPortfolioSummary }

/** One tracked portfolio as its screen needs it: its details and its ledger. */
export interface TrackedLedger {
  portfolio: NonNullable<LedgerResponse['portfolio']>
  view: LedgerView
}

export class TrackedApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'TrackedApiError'
  }

  /** The database has not had migration 0005 yet (or is not configured): nothing on the screen can work until it has. */
  get needsSetup(): boolean {
    return this.status === 503
  }
}

/** Retry a dropped connection, never an answer: a refusal says why, and asking again changes nothing. */
export const retryUnlessAnswered = (failures: number, error: unknown) => !(error instanceof TrackedApiError) && failures < 2

const BASE = '/api/user/tracked-portfolios'

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
  })
  const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
  if (!res.ok || body.ok === false) {
    throw new TrackedApiError(body.error ?? `The request failed (HTTP ${res.status}).`, res.status)
  }
  return body as T
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export interface TradeInput {
  instrument: string
  name?: string
  side: TradeView['side']
  quantity: string
  pricePerUnit: string
  feeUsd?: string
  executedAt?: string
  opening?: boolean
  note?: string
}

export const trackedApi = {
  list: () => call<TrackedPortfoliosResponse>(BASE).then((r) => r.portfolios ?? []),
  create: (v: { id?: string; name: string; description?: string }) =>
    call<TrackedPortfoliosResponse>(BASE, json('POST', v)).then((r) => r.portfolio!),
  update: (id: string, v: { name?: string; description?: string }) =>
    call<{ portfolio: TrackedPortfolioSummary }>(`${BASE}/${id}`, json('PATCH', v)).then((r) => r.portfolio),
  remove: (id: string) => call<{ ok: boolean }>(`${BASE}/${id}`, { method: 'DELETE' }),
  ledger: (id: string) => call<LedgerResponse>(`${BASE}/${id}/trades`).then((r): TrackedLedger => ({
    portfolio: r.portfolio!,
    view: { method: r.method!, methodLabel: r.methodLabel!, trades: r.trades ?? [], holdings: r.holdings ?? [] },
  })),
  addTrade: (id: string, trade: TradeInput) =>
    call<LedgerResponse>(`${BASE}/${id}/trades`, json('POST', trade)).then((r) => r.trade!),
  cancelTrade: (id: string, tradeId: string, reason: string) =>
    call<{ ok: boolean }>(`${BASE}/${id}/trades/${tradeId}/cancel`, json('POST', { reason })),
}
