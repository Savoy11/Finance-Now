import 'server-only'

// Symbol matching for the market-news route. Company names match
// case-insensitively; tickers require $SYM or an exact uppercase word.

import { EQUITY_CATALOG } from '@/lib/data/equityCatalog'
import { FUND_CATALOG } from '@/lib/data/fundCatalog'
import { isTokenizedSecuritiesStory, tokenUnderlyings } from './tokenizedNews'


// Symbols that are common English words false-positive as bare uppercase
// matches — require an explicit $cashtag for these.
const CASHTAG_ONLY = new Set(['NOW', 'LOW', 'CAT', 'COST', 'ALL', 'SO', 'ON'])

export interface SymbolMatcher { symbol: string; name: RegExp | null; ticker: RegExp }

function buildMatcher(symbol: string, name?: string): SymbolMatcher {
  return {
    symbol,
    name: name ? new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : null,
    ticker: symbol.length >= 3 && !CASHTAG_ONLY.has(symbol)
      ? new RegExp(`(\\$${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?=[^a-z]|$))`)
      : new RegExp(`\\$${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
  }
}

const NAME_MATCHERS: SymbolMatcher[] = EQUITY_CATALOG.map((e) => buildMatcher(e.symbol, e.name))

/**
 * A matcher for the one symbol this request asked about, when the equity
 * catalog doesn't already carry it. Two tiers of evidence:
 *   · A fund from the catalog matches on its full name too ("Vanguard S&P 500
 *     ETF") — same rules as a catalog stock.
 *   · A symbol from neither catalog matches on $CASHTAG / bare-uppercase-word
 *     only, because we have no name to look for. That is detection, not
 *     force-tagging: an article that never prints the ticker still won't match.
 * Symbol-shape guard so arbitrary query text can't become a regex.
 */
export function requestedMatcher(symbol: string, name?: string | null): SymbolMatcher | null {
  if (NAME_MATCHERS.some((m) => m.symbol === symbol)) return null
  if (!/^[A-Z0-9.\-]{1,6}$/.test(symbol)) return null
  const fund = FUND_CATALOG.find((f) => f.symbol === symbol)
  // Name preference: the catalog's vetted name, else a caller-supplied one
  // (the news page passes the official listing-directory name for a fund or
  // stock outside the catalogs — without it, a mutual fund whose ticker never
  // appears in headlines could only ever match on that ticker). The name is
  // used as an escaped literal, and length-capped so a crafted query cannot
  // turn the matcher into a pathological regex.
  const callerName = name?.trim() && name.trim().length <= 80 ? name.trim() : undefined
  return buildMatcher(symbol, fund?.name ?? callerName)
}

export function detectSymbols(text: string, extra?: SymbolMatcher | null): string[] {
  const found: string[] = []
  for (const m of extra ? [extra, ...NAME_MATCHERS] : NAME_MATCHERS) {
    if (m.name?.test(text) || m.ticker.test(text)) found.push(m.symbol)
    if (found.length >= 6) break
  }
  // A token symbol names its underlying: TSLAx is Tesla stock in a wrapper. The
  // ticker matcher above refuses "TSLAx" on purpose, because a bare ticker must
  // not run into lowercase letters, so tokens are read separately, by the
  // issuers' own suffixes (tokenizedNews.ts).
  for (const symbol of tokenUnderlyings(text)) {
    if (found.length >= 6) break
    if (!found.includes(symbol)) found.push(symbol)
  }
  return found
}

// Company names that are also everyday crypto vocabulary. In a crypto story,
// "oracle" almost always means a price feed (xStocks are priced by Chainlink
// oracles), and "intel" means research, as in Arkham's Intel Exchange. On the
// crypto feed these two stocks link by ticker or token only, never by name.
const CRYPTO_VOCABULARY = new Set(['ORCL', 'INTC'])

/**
 * The catalog stocks a crypto-feed story about tokenized securities names: the
 * company in "tokenized Tesla shares", or the underlying of "NVDAx". Empty for
 * every other story. The crypto feed tags coins, and naming every company a
 * crypto story mentions would be a different feature from this one (TS-13).
 */
export function detectTokenizedSymbols(text: string): string[] {
  if (!isTokenizedSecuritiesStory(text)) return []
  const found: string[] = []
  for (const m of NAME_MATCHERS) {
    const byName = !CRYPTO_VOCABULARY.has(m.symbol) && !!m.name?.test(text)
    if (byName || m.ticker.test(text)) found.push(m.symbol)
    if (found.length >= 6) return found
  }
  for (const symbol of tokenUnderlyings(text)) {
    if (found.length >= 6) break
    if (!found.includes(symbol)) found.push(symbol)
  }
  return found
}

