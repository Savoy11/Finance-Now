/**
 * Marketaux company news (T-430, 2026-10-07).
 *
 * Stock pages lost their only per-company news source when Yahoo's per-ticker
 * feed went on terms grounds (2026-08-06); since then a stock's news is the
 * general wire filtered to articles that name it. Marketaux tags each article
 * with the companies it covers and answers for one ticker, so a stock the wires
 * skipped can still show its own coverage.
 *
 * Terms (lib/server/sourceTerms.ts, read 2026-10-07): personal, non-commercial
 * use; a public app needs Marketaux's written approval (the trigger is the first
 * page load by anyone other than the owner, D22). Its FAQ: "We only provide a
 * short snippet of articles along with their links", so headline, snippet and
 * link are what is shown, each credited to the article's own publisher.
 *
 * Request budget: the free plan allows 100 requests a day and 3 articles per
 * request. Responses are cached for six hours per ticker, and only a stock
 * page's company news calls this, so the general feed never spends requests.
 */

import { EXTERNAL_FETCH_TIMEOUT_MS } from './fetchBudget'

/** Six hours: at most four requests a day for any one stock. */
export const MARKETAUX_REVALIDATE_SECONDS = 6 * 60 * 60

export interface MarketauxArticle {
  id: string
  title: string
  url: string
  /** The article's own publisher (Marketaux's `source`, a domain), never "Marketaux". */
  source: string
  publishedAt: string
  summary: string
  /** Tickers Marketaux identified in the article, upper-case. */
  taggedSymbols: string[]
}

export function marketauxUrl(symbol: string, apiKey: string): string {
  const q = new URLSearchParams({ symbols: symbol, language: 'en', filter_entities: 'true', api_token: apiKey })
  return `https://api.marketaux.com/v1/news/all?${q.toString()}`
}

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '')

/**
 * Parse a /v1/news/all response. Rows without a title or a link are dropped;
 * a bad date falls back to now rather than losing the article.
 */
export function parseMarketaux(payload: unknown): MarketauxArticle[] {
  const data = (payload as { data?: unknown })?.data
  if (!Array.isArray(data)) return []
  const out: MarketauxArticle[] = []
  for (const row of data as Array<Record<string, unknown>>) {
    const title = text(row?.title)
    const url = text(row?.url)
    if (!title || !/^https?:\/\//i.test(url)) continue
    const when = new Date(text(row?.published_at))
    const entities = Array.isArray(row?.entities) ? (row.entities as Array<Record<string, unknown>>) : []
    out.push({
      id: `marketaux:${text(row?.uuid) || url}`.slice(0, 200),
      title,
      url,
      source: text(row?.source) || hostOf(url),
      publishedAt: isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString(),
      summary: (text(row?.description) || text(row?.snippet)).slice(0, 280),
      taggedSymbols: [...new Set(entities.map((e) => text(e?.symbol).toUpperCase()).filter(Boolean))],
    })
  }
  return out
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'unknown source' }
}

/** Marketaux states its refusals in the body: `{ error: { code, message } }`. */
async function refusal(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } }
    if (j?.error?.message) return `${j.error.code ?? res.status}: ${j.error.message}`
  } catch { /* not JSON */ }
  return `HTTP ${res.status}`
}

export async function fetchMarketauxNews(symbol: string, apiKey: string): Promise<MarketauxArticle[]> {
  const res = await fetch(marketauxUrl(symbol, apiKey), {
    headers: { Accept: 'application/json' },
    next: { revalidate: MARKETAUX_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Marketaux ${await refusal(res)}`)
  return parseMarketaux(await res.json())
}
