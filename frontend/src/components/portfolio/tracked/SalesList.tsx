'use client'

import { Fragment, useId, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { clsx } from 'clsx'
import { formatUnits, formatUsd, formatUsdChange, type LedgerView } from '@/lib/data/tradeLedger'
import { BOUGHT_HOW_LABELS, SOLD_HOW_LABELS, buildSalesList, type SalePart, type SalesYear } from '@/lib/data/salesList'
import { downloadExport } from '@/lib/api/downloadExport'
import { formatTradeDate } from './TradesTable'

// Every sale in one tracked portfolio, with the purchases it used up, by calendar year (T-460,
// owner decision D222). Buy and sell dates and the days held, and nothing more: no "held more
// than a year" mark and no tax figure or label. The figures are the lot engine's own (FIFO, D65),
// so a year's gains add up to the Realized tile.

const toneCls = (v: string) =>
  formatUsd(v) === '$0.00' ? 'text-text-secondary' : v.startsWith('-') ? 'text-red-400' : 'text-emerald-400'

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

function daysText(p: SalePart): string {
  if (p.daysHeld !== null) return p.daysHeld.toLocaleString('en-US')
  return '—'
}

function boughtText(p: SalePart): string {
  if (p.boughtOn === null) return 'Date not entered'
  return formatTradeDate(p.boughtOn)
}

function YearTable({ year, caption }: { year: SalesYear; caption: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border bg-bg-elevated/50">
              <th scope="col" className="text-left font-medium px-4 py-2">Sold</th>
              <th scope="col" className="text-left font-medium px-3 py-2">Holding</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Units</th>
              <th scope="col" className="text-left font-medium px-3 py-2">From</th>
              <th scope="col" className="text-right font-medium px-3 py-2 whitespace-nowrap">Days held</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Cost</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Proceeds</th>
              <th scope="col" className="text-right font-medium px-4 py-2">Gain</th>
            </tr>
          </thead>
          <tbody>
            {year.sales.map((s) => {
              const rows = s.parts.length + (s.unmatched ? 1 : 0)
              const head = (i: number) => i === 0 && (
                <>
                  <td rowSpan={rows} className="px-4 py-2.5 whitespace-nowrap text-text-secondary align-top">
                    {formatTradeDate(s.soldOn)}
                    {s.soldHow !== 'sale' && <div className="text-[11px] text-text-muted">{SOLD_HOW_LABELS[s.soldHow]}</div>}
                  </td>
                  <th scope="row" rowSpan={rows} className="text-left font-normal px-3 py-2.5 align-top">
                    <div className="font-semibold text-text-primary">{s.symbol}</div>
                    <div className="text-xs text-text-muted max-w-40 truncate" title={s.name}>{s.name}</div>
                  </th>
                </>
              )
              return (
                <Fragment key={s.saleId}>
                  {s.parts.map((p, i) => (
                    <tr key={`${s.saleId}-${p.lotId}-${i}`} className="border-b border-border/50 align-top">
                      {head(i)}
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary whitespace-nowrap">{formatUnits(p.quantity)}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                        {boughtText(p)}
                        <div className="text-[11px] text-text-muted">{BOUGHT_HOW_LABELS[p.boughtHow]}</div>
                        {p.soldBeforeBought && (
                          <div className="text-[11px] text-amber-300">The sale is dated before this; check the dates</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary">{daysText(p)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary whitespace-nowrap">{formatUsd(p.costUsd)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary whitespace-nowrap">{formatUsd(p.proceedsUsd)}</td>
                      <td className={clsx('px-4 py-2.5 text-right font-mono whitespace-nowrap', toneCls(p.gainUsd))}>{formatUsdChange(p.gainUsd)}</td>
                    </tr>
                  ))}
                  {s.unmatched && (
                    <tr className="border-b border-border/50 align-top">
                      {head(s.parts.length)}
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary whitespace-nowrap">{formatUnits(s.unmatched.quantity)}</td>
                      <td className="px-3 py-2.5 text-amber-300 text-[11px] leading-snug" colSpan={2}>
                        No purchase recorded for these units, so no cost is assumed and they are in no gain
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-muted">—</td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary whitespace-nowrap">{formatUsd(s.unmatched.proceedsUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-muted">—</td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-bg-elevated/50 text-text-primary">
              <th scope="row" colSpan={5} className="text-left font-medium px-4 py-2 text-xs">
                Total, {plural(year.sales.length, 'sale')}
              </th>
              <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formatUsd(year.costUsd)}</td>
              <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formatUsd(year.proceedsUsd)}</td>
              <td className={clsx('px-4 py-2 text-right font-mono whitespace-nowrap', toneCls(year.gainUsd))}>{formatUsdChange(year.gainUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export function SalesList({ view, portfolioId }: { view: LedgerView; portfolioId: string }) {
  const uid = useId()
  const list = useMemo(() => buildSalesList(view, new Date()), [view])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    setError(await downloadExport(`part=sales&portfolio=${encodeURIComponent(portfolioId)}`, 'finance-now-sales.csv'))
    setBusy(false)
  }

  const anyMovedOut = list.years.some((y) => y.movedOut.length > 0)

  return (
    <section className="space-y-3" aria-labelledby={`${uid}-sales`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${uid}-sales`} className="text-sm font-semibold text-text-primary">
            Sales <span className="text-text-muted font-normal">({list.saleCount})</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-1 leading-relaxed max-w-3xl">
            Each sale with the purchases it used up, oldest first: {view.methodLabel}. Units are as held at the sale, after
            any split. Each amount is rounded to the cent on its own, so a column can add up to a cent away
            from its total. For your own records, to check against a broker’s statement; it is not a tax form.
          </p>
        </div>
        {list.saleCount > 0 && (
          <button type="button" onClick={() => void download()} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:border-accent-blue hover:text-text-primary disabled:opacity-50 transition-colors">
            <Download size={13} aria-hidden /> {busy ? 'Preparing…' : 'Download (CSV)'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-amber-400" role="alert">{error}</p>}

      {list.years.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-sm text-text-muted">
          No sales recorded yet.
        </div>
      ) : (
        list.years.map((y) => (
          <div key={y.year} className="space-y-2">
            <h4 className="text-xs font-semibold text-text-secondary">{y.inProgress ? `${y.year} so far` : y.year}</h4>
            {y.sales.length > 0 && (
              <YearTable year={y} caption={`Sales in ${y.year}. ${view.methodLabel}.`} />
            )}
            {y.unmatchedProceedsUsd !== '0' && (
              <p className="text-[11px] text-text-muted">
                {formatUsd(y.unmatchedProceedsUsd)} of proceeds had no purchase recorded and is left out of these totals.
              </p>
            )}
            {y.movedOut.length > 0 && (
              <ul className="text-[11px] text-text-muted space-y-0.5" aria-label={`Moved out in ${y.year}, not sales`}>
                {y.movedOut.map((o) => (
                  <li key={o.tradeId}>
                    Moved out, not sold: {formatUnits(o.quantity)} {o.symbol} on {formatTradeDate(o.movedOn)}, carrying {formatUsd(o.costUsd)} of cost.
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
      {anyMovedOut && (
        <p className="text-[11px] text-text-muted">Units moved out are not sales, so they are in no total here and not in the download; the trades download has them.</p>
      )}
    </section>
  )
}
