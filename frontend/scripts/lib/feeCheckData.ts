/**
 * The data behind the Transfer Fee Check page (T-031, D52), assembled from the table and
 * the registers it sits beside. Pure: every input is a parameter, so the tests run it
 * against the real table and against small fixtures alike. gen-fee-check-page.ts passes
 * the real values.
 *
 * Every number the page shows is derived here; none is typed into the page.
 */
import { byImpact, CORE_N, FEE_PAGES, type FeeRow } from './transferFeeRows'

export interface FeeCheckLead {
  id: string
  title: string
  summary: string
}

export interface FeeCheckRow {
  key: string
  coin: string
  coinName: string
  network: string
  fee: number
  min: number
  withdraw: boolean
  deposit: boolean
  note: string
  core: boolean
  impact: number
}

export interface FeeCheckExchange {
  id: string
  name: string
  tier: 1 | 2
  feePage: string | null
  /** Publishes its withdrawal fees in a keyless feed, so `fee-reconcile` checks most rows. */
  feed: boolean
  /** The source-terms register's name for it when its host is `prohibited`, else null. */
  prohibited: string | null
  trading: { makerPct: number; takerPct: number; note: string } | null
  leads: FeeCheckLead[]
  rows: FeeCheckRow[]
}

export interface FeeCheckData {
  generatedOn: string
  /** The ledger items this page works. */
  serves: string[]
  table: { lastVerified: string; ageDays: number; rows: number; tradingCompiled: string }
  coreCount: number
  /** Leads that name no single exchange. */
  generalLeads: FeeCheckLead[]
  exchanges: FeeCheckExchange[]
}

export interface LedgerItem {
  id: string
  title: string
  status: string
  summary?: string
  sources?: Array<{ file?: string }>
}

/** The ledger items this page exists to work: the withdrawal-fee pass and the trading-fee check. */
export const FEE_CHECK_SERVES = ['T-031', 'T-036'] as const

/** Where the fee re-check leads were filed (docs/audits/fee-refresh-2026-08-20.md). */
const LEAD_SOURCE = 'docs/audits/fee-refresh-2026-08-20.md'

/**
 * Open fee leads from the ledger: items not closed that cite the 2026-08-20 fee-refresh
 * audit, other than the items this page itself works. Each attaches to every exchange its
 * title names; a lead naming none is general.
 */
export function feeLeads(
  items: readonly LedgerItem[],
  exchanges: ReadonlyArray<{ id: string; name: string }>,
): { byExchange: Record<string, FeeCheckLead[]>; general: FeeCheckLead[] } {
  const byExchange: Record<string, FeeCheckLead[]> = {}
  const general: FeeCheckLead[] = []
  const serves = new Set<string>(FEE_CHECK_SERVES)
  for (const it of items) {
    if (it.status === 'closed' || serves.has(it.id)) continue
    if (!(it.sources ?? []).some((s) => s.file === LEAD_SOURCE)) continue
    const lead = { id: it.id, title: it.title, summary: it.summary ?? '' }
    const named = exchanges.filter((ex) => namesExchange(it.title, ex))
    if (named.length === 0) general.push(lead)
    for (const ex of named) (byExchange[ex.id] ??= []).push(lead)
  }
  return { byExchange, general }
}

/** Whether a title names the exchange, by display name or id, as a whole word. */
export function namesExchange(title: string, ex: { id: string; name: string }): boolean {
  const names = [ex.name.replace(/\s*\(.*\)\s*$/, ''), ex.id]
  return names.some((n) => {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, 'i').test(title)
  })
}

export interface BuildFeeCheckInput {
  rows: readonly FeeRow[]
  exchanges: ReadonlyArray<{ id: string; name: string; tier: 1 | 2 }>
  trading: Record<string, { makerPct: number; takerPct: number; note?: string } | null>
  /** Exchange ids with a keyless fee feed (WITHDRAW_FEE_SOURCES). */
  feedIds: readonly string[]
  /** The register's name for a fee-page URL whose host is prohibited, else null. */
  prohibitedName: (url: string) => string | null
  ledgerItems: readonly LedgerItem[]
  lastVerified: string
  ageDays: number
  tradingCompiled: string
  generatedOn: string
  feePages?: Record<string, string>
}

export function buildFeeCheckData(input: BuildFeeCheckInput): FeeCheckData {
  const feePages = input.feePages ?? FEE_PAGES
  const feeds = new Set(input.feedIds)

  // The core: the highest-impact rows on exchanges with no feed — the ones only a
  // person can check. Same ranking as the CSV worksheet (transferFeeRows.byImpact).
  const human = input.rows.filter((r) => !feeds.has(r.exchangeId)).slice().sort(byImpact)
  const core = new Set(human.slice(0, CORE_N).map((r) => r.key))
  const bestCore = new Map<string, number>()
  for (const r of human.slice(0, CORE_N)) bestCore.set(r.exchangeId, Math.max(bestCore.get(r.exchangeId) ?? 0, r.impact))

  const { byExchange, general } = feeLeads(input.ledgerItems, input.exchanges)

  const exchanges: FeeCheckExchange[] = input.exchanges.map((ex) => {
    const page = feePages[ex.id] ?? null
    const t = input.trading[ex.id] ?? null
    return {
      id: ex.id,
      name: ex.name,
      tier: ex.tier,
      feePage: page,
      feed: feeds.has(ex.id),
      prohibited: page ? input.prohibitedName(page) : null,
      trading: t ? { makerPct: t.makerPct, takerPct: t.takerPct, note: t.note ?? '' } : null,
      leads: byExchange[ex.id] ?? [],
      rows: input.rows
        .filter((r) => r.exchangeId === ex.id)
        .slice()
        .sort(byImpact)
        .map((r) => ({
          key: r.key,
          coin: r.coin,
          coinName: r.coinName,
          network: r.network,
          fee: r.fee,
          min: r.minWithdraw,
          withdraw: r.withdrawEnabled,
          deposit: r.depositEnabled,
          note: r.note,
          core: core.has(r.key),
          impact: r.impact,
        })),
    }
  })

  // Exchanges with core rows first (best core row first), then the other exchanges a
  // person must check, then the feed exchanges — each group by tier, then name.
  const rank = (ex: FeeCheckExchange) => (bestCore.has(ex.id) ? 0 : ex.feed ? 2 : 1)
  exchanges.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (bestCore.get(b.id) ?? 0) - (bestCore.get(a.id) ?? 0) ||
      a.tier - b.tier ||
      a.name.localeCompare(b.name),
  )

  return {
    generatedOn: input.generatedOn,
    serves: [...FEE_CHECK_SERVES],
    table: { lastVerified: input.lastVerified, ageDays: input.ageDays, rows: input.rows.length, tradingCompiled: input.tradingCompiled },
    coreCount: core.size,
    generalLeads: general,
    exchanges,
  }
}
