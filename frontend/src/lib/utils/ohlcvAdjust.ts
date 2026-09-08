import type { OhlcvCandle } from '@/lib/utils/indicators'

/**
 * Rescale raw OHLC by the per-bar split+dividend adjustment factor
 * (adjClose / close), so a split shows a continuous series instead of a
 * catastrophic price cliff that every indicator would read as a crash. Also
 * keeps providers consistent: Tiingo and FMP must not yield different
 * indicator output for the same symbol just because a different one answered.
 *
 * `adjCloses` is a parallel array (same length/order as `candles`). When an
 * adjusted close is missing / non-finite or the raw close is non-positive, that
 * bar passes through unchanged (factor 1) — never produces NaN.
 *
 * ── Volume ────────────────────────────────────────────────────────────────
 * Volume is scaled by the INVERSE of the price factor (`close / adj`), because
 * a split changes the unit the shares are counted in. A 4:1 split quarters the
 * price and quadruples the share count: rescaling price without rescaling
 * volume leaves a 4× cliff in the volume series, and every volume indicator
 * (OBV, volume MAs, volume-confirmation rules) reads that cliff as a real
 * event.
 *
 * The known limitation, stated rather than hidden: `adjClose` folds dividends
 * in with splits and we cannot separate them from this input, so the volume
 * correction also picks up the dividend component. That is a smooth drift of
 * roughly a dividend yield per year on older bars (a 2% yielder tilts bars from
 * a year ago by ~2%), against the 4× step it removes. A smooth few-percent
 * tilt does not fire a signal; a 4× step does. Splitting the two would need the
 * provider's split history as a separate series — worth doing if volume ever
 * carries a figure a user acts on directly, which today it does not.
 */
export function adjustCandles(
  candles: OhlcvCandle[],
  adjCloses: Array<number | null | undefined>,
): OhlcvCandle[] {
  return candles.map((c, i) => {
    const adj = adjCloses[i]
    // Passthrough on any degenerate input (review-hardened): a missing/non-finite
    // or non-positive adjClose, or a missing/non-finite/non-positive raw close.
    // A NaN close would otherwise produce NaN OHL (NaN <= 0 is false), and an
    // adjClose of 0 would zero the whole candle and poison every indicator.
    if (adj == null || !Number.isFinite(adj) || adj <= 0) return c
    if (!Number.isFinite(c.close) || c.close <= 0) return c
    const f = adj / c.close
    // Volume passes through unchanged when it is not a usable number, so a
    // provider that omits it cannot turn into NaN here.
    const volume = Number.isFinite(c.volume) ? c.volume / f : c.volume
    return { time: c.time, open: c.open * f, high: c.high * f, low: c.low * f, close: adj, volume }
  })
}
