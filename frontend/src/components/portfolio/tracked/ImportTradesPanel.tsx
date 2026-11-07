'use client'

import { useId, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, FileUp, Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import { retryUnlessAnswered, trackedApi, TrackedApiError } from '@/lib/api/trackedPortfolios'
import type { ImportCheckResponse } from '@/app/api/user/tracked-portfolios/[id]/imports/route'
import {
  DATE_ORDERS, DATE_ORDER_LABELS, IMPORT_SIDES, IMPORT_SIDE_LABELS, MAX_DISTINCT_VALUES, MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS, coinSuggestions, distinctValues, guessLayout, headerSignature, normaliseTicker, planImport,
  readCsv, symbolChoice, withActionChoices,
  type CsvTable, type ImportLayout, type ImportSide, type PlannedRow,
} from '@/lib/data/tradeImport'
import { INSTRUMENT_BY_KEY, SEC_PREFIX } from '@/lib/data/instruments'
import { formatUnitPrice, formatUnits, tradeKindLabel } from '@/lib/data/tradeLedger'
import { useInstrumentSearch } from '@/components/portfolio/useInstrumentSearch'
import { formatRecordedDate, formatTradeDate } from './TradesTable'

// "Import trades from a file" on a tracked portfolio (T-447, owner decisions
// D197 and D200). The file is read here, in the browser, and never sent: the
// person matches its columns once, says what each kind of row means and which
// instrument each symbol is, sees every row and what it becomes, and only then
// saves. The server checks every row again (parseTradeInput) and saves them
// together or not at all. A whole import can be cancelled in one step, which
// adds a cancellation for each of its trades and removes nothing.

const inputCls = 'w-full bg-bg-elevated border border-border rounded-sm px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent-blue'
const labelCls = 'block text-xs text-text-muted mb-1 font-medium'
/** A small select sitting in a row, so not full width. */
const selectCls = 'bg-bg-elevated border border-border rounded-sm px-2 py-1 text-xs text-text-primary focus:outline-hidden focus:border-accent-blue'
const ROWS_SHOWN = 500
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

type ColumnKey = keyof ImportLayout['columns']
const COLUMN_FIELDS: Array<{ key: ColumnKey; label: string; optional?: boolean; hint?: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'action', label: 'Kind of trade', hint: 'The column saying buy, sell and so on.' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'quantity', label: 'Units' },
  { key: 'price', label: 'Price per unit (USD)' },
  { key: 'fee', label: 'Fee (USD)', optional: true },
  { key: 'note', label: 'Note', optional: true },
]

type Loaded = { fileName: string; table: CsvTable; signature: string; savedLayout: boolean }

