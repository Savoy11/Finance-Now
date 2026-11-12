// ─── Which security quotes are live readings (T-462) ─────────────────────────
//
// /live-data/security-quotes fills any symbol the live providers missed with the fund catalog's
// reference price, marked `reference: true`, and answers `source: 'reference'` when no provider
// answered at all. A surface that shows a price as live, or acts on one, must leave those out.
// The price alerts did this inline; the commodity pages' fund prices do it too, so the rule lives
// here once.

export interface SecurityQuoteLike {
  price: number | null
  change?: number | null
  changePercent?: number | null
  reference?: boolean
}

export interface SecurityQuotesLike {
  source?: string
  quotes?: Record<string, SecurityQuoteLike | undefined>
}

/** A live price and its change since the previous close. */
export interface LiveQuote {
  price: number
  change: number | null
  changePercent: number | null
}

/**
 * Whether a quote from that response is a live reading: not from a response the reference prices
 * answered, not a reference price itself, and a price above zero.
 */
export function isLiveSecurityQuote(source: string | undefined, quote: SecurityQuoteLike | null | undefined): quote is SecurityQuoteLike & { price: number } {
  return !!quote && source !== 'reference' && !quote.reference
    && typeof quote.price === 'number' && Number.isFinite(quote.price) && quote.price > 0
}

const finiteOrNull = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Each symbol's live quote from the response, or null where it has none (missing or a reference price). */
export function liveQuotesFor(response: SecurityQuotesLike | null | undefined, symbols: string[]): Record<string, LiveQuote | null> {
  const out: Record<string, LiveQuote | null> = {}
  for (const symbol of symbols) {
    const q = response?.quotes?.[symbol.toUpperCase()]
    out[symbol] = isLiveSecurityQuote(response?.source, q)
      ? { price: q.price, change: finiteOrNull(q.change), changePercent: finiteOrNull(q.changePercent) }
      : null
  }
  return out
}
