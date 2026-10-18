/**
 * The staking catalog's facts a person must check (T-394), as one list both outputs read:
 * the Staking Facts Check page (scripts/gen-staking-facts-page.ts) and the plan that reads
 * its answers back (scripts/staking-facts-plan.ts). One list, so the two cannot disagree
 * on what a row is or what its key means. Pure: providers are a parameter.
 *
 * What is left to check, per T-394's next action: each provider's website, year founded
 * and audit count; its staking-assets figure where DefiLlama cannot see it (exchanges and
 * wallets); and, per coin it stakes, the minimum stake and the lock-up. TVL for the
 * protocols DefiLlama tracks and the static APRs were applied on 2026-09-24, so they are
 * not rows here. Defunct providers are left out: their terms are history, not a page.
 */
import type { StakingProvider, StakingCoinId } from '../../src/lib/data/stakingProviders'

/**
 * Catalog id → DefiLlama protocol slug, for the providers whose TVL DefiLlama tracks
 * as a staking protocol. OBSERVED on 2026-09-24 against api.llama.fi/protocols, not
 * guessed: a wrong slug lands another protocol's TVL beside a provider's name. CeFi
 * exchanges are deliberately absent — DefiLlama's "binance-cex" is the exchange's
 * whole balance sheet, not its staking book, and comparing it to `tvlBillions` would
 * be a category error. Providers not listed here get a name-match CANDIDATE printed
 * for a human to confirm, never a value.
 *
 * Moved here from gen-staking-catalog-worksheet.ts on 2026-10-17, so the worksheet and
 * the Staking Facts Check page agree on which assets figures a person must read.
 */
export const LLAMA_SLUG: Readonly<Record<string, string>> = {
  lido: 'lido',
  rocketpool: 'rocket-pool',
  marinade: 'marinade-liquid-staking',
  jito: 'jito-liquid-staking',
  stride: 'stride',
  benqi: 'benqi-staked-avax',
  etherfi: 'ether.fi-stake',
  frax: 'frax-ether',
  stakewise: 'stakewise-v3',
  stader: 'stader',
  swell: 'swell-liquid-staking',
  renzo: 'renzo',
  'kelp-dao': 'kelp',
  puffer: 'puffer-stake',
  bedrock: 'bedrock-unibtc',
  sanctum: 'sanctum-validator-lsts',
  babylon: 'babylon-protocol',
  lombard: 'lombard-lbtc',
  ankr: 'ankr',
  metapool: 'meta-pool-near',
  // The four below were printed as name-match CANDIDATES on the 2026-09-24 run and
  // confirmed by the owner on 2026-09-25.
  'origin-protocol': 'origin-ether',
  quicksilver: 'quicksilver-protocol',
  pstake: 'pstake-lsd',
  bifrost: 'bifrost-liquid-staking',
}

/**
 * The lock-ups the audit of 2026-09-26 questioned (docs/audits/staking-lockups-2026-09-26.md,
 * "What this asks for"): rows whose figure disagrees with what the chain does, and which
 * carry no note saying why. The page marks each one "Start here". A lead holds only while
 * the catalog still has the figure and the note it questioned, so a corrected row, or one
 * that gains a note, drops out by itself. Keyed by row key.
 */
const LEAD_ASKS = {
  sol: 'Solana unstaking takes about 2 to 3 days, and every row with a note says 3. This row’s longer figure has no note. If the page confirms the longer wait, choose Matches and say why in the note; if not, type its figure.',
  trx: 'TRON’s current rules (Stake 2.0) make unstaking take 14 days, and the one row with a note says 14. This row’s 3 days looks like the older rule.',
  near: 'NEAR’s own documentation puts unstaking at 4 epochs, about 24 to 48 hours, not 4 days. Check what this provider says, and put its words in the note.',
  eth: 'An exchange can pay out unstaked ETH at once, but with no note a 0 here cannot be told apart from a figure nobody filled in. Check whether withdrawals are immediate, and say so in the note.',
} as const

function leads(coin: keyof typeof LEAD_ASKS, days: number, note: string | null, providers: string[]) {
  return providers.map((id) => [`${id}:${coin}:terms`, { days, note, ask: LEAD_ASKS[coin] }] as const)
}

