import { fetchCoinGeckoPages } from './coingeckoPages'

/**
 * Which tokens in a CoinGecko market list are tokenized SECURITIES (TS-3).
 *
 * A tokenized share, fund or Treasury note is a representation of an existing
 * security, not a crypto project (docs/assessments/tokenized-securities-2026-09-21.md,
 * F3). Coin Discovery lists "candidate coins", so a BlackRock money-market fund
 * or a HELOC pool in that list is a category error; the crypto scanner may still
 * chart them, but should say what they are.
 *
 * Measured on the owner's machine on 2026-10-07 (residential egress, AS11426;
 * docs/audits/tokenized-securities-probe-2026-10-07.md): 72 tokens in CoinGecko's
 * broad "Tokenized Assets" category sat inside the scanner's top 750 by market
 * cap, and 22 inside Coin Discovery's default 250, the highest at rank 9.
 *
 * Membership comes from CoinGecko's own categories. The list below is the
 * SECURITY ones only. Deliberately left out, because their tokens are not
 * securities or the category mixes kinds:
 *   • tokenized-products ("Tokenized Assets"): the broad parent. It also holds
 *     tokenized gold and silver (XAUT, PAXG, KAU, KAG) and platform tokens.
 *   • tokenized-gold, tokenized-silver, tokenized-commodities, tokenized-btc:
 *     commodity- or crypto-backed tokens.
 *   • real-estate ("Tokenized Real Estate"): its ranked members are real-estate
 *     platforms' own tokens, not interests in a property.
 *   • tokenized-bank-deposit: deposits, which are not securities.
 *   • tokenized-t-bills, tokenized-treasury-bonds-t-bonds: empty on 2026-10-07.
 *   • tokenized-closed-end-funds-cefs, tokenized-non-us-government-securities:
 *     no member ranked inside 750 on 2026-10-07. Add them if one appears.
 * A security CoinGecko files only under the broad parent (on 2026-10-07: the
 * Spiko SAFO funds and Blockchain Capital's BCAP) is not caught. The pages say
 * the list comes from CoinGecko's categories, so the gap is CoinGecko's tagging,
 * stated rather than patched with a hand list.
 */
export const TOKENIZED_SECURITY_CATEGORIES = [
  { id: 'tokenized-stock', kind: 'tokenized stock' },
  { id: 'tokenized-exchange-traded-funds-etfs', kind: 'tokenized ETF' },
  { id: 'tokenized-treasuries', kind: 'tokenized Treasury fund' },
  { id: 'tokenized-money-market-fund-mmfs', kind: 'tokenized money-market fund' },
  { id: 'tokenized-credit', kind: 'tokenized credit' },
  { id: 'tokenized-private-credit', kind: 'tokenized private credit' },
  { id: 'tokenized-pre-ipo-stocks', kind: 'tokenized pre-IPO stock' },
] as const

export interface TokenizedSecurityIndex {
  /** CoinGecko id → the kinds it is filed under, in category order. */
  kinds: Record<string, string[]>
  /** Category ids that answered. */
  checked: string[]
  /** "category: reason" for each category that did not answer. */
  failed: string[]
}

/** One page (top 250 by market cap) per category is enough: anything ranked
 *  inside the app's 750-coin universe is far above a category's 250th member. */
const PER_CATEGORY = 250

/** Category membership changes slowly; a day keeps this to a handful of calls. */
const REVALIDATE_SECONDS = 86_400

const categoryUrl = (id: string) =>
  'https://api.coingecko.com/api/v3/coins/markets' +
  `?vs_currency=usd&category=${encodeURIComponent(id)}&order=market_cap_desc&per_page=${PER_CATEGORY}&page=1&sparkline=false`

/**
 * Fetch every security category, one at a time. A rate-limit refusal stops the
 * walk (continuing only lengthens the penalty) and the rest are reported as
 * failed, so a caller can say the check was partial instead of implying it ran.
 */
export async function fetchTokenizedSecurityIndex(): Promise<TokenizedSecurityIndex> {
  const index: TokenizedSecurityIndex = { kinds: {}, checked: [], failed: [] }
  let stopped = false
  for (const cat of TOKENIZED_SECURITY_CATEGORIES) {
    if (stopped) { index.failed.push(`${cat.id}: not tried after a rate limit`); continue }
    const { pages, errors, throttled } = await fetchCoinGeckoPages<{ id: string }>(
      1, () => categoryUrl(cat.id), { revalidate: REVALIDATE_SECONDS },
    )
    if (pages.length === 0) {
      index.failed.push(`${cat.id}: ${errors.join('; ') || 'no data'}`)
      if (throttled) stopped = true
      continue
    }
    index.checked.push(cat.id)
    for (const row of pages[0]) {
      if (!row?.id) continue
      ;(index.kinds[row.id] ??= []).push(cat.kind)
    }
  }
  return index
}

export interface ExcludedSecurity {
  cgId: string
  symbol: string
  name: string
  marketCapRank: number
  kinds: string[]
}

/** Split a market list into the tokens to keep and the tokenized securities. */
export function partitionTokenizedSecurities<T extends { id: string; symbol: string; name: string; market_cap_rank: number }>(
  coins: T[],
  index: Pick<TokenizedSecurityIndex, 'kinds'>,
): { kept: T[]; excluded: ExcludedSecurity[] } {
  const kept: T[] = []
  const excluded: ExcludedSecurity[] = []
  for (const c of coins) {
    const kinds = index.kinds[c.id]
    if (kinds?.length) {
      excluded.push({ cgId: c.id, symbol: c.symbol.toUpperCase(), name: c.name, marketCapRank: c.market_cap_rank, kinds })
    } else {
      kept.push(c)
    }
  }
  return { kept, excluded }
}
