import { NextResponse } from 'next/server'
import { ATTESTATION_META, COMPOSITION_MAP, DEFILLAMA_STABLECOINS, META_AS_OF, getStablecoinMetaProvenance, pickMonitoredStablecoins } from '@/lib/data/stablecoinMeta'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { chainSplit, supplyChange, type ChainSplit, type LlamaSupplyFields, type SupplyChange } from '@/lib/data/stablecoinSupply'
import { PEG_HISTORY_DAYS, PEG_OFF_THRESHOLD_PCT, pegHistoryFor, windowRows, type PegHistory, type PegPriceRow } from '@/lib/data/pegHistory'

export const dynamic = 'force-dynamic'

// ?history=1 (T-467, D242) serves each monitored dollar-pegged coin's last 90
// daily price readings against $1 — largest move and its date, days more than
// half a percent off, and the readings for a small chart — from the same host
// (stablecoins.llama.fi/stablecoinprices, cached an hour: the feed adds one row
// a day). Figures and dates only; no grade or alert (the D204 posture). The
// Monitor's own response is untouched.

export interface PegHistoryResponse {
  ok: boolean
  days: number
  thresholdPct: number
  /** Keyed by the coin's DefiLlama id (LiveReserveAsset.id). */
  histories: Record<string, PegHistory>
  /** Monitored coins with no history here, each with why. */
  excluded: Array<{ id: string; symbol: string; reason: string }>
  updatedAt: string
  error?: string
}

export interface LiveReserveAsset {
  id: string
  symbol: string
  name: string
  pegType: string
  pegMechanism: string
  circulatingUsd: number
  /** USD price from DefiLlama, or null when it sent none (never a stand-in $1.00, D214). */
  price: number | null
  priceSource: string
  chains: string[]
  /** Circulating supply's change over a day, a week and a month (T-449 a): facts, no alert (D204). */
  supplyChange: SupplyChange
  /** Where the supply sits: the largest chains and the rest grouped. */
  chainSplit: ChainSplit
  // Composition breakdown from DefiLlama (where available)
  composition: { category: string; percentage: number; amount: number; description: string }[]
  // Attestation metadata (static — from known issuer disclosures)
  attester: string
  attestationUrl: string
  lastAttestedDate: string | null
  collateralizationRatio: number | null  // null = not publicly disclosed
}

// Attestation metadata, reserve composition, META_AS_OF and the coins' DefiLlama ids live in
// src/lib/data/stablecoinMeta.ts (D190). The risk-scores engine that also read them went in RP-6.

