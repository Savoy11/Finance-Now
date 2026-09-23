import type { ProviderCategory, RiskProfile } from './stakingProviders'

// ─── Risk presets by provider category ───────────────────────────────────────
// These are starting-point values auto-filled into the risk form.
// Higher = riskier on each dimension (1–10 scale).

export const RISK_PRESETS: Record<ProviderCategory, RiskProfile> = {
  cefi: {
    custodyRisk:      7,  // They hold your keys
    counterpartyRisk: 7,  // Company failure risk
    contractRisk:     2,  // Usually no smart contracts
    slashingRisk:     2,  // Exchange absorbs slashing
    liquidityRisk:    5,  // Withdrawal delays common
    regulatoryRisk:   6,  // Regulated exchanges face more exposure
  },
  wallet: {
    custodyRisk:      2,  // You hold your keys
    counterpartyRisk: 3,  // Software/company can still disappear
    contractRisk:     3,  // Some wallet staking uses contracts
    slashingRisk:     4,  // Depends on validator selection
    liquidityRisk:    5,  // Unbonding periods apply
    regulatoryRisk:   3,
  },
  liquid: {
    custodyRisk:      2,  // Smart contract custody, not company
    counterpartyRisk: 3,  // Protocol governance risk
    contractRisk:     6,  // Smart contract bugs are real
    slashingRisk:     4,  // Pooled validator risk
    liquidityRisk:    3,  // Receipt token adds liquidity
    regulatoryRisk:   4,
  },
}

// Adjustments applied on top of presets based on observable signals

export function adjustRiskFromSignals(base: RiskProfile, signals: {
  tvlUsd: number
  auditCount: number
  isSmartContract: boolean
  chainMature: boolean   // mainnet with 2+ years history
  hasReceiptToken: boolean
}): RiskProfile {
  const r = { ...base }

  // TVL as a liquidity/counterparty signal
  if (signals.tvlUsd > 5_000_000_000)      { r.counterpartyRisk = Math.max(1, r.counterpartyRisk - 2); r.liquidityRisk = Math.max(1, r.liquidityRisk - 2) }
  else if (signals.tvlUsd > 500_000_000)   { r.counterpartyRisk = Math.max(1, r.counterpartyRisk - 1); r.liquidityRisk = Math.max(1, r.liquidityRisk - 1) }
  else if (signals.tvlUsd < 10_000_000)    { r.counterpartyRisk = Math.min(10, r.counterpartyRisk + 2); r.liquidityRisk = Math.min(10, r.liquidityRisk + 1) }
  else if (signals.tvlUsd < 50_000_000)    { r.counterpartyRisk = Math.min(10, r.counterpartyRisk + 1) }

  // Audits lower contract risk
  if (signals.isSmartContract) {
    if (signals.auditCount >= 3)           r.contractRisk = Math.max(1, r.contractRisk - 2)
    else if (signals.auditCount >= 1)      r.contractRisk = Math.max(1, r.contractRisk - 1)
    else                                   r.contractRisk = Math.min(10, r.contractRisk + 2)
  }

  // Mature chain lowers regulatory & contract risk slightly
  if (signals.chainMature) {
    r.regulatoryRisk = Math.max(1, r.regulatoryRisk - 1)
    r.contractRisk   = Math.max(1, r.contractRisk - 1)
  }

  // Receipt token improves liquidity
  if (signals.hasReceiptToken) r.liquidityRisk = Math.max(1, r.liquidityRisk - 1)

  return r
}

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
  risks:         RiskProfile
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
