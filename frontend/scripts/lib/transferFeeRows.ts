/**
 * The transfer-fee table as a list of checkable rows, one per exchange × coin × network.
 *
 * Shared by the CSV worksheet (gen-transfer-fee-worksheet.ts) and the owner's check page
 * (gen-fee-check-page.ts, T-031 / D52), so the two can never count, rank or link the job
 * differently. Before this file the ranking, the fee-page links and the core-45 cut lived
 * only inside the worksheet generator.
 *
 * Reads the table; never writes it.
 */
import { EXCHANGES, COIN_INFO, NETWORKS, type Exchange } from '../../src/lib/data/transferFees'

// ─── Impact ranking ──────────────────────────────────────────────────────────
//
// 428 rows reads as hopeless and gets abandoned; "check these and you have
// covered most real transfers" gets finished. This orders the work by how
// likely a row is to sit on a route someone actually takes.
//
// ⚠ This is a JUDGEMENT about usage, not measured data and not a fee value.
// Getting the order wrong costs some wasted effort; it cannot make the table
// wrong. Re-rank it freely.
const COIN_WEIGHT: Record<string, number> = {
  usdt: 10, usdc: 9, btc: 8, eth: 8,
  sol: 4, xrp: 3, bnb: 3, doge: 2, ltc: 2, trx: 2, ada: 2, matic: 2, avax: 2,
}
const NETWORK_WEIGHT: Record<string, number> = {
  trc20: 10, erc20: 9, bep20: 7, solana: 6, polygon: 5, arbitrum: 5, bitcoin: 5,
  base: 3, optimism: 3, avalanche: 3, xrpl: 3,
}
export function impactScore(tier: number, coinId: string, networkId: string): number {
  const t = tier === 1 ? 3 : 1
  return t * (COIN_WEIGHT[coinId] ?? 1) * (NETWORK_WEIGHT[networkId] ?? 1)
}

/** The 80/20 line: enough of the highest-impact rows to cover the routes people
 *  actually take, small enough that someone will finish it in one sitting. */
export const CORE_N = 45

// Withdrawal-fee pages, best known at time of writing. These are a starting point,
// NOT verified links — exchanges move these pages and several require a login to
// show live fees. If one 404s, search "<exchange> withdrawal fees" and please fix
// the entry here so the next pass doesn't hit the same dead end.
export const FEE_PAGES: Record<string, string> = {
  binance: 'https://www.binance.com/en/fee/cryptoFee',
  coinbase: 'https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees',
  kraken: 'https://support.kraken.com/hc/en-us/articles/360000767986',
  okx: 'https://www.okx.com/fees',
  bybit: 'https://www.bybit.com/en/help-center/article/Deposit-Withdrawal-Fee',
  kucoin: 'https://www.kucoin.com/vip/level',
  cryptocom: 'https://crypto.com/exchange/document/fees-limits',
  bitget: 'https://www.bitget.com/fee',
  gateio: 'https://www.gate.io/fee',
  htx: 'https://www.htx.com/support/en-us/detail/360000203002',
  mexc: 'https://www.mexc.com/fee',
  gemini: 'https://www.gemini.com/fees',
  bitfinex: 'https://www.bitfinex.com/fees',
  bitstamp: 'https://www.bitstamp.net/fee-schedule/',
  upbit: 'https://upbit.com/service_center/guide',
  robinhood: 'https://robinhood.com/us/en/support/articles/crypto-fees/',
  hyperliquid: 'https://hyperliquid.gitbook.io/hyperliquid-docs',
  bingx: 'https://bingx.com/en-us/rate/',
  phemex: 'https://phemex.com/fees-conditions',
  woox: 'https://woox.io/en/fees',
  bitmart: 'https://www.bitmart.com/fee/en-US',
  bitrue: 'https://www.bitrue.com/fee',
  lbank: 'https://www.lbank.com/fees',
  pionex: 'https://www.pionex.com/blog/pionex-fees/',
}

export const rowKey = (exchangeId: string, coinId: string, networkId: string): string =>
  `${exchangeId}:${coinId}:${networkId}`

export interface FeeRow {
  /** `exchangeId:coinId:networkId` — the identity `fee-apply` and the reconcile key on. */
  key: string
  tier: 1 | 2
  exchangeId: string
  /** Display names, exactly as `fee-apply` resolves them back to ids. */
  exchange: string
  coin: string
  coinId: string
  coinName: string
  network: string
  networkId: string
  fee: number
  minWithdraw: number
  withdrawEnabled: boolean
  depositEnabled: boolean
  note: string
  /** The 2026-07-20 partial pass left this marker on the entries it checked. */
  recentlyChecked: boolean
  impact: number
}

/** Every row of the table, in table order. */
export function feeRows(exchanges: readonly Exchange[] = EXCHANGES): FeeRow[] {
  const rows: FeeRow[] = []
  for (const ex of exchanges) {
    for (const [coinId, coin] of Object.entries(ex.coins)) {
      if (!coin) continue
      const info = COIN_INFO[coinId as keyof typeof COIN_INFO]
      for (const n of coin.networks) {
        const note = n.note ?? ''
        rows.push({
          key: rowKey(ex.id, coinId, n.networkId),
          tier: ex.tier,
          exchangeId: ex.id,
          exchange: ex.name,
          coinId,
          coin: info?.symbol ?? coinId.toUpperCase(),
          coinName: info?.name ?? coinId.toUpperCase(),
          networkId: n.networkId,
          network: NETWORKS[n.networkId]?.shortName ?? n.networkId,
          fee: n.withdrawFee,
          minWithdraw: n.minWithdraw,
          withdrawEnabled: n.withdrawEnabled,
          depositEnabled: n.depositEnabled,
          note,
          recentlyChecked: /re-verified 2026-07/i.test(note),
          impact: impactScore(ex.tier, coinId, n.networkId),
        })
      }
    }
  }
  return rows
}

/** Highest impact first; ties break alphabetically so output is stable across runs. */
export function byImpact(a: FeeRow, b: FeeRow): number {
  return (
    b.impact - a.impact ||
    a.tier - b.tier ||
    a.exchange.localeCompare(b.exchange) ||
    a.coin.localeCompare(b.coin) ||
    a.network.localeCompare(b.network)
  )
}
