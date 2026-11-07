// ─── Importing trades from a broker's file (T-447, D197, D200) ──────────────
//
// The pure half of "Import trades from a file" on a tracked portfolio: read a
// CSV file exported from a broker or exchange, match its columns once, and turn
// each row into a trade the trade route would accept. The screen
// (components/portfolio/tracked/ImportTradesPanel.tsx) shows every row and what
// it becomes before anything is saved; the import route
// (/api/user/tracked-portfolios/[id]/imports) checks every row again with
// parseTradeInput and saves them together.
//
// Rules this module keeps, each tested in __tests__/tradeImport.test.ts:
//   - Every row goes through the same checks as a typed trade (parseTradeInput).
//     A row that fails is shown with the reason and not saved: a trade with a
//     guessed date or amount is worse than a missing one.
//   - Numbers are read as text, never through floating point, so "0.1" stays
//     0.1. A comma is read only as a thousands separator; a decimal comma is
//     refused rather than guessed. A price or fee in another currency is refused.
//   - A coin is never matched by its ticker alone (D190: a ticker shared by two
//     coins put the wrong issuer's figures on a page). The person picks the
//     coin for each symbol once, and the layout remembers it. A stock or fund
//     is its ticker, as everywhere else in the app.
//   - Rows the file uses for anything else (dividends, interest, deposits) are
//     left out by default and counted, never silently dropped.
// It imports nothing and saves nothing.

import { INSTRUMENTS, INSTRUMENT_BY_KEY, SEC_PREFIX } from './instruments'
import {
  MAX_NOTE_LENGTH, MAX_REASON_LENGTH, buildLedgerView, parseTradeInput, trimDecimal,
  type NewTrade, type StoredCancellation, type StoredTrade,
} from './tradeLedger'

/** The largest file the screen reads. A broker's whole history is far smaller. */
export const MAX_IMPORT_FILE_BYTES = 5_000_000
/** The most rows one import sends. A longer history goes in as several files. */
export const MAX_IMPORT_ROWS = 5_000
/** The most distinct values a column may have before the screen stops listing them one by one. */
export const MAX_DISTINCT_VALUES = 300

// ─── Reading the file ────────────────────────────────────────────────────────

export interface CsvRow {
  /** The line of the file the row starts on, counting from 1, as a spreadsheet shows it. */
  line: number
  cells: string[]
}

export interface SetAsideLine {
  line: number
  /** The line's text, cut short, so the screen can show what it was. */
  text: string
  reason: string
}

export interface CsvTable {
  headers: string[]
  /** The line the column names are on. */
  headerLine: number
  rows: CsvRow[]
  /** Lines that are not rows: a title above the column names, or a totals line below. Counted and shown. */
  setAside: SetAsideLine[]
  delimiter: ',' | ';' | '\t'
}

interface RawRecord { line: number; cells: string[]; text: string }

/** Splits a file into records, honouring quoted fields that hold the delimiter, quotes or line breaks. */
function splitRecords(text: string, delimiter: string): RawRecord[] {
  const out: RawRecord[] = []
  let cells: string[] = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let startLine = 1
  let start = 0
  const push = (end: number) => {
    cells.push(cell)
    out.push({ line: startLine, cells, text: text.slice(start, end) })
    cells = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else {
        if (ch === '\n') line++
        cell += ch
      }
    } else if (ch === '"' && cell.trim() === '') {
      cell = ''
      inQuotes = true
    } else if (ch === delimiter) {
      cells.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      push(i)
      if (ch === '\r' && text[i + 1] === '\n') i++
      line++
      startLine = line
      start = i + 1
    } else {
      cell += ch
    }
  }
  if (cell !== '' || cells.length > 0) push(text.length)
  return out
}

/** The delimiter the first lines use most: a comma, a semicolon or a tab. */
function detectDelimiter(text: string): CsvTable['delimiter'] {
  const head = text.split(/\r?\n/).slice(0, 20).join('\n')
  const count = (d: string) => splitRecords(head, d).reduce((n, r) => Math.max(n, r.cells.length), 0)
  const scores = ([',', ';', '\t'] as const).map((d) => ({ d, n: count(d) }))
  return scores.reduce((best, s) => (s.n > best.n ? s : best)).d
}

const filled = (cells: string[]) => cells.filter((c) => c.trim() !== '').length
const shortText = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s)

/** A record's cell count without the empty cells a trailing delimiter leaves. */
function width(cells: string[]): number {
  let n = cells.length
  while (n > 0 && cells[n - 1].trim() === '') n--
  return n
}

/**
 * Reads a CSV file. The column names are on the first line that has at least
 * three filled cells and as many cells as most such lines (so a short title
 * line above them is not taken for them); lines above it (a title, an account
 * number) are set aside and shown. A later line with a different number of
 * cells (a totals line, a disclaimer) is set aside too, never read as a trade.
 * Blank lines are skipped.
 */
