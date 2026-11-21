import 'server-only'

import { EDGAR_HEADERS } from './edgar'
import { EXTERNAL_FETCH_TIMEOUT_MS } from './fetchBudget'
import { isNportFundTicker } from './fundFacts'
import { EQUITY_BY_SYMBOL } from '@/lib/data/equityCatalog'
import { FUND_BY_SYMBOL } from '@/lib/data/fundCatalog'
import { parseExchangeFile, selectCommonListings, type LeftOutReason, type SecListing } from '@/lib/data/secListings'

// Every NYSE and Nasdaq common stock the SEC names (T-450), from its
// company_tickers_exchange.json: the same host and the same daily cache as the
// ticker list the app already reads (edgar.ts). The rules for which listings
// count are in lib/data/secListings.ts. Never throws: an unreachable SEC is
// reported, and the registry keeps its curated list.

export const SEC_EXCHANGE_FILE = 'https://www.sec.gov/files/company_tickers_exchange.json'

export interface SecListingsResult {
  listings: SecListing[]
  leftOut: Record<LeftOutReason, number>
  /** False when the file could not be read or was not in the expected shape. */
  reached: boolean
  error?: string
}

const EMPTY_LEFT_OUT: Record<LeftOutReason, number> = { 'other-exchange': 0, 'not-common': 0, fund: 0 }

/** A ticker the app already knows as a fund: its fund catalog, or the SEC fund filings it reads. */
const isKnownFund = (symbol: string): boolean => !!FUND_BY_SYMBOL[symbol] || isNportFundTicker(symbol)

export async function fetchSecListings(): Promise<SecListingsResult> {
  try {
    const res = await fetch(SEC_EXCHANGE_FILE, {
      headers: EDGAR_HEADERS,
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { listings: [], leftOut: EMPTY_LEFT_OUT, reached: false, error: `SEC exchange list: HTTP ${res.status}` }
    const rows = parseExchangeFile(await res.json())
    if (!rows || rows.length === 0) {
      return { listings: [], leftOut: EMPTY_LEFT_OUT, reached: false, error: 'SEC exchange list: not in the expected shape' }
    }
    const { listings, leftOut } = selectCommonListings(rows, isKnownFund, (s) => !!EQUITY_BY_SYMBOL[s])
    return { listings, leftOut, reached: true }
  } catch (e) {
    return { listings: [], leftOut: EMPTY_LEFT_OUT, reached: false, error: `SEC exchange list: ${e instanceof Error ? e.message : 'unreachable'}` }
  }
}
