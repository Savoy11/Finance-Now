// Pure helpers for the SEC Risk/Return data set's stored precision (T-417, 2026-10-14).
//
// The data set keeps each value to four decimal places while its `dcml` column keeps the
// precision the filing declared. A fee in thousandths of a percent is therefore stored short:
// FXAIX's filing tags 0.015% (0.00015, six declared decimals) and the data set holds 0.0001,
// which reads as 0.010%. The 2026-09-26 reconcile reported that as a fee cut, and D39 recorded
// it as "0.010% as stated, not a rounding of 0.015%"; the prospectus fee table, read on
// 2026-10-14, says 0.015% with no waiver. The same filing's 0.035% funds are stored as 0.0003.
//
// A catalog fee written in hundredths of a percent differs from any stored value by a whole
// unit of the stored precision (0.01 points) or more, so a real fee change is never mistaken
// for this. Only a smaller difference, on a row whose filing declared more decimals than were
// kept, cannot be told apart from the cut, and that goes to the filing, never to the catalog.
//
// Kept pure and separate from build-fund-fees.mjs so the rule is unit-tested; the script itself
// needs sec.gov and a multi-hundred-MB extraction to run.

/** Decimal places a stored value carries: "0.0001" → 4, "0.0039" → 4, "1" → 0. */
export function storedDecimals(value) {
  const m = String(value ?? '').trim().match(/\.(\d+)$/)
  return m ? m[1].length : 0
}

/**
 * Whether a stored value may be short of what the filing tagged: the row's declared precision
 * (`dcml`) is finer than the places the value carries. "INF" (exact as filed) and a blank parse
 * to NaN, and NaN compares false, so neither says anything was cut.
 */
export function precisionCut(value, dcml) {
  return Number.parseInt(String(dcml ?? ''), 10) > storedDecimals(value)
}

/**
 * Whether a difference between the catalog and the data set is too small to tell from the cut.
 * Both figures in percent; `mult` is the unit multiplier the script applied (100 for `pure`).
 * A cut moves a value by less than one unit in its last stored place, so only a non-zero
 * difference under that unit is ambiguous. Compared in millionths of a percent so floating-point
 * noise cannot move a difference of exactly one unit under the line.
 */
export function withinStoredPrecision(catalogPct, secPct, value, dcml, mult) {
  if (catalogPct == null || secPct == null || !precisionCut(value, dcml)) return false
  const unit = Math.round(10 ** -storedDecimals(value) * mult * 1e6)
  const delta = Math.abs(Math.round(catalogPct * 1e6) - Math.round(secPct * 1e6))
  return delta > 0 && delta < unit
}