export function readCsv(input: string): CsvTable {
  const text = input.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(text)
  const records = splitRecords(text, delimiter).filter((r) => filled(r.cells) > 0)
  const setAside: SetAsideLine[] = []
  const widths = new Map<number, number>()
  for (const r of records) if (filled(r.cells) >= 3) widths.set(width(r.cells), (widths.get(width(r.cells)) ?? 0) + 1)
  const common = [...widths.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]
  const headerAt = records.findIndex((r) => filled(r.cells) >= 3 && width(r.cells) === common)
  if (headerAt < 0) {
    return { headers: [], headerLine: 0, rows: [], setAside: records.map((r) => ({ line: r.line, text: shortText(r.text), reason: 'No line with column names was found.' })), delimiter }
  }
  for (const r of records.slice(0, headerAt)) {
    setAside.push({ line: r.line, text: shortText(r.text), reason: 'Above the column names.' })
  }
  const header = records[headerAt]
  // A trailing delimiter leaves an empty last name; drop empty names at the end.
  const headers = header.cells.map((h) => h.trim())
  while (headers.length > 0 && headers[headers.length - 1] === '') headers.pop()

  const rows: CsvRow[] = []
  for (const r of records.slice(headerAt + 1)) {
    const cells = r.cells.map((c) => c.trim())
    // Extra cells that are all empty are a trailing delimiter, not data.
    while (cells.length > headers.length && cells[cells.length - 1] === '') cells.pop()
    if (cells.length !== headers.length) {
      setAside.push({
        line: r.line,
        text: shortText(r.text),
        reason: `Has ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'} where the column names line has ${headers.length}.`,
      })
      continue
    }
    rows.push({ line: r.line, cells })
  }
  return { headers, headerLine: header.line, rows, setAside, delimiter }
}

/**
 * The file's layout as a fingerprint: its column names, in order, ignoring
 * case. A second file from the same broker has the same one, so its saved
 * layout is used without matching the columns again.
 */
export function headerSignature(headers: readonly string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).join('|')
}

// ─── The layout: which column is which ───────────────────────────────────────

/** How a date is written: year first, month first (US) or day first. */
export const DATE_ORDERS = ['YMD', 'MDY', 'DMY'] as const
export type DateOrder = (typeof DATE_ORDERS)[number]
export const DATE_ORDER_LABELS: Record<DateOrder, string> = {
  YMD: 'Year first (2026-03-14)',
  MDY: 'Month first, as in the US (03/14/2026)',
  DMY: 'Day first (14/03/2026)',
}

/** What a row of the file becomes. Splits and starting positions are entered by hand. */
export const IMPORT_SIDES = ['buy', 'sell', 'transfer_in', 'transfer_out', 'skip'] as const
export type ImportSide = (typeof IMPORT_SIDES)[number]
export const IMPORT_SIDE_LABELS: Record<ImportSide, string> = {
  buy: 'Buy',
  sell: 'Sell',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  skip: 'Leave out',
}

/** Which instrument a symbol in the file is. */
export type SymbolChoice =
  | { kind: 'security' }
  | { kind: 'coin'; coinId: string; name: string }
  | { kind: 'skip' }

export const LAYOUT_VERSION = 1

export interface ImportLayout {
  version: typeof LAYOUT_VERSION
  /** Column names, as the file writes them. */
  columns: {
    date: string
    symbol: string
    quantity: string
    price: string
    /** The column that says buy or sell. Not needed when the sign of the units says it. */
    action?: string
    fee?: string
    note?: string
  }
  dateOrder: DateOrder
  /** Where buy or sell comes from: a column of words, or the sign of the units (negative is a sale). */
  sideFrom: 'column' | 'quantity-sign'
  /** For sideFrom 'column': what each value in that column means. */
  actions: Record<string, ImportSide>
  /** What a symbol with no choice of its own is: a stock or fund, or a coin still to be picked. */
  holds: 'securities' | 'coins'
  /** The choice made for each symbol in the file. */
  symbols: Record<string, SymbolChoice>
}

const COLUMN_GUESSES: Record<keyof ImportLayout['columns'], RegExp[]> = {
  date: [/^trade date/i, /^date$/i, /^(run|transaction|activity|execution) date/i, /^(time(stamp)?|date ?time)$/i, /^(?!.*settle).*date/i],
  action: [/^action$/i, /transaction type/i, /^type$/i, /^side$/i, /activity type/i, /action|type|activity/i],
  symbol: [/^symbol$/i, /^ticker$/i, /^asset$/i, /symbol|ticker/i, /^(instrument|security)$/i],
  quantity: [/^quantity/i, /^(shares|units|qty)$/i, /quantity|shares|units|qty/i],
  price: [/^price/i, /share price/i, /price/i],
  fee: [/^fees?\b/i, /commission/i, /fee/i],
  note: [/^description$/i, /^notes?$/i, /^memo$/i, /description|notes?|memo/i],
}

