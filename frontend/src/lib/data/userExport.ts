// "Download my data": a copy of everything the server keeps for one account (T-452, D197, D199).
//
// The draft Privacy Policy (§11, lib/legal/disclosures.ts) promises anyone a copy of the personal
// information held about them within 30 days. Before this, answering meant querying Postgres by
// hand across about a dozen tables. This module is the pure half: it shapes what was read into
// one JSON document and two spreadsheets (trades and portfolio holdings), and says plainly what is
// left out and why. The reading is lib/server/userExportCollect.ts, which finds every table with a
// user_id column by itself, so a table added later is in the export without anyone remembering it.
//
// It exports only. Nothing here changes or deletes anything.

import type { IncomeKind, TradeSide } from '@/lib/db/schema/invest'
import { toCents } from './costBasis'
import { entryUnitName } from './instruments'
import { BOUGHT_HOW_LABELS, SOLD_HOW_LABELS, buildSalesList } from './salesList'
import { buildLedgerView, type StoredCancellation, type StoredTrade } from './tradeLedger'

export type Row = Record<string, unknown>

export const USER_EXPORT_FORMAT = 'finance-now-user-export'
export const USER_EXPORT_VERSION = 1

/** What is deliberately not in the file, and why, in the words the file itself carries. */
export const LEFT_OUT: readonly { what: string; why: string }[] = [
  {
    what: 'Your password',
    why: 'Only a one-way scrambled form of it (a hash) is stored, which cannot be turned back into the password. It is left out.',
  },
  {
    what: 'Password reset links',
    why: 'Each is stored only as a one-way hash, works once and expires within an hour. They are left out.',
  },
]

/** Tables read for nothing at all, with the reason. Every other table with a user_id column is exported. */
export const EXCLUDED_TABLES: Readonly<Record<string, string>> = {
  password_reset_tokens: LEFT_OUT[1].why,
}

/** Columns removed from the rows they appear in. */
export const OMITTED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  users: ['password_hash'],
}

/** Any column with one of these names is removed wherever it appears: a second guard for secrets. */
const SECRET_COLUMN = /(^|_)(password_hash|token_hash)$/

export const ON_THIS_DEVICE =
  'Some things are kept only in your browser, not on our server: price alerts, notes, chart settings, ' +
  'module choices and similar settings. They are not in this file. You can clear them from your browser.'

export interface CollectedExport {
  /** The users row, or null when there is none. */
  account: Row | null
  /** Rows by table name, every table read for this account. */
  tables: Record<string, Row[]>
  /** Tables the database does not have yet (a migration not run): none of the account's data can be in them. */
  notSetUp: string[]
  /** The instruments the rows refer to by instrument_id, so a reader can see which coin or ticker each is. */
  instruments: Row[]
}

function strip(table: string, row: Row): Row {
  const omit = new Set(OMITTED_COLUMNS[table] ?? [])
  const out: Row = {}
  for (const k of Object.keys(row).sort()) {
    if (omit.has(k) || SECRET_COLUMN.test(k)) continue
    out[k] = row[k]
  }
  return out
}

export interface UserExport {
  format: typeof USER_EXPORT_FORMAT
  version: typeof USER_EXPORT_VERSION
  exportedAt: string
  account: Row | null
  /** Everything stored for the account, by table, each row as stored (secrets removed). */
  data: Record<string, Row[]>
  instruments: Row[]
  leftOut: typeof LEFT_OUT
  onThisDevice: string
  /** Present only when some tables are not set up on this database. */
  notSetUp?: string[]
}

export function buildUserExport(c: CollectedExport, exportedAt: Date): UserExport {
  const data: Record<string, Row[]> = {}
  for (const table of Object.keys(c.tables).sort()) {
    if (table in EXCLUDED_TABLES) continue
    data[table] = c.tables[table].map((r) => strip(table, r))
  }
  const doc: UserExport = {
    format: USER_EXPORT_FORMAT,
    version: USER_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    account: c.account ? strip('users', c.account) : null,
    data,
    instruments: c.instruments.map((r) => strip('instruments', r)),
    leftOut: LEFT_OUT,
    onThisDevice: ON_THIS_DEVICE,
  }
  if (c.notSetUp.length > 0) doc.notSetUp = [...c.notSetUp].sort()
  return doc
}

// ─── Spreadsheets ────────────────────────────────────────────────────────────

