// ─── A coin's supply and price facts (T-449 b) ────────────────────────────────
//
// /live-data/markets already returns, from the same CoinGecko call, each coin's
// total and maximum supply, fully diluted value, 7- and 30-day price change and
// how far it trades below its all-time high. The coin page showed circulating
// supply only. These are the rules for the one figure worked out here, the
// share of the maximum supply already circulating; every other figure is
// CoinGecko's own and is shown as it comes. Pure.

/**
 * Circulating supply as a percent of the maximum, to one decimal, or null when
 * either is missing, the maximum is zero, or circulating exceeds the maximum by
 * more than a rounding margin (CoinGecko's figures then disagree with each other,
 * and "103% of maximum" would only repeat the disagreement as a fact).
 */
export function shareOfMaxCirculating(circulating: number | null | undefined, max: number | null | undefined): number | null {
  if (circulating == null || max == null) return null
  if (!Number.isFinite(circulating) || !Number.isFinite(max) || max <= 0 || circulating < 0) return null
  if (circulating > max * 1.001) return null
  return Math.min(100, Math.round((circulating / max) * 1000) / 10)
}

/** "−12.40%" / "+3.10%" with a true minus sign, or null for a missing figure. */
export function signedPct(v: number | null | undefined, decimals = 2): string | null {
  if (v == null || !Number.isFinite(v)) return null
  if (v === 0) return `${(0).toFixed(decimals)}%`
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(decimals)}%`
}
