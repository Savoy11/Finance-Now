/**
 * Asset-page risk ratings — the v1 engine (T-420 item 2; D92, D94, D95).
 *
 * Pure: inputs in, rating out, no I/O and no clock unless one is passed. Every number comes
 * from methodology/v1.ts, so the methodology section rendered from that file always describes
 * what this code does. Nothing here is shown to anyone while ASSET_PAGE_RATINGS_SHOWN is false.
 *
 * The steps follow docs/architecture/risk-ratings-methodology.md §5:
 *   required inputs → coverage → weighted score → cap rule → class → stability rule.
 *
 * Supersedes profiles/cryptoAsset.ts and profiles/equity.ts for this purpose. Those files are
 * left in place (nothing imports them); removing them is the owner's call, not a side effect.
 */

import { piecewise } from './normalize'
import { CORE_DIMENSIONS, METHODOLOGY_V1 as M, type AssetClassMethod, type DimensionSpec } from './methodology/v1'

export type RatedAssetKind = 'crypto' | 'stock'
export type RatingClassNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Raw facts for one asset. Every field is optional; the engine decides what is enough. */
export interface AssetRatingInputs {
  kind: RatedAssetKind
  /** Daily closes, oldest first. */
  closes?: number[]
  /** Daily volumes in units, aligned with `closes` (stocks) or in dollars (`dollarVolumes`). */
  volumes?: number[]
  /** Daily dollar volumes, oldest first (crypto feeds report volume in dollars). */
  dollarVolumes?: number[]
  marketCapUsd?: number | null
  /** Stocks only. */
  sector?: string | null
  fundamentals?: {
    longTermDebt?: number | null
    shareholdersEquity?: number | null
    netIncome?: number | null
    revenue?: number | null
    /** ISO date of the period the filing covers. */
    periodEnd?: string | null
  } | null
}

export interface DimensionResult {
  key: string
  label: string
  weight: number
  /** Weight after renormalising over the dimensions present; null when missing. */
  effectiveWeight: number | null
  subScore: number | null
  /** The raw figure, in the unit the methodology names (fraction, USD, ratio). */
  raw: Record<string, number | null>
  /** Why the dimension is missing or adjusted, in reader-facing words. */
  note?: string
}

export type AssetRating =
  | {
      rated: true
      version: string
      score: number
      cls: RatingClassNumber
      label: string
      coreScore: number
      coreCls: RatingClassNumber
      /** True when the cap rule lowered the score. */
      capped: boolean
      dimensions: DimensionResult[]
      /** 90-day volatility, shown beside the rating and never scored. */
      recentVolatility: number | null
    }
  | {
      rated: false
      version: string
      reason: string
      dimensions: DimensionResult[]
    }

// ── helpers ──────────────────────────────────────────────────────────────────

function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/** Sample standard deviation of daily log returns, annualised. */
export function annualisedVolatility(closes: number[], periodsPerYear: number): number | null {
  const r: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) r.push(Math.log(closes[i] / closes[i - 1]))
  }
  if (r.length < 2) return null
  const mean = r.reduce((a, b) => a + b, 0) / r.length
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1)
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear)
}

/** Largest fall from a peak to a later low, as a fraction (0.35 = 35%). */
export function maxDrawdownFraction(closes: number[]): number | null {
  if (closes.length < 2) return null
  let peak = closes[0]
  let worst = 0
  for (const p of closes) {
    if (p > peak) peak = p
    else if (peak > 0) worst = Math.max(worst, (peak - p) / peak)
  }
  return worst
}

const round1 = (x: number) => Math.round(x * 10) / 10

export function classForScore(score: number): { cls: RatingClassNumber; label: string } {
  for (const c of M.classes) if (score >= c.min) return { cls: c.cls, label: c.label }
  const last = M.classes[M.classes.length - 1]
  return { cls: last.cls, label: last.label }
}

/** Highest score that still falls in `cls`. */
export function topOfClass(cls: RatingClassNumber): number {
  const idx = M.classes.findIndex((c) => c.cls === cls)
  return idx <= 0 ? 100 : M.classes[idx - 1].min - 1
}

function methodFor(kind: RatedAssetKind): AssetClassMethod {
  return kind === 'crypto' ? M.crypto : M.stock
}

