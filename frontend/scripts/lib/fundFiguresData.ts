/**
 * The data behind the Fund Figures Check page (T-440), assembled from the fund catalog.
 * Pure: every input is a parameter, so the tests run it against the real catalog and
 * against small fixtures alike. gen-fund-figures-page.ts passes the real values.
 *
 * The figures to re-read are derived, never listed: every yield the catalog holds, and
 * every asset figure that carries no SEC filing date (`aumAsOf`), for the funds whose own
 * site the owner ruled allows its figures to be read and shown (FUND_SITES_ALLOWED, D166).
 * A figure read off any other site could not be shown, so the page does not ask for it.
 * Re-reading these each quarter is the yields' quarterly check (`npm run accuracy-check`).
 */

import { fundSiteAllowsFigures } from '../../src/lib/data/fundCatalog'

export type FigureKind = 'yield' | 'assets'

export interface FundFigure {
  /** `<SYMBOL>:<figure>`, the reading's id in the page's database. */
  id: string
  symbol: string
  figure: FigureKind
  /** The catalog's value now: a yield in percent, or net assets in billions of dollars. */
  catalog: number
  /** What the pre-fill copied from the issuer's page, when the page was built with one. */
  suggestion?: FigureSuggestion
}

/**
 * A pre-fill suggestion as the card shows it (npm run fund-figures-prefill, D140 step 2).
 * It is read from an issuer's page on a site the owner ruled Allowed (D141), never from a
 * data service, and it is a hint: the reading box is never filled from it.
 */
export interface FigureSuggestion {
  /** `suggested` carries a figure; `none` carries only why there is none. */
  status: 'suggested' | 'none'
  /** As the issuer's page prints it. */
  shown: string
  asOf: string | null
  kind: string | null
  /** The passages the figure and its date were copied from. */
  quote: string
  dateQuote: string
  why: string
  /** The day the pre-fill read the page. */
  readOn: string
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
  /** When the pre-fill's suggestions were saved, and how many figures carry one; null without them. */
  suggestions: { savedAt: string; suggested: number; none: number } | null
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

/** Whether a fund's own site allows its figures to be shown (D166); an unreadable address does not. */
export function siteAllows(f: Pick<CatalogFund, 'website'>): boolean {
  try { return fundSiteAllowsFigures(f) } catch { return false }
}

/** The figures a fund needs re-read, in the order its card shows them. */
export function figuresFor(f: CatalogFund): FundFigure[] {
  const out: FundFigure[] = []
  if (!siteAllows(f)) return out
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
  /** Keyed by figure id (`<SYMBOL>:yield`), from suggestionsByFigure. */
  suggestions?: { savedAt: string; byFigure: ReadonlyMap<string, FigureSuggestion> } | null
}

const SUGGESTION_TEXT_MAX = 600

/**
 * The pre-fill's file (fund-figures-suggestions-v1, its `pages`) as one suggestion per
 * figure. A page that was not read gives each of its figures a `none` with the reason.
 * Text is cut to a length a card can carry; everything else in the file stays behind.
 */
export function suggestionsByFigure(pages: ReadonlyArray<{
  symbol: string; readAt: string; outcome: string; why: string
  figures?: ReadonlyArray<{ id: string; status: string; shown: string; asOf: string | null; kind: string | null; quote: string; dateQuote: string; why: string }>
}>): Map<string, FigureSuggestion> {
  const cut = (s: unknown) => { const t = typeof s === 'string' ? s : ''; return t.length > SUGGESTION_TEXT_MAX ? `${t.slice(0, SUGGESTION_TEXT_MAX)}…` : t }
  const out = new Map<string, FigureSuggestion>()
  for (const p of pages) {
    const readOn = typeof p.readAt === 'string' ? p.readAt.slice(0, 10) : ''
    if (p.outcome !== 'read') {
      for (const figure of ['yield', 'assets']) {
        out.set(`${p.symbol}:${figure}`, { status: 'none', shown: '', asOf: null, kind: null, quote: '', dateQuote: '', why: cut(`The page was not read: ${p.why || p.outcome}`), readOn })
      }
      continue
    }
    for (const f of p.figures ?? []) {
      const ok = f.status === 'suggested'
      out.set(f.id, {
        status: ok ? 'suggested' : 'none',
        shown: ok ? cut(f.shown) : '',
        asOf: ok ? f.asOf : null,
        kind: ok ? f.kind : null,
        quote: ok ? cut(f.quote) : '',
        dateQuote: ok ? cut(f.dateQuote) : '',
        why: cut(f.why),
        readOn,
      })
    }
  }
  return out
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
      figures: figuresFor(f).map((g) => {
        const s = input.suggestions?.byFigure.get(g.id)
        return s ? { ...g, suggestion: s } : g
      }),
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
    suggestions: input.suggestions
      ? {
          savedAt: input.suggestions.savedAt,
          suggested: figures.filter((f) => f.suggestion?.status === 'suggested').length,
          none: figures.filter((f) => f.suggestion?.status === 'none').length,
        }
      : null,
    funds: cards,
  }
}
