/**
 * The data behind the Fund Figures Check page (T-440), assembled from the fund catalog.
 * Pure: every input is a parameter, so the tests run it against the real catalog and
 * against small fixtures alike. gen-fund-figures-page.ts passes the real values.
 *
 * The figures to re-read are derived, never listed: every yield the catalog holds, and
 * every asset figure that carries no SEC filing date (`aumAsOf`).
 */

export type FigureKind = 'yield' | 'assets'

export interface FundFigure {
  /** `<SYMBOL>:<figure>`, the reading's id in the page's database. */
  id: string
  symbol: string
  figure: FigureKind
  /** The catalog's value now: a yield in percent, or net assets in billions of dollars. */
  catalog: number
}

export interface FundCard {
  symbol: string
  name: string
  issuer: string
  type: 'etf' | 'mutual'
  category: string
  website: string
  /** A Vanguard ETF: a share class of a larger fund, whose own net assets the catalog holds. */
  shareClass: boolean
  /** The sort order flagged a difference between an outside figure and the catalog. */
  startHere: boolean
  figures: FundFigure[]
}

export interface FundFiguresData {
  generatedOn: string
  /** The ledger item this page works. */
  serves: string[]
  catalog: { compiledOn: string; ageDays: number; staleAfterDays: number; funds: number }
  counts: { yields: number; assets: number; funds: number }
  /** How the cards are ordered: `basis` is null when no sort order was given. */
  order: { basis: string | null; ranked: number; startHere: number }
  funds: FundCard[]
}

export const FUND_FIGURES_SERVES = ['T-440'] as const

/** The catalog fields this page reads (a FundEntry has more). */
export interface CatalogFund {
  symbol: string
  name: string
  type: 'etf' | 'mutual'
  issuer: string
  category: string
  website: string
  yieldPct: number | null
  aumB: number
  aumAsOf?: string
}

/**
 * The order to work the cards in, from a file kept on the machine that built it (never in
 * the repository: it is worked out from licensed data). It carries symbols and a flag only,
 * never an outside figure, so nothing licensed reaches the page.
 */
export interface FundOrder {
  basis: string
  funds: Array<{ symbol: string; differs: boolean }>
}

/** Reads a sort-order file, refusing anything that would silently misorder the page. */
export function parseFundOrder(json: unknown, known: ReadonlySet<string>): FundOrder {
  const o = json as { basis?: unknown; funds?: unknown }
  if (!o || typeof o !== 'object' || typeof o.basis !== 'string' || !o.basis.trim() || !Array.isArray(o.funds)) {
    throw new Error('sort order: expected { basis: string, funds: [{ symbol, differs }] }')
  }
  const seen = new Set<string>()
  const funds = o.funds.map((f, i) => {
    const e = f as { symbol?: unknown; differs?: unknown }
    if (!e || typeof e.symbol !== 'string' || typeof e.differs !== 'boolean') throw new Error(`sort order: entry ${i} needs a symbol and a true/false differs`)
    if (!known.has(e.symbol)) throw new Error(`sort order: ${e.symbol} has no figure to re-read`)
    if (seen.has(e.symbol)) throw new Error(`sort order: ${e.symbol} is listed twice`)
    seen.add(e.symbol)
    return { symbol: e.symbol, differs: e.differs }
  })
  return { basis: o.basis.trim(), funds }
}

/** The figures a fund needs re-read, in the order its card shows them. */
export function figuresFor(f: CatalogFund): FundFigure[] {
  const out: FundFigure[] = []
  if (f.yieldPct !== null) out.push({ id: `${f.symbol}:yield`, symbol: f.symbol, figure: 'yield', catalog: f.yieldPct })
  if (!f.aumAsOf) out.push({ id: `${f.symbol}:assets`, symbol: f.symbol, figure: 'assets', catalog: f.aumB })
  return out
}

export interface BuildFundFiguresInput {
  catalog: readonly CatalogFund[]
  categoryLabel: (id: string) => string
  compiledOn: string
  ageDays: number
  staleAfterDays: number
  generatedOn: string
  order?: FundOrder | null
}

export function buildFundFiguresData(input: BuildFundFiguresInput): FundFiguresData {
  const cards: FundCard[] = input.catalog
    .map((f) => ({
      symbol: f.symbol,
      name: f.name,
      issuer: f.issuer,
      type: f.type,
      category: input.categoryLabel(f.category),
      website: f.website,
      shareClass: f.issuer === 'Vanguard' && f.type === 'etf',
      startHere: false,
      figures: figuresFor(f),
    }))
    .filter((c) => c.figures.length > 0)

  const order = input.order ?? null
  if (order) {
    const known = new Set(cards.map((c) => c.symbol))
    // Re-checked here as well as in parseFundOrder: a hand-built order must fail the same way.
    parseFundOrder(order, known)
  }
  const rank = new Map((order?.funds ?? []).map((f, i) => [f.symbol, i]))
  const differs = new Set((order?.funds ?? []).filter((f) => f.differs).map((f) => f.symbol))
  for (const c of cards) c.startHere = differs.has(c.symbol)

  // Ranked cards first, in the order given. The rest are grouped by issuer, the issuer
  // with the most cards first, so one sitting covers one site; then catalog order.
  const catalogIndex = new Map(input.catalog.map((f, i) => [f.symbol, i]))
  const perIssuer = new Map<string, number>()
  for (const c of cards) if (!rank.has(c.symbol)) perIssuer.set(c.issuer, (perIssuer.get(c.issuer) ?? 0) + 1)
  cards.sort((a, b) => {
    const ra = rank.get(a.symbol), rb = rank.get(b.symbol)
    if (ra !== undefined || rb !== undefined) return (ra ?? Infinity) - (rb ?? Infinity)
    return (
      (perIssuer.get(b.issuer) ?? 0) - (perIssuer.get(a.issuer) ?? 0) ||
      a.issuer.localeCompare(b.issuer) ||
      (catalogIndex.get(a.symbol) ?? 0) - (catalogIndex.get(b.symbol) ?? 0)
    )
  })

  const figures = cards.flatMap((c) => c.figures)
  return {
    generatedOn: input.generatedOn,
    serves: [...FUND_FIGURES_SERVES],
    catalog: { compiledOn: input.compiledOn, ageDays: input.ageDays, staleAfterDays: input.staleAfterDays, funds: input.catalog.length },
    counts: {
      yields: figures.filter((f) => f.figure === 'yield').length,
      assets: figures.filter((f) => f.figure === 'assets').length,
      funds: cards.length,
    },
    order: { basis: order?.basis ?? null, ranked: rank.size, startHere: differs.size },
    funds: cards,
  }
}
