import { EQUITY_CATALOG } from './equityCatalog'
import { FUND_CATALOG } from './fundCatalog'
import { ASSET_CATALOG } from './assetCatalog'
import { INSTRUMENTS, securitySymbol, type InstrumentClass } from './instruments'

// ─── What Compare can open by name ───────────────────────────────────────────
//
// The assets Compare's picker starts from, and how a symbol in its address
// (/compare?symbols=…) is read back. Lived inside compare/page.tsx until T-454
// (D209), when the asset pages' action row needed the same reading to know
// whether a link to Compare would open the asset the reader is looking at, or a
// different one that shares its symbol.

export type CompareKind = 'stock' | 'fund' | 'crypto' | 'macro'
export interface CompareOption { symbol: string; name: string; kind: CompareKind; cls: InstrumentClass; id?: string }

export const COMPARE_OPTIONS: CompareOption[] = [
  ...EQUITY_CATALOG.map((e) => ({ symbol: e.symbol, name: e.name, kind: 'stock' as const, cls: 'equity' as const })),
  ...FUND_CATALOG.map((f) => ({ symbol: f.symbol, name: f.name, kind: 'fund' as const, cls: (f.type === 'etf' ? 'etf' : 'mutual') as InstrumentClass })),
  ...ASSET_CATALOG.map((a) => ({ symbol: a.symbol, name: a.name, kind: 'crypto' as const, cls: 'crypto' as const, id: a.id })),
  // Macro instruments (commodities, FX pairs, yield indices) price through the
  // same security-chart route stocks and funds use — zero new plumbing, per
  // the P2-R3 integration. Coverage is provider-dependent since the Yahoo
  // removal; a symbol with no history lands in the existing `missing` banner
  // rather than silently vanishing.
  ...INSTRUMENTS.filter((i) => ['commodity', 'currency', 'rate'].includes(i.class)).map((i) => ({
    symbol: securitySymbol(i.key), name: i.name, kind: 'macro' as const, cls: i.class,
  })),
]

/** First in wins: a symbol two catalogs share opens as the stock, then the fund, then the coin. */
export const COMPARE_OPTION_BY_SYMBOL = new Map<string, CompareOption>()
for (const o of COMPARE_OPTIONS) if (!COMPARE_OPTION_BY_SYMBOL.has(o.symbol)) COMPARE_OPTION_BY_SYMBOL.set(o.symbol, o)

// Case-insensitive lookup for URL deep links: several crypto symbols are
// mixed-case in the catalog (USDe, lisUSD, …) and would otherwise round-trip
// into the URL but silently drop on reload (review finding).
export const COMPARE_OPTION_BY_UPPER = new Map<string, CompareOption>()
for (const o of COMPARE_OPTIONS) if (!COMPARE_OPTION_BY_UPPER.has(o.symbol.toUpperCase())) COMPARE_OPTION_BY_UPPER.set(o.symbol.toUpperCase(), o)

/**
 * An Option for a symbol no catalog knows.
 *
 * Typed as a security rather than crypto on purpose: `fetchPoints` sends crypto
 * to `/live-data/chart?id=` (a CoinGecko id, which an unknown symbol does not
 * have) and everything else to `/live-data/security-chart?symbol=`, which
 * accepts any ticker. So the security path is the only one that can possibly
 * succeed without more information — and a coin added through the picker carries
 * its real id, so it never lands here.
 */
export function provisionalCompareOption(symbol: string): CompareOption {
  return { symbol, name: symbol, kind: 'stock', cls: 'equity' }
}

/** What a symbol in Compare's address opens as: a catalog asset, else a provisional stock. */
export function compareOptionForLink(symbol: string): CompareOption {
  return COMPARE_OPTION_BY_UPPER.get(symbol.toUpperCase()) ?? provisionalCompareOption(symbol.toUpperCase())
}
