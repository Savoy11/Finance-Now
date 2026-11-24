import { NextRequest, NextResponse } from 'next/server'
import GENERATED from '@/lib/data/stockHolders.generated.json'
import { hydrateStockHolders, type StockHoldersFile, type StockHoldersResponse } from '@/lib/data/stockHolders'

export const dynamic = 'force-dynamic'

// Who holds a listed stock (T-471):  GET /live-data/stock-holders?symbol=AAPL
//
// Serves one stock's slice of stockHolders.generated.json — institutional
// totals aggregated from the SEC's quarterly Form 13F data set, and the
// catalog funds holding the stock from their N-PORT filings, built over every
// NYSE & Nasdaq common stock the app's search lists. The figures are built
// offline by `npm run holders:build`; nothing is fetched here, so the route
// cannot fail upstream — a symbol outside the build answers ok:false with the
// build's own recorded reason where there is one. The file keeps manager
// names in a dictionary and rows as tuples; hydrateStockHolders puts the
// served shape back together.

const FILE = GENERATED as unknown as StockHoldersFile
const STOCKS_COVERED = Object.keys(FILE.stocks).length

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? '').trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'symbol required' }, { status: 400 })
  }

  const entry = hydrateStockHolders(FILE, symbol)
  const unresolvedReason = entry ? null : (FILE.unresolved.find((u) => u.symbol === symbol)?.reason ?? null)

  const body: StockHoldersResponse = {
    ok: entry !== null,
    symbol,
    builtOn: FILE.builtOn,
    period: FILE.thirteenF.period,
    managersInPeriod: FILE.thirteenF.managersInPeriod,
    fundsRead: FILE.fundsRead,
    stocksCovered: STOCKS_COVERED,
    entry,
    unresolvedReason,
    updatedAt: new Date().toISOString(),
    source: 'SEC Form 13F data set + N-PORT filings (built offline)',
  }
  return NextResponse.json(body)
}
