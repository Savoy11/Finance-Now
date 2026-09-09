/**
 * Provenance for the CBDC fallback table.
 *
 * These live here rather than in the route because a Next route module may
 * export only handlers and its config keys — `next build` fails type generation
 * on any other export ("Property 'cbdcFallbackAgeDays' is incompatible with
 * index signature"). Splitting them out also makes them testable without
 * loading the route.
 */

export interface CbdcFallbackProvenance {
  source: string
  verifiedAt: string
  ageDays: number
  stale: boolean
  confidence: 'high' | 'medium' | 'low'
}


/**
 * The date the fallback table was compiled AS A WHOLE — 28a78c5, 2026-06-28.
 * A one-line correction landed 2026-07-07 (99cc802); per the repo's provenance
 * rule a partial edit does not re-date the table, because re-verifying two rows
 * of 55 does not refresh the other 53.
 */
export const CBDC_FALLBACK_COMPILED = '2026-06-28'
/** Country CBDC programmes move on a policy timescale, not a market one. */
export const CBDC_FALLBACK_STALE_AFTER_DAYS = 180

export function cbdcFallbackAgeDays(now: Date = new Date()): number {
  const compiled = new Date(`${CBDC_FALLBACK_COMPILED}T00:00:00Z`).getTime()
  return Math.max(0, Math.floor((now.getTime() - compiled) / 86_400_000))
}

export function cbdcFallbackIsStale(now: Date = new Date()): boolean {
  return cbdcFallbackAgeDays(now) > CBDC_FALLBACK_STALE_AFTER_DAYS
}

export function getCbdcFallbackProvenance(now: Date = new Date()): CbdcFallbackProvenance {
  const stale = cbdcFallbackIsStale(now)
  return {
    source: 'Curated from central-bank and Atlantic Council CBDC tracker publications',
    verifiedAt: CBDC_FALLBACK_COMPILED,
    ageDays: cbdcFallbackAgeDays(now),
    stale,
    // Never better than medium: the notes are pinned to 2023-2024 policy states
    // and no code path in this route can refresh them.
    confidence: stale ? 'low' : 'medium',
  }
}
