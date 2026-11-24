import { NextResponse } from 'next/server'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { DEFI_PROTOCOL_BY_COIN, coinProtocolFromFeed, type CoinProtocol, type LlamaProtocolEntry } from '@/lib/data/defiProtocols'

// DefiLlama extended data — protocol TVL rankings, chain TVL, DEX volumes, fee revenue.
// All completely free, no API key needed.
//
// Response: { ok, protocols, chains, dexVolume, feeRevenue, updatedAt }
//
// ?coin=<assetId> (T-469) answers only that coin's protocol — value locked
// across the protocol's parts, from the same cached /protocols fetch, matched
// by the hand-kept map in lib/data/defiProtocols.ts (never a name or ticker).
// The default response is untouched; the TA page's Market Structure panel
// keeps reading it as before.

export const dynamic = 'force-dynamic'

export interface CoinProtocolResponse {
  ok: boolean
  coin: string
  /** Null when the coin is unmapped or its protocol is absent from the feed. */
  protocol: CoinProtocol | null
  reason?: string
  updatedAt: string
}

export interface Protocol {
  name: string
  tvl: number
  change24h: number | null
  change7d: number | null
  category: string
  chain: string
  logo: string | null
}

export interface ChainTvl {
  name: string
  tvl: number
  change24h: number | null
  protocols: number | null
}

export interface DefiTvlData {
  ok: boolean
  totalTvl: number
  protocols: Protocol[]
  chains: ChainTvl[]
  dexVolume24h: number | null
  feeRevenue24h: number | null
  updatedAt: string
}

export async function GET(req: Request): Promise<NextResponse> {
  const coin = new URL(req.url).searchParams.get('coin')
  if (coin) return coinProtocolResponse(coin.toLowerCase())

  const [protocolsRes, chainsRes, dexRes, feesRes] = await Promise.allSettled([
    fetch('https://api.llama.fi/protocols', { next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }),
    fetch('https://api.llama.fi/v2/chains', { next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }),
    fetch('https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume', { next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }),
    fetch('https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees', { next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }),
  ])

  let protocols: Protocol[] = []
  let chains: ChainTvl[] = []
  let dexVolume24h: number | null = null
  let feeRevenue24h: number | null = null

  if (protocolsRes.status === 'fulfilled' && protocolsRes.value.ok) {
    const raw = await protocolsRes.value.json() as Array<{
      name: string; tvl: number; change_1d: number | null; change_7d: number | null;
      category: string; chain: string; logo: string | null
    }>
    protocols = raw
      .filter((p) => p.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 50)
      .map((p) => ({
        name: p.name,
        tvl: p.tvl,
        change24h: p.change_1d ?? null,
        change7d: p.change_7d ?? null,
        category: p.category ?? 'Other',
        chain: p.chain ?? 'Multi',
        logo: p.logo ?? null,
      }))
  }

  if (chainsRes.status === 'fulfilled' && chainsRes.value.ok) {
    const raw = await chainsRes.value.json() as Array<{
      name: string; tvl: number; change_1d: number | null; protocols: number | null
    }>
    chains = raw
      .filter((c) => c.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 20)
      .map((c) => ({
        name: c.name,
        tvl: c.tvl,
        change24h: c.change_1d ?? null,
        protocols: c.protocols ?? null,
      }))
  }

  if (dexRes.status === 'fulfilled' && dexRes.value.ok) {
    const raw = await dexRes.value.json() as { total24h?: number }
    dexVolume24h = raw.total24h ?? null
  }

  if (feesRes.status === 'fulfilled' && feesRes.value.ok) {
    const raw = await feesRes.value.json() as { total24h?: number }
    feeRevenue24h = raw.total24h ?? null
  }

  const totalTvl = chains.reduce((s, c) => s + c.tvl, 0)

  return NextResponse.json({
    ok: protocols.length > 0 || chains.length > 0,
    totalTvl,
    protocols,
    chains,
    dexVolume24h,
    feeRevenue24h,
    updatedAt: new Date().toISOString(),
  } satisfies DefiTvlData)
}

/** One coin's protocol figure. Reads only /protocols — the same 5-minute-cached fetch as the panel. */
async function coinProtocolResponse(coin: string): Promise<NextResponse> {
  const updatedAt = new Date().toISOString()
  if (!DEFI_PROTOCOL_BY_COIN[coin]) {
    return NextResponse.json({ ok: true, coin, protocol: null, reason: 'This coin has no mapped protocol.', updatedAt } satisfies CoinProtocolResponse)
  }
  try {
    const res = await fetch('https://api.llama.fi/protocols', { next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) })
    if (!res.ok) {
      return NextResponse.json({ ok: false, coin, protocol: null, reason: `DefiLlama answered HTTP ${res.status}.`, updatedAt } satisfies CoinProtocolResponse)
    }
    const raw = (await res.json()) as LlamaProtocolEntry[]
    const protocol = coinProtocolFromFeed(coin, raw)
    return NextResponse.json({
      ok: true,
      coin,
      protocol,
      ...(protocol ? {} : { reason: 'The protocol is not in the feed right now.' }),
      updatedAt,
    } satisfies CoinProtocolResponse)
  } catch (e) {
    return NextResponse.json({ ok: false, coin, protocol: null, reason: e instanceof Error ? e.message : 'fetch failed', updatedAt } satisfies CoinProtocolResponse)
  }
}