interface DefiLlamaStablecoin extends LlamaSupplyFields {
  id: string
  gecko_id?: string | null
  name: string
  symbol: string
  pegType: string
  pegMechanism: string
  price?: number
  priceSource?: string
  chains?: string[]
}

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('history')) return pegHistoryResponse()
  try {
    const res = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`)
    const data = await res.json()

    const coins: DefiLlamaStablecoin[] = data.peggedAssets ?? []

    // DefiLlama lists several tokens under one ticker ("GUSD" is Gate USD AND
    // Gemini Dollar; "USDP" is Pax Dollar and others). Each monitored coin is
    // picked by DefiLlama's id instead (stablecoinMeta.ts says why: the old
    // largest-supply rule showed Gate USD under Gemini's auditor), and a coin
    // that cannot be found is named in notFound rather than dropped quietly.
    const { picked, notFound } = pickMonitoredStablecoins(coins)

    const assets: LiveReserveAsset[] = picked.map(({ key, coin }): LiveReserveAsset => {
      const meta = ATTESTATION_META[key] ?? null
      const rawComposition = COMPOSITION_MAP[key] ?? []
      const circulatingUsd = coin.circulating?.peggedUSD ?? 0

      // Composition percentages are shares of the RESERVE POOL, not of
      // circulating supply, so the dollar figures have to scale by the
      // collateralization ratio. Multiplying circulating supply alone is only
      // right at a 1.0 ratio: DAI was then disclosed at 1.5, so every leg was
      // understated by a third (~$1.51B shown for ETH collateral against
      // ~$2.27B disclosed) while the centre of the same donut read
      // "150.0% Collat." — one chart contradicting itself. LUSD (1.1) had the
      // same defect. A coin with no confirmed ratio (DAI since 2026-11-05,
      // D190) is scaled by 1, so its amounts are shares of its own supply.
      const reservePoolUsd = circulatingUsd * (meta?.collateralizationRatio ?? 1)
      const composition = rawComposition.map((c) => ({
        category: c.category,
        percentage: c.percentage,
        amount: reservePoolUsd * (c.percentage / 100),
        description: '',
      }))

      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        pegType: coin.pegType ?? 'peggedUSD',
        pegMechanism: coin.pegMechanism ?? 'unknown',
        circulatingUsd,
        // No price from DefiLlama is no price: a stand-in $1.00 read as "live and on the peg" to the
        // AI's reserves tool (code audit 2026-11-09, D214).
        price: typeof coin.price === 'number' && Number.isFinite(coin.price) ? coin.price : null,
        priceSource: coin.priceSource ?? 'DefiLlama',
        chains: coin.chains ?? [],
        supplyChange: supplyChange(coin, coin.pegType ?? 'peggedUSD'),
        chainSplit: chainSplit(coin, coin.pegType ?? 'peggedUSD'),
        composition,
        attester: meta?.attester ?? 'Not publicly disclosed',
        attestationUrl: meta?.attestationUrl ?? '#',
        lastAttestedDate: meta?.lastAttestedDate ?? null,
        collateralizationRatio: meta?.collateralizationRatio ?? null,
      }
    })

    assets.sort((a, b) => b.circulatingUsd - a.circulatingUsd)

    return NextResponse.json({ ok: true, assets, notFound, metaAsOf: META_AS_OF, metaProvenance: getStablecoinMetaProvenance(), updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, assets: [], error: String(err), updatedAt: new Date().toISOString() },
      { status: 200 }
    )
  }
}

/**
 * The peg history (T-467). One request to /stablecoinprices carries every
 * coin's one price per day; the window's readings are joined per monitored
 * coin by the geckoId the hand-kept table records (D190). The coins list is
 * read too (same 300s cache as the Monitor) for each coin's pegType: a coin
 * the list reports pegged to something other than the dollar is EXCLUDED with
 * the reason — the readings are dollar prices, so its distance from ITS peg
 * cannot be read from them. If only the list fails, histories still serve:
 * every monitored coin today is a dollar coin by the table's own construction,
 * and one upstream failure must not crash the route.
 */
async function pegHistoryResponse(): Promise<NextResponse> {
  const updatedAt = new Date().toISOString()
  const base = { days: PEG_HISTORY_DAYS, thresholdPct: PEG_OFF_THRESHOLD_PCT, updatedAt }
  try {
    const [pricesRes, listRes] = await Promise.allSettled([
      fetch('https://stablecoins.llama.fi/stablecoinprices', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      }),
      fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      }),
    ])

    if (pricesRes.status === 'rejected' || !pricesRes.value.ok) {
      const why = pricesRes.status === 'rejected' ? String(pricesRes.reason) : `DefiLlama HTTP ${pricesRes.value.status}`
      return NextResponse.json({ ok: false, ...base, histories: {}, excluded: [], error: why } satisfies PegHistoryResponse)
    }
    const rows = (await pricesRes.value.json()) as PegPriceRow[]
    const window = windowRows(Array.isArray(rows) ? rows : [])

    // pegType per monitored coin, where the list answered.
    const pegTypes = new Map<string, string>()
    if (listRes.status === 'fulfilled' && listRes.value.ok) {
      const data = await listRes.value.json().catch(() => null)
      const coins: Array<{ id: string | number; pegType?: string }> = data?.peggedAssets ?? []
      for (const c of coins) pegTypes.set(String(c.id), c.pegType ?? 'peggedUSD')
    }

    const histories: Record<string, PegHistory> = {}
    const excluded: PegHistoryResponse['excluded'] = []
    for (const [symbol, { id, geckoId }] of Object.entries(DEFILLAMA_STABLECOINS)) {
      const pegType = pegTypes.get(id)
      if (pegType && pegType !== 'peggedUSD') {
        excluded.push({ id, symbol, reason: `Pegged to ${pegType.replace('pegged', '')}, and the daily readings are dollar prices — its distance from its own peg cannot be read from them.` })
        continue
      }
      const history = pegHistoryFor(geckoId, window)
      if (history) histories[id] = history
      else excluded.push({ id, symbol, reason: 'The window holds no daily reading for this coin.' })
    }

    return NextResponse.json({ ok: true, ...base, histories, excluded } satisfies PegHistoryResponse)
  } catch (err) {
    return NextResponse.json({ ok: false, ...base, histories: {}, excluded: [], error: String(err) } satisfies PegHistoryResponse)
  }
}
