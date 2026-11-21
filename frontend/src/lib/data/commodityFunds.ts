// ─── The funds a commodity page lists (T-462) ────────────────────────────────
//
// A commodity's own futures price has had no source on any audit since 2026-09-09, while the funds
// that hold it price through the same quote ladder as every stock and fund. Each commodity page
// lists those funds (`etfProxies`), and since T-462 shows each one's live price and change under
// the fund's own name, never in the commodity's price slot. The owner chose not to chart a fund in
// place of the commodity's empty chart (D225): a gold chart that is really GLD's is easy to misread.

import { getFund, type FundEntry } from './fundCatalog'
import type { CommodityEntry } from './commodityCatalog'

/** The catalog funds listed for a commodity, in the catalog's order. */
export function commodityFunds(entry: CommodityEntry): { symbol: string; fund: FundEntry }[] {
  return entry.etfProxies.flatMap((symbol) => {
    const fund = getFund(symbol)
    return fund ? [{ symbol, fund }] : []
  })
}

/** The line under the funds' prices: a fund's day is not the contract's. */
export const FUND_PRICE_NOTE =
  'Each price is the fund’s own share price and its change since the previous close, not the contract’s. ' +
  'A fund’s day can differ from the contract’s: its fees, how it holds the commodity (bullion in a vault, or futures it rolls ' +
  'from month to month), and the gap between its share price and the value of what it holds.'

/**
 * Shown when none of the listed funds has a live price. The quotes route cannot say which of the
 * two it was (it answers reference prices either way), so the note names both (code audit
 * 2026-11-12, D226: it had blamed a missing key when keys were set and the providers failed).
 */
export const NO_FUND_PRICES_NOTE =
  'No live price for these funds right now: either no quote key is set (free from several providers, on the Integrations page) or the price providers did not answer.'
