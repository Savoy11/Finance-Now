// Canonical indicator catalog — the single list of what the TA pages OFFER.
//
// Distinct from `indicatorRegistry.ts`, which holds the render functions (what
// each indicator DRAWS). Splitting them this way means a page picks a subset of
// this catalog and the registry renders whatever it picks.
//
// ⚠ WHY THIS FILE EXISTS. The crypto, equities and macro TA pages each used to
// hand-maintain their own `INDICATORS` array while all three rendered from the
// same registry. They drifted: crypto listed 62, equities 18, macro 16 — so 44
// indicators that were fully implemented and working were simply not offered on
// the equities page. Add new indicators HERE, not in a page.
//
// Every key must have a matching entry in INDICATOR_RENDER (indicatorRegistry.ts).
// Nothing couples them at runtime, so __tests__/indicatorCatalog.test.ts asserts
// it — otherwise an offered-but-unrenderable key is a chip that draws nothing.

/**
 * Indicators whose maths reads `candle.volume`.
 *
 * These are only meaningful on series carrying real exchange volume. Equities
 * and crypto qualify; continuous front-month futures and FX series do NOT —
 * their "volume" is either absent, or stitched across contract rolls and so not
 * comparable bar to bar. Rendering them there produces a confident-looking flat
 * or nonsensical line, which is worse than not offering them.
 *
 * `chaikin` is included transitively: it is an EMA spread of `accDistLine`,
 * which is volume-weighted. `elderray` and `bop` are deliberately NOT here —
 * they sound volume-based but are computed purely from OHLC.
 */
export const VOLUME_DEPENDENT_KEYS = [
  'vwap', 'volume', 'obv', 'mfi', 'cmf', 'accDist',
  'volosc', 'fi', 'eom', 'klinger', 'chaikin',
] as const

