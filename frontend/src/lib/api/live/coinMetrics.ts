import type { RequiredCredit } from '@/lib/data/dataSources'

// Coin Metrics' Community API: the second source of crypto daily closes older than
// 365 days, after DefiLlama (T-434; owner, 2026-10-14, D108). DefiLlama had been the
// only one since CoinGecko's free service refuses history past 365 days (D103), which
// is the single-vendor state D21 rules out.
//
// Measured on the owner's machine 2026-10-14 (residential egress): keyless, a daily
// USD reference price at 00:00 UTC back to each coin's start (Bitcoin from 2010-07-18),
// published with about a day's lag; one request returns a coin's whole history; the
// docs set 10 requests per 6 seconds per IP. Its grant is the Creative Commons BY-NC
// 4.0 licence, stated on its Community Data page: public display for non-commercial
// use, with a credit. Before launch that is personal use (D96); at launch it turns on
// T-151, whether Finance Now is commercial. The reading is in sourceTerms.ts.

/**
 * Internal coin id → Coin Metrics asset. Hand-maintained and never derived from a
 * symbol: a ticker can name two coins (Twelve Data and FMP serve a 2022 "TIA" that is
 * not Celestia). Every entry was checked on 2026-10-14: each Coin Metrics series
 * agreed with DefiLlama's price on 2024-06-03 and 2025-06-02 within 10% (AAVE and KAS
 * differed on one day, and other sources sided with Coin Metrics), and, since price
 * cannot tell one stablecoin from another, each stablecoin's series starts on or after
 * its coin's launch. Left out: coins Coin Metrics does not carry (TON, PI, TEL,
 * MemeCore, EURCV, XSGD, USDM, vBUSD) and series that stopped updating (MKR and AMPL
 * at 2026-03-25, USDK at 2023-04-17). Two differ from the internal id: IOTA is
 * `miota`, Bittensor `tao_bittensor`.
 */
export const COINMETRICS_ASSETS: Readonly<Record<string, string>> = {
  // Stablecoins
  usdc: 'usdc', usdt: 'usdt', dai: 'dai', frax: 'frax', tusd: 'tusd', pyusd: 'pyusd',
  usdp: 'usdp', gusd: 'gusd', lusd: 'lusd', busd: 'busd', usde: 'usde', usdg: 'usdg',
  rlusd: 'rlusd', usdd: 'usdd', eurc: 'eurc', fdusd: 'fdusd', usdy: 'usdy', gho: 'gho',
  usd0: 'usd0', cusd: 'cusd',
  // Layer 1s and majors
  btc: 'btc', eth: 'eth', sol: 'sol', bnb: 'bnb', avax: 'avax', ada: 'ada', xrp: 'xrp',
  dot: 'dot', pol: 'pol', trx: 'trx', hype: 'hype', zec: 'zec', xmr: 'xmr', bch: 'bch',
  hbar: 'hbar', ltc: 'ltc', sui: 'sui', cro: 'cro', near: 'near', tao: 'tao_bittensor',
  icp: 'icp', etc: 'etc', kas: 'kas', algo: 'algo', flr: 'flr', xdc: 'xdc', fil: 'fil',
  apt: 'apt', inj: 'inj', vet: 'vet', sei: 'sei', tia: 'tia', chz: 'chz', gno: 'gno',
  xtz: 'xtz', kaia: 'kaia', cfx: 'cfx', iota: 'miota', dcr: 'dcr', theta: 'theta',
  atom: 'atom', doge: 'doge',
  // DeFi
  uni: 'uni', aave: 'aave', link: 'link', snx: 'snx', crv: 'crv', ldo: 'ldo', grt: 'grt',
}

/**
 * The credit Creative Commons BY-NC 4.0 requires wherever the data is shared: who made
 * it, a link to the material, and a notice referring to the licence. Shown only on a
 * response Coin Metrics served (the owner's choice, D108), carried as `attributions`.
 */
export const COINMETRICS_ATTRIBUTION: RequiredCredit = {
  text: 'Price history: Coin Metrics Community Data',
  href: 'https://docs.coinmetrics.io/packages/coin-metrics-community-data',
  license: { text: 'CC BY-NC 4.0', href: 'https://creativecommons.org/licenses/by-nc/4.0/' },
}
