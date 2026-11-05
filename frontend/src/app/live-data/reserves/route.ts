import { NextResponse } from 'next/server'
import { ATTESTATION_META, COMPOSITION_MAP, META_AS_OF, getStablecoinMetaProvenance, pickMonitoredStablecoins } from '@/lib/data/stablecoinMeta'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'

export const dynamic = 'force-dynamic'

export interface LiveReserveAsset {
  id: string
  symbol: string
  name: string
  pegType: string
  pegMechanism: string
  circulatingUsd: number
  price: number
  priceSource: string
  chains: string[]
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

interface DefiLlamaStablecoin {
  id: string
  gecko_id?: string | null
  name: string
  symbol: string
  pegType: string
  pegMechanism: string
  circulating?: { peggedUSD?: number }
  price?: number
  priceSource?: string
  chains?: string[]
}

export async function GET() {
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
        price: coin.price ?? 1,
        priceSource: coin.priceSource ?? 'DefiLlama',
        chains: coin.chains ?? [],
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
