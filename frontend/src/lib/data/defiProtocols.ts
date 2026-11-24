// ─────────────────────────────────────────────────────────────────────────────
// A DEFI COIN'S PROTOCOL, MEASURED (T-469, owner decision D242, 2026-11-24).
//
// The value locked in the protocol a DeFi token governs, from the feed the app
// already polls every five minutes (/live-data/defi-tvl → api.llama.fi). The
// figure measures the PROTOCOL, not the token — the token's price is not a
// claim on that value — and every surface showing it says so.
//
// THE MATCH IS A HAND-KEPT MAP, NEVER A NAME OR TICKER (D190's lesson, the
// COINMETRICS_ASSETS pattern). What the real feed shows (read 2026-11-24; the
// dated excerpt is this module's test fixture):
//  - A protocol's versions are SEPARATE entries sharing a `parentProtocol` id
//    ("parent#aave" holds Aave V1–V4, Horizon, Arc, Aptos), so "the protocol's
//    value locked" is the SUM of its parts, and matching one entry by name
//    would publish one version's figure as the whole.
//  - `gecko_id` cannot be the join: the version entries mostly carry null
//    (only Aave V2 of Aave's seven parts names 'aave'), and no Uniswap entry
//    names 'uniswap' at all.
// So each coin maps to its protocol's parent id, or to its one entry's `slug`
// where the protocol has a single entry (Lido). A coin the map does not name
// shows nothing — and every unmapped catalog DeFi coin is listed below with
// its reason, so the gap is a decision, not an oversight.
// ─────────────────────────────────────────────────────────────────────────────

/** The fields the aggregation reads from one /protocols entry. */
export interface LlamaProtocolEntry {
  name: string
  slug: string
  tvl: number | null
  change_1d: number | null
  change_7d: number | null
  category: string | null
  parentProtocol?: string | null
  gecko_id?: string | null
}

export interface CoinProtocol {
  /** The protocol's name as shown — hand-kept, because the feed names versions, not the whole. */
  name: string
  /** Value locked across the protocol's parts, USD. */
  tvl: number
  /** Combined from each part's own figure; null when any counted part lacks one. */
  change24hPct: number | null
  change7dPct: number | null
  /** The largest part's category — a protocol's parts can differ in kind. */
  category: string | null
  /** How many feed entries (versions/products) the figure adds up. */
  parts: number
}

export const DEFI_PROTOCOL_BY_COIN: Record<string, { name: string; parent?: string; slug?: string }> = {
  uni: { name: 'Uniswap', parent: 'parent#uniswap' },
  aave: { name: 'Aave', parent: 'parent#aave' },
  // The Maker protocol rebranded to Sky; DefiLlama files its products (Sky
  // Lending, Sky RWA…) under the old parent id. MKR is still the catalog coin.
  mkr: { name: 'Sky (formerly Maker)', parent: 'parent#maker' },
  crv: { name: 'Curve', parent: 'parent#curve-finance' },
  ldo: { name: 'Lido', slug: 'lido' },
}

/**
 * The catalog's other DeFi coins, deliberately unmapped — each with why, so a
 * new DeFi coin fails the map test until someone decides its row.
 */
export const DEFI_PROTOCOL_UNMAPPED: Record<string, string> = {
  snx: 'The feed reports almost no value for Synthetix’s current versions (its v1+v2 entry reports none at all), so a figure read from it would misstate the protocol. Left out rather than shown wrong.',
  grt: 'The Graph is an indexing network; the feed lists it with no locked value.',
  link: 'Chainlink is an oracle network, not a protocol holding user deposits; the feed carries no locked value filed under its token.',
  ampl: 'Ampleforth adjusts its own supply rather than holding deposits; there is no locked value to show.',
  vbusd: 'vBUSD is a single lending-market receipt token for a stablecoin being wound down, not a protocol of its own.',
}

/** The feed entries that belong to this coin's protocol, or [] for an unmapped coin. */
export function entriesForCoin(assetId: string, entries: readonly LlamaProtocolEntry[]): LlamaProtocolEntry[] {
  const m = DEFI_PROTOCOL_BY_COIN[assetId]
  if (!m) return []
  return entries.filter((e) => (m.parent ? e.parentProtocol === m.parent : e.slug === m.slug))
}

/**
 * One figure from the protocol's parts. Parts with no value locked are left
 * out (they add nothing and several carry no change figures). A window's
 * combined change exists only when EVERY counted part reports one — a missing
 * part would silently shrink the base — and is worked out from each part's own
 * figure: the part's value a day ago is tvl / (1 + change), so the whole's
 * change is today's sum against that sum. A change at or below −100% cannot
 * yield a prior value and voids the window.
 */
export function combineProtocol(name: string, entries: readonly LlamaProtocolEntry[]): CoinProtocol | null {
  const parts = entries.filter((e) => (e.tvl ?? 0) > 0)
  if (parts.length === 0) return null
  const tvl = parts.reduce((s, p) => s + (p.tvl ?? 0), 0)

  const combined = (change: (p: LlamaProtocolEntry) => number | null): number | null => {
    let prev = 0
    for (const p of parts) {
      const c = change(p)
      if (c === null || c <= -100) return null
      prev += (p.tvl ?? 0) / (1 + c / 100)
    }
    if (prev <= 0) return null
    return (tvl / prev - 1) * 100
  }

  const largest = parts.reduce((a, b) => ((b.tvl ?? 0) > (a.tvl ?? 0) ? b : a))
  return {
    name,
    tvl,
    change24hPct: combined((p) => p.change_1d),
    change7dPct: combined((p) => p.change_7d),
    category: largest.category ?? null,
    parts: parts.length,
  }
}

/** The card's figure for one coin, or null (unmapped, or the protocol absent from the feed). */
export function coinProtocolFromFeed(assetId: string, entries: readonly LlamaProtocolEntry[]): CoinProtocol | null {
  const m = DEFI_PROTOCOL_BY_COIN[assetId]
  if (!m) return null
  return combineProtocol(m.name, entriesForCoin(assetId, entries))
}

/** The one plain line every surface showing the figure carries. */
export function protocolNotTokenLine(protocolName: string, symbol: string): string {
  return `This measures value locked in the ${protocolName} protocol, not the ${symbol} token: the token’s price is not a claim on this value.`
}
