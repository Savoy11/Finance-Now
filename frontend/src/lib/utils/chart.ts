import type { RiskBand } from '@/types/asset'

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#14b8a6', // teal
]

export const RISK_BAND_CHART_COLORS: Record<RiskBand, string> = {
  low: '#10b981',
  moderate: '#3b82f6',
  elevated: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
}

/**
 * Reserve donut slices are coloured by position, not by category name. The old map keyed five
 * names ('T-Bills', 'Crypto Assets'…) that no issuer table used, so every slice fell back to one
 * grey and the donut could not be read (audit 2026-11-05). The palette leaves out red, orange,
 * amber and emerald, which this app uses for risk levels: a slice is a kind of asset, not a grade.
 * A slice the sources do not name ("Not confirmed", "Undisclosed") stays grey.
 */
export const RESERVE_SLICE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#0ea5e9'] as const
export const RESERVE_UNNAMED_COLOR = '#64748b'

export function reserveSliceColor(category: string, index: number): string {
  if (/undisclosed|not confirmed/i.test(category)) return RESERVE_UNNAMED_COLOR
  return RESERVE_SLICE_COLORS[index % RESERVE_SLICE_COLORS.length]
}

export const CHART_THEME = {
  background: 'transparent',
  grid: '#1e2433',
  axis: '#475569',
  tooltip: {
    background: '#1a1d26',
    border: '#1e2433',
    text: '#e2e8f0',
  },
}

/**
 * Returns fill and stroke colors for peg deviation area chart.
 * Green when tight, amber when moderate, red when wide.
 */
export function getPegDeviationColor(bps: number): {
  stroke: string
  fill: string
} {
  const abs = Math.abs(bps)
  if (abs < 10) return { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)' }
  if (abs < 50) return { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' }
  return { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)' }
}

/**
 * Generate a gradient stop array for a score arc (high score = green, low = red).
 */
export function getScoreGradientStops(score: number): { offset: string; color: string }[] {
  if (score >= 80) {
    return [
      { offset: '0%', color: '#10b981' },
      { offset: '100%', color: '#34d399' },
    ]
  }
  if (score >= 60) {
    return [
      { offset: '0%', color: '#3b82f6' },
      { offset: '100%', color: '#60a5fa' },
    ]
  }
  if (score >= 40) {
    return [
      { offset: '0%', color: '#f59e0b' },
      { offset: '100%', color: '#fbbf24' },
    ]
  }
  if (score >= 20) {
    return [
      { offset: '0%', color: '#f97316' },
      { offset: '100%', color: '#fb923c' },
    ]
  }
  return [
    { offset: '0%', color: '#ef4444' },
    { offset: '100%', color: '#f87171' },
  ]
}

export function formatChartValue(value: number, type: 'currency' | 'percent' | 'score' | 'bps'): string {
  switch (type) {
    case 'currency':
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
      if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
      return `$${value.toFixed(2)}`
    case 'percent':
      return `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`
    case 'score':
      return value.toFixed(1)
    case 'bps':
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}bps`
    default:
      return String(value)
  }
}
