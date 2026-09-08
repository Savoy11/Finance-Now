/**
 * Peg-deviation formatting for stablecoins.
 *
 * This lived in `lib/utils/risk.ts` until 2026-09-08 and did not belong there.
 * A peg deviation is a measured distance from $1.00, not a position on the
 * canonical 0-100 safety scale, and colocating it with the risk-band re-exports
 * invited exactly the reading the risk-scale spec warns against — that the
 * colour here is a risk band. It is not: the thresholds below are about how far
 * a dollar-pegged token has drifted, nothing more.
 */

/** Drift under this many bps is unremarkable for a functioning peg. */
export const PEG_TIGHT_BPS = 10
/** Past this, the drift is large enough to be worth a reader's attention. */
export const PEG_LOOSE_BPS = 50

/**
 * Tailwind colour class for a peg deviation in basis points.
 * `null` (unknown deviation) is muted, never green — "we don't know" must not
 * render as "healthy".
 */
export function getPegDeviationColorClass(bps: number | null): string {
  if (bps === null) return 'text-text-muted'
  const abs = Math.abs(bps)
  if (abs < PEG_TIGHT_BPS) return 'text-emerald-400'
  if (abs < PEG_LOOSE_BPS) return 'text-amber-400'
  return 'text-red-400'
}
