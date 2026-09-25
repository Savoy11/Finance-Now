import type { ProviderCategory } from './stakingProviders'

// RISK_PRESETS and adjustRiskFromSignals() — per-category 1–10 risk presets adjusted by
// TVL, audits and chain maturity — were REMOVED on 2026-09-25 (owner decision D26), with
// the six dimensions they produced. See lib/data/stakingProviders.ts.

// ─── Provider IDs already in the built-in list ───────────────────────────────
// Used to deduplicate DefiLlama results. Add new built-in provider IDs here.

export const BUILTIN_PROVIDER_IDS = new Set([
  'celsius', 'coinbase', 'kraken', 'binance', 'okx', 'bybit',
  'ledger', 'metamask', 'phantom', 'trust-wallet', 'exodus',
  'lido', 'rocket-pool', 'marinade', 'jito', 'stride', 'benqi', 'ankr',
])

// DefiLlama project slugs that map to a provider already tracked
export const DEFILLAMA_SLUG_BLOCKLIST = new Set([
  'lido', 'rocket-pool', 'marinade', 'jito', 'stride', 'benqi', 'ankr',
  'coinbase', 'binance',
])

// ─── Finance Now stakeable coin symbols → upstream symbol patterns ──────────────────
//
// Used two different ways by /live-data/staking-discovery, and the difference matters:
//   · `ALL_STAKING_SYMBOLS.has(base)` — EXACT membership, gating the DefiLlama rung.
//   · `symbolToCoinId()` — `base.startsWith(s)`, resolving every rung's asset to a coin.
// So an entry has to be the literal symbol, not a fragment.
//
// ── Widened 2026-09-22 to include liquid-staking derivatives (T-399) ────────────
//
// It held nine base symbols and nothing else, which made it the binding constraint on
// three of the four upstreams — not the upstreams themselves, which is what T-399 was
// filed as. Measured on 2026-09-22 against live payloads:
//   · Pendle  — 28 markets cleared liquidity/APY/expiry and **0** resolved to a coin.
//               Its universe is wstETH and yield-bearing stables; `"WSTETH"` starts with
//               neither `ETH` nor `WETH`, so even the obviously-Ethereum market failed.
//   · Beefy   — 76 single-asset vaults → 8 resolved.
//   · DefiLlama — WSTETH alone accounts for 71 pools over $1m that were being discarded.
//
// ⚠ NOT EVERYTHING ENDING IN "ETH" BELONGS HERE, and the exclusions are the load-bearing
// part of this list. A liquid-staking or restaking token REPRESENTS A STAKED POSITION in
// the underlying coin, which is what this surface is for. A synthetic that merely tracks
// the price does not, and filing one under `eth` would present a debt or synth position
// as a staking opportunity. Excluded deliberately, each seen in the live data:
//   · ALETH   — Alchemix synthetic, minted against collateral. Not staked ETH.
//   · MSETH   — Metronome synth. Same reason.
//   · TETH, GETH, VBETH, SAVETH, STEAKETH, LIQUIDETH — vault or wrapper tokens that could
//     not be confidently classified from the payload alone. Left out rather than guessed;
//     an unresolved symbol costs a missed pool, a wrong one misattributes a yield.
// BTC derivatives (WBTC 81, CBBTC 45, TBTC, LBTC …) are absent for a simpler reason:
// there is no `btc` key in this map at all, so they are out of scope rather than excluded.
//
// Adding a symbol here widens BOTH the DefiLlama intake and the coin resolution, so a new
// entry should be a token someone would call "staked <coin>" without qualification.

export const COIN_SYMBOL_MAP: Record<string, string[]> = {
  // Order matters: `symbolToCoinId` returns the first coin whose list prefix-matches.
  eth: [
    'ETH', 'WETH',
    // Liquid staking
    'WSTETH', 'STETH', 'RETH', 'CBETH', 'OSETH', 'LSETH', 'FRXETH', 'SFRXETH',
    'OETH', 'METH', 'WBETH', 'CDCETH',
    // Liquid restaking
    'WEETH', 'EZETH', 'RSETH', 'RSWETH', 'SWETH', 'PUFETH', 'UNIETH',
  ],
  sol:   ['SOL', 'WSOL', 'JITOSOL', 'MSOL', 'BSOL', 'JUPSOL'],
  ada:   ['ADA'],
  dot:   ['DOT'],
  atom:  ['ATOM'],
  matic: ['MATIC', 'POL'],
  avax:  ['AVAX', 'SAVAX'],
  bnb:   ['BNB', 'WBNB', 'SLISBNB'],
  trx:   ['TRX'],
}

export const ALL_STAKING_SYMBOLS = new Set(
  Object.values(COIN_SYMBOL_MAP).flat()
)

// ─── Mature chains ────────────────────────────────────────────────────────────

export const MATURE_CHAINS = new Set([
  'Ethereum', 'Bitcoin', 'Solana', 'BNB', 'Polygon', 'Avalanche',
  'Arbitrum', 'Optimism', 'Base', 'Cosmos', 'Polkadot',
])

// ─── Custody model inference ──────────────────────────────────────────────────

export function inferCustodyModel(category: ProviderCategory): 'custodial' | 'non-custodial' | 'smart-contract' {
  if (category === 'cefi')   return 'custodial'
  if (category === 'wallet') return 'non-custodial'
  return 'smart-contract'
}

// ─── Custom provider interface (stored in Zustand) ───────────────────────────

export interface CustomStakingProvider {
  id:            string               // user-defined slug
  name:          string
  tagline:       string
  category:      ProviderCategory
  custodyModel:  'custodial' | 'non-custodial' | 'smart-contract'
  website:       string
  tvlUsd:        number | null
  auditCount:    number
  coins: Array<{
    symbol:        string             // e.g. 'ETH'
    coinId:        string             // our Finance Now coin id, e.g. 'eth'
    apr:           number
    lockupDays:    number
    receiptToken:  string
    liquid:        boolean
    notes:         string
  }>
  source:        'defillama' | 'manual'
  defiLlamaPool: string | null        // pool ID if sourced from DL
  addedAt:       string
  notes:         string
}
