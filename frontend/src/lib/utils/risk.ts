// Presentation-only shim for the canonical risk/safety scale.
//
// Single sources of truth (post-R2 dedup):
//   - band NUMBERS + vocabulary: lib/risk/types.ts (RISK_BAND_THRESHOLDS, RiskBand)
//   - band FUNCTION:             lib/risk/engine.ts (bandForScore)
//   - colours / labels / classes: lib/risk/presentation.ts (RISK_BAND_CONFIG, ...)
//
// This module re-exports them so its ~12 long-standing consumers keep importing
// from '@/lib/utils/risk' unchanged. It holds no thresholds or band logic of its
// own — and, since 2026-09-08, nothing that is not about the risk scale:
// getPegDeviationColorClass moved to lib/utils/pegFormat.ts, because a peg
// deviation is a distance from $1.00, not a risk score, and a caller importing
// it from a module called `risk` reasonably reads it as one.
export {
  RISK_BAND_CONFIG,
  getRiskBandConfig,
  getRiskColor,
  getRiskBgColor,
  getRiskLabel,
  getRiskBorderColor,
  getRiskTailwindClasses,
  getScoreColor,
} from '@/lib/risk/presentation'

// getRiskBandFromScore was a byte-identical duplicate of the engine's
// bandForScore (same 80/60/40/20 thresholds). Aliased so call sites are untouched.
export { bandForScore as getRiskBandFromScore } from '@/lib/risk/engine'
