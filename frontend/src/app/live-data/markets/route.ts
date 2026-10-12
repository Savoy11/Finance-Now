import { NextRequest, NextResponse } from 'next/server'
import { ALL_COINGECKO_IDS, ASSET_ID_BY_COINGECKO, COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import { getProviderKey, recordProviderFetch } from '@/lib/api/live/providers'
import { coingeckoBase, coingeckoHeaders } from '@/lib/api/live/coingecko'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'

// Server-side proxy for market data.
// Supports multiple sources via ?source= query param:
//   "coingecko" (default) — CoinGecko free/paid tier
//   "coinmarketcap"       — CoinMarketCap Pro (requires key from Integrations)
//
// Each source falls back to the other on failure; the response's `source`
// field reports which provider actually served the data.
//
// Binance was the middle rung until 2026-10-12 and came out under T-423 (D91,
// D102): Binance.US licenses its data "personal to you" with no route to public
// use, and Binance.com's terms could not be read. It never carried market cap,
// supply or FDV, so it was always the thinnest rung. A `?source=binance` from
// an old client is served by CoinGecko like any other.
//
// Response shape:
//   { ok, updatedAt, quotes: Record<assetId, LiveQuote>, source }
// where LiveQuote = { price, marketCap, volume24h, priceChange24h, circulatingSupply }

export const dynamic = 'force-dynamic'


async function fetchCoinGecko(): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    vs_currency: 'usd', ids: ALL_COINGECKO_IDS.join(','),
    order: 'market_cap_desc', per_page: '250', page: '1',
    sparkline: 'false', price_change_percentage: '24h,7d,30d',
  })
  const res = await fetch(`${coingeckoBase()}/coins/markets?${params}`, {
    headers: coingeckoHeaders(),
    next: { revalidate: 60 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

  const rows = await res.json() as Array<{
    id: string; current_price: number | null; market_cap: number | null
    total_volume: number | null; price_change_percentage_24h: number | null; circulating_supply: number | null
    fully_diluted_valuation: number | null
    // All returned by the same /coins/markets call — no extra request.
    price_change_percentage_7d_in_currency: number | null
    price_change_percentage_30d_in_currency: number | null
    ath_change_percentage: number | null
    total_supply: number | null; max_supply: number | null
    market_cap_rank: number | null
  }>
  const quotes: Record<string, unknown> = {}
  for (const row of rows) {
    const assetId = ASSET_ID_BY_COINGECKO[row.id]
    if (!assetId) continue
    quotes[assetId] = {
      price: row.current_price ?? null, marketCap: row.market_cap ?? null,
      volume24h: row.total_volume ?? null, priceChange24h: row.price_change_percentage_24h ?? null,
      circulatingSupply: row.circulating_supply ?? null,
      // FDV is CoinGecko-only. The CMC fallback leg below does not
      // carry it, so it stays absent there rather than being derived — a
      // computed FDV from a partial supply figure would be a fabricated number
      // on a field users filter by.
      fdv: row.fully_diluted_valuation ?? null,
      priceChange7d: row.price_change_percentage_7d_in_currency ?? null,
      priceChange30d: row.price_change_percentage_30d_in_currency ?? null,
      // Negative: how far BELOW the all-time high the coin trades. The closest
      // thing to a technical factor available without per-coin OHLCV.
      athChangePct: row.ath_change_percentage ?? null,
      totalSupply: row.total_supply ?? null,
      maxSupply: row.max_supply ?? null,
      marketCapRank: row.market_cap_rank ?? null,
    }
  }
  return quotes
}

async function fetchCoinMarketCap(): Promise<Record<string, unknown>> {
  const key = getProviderKey('coinmarketcap')
  if (!key) throw new Error('CoinMarketCap key not configured')

  // Internal asset ids are lowercase ticker symbols — query CMC by symbol.
  // skip_invalid tolerates symbols CMC doesn't recognise, so one unknown ticker
  // does not fail the whole request.
  const symbols = Object.keys(COINGECKO_IDS).map((id) => id.toUpperCase()).join(',')
  const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${symbols}&skip_invalid=true&aux=circulating_supply`
  const res = await fetch(url, {
    headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' },
    next: { revalidate: 60 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`CoinMarketCap ${res.status}`)

  const body = await res.json() as {
    data?: Record<string, Array<{
      symbol: string
      circulating_supply: number | null
      quote?: { USD?: { price: number | null; market_cap: number | null; volume_24h: number | null; percent_change_24h: number | null } }
    }>>
  }

  const quotes: Record<string, unknown> = {}
  for (const [symbol, entries] of Object.entries(body.data ?? {})) {
    if (!Array.isArray(entries) || entries.length === 0) continue
    // CMC returns every token sharing a ticker — keep the canonical one
    // (largest market cap), same de-dup rule as the reserves route.
    const best = [...entries].sort(
      (a, b) => (b.quote?.USD?.market_cap ?? 0) - (a.quote?.USD?.market_cap ?? 0),
    )[0]
    const usd = best.quote?.USD
    if (!usd) continue
    quotes[symbol.toLowerCase()] = {
      price: usd.price ?? null,
      marketCap: usd.market_cap ?? null,
      volume24h: usd.volume_24h ?? null,
      priceChange24h: usd.percent_change_24h ?? null,
      circulatingSupply: best.circulating_supply ?? null,
    }
  }
  return quotes
}

type SourceId = 'coingecko' | 'coinmarketcap'

const FETCHERS: Record<SourceId, () => Promise<Record<string, unknown>>> = {
  coingecko: fetchCoinGecko,
  coinmarketcap: fetchCoinMarketCap,
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source') ?? 'coingecko'

  // Requested source first, then the others as fallbacks.
  const requested: SourceId = source === 'coinmarketcap' ? source : 'coingecko'
  const chain: SourceId[] = [requested, ...(['coingecko', 'coinmarketcap'] as SourceId[]).filter((s) => s !== requested)]

  for (let i = 0; i < chain.length; i++) {
    const src = chain[i]
    try {
      const quotes = await FETCHERS[src]()
      if (Object.keys(quotes).length === 0) throw new Error(`${src} returned no quotes`)
      recordProviderFetch(src, { count: Object.keys(quotes).length })
      return NextResponse.json({
        ok: true,
        updatedAt: new Date().toISOString(),
        quotes,
        source: i === 0 ? src : `${src}-fallback`,
      })
    } catch (err) {
      recordProviderFetch(src, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ok: false, updatedAt: null, quotes: {}, source, error: 'fetch_failed' })
}
