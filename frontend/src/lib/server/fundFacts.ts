import 'server-only'

import FACTS from '@/lib/data/fundFacts.generated.json'
import type { FundFactsEntry } from '@/lib/data/fundNetAssets'

// The SEC N-PORT size and registrant for ~25,000 fund tickers (T-449 c). Read
// on the server only: the file is 2 MB, and a fund page needs one row of it,
// which /live-data/fund-universe?symbol= hands over. What the figure means, and
// how it is dated, is in lib/data/fundNetAssets.ts.

const TABLE = FACTS as Record<string, FundFactsEntry | undefined>

/** One ticker's N-PORT facts, or null when the data set has none for it. */
export function fundFactsFor(symbol: string): FundFactsEntry | null {
  const row = TABLE[symbol.toUpperCase()]
  if (!row || typeof row.netAssetsB !== 'number' || !Number.isFinite(row.netAssetsB) || row.netAssetsB <= 0) return null
  return { netAssetsB: row.netAssetsB, issuer: row.issuer?.trim() || null, asOf: row.asOf }
}

/** Whether the SEC's N-PORT fund filings name this ticker at all: then it is a fund, not a company. */
export function isNportFundTicker(symbol: string): boolean {
  return Object.prototype.hasOwnProperty.call(TABLE, symbol.toUpperCase())
}
