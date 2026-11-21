// ─── Stablecoin supply: how it changed, and where it sits (T-449 a, D204) ─────
//
// DefiLlama's stablecoin list, which /live-data/reserves already reads, carries
// each coin's circulating supply now and a day, a week and a month earlier, and
// the same four figures for every blockchain the coin is issued on. The route
// kept only today's total. A fast fall in supply means holders are redeeming:
// the plainest public sign of strain on a stablecoin, shown beside its peg.
//
// Facts only (owner, D204): no alert rings on a fall. There is no standard size
// for "a big fall", and the right line is easier to pick once normal swings have
// been seen. Pure; the route passes DefiLlama's objects in.

/** DefiLlama keys every amount by the coin's peg type, e.g. { peggedUSD: 176776895353.9 }. */
type PeggedAmount = Readonly<Record<string, number | undefined>> | undefined

export interface LlamaSupplyFields {
  circulating?: PeggedAmount
  circulatingPrevDay?: PeggedAmount
  circulatingPrevWeek?: PeggedAmount
  circulatingPrevMonth?: PeggedAmount
  chainCirculating?: Readonly<Record<string, {
    current?: PeggedAmount
    circulatingPrevDay?: PeggedAmount
    circulatingPrevWeek?: PeggedAmount
    circulatingPrevMonth?: PeggedAmount
  }>>
}

export interface SupplyChange {
  /** Percent change in circulating supply, to hundredths; null when the earlier figure is missing or zero. */
  day: number | null
  week: number | null
  month: number | null
}

export interface ChainShare {
  chain: string
  /** Circulating supply on this chain, in units of the peg (dollars for a dollar coin). */
  amount: number
  /** Share of the coin's supply summed across its chains, percent to one decimal. */
  pct: number
}

export interface ChainSplit {
  /** The largest chains, biggest first. */
  top: ChainShare[]
  /** Every other chain with supply on it, together; null when there are none. */
  others: { count: number; amount: number; pct: number } | null
}

/** How many chains are named before the rest are grouped. */
export const CHAINS_SHOWN = 5

const amountOf = (v: PeggedAmount, pegType: string): number | null => {
  const n = v?.[pegType]
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

/** Percent change from `before` to `now`, to hundredths, or null when it cannot be worked out. */
export function pctChange(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before <= 0) return null
  return Math.round(((now - before) / before) * 10_000) / 100
}

/** Circulating supply's change over a day, a week and a month, from one DefiLlama coin. */
export function supplyChange(coin: LlamaSupplyFields, pegType: string): SupplyChange {
  const now = amountOf(coin.circulating, pegType)
  return {
    day: pctChange(now, amountOf(coin.circulatingPrevDay, pegType)),
    week: pctChange(now, amountOf(coin.circulatingPrevWeek, pegType)),
    month: pctChange(now, amountOf(coin.circulatingPrevMonth, pegType)),
  }
}

/**
 * Where the supply sits: the largest chains with their share, the rest grouped.
 * Shares are of the supply summed across chains, which can differ slightly from
 * the coin's headline circulating figure; a chain holding nothing is left out.
 */
export function chainSplit(coin: LlamaSupplyFields, pegType: string, shown = CHAINS_SHOWN): ChainSplit {
  const rows = Object.entries(coin.chainCirculating ?? {})
    .map(([chain, v]) => ({ chain, amount: amountOf(v?.current, pegType) ?? 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.chain.localeCompare(b.chain))
  const total = rows.reduce((s, r) => s + r.amount, 0)
  if (total <= 0) return { top: [], others: null }
  const share = (n: number) => Math.round((n / total) * 1000) / 10
  const top = rows.slice(0, shown).map((r) => ({ ...r, pct: share(r.amount) }))
  const rest = rows.slice(shown)
  const restAmount = rest.reduce((s, r) => s + r.amount, 0)
  return { top, others: rest.length > 0 ? { count: rest.length, amount: restAmount, pct: share(restAmount) } : null }
}

/** "−1.25%" / "+0.40%" / "—", with a true minus sign. */
export function formatSupplyChange(pct: number | null): string {
  if (pct === null) return '—'
  if (pct === 0) return '0.00%'
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`
}