/** The first column name matching each pattern, in order of the patterns, skipping names already taken. */
function guessColumn(headers: readonly string[], which: keyof ImportLayout['columns'], taken: Set<string>): string | undefined {
  for (const re of COLUMN_GUESSES[which]) {
    const hit = headers.find((h) => !taken.has(h) && re.test(h) && !(which === 'price' && /total|amount/i.test(h)))
    if (hit) return hit
  }
  return undefined
}

const parts = (raw: string) => raw.trim().split(/[\sT]/)[0].split(/[/\-.]/)

/** The date order the sample values allow: a first part over 31 is a year, a first part over 12 a day. */
export function guessDateOrder(values: readonly string[]): DateOrder {
  let dayFirst = false
  for (const v of values) {
    const p = parts(v)
    if (p.length !== 3) continue
    if (p[0].length === 4 || Number(p[0]) > 31) return 'YMD'
    if (Number(p[0]) > 12) dayFirst = true
  }
  return dayFirst ? 'DMY' : 'MDY'
}

/**
 * What a value in the "kind of trade" column most likely means, from its words.
 * Only a starting suggestion: the screen shows every value with its choice, and
 * the person changes any of them. Anything not plainly a buy, sale or transfer
 * of units (dividends, interest, deposits of cash, fees, conversions) is left out.
 */
export function guessSide(value: string): ImportSide {
  const v = value.toLowerCase()
  if (/\btransfer(red)? in\b|\breceived?\b|\bincoming\b/.test(v)) return 'transfer_in'
  if (/\btransfer(red)? out\b|\bsen[dt]\b|\bwithdraw(al|n)?\b|\boutgoing\b/.test(v)) return 'transfer_out'
  if (/\b(dividend|interest|fee|tax|deposit|journal|convert|conversion|reward|income|staking|split|merger|spin)/.test(v) && !/\breinvest/.test(v)) return 'skip'
  if (/\b(buy|bought|purchased?|reinvest(ed|ment)?)\b/.test(v)) return 'buy'
  if (/\b(sell|sold|sale)\b/.test(v)) return 'sell'
  return 'skip'
}