export const LOCKUP_LEADS: Readonly<Record<string, { days: number; note: string | null; ask: string }>> = Object.fromEntries([
  ...leads('sol', 5, null, ['kraken', 'okx', 'bybit', 'crypto-com', 'bitget', 'gate-io', 'htx']),
  ...leads('sol', 7, null, ['kucoin']),
  ...leads('trx', 3, null, ['binance', 'trust-wallet', 'gate-io', 'htx']),
  ...leads('near', 4, '~4-day NEAR unstaking', ['coinbase', 'kucoin', 'gate-io']),
  // The audit's "nine CeFi rows" at 0 with no note: Nexo and KuCoin are left out, being
  // lending and soft staking, where zero is right and their features say so.
  ...leads('eth', 0, null, ['okx', 'crypto-com', 'bitget', 'gate-io', 'htx', 'robinhood', 'gemini', 'bitstamp', 'mexc']),
  // Two the agent evaluation of 2026-10-17 raised (docs/assessments/T6-agents-2026-10-17.md,
  // D136): the Research Analyst read both rows out as staking options, as they stand.
  ['uniswap:eth:terms', {
    days: 0,
    note: null,
    ask: 'This row is an ETH/USDC trading pool, which earns trading fees and is not staking. Check whether Uniswap offers ETH staking at all; if it does not, choose Not offered.',
  }],
  ['kraken:eth:terms', {
    days: 7,
    note: null,
    ask: 'The catalog says Kraken stopped staking for US customers after its 2023 SEC settlement, which may be out of date. Check whether Kraken offers ETH staking in the US today, and put what its page says in the note.',
  }],
])

export type FactKind = 'site' | 'founded' | 'audits' | 'assets' | 'terms'
export type FieldType = 'url' | 'year' | 'count' | 'billions' | 'amount' | 'days'

export interface FactField {
  name: string
  type: FieldType
  /** The catalog's value now; null where it has none (an audit count nobody recorded). */
  catalog: number | string | null
  /** The unit a person types in, for an amount: the coin's symbol. */
  unit?: string
}

export interface FactRow {
  /** `<provider>:<kind>`, or `<provider>:<coin>:terms` for a coin's minimum and lock-up. */
  key: string
  providerId: string
  kind: FactKind
  coin?: StakingCoinId
  fields: FactField[]
  /** The catalog's own note beside the figure (a lock-up note), shown, never checked. */
  note?: string
  /** Why this row is worth checking first (LOCKUP_LEADS), while the catalog still says what was questioned. */
  lead?: string
}

/** The coin symbols the rows name, keyed by coin id (STAKING_COIN_INFO's symbols). */
export type CoinSymbols = Partial<Record<StakingCoinId, string>>

/** Every fact a person must check, provider by provider, in catalog order. */
export function stakingFactRows(
  providers: readonly StakingProvider[],
  symbols: CoinSymbols,
  llamaSlug: Readonly<Record<string, string>> = LLAMA_SLUG,
  lockupLeads: Readonly<Record<string, { days: number; note: string | null; ask: string }>> = LOCKUP_LEADS,
): FactRow[] {
  const rows: FactRow[] = []
  for (const p of providers) {
    if (p.defunct) continue
    rows.push({ key: `${p.id}:site`, providerId: p.id, kind: 'site', fields: [{ name: 'url', type: 'url', catalog: p.website ?? null }] })
    rows.push({ key: `${p.id}:founded`, providerId: p.id, kind: 'founded', fields: [{ name: 'year', type: 'year', catalog: p.founded ?? null }] })
    // Audits: where the catalog records a count, and for every liquid protocol, whose
    // contracts are what an audit covers, so a missing count is worth a look.
    if (p.auditCount != null || p.category === 'liquid') {
      rows.push({ key: `${p.id}:audits`, providerId: p.id, kind: 'audits', fields: [{ name: 'count', type: 'count', catalog: p.auditCount ?? null }] })
    }
    // Assets: only a figure the catalog shows that DefiLlama does not supply.
    if (p.tvlBillions != null && !llamaSlug[p.id]) {
      rows.push({ key: `${p.id}:assets`, providerId: p.id, kind: 'assets', fields: [{ name: 'billions', type: 'billions', catalog: p.tvlBillions }] })
    }
    for (const [coin, a] of Object.entries(p.assets) as Array<[StakingCoinId, NonNullable<StakingProvider['assets'][StakingCoinId]>]>) {
      const key = `${p.id}:${coin}:terms`
      const lead = lockupLeads[key]
      const leadHolds = lead !== undefined && a.lockupDays === lead.days && (a.lockupNote ?? null) === lead.note
      rows.push({
        key,
        providerId: p.id,
        kind: 'terms',
        coin,
        fields: [
          { name: 'min', type: 'amount', catalog: a.minStakeNative, unit: symbols[coin] ?? coin.toUpperCase() },
          { name: 'lockup', type: 'days', catalog: a.lockupDays },
        ],
        note: a.lockupNote,
        ...(leadHolds ? { lead: lead.ask } : {}),
      })
    }
  }
  return rows
}