export const INDICATOR_CATALOG = [
  // Overlays
  { key: 'ema20',    label: 'EMA 20',           group: 'overlay', tip: 'Exponential Moving Average (20). Weights recent prices more heavily than older ones. Price above EMA → uptrend; below → downtrend. Faster to react than SMA.' },
  { key: 'ema50',    label: 'EMA 50',           group: 'overlay', tip: 'Exponential Moving Average (50). Mid-term trend line. Crossover with EMA20 signals momentum shifts; holding above EMA50 is a bullish structure.' },
  { key: 'ema200',   label: 'EMA 200',          group: 'overlay', tip: 'Exponential Moving Average (200). The gold standard long-term trend indicator. Price above EMA200 = bull market; below = bear market. Watch for the Golden/Death Cross with EMA50.' },
  { key: 'sma20',    label: 'SMA 20',           group: 'overlay', tip: 'Simple Moving Average (20). Equal weight to each of the last 20 closes. Slower than EMA — good for spotting support/resistance and as the midline of Bollinger Bands.' },
  { key: 'wma20',    label: 'WMA 20',           group: 'overlay', tip: 'Weighted Moving Average (20). Linearly weights recent candles higher. More responsive than SMA, less "jumpy" than EMA. Use like EMA20 for trend direction.' },
  { key: 'hma20',    label: 'HMA 20',           group: 'overlay', tip: 'Hull Moving Average (20). Uses WMA of WMAs to nearly eliminate lag while staying smooth. Excellent for spotting trend changes early — direction of the HMA is the signal.' },
  { key: 'bb',       label: 'Bollinger Bands',  group: 'overlay', tip: 'Bollinger Bands (20, ±2σ). Upper/lower bands are 2 standard deviations from SMA20. Price touching the lower band = oversold; upper band = overbought. Bands squeezing = breakout imminent.' },
  { key: 'vwap',     label: 'VWAP',             group: 'overlay', tip: 'Volume Weighted Average Price. Resets daily. The "fair value" anchor used by institutional traders. Price above VWAP = buyers in control; below = sellers. Best on intraday timeframes.' },
  { key: 'keltner',  label: 'Keltner Channels', group: 'overlay', tip: 'Keltner Channels (EMA20 ± 2×ATR10). Volatility-based envelopes. Smoother than Bollinger Bands — less susceptible to short spikes. Useful for spotting breakouts when price exits the channel.' },
  { key: 'donchian', label: 'Donchian (20)',    group: 'overlay', tip: 'Donchian Channels (20-period high/low). Upper band = highest high; lower = lowest low. Price breaking above the upper band is a new 20-period high — a classic breakout signal used by trend-followers.' },
  { key: 'psar',     label: 'Parabolic SAR',    group: 'overlay', tip: 'Parabolic Stop and Reverse. Dots appear above price in a downtrend and below in an uptrend. When price crosses the dots, the trend may be reversing. Best used in trending markets — noisy in sideways chop.' },
  { key: 'linreg',   label: 'Linear Reg (20)',  group: 'overlay', tip: 'Linear Regression line (20 periods). A best-fit line through recent closes. Shows the statistically "ideal" trend direction. Price deviating far from the line tends to revert back toward it.' },
  // Panels — Momentum
  { key: 'rsi',      label: 'RSI (14)',          group: 'panel', tip: 'Relative Strength Index (14). Oscillates 0–100. Below 30 = oversold (look for buy); above 70 = overbought (look for sell). Divergence between RSI and price is one of the strongest signals in TA.' },
  { key: 'macd',     label: 'MACD',              group: 'panel', tip: 'Moving Average Convergence/Divergence (12,26,9). The MACD line crossing above the signal line is bullish; crossing below is bearish. Histogram growing in the positive = accelerating momentum.' },
  { key: 'stochrsi', label: 'Stoch RSI',         group: 'panel', tip: 'Stochastic RSI (14,14,3,3). RSI applied to RSI — more sensitive than RSI alone. K line below 20 = deeply oversold; above 80 = deeply overbought. K crossing above D is a buy signal.' },
  { key: 'williamsr',label: 'Williams %R',       group: 'panel', tip: 'Williams %R (14). Oscillates -100 to 0. Above -20 = overbought; below -80 = oversold. Similar to Stochastic but inverted. Use for identifying short-term turning points and confirming reversals.' },
  { key: 'cci',      label: 'CCI (20)',          group: 'panel', tip: 'Commodity Channel Index (20). Measures how far price is from its statistical average. Above +100 = overbought / strong uptrend; below -100 = oversold / strong downtrend. Works well for spotting cyclical turns.' },
  { key: 'roc',      label: 'ROC (12)',          group: 'panel', tip: 'Rate of Change (12). The % change from 12 periods ago. Positive = upward momentum; negative = downward. Crossing zero is a trend signal. Useful for spotting divergence and momentum exhaustion.' },
  { key: 'mom',      label: 'Momentum (10)',     group: 'panel', tip: 'Momentum (10). Raw difference between current close and close 10 periods ago. Rising = accelerating; falling = decelerating. Simple but effective for confirming trend strength. Cross above zero = bullish.' },
  { key: 'cmo',      label: 'CMO (14)',          group: 'panel', tip: 'Chande Momentum Oscillator (14). Oscillates -100 to +100. Above +50 = strong bullish momentum; below -50 = strong bearish. Zero-line crossovers signal trend changes. Less whipsaw than RSI in trending markets.' },
  { key: 'uo',       label: 'Ultimate Osc',      group: 'panel', tip: 'Ultimate Oscillator (7,14,28). Combines three timeframes into one oscillator to reduce false divergence signals. Above 70 = overbought; below 30 = oversold. Divergence + breakout from the overbought/oversold zone is the key setup.' },
  // Panels — Trend
  { key: 'adx',      label: 'ADX (14)',          group: 'panel', tip: 'Average Directional Index (14). ADX measures trend strength (not direction) — above 25 = trending, above 40 = strongly trending. +DI above -DI = uptrend; -DI above +DI = downtrend. Best for filtering out choppy markets.' },
  { key: 'aroon',    label: 'Aroon (25)',        group: 'panel', tip: 'Aroon (25). Measures how recently the highest high and lowest low occurred. Oscillator above +50 = uptrend strengthening; below -50 = downtrend strengthening. Aroon Up crossing above Aroon Down is a bullish signal.' },
  { key: 'trix',     label: 'TRIX (15)',         group: 'panel', tip: 'TRIX (15). 1-period % change of a triple-smoothed EMA. Filters out market noise effectively. Signal line crossovers and zero-line crossovers are the main signals. Especially good for medium-term trends.' },
  { key: 'kst',      label: 'KST',              group: 'panel', tip: 'Know Sure Thing. A weighted sum of four ROCs at different lengths, smoothed. Designed to clearly show cyclical momentum at multiple timeframes simultaneously. KST crossing its signal line is the key trade trigger.' },
  { key: 'dpo',      label: 'DPO (20)',          group: 'panel', tip: 'Detrended Price Oscillator (20). Removes the long-term trend so you can see price cycles clearly. Oscillates around zero — peaks/troughs of the DPO mark peaks/troughs of the price cycle. Not for trend-following.' },
  // Panels — Volume / Money Flow
  { key: 'volume',   label: 'Volume',            group: 'panel', tip: 'Raw trading volume per candle (USD millions). High volume on breakouts = conviction; low volume = suspect. A price move on expanding volume is more reliable than one on declining volume.' },
  { key: 'obv',      label: 'OBV',              group: 'panel', tip: 'On-Balance Volume. Adds volume on up days, subtracts on down days. OBV rising ahead of price = smart money accumulating (bullish). OBV diverging from price often leads the next price move.' },
  { key: 'mfi',      label: 'MFI (14)',          group: 'panel', tip: 'Money Flow Index (14). Volume-weighted RSI — considers both price and volume. Below 20 = oversold with selling pressure drying up (bullish); above 80 = overbought. Divergence with price is a high-conviction signal.' },
  { key: 'cmf',      label: 'Chaikin MF (20)',   group: 'panel', tip: 'Chaikin Money Flow (20). Measures buying vs selling pressure by comparing close position within the candle\'s range, weighted by volume. Above 0.1 = buying pressure; below -0.1 = selling pressure. Zero-line crossovers signal trend shifts.' },
  { key: 'accDist',  label: 'A/D Line',         group: 'panel', tip: 'Accumulation/Distribution Line. Cumulative volume indicator based on close position within each candle\'s range. Rising A/D while price falls = accumulation (bullish divergence). Falling A/D while price rises = distribution (bearish).' },
  { key: 'volosc',   label: 'Volume Osc',       group: 'panel', tip: 'Volume Oscillator (fast 5, slow 10). Difference between a fast and slow volume moving average. Positive = volume expanding; negative = contracting. Rising volume oscillator during a price move confirms the trend.' },
  { key: 'fi',       label: 'Force Index (13)',  group: 'panel', tip: 'Force Index (13). Combines price change and volume into a single momentum measure. Strong positive readings = powerful buying force; strong negative = powerful selling. Zero crossovers and divergence are the key signals.' },
  { key: 'eom',      label: 'Ease of Move',     group: 'panel', tip: 'Ease of Movement. Measures how efficiently price moves relative to volume. High positive value = price rising easily on low volume (bullish); high negative = falling easily. Hovering near zero = price struggling to move.' },
  { key: 'elderray', label: 'Elder Ray (13)',    group: 'panel', tip: 'Elder Ray Index (EMA 13). Bull Power = high minus EMA (positive = buyers driving price above average). Bear Power = low minus EMA (negative = sellers pushing below). Buy when Bear Power is negative but rising; sell when Bull Power is positive but falling.' },
  // Panels — Volatility
  { key: 'atr',      label: 'ATR (14)',          group: 'panel', tip: 'Average True Range (14). Measures average volatility (typical daily price swing). Not directional — use for position sizing and stop placement. High ATR = high volatility; low ATR = consolidation, potential breakout building.' },
  { key: 'chop',     label: 'Choppiness',       group: 'panel', tip: 'Choppiness Index (14). Measures whether the market is trending or ranging. Above 61.8 = choppy/sideways (avoid trend strategies); below 38.2 = strongly trending (use trend-following strategies). Great for filtering other signals.' },
  { key: 'bbpctb',   label: 'BB %B',            group: 'panel', tip: 'Bollinger %B. Shows where price is within the Bollinger Bands as a percentage. 1.0 = at upper band; 0 = at lower band; 0.5 = at midline. Below 0 or above 1 = price outside the bands — extreme reading, potential reversal.' },
  { key: 'massidx',  label: 'Mass Index',       group: 'panel', tip: 'Mass Index (25). Uses the high-low range to identify reversals — regardless of direction. When it rises above 27 then falls below 26.5 ("reversal bulge"), a trend reversal is likely. Direction confirmed by a separate trend indicator.' },
  { key: 'stddev',   label: 'Std Deviation',    group: 'panel', tip: 'Standard Deviation (20). Measures the statistical dispersion of closing prices around their mean. High StdDev = high volatility / trending; low StdDev = compression. Low readings often precede explosive moves.' },
  // Panels — Momentum (additional)
  { key: 'stoch',    label: 'Stochastic',       group: 'panel', tip: 'Classic Stochastic Oscillator (14,3,3). %K crossing above %D below 20 = buy; crossing below above 80 = sell. The original oscillator developed by George Lane — more stable than Stoch RSI.' },
  { key: 'tsi',      label: 'TSI (25,13)',       group: 'panel', tip: 'True Strength Index. Double-smoothed price momentum oscillator. Above zero = bullish; below zero = bearish. Crossing zero or the signal line are the key signals. Less whipsaw than RSI thanks to double smoothing.' },
  { key: 'ppo',      label: 'PPO (12,26,9)',     group: 'panel', tip: 'Percentage Price Oscillator. MACD expressed as a percentage of the slow EMA, making it comparable across different price levels. Use exactly like MACD: signal line crossovers and histogram direction.' },
  { key: 'fisher',   label: 'Fisher Transform', group: 'panel', tip: 'Fisher Transform (9). Converts prices into a near-Gaussian distribution. Sharp reversals at extreme peaks/troughs signal turning points. Zero-line crossovers signal trend changes. Particularly effective for identifying cycle tops and bottoms.' },
  { key: 'crsi',     label: 'Connors RSI',      group: 'panel', tip: 'Connors RSI (3,2,100). Composite of 3-period RSI, RSI of the current price streak, and a percentile rank. Below 10 = strong buy; above 90 = strong sell. More precise than standard RSI for short-term reversals.' },
  // Panels — Trend (additional)
  { key: 'vortex',   label: 'Vortex (14)',      group: 'panel', tip: 'Vortex Indicator (14). VI+ measures upward movement; VI− measures downward. VI+ crossing above VI− = bullish; VI− crossing above VI+ = bearish. Both lines rising above 1.0 confirms a strong trend.' },
  { key: 'coppock',  label: 'Coppock Curve',    group: 'panel', tip: 'Coppock Curve. A long-term momentum oscillator originally designed for monthly charts. Crossing above zero from below = major buy signal. Rare but high-conviction — especially reliable after prolonged downtrends.' },
  // Panels — Volume (additional)
  { key: 'klinger',  label: 'Klinger Vol Osc',  group: 'panel', tip: 'Klinger Volume Oscillator (34,55). Combines price direction, magnitude, and volume. Designed to detect long-term money flow while staying sensitive to short-term fluctuations. Signal line crossovers are the key signals.' },
  { key: 'bop',      label: 'Balance of Power', group: 'panel', tip: 'Balance of Power (smoothed 14). Measures the strength of buyers vs sellers by comparing where the candle closes within its range. Above zero = buyers winning; below zero = sellers winning. Divergence with price is a powerful signal.' },
  { key: 'chaikin',  label: 'Chaikin Osc',      group: 'panel', tip: 'Chaikin Oscillator (3,10). An EMA of the Accumulation/Distribution line — measures momentum of money flow. Crossing above zero = buying pressure accelerating (bullish); crossing below = selling pressure building (bearish).' },
  { key: 'disparity',label: 'Disparity Index',  group: 'panel', tip: 'Disparity Index (14). Percentage deviation of price from its 14-period EMA. High positive values = overbought/extended; high negative = oversold/stretched. Useful for mean-reversion setups — price tends to snap back.' },
  // Overlays — additional MAs
  { key: 'ema9',     label: 'EMA 9',            group: 'overlay', tip: 'Exponential Moving Average (9). Ultra-short-term trend — commonly used for intraday and swing trade entries. Price pulling back to EMA9 and bouncing is a classic continuation entry. Very reactive to price changes.' },
  { key: 'ema21',    label: 'EMA 21',           group: 'overlay', tip: 'Exponential Moving Average (21). Fibonacci-based short-term MA widely used in crypto. Acts as dynamic support in uptrends. Crossing above EMA50 signals a potential trend shift.' },
  { key: 'ema100',   label: 'EMA 100',          group: 'overlay', tip: 'Exponential Moving Average (100). Mid-to-long-term trend indicator. Often acts as a key support/resistance in bull markets. Price reclaiming EMA100 after a correction is a bullish reentry signal.' },
  { key: 'sma50',    label: 'SMA 50',           group: 'overlay', tip: 'Simple Moving Average (50). The most widely watched medium-term MA by institutional traders. Holding above SMA50 is bullish structure; losing SMA50 often triggers selling. Part of the Golden/Death Cross setup with SMA200.' },
  { key: 'sma100',   label: 'SMA 100',          group: 'overlay', tip: 'Simple Moving Average (100). Intermediate-term trend benchmark. Less commonly cited than SMA50/200 but useful as a confirmation level. Price bouncing from SMA100 = bullish; failing it = bearish.' },
  { key: 'sma200',   label: 'SMA 200',          group: 'overlay', tip: 'Simple Moving Average (200). The ultimate long-term trend gauge — defines the bull/bear market boundary for most market participants. Trading above SMA200 = macro bullish; below = macro bearish.' },
  { key: 'dema',     label: 'DEMA 20',          group: 'overlay', tip: 'Double Exponential Moving Average (20). Reduces EMA lag by applying EMA twice. More responsive than EMA with less noise than raw price. Direction and slope of DEMA is the primary signal.' },
  { key: 'tema',     label: 'TEMA 20',          group: 'overlay', tip: 'Triple Exponential Moving Average (20). Even lower lag than DEMA. Extremely responsive — good for catching early trend changes. Can produce false signals in choppy markets; best combined with ADX to confirm trending conditions.' },
  { key: 'kama',     label: 'KAMA (10)',         group: 'overlay', tip: 'Kaufman Adaptive MA (10). Automatically adjusts its speed based on market noise — moves quickly in trending markets, slowly in ranging ones. A flattening KAMA signals chop; a steep KAMA signals strong trend.' },
  { key: 'mcginley', label: 'McGinley Dyn',     group: 'overlay', tip: 'McGinley Dynamic (14). A self-adjusting MA that corrects for slow/fast EMA movement by adjusting its speed based on the price ratio. More accurate than EMA in both fast and slow markets — stays closer to actual price.' },
  { key: 'ichimoku', label: 'Ichimoku Cloud',   group: 'overlay', tip: 'Ichimoku Cloud (9,26,52). An all-in-one indicator: Tenkan (conversion), Kijun (base), Senkou A/B (cloud), Chikou (lagging). Price above the cloud = bullish; below = bearish. Cloud thickness shows support/resistance strength.' },
] as const

export type IndicatorMeta = typeof INDICATOR_CATALOG[number]
export type IndicatorKey = IndicatorMeta['key']

const VOLUME_KEY_SET: ReadonlySet<string> = new Set(VOLUME_DEPENDENT_KEYS)

/** True when this indicator's maths reads `candle.volume`. */
export function isVolumeDependent(key: string): boolean {
  return VOLUME_KEY_SET.has(key)
}

/**
 * The catalog minus everything that needs real volume — for series where volume
 * is absent or not comparable across bars (continuous futures, FX). Use this
 * rather than hand-listing a subset, so new price-only indicators reach these
 * pages automatically.
 */
export const PRICE_ONLY_INDICATORS: readonly IndicatorMeta[] =
  INDICATOR_CATALOG.filter((i) => !VOLUME_KEY_SET.has(i.key))