/** A layout guessed from the column names and the first rows. Never applied without being shown. */
export function guessLayout(table: CsvTable): ImportLayout {
  const taken = new Set<string>()
  const pick = (which: keyof ImportLayout['columns']) => {
    const h = guessColumn(table.headers, which, taken)
    if (h) taken.add(h)
    return h
  }
  const date = pick('date')
  const symbol = pick('symbol')
  const quantity = pick('quantity')
  const price = pick('price')
  const action = pick('action')
  const fee = pick('fee')
  const note = pick('note')
  const col = (name: string | undefined) => (name ? table.headers.indexOf(name) : -1)
  const sample = (name: string | undefined) => table.rows.slice(0, 50).map((r) => r.cells[col(name)] ?? '')
  const negativeUnits = sample(quantity).some((q) => /^\s*(-|\()/.test(q))
  return {
    version: LAYOUT_VERSION,
    columns: {
      date: date ?? '',
      symbol: symbol ?? '',
      quantity: quantity ?? '',
      price: price ?? '',
      ...(action ? { action } : {}),
      ...(fee ? { fee } : {}),
      ...(note ? { note } : {}),
    },
    dateOrder: guessDateOrder(sample(date)),
    sideFrom: action || !negativeUnits ? 'column' : 'quantity-sign',
    actions: {},
    holds: 'securities',
    symbols: {},
  }
}

/** A saved layout, checked: what the import route stores and what the screen reads back. Null when malformed. */
export function readLayout(raw: unknown): ImportLayout | null {
  if (typeof raw !== 'object' || raw === null) return null
  const l = raw as Record<string, unknown>
  const c = l.columns as Record<string, unknown> | undefined
  const str = (v: unknown, max = 200) => typeof v === 'string' && v.length <= max
  if (l.version !== LAYOUT_VERSION || typeof c !== 'object' || c === null) return null
  for (const k of ['date', 'symbol', 'quantity', 'price'] as const) if (!str(c[k])) return null
  for (const k of ['action', 'fee', 'note'] as const) if (c[k] !== undefined && !str(c[k])) return null
  if (!(DATE_ORDERS as readonly unknown[]).includes(l.dateOrder)) return null
  if (l.sideFrom !== 'column' && l.sideFrom !== 'quantity-sign') return null
  if (l.holds !== 'securities' && l.holds !== 'coins') return null
  const actions = l.actions as Record<string, unknown>
  const symbols = l.symbols as Record<string, unknown>
  if (typeof actions !== 'object' || actions === null || typeof symbols !== 'object' || symbols === null) return null
  if (Object.keys(actions).length > MAX_DISTINCT_VALUES * 4 || Object.keys(symbols).length > MAX_DISTINCT_VALUES * 4) return null
  const outActions: Record<string, ImportSide> = {}
  for (const [k, v] of Object.entries(actions)) {
    if (!str(k, 500) || !(IMPORT_SIDES as readonly unknown[]).includes(v)) return null
    outActions[k] = v as ImportSide
  }
  const outSymbols: Record<string, SymbolChoice> = {}
  for (const [k, v] of Object.entries(symbols)) {
    const s = v as Record<string, unknown> | null
    if (!str(k, 100) || typeof s !== 'object' || s === null) return null
    if (s.kind === 'security' || s.kind === 'skip') outSymbols[k] = { kind: s.kind }
    else if (s.kind === 'coin' && str(s.coinId, 64) && /^[a-z0-9][a-z0-9-]*$/.test(s.coinId as string) && str(s.name)) {
      outSymbols[k] = { kind: 'coin', coinId: s.coinId as string, name: s.name as string }
    } else return null
  }
  return {
    version: LAYOUT_VERSION,
    columns: {
      date: c.date as string, symbol: c.symbol as string, quantity: c.quantity as string, price: c.price as string,
      ...(c.action ? { action: c.action as string } : {}),
      ...(c.fee ? { fee: c.fee as string } : {}),
      ...(c.note ? { note: c.note as string } : {}),
    },
    dateOrder: l.dateOrder as DateOrder,
    sideFrom: l.sideFrom,
    actions: outActions,
    holds: l.holds,
    symbols: outSymbols,
  }
}

// ─── Distinct values, for the two tables the person fills in ─────────────────

export interface DistinctValue { value: string; rows: number }

/** Each different value in a column, with how many rows carry it, most common first. */
export function distinctValues(table: CsvTable, column: string | undefined): DistinctValue[] {
  const i = column ? table.headers.indexOf(column) : -1
  if (i < 0) return []
  const counts = new Map<string, number>()
  for (const r of table.rows) {
    const v = r.cells[i].trim()
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, rows]) => ({ value, rows }))
    .sort((a, b) => b.rows - a.rows || a.value.localeCompare(b.value))
}

/**
 * The layout with a choice for every value of the "kind of trade" column in
 * this file: the one saved before, or else the guess. A value not in the file
 * keeps its saved choice, so a layout grows as more files are read.
 */
export function withActionChoices(layout: ImportLayout, table: CsvTable): ImportLayout {
  if (layout.sideFrom !== 'column') return layout
  const actions = { ...layout.actions }
  for (const { value } of distinctValues(table, layout.columns.action)) {
    if (!(value in actions)) actions[value] = guessSide(value)
  }
  return { ...layout, actions }
}

/** Currency codes a file uses for its cash rows ("USD" on a deposit). Cash is not a holding here. */
export const CASH_SYMBOLS: ReadonlySet<string> = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CASH'])

/** The choice for a symbol: the one made, or what the file's kind and the symbol itself suggest. Null means a coin still to pick. */
export function symbolChoice(layout: ImportLayout, symbol: string): SymbolChoice | null {
  const made = layout.symbols[symbol]
  if (made) return made
  if (CASH_SYMBOLS.has(symbol.trim().toUpperCase())) return { kind: 'skip' }
  return layout.holds === 'securities' ? { kind: 'security' } : null
}

/** Catalog coins with this ticker, as suggestions for the person to pick from. Never chosen for them. */
export function coinSuggestions(symbol: string): Array<{ coinId: string; name: string; symbol: string }> {
  const s = symbol.trim().toUpperCase()
  return INSTRUMENTS.filter((i) => i.class === 'crypto' && i.symbol.toUpperCase() === s)
    .map((i) => ({ coinId: i.key, name: i.name, symbol: i.symbol }))
}

// ─── Tickers ─────────────────────────────────────────────────────────────────

/**
 * A stock or fund ticker as the app writes it, or null when the text is not one.
 * Upper case; a class share written "BRK.B" or "BRK/B" becomes "BRK-B", the
 * form every price source here accepts; the asterisks some brokers put after a
 * money market fund ("SPAXX**") are dropped. Option symbols and anything longer
 * than ten characters are refused, since a tracked portfolio holds no options.
 */
export function normaliseTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/\*+$/, '').replace(/[./](?=[A-Z]{1,2}$)/, '-')
  return /^[A-Z][A-Z0-9-]{0,9}$/.test(t) ? t : null
}