const text = (v: unknown): string => {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/**
 * One CSV field. Quoted when it holds a comma, quote or line break. A value a spreadsheet would
 * read as a formula (starting with = + - @, a tab or a carriage return) gets a leading apostrophe,
 * so a note typed as "=cmd…" opens as text: the usual guard against CSV formula injection. A plain
 * negative number is left alone.
 */
export function csvField(v: unknown): string {
  let s = text(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(header: readonly string[], rows: readonly unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}

const byId = (rows: readonly Row[] | undefined, key = 'id') =>
  new Map((rows ?? []).map((r) => [String(r[key]), r] as const))

export const TRADES_CSV_HEADER = [
  'portfolio', 'date', 'symbol', 'name', 'side', 'starting_position', 'quantity', 'price_per_unit_usd',
  'fee_usd', 'split_units_after', 'split_units_before', 'cash_in_lieu_usd', 'income_usd', 'income_kind',
  'cancelled', 'cancel_reason', 'note', 'recorded_at',
] as const

/** Every trade in a tracked portfolio, cancelled ones included and marked, in date order. */
export function tradesCsv(c: CollectedExport): string {
  const portfolios = byId(c.tables.portfolios)
  const instruments = byId(c.instruments)
  const cancels = byId(c.tables.trade_cancellations, 'trade_id')
  const splits = byId(c.tables.trade_splits, 'trade_id')
  const income = byId(c.tables.trade_income, 'trade_id')
  const time = (v: unknown) => (v instanceof Date ? v.getTime() : v == null ? -Infinity : Date.parse(String(v)))
  const trades = [...(c.tables.trade_transactions ?? [])].sort((a, b) =>
    text(portfolios.get(String(a.portfolio_id))?.name).localeCompare(text(portfolios.get(String(b.portfolio_id))?.name))
    || time(a.executed_at) - time(b.executed_at)
    || time(a.created_at) - time(b.created_at))
  return csv(TRADES_CSV_HEADER, trades.map((t) => {
    const inst = instruments.get(String(t.instrument_id))
    const cancel = cancels.get(String(t.id))
    const split = splits.get(String(t.id))
    const inc = income.get(String(t.id))
    return [
      portfolios.get(String(t.portfolio_id))?.name, t.executed_at, inst?.symbol, inst?.name, t.side,
      t.opening ? 'yes' : 'no', t.quantity, t.price_per_unit, t.fee_usd,
      split?.units_after, split?.units_before, split?.cash_in_lieu_usd, inc?.amount_usd, inc?.kind,
      cancel ? 'yes' : 'no', cancel?.reason, t.note, t.created_at,
    ]
  }))
}

export const HOLDINGS_CSV_HEADER = [
  'portfolio', 'symbol', 'name', 'target_allocation_pct', 'entry_price', 'entry_price_unit', 'quantity',
] as const

/**
 * The unit a what-if holding's entry price was typed in, the one the Portfolios page names
 * beside its box: dollars for a coin or a stock, but US cents for corn, percent for a Treasury
 * yield, points of par for a bond future and the quote currency for a currency pair. The column
 * was called entry_price_usd and said dollars for every one (audit 2026-11-07, finding 5).
 */
export function entryPriceUnit(inst: Row | undefined): string {
  if (!inst) return ''
  const cls = text(inst.asset_class)
  if (cls === 'crypto') return 'USD'
  if (cls === 'manual' || cls === 'cash') return text(inst.currency) || 'USD'
  return entryUnitName(`sec:${text(inst.symbol)}`)
}

/** Every holding in a what-if portfolio. A tracked portfolio's positions come from its trades. */
export function holdingsCsv(c: CollectedExport): string {
  const portfolios = byId(c.tables.portfolios)
  const instruments = byId(c.instruments)
  const rows = [...(c.tables.holdings ?? [])].map((h) => ({
    portfolio: text(portfolios.get(String(h.portfolio_id))?.name),
    inst: instruments.get(String(h.instrument_id)),
    h,
  })).sort((a, b) => a.portfolio.localeCompare(b.portfolio) || text(a.inst?.symbol).localeCompare(text(b.inst?.symbol)))
  return csv(HOLDINGS_CSV_HEADER, rows.map(({ portfolio, inst, h }) => [
    portfolio, inst?.symbol, inst?.name, h.target_alloc_pct, h.avg_cost_basis, entryPriceUnit(inst), h.quantity,
  ]))
}

export const SALES_CSV_HEADER = [
  'portfolio', 'year', 'sold_on', 'symbol', 'name', 'sold_how', 'units', 'bought_on', 'bought_how',
  'days_held', 'cost_usd', 'proceeds_usd', 'gain_usd', 'from_starting_position',
] as const

const dateOrNull = (v: unknown): Date | null => {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * A tracked portfolio's saved trades and cancellations, from the rows as stored, in the
 * shape the trade routes read them. The instrument's id stands in for its key: it only
 * groups the trades by holding here.
 */
function storedTrades(c: CollectedExport, portfolioId: string): { trades: StoredTrade[]; cancellations: StoredCancellation[] } {
  const instruments = byId(c.instruments)
  const splits = byId(c.tables.trade_splits, 'trade_id')
  const income = byId(c.tables.trade_income, 'trade_id')
  const rows = (c.tables.trade_transactions ?? []).filter((t) => String(t.portfolio_id) === portfolioId)
  const ids = new Set(rows.map((t) => String(t.id)))
  const trades: StoredTrade[] = rows.map((t) => {
    const inst = instruments.get(String(t.instrument_id))
    const split = splits.get(String(t.id))
    const inc = income.get(String(t.id))
    return {
      id: String(t.id),
      instrumentKey: `instrument:${text(t.instrument_id)}`,
      symbol: text(inst?.symbol) || '?',
      name: text(inst?.name),
      side: t.side as TradeSide,
      quantity: text(t.quantity),
      pricePerUnit: text(t.price_per_unit),
      feeUsd: text(t.fee_usd),
      executedAt: dateOrNull(t.executed_at),
      opening: t.opening === true,
      note: t.note == null ? null : text(t.note),
      createdAt: dateOrNull(t.created_at) ?? new Date(0),
      split: split
        ? { unitsAfter: Number(split.units_after), unitsBefore: Number(split.units_before), cashInLieuUsd: split.cash_in_lieu_usd == null ? null : text(split.cash_in_lieu_usd) }
        : null,
      income: inc ? { amountUsd: text(inc.amount_usd), kind: text(inc.kind) as IncomeKind } : null,
    }
  })
  const cancellations: StoredCancellation[] = (c.tables.trade_cancellations ?? [])
    .filter((x) => ids.has(String(x.trade_id)))
    .map((x) => ({ tradeId: String(x.trade_id), reason: text(x.reason), createdAt: dateOrNull(x.created_at) ?? new Date(0) }))
  return { trades, cancellations }
}

/**
 * Every sale in the account's tracked portfolios, one row per purchase it used up (T-460, D222),
 * as the tracked portfolio page lists them: FIFO, not adjusted for tax rules. Units sold that no
 * purchase covered are a row with no cost and no gain. Units moved out are not sales and are not
 * here; they are in the trades file. `portfolioId` keeps one portfolio's sales; the rows are the
 * signed-in account's whatever it is, so another account's id matches nothing.
 */
export function salesCsv(c: CollectedExport, now: Date, portfolioId?: string): string {
  const portfolios = byId(c.tables.portfolios)
  const withTrades = [...new Set((c.tables.trade_transactions ?? []).map((t) => String(t.portfolio_id)))]
    .filter((id) => portfolioId === undefined || id === portfolioId)
    .map((id) => ({ id, name: text(portfolios.get(id)?.name) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  const out: unknown[][] = []
  for (const p of withTrades) {
    const { trades, cancellations } = storedTrades(c, p.id)
    const list = buildSalesList(buildLedgerView(trades, cancellations, now), now)
    for (const year of [...list.years].reverse()) {
      for (const s of year.sales) {
        const sold = [p.name, year.year, s.soldOn, s.symbol, s.name, SOLD_HOW_LABELS[s.soldHow]]
        for (const part of s.parts) {
          out.push([
            ...sold, part.quantity, part.boughtOn ?? 'date not entered', BOUGHT_HOW_LABELS[part.boughtHow], part.daysHeld,
            toCents(part.costUsd), toCents(part.proceedsUsd), toCents(part.gainUsd), part.fromStartingPosition ? 'yes' : 'no',
          ])
        }
        if (s.unmatched) {
          out.push([...sold, s.unmatched.quantity, '', 'no purchase recorded', '', '', toCents(s.unmatched.proceedsUsd), '', 'no'])
        }
      }
    }
  }
  return csv(SALES_CSV_HEADER, out)
}

/** A file name for one part of the export: "finance-now-data-2026-11-06.json". */
export function exportFileName(part: 'json' | 'trades' | 'holdings' | 'sales', exportedAt: Date): string {
  const day = exportedAt.toISOString().slice(0, 10)
  return part === 'json' ? `finance-now-data-${day}.json` : `finance-now-${part}-${day}.csv`
}
