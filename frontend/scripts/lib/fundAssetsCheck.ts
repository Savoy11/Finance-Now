/**
 * The fund catalog's filed asset figures against each fund's newest SEC filing (D168): the
 * re-read `npm run accuracy-check` points to for "Fund net assets from SEC filings". Pure: the
 * catalog row and what EDGAR returned are parameters, so the tests run it on fixtures;
 * scripts/fund-assets-check.ts does the fetching.
 *
 * It reports, never writes, like `fund-fees`: an automated overwrite is how a figure lands on
 * the wrong fund. The match is the SEC's own ticker → series map, never a name, and a mutual
 * fund's figure is the whole series, every share class (D115), which is what N-PORT reports.
 */

export interface FiledRow {
  symbol: string
  aumB: number
  aumAsOf: string
  aumSource?: string
}

/** What the newest NPORT-P filing gave, or why there is none. */
export type FilingResult =
  | { kind: 'nport'; asOf: string | null; netAssets: number | null; accession: string; filedAt: string | null }
  | { kind: 'not-nport'; why: string }
  | { kind: 'error'; why: string }

export type AssetsStatus = 'newer' | 'same' | 'older' | 'not-nport' | 'error'

export interface AssetsLine {
  symbol: string
  status: AssetsStatus
  catalog: { aumB: number; asOf: string; accession: string | null }
  filed?: { aumB: number | null; asOf: string | null; accession: string; filedAt: string | null }
  /** The filed figure as the catalog would write it: three significant figures, in billions. */
  proposedAumB?: number | null
  changePct?: number | null
  why?: string
}

/** Billions to three significant figures, the catalog's own precision (124, 51.4, 1.48). */
export function toCatalogAumB(usd: number): number {
  const b = usd / 1e9
  if (!Number.isFinite(b) || b <= 0) return b
  return Number(b.toPrecision(3))
}

export function compareFiled(row: FiledRow, result: FilingResult): AssetsLine {
  const catalog = { aumB: row.aumB, asOf: row.aumAsOf, accession: row.aumSource ?? null }
  if (result.kind !== 'nport') return { symbol: row.symbol, status: result.kind, catalog, why: result.why }
  const filed = {
    aumB: result.netAssets != null ? result.netAssets / 1e9 : null,
    asOf: result.asOf, accession: result.accession, filedAt: result.filedAt,
  }
  if (!result.asOf || result.netAssets == null) {
    return { symbol: row.symbol, status: 'error', catalog, filed, why: 'the newest filing states no period or no net assets' }
  }
  const status: AssetsStatus = result.asOf > row.aumAsOf ? 'newer' : result.asOf === row.aumAsOf ? 'same' : 'older'
  const proposedAumB = toCatalogAumB(result.netAssets)
  const changePct = row.aumB > 0 ? Math.round(((proposedAumB - row.aumB) / row.aumB) * 1000) / 10 : null
  return { symbol: row.symbol, status, catalog, filed, proposedAumB, changePct }
}

/** The report, as lines for the terminal. */
export function assetsReport(lines: readonly AssetsLine[], today: string): string {
  const by = (s: AssetsStatus) => lines.filter((l) => l.status === s)
  const out: string[] = [`Fund net assets from SEC filings, against each fund's newest NPORT-P — ${today}`, '']
  out.push(`${lines.length} catalog funds with a filed figure: ${by('newer').length} have a newer filing, ${by('same').length} are current, ${by('older').length} newest filing is older than the catalog's, ${by('not-nport').length} file no N-PORT, ${by('error').length} could not be read.`, '')
  if (by('newer').length) {
    out.push('NEWER FILING — bring to the owner before any change:')
    for (const l of by('newer')) {
      out.push(`  ${l.symbol.padEnd(6)} ${String(l.catalog.aumB).padStart(7)}B as of ${l.catalog.asOf} → ${String(l.proposedAumB).padStart(7)}B as of ${l.filed!.asOf} (${l.changePct! >= 0 ? '+' : ''}${l.changePct}%), ${l.filed!.accession}`)
    }
    out.push('')
  }
  if (by('older').length) {
    out.push('NEWEST FILING OLDER THAN THE CATALOG (check the catalog\'s source):')
    for (const l of by('older')) out.push(`  ${l.symbol.padEnd(6)} catalog ${l.catalog.asOf} (${l.catalog.accession}), newest filing ${l.filed!.asOf} (${l.filed!.accession})`)
    out.push('')
  }
  if (by('not-nport').length) {
    out.push('FILE NO N-PORT (a trust\'s 10-Q, 10-K or 40-F instead; re-read from that filing):')
    out.push(`  ${by('not-nport').map((l) => `${l.symbol} (${l.catalog.asOf})`).join(', ')}`, '')
  }
  if (by('error').length) {
    out.push('COULD NOT BE READ:')
    for (const l of by('error')) out.push(`  ${l.symbol}: ${l.why}`)
    out.push('')
  }
  return out.join('\n')
}