// ─── Numbers and dates ───────────────────────────────────────────────────────

type Read<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * A number as the file writes it, read as text: "$1,234.50", "(45.00)" for a
 * negative, "-0.5", "1.2E-5" (how a spreadsheet writes a small number). Returns
 * the digits with its sign separate, so nothing passes through floating point.
 */
export function readNumber(raw: string): Read<{ negative: boolean; digits: string }> {
  let s = raw.trim()
  if (s === '') return { ok: false, error: 'is empty' }
  if (/[€£¥₹₩]|\b(EUR|GBP|JPY|CAD|AUD|CHF)\b/i.test(s)) return { ok: false, error: `"${raw}" is not in US dollars` }
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim() }
  s = s.replace(/\bUSD\b/i, '').replace(/\$/g, '').trim()
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1).trim() } else if (s.startsWith('+')) s = s.slice(1).trim()
  if (s.endsWith('-')) { negative = !negative; s = s.slice(0, -1).trim() }
  s = s.replace(/\$/g, '').trim()
  if (s.includes(',')) {
    // Thousands separators only: every comma followed by exactly three digits, before any decimal point.
    if (!/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) return { ok: false, error: `"${raw}" uses a comma in a way that is not a thousands separator. Numbers must use a decimal point` }
    s = s.replace(/,/g, '')
  }
  const exp = /^(\d+)(?:\.(\d*))?[eE]([+-]?\d{1,3})$/.exec(s)
  if (exp) {
    const [, whole, frac = '', e] = exp
    const all = whole + frac
    const point = whole.length + Number(e)
    s = point <= 0 ? `0.${'0'.repeat(-point)}${all}` : point >= all.length ? all + '0'.repeat(point - all.length) : `${all.slice(0, point)}.${all.slice(point)}`
  }
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return { ok: false, error: `"${raw}" is not a number` }
  if (s.startsWith('.')) s = `0${s}`
  s = s.replace(/^0+(?=\d)/, '')
  return { ok: true, value: { negative, digits: s } }
}

const isZeroDigits = (d: string) => !/[1-9]/.test(d)

/**
 * A date in the given order, as "YYYY-MM-DD", or the reason it is not one.
 * Anything after the date (a time, "UTC") is read only to find where the date
 * ends: trades are dated by day here, as the trade form dates them.
 */
