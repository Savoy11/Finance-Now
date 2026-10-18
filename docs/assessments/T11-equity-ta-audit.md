# T11 — Equity Technical Analysis page audit

Scope: `src/app/(dashboard)/equities/technical-analysis/page.tsx` (468 lines) and its data
source `src/app/live-data/security-ohlcv/route.ts` (explicitly in scope — the split/dividend
and provider-consistency questions are about that route). **Shared engine out of scope**
(`lib/utils/indicators.ts` — verified in T2; suspected math errors are reported, not edited).

> **T1-class caveat.** The live cross-check against a charting reference needs OHLCV egress
> (Yahoo/Tiingo/FMP), which is IP-dependent and unavailable in the build sandbox. The
> data-shape and adjustment logic below are verified by static analysis + a unit test; the
> live value comparison is deferred to a normal network.

## 🔴 Fixed — split/dividend adjustment was inconsistent across providers (the headline bug)

The spec's exact warning — *"an unadjusted split will look like a catastrophic price crash to
every indicator"* and *"indicator output must not change based on which provider answers"* —
was live in the route:

| Provider | Before | Problem |
|---|---|---|
| Yahoo (`fetchYahooOhlcv`) | read `indicators.quote[].close` | **split-adjusted but not dividend-adjusted**; `adjclose` ignored |
| Tiingo (`fetchTiingoOhlcv`) | read `row.close` (raw) | **NOT split-adjusted** — `adjClose`/`adjOpen`… ignored → split cliff |
| FMP (`fetchFmpOhlcv`) | read `row.close` (raw) | raw close → split cliff |

Because the ladder is Yahoo → Tiingo → FMP, most users hit Yahoo (no cliff), but **any Tiingo/
FMP failover — or a reordered/keyed setup — produced a catastrophic cliff** on split stocks
(NVDA 10:1, AAPL 4:1, TSLA, AMZN, GOOGL — all in the catalog/screener), and the same symbol
gave **different indicator output depending on which provider answered**.

**Fix (all three now on a consistent split+dividend-adjusted basis):**
- New pure helper `src/lib/utils/ohlcvAdjust.ts` → `adjustCandles(candles, adjCloses)`:
  rescales each bar's OHLC by `adjClose/close`, sets `close = adjClose`, and **passes a bar
  through unchanged** when the adjusted close is missing/non-finite or `close <= 0` (never NaN,
  no divide-by-zero). Covered by 5 unit tests (split-cliff removal, high/low ordering
  preserved, safe passthrough, factor-1 no-op).
- **Yahoo** now carries the `adjclose` array through `adjustCandles` → fully split+dividend
  adjusted (was split-only). Falls back to the raw (split-adjusted) bar if `adjclose` is absent
  → no regression.
- **Tiingo** now uses its `adjOpen/adjHigh/adjLow/adjClose/adjVolume` fields (with `?? raw`
  fallback).
- **FMP** applies the `adjClose` factor when present (with raw fallback).

Verified: `tsc` clean · `eslint` clean · `vitest` (5 new / suite green) · `npm run build` green.

## Verified correct (page layer)

- **Session/weekend/holiday gaps do NOT distort indicators.** The engine is index-based — each
  candle is one period regardless of calendar gap — so overnight/weekend/holiday gaps in a
  daily series don't affect SMA/RSI/MACD warm-up or values. This is the right behaviour for a
  24/7 engine reused on a session-based market; no calendar-time math is (incorrectly) done.
- **Insufficient-data / recent IPOs handled.** Signal summary and pattern detection gate at
  `candles.length >= 30`; below that the sidebar shows "Needs at least 30 candles" and the
  screener returns nulls / "No data". The chart renders for any `candles.length > 0` and shows
  `LiveUnavailable` at zero — no NaN, blank canvas, or misleading flat line.
- **Provider-failover shape consistency.** All four fetchers (custom, Yahoo, Tiingo, FMP)
  normalise to the same `OhlcvCandle` shape and sort ascending by `time`, so indicator output
  no longer depends on which provider answers (adjustment now consistent too, per the fix).
- **Every indicator control affects computation.** All **18** page indicators
  (`ema/sma 20/50/200`, `bb`, `keltner`, `donchian`, `vwap`, `psar`, `ichimoku`, `rsi`, `macd`,
  `stoch`, `stochrsi`, `cci`, `williamsr`) have matching `INDICATOR_RENDER` functions — zero
  silent no-op toggles. Range and chart-type selectors are wired into the query key / render.
- **Screener** gates each of 24 symbols at `>= 30` candles, derives RSI/SMA50/signal from the
  same engine, and degrades to "No data" per row on short/failed history.

## Observations (reported, not changed)

- **VWAP on daily candles is semantically loose.** VWAP is an intraday (session-reset)
  indicator; over a multi-month daily series it becomes a cumulative volume-weighted average
  from the range start, not a meaningful "VWAP". This is shared-registry behaviour (also on the
  crypto page) — reported per the report-don't-edit rule. Consider hiding VWAP for daily+
  equity ranges in a future pass.