function monthsBetween(fromIso: string, now: Date): number {
  const from = new Date(fromIso)
  return (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
}

// ── dimensions ───────────────────────────────────────────────────────────────

function dimension(spec: DimensionSpec, subScore: number | null, raw: Record<string, number | null>, note?: string): DimensionResult {
  return {
    key: spec.key,
    label: spec.label,
    weight: spec.weight,
    effectiveWeight: null,
    subScore: subScore == null ? null : round1(subScore),
    raw,
    ...(note ? { note } : {}),
  }
}

function scoreDimensions(inputs: AssetRatingInputs, now: Date): DimensionResult[] {
  const method = methodFor(inputs.kind)
  const curves = method.curves
  const closes = (inputs.closes ?? []).slice(-method.priceWindowDays)
  const spec = (key: string) => method.dimensions.find((d) => d.key === key)!

  const vol = annualisedVolatility(closes, method.periodsPerYear)
  const dd = maxDrawdownFraction(closes)
  const out: DimensionResult[] = [
    dimension(spec('volatility'), vol == null ? null : piecewise(vol, curves.volatility), { volatility: vol }),
    dimension(spec('drawdown'), dd == null ? null : piecewise(dd, curves.drawdown), { drawdown: dd }),
  ]

  // Liquidity: median daily dollar volume over the volume window.
  let dollarVols: number[] = []
  if (inputs.dollarVolumes?.length) {
    dollarVols = inputs.dollarVolumes.slice(-method.volumeWindowDays)
  } else if (inputs.volumes?.length && inputs.closes?.length) {
    const n = Math.min(inputs.volumes.length, inputs.closes.length)
    const v = inputs.volumes.slice(n - method.volumeWindowDays > 0 ? n - method.volumeWindowDays : 0, n)
    const c = inputs.closes.slice(n - v.length, n)
    dollarVols = v.map((x, i) => x * c[i])
  }
  const medDollar = median(dollarVols)
  const cap = inputs.marketCapUsd != null && inputs.marketCapUsd > 0 ? inputs.marketCapUsd : null

  if (inputs.kind === 'crypto') {
    const turnover = medDollar != null && cap != null ? medDollar / cap : null
    const fromDollar = medDollar == null ? null : piecewise(medDollar, curves.dollarVolume)
    const fromTurnover = turnover == null ? null : piecewise(turnover, curves.turnover)
    let liq = fromDollar == null && fromTurnover == null ? null : Math.max(fromDollar ?? 0, fromTurnover ?? 0)
    let note: string | undefined
    if (liq != null && medDollar != null && medDollar < M.cryptoThinVolumeFloorUsd && liq > M.cryptoThinVolumeCap) {
      liq = M.cryptoThinVolumeCap
      note = `Capped at ${M.cryptoThinVolumeCap}: median daily volume is under $${M.cryptoThinVolumeFloorUsd / 1e6}M.`
    }
    out.push(dimension(spec('liquidity'), liq, { medianDollarVolume: medDollar, turnover }, note))
    out.push(dimension(spec('scale'), cap == null ? null : piecewise(cap, curves.scale), { marketCap: cap }))
    return out
  }

  // Stocks
  out.push(dimension(spec('liquidity'), medDollar == null ? null : piecewise(medDollar, curves.dollarVolume), { medianDollarVolume: medDollar }))
  out.push(dimension(spec('size'), cap == null ? null : piecewise(cap, curves.size), { marketCap: cap }))
  out.push(scoreFundamentals(inputs, spec('fundamentals'), method, now))
  return out
}

function scoreFundamentals(inputs: AssetRatingInputs, spec: DimensionSpec, method: AssetClassMethod, now: Date): DimensionResult {
  const sector = (inputs.sector ?? '').toLowerCase()
  if (M.fundamentalsExcludedSectors.includes(sector)) {
    return { ...dimension(spec, null, {}, 'Not applied to financial companies.'), weight: 0 }
  }
  const f = inputs.fundamentals
  if (!f || !f.periodEnd) return dimension(spec, null, {}, 'No annual filing found.')
  if (monthsBetween(f.periodEnd, now) > M.fundamentalsMaxAgeMonths) {
    return dimension(spec, null, {}, `No annual filing within ${M.fundamentalsMaxAgeMonths} months.`)
  }

  const parts: number[] = []
  const notes: string[] = []
  let de: number | null = null
  if (f.shareholdersEquity != null && f.longTermDebt != null) {
    if (f.shareholdersEquity <= 0) {
      parts.push(M.negativeEquityScore)
      notes.push(`Shareholders’ equity is negative, so debt ÷ equity scores ${M.negativeEquityScore}.`)
    } else {
      de = f.longTermDebt / f.shareholdersEquity
      parts.push(piecewise(de, method.curves.debtToEquity))
    }
  }
  let margin: number | null = null
  if (f.netIncome != null && f.revenue != null && f.revenue > 0) {
    margin = f.netIncome / f.revenue
    parts.push(piecewise(margin, method.curves.netMargin))
  }
  if (parts.length === 0) return dimension(spec, null, { debtToEquity: de, netMargin: margin }, 'The filing does not report debt, equity, income or revenue.')
  const sub = parts.reduce((a, b) => a + b, 0) / parts.length
  if (parts.length === 1) notes.push('Only one of the two components is reported.')
  return dimension(spec, sub, { debtToEquity: de, netMargin: margin }, notes.join(' ') || undefined)
}

// ── the rating ───────────────────────────────────────────────────────────────

export function rateAsset(inputs: AssetRatingInputs, now: Date = new Date()): AssetRating {
  const method = methodFor(inputs.kind)
  const dims = scoreDimensions(inputs, now)
  const base = { version: M.version }

  // 1. Required inputs: a full year of prices, then volatility and drawdown.
  const days = inputs.closes?.length ?? 0
  if (days < method.minHistoryDays) {
    return { ...base, rated: false, reason: 'Not enough history to rate (needs one year of prices).', dimensions: dims }
  }
  const byKey = (k: string) => dims.find((d) => d.key === k)!
  if (CORE_DIMENSIONS.some((k) => byKey(k).subScore == null)) {
    return { ...base, rated: false, reason: 'Not enough history to rate (needs one year of prices).', dimensions: dims }
  }

  // 2. Coverage: dimensions present must carry the floor share of the applicable weight.
  const applicable = dims.filter((d) => d.weight > 0)
  const totalWeight = applicable.reduce((a, d) => a + d.weight, 0)
  const present = applicable.filter((d) => d.subScore != null)
  const presentWeight = present.reduce((a, d) => a + d.weight, 0)
  if (presentWeight / totalWeight < M.coverageFloor) {
    return { ...base, rated: false, reason: 'Not enough data to rate this asset.', dimensions: dims }
  }
  for (const d of present) d.effectiveWeight = Math.round((d.weight / presentWeight) * 10000) / 10000

  // 3. Weighted score.
  const weighted = present.reduce((a, d) => a + d.weight * (d.subScore as number), 0) / presentWeight

  // 4. Cap rule: no more than `capClassesAboveCore` classes better than price risk alone.
  const core = CORE_DIMENSIONS.map(byKey)
  const coreWeight = core.reduce((a, d) => a + d.weight, 0)
  const coreScore = core.reduce((a, d) => a + d.weight * (d.subScore as number), 0) / coreWeight
  const coreCls = classForScore(coreScore).cls
  const bestAllowed = Math.max(1, coreCls - M.capClassesAboveCore) as RatingClassNumber
  const ceiling = topOfClass(bestAllowed)
  const capped = weighted > ceiling
  const score = round1(capped ? ceiling : weighted)

  // 5. Class from score.
  const { cls, label } = classForScore(score)

  const recentVolatility = annualisedVolatility((inputs.closes ?? []).slice(-M.recentVolatilityDays), method.periodsPerYear)

  return { ...base, rated: true, score, cls, label, coreScore: round1(coreScore), coreCls, capped, dimensions: dims, recentVolatility }
}

// ── stability rule (§5 item 6) ───────────────────────────────────────────────

export interface StabilityResult {
  /** The class to show. */
  shownCls: RatingClassNumber
  /** Today's class from the score alone. */
  currentCls: RatingClassNumber
  /** True when the rule is keeping the shown class away from today's. */
  held: boolean
}

/**
 * The shown class changes only when the class at EVERY weekly reading in the last
 * `stabilityWeeks` lies outside the class shown; it then moves to the class matched at
 * most of those readings (ties go to the more recent). A new rating starts at its
 * current class.
 *
 * @param previousShown the class shown before today, or null for a new rating
 * @param weeklyClasses classes at the weekly readings, oldest first, today's included
 */
export function applyStability(previousShown: RatingClassNumber | null, weeklyClasses: RatingClassNumber[]): StabilityResult {
  if (weeklyClasses.length === 0) throw new RangeError('applyStability needs at least one reading')
  const currentCls = weeklyClasses[weeklyClasses.length - 1]
  if (previousShown == null) return { shownCls: currentCls, currentCls, held: false }

  const window = weeklyClasses.slice(-M.stabilityWeeks)
  const full = window.length >= M.stabilityWeeks
  const allOutside = full && window.every((c) => c !== previousShown)
  if (!allOutside) return { shownCls: previousShown, currentCls, held: currentCls !== previousShown }

  const counts = new Map<RatingClassNumber, number>()
  window.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1))
  let best = currentCls
  let bestCount = -1
  for (let i = window.length - 1; i >= 0; i--) {
    const c = window[i]
    const n = counts.get(c)!
    if (n > bestCount) { best = c; bestCount = n }
  }
  return { shownCls: best, currentCls, held: best !== currentCls }
}
