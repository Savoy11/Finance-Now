/**
 * How the rating's numbers read on screen (T-420 item 5). Pure, and shared by the rating
 * panel and the methodology page, so a figure reads the same in both. Every number here
 * comes from methodology/v1.ts or from the engine's output; nothing is typed in.
 */
import { METHODOLOGY_V1 as M } from './methodology/v1'
import type { RatedAssetKind, RatingClassNumber } from './assetRating'

type Unit = 'percent' | 'usd' | 'ratio'

/** Three significant figures, trailing zeros dropped: 45.678 → 45.7, 0.050 → 0.05, 2 → 2. */
function sig3(x: number): string {
  return String(Number(x.toPrecision(3)))
}

function usdCompact(v: number): string {
  const a = Math.abs(v)
  const [div, suffix] = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, '']
  return `${v < 0 ? '−' : ''}$${sig3(a / div)}${suffix}`
}

export function formatValue(value: number, unit: Unit): string {
  if (!Number.isFinite(value)) return '—'
  if (unit === 'percent') return `${value < 0 ? '−' : ''}${sig3(Math.abs(value) * 100)}%`
  if (unit === 'usd') return usdCompact(value)
  return `${sig3(value)}×`
}

/** A fraction as a whole percentage: 0.3 → "30%". For weights and floors. */
export function wholePercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

// ── the engine's raw figures (DimensionResult.raw) ───────────────────────────

const RAW: Record<string, { label: string; unit: Unit }> = {
  volatility: { label: 'Annualised volatility', unit: 'percent' },
  drawdown: { label: 'Largest fall from a peak', unit: 'percent' },
  medianDollarVolume: { label: 'Median daily volume', unit: 'usd' },
  turnover: { label: 'Turnover (volume ÷ market cap)', unit: 'percent' },
  marketCap: { label: 'Market cap', unit: 'usd' },
  debtToEquity: { label: 'Long-term debt ÷ equity', unit: 'ratio' },
  netMargin: { label: 'Net margin', unit: 'percent' },
}

/** One raw figure, labelled: "Annualised volatility 45.7%", or "… not available". */
export function describeRaw(key: string, value: number | null): string {
  const spec = RAW[key]
  const label = spec?.label ?? key
  if (value == null) return `${label} not available`
  return `${label} ${spec ? formatValue(value, spec.unit) : sig3(value)}`
}

// ── the curves (methodology tables) ──────────────────────────────────────────

const CURVE: Record<string, { label: string; unit: Unit }> = {
  volatility: { label: 'Volatility (annualised)', unit: 'percent' },
  drawdown: { label: 'Largest fall from a peak', unit: 'percent' },
  turnover: { label: 'Turnover (median daily volume ÷ market cap)', unit: 'percent' },
  dollarVolume: { label: 'Median daily dollar volume', unit: 'usd' },
  scale: { label: 'Market cap', unit: 'usd' },
  size: { label: 'Market cap', unit: 'usd' },
  debtToEquity: { label: 'Long-term debt ÷ equity', unit: 'ratio' },
  netMargin: { label: 'Net margin', unit: 'percent' },
}

export interface CurveRow {
  key: string
  label: string
  /** "30% → 90", in the curve's order. */
  points: string[]
}

/** Every curve one asset class uses, as the methodology page lists them. */
export function curveRows(kind: RatedAssetKind): CurveRow[] {
  const curves = (kind === 'crypto' ? M.crypto : M.stock).curves as Record<string, ReadonlyArray<readonly [number, number]>>
  return Object.entries(curves).map(([key, points]) => {
    const spec = CURVE[key] ?? { label: key, unit: 'ratio' as Unit }
    return { key, label: spec.label, points: points.map(([v, s]) => `${formatValue(v, spec.unit)} → ${s}`) }
  })
}

// ── the scale ────────────────────────────────────────────────────────────────

export interface ClassRange {
  cls: RatingClassNumber
  label: string
  min: number
  max: number
}

/** Each class with the scores it covers: class 1 is the top of the 0–100 scale. */
export function classRanges(): ClassRange[] {
  return M.classes.map((c, i) => ({
    cls: c.cls,
    label: c.label,
    min: c.min,
    max: i === 0 ? 100 : M.classes[i - 1].min - 1,
  }))
}