- **Volume is left unadjusted across splits.** `adjustCandles` rescales price only; a split
  still steps volume (e.g. ×4 more shares post-split). Price is what makes indicators read a
  crash, so this is the right priority; volume-based indicators (VWAP, volume panel) see a step
  at the split date. Minor; documented.

  > **Status: ✅ fixed — annotation added 2026-09-21 (queue item T-273).** `adjustCandles`
  > now scales volume by the inverse of the price factor:
  > `frontend/src/lib/utils/ohlcvAdjust.ts:46` —
  > `const volume = Number.isFinite(c.volume) ? c.volume / f : c.volume` (`f = adjClose /
  > close`). A 4:1 split therefore leaves share volume continuous instead of stepping ×4,
  > pinned at `__tests__/ohlcvAdjust.test.ts:69-87`. The fix reaches every surface through
  > the single caller, `app/live-data/security-ohlcv/route.ts:89`. One limitation is stated
  > rather than hidden (module docblock `:16-29`): `adjClose` folds dividends in with
  > splits and they cannot be separated from this input, so the volume correction also
  > carries a smooth drift of roughly a dividend yield per year on older bars — a few
  > percent tilt, against the ×4 step it removes. A smooth tilt fires no signal; the step
  > did. Volume passing through untouched when it is not a finite number is deliberate.
  >
  > The VWAP observation directly above is **not** settled by this — it is a separate
  > point about daily bars, and it still stands.

## Deferred (needs a normal network / a key)

- Live cross-check of 2–3 symbols (incl. a recent-split name like NVDA) against a charting
  reference to confirm the adjusted series matches.
- **FMP `adjClose` confirmation.** Whether `/stable/historical-price-eod/full` carries
  `adjClose` varies by plan; if a split stock still shows a cliff on the FMP path, switch to
  `/stable/historical-price-eod/dividend-adjusted`. Needs an FMP key to verify.

> **Result, 2026-10-17 (T-271), on the owner's machine (residential Spectrum line, no proxy),
> through `/live-data/security-ohlcv?range=MAX`, every series served by Tiingo:**
>
> | Symbol | Days | Largest one-day move | That day |
> |---|---|---|---|
> | NVDA | 6,977 | 1.54x, 2004-08-06 | a post-earnings fall, not a split |
> | TSLA | 4,101 | 1.27x, 2020-09-08 | the 21% fall after the S&P 500 left it out |
> | AAPL | 10,346 | 2.08x, 2000-09-29 | the 52% profit-warning crash, three months after the 2000 split |
>
> No split date shows a step (NVDA 10:1 2024-06-10 and 4:1 2021-07-20; TSLA 5:1 2020-08-31 and
> 3:1 2022-08-25; AAPL 7:1 2014-06-09 and 4:1 2020-08-31, among others). NVDA's closes either side
> of the 2024 split (`range=5Y`): 122.09, 120.65, 120.54, **121.44** (split day), 120.58, 124.85,
> 129.25 for 06-05 to 06-13. Against the published closes divided by ten (122.44, 121.00, 120.89,
> 121.79, 120.91, 125.20, 129.61), each sits a steady 0.28–0.29% lower on both sides of the split,
> narrowing by about 0.01% from 06-11, NVDA's ex-dividend date for its $0.01 dividend. That is
> Tiingo's `adjClose` adjusting for dividends as well as splits. **The Tiingo path is
> split-adjusted: the first bullet above is answered.**
>
> **The FMP bullet was answered on 2026-09-09** (the route's own comment): `/full` returns
> split-adjusted closes, and on NVDA they equal the published split-only closes above exactly.
>
> **Finding, not changed: the two rungs are on different bases.** Tiingo serves split- *and*
> dividend-adjusted prices; FMP serves split-adjusted prices only. When the ladder falls from
> Tiingo to FMP, the same symbol's history shifts by its dividends since each date: 0.3% on NVDA
> here, and on a high-yield stock over a 5Y range, on the order of its yield times the years at
> the start of the chart. Returns, backtests and drawdowns read that shift; most indicators
> barely do. The route's comment that Tiingo's adjusted set "matches FMP's adjusted basis" is
> wrong on this evidence. Making them match is a choice (FMP's dividend-adjusted endpoint, which
> the route warns would change the basis of its charts, or a split-only Tiingo series), so it is
> recorded here rather than made: filed as T-441 at low priority (D135).

> **Settled, 2026-10-18 (T-441, D138): the owner chose FMP's dividend-adjusted prices.** Both FMP
> rungs, here and in the `security-chart` ladder, now read `/stable/historical-price-eod/dividend-adjusted`
> through one fetcher, `src/lib/api/live/fmpHistory.ts`, so a fall from Tiingo to FMP no longer moves
> a dividend payer's history. The free key's coverage of that endpoint had been measured on
> 2026-09-18 with the app's key: the same symbols as `/full`. Its fields were read on 2026-10-18
> through the owner's FMP connector (not the app's key): `adjOpen, adjHigh, adjLow, adjClose,
> volume`, newest first, with KO's 2021-09-01 adjusted close at 0.857 of `/full`'s: about five
> years of a 3% dividend taken out. The route falls back to `/full` only where the plan withholds
> the endpoint (403) or its answer has no adjusted prices, and says so: every response now carries
> `basis`. The route's warning, quoted above, that this endpoint would change the basis of its charts
> had it the wrong way round: Tiingo answers first, so most charts were already on the dividend-adjusted
> basis, and only the fallback was not.

## Changes in this PR
- `src/lib/utils/ohlcvAdjust.ts` (new) + `__tests__/ohlcvAdjust.test.ts` (new, 5 tests).
- `src/app/live-data/security-ohlcv/route.ts` — Yahoo/Tiingo/FMP adjusted-basis fix.
- `docs/assessments/T11-equity-ta-audit.md` — this report.
