# T10 — Crypto Technical Analysis page audit

Scope: `src/app/(dashboard)/technical-analysis/page.tsx` (1,791 lines — largest page in the
app) plus its immediate data dependency `src/app/live-data/ohlcv/route.ts` for the candle-
ordering check. **Page-layer only** — the shared indicator/backtest engine
(`lib/utils/indicators.ts`, `lib/utils/backtest.ts`) was verified in T2 and is out of scope
(suspected math errors are reported, not edited).

> **T1-class caveat.** The task asks for a TradingView cross-check on 2–3 coins. That requires
> live OHLCV egress (the route prefers Binance, geo-blocked `451` from datacenter IPs; T1
> found it actually serves **Binance.US**, a genuinely different venue). A live visual
> cross-check could **not** be performed from the build sandbox and is deferred to a run on a
> normal network. Everything below is verified by static analysis of the data flow and math
> wiring, which is where off-by-one / mis-wiring bugs actually live.

## Verdict: clean bill of health at the page layer — no code changes required.

Every audit dimension checked out. This is a read-only assessment (like T5); forcing a code
change would be gratuitous.

## What was verified correct

1. **Candle ordering & time-alignment (the #1 risk — unsorted candles break correct math).**
   The page consumes `json.candles` directly with no client-side re-sort, so ordering must be
   guaranteed upstream — and it is: Binance klines and CoinGecko OHLC are natively
   time-ascending, and the route's `resampleToDaily`/`resampleToWeekly` explicitly
   `sort(...localeCompare)` ascending and aggregate each bucket correctly
   (`open = first`, `close = last`, `high = max`, `low = min`, `volume = sum`). No off-by-one.

2. **Insufficient-data handling is consistent and safe** — no NaN, blank chart, or misleading
   flat line on short/thin histories. Gating thresholds:
   - chart: renders only when `candles.length > 0`, else "No data available"; spinner while fetching.
   - signal summary: `candles.length >= 50`; patterns: `>= 20`; `detectSetups`: `< 55 → []`;
     `KeyLevelsPanel`: `< 20 → null`; S/R & KeyLevels rendered only when `candles.length > 0`.
   - multi-timeframe rows gate each TF on `>= 50` and drop failed/short TFs from the tally.

3. **Risk/reward arithmetic** (`computeRiskReward`, `useThesisStore`): `reward = |target−entry|`,
   `risk = |entry−invalidation|`, returns `reward/risk`; returns **null** on non-finite input
   or `risk === 0` (guards divide-by-zero and never fabricates a ratio). Degrades sensibly.

4. **Page-local setup scanner** (`detectSetups`): all six heuristics (breakout, RSI
   oversold/overbought, EMA20/50 cross, volume spike, OBV divergence, Bollinger squeeze) are
   null-guarded, use exactly-20-bar lookback windows (`slice(n-21, n-1)` — no off-by-one), and
   each carries a confirmation condition, so they read as defensible signals rather than
   noise-fitting.

5. **Every indicator toggle affects computation.** Programmatic set-diff: the page exposes
   **61** toggleable indicators; `components/charts/indicatorRegistry.ts` `INDICATOR_RENDER`
   defines **exactly 61** matching render functions — **zero silent no-op controls**. (`williamsr`,
   `mcginley`, `disparity` initially looked missing but are present; formatting artifact.)

6. **Controls are wired to the query.** The range selector feeds `queryKey: ['ta-ohlcv',
   assetId, range]` and the fetch URL; changing it refetches and recomputes. `activeIndicators`
   is a `Set` passed straight to the chart. Backtest panel isolates each strategy in
   `try/catch` (one bad strategy can't crash the panel) and fetches a dedicated long daily
   series (`range=BT`) so 200-period strategies have warm-up.

7. **Multi-timeframe confluence** handles per-TF fetch failures, cancels stale state on
   `assetId` change, and only reports confluence once `>= 3` timeframes have loaded.

## Minor observations (not bugs; no action taken here)

> **⚠ OUTCOME (added 2026-09-21) — the first two observations below have since been
> fixed. The text is left exactly as written.** The `DataBadge` no longer says
> "Binance" for Binance.US: `/live-data/ohlcv` now emits a `venue` field
> (`frontend/src/app/live-data/ohlcv/route.ts:253-254`) and the page derives the
> label from it via `ohlcvSourceLabel(data?.source, data?.venue)`
> (`technical-analysis/page.tsx:191`; badge at `:389-390`; mapping and tests in
> `lib/utils/ohlcvSource.ts:12-22`). The `1H` route comment was reworded
> (`ohlcv/route.ts:107-112`) and now states the real window — the `slice(-168)` is a
> cap that never trims, not "last week of 30m bars". Tracked as queue items T-267
> and T-268. The third bullet (confluence thresholds) is handled separately below.

- **Provenance label reads "Binance" for what is really Binance.US.** The chart's `DataBadge`
  shows `Binance OHLCV` because the route reports `source: 'binance'`. Per T1 this is a
  *deliberate* choice (the TA page switches on `source`); the truthful `venue` field lives in
  the route and is **T1's domain, not this page's**. Flagged so a US user cross-checking against
  TradingView's Binance.com feed expects legitimate venue divergence rather than an indicator
  bug. Not changed here (would require the route's `venue` field, owned by T1).
- **`1H` range serves 30-minute bars** (`ohlcv` route `cgDays:'1' → slice(-168)`), and the
  route comment ("last week of 30m bars") is ~half a week off. Route-level, cosmetic.
- **Confluence thresholds** (`bullish >= 4 / >= 3`) are absolute rather than proportional to
  the number of timeframes that loaded — slightly conservative when few TFs return, harmless
  at full load.

  > **Status: ✅ fixed — annotation added 2026-09-21 (queue item T-269).** The thresholds
  > are proportional now, and the function was extracted so it could be tested.
  > `frontend/src/lib/utils/confluence.ts:17-20` defines `CONFLUENCE_STRONG_RATIO = 0.75`,
  > `CONFLUENCE_MODERATE_RATIO = 0.6` and `CONFLUENCE_MIN_LOADED = 3`; `:36-46` bands on
  > `bullish / loadedCount`. The live caller is
  > `components/analytics/technical/MultiTimeframeGrid.tsx:78`, passing the count of
  > timeframes that actually answered (`:74`), and that panel is rendered by
  > `app/(dashboard)/technical-analysis/page.tsx:406`. This observation called the absolute
  > form "harmless at full load"; it was not — 4 of 6 (67%) read *strong* while a unanimous
  > 3 of 3 read *moderate*, so the weaker agreement got the stronger word. Both are now
  > pinned as tests (`lib/utils/__tests__/confluence.test.ts:17-24`).

## Extraction opportunities (noted per the task; deliberately NOT done — this is an accuracy audit)
At 1,791 lines the page inlines ~10 self-contained components (`ScannerPanel`,
`MultiTimeframeGrid`, `BacktestPanel`, `ThesisBuilderPanel`, `KeyLevelsPanel`,
`SupportResistancePanel`, `PatternsPanel`, `TechnicalReadPanel`, `MarketStructurePanel`) plus
`detectSetups`. These would move cleanly to `components/analytics/technical/`. A refactor of
that size is out of scope for an accuracy audit and should be its own task.

## Deferred (needs a normal network)
Live TradingView cross-check on 2–3 coins across several indicators, comparing against
**Binance.US** (or expecting legitimate venue divergence). The math and wiring are verified; the
only thing unconfirmed is that the *live upstream values* match a reference — which is the
IP-dependent piece.
