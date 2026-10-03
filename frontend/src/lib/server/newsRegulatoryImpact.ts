import 'server-only'

// Regulatory and thematic signals for the crypto news feed (/live-data/news):
// stories that bear on particular coins even when no coin is named. "MiCA
// regulation" affects USDC and USDT because they are the dominant EU-regulated
// stablecoins.
//
// Moved out of the route on 2026-10-01 so the mapping can be tested. TS-13
// (docs/assessments/tokenized-securities-2026-09-21.md) split the CLARITY Act
// out of the stablecoin entry and widened it; every other entry moved unchanged.

export interface RegulatoryImpact {
  re: RegExp
  /** Coin ids, or 'general' for a story that bears on the whole market. */
  assets: string[]
}

export const REGULATORY_IMPACT: readonly RegulatoryImpact[] = [
  // EU / MiCA — targets regulated stablecoin issuers
  {
    re: /\b(mica|markets in crypto.assets|eu stablecoin|ecb stablecoin|ecb digital|european stablecoin)\b/i,
    assets: ['usdc', 'usdt'],
  },
  // US stablecoin legislation: the GENIUS Act and the bills around it
  {
    re: /\b(genius act|stablecoin act|stablecoin bill|stablecoin legislation|us stablecoin|senate stablecoin|house stablecoin)\b/i,
    assets: ['usdc', 'usdt', 'pyusd'],
  },
  // US market-structure legislation: the CLARITY Act (H.R. 3633) and the
  // Senate's market-structure bill. It sets how every digital asset is
  // regulated, so 'general' carries it into every coin's feed. Until TS-13 it
  // shared the stablecoin entry above and reached only those three coins. It
  // keeps them, so widening the entry took no story out of a feed it was in.
  {
    re: /\b(clarity act|market structure (bill|legislation|law)|digital asset market structure|crypto market structure)\b/i,
    assets: ['usdc', 'usdt', 'pyusd', 'general'],
  },
  // Circle-specific enforcement / partnership news
  {
    re: /circle\b.{0,60}(regulat|licens|approv|partner|sec\b|cftc|federal|compliance)/i,
    assets: ['usdc'],
  },
  // Tether-specific enforcement / restriction
  {
    re: /tether\b.{0,60}(ban|regulat|restrict|probe|invest|doj|ofac|sanction)/i,
    assets: ['usdt'],
  },
  // PayPal fintech regulation indirectly hits PYUSD
  {
    re: /paypal\b.{0,60}(regulat|crypto|stablecoin|digital|licens)/i,
    assets: ['pyusd'],
  },
  // Paxos regulatory news hits USDP (and historically BUSD)
  {
    re: /paxos\b.{0,60}(regulat|nydfs|sec\b|licens|approv|busd)/i,
    assets: ['usdp', 'busd'],
  },
  // DeFi regulation hits protocol-backed stablecoins
  {
    re: /\b(defi regulat|decentralized finance regulat|defi protocol law|dao regulat)\b/i,
    assets: ['dai', 'frax', 'lusd'],
  },
  // CBDC competition / interoperability — relevant to all major stablecoins
  {
    re: /\bcbdc\b/i,
    assets: ['usdc', 'usdt'],
  },
  // Reserve requirement laws broadly affect fiat-backed stablecoins
  {
    re: /\b(reserve requirement|backing requirement|1.?to.?1 backing|full reserve|fractional reserve)\b/i,
    assets: ['usdc', 'usdt', 'tusd', 'gusd', 'usdp', 'pyusd'],
  },
  // Binance regulatory news touches BNB broadly
  {
    re: /binance\b.{0,60}(ban|regulat|fine|settle|doj|sec\b|cftc|money laundering)/i,
    assets: ['bnb', 'busd'],
  },
  // Lightning Network / Bitcoin payments
  {
    re: /\b(lightning network|lightning payment|bitcoin payment|bitcoin adoption|legal tender)\b/i,
    assets: ['btc'],
  },
  // Ethereum staking / ETF coverage
  {
    re: /\b(ethereum etf|eth etf|ethereum staking|proof.of.stake regulat|ethereum layer)\b/i,
    assets: ['eth'],
  },
]

/** Every coin id, or 'general', that a story's regulatory and thematic signals point at. */
export function regulatoryImpact(text: string): string[] {
  const found = new Set<string>()
  for (const { re, assets } of REGULATORY_IMPACT) {
    if (re.test(text)) assets.forEach((a) => found.add(a))
  }
  return [...found]
}
