import 'server-only'

// Tokenized-securities news: TS-13 in docs/assessments/tokenized-securities-2026-09-21.md.
//
// A tokenized share is a representation of an existing security. It is not a
// coin and not a new asset class: a story about TSLAx is a story about Tesla
// stock in another wrapper. Before this module, the news taggers knew neither
// half of that (finding F12). Nothing filed these stories together, and nothing
// linked a story to the company whose shares it was about. Both feeds,
// /live-data/news (crypto) and /live-data/market-news (equities), answer those
// two questions here, so they cannot answer them differently.

import { EQUITY_CATALOG } from '@/lib/data/equityCatalog'

/** The stocks a token can be linked to: the catalog the news chips link into. */
export const STOCK_TICKERS: ReadonlySet<string> = new Set(EQUITY_CATALOG.map((e) => e.symbol))

const SECURITY = String.raw`(?:stocks?|shares?|equit(?:y|ies)|securit(?:y|ies)|etfs?|funds?|treasur(?:y|ies)|bonds?)`
// Up to four words between "tokenized" and the security, so a short list of
// companies ("Apple, Tesla and Nvidia shares") still reads as one phrase.
const WORDS = String.raw`(?:[\w.&'’,-]+\s+){0,4}`

/**
 * Wording that makes a story about tokenized securities.
 *
 * Deliberately not matched: tokenized deposits, gold, real estate and
 * "real-world assets" in general. None of them is a security, and this category
 * exists for stories where a share, a fund or a bond has a second form.
 */
export const TOKENIZED_SECURITIES_RE = new RegExp(
  String.raw`\b(?:` + [
    // "tokenized stocks", "tokenised U.S. equities", "tokenized NMS stock",
    // "tokenized money market fund", "tokenized Apple, Tesla and Nvidia shares"
    String.raw`tokeni[sz]ed\s+` + WORDS + SECURITY,
    // "tokenized versions of Apple and Nvidia"
    String.raw`tokeni[sz]ed\s+versions?\s+of`,
    // "the tokenization of U.S. stocks"
    String.raw`tokeni[sz]ation\s+of\s+` + WORDS + SECURITY,
    // "stock tokenization", "securities tokenisation"
    String.raw`(?:stocks?|equit(?:y|ies)|securit(?:y|ies)|funds?)\s+tokeni[sz]ation`,
    // "stock tokens". Not "share tokens", which is also a verb phrase.
    String.raw`(?:stock|equity)\s+tokens?`,
    // "onchain shares", "on-chain stocks"
    String.raw`on-?chain\s+(?:stocks?|shares|equit(?:y|ies))`,
    // The products by name: Kraken/Backed xStocks, Dinari dShares, Ondo's stocks
    String.raw`xstocks?`,
    String.raw`dshares?`,
    String.raw`ondo\s+(?:global\s+markets|stocks)`,
  ].join('|') + String.raw`)\b`,
  'i',
)

/**
 * A token symbol that names its underlying stock by an issuer's suffix:
 *   x   Kraken/Backed xStocks, "a stock ticker followed by x": TSLAx, AAPLx, NVDAx
 *   on  Ondo Stocks, "designated by the 'on' suffix": TSLAon, NVDAon, GOOGLon
 * Both conventions are the issuers' own (kraken.com/xstocks/tslax,
 * docs.ondo.finance/ondo-stocks/overview), read on 2026-10-01 through search
 * excerpts. This environment's egress refuses both hosts, so the pages
 * themselves were not opened. Dinari's dShares are left out on purpose: the
 * sources found disagree on the form (AAPL.D on one listing, dAAPL on another),
 * and a guessed convention would link a story to the wrong company.
 *
 * Three rules keep an ordinary word from reading as a token:
 *  - The suffix is lowercase, exactly as the issuers print it. An all-capitals
 *    ticker ending in X is a mutual fund (VFIAX, FXAIX, AGTHX), never an xStock.
 *  - The ticker part has at least two letters. The catalog holds C, T and V,
 *    and "Con", "Ton" and "Tx" are words, not tokens.
 *  - The ticker must be in the stock catalog. An unknown prefix is not evidence.
 */
const TOKEN_SYMBOL_RE = /(?<![A-Za-z0-9])\$?([A-Z]{2,5})(?:x|on)(?![A-Za-z0-9])/g

/** The catalog stocks that token symbols in `text` stand for, in order of first mention. */
export function tokenUnderlyings(text: string, known: ReadonlySet<string> = STOCK_TICKERS): string[] {
  const found: string[] = []
  for (const m of text.matchAll(TOKEN_SYMBOL_RE)) {
    const ticker = m[1]
    if (known.has(ticker) && !found.includes(ticker)) found.push(ticker)
  }
  return found
}

/** Whether a story is about tokenized securities: by its wording, or by naming a token. */
export function isTokenizedSecuritiesStory(text: string, known: ReadonlySet<string> = STOCK_TICKERS): boolean {
  return TOKENIZED_SECURITIES_RE.test(text) || tokenUnderlyings(text, known).length > 0
}
