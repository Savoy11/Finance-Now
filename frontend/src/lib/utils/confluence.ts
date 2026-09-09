/**
 * Multi-timeframe confluence label.
 *
 * The thresholds are PROPORTIONAL, not absolute counts. They used to be
 * absolute (`bullish >= 4` for strong, `>= 3` for moderate) over a panel that
 * loads five timeframes but often has fewer, and that produced two backwards
 * readings:
 *
 *   - With only three timeframes loaded, "strong" was unreachable — a
 *     unanimous 3/3 was reported as merely "moderate".
 *   - With six loaded, 4/6 (67%) was "strong" while that unanimous 3/3 (100%)
 *     was not. The weaker agreement got the stronger word.
 *
 * A share of the timeframes that actually answered is the thing the label is
 * describing, so that is what it now measures.
 */
export const CONFLUENCE_STRONG_RATIO = 0.75
export const CONFLUENCE_MODERATE_RATIO = 0.6
/** Below this, agreement is not meaningful enough to name at all. */
export const CONFLUENCE_MIN_LOADED = 3

export interface ConfluenceLabel {
  text: string
  color: string
  /** 'strong' | 'moderate' | 'mixed' — exposed so tests and callers can assert the band without parsing prose. */
  band: 'strong' | 'moderate' | 'mixed'
}

export function confluenceLabel(
  loadedCount: number,
  bullish: number,
  bearish: number,
): ConfluenceLabel | null {
  if (loadedCount < CONFLUENCE_MIN_LOADED) return null

  const bullRatio = bullish / loadedCount
  const bearRatio = bearish / loadedCount

  if (bullRatio >= CONFLUENCE_STRONG_RATIO)
    return { band: 'strong', text: `${bullish}/${loadedCount} timeframes bullish — strong confluence`, color: 'text-emerald-400' }
  if (bearRatio >= CONFLUENCE_STRONG_RATIO)
    return { band: 'strong', text: `${bearish}/${loadedCount} timeframes bearish — strong confluence`, color: 'text-red-400' }
  if (bullRatio >= CONFLUENCE_MODERATE_RATIO)
    return { band: 'moderate', text: `${bullish}/${loadedCount} timeframes bullish — moderate confluence`, color: 'text-green-400' }
  if (bearRatio >= CONFLUENCE_MODERATE_RATIO)
    return { band: 'moderate', text: `${bearish}/${loadedCount} timeframes bearish — moderate confluence`, color: 'text-orange-400' }

  return { band: 'mixed', text: 'Mixed signals across timeframes — no clear confluence', color: 'text-text-muted' }
}