function CoinPicker({ symbol, onPick, onClose }: {
  symbol: string
  onPick: (coinId: string, name: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(symbol)
  const results = useInstrumentSearch(query, { classes: CRYPTO_ONLY })
  const suggestions = coinSuggestions(symbol)
  return (
    <div className="mt-2 rounded-lg border border-border bg-bg-elevated/50 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-muted">Which coin is “{symbol}”? Several coins can share a ticker, so the app does not guess.</span>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-text-muted hover:text-text-primary"><X size={13} /></button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button type="button" key={s.coinId} onClick={() => onPick(s.coinId, s.name)}
              className="px-2 py-1 rounded-sm border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue">
              {s.name} <span className="text-text-muted">({s.coinId})</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
        <input className={clsx(inputCls, 'pl-8')} value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search for the coin “${symbol}” is`} placeholder="Search for a coin by name or ticker…" />
      </div>
      {query.trim() && (
        <div className="border border-border rounded-lg divide-y divide-border/50 max-h-40 overflow-y-auto">
          {results.length === 0
            ? <div className="py-2 text-center text-xs text-text-muted">No coin matches.</div>
            : results.map((c) => (
              <button type="button" key={c.key} onClick={() => onPick(c.key, c.name)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-elevated text-left">
                <span className="text-xs font-semibold text-text-primary">{c.symbol}</span>
                <span className="text-xs text-text-muted truncate flex-1">{c.name}</span>
                <span className="text-[10px] text-text-muted">{c.key}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

const CRYPTO_ONLY: ReadonlySet<'crypto'> = new Set(['crypto'])

/** What a row will be, in words, combining the screen's reading and the server's check. */
function rowStatus(r: PlannedRow, server: Map<number, string> | null, include: Set<number>): { label: string; tone: string; saves: boolean } {
  if (r.status === 'left-out') return { label: 'Left out', tone: 'text-text-muted', saves: false }
  if (r.status === 'refused') return { label: 'Not readable', tone: 'text-red-400', saves: false }
  const s = server?.get(r.line)
  if (s === 'already-imported') return { label: 'Already imported', tone: 'text-text-muted', saves: false }
  if (s === 'looks-recorded') {
    return include.has(r.line)
      ? { label: 'Looks already recorded: saving anyway', tone: 'text-amber-400', saves: true }
      : { label: 'Looks already recorded', tone: 'text-amber-400', saves: false }
  }
  return { label: server ? 'Will be saved' : 'Ready', tone: 'text-emerald-400', saves: true }
}

export function ImportTradesPanel({ portfolioId, onSaved }: {
  portfolioId: string
  /** Reloads the ledger after an import is saved or cancelled. */
  onSaved: () => Promise<void>
}) {
  const uid = useId()
  const qc = useQueryClient()
  const importsKey = ['tracked-imports', portfolioId]
  const imports = useQuery({ queryKey: importsKey, queryFn: () => trackedApi.imports(portfolioId), retry: retryUnlessAnswered })

  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [layout, setLayout] = useState<ImportLayout | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [check, setCheck] = useState<ImportCheckResponse | null>(null)
  const [include, setInclude] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<'check' | 'save' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [show, setShow] = useState<'all' | 'saved' | 'not-saved'>('all')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const table = loaded?.table ?? null
  const plan = useMemo(() => (table && layout ? planImport(table, layout) : null), [table, layout])
  const serverStatus = useMemo(() => (check?.rows ? new Map(check.rows.map((r) => [r.line, r.status])) : null), [check])
  const readyRows = useMemo(() => (plan?.rows ?? []).flatMap((r) => (r.status === 'ready' ? [{ line: r.line, trade: r.trade }] : [])), [plan])
  const actionColumn = layout?.sideFrom === 'column' ? layout.columns.action : undefined
  const symbolColumn = layout?.columns.symbol
  const actionValues = useMemo(() => (table && actionColumn ? distinctValues(table, actionColumn) : []), [table, actionColumn])
  const symbolValues = useMemo(() => (table && symbolColumn ? distinctValues(table, symbolColumn) : []), [table, symbolColumn])
  const issuesByLine = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const i of check?.issues ?? []) m.set(i.line, [...(m.get(i.line) ?? []), i.message])
    return m
  }, [check])

  const migrationMissing = imports.error instanceof TrackedApiError && imports.error.status === 503
  const pastImports = imports.data?.imports ?? []

  /** Any change to how the file is read makes the last check stale. */
  function changeLayout(next: ImportLayout) {
    setLayout(table ? withActionChoices(next, table) : next)
    setCheck(null)
    setError(null)
  }

  function reset() {
    setLoaded(null)
    setLayout(null)
    setCheck(null)
    setInclude(new Set())
    setError(null)
    setFileError(null)
    setPickingFor(null)
  }

  async function chooseFile(file: File | undefined) {
    reset()
    if (!file) return
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setFileError(`This file is ${(file.size / 1_000_000).toFixed(1)} MB. The most one import reads is ${(MAX_IMPORT_FILE_BYTES / 1_000_000).toFixed(0)} MB; split it into smaller files.`)
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setFileError('The file could not be read.')
      return
    }
    const t = readCsv(text)
    if (t.headers.length === 0) {
      setFileError('No line with column names was found. The file must be a CSV export, with one row per trade.')
      return
    }
    if (t.rows.length === 0) {
      setFileError('The file has column names but no rows below them.')
      return
    }
    if (t.rows.length > MAX_IMPORT_ROWS) {
      setFileError(`The file has ${plural(t.rows.length, 'row')}. One import takes at most ${MAX_IMPORT_ROWS.toLocaleString('en-US')}; split it into smaller files, by year for example.`)
      return
    }
    const signature = headerSignature(t.headers)
    const saved = imports.data?.layouts.find((l) => l.headerSignature === signature)?.layout
    setLoaded({ fileName: file.name, table: t, signature, savedLayout: !!saved })
    setLayout(withActionChoices(saved ?? guessLayout(t), t))
  }

  function setColumn(key: ColumnKey, value: string) {
    if (!layout) return
    const columns = { ...layout.columns }
    if (value) columns[key] = value
    else if (key === 'fee' || key === 'note' || key === 'action') delete columns[key]
    else columns[key] = ''
    changeLayout({ ...layout, columns })
  }

  function setAction(value: string, side: ImportSide) {
    if (layout) changeLayout({ ...layout, actions: { ...layout.actions, [value]: side } })
  }

  function setSymbolKind(symbol: string, kind: 'security' | 'coin' | 'skip') {
    if (!layout) return
    if (kind === 'coin') { setPickingFor(symbol); return }
    setPickingFor(null)
    changeLayout({ ...layout, symbols: { ...layout.symbols, [symbol]: { kind } } })
  }

  function pickCoin(symbol: string, coinId: string, name: string) {
    if (!layout) return
    setPickingFor(null)
    changeLayout({ ...layout, symbols: { ...layout.symbols, [symbol]: { kind: 'coin', coinId, name } } })
  }

  const body = () => ({
    fileName: loaded?.fileName ?? '',
    headerSignature: loaded?.signature ?? '',
    rows: readyRows,
  })

  async function runCheck() {
    setBusy('check')
    setError(null)
    try {
      const res = await trackedApi.checkImport(portfolioId, body())
      setCheck(res)
      setInclude(new Set())
    } catch (e) {
      setError(errorText(e, 'The rows could not be checked.'))
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (!layout) return
    setBusy('save')
    setError(null)
    try {
      const res = await trackedApi.saveImport(portfolioId, { ...body(), include: [...include], layout })
      await Promise.all([onSaved(), qc.invalidateQueries({ queryKey: importsKey })])
      const parts = [`Saved ${plural(res.saved ?? 0, 'trade')}`]
      if (res.skippedRepeats) parts.push(`${plural(res.skippedRepeats, 'row')} already imported`)
      if (res.heldBack) parts.push(`${plural(res.heldBack, 'row')} held back as already recorded`)
      toast.success(parts.join('; '))
      reset()
      setOpen(false)
    } catch (e) {
      setError(errorText(e, 'The import was not saved.'))
    } finally {
      setBusy(null)
    }
  }

  async function cancelWhole(importId: string) {
    setBusy('cancel')
    setError(null)
    try {
      const res = await trackedApi.cancelImport(portfolioId, importId, cancelReason.trim())
      await Promise.all([onSaved(), qc.invalidateQueries({ queryKey: importsKey })])
      toast.success(`Cancelled ${plural(res.cancelled, 'trade')}${res.alreadyCancelled ? ` (${res.alreadyCancelled} already cancelled)` : ''}`)
      setCancelling(null)
      setCancelReason('')
    } catch (e) {
      setError(errorText(e, 'The import was not cancelled.'))
    } finally {
      setBusy(null)
    }
  }

  const willSave = plan ? plan.rows.filter((r) => rowStatus(r, serverStatus, include).saves).length : 0
  const shownRows = (plan?.rows ?? []).filter((r) => {
    if (show === 'all') return true
    const saves = rowStatus(r, serverStatus, include).saves
    return show === 'saved' ? saves : !saves
  })
  const coinsUnchosen = symbolValues.filter((v) => layout && !symbolChoice(layout, v.value)).length
  const headerOptions = table?.headers ?? []

  return (
    <section className="bg-bg-card border border-border rounded-xl p-4 space-y-4" aria-labelledby={`${uid}-title`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`${uid}-title`} className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileUp size={15} className="text-accent-blue" aria-hidden /> Import trades from a file
          </h3>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            A CSV file of trades exported from a broker or exchange. You match its columns once; every row is shown with what it
            becomes before anything is saved. The file stays in your browser: only the trades read from it are sent.
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue">
            Choose a file
          </button>
        )}
      </div>

      {migrationMissing && (
        <p className="text-xs text-amber-400" role="alert">{errorText(imports.error, '')}</p>
      )}

      {open && !migrationMissing && (
        <div className="space-y-5">
          {/* 1. The file */}
          <div>
            <label htmlFor={`${uid}-file`} className={labelCls}>1. The file</label>
            <input id={`${uid}-file`} type="file" accept=".csv,text/csv,.txt,text/plain"
              onChange={(e) => void chooseFile(e.target.files?.[0])}
              className="block w-full text-xs text-text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-bg-elevated file:text-text-primary" />
            {fileError && <p className="text-xs text-red-400 mt-2" role="alert">{fileError}</p>}
            {loaded && table && (
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                {loaded.fileName}: {plural(table.rows.length, 'row')} below the column names on line {table.headerLine}.
                {loaded.savedLayout && ' Using the layout you saved for files with these columns.'}
                {table.setAside.length > 0 && ` ${plural(table.setAside.length, 'line')} set aside (listed below the rows).`}
              </p>
            )}
          </div>

          {table && layout && (
            <>
              {/* 2. Columns */}
              <fieldset className="space-y-3">
                <legend className={labelCls}>2. Which column is which</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {COLUMN_FIELDS.filter((f) => f.key !== 'action' || layout.sideFrom === 'column').map((f) => (
                    <div key={f.key}>
                      <label htmlFor={`${uid}-col-${f.key}`} className={labelCls}>{f.label}{f.optional ? ' (optional)' : ''}</label>
                      <select id={`${uid}-col-${f.key}`} className={inputCls} value={layout.columns[f.key] ?? ''}
                        onChange={(e) => setColumn(f.key, e.target.value)}>
                        <option value="">{f.optional ? 'None' : 'Choose a column'}</option>
                        {headerOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label htmlFor={`${uid}-dates`} className={labelCls}>How dates are written</label>
                    <select id={`${uid}-dates`} className={inputCls} value={layout.dateOrder}
                      onChange={(e) => changeLayout({ ...layout, dateOrder: e.target.value as ImportLayout['dateOrder'] })}>
                      {DATE_ORDERS.map((d) => <option key={d} value={d}>{DATE_ORDER_LABELS[d]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${uid}-side`} className={labelCls}>Buy or sell is told by</label>
                    <select id={`${uid}-side`} className={inputCls} value={layout.sideFrom}
                      onChange={(e) => changeLayout({ ...layout, sideFrom: e.target.value as ImportLayout['sideFrom'] })}>
                      <option value="column">A column of words</option>
                      <option value="quantity-sign">The units: negative is a sale</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${uid}-holds`} className={labelCls}>The file holds</label>
                    <select id={`${uid}-holds`} className={inputCls} value={layout.holds}
                      onChange={(e) => changeLayout({ ...layout, holds: e.target.value as ImportLayout['holds'] })}>
                      <option value="securities">Stocks and funds</option>
                      <option value="coins">Coins</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Prices and fees must be in US dollars, written with a decimal point. Trades are dated by day; a time in the date column is not kept.
                </p>
                {plan?.layoutProblem && <p className="text-xs text-amber-400" role="alert">{plan.layoutProblem}</p>}
              </fieldset>

              {/* 3. Kinds of row */}
              {layout.sideFrom === 'column' && layout.columns.action && actionValues.length > 0 && (
                <div className="space-y-2">
                  <span className={labelCls}>3. What each kind of row means</span>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    The app suggests each from its words; change any that are wrong. Dividends, interest and staking rewards cannot be
                    recorded yet, so leave those rows out. A transfer in takes the file’s price as what you paid; if that price is the
                    market price on the day rather than your cost, the cost will be off.
                  </p>
                  <div className="border border-border rounded-lg divide-y divide-border/50 max-h-72 overflow-y-auto">
                    {actionValues.slice(0, MAX_DISTINCT_VALUES).map((v) => (
                      <div key={v.value} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                        <span className="text-xs text-text-primary flex-1 min-w-40 wrap-break-word">{v.value}</span>
                        <span className="text-[11px] text-text-muted">{plural(v.rows, 'row')}</span>
                        <select aria-label={`What “${v.value}” means`} className={clsx(selectCls, 'w-36 shrink-0')}
                          value={layout.actions[v.value] ?? 'skip'} onChange={(e) => setAction(v.value, e.target.value as ImportSide)}>
                          {IMPORT_SIDES.map((s) => <option key={s} value={s}>{IMPORT_SIDE_LABELS[s]}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  {actionValues.length > MAX_DISTINCT_VALUES && (
                    <p className="text-[11px] text-text-muted">The first {MAX_DISTINCT_VALUES} of {actionValues.length} values are listed; the rest use the suggested choice, shown on each row below.</p>
                  )}
                </div>
              )}

              {/* 4. Symbols */}
              {layout.columns.symbol && symbolValues.length > 0 && (
                <div className="space-y-2">
                  <span className={labelCls}>{layout.sideFrom === 'column' ? '4' : '3'}. Which instrument each symbol is</span>
                  {coinsUnchosen > 0 && (
                    <p className="text-[11px] text-amber-400">{plural(coinsUnchosen, 'coin')} still to choose. Their rows are not saved until you do.</p>
                  )}
                  <div className="border border-border rounded-lg divide-y divide-border/50 max-h-96 overflow-y-auto">
                    {symbolValues.slice(0, MAX_DISTINCT_VALUES).map((v) => {
                      const choice = symbolChoice(layout, v.value)
                      const kind = pickingFor === v.value ? 'coin' : choice?.kind ?? 'coin'
                      const ticker = normaliseTicker(v.value)
                      return (
                        <div key={v.value} className="px-3 py-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-text-primary min-w-20">{v.value}</span>
                            <span className="text-[11px] text-text-muted">{plural(v.rows, 'row')}</span>
                            <span className="text-[11px] text-text-secondary flex-1 min-w-40">
                              {choice?.kind === 'coin' ? <>Coin: {choice.name} <span className="text-text-muted">({choice.coinId})</span></>
                                : choice?.kind === 'skip' ? 'Left out'
                                : choice?.kind === 'security' ? (ticker
                                  ? <>{ticker !== v.value ? `${ticker}: ` : ''}{INSTRUMENT_BY_KEY[`${SEC_PREFIX}${ticker}`]?.name ?? 'not in the app’s list; it may have no live price'}</>
                                  : <span className="text-red-400">not a stock or fund ticker</span>)
                                : <span className="text-amber-400">Choose which coin</span>}
                            </span>
                            <select aria-label={`What “${v.value}” is`} className={clsx(selectCls, 'w-36 shrink-0')} value={kind}
                              onChange={(e) => setSymbolKind(v.value, e.target.value as 'security' | 'coin' | 'skip')}>
                              <option value="security">Stock or fund</option>
                              <option value="coin">Coin</option>
                              <option value="skip">Leave out</option>
                            </select>
                            {choice?.kind === 'coin' && pickingFor !== v.value && (
                              <button type="button" onClick={() => setPickingFor(v.value)} className="text-[11px] text-accent-blue hover:underline">Change</button>
                            )}
                          </div>
                          {pickingFor === v.value && (
                            <CoinPicker symbol={v.value} onPick={(id, name) => pickCoin(v.value, id, name)} onClose={() => setPickingFor(null)} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 5. Check and save */}
              {plan && !plan.layoutProblem && (
                <div className="space-y-3">
                  <span className={labelCls}>{layout.sideFrom === 'column' ? '5' : '4'}. Check every row, then save</span>
                  <p className="text-xs text-text-secondary">
                    {plural(plan.ready, 'row')} ready, {plural(plan.leftOut, 'row')} left out, {plural(plan.refused, 'row')} not readable
                    {table.setAside.length > 0 && `, ${plural(table.setAside.length, 'line')} set aside`}.
                    {check && ` Checked against this portfolio: ${plural(willSave, 'trade')} will be saved.`}
                  </p>
                  {check?.issues && check.issues.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5">
                      <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden />
                      <div className="text-xs text-text-secondary leading-relaxed space-y-1">
                        <p>
                          {plural(check.issues.length, 'row')} would not count in full once saved; each says why below. Often the file
                          starts after you first bought: record a starting position by hand for what you held before it, then import.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void runCheck()} disabled={busy !== null || plan.ready === 0}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-primary hover:border-accent-blue disabled:opacity-50">
                      {busy === 'check' ? 'Checking…' : check ? 'Check again' : `Check ${plural(plan.ready, 'ready row')} against this portfolio`}
                    </button>
                    <button type="button" onClick={() => void save()} disabled={busy !== null || !check || willSave === 0}
                      title={!check ? 'Check the rows first.' : undefined}
                      className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-xs">
                      {busy === 'save' ? 'Saving…' : check ? `Save ${plural(willSave, 'trade')}` : 'Save'}
                    </button>
                    <button type="button" onClick={() => { reset(); setOpen(false) }} className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary">
                      Stop, save nothing
                    </button>
                    <label className="ml-auto text-[11px] text-text-muted flex items-center gap-1.5">
                      Show
                      <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={selectCls}>
                        <option value="all">Every row</option>
                        <option value="saved">Rows to be saved</option>
                        <option value="not-saved">Rows not saved</option>
                      </select>
                    </label>
                  </div>
                  {error && <p className="text-xs text-red-400" role="alert">{error}</p>}

                  <div className="border border-border rounded-lg overflow-x-auto max-h-[32rem] overflow-y-auto">
                    <table className="w-full text-xs">
                      <caption className="sr-only">Every row of the file and what it becomes</caption>
                      <thead className="sticky top-0 bg-bg-elevated">
                        <tr className="text-[10px] text-text-muted uppercase tracking-wider">
                          <th scope="col" className="text-left font-medium px-3 py-2">Line</th>
                          <th scope="col" className="text-left font-medium px-3 py-2">Date</th>
                          <th scope="col" className="text-left font-medium px-3 py-2">Kind</th>
                          <th scope="col" className="text-left font-medium px-3 py-2">Instrument</th>
                          <th scope="col" className="text-right font-medium px-3 py-2">Units</th>
                          <th scope="col" className="text-right font-medium px-3 py-2">Price</th>
                          <th scope="col" className="text-right font-medium px-3 py-2">Fee</th>
                          <th scope="col" className="text-left font-medium px-3 py-2">What happens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {shownRows.slice(0, ROWS_SHOWN).map((r) => {
                          const st = rowStatus(r, serverStatus, include)
                          const issues = issuesByLine.get(r.line)
                          return (
                            <tr key={r.line} className={clsx(!st.saves && 'opacity-70')}>
                              <td className="px-3 py-1.5 text-text-muted font-mono">{r.line}</td>
                              {r.status === 'ready' ? (
                                <>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{formatTradeDate(new Date(r.trade.executedAt).toISOString())}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{tradeKindLabel({ side: r.trade.side, opening: false })}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap" title={r.trade.name}>{r.trade.instrument.startsWith(SEC_PREFIX) ? r.trade.instrument.slice(SEC_PREFIX.length) : r.trade.name}</td>
                                  <td className="px-3 py-1.5 text-right font-mono">{formatUnits(r.trade.quantity)}</td>
                                  <td className="px-3 py-1.5 text-right font-mono">{r.trade.side === 'transfer_out' ? '—' : formatUnitPrice(r.trade.pricePerUnit)}</td>
                                  <td className="px-3 py-1.5 text-right font-mono">{r.trade.feeUsd === '0' ? '—' : formatUnitPrice(r.trade.feeUsd)}</td>
                                </>
                              ) : (
                                <td colSpan={6} className="px-3 py-1.5 text-text-muted">{[r.action, r.symbol].filter(Boolean).join(' · ') || '—'}</td>
                              )}
                              <td className="px-3 py-1.5">
                                <span className={st.tone}>{st.label}</span>
                                {r.status !== 'ready' && <span className="text-text-muted">: {r.reason}</span>}
                                {serverStatus?.get(r.line) === 'looks-recorded' && (
                                  <label className="ml-2 inline-flex items-center gap-1 text-text-secondary">
                                    <input type="checkbox" checked={include.has(r.line)}
                                      onChange={(e) => setInclude((s) => { const n = new Set(s); if (e.target.checked) n.add(r.line); else n.delete(r.line); return n })} />
                                    save anyway
                                  </label>
                                )}
                                {issues?.map((m) => <div key={m} className="text-amber-400">{m}</div>)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {shownRows.length > ROWS_SHOWN && (
                    <p className="text-[11px] text-text-muted">The first {ROWS_SHOWN} of {plural(shownRows.length, 'row')} are listed. All of them are counted above and saved.</p>
                  )}
                  {table.setAside.length > 0 && (
                    <details className="text-[11px] text-text-muted">
                      <summary className="cursor-pointer">Lines set aside ({table.setAside.length})</summary>
                      <ul className="mt-1 space-y-0.5">
                        {table.setAside.slice(0, 100).map((s) => (
                          <li key={s.line}><span className="font-mono">Line {s.line}</span>: {s.reason} <span className="text-text-secondary">{s.text}</span></li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Saving also remembers this layout for files with the same columns. Rows already imported into this portfolio are
                    recognised and not saved twice. A row matching a trade you typed by hand (same day, kind, instrument, units and
                    price) is held back unless you tick “save anyway”.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Past imports, each cancellable as a whole */}
      {pastImports.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-primary">Imports into this portfolio</h4>
          <div className="border border-border rounded-lg divide-y divide-border/50">
            {pastImports.map((imp) => {
              const all = imp.saved > 0 && imp.cancelled === imp.saved
              return (
                <div key={imp.id} className="px-3 py-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-text-primary font-medium wrap-break-word">{imp.fileName || 'A file'}</span>
                    <span className="text-text-muted">{formatRecordedDate(imp.createdAt)}</span>
                    <span className="text-text-secondary">
                      {plural(imp.saved, 'trade')} saved
                      {imp.skippedRepeats > 0 && `, ${plural(imp.skippedRepeats, 'row')} already imported`}
                      {imp.cancelled > 0 && (all ? ', all cancelled' : `, ${imp.cancelled} cancelled`)}
                    </span>
                    {!all && cancelling !== imp.id && (
                      <button type="button" onClick={() => { setCancelling(imp.id); setCancelReason('') }}
                        className="ml-auto text-[11px] text-text-muted hover:text-red-400">Cancel this import</button>
                    )}
                  </div>
                  {cancelling === imp.id && (
                    <div className="rounded-lg border border-border bg-bg-elevated/50 p-2 space-y-2">
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        Cancels all {plural(imp.saved - imp.cancelled, 'trade')} still counted from this file. Nothing is removed: each stays
                        listed, marked cancelled, and the gains leave it out. You can import the file again afterwards.
                      </p>
                      <input className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={200}
                        placeholder="Why (optional), such as “wrong account”" aria-label="Why this import is cancelled" />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setCancelling(null)} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary">Keep it</button>
                        <button type="button" onClick={() => void cancelWhole(imp.id)} disabled={busy === 'cancel'}
                          className="px-3 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs disabled:opacity-50">
                          {busy === 'cancel' ? 'Cancelling…' : 'Cancel this import'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {!open && error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