export function readDate(raw: string, order: DateOrder): Read<string> {
  const s = raw.trim()
  if (!s) return { ok: false, error: 'has no date' }
  const p = parts(s).map((x) => x.trim())
  if (p.length !== 3 || p.some((x) => !/^\d{1,4}$/.test(x))) return { ok: false, error: `"${raw}" is not a date written with numbers` }
  let [y, m, d] = [0, 0, 0]
  const n = p.map(Number)
  if (order === 'YMD') [y, m, d] = n
  else if (order === 'MDY') [m, d, y] = n
  else [d, m, y] = n
  const yearText = order === 'YMD' ? p[0] : p[2]
  if (yearText.length === 2) y += 2000
  else if (yearText.length !== 4) return { ok: false, error: `"${raw}" does not have a four-digit year in the place the date order puts it` }
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (m < 1 || m > 12 || d < 1 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, error: `"${raw}" is not a real date when read ${order === 'YMD' ? 'year first' : order === 'MDY' ? 'month first' : 'day first'}` }
  }
  return { ok: true, value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

// ─── Planning the import ─────────────────────────────────────────────────────

/** A trade as the import route takes it: the trade route's own shape, without the hand-only kinds. */
export interface ImportTrade {
  instrument: string
  name: string
  side: 'buy' | 'sell' | 'transfer_in' | 'transfer_out'
  quantity: string
  pricePerUnit: string
  feeUsd: string
  executedAt: string
  note?: string
}

export type PlannedRow =
  | { line: number; status: 'ready'; trade: ImportTrade; symbol: string; action: string }
  | { line: number; status: 'left-out' | 'refused'; reason: string; symbol: string; action: string }

export interface ImportPlan {
  rows: PlannedRow[]
  ready: number
  leftOut: number
  refused: number
  /** A problem with the layout itself, such as a column it names that the file does not have. Nothing is ready while it stands. */
  layoutProblem: string | null
}

/** Why the layout cannot be used with this file, or null. */
export function layoutProblem(layout: ImportLayout, table: CsvTable): string | null {
  const need: Array<[string, string | undefined]> = [
    ['date', layout.columns.date], ['symbol', layout.columns.symbol],
    ['units', layout.columns.quantity], ['price', layout.columns.price],
  ]
  if (layout.sideFrom === 'column') need.push(['kind of trade', layout.columns.action])
  for (const [label, name] of need) {
    if (!name) return `Choose the ${label} column.`
    if (!table.headers.includes(name)) return `The file has no column named "${name}" (the ${label} column).`
  }
  for (const [label, name] of [['fee', layout.columns.fee], ['note', layout.columns.note]] as const) {
    if (name && !table.headers.includes(name)) return `The file has no column named "${name}" (the ${label} column).`
  }
  const chosen = [layout.columns.date, layout.columns.symbol, layout.columns.quantity, layout.columns.price,
    layout.sideFrom === 'column' ? layout.columns.action : undefined, layout.columns.fee, layout.columns.note].filter(Boolean)
  if (new Set(chosen).size !== chosen.length) return 'The same column is chosen for two things.'
  return null
}

/** Turns one row into a trade, or says why it is left out or refused. */
function planRow(row: CsvRow, layout: ImportLayout, col: (name: string | undefined) => string, now: Date): PlannedRow {
  const symbol = col(layout.columns.symbol)
  const action = layout.sideFrom === 'column' ? col(layout.columns.action) : ''
  const out = (status: 'left-out' | 'refused', reason: string): PlannedRow => ({ line: row.line, status, reason, symbol, action })

  // The kind of trade.
  let side: ImportSide
  const units = readNumber(col(layout.columns.quantity))
  if (layout.sideFrom === 'column') {
    if (!action) return out('refused', 'The kind of trade is empty.')
    const chosen = layout.actions[action]
    if (!chosen) return out('refused', `No choice is made for "${action}".`)
    side = chosen
    if (side === 'skip') return out('left-out', `"${action}" is set to be left out.`)
  } else {
    if (!units.ok) return out('refused', `The units ${units.error}.`)
    side = units.value.negative ? 'sell' : 'buy'
  }

  // The instrument. A coin only by the person's own choice (D190).
  if (!symbol) return out('refused', 'The symbol is empty.')
  const choice = symbolChoice(layout, symbol)
  if (!choice) return out('refused', `Choose which coin "${symbol}" is.`)
  if (choice.kind === 'skip') {
    return out('left-out', layout.symbols[symbol] ? `"${symbol}" is set to be left out.` : `"${symbol}" is cash, not a holding.`)
  }
  let instrument: string
  let name: string
  if (choice.kind === 'coin') {
    instrument = choice.coinId
    name = choice.name
  } else {
    const ticker = normaliseTicker(symbol)
    if (!ticker) return out('refused', `"${symbol}" does not look like a stock or fund ticker. If it is a coin, choose which one; otherwise leave it out.`)
    instrument = `${SEC_PREFIX}${ticker}`
    name = INSTRUMENT_BY_KEY[instrument]?.name ?? ticker
  }

  // The date, the units, the price and the fee.
  const date = readDate(col(layout.columns.date), layout.dateOrder)
  if (!date.ok) return out('refused', `The date ${date.error}.`)
  if (!units.ok) return out('refused', `The units ${units.error}.`)
  if (isZeroDigits(units.value.digits)) return out('refused', 'The units are 0.')

  const priceCell = col(layout.columns.price)
  let pricePerUnit = '0'
  if (priceCell === '' && side === 'transfer_out') {
    pricePerUnit = '0'
  } else {
    const price = readNumber(priceCell)
    if (!price.ok) return out('refused', `The price ${price.error}.`)
    if (price.value.negative) return out('refused', `The price "${priceCell}" is below zero.`)
    pricePerUnit = price.value.digits
  }

  let feeUsd = '0'
  const feeCell = layout.columns.fee ? col(layout.columns.fee) : ''
  if (feeCell !== '') {
    const fee = readNumber(feeCell)
    if (!fee.ok) return out('refused', `The fee ${fee.error}.`)
    // Brokers write a fee as money out, often with a minus sign; it is a cost either way.
    feeUsd = fee.value.digits
  }

  let note = layout.columns.note ? col(layout.columns.note).replace(/\s+/g, ' ').trim() : ''
  if (note.length > MAX_NOTE_LENGTH) note = `${note.slice(0, MAX_NOTE_LENGTH - 1)}…`

  const trade: ImportTrade = {
    instrument, name, side,
    quantity: units.value.digits, pricePerUnit, feeUsd,
    executedAt: date.value,
    ...(note ? { note } : {}),
  }
  // The trade route's own checks, so the screen and the route can never disagree.
  const checked = parseTradeInput(trade, now)
  if (!checked.ok) return out('refused', checked.error)
  return { line: row.line, status: 'ready', trade, symbol, action }
}

/** Every row of the file, as what it becomes. */
export function planImport(table: CsvTable, layout: ImportLayout, now: Date = new Date()): ImportPlan {
  const problem = layoutProblem(layout, table)
  if (problem) return { rows: [], ready: 0, leftOut: 0, refused: 0, layoutProblem: problem }
  const index = new Map(table.headers.map((h, i) => [h, i] as const))
  const rows = table.rows.map((row) => {
    const col = (name: string | undefined) => (name && index.has(name) ? row.cells[index.get(name)!] ?? '' : '').trim()
    return planRow(row, layout, col, now)
  })
  return {
    rows,
    ready: rows.filter((r) => r.status === 'ready').length,
    leftOut: rows.filter((r) => r.status === 'left-out').length,
    refused: rows.filter((r) => r.status === 'refused').length,
    layoutProblem: null,
  }
}

// ─── Recognising a row already imported ──────────────────────────────────────

/** The figures of a trade, without the zeros a column pads them with. */
const canon = (v: string) => {
  const t = trimDecimal(v).replace(/^0+(?=\d)/, '')
  return t === '' ? '0' : t
}

/** What identifies a trade for spotting a repeat: its day, kind, instrument and figures. */
export function tradeIdentity(t: Pick<NewTrade, 'executedAt' | 'side' | 'instrumentKey' | 'quantity' | 'pricePerUnit' | 'feeUsd'>): string {
  const day = t.executedAt ? t.executedAt.toISOString().slice(0, 10) : 'undated'
  return [day, t.side, t.instrumentKey, canon(t.quantity), canon(t.pricePerUnit), canon(t.feeUsd)].join('|')
}

/**
 * A fingerprint for each trade of an import, in the file's order. Two identical
 * rows in one file are two real trades (two buys of the same amount on the same
 * day), so each carries how many times it has been seen so far: uploading the
 * same file again gives the same fingerprints, and its rows are recognised.
 */
export function importFingerprints(trades: ReadonlyArray<Parameters<typeof tradeIdentity>[0]>): string[] {
  const seen = new Map<string, number>()
  return trades.map((t) => {
    const id = tradeIdentity(t)
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    return `${id}#${n}`
  })
}

/** The same trade without its fee: a trade typed by hand may give the fee differently, or not at all. */
export function looseIdentity(t: Pick<NewTrade, 'executedAt' | 'side' | 'instrumentKey' | 'quantity' | 'pricePerUnit'>): string {
  const day = t.executedAt ? t.executedAt.toISOString().slice(0, 10) : 'undated'
  return [day, t.side, t.instrumentKey, canon(t.quantity), canon(t.pricePerUnit)].join('|')
}

/** The reason a whole import's trades were cancelled, as each cancellation keeps it. */
export function importCancelReason(fileName: string, reason: string): string {
  const name = fileName.length > 80 ? `${fileName.slice(0, 79)}…` : fileName
  const base = `Whole import cancelled (${name || 'a file'})`
  const text = reason ? `${base}: ${reason}` : base
  return text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH - 1)}…` : text
}

// ─── What the import route receives and decides ──────────────────────────────

/** The longest file name kept with an import. */
export const MAX_FILE_NAME_LENGTH = 200

export interface ImportRequest {
  fileName: string
  headerSignature: string
  /** The ready rows, in the file's order, each checked again here with parseTradeInput. */
  rows: Array<{ line: number; trade: NewTrade }>
  /** Lines of rows that look already recorded by hand, to be saved anyway. */
  include: Set<number>
  /** Check only: say what would be saved, save nothing. */
  dryRun: boolean
  /** The layout to remember for this kind of file, saved with the import. */
  layout: ImportLayout | null
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The import request as the screen sent it, every row checked again with the
 * trade route's own rules. One bad row refuses the whole request, naming its
 * line, and nothing is saved: the screen only sends rows it found ready, so a
 * row failing here means the two disagree, and saving the rest would hide it.
 */
export function parseImportRequest(body: unknown, now: Date = new Date()): { ok: true; value: ImportRequest } | { ok: false; error: string } {
  if (!isObj(body)) return { ok: false, error: 'Expected an import as a JSON object.' }
  if (!Array.isArray(body.rows) || body.rows.length === 0) return { ok: false, error: 'There are no rows to import.' }
  if (body.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `One import takes at most ${MAX_IMPORT_ROWS.toLocaleString('en-US')} rows. Split the file into smaller ones.` }
  }
  const rows: ImportRequest['rows'] = []
  const lines = new Set<number>()
  for (const r of body.rows) {
    if (!isObj(r) || !Number.isSafeInteger(r.line) || (r.line as number) < 1) return { ok: false, error: 'Each row needs the line of the file it came from.' }
    const line = r.line as number
    if (lines.has(line)) return { ok: false, error: `Line ${line} is sent twice.` }
    lines.add(line)
    if (!isObj(r.trade)) return { ok: false, error: `Line ${line} has no trade.` }
    if (r.trade.opening === true || r.trade.side === 'split') {
      return { ok: false, error: `Line ${line}: an import records buys, sells and transfers. Starting positions and splits are entered by hand.` }
    }
    const parsed = parseTradeInput(r.trade, now)
    if (!parsed.ok) return { ok: false, error: `Line ${line}: ${parsed.error} Nothing was saved.` }
    rows.push({ line, trade: parsed.value })
  }
  const include = new Set<number>()
  if (body.include !== undefined) {
    if (!Array.isArray(body.include) || body.include.some((l) => !Number.isSafeInteger(l))) return { ok: false, error: '"include" must be a list of line numbers.' }
    for (const l of body.include as number[]) include.add(l)
  }
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  let layout: ImportLayout | null = null
  if (body.layout !== undefined && body.layout !== null) {
    layout = readLayout(body.layout)
    if (!layout) return { ok: false, error: 'The layout to remember is not in the expected form.' }
  }
  return {
    ok: true,
    value: {
      fileName: text(body.fileName, MAX_FILE_NAME_LENGTH),
      headerSignature: text(body.headerSignature, 2000),
      rows,
      include,
      dryRun: body.dryRun === true,
      layout,
    },
  }
}

export type ImportRowStatus = 'new' | 'already-imported' | 'looks-recorded'

/** What the database already holds for the portfolio, as the import compares against it. */
export interface ExistingForImport {
  /** Fingerprints of imported trades that still count (a cancelled one does not: its row may be imported again). */
  importedFingerprints: ReadonlySet<string>
  /** Trades typed by hand that still count, by looseIdentity, with how many share it. */
  typedTrades: ReadonlyMap<string, number>
}

/**
 * Each row's status. A row whose fingerprint an earlier import saved is not
 * saved again. A row matching a trade typed by hand (same day, kind,
 * instrument, units and price) is held back unless the person includes it,
 * since it is most likely the same trade; each typed trade matches one row at most.
 */
export function classifyImport(
  rows: ReadonlyArray<{ line: number; trade: NewTrade }>,
  existing: ExistingForImport,
): Array<{ line: number; status: ImportRowStatus; fingerprint: string }> {
  const fingerprints = importFingerprints(rows.map((r) => r.trade))
  const typedLeft = new Map(existing.typedTrades)
  return rows.map((r, i) => {
    const fingerprint = fingerprints[i]
    if (existing.importedFingerprints.has(fingerprint)) return { line: r.line, status: 'already-imported', fingerprint }
    const loose = looseIdentity(r.trade)
    const n = typedLeft.get(loose) ?? 0
    if (n > 0) {
      typedLeft.set(loose, n - 1)
      return { line: r.line, status: 'looks-recorded', fingerprint }
    }
    return { line: r.line, status: 'new', fingerprint }
  })
}

/** The rows the import saves: new ones, and those looking already recorded that the person included. */
export function rowsToSave<T extends { line: number; status: ImportRowStatus }>(statuses: readonly T[], include: ReadonlySet<number>): T[] {
  return statuses.filter((s) => s.status === 'new' || (s.status === 'looks-recorded' && include.has(s.line)))
}

/**
 * What the lot engine would say about the imported rows once saved beside the
 * trades already recorded: a sale of more than was held, a trade dated before a
 * starting position. Each with the line it is about. Shown before saving; it
 * does not stop the import, since the person may add the missing history after.
 */
export function importIssues(
  existing: { trades: readonly StoredTrade[]; cancellations: readonly StoredCancellation[] },
  toSave: ReadonlyArray<{ line: number; trade: NewTrade }>,
  now: Date = new Date(),
): Array<{ line: number; message: string }> {
  const idFor = (line: number) => `import-line-${line}`
  const lineOf = new Map(toSave.map((r) => [idFor(r.line), r.line]))
  const added: StoredTrade[] = toSave.map((r) => ({
    id: idFor(r.line),
    instrumentKey: r.trade.instrumentKey,
    symbol: r.trade.instrumentKey,
    name: r.trade.nameHint,
    side: r.trade.side,
    quantity: r.trade.quantity,
    pricePerUnit: r.trade.pricePerUnit,
    feeUsd: r.trade.feeUsd,
    executedAt: r.trade.executedAt,
    opening: false,
    note: r.trade.note,
    createdAt: now,
    split: null,
  }))
  const view = buildLedgerView([...existing.trades, ...added], existing.cancellations, now)
  const out: Array<{ line: number; message: string }> = []
  for (const h of view.holdings) {
    for (const issue of h.basis.issues) {
      const line = lineOf.get(issue.tradeId)
      if (line !== undefined) out.push({ line, message: issue.message })
    }
  }
  return out.sort((a, b) => a.line - b.line)
}
