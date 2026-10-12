import { NextResponse } from 'next/server'
import type { CoinListEntry, CoinListResponse } from '@/lib/types/coinList'
import { fetchCoinGeckoPages } from '@/lib/server/coingeckoPages'

export type { CoinListEntry, CoinListResponse }

export const dynamic = 'force-dynamic'

// Broad coin list: 3 pages × 250 = 750 coins from CoinGecko.
//
// Fetched SEQUENTIALLY — these three pages used to be issued in parallel, which
// tripped the free tier's burst limit and 429'd all three, so the route
// answered 503 even though any one page would have succeeded on its own
// (verified 2026-07-22). See lib/server/coingeckoPages.
interface CoinGeckoMarketRow {
  id: string; symbol: string; name: string
  current_price: number; market_cap: number; market_cap_rank: number; image: string
}

const marketsUrl = (page: number) =>
  'https://api.coingecko.com/api/v3/coins/markets' +
  `?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}` +
  '&sparkline=false&locale=en'

function toEntry(c: CoinGeckoMarketRow): CoinListEntry {
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    price: c.current_price ?? 0,
    marketCap: c.market_cap ?? 0,
    rank: c.market_cap_rank ?? 9999,
    image: c.image ?? '',
  }
}

export async function GET() {
  try {
    const { pages, errors } = await fetchCoinGeckoPages<CoinGeckoMarketRow>(3, marketsUrl)

    const coins: CoinListEntry[] = []
    const seen = new Set<string>()
    for (const rows of pages) {
      for (const row of rows) {
        const coin = toEntry(row)
        if (seen.has(coin.id)) continue
        seen.add(coin.id)
        coins.push(coin)
      }
    }

    if (coins.length === 0) {
      return NextResponse.json(
        {
          ok: false, coins: [], updatedAt: new Date().toISOString(), source: 'none',
          error: errors.join('; ') || 'CoinGecko returned no coins',
        },
        { status: 503 }
      )
    }

    // Market-cap rank order, and nothing else. Until 2026-10-12 coins listed on
    // Binance.US were moved ahead of every coin that is not, which put one
    // exchange's listing decisions above the market's own ordering in every list
    // built from this one. That lookup came out under T-423 (D91, D102):
    // Binance.US licenses its data "personal to you", with no route to public use.
    const sorted = [...coins].sort((a, b) => a.rank - b.rank)

    return NextResponse.json({
      ok: true,
      coins: sorted,
      updatedAt: new Date().toISOString(),
      source: 'coingecko',
      ...(errors.length > 0 ? { partial: true, error: errors.join('; ') } : {}),
    } satisfies CoinListResponse)
  } catch (err) {
    return NextResponse.json(
      { ok: false, coins: [], updatedAt: new Date().toISOString(), source: 'error', error: String(err) },
      { status: 500 }
    )
  }
}
