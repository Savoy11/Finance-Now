// What a portfolio's funds cost each year (T-448, D197).
//
// The fee arithmetic already existed three times over (the fund page's Fee Drag Analyzer,
// the Portfolio Builder's fee summary, reviewPlan's fee-creep check) and none of it reached a
// portfolio. This turns the funds a portfolio holds into three figures: their expense ratio
// weighted by value, what that costs in dollars a year, and what it costs over ten years
// against a 0.03% index fund, through the same feeImpact engine the Fund Registry and the
// fund page use, so the three surfaces agree by construction.
//
// A figure, never a verdict. There is no threshold and no warning: the code-checker's
// do-not-fix registry records the Portfolio Builder's deliberate absence of a fee warning,
// and this keeps to it. Nothing here rates a holding (D92).
//
// Pure on purpose (house rule: anything producing a dollar figure a user acts on is pure and
// tested). The caller decides what dollars each position stands for: live values on a
// tracked portfolio, or a share of $10,000 on a what-if one (PER_WHAT_IF_USD).

import { getEquity } from './equityCatalog'
import { DEFAULT_FEE_IMPACT_PARAMS, FEE_IMPACT_BENCHMARK_ER_PCT, feeImpact } from './feeImpact'
import { fundSalesCharge, getFund } from './fundCatalog'
import { INSTRUMENT_BY_KEY, isSecurityKey, securitySymbol } from './instruments'

/** The ten-year horizon the proposal names. */
export const COST_HORIZON_YEARS = 10
/** The same gross return the fund pages assume by default, so the figures agree with them. */
export const COST_RETURN_PCT = DEFAULT_FEE_IMPACT_PARAMS.annualReturnPct
/** The index fund every cost is compared against: the fund pages' benchmark. */
export const COST_BENCHMARK_ER_PCT = FEE_IMPACT_BENCHMARK_ER_PCT
/** A what-if portfolio has no real dollars, so its costs are shown per this much invested. */
export const PER_WHAT_IF_USD = 10_000

export interface CostPosition {
  /** Instrument key: a coin id, or "sec:" and a ticker. */
  key: string
  symbol: string
  /** The dollars this position stands for, or null when it has none (no live price). */
  valueUsd: number | null
}

export interface FundCostLine {
  symbol: string
  name: string
  valueUsd: number
  expenseRatioPct: number
  /** valueUsd × expense ratio. */
  annualCostUsd: number
  /** Ten years' fees against the benchmark, a verified front load included. */
  horizonCostUsd: number
  /** A verified front load is in horizonCostUsd. */
  includesLoad: boolean
  /** A sales charge applies whose rate is not verified: the figures understate the cost. */
  unverifiedLoad: boolean
}

export interface PortfolioCosts {
  /** Funds counted, largest first. */
  funds: FundCostLine[]
  /** Their combined value. */
  fundValueUsd: number
  /** Expense ratio weighted by value across the funds counted, or null when none was. */
  weightedExpenseRatioPct: number | null
  annualCostUsd: number
  horizonCostUsd: number
  /** Funds held with no value right now: left out of every figure, never valued at cost. */
  unpricedFunds: string[]
  /**
   * Securities in neither the fund nor the stock catalog. If one is a fund, its fee is not on
   * file, so it is named rather than counted as free.
   */
  feeNotOnFile: string[]
}

const isFundKey = (key: string) => isSecurityKey(key) && getFund(securitySymbol(key)) !== undefined

/** A security the app cannot place: neither a catalog stock nor a catalog fund nor a macro instrument. */
function isUnknownSecurity(key: string): boolean {
  if (!isSecurityKey(key)) return false
  const sym = securitySymbol(key)
  return !getFund(sym) && !getEquity(sym) && !INSTRUMENT_BY_KEY[key]
}

export function portfolioFundCosts(positions: readonly CostPosition[]): PortfolioCosts {
  const funds: FundCostLine[] = []
  const unpricedFunds: string[] = []
  const feeNotOnFile: string[] = []

  for (const p of positions) {
    if (isUnknownSecurity(p.key)) { feeNotOnFile.push(p.symbol); continue }
    if (!isFundKey(p.key)) continue
    const fund = getFund(securitySymbol(p.key))!
    if (p.valueUsd == null || !Number.isFinite(p.valueUsd)) { unpricedFunds.push(fund.symbol); continue }
    if (p.valueUsd <= 0) continue
    const impact = feeImpact(fund, {
      principal: p.valueUsd,
      years: COST_HORIZON_YEARS,
      annualReturnPct: COST_RETURN_PCT,
    })
    const charge = fundSalesCharge(fund)
    funds.push({
      symbol: fund.symbol,
      name: fund.name,
      valueUsd: p.valueUsd,
      expenseRatioPct: fund.expenseRatioPct,
      annualCostUsd: (p.valueUsd * fund.expenseRatioPct) / 100,
      horizonCostUsd: impact?.costUsd ?? 0,
      includesLoad: impact?.includesLoad ?? false,
      unverifiedLoad: charge != null && charge.maxPct == null,
    })
  }

  funds.sort((a, b) => b.valueUsd - a.valueUsd || a.symbol.localeCompare(b.symbol))
  const fundValueUsd = funds.reduce((s, f) => s + f.valueUsd, 0)
  const annualCostUsd = funds.reduce((s, f) => s + f.annualCostUsd, 0)
  return {
    funds,
    fundValueUsd,
    weightedExpenseRatioPct: fundValueUsd > 0 ? (annualCostUsd / fundValueUsd) * 100 : null,
    annualCostUsd,
    horizonCostUsd: funds.reduce((s, f) => s + f.horizonCostUsd, 0),
    unpricedFunds,
    feeNotOnFile,
  }
}

/**
 * A what-if portfolio's positions as shares of PER_WHAT_IF_USD, by target allocation, so its
 * costs read "per $10,000 invested in this mix". Every position has a figure: an allocation
 * needs no live price.
 */
export function whatIfCostPositions(
  holdings: readonly { cgId: string; symbol: string; targetAlloc: number }[],
): CostPosition[] {
  return holdings.map((h) => ({
    key: h.cgId,
    symbol: h.symbol,
    valueUsd: (PER_WHAT_IF_USD * Math.max(0, h.targetAlloc)) / 100,
  }))
}

/**
 * A tracked portfolio's positions at live values. Holdings with no units left are skipped;
 * a holding with no live price keeps a null value, so it is named as left out.
 */
export function trackedCostPositions(
  holdings: readonly { instrumentKey: string; symbol: string; quantityHeld: string; valueUsd: string | null }[],
): CostPosition[] {
  return holdings
    .filter((h) => h.quantityHeld !== '0')
    .map((h) => ({ key: h.instrumentKey, symbol: h.symbol, valueUsd: h.valueUsd == null ? null : Number(h.valueUsd) }))
}
