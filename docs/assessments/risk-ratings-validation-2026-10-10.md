# Risk ratings validation, 2026-10-10 (T-420 item 7)

**What this is.** The validation the methodology note requires before anything is shown
(`docs/architecture/risk-ratings-methodology.md` §8), run once on the owner's machine against live
data, under method `v1 (draft, 2026-10-09)`. It is the write-up §8 item 5 names as the point where
the owner confirms or changes the weights and curves (D95). Nothing was changed by it.

**How it ran.** `npm run ratings:validate -- --out <file>` (`frontend/scripts/validate-ratings.ts`,
helpers in `scripts/lib/ratingValidation.ts`, tested in `src/lib/server/__tests__/ratingValidation.test.ts`).
It reads only: no database, no route that records a reading. Coin data came from CoinGecko's daily
chart (one year) and, for history, Binance.US closes through `/live-data/ohlcv`; stock data came through
the app's own `/live-data/security-ohlcv` (five years) and `/live-data/company-facts`. Prices were held
in memory and dropped at exit. Stock rows below show classes and scores only, never a price-derived
figure, because stock prices may come from Tiingo, whose Starter terms (§1.6(a)) bar keeping its data.
The full generated report is the appendix.

---

## Summary

1. **The method orders risk well.** Scores at past dates ranked the volatility that followed with a
   Spearman correlation of about −0.75 for stocks and coins alike, over 6 and 12 months (−1 would be
   a perfect ordering). Price behaviour alone ordered slightly better than the full score.
2. **It is calibrated too low, for stocks as well as coins.** Against the class each asset's one-year
   volatility would fall in on the EU PRIIPs scale (indicative, and a lower bound), coins as built sit
   2.35 classes lower on average and stocks 3.21 lower. Eleven single stocks rate "Very low".
3. **The coin fix found on 2026-10-10 works.** One set of price curves for coins and stocks, with no
   lift from size and liquidity (variants A and C together), puts 53 of 55 coins within one class of
   their PRIIPs band (36 exactly), and orders coins against stocks better than the method as built.
4. **It is not sensitive to small changes.** No single weight or curve point moved ±20% changes more
   than 9 of 55 coins or 7 of 58 stocks; 38 of the 65 parameters change no class at all. The choice of
   curve matters far more than any ±20% adjustment.
5. **The 16-week rule roughly halves class changes**: stocks from 0.96 to 0.56 changes a year, coins
   (price behaviour) from 0.89 to 0.35.
6. **Two tokens are rated that should not be** (vBUSD, Ampleforth), and **21 stocks went unrated** in
   this run when Tiingo stopped answering after 50 requests.
7. **Price curves tuned to the EU bands work for both** (§7, tested the same evening). One shared set
   of volatility and drawdown curves derived from the PRIIPs band edges, with no lift (variants B and
   C together), puts every rated coin and stock within one class of its PRIIPs band, with mean gaps
   near zero, and keeps the ordering. The cost: the scale compresses here, with no asset in classes 1
   or 2 and 39 of 55 coins in class 7.

The owner's decisions this leaves are in §6, with §7's results. **Decided 2026-10-11 (D97):** the
EU-aligned reading, with B and C adopted; the universe question stays open.

## 1. Sanity order

All 55 coins in the universe were rated; 58 of the 79 catalog stocks were (the other 21 are in §5).

| | Classes 1 · 2 · 3 · 4 · 5 · 6 · 7 | Median | Same as PRIIPs band | Within one class | Mean gap |
|---|---|---:|---:|---:|---:|
| Coins, as built | 0 · 2 · 11 · 20 · 14 · 7 · 1 | 4 | 1/55 | 10/55 | 2.35 |
| Coins, A: one set of price curves | 0 · 1 · 1 · 3 · 21 · 27 · 2 | 6 | 3/55 | 42/55 | 1.22 |
| Coins, C: no lift | 0 · 1 · 3 · 15 · 24 · 11 · 1 | 5 | 1/55 | 15/55 | 1.84 |
| Coins, A and C | 0 · 1 · 0 · 1 · 3 · 28 · 22 | 6 | 36/55 | 53/55 | 0.40 |
| Stocks, as built (A changes no stock) | 11 · 31 · 12 · 4 · 0 · 0 · 0 | 2 | 0/58 | 0/58 | 3.21 |
| Stocks, C: no lift | 3 · 25 · 17 · 9 · 4 · 0 · 0 | 3 | 0/58 | 4/58 | 2.60 |

The PRIIPs band is the class plain one-year volatility falls in on the EU PRIIPs scale: 20–30% is
class 5, 30–80% class 6 (survey §1.1). It is indicative only, since PRIIPs measures a VaR-equivalent
volatility over at least two years that counts fat tails, which puts most assets at or above this band.

**What the order gets right.** Within each asset class it is mostly sensible: Berkshire Hathaway,
Johnson & Johnson, Coca-Cola and Procter & Gamble score highest among stocks; Bitcoin and Tron, the
calmest coins over the year, highest among coins; Telcoin, Memecore, Flare and Conflux, with deep falls
and very high volatility, lowest. But Celestia and Sei, the most volatile coins after vBUSD (268% and
237%), rate class 5 rather than 6: liquidity and scale lift each of them a class (see the cap rule below).

**Surprises, each investigated:**
- **Coins are too low** (§8 first reading). Explained by the gentler coin curves and the one-class lift;
  A and C together correct it.
- **Stocks are too low against the EU scale**, by three classes on average. This is not a coin problem:
  the stock curves score 25% volatility at 78, and the class boundaries then put a typical large-cap
  stock in class 2. Eleven stocks rate "Very low": Apple, Berkshire Hathaway, Coca-Cola, Costco,
  Johnson & Johnson, JPMorgan, Bank of America, Mastercard, Pfizer, Procter & Gamble and Visa. On the
  PRIIPs scale none would be below class 4.
- **The cap rule binds often for large technology stocks**: 12 of 58 stocks (Broadcom, Oracle,
  Salesforce, AMD, Adobe, Intel, Qualcomm, ServiceNow, Palantir, Netflix, Tesla, Nike) and 2 coins
  (Ethereum, Cardano) sit exactly at their ceiling, so size and liquidity lift them one class.
- **vBUSD rates class 7 on a pricing glitch.** It is Venus's lending receipt for BUSD, a retired
  stablecoin. Its median daily trading volume over the year is $0; its price sits near $0.022 except
  for a dip to about $0.003, and the two jumps into and out of that dip make the 282% volatility.
  Nothing about it is measurable as a traded asset.
- **Ampleforth rates class 5, measuring the wrong thing.** Its supply expands and contracts to steer the
  price toward a target, so price volatility does not mean for it what it means for other coins.
  Both are filed `defi` in the catalog, which is why the universe rule admits them.
- **Tron rates class 2 ("Low")** on 24% volatility and a 17% largest fall: low for a coin, and real.

## 2. Backtest

Scores at each past quarter start, against the volatility and the largest fall over the following 6
and 12 months (Spearman across assets, averaged over quarter starts).

| | Horizon | Quarter starts | Assets (median) | ρ, later volatility | ρ, later largest fall |
|---|---|---:|---:|---:|---:|
| Stocks, full score | 6 months | 16 | 58 | −0.75 | −0.50 |
| Stocks, price behaviour alone | 6 months | 16 | 58 | −0.82 | −0.56 |
| Coins, price behaviour alone | 6 months | 5 | 32 | −0.75 | −0.59 |
| Coins, price behaviour alone, variant A | 6 months | 5 | 32 | −0.68 | −0.55 |
| Coins and stocks pooled, as built | 6 months | 5 | 90 | −0.89 | — |
| Coins and stocks pooled, variant A | 6 months | 5 | 90 | −0.93 | — |
| Stocks, full score | 12 months | 14 | 58 | −0.76 | −0.54 |
| Stocks, price behaviour alone | 12 months | 14 | 58 | −0.83 | −0.59 |
| Coins, price behaviour alone | 12 months | 3 | 32 | −0.74 | −0.65 |
| Coins, price behaviour alone, variant A | 12 months | 3 | 32 | −0.66 | −0.61 |
| Coins and stocks pooled, as built | 12 months | 3 | 90 | −0.89 | — |
| Coins and stocks pooled, variant A | 12 months | 3 | 90 | −0.94 | — |

- **The ordering holds up**, more strongly for later volatility than for later falls.
- **The full stock score orders a little worse than price behaviour alone** (−0.75 against −0.82).
  Size, liquidity and fundamentals do not help predict later volatility. They measure other things
  (how easily an asset trades, how its balance sheet stands), which may still be reasons to keep them,
  but they are not adding foresight.
- **One set of curves orders coins against stocks better** (pooled −0.93 against −0.89), and orders
  coins among themselves slightly worse (−0.68 against −0.75): the stock curves flatten above 120%
  volatility, so they cannot tell the wildest coins apart. If A is adopted, extending the shared curve's
  high end would recover that.

**Limits.** Coins: Binance.US closes, so price behaviour only (CoinGecko's free tier serves one year,
which is one rating's worth, and no free source gives older total volume or market cap); only 5 and 3
quarter starts; 32 coins with enough history. Both sets are today's catalogs, so assets that collapsed
and were dropped are missing (survivorship). Stocks at past dates use today's reference market cap
scaled by price, each fiscal year's net margin from SEC filings (taken as known 90 days after year end),
and no debt ÷ equity, for which the route carries no history.

## 3. Sensitivity

Every weight and every curve breakpoint, moved −20% and +20% alone, on today's ratings: 65 parameters
in all (the full table is in the appendix).

- **Most sensitive:** the coin drawdown point at 70% (7 of 55 coins change class at −20%, 9 at +20%);
  the stock volatility point at 25% (5 and 7 of 58); the coin liquidity weight (5 of 55 at −20%).
- **Inert:** 38 of the 65 parameters change no class either way, including every point of the
  stock size, debt ÷ equity and net-margin curves and of the coin dollar-volume curve.
- **Reading:** the classes are robust to tuning. What moves them is the choice of curve itself (variant
  A shifts the coin median two classes), which is where the owner's decision lies.

## 4. Stability

Weekly ratings over each asset's history from its second year to today, sampled on the first Monday of
each month, with the 16-week rule simulated as if a reading were stored every week.

| | Assets | Asset-months | Changes a year, no rule | With the 16-week rule |
|---|---:|---:|---:|---:|
| Stocks, class | 58 | 2,984 | 0.96 | 0.56 |
| Coins, price-behaviour class | 35 | 757 | 0.89 | 0.35 |

The rule cuts changes by 42% for stocks and 61% for coins. In use, readings exist only in weeks when
someone opens the page, and a missing week holds the class, so real changes would be fewer still.

## 5. Coverage and data

- **Stocks: 21 of 79 not rated in this run.** Tiingo served the first 50 stock requests and then
  stopped answering, the pattern of an hourly request limit on the Starter plan (worth confirming on
  the plan's page); FMP then served 8 of the remaining 29, and 21 failed (`fetch_failed`). The same
  ceiling applies to the live rating route and to every stock chart: past it, stock prices depend on
  FMP alone. A D21 observation (a paid tier is the remedy), recorded rather than chased. Re-running
  the validation in a later hour would rate the rest.
- **Coins: 38 of 55 have Binance.US history**, so the backtest and stability figures cover 32 to 35
  coins. The 17 without history are listed in the appendix.
- **CoinGecko's free tier refused 12 requests over the 55 coins** even at one request every eight
  seconds; the script waits a minute and retries, and every coin was rated.

## 6. The owner's decisions (D95 item 1, now ready)

**Decided 2026-10-11 (D97):** the owner adopted the recommendation (*"Lets go with your
recommendation"*): the EU-aligned reading (item 1), B and C (item 2), so the other parts can only
lower a class (item 4). Item 3, the universe, was not part of it and stays open.

1. **What the scale means.** §2 promises "one absolute scale ... as on the EU's scales"; §6's first
   sentence calls the rating "a guide to the level of measured price risk compared with other assets on
   this site". The data shows these pull apart:
   - **EU-aligned:** most stocks would rate 4 to 6 and most coins 6 to 7, leaving classes 1 to 3
     nearly empty on this site; no single stock would read "Very low". §7 tests the curves that do
     it: B and C together.
   - **Relative to this site:** the stock calibration can stay, coins move up with A, and the whole
     1–7 range is used; but "Very low" and "Low" for single stocks sit three classes below what the
     regulators' own scales would say, and §2 and the labels would need rewording to match.
   My recommendation is the EU-aligned reading: §2 already promises it, the survey grounded the scale
   in the regulators' practice, and it cannot understate a single stock's risk against the regulators'
   own scale. The cost is a compressed scale here. On that reading, adopt **B and C** (§7): the only
   variant tested that lines up coins and stocks alike, with the ordering intact.
2. **The curves.** On the EU-aligned reading, B and C settle both asset classes at once. On the
   relative reading, A (or A and C) for coins, and the stock curves stay. B alone sits between them:
   about one class under the bands, with more spread among coins.
3. **The universe:** leave out assets that are not measurably traded and tokens whose price is steered
   by supply. One rule would do it: no rating when median daily volume over the window is zero (vBUSD),
   plus a named exclusion for rebasing tokens (Ampleforth); or re-file both in the catalog.
4. **Size, liquidity and fundamentals.** They do not improve the backtest. Keep them for what they
   measure, and say on the methodology page that they are not predictive; or reduce their weight. Under
   C they can only lower a class.

The two readings stored during the end-to-end check (Bitcoin and Apple, week of 2026-10-05) are under
the draft version and stop counting when the numbers change and the version moves on.

## 7. Price curves tuned to the EU bands (variant B), tested the same evening

Requested after §6, and run at 21:44 UTC on the same day's data. The as-built figures matched the first
run exactly, and the same 58 stocks were rated, so the variants compare like for like.

**The curves.** One set for coins and stocks, computed by `euCalibratedCurves`
(`scripts/lib/ratingValidation.ts`, tested) from the PRIIPs band edges and this method's class
boundaries. Nothing in it is a choice beyond that rule; the weights are unchanged.

| Volatility (annualised) | Largest fall in a year | Sub-score | Class boundary it marks |
|---:|---:|---:|---|
| 0% | 0% | 100 | |
| 0.5% | 0.62% | 85.5 | 1 / 2 |
| 5% | 6.07% | 71.5 | 2 / 3 |
| 12% | 13.96% | 57.5 | 3 / 4 |
| 20% | 22.17% | 43.5 | 4 / 5 |
| 30% | 31.34% | 29.5 | 5 / 6 |
| 80% | 63.31% | 14.5 | 6 / 7 |
| 160% | 86.54% | 0 | |

Each volatility edge sits half a point under its class boundary, so volatility alone lands in the class
PRIIPs gives it (the edge itself in the higher class, as PRIIPs counts it). PRIIPs has no drawdown
measure, so the drawdown column is the fall a random walk at that volatility typically shows over a
year, 1 − e^(−σ·√(π/2)) (the expected maximum drawdown of a driftless walk, Magdon-Ismail et al., 2004).
Both price measures then speak the same scale.

**Results**, beside the method as built and the best variant from §1:

| | Coins: classes 1 · 2 · 3 · 4 · 5 · 6 · 7 | Median | Same as PRIIPs | Within one | Mean gap | Stocks: classes 1 · 2 · 3 · 4 · 5 · 6 · 7 | Median | Same as PRIIPs | Within one | Mean gap |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|
| As built | 0 · 2 · 11 · 20 · 14 · 7 · 1 | 4 | 1/55 | 10/55 | 2.35 | 11 · 31 · 12 · 4 · 0 · 0 · 0 | 2 | 0/58 | 0/58 | 3.21 |
| A and C | 0 · 1 · 0 · 1 · 3 · 28 · 22 | 6 | 36/55 | 53/55 | 0.40 | 3 · 25 · 17 · 9 · 4 · 0 · 0 | 3 | 0/58 | 4/58 | 2.60 |
| B | 0 · 0 · 0 · 1 · 13 · 37 · 4 | 6 | 10/55 | 54/55 | 0.84 | 0 · 1 · 11 · 29 · 17 · 0 · 0 | 4 | 1/58 | 40/58 | 1.29 |
| **B and C** | 0 · 0 · 0 · 0 · 1 · 15 · 39 | 7 | 46/55 | 55/55 | −0.05 | 0 · 0 · 1 · 11 · 29 · 17 · 0 | 5 | 39/58 | 58/58 | 0.29 |

- **B and C line up both asset classes with the regulators' scale.** Every rated coin and stock lands
  within one class of its PRIIPs band, and the mean gaps are near zero. Since the band is a lower bound
  (PRIIPs counts fat tails), a small negative gap for coins is in the expected direction.
- **The ordering survives.** Over 6 months, the full stock score ranks later volatility at −0.77 under
  B and −0.76 under B and C, against −0.75 as built. Coins' price behaviour ranks it at −0.75 under B,
  the same as built, so B does not lose what A lost: its curve runs to 160% volatility. Coins and stocks
  pooled: −0.93 (−0.94 over 12 months), as under A.
- **Stability.** Stocks under B and C change class 0.58 times a year with the 16-week rule (0.56 as
  built). Coins' price-behaviour class under B changes 0.13 times a year (0.35 as built), because most
  coins now sit in the broad 30–80% band.
- **Examples under B and C:**
  - Coins: Bitcoin 6, matching the regulated Bitcoin fund's own EU document; Ethereum, Solana and
    Dogecoin 6; Tron 5; Memecore and Celestia 7.
  - Stocks: Berkshire Hathaway 3; Apple, Coca-Cola, Johnson & Johnson, Procter & Gamble and JPMorgan 4;
    Nvidia 5; Microsoft, Oracle, Palantir and Tesla 6.

**The cost.** The scale compresses on this site. Under B and C no asset rates 1 or 2, and 39 of 55 coins
rate 7, so the coin classes say little about one coin against another: Dogecoin and Ethereum share
class 6. The 0–100 score underneath and its parts still tell them apart, and the panel shows both. B
alone keeps more spread (37 coins in class 6, 13 in class 5), at the price of sitting about one class
under the bands.

**What adopting B and C would change in `v1.ts`:** the volatility and drawdown curves for both asset
classes become the table above, `capClassesAboveCore` becomes 0, and the version moves on. The weights,
the other curves and every other rule stay. The universe decision (§6 item 3) is separate.

**Adopted 2026-10-11 (D97), exactly so.** `PRICE_CURVES` in `v1.ts` writes out the table above, with
the drawdown points to 0.01% and a test holding them to `euCalibratedCurves`; `capClassesAboveCore` is
0; the version is `v1 (2026-10-11)`.

---

## Appendix: the generated report

The output of `npm run ratings:validate` from the second run, 2026-10-10 at 21:44 UTC, which adds variants B and B+C. Its as-built figures are identical to the first run's (20:39 UTC), on which sections 1 to 6 were written.

### Rating validation report

Generated 2026-10-10T21:43:53.582Z by `scripts/validate-ratings.ts`, method `v1 (draft, 2026-10-09)`. Reads only; stores nothing.

#### 1. Sanity order

**Coins: 55 of 55 rated.**

| Variant | Classes (1 … 7) | Median class | Same as PRIIPs band | Within one | Mean gap (PRIIPs − ours) |
|---|---|---|---|---|---|
| As built | 1: 0 · 2: 2 · 3: 11 · 4: 20 · 5: 14 · 6: 7 · 7: 1 | 4 | 1/55 | 10/55 | 2.35 |
| A: one set of price curves (coins on the stock curves) | 1: 0 · 2: 1 · 3: 1 · 4: 3 · 5: 21 · 6: 27 · 7: 2 | 6 | 3/55 | 42/55 | 1.22 |
| C: no lift (size and liquidity may only lower the class) | 1: 0 · 2: 1 · 3: 3 · 4: 15 · 5: 24 · 6: 11 · 7: 1 | 5 | 1/55 | 15/55 | 1.84 |
| A and C together | 1: 0 · 2: 1 · 3: 0 · 4: 1 · 5: 3 · 6: 28 · 7: 22 | 6 | 36/55 | 53/55 | 0.40 |
| B: one set of price curves tuned to the EU PRIIPs bands | 1: 0 · 2: 0 · 3: 0 · 4: 1 · 5: 13 · 6: 37 · 7: 4 | 6 | 10/55 | 54/55 | 0.84 |
| B and C together | 1: 0 · 2: 0 · 3: 0 · 4: 0 · 5: 1 · 6: 15 · 7: 39 | 7 | 46/55 | 55/55 | -0.05 |

**Stocks: 58 of 79 rated.**

| Variant | Classes (1 … 7) | Median class | Same as PRIIPs band | Within one | Mean gap (PRIIPs − ours) |
|---|---|---|---|---|---|
| As built | 1: 11 · 2: 31 · 3: 12 · 4: 4 · 5: 0 · 6: 0 · 7: 0 | 2 | 0/58 | 0/58 | 3.21 |
| A: one set of price curves (coins on the stock curves) | 1: 11 · 2: 31 · 3: 12 · 4: 4 · 5: 0 · 6: 0 · 7: 0 | 2 | 0/58 | 0/58 | 3.21 |
| C: no lift (size and liquidity may only lower the class) | 1: 3 · 2: 25 · 3: 17 · 4: 9 · 5: 4 · 6: 0 · 7: 0 | 3 | 0/58 | 4/58 | 2.60 |
| A and C together | 1: 3 · 2: 25 · 3: 17 · 4: 9 · 5: 4 · 6: 0 · 7: 0 | 3 | 0/58 | 4/58 | 2.60 |
| B: one set of price curves tuned to the EU PRIIPs bands | 1: 0 · 2: 1 · 3: 11 · 4: 29 · 5: 17 · 6: 0 · 7: 0 | 4 | 1/58 | 40/58 | 1.29 |
| B and C together | 1: 0 · 2: 0 · 3: 1 · 4: 11 · 5: 29 · 6: 17 · 7: 0 | 5 | 39/58 | 58/58 | 0.29 |

PRIIPs band = the class plain one-year volatility falls in on the EU PRIIPs scale (survey §1.1). Indicative, and a lower bound: PRIIPs counts fat tails.

##### Every coin

| Coin | Class (as built) | Score | Price alone (class) | Capped | Volatility | Largest fall | PRIIPs band | A | C | A+C | B | B+C | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vBUSD (vbusd) | 7 (Very high) | 13.3 | 15 (6) |  | 282% | 86% | 7 | 7 | 7 | 7 | 7 | 7 |  |
| AMPL (ampl) | 5 (Moderately high) | 38.4 | 58.3 (3) |  | 101% | 31% | 7 | 6 | 5 | 6 | 6 | 6 |  |
| BTC (btc) | 2 (Low) | 81.3 | 70 (3) |  | 44% | 49% | 6 | 3 | 3 | 4 | 5 | 6 |  |
| ETH (eth) | 3 (Moderately low) | 71 | 57 (4) | yes | 62% | 63% | 6 | 4 | 4 | 5 | 5 | 6 |  |
| SOL (sol) | 3 (Moderately low) | 69 | 52.6 (4) |  | 66% | 70% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| BNB (bnb) | 3 (Moderately low) | 67.6 | 64.4 (3) |  | 49% | 58% | 6 | 4 | 3 | 5 | 5 | 6 |  |
| AVAX (avax) | 3 (Moderately low) | 58.8 | 46.9 (4) |  | 73% | 75% | 6 | 5 | 4 | 6 | 6 | 7 |  |
| ADA (ada) | 4 (Moderate) | 57 | 42 (5) | yes | 79% | 80% | 6 | 5 | 5 | 6 | 6 | 7 |  |
| DOT (dot) | 4 (Moderate) | 55 | 42.4 (5) |  | 82% | 78% | 7 | 5 | 5 | 6 | 6 | 7 |  |
| POL (pol) | 4 (Moderate) | 56.2 | 51.1 (4) |  | 73% | 67% | 6 | 5 | 4 | 6 | 6 | 7 |  |
| TRX (trx) | 2 (Low) | 77.8 | 90 (1) |  | 24% | 17% | 5 | 2 | 2 | 2 | 4 | 5 |  |
| HYPE (hype) | 3 (Moderately low) | 64.1 | 49.3 (4) |  | 91% | 56% | 7 | 5 | 4 | 6 | 6 | 7 |  |
| ZEC (zec) | 4 (Moderate) | 55.1 | 30.8 (5) |  | 142% | 72% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| XMR (xmr) | 4 (Moderate) | 55.5 | 50.7 (4) |  | 83% | 59% | 7 | 5 | 4 | 6 | 5 | 6 |  |
| TON (ton) | 4 (Moderate) | 54.2 | 55.9 (4) |  | 76% | 52% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| BCH (bch) | 3 (Moderately low) | 58.4 | 48.1 (4) |  | 76% | 71% | 6 | 5 | 4 | 6 | 6 | 7 |  |
| M (memecore) | 6 (High) | 23.5 | 19 (6) |  | 173% | 87% | 7 | 6 | 6 | 7 | 7 | 7 |  |
| HBAR (hbar) | 3 (Moderately low) | 58.1 | 51.8 (4) |  | 70% | 68% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| LTC (ltc) | 3 (Moderately low) | 64.9 | 58.7 (3) |  | 58% | 63% | 6 | 4 | 3 | 5 | 5 | 6 |  |
| SUI (sui) | 4 (Moderate) | 55.7 | 40.9 (5) |  | 86% | 78% | 7 | 5 | 5 | 6 | 6 | 7 |  |
| CRO (cro) | 5 (Moderately high) | 42.9 | 48.4 (4) |  | 72% | 73% | 6 | 5 | 5 | 6 | 6 | 7 |  |
| NEAR (near) | 4 (Moderate) | 56.7 | 40.3 (5) |  | 104% | 68% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| TAO (tao) | 4 (Moderate) | 54.4 | 40 (5) |  | 104% | 69% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| PI (pi) | 5 (Moderately high) | 37.3 | 44.3 (4) |  | 86% | 72% | 7 | 6 | 5 | 6 | 6 | 7 |  |
| ICP (icp) | 4 (Moderate) | 49.5 | 36.3 (5) |  | 102% | 77% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| ETC (etc) | 4 (Moderate) | 57.7 | 52.4 (4) |  | 70% | 66% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| KAS (kas) | 5 (Moderately high) | 41 | 32.2 (5) |  | 163% | 61% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| ALGO (algo) | 4 (Moderate) | 47.5 | 33.8 (5) |  | 145% | 64% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| FLR (flr) | 6 (High) | 25.2 | 22.2 (6) |  | 204% | 72% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| XDC (xdc) | 4 (Moderate) | 50.3 | 54.8 (4) |  | 71% | 60% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| FIL (fil) | 4 (Moderate) | 45.1 | 30 (5) |  | 116% | 82% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| APT (apt) | 4 (Moderate) | 45.1 | 31.4 (5) |  | 105% | 87% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| INJ (inj) | 4 (Moderate) | 48.8 | 38.8 (5) |  | 103% | 72% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| VET (vet) | 5 (Moderately high) | 41.2 | 31.6 (5) |  | 117% | 78% | 7 | 6 | 5 | 7 | 6 | 7 |  |
| SEI (sei) | 5 (Moderately high) | 36.6 | 15.7 (6) |  | 237% | 84% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| TIA (tia) | 5 (Moderately high) | 38.7 | 19.8 (6) |  | 268% | 76% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| CHZ (chz) | 4 (Moderate) | 48.2 | 38.9 (5) |  | 88% | 81% | 7 | 5 | 5 | 6 | 6 | 7 |  |
| GNO (gno) | 5 (Moderately high) | 42 | 56.5 (4) |  | 88% | 43% | 7 | 6 | 5 | 6 | 6 | 6 |  |
| XTZ (xtz) | 5 (Moderately high) | 37.1 | 46.7 (4) |  | 77% | 73% | 6 | 6 | 5 | 6 | 6 | 7 |  |
| TEL (tel) | 6 (High) | 22.8 | 29.2 (6) |  | 126% | 79% | 7 | 7 | 6 | 7 | 7 | 7 |  |
| KAIA (kaia) | 6 (High) | 29.2 | 31 (5) |  | 113% | 81% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| CFX (cfx) | 6 (High) | 25.2 | 22.8 (6) |  | 220% | 70% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| IOTA (iota) | 5 (Moderately high) | 31.6 | 35.6 (5) |  | 100% | 80% | 7 | 6 | 5 | 6 | 6 | 7 |  |
| DCR (dcr) | 6 (High) | 28.8 | 30.1 (5) |  | 125% | 78% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| THETA (theta) | 5 (Moderately high) | 34.1 | 40.6 (5) |  | 84% | 79% | 7 | 6 | 5 | 6 | 6 | 7 |  |
| XRP (xrp) | 3 (Moderately low) | 69 | 56 (4) |  | 65% | 62% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| DOGE (doge) | 3 (Moderately low) | 65.5 | 52.8 (4) |  | 68% | 68% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| UNI (uni) | 4 (Moderate) | 55.1 | 39.4 (5) |  | 97% | 75% | 7 | 5 | 5 | 6 | 6 | 7 |  |
| AAVE (aave) | 4 (Moderate) | 54.9 | 41.5 (5) |  | 87% | 77% | 7 | 5 | 5 | 6 | 6 | 7 |  |
| LINK (link) | 3 (Moderately low) | 64.6 | 52.6 (4) |  | 72% | 64% | 6 | 5 | 4 | 6 | 5 | 6 |  |
| MKR (mkr) | 5 (Moderately high) | 40 | 55.1 (4) |  | 92% | 43% | 7 | 6 | 5 | 6 | 7 | 7 |  |
| SNX (snx) | 6 (High) | 28.6 | 29.6 (6) |  | 111% | 92% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| CRV (crv) | 4 (Moderate) | 51.1 | 44.3 (4) |  | 87% | 71% | 7 | 5 | 4 | 6 | 6 | 7 |  |
| LDO (ldo) | 5 (Moderately high) | 38.5 | 19.5 (6) |  | 215% | 77% | 7 | 6 | 6 | 7 | 6 | 7 |  |
| GRT (grt) | 5 (Moderately high) | 42.4 | 28 (6) |  | 124% | 82% | 7 | 6 | 6 | 7 | 6 | 7 |  |

##### Every stock

Classes and scores only: stock prices may come from Tiingo, whose terms bar keeping its data, so no price-derived figure is written here.

| Stock | Class (as built) | Score | Price alone (class) | Capped | PRIIPs band | A | C | A+C | B | B+C | Prices from | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AAPL | 1 (Very low) | 88 | 81 (2) |  | 5 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| MSFT | 2 (Low) | 80.7 | 62.5 (3) |  | 6 | 2 | 3 | 3 | 5 | 6 | tiingo |  |
| NVDA | 2 (Low) | 82.8 | 67.1 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| AVGO | 3 (Moderately low) | 71 | 56 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| ORCL | 4 (Moderate) | 57 | 32.8 (5) | yes | 6 | 4 | 5 | 5 | 5 | 6 | tiingo |  |
| CRM | 3 (Moderately low) | 71 | 48.1 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| AMD | 3 (Moderately low) | 71 | 46.4 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| ADBE | 3 (Moderately low) | 71 | 49.4 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| CSCO | 2 (Low) | 83.6 | 70.6 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| INTC | 4 (Moderate) | 57 | 34.3 (5) | yes | 6 | 4 | 5 | 5 | 5 | 6 | tiingo |  |
| QCOM | 3 (Moderately low) | 71 | 45.2 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| TXN | 2 (Low) | 79.4 | 62.6 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| IBM | 3 (Moderately low) | 70.3 | 49.1 (4) |  | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| NOW | 4 (Moderate) | 57 | 35.1 (5) | yes | 6 | 4 | 5 | 5 | 5 | 6 | tiingo |  |
| PLTR | 4 (Moderate) | 57 | 38.4 (5) | yes | 6 | 4 | 5 | 5 | 5 | 6 | tiingo |  |
| GOOGL | 2 (Low) | 84.6 | 71.3 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| META | 2 (Low) | 78.8 | 58.6 (3) |  | 6 | 2 | 3 | 3 | 5 | 6 | tiingo |  |
| NFLX | 3 (Moderately low) | 71 | 52.7 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| DIS | 2 (Low) | 84.9 | 75 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| TMUS | 2 (Low) | 76.2 | 62.2 (3) |  | 6 | 2 | 3 | 3 | 5 | 6 | tiingo |  |
| VZ | 2 (Low) | 84.4 | 77.2 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| T | 2 (Low) | 80.9 | 70 (3) |  | 5 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| AMZN | 2 (Low) | 82.1 | 68.9 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| TSLA | 3 (Moderately low) | 71 | 51.1 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| HD | 2 (Low) | 77.5 | 72.2 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| MCD | 2 (Low) | 78.8 | 75.5 (2) |  | 4 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| NKE | 3 (Moderately low) | 71 | 50.6 (4) | yes | 6 | 3 | 4 | 4 | 5 | 6 | tiingo |  |
| SBUX | 2 (Low) | 76 | 77.5 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| LOW | 3 (Moderately low) | 71.4 | 64.7 (3) |  | 5 | 3 | 3 | 3 | 4 | 5 | tiingo |  |
| BKNG | 3 (Moderately low) | 68.7 | 61.4 (3) |  | 6 | 3 | 3 | 3 | 5 | 6 | tiingo |  |
| WMT | 2 (Low) | 82.1 | 73.4 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| PG | 1 (Very low) | 89.5 | 84.5 (2) |  | 4 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| KO | 1 (Very low) | 90.7 | 89.2 (1) |  | 4 | 1 | 1 | 1 | 3 | 4 | tiingo |  |
| PEP | 2 (Low) | 81.7 | 77.3 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| COST | 1 (Very low) | 86.6 | 82.8 (2) |  | 4 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| PM | 2 (Low) | 78.8 | 75.4 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| MDLZ | 2 (Low) | 84 | 80.3 (2) |  | 5 | 2 | 2 | 2 | 3 | 4 | tiingo |  |
| BRK-B | 1 (Very low) | 94.5 | 92.8 (1) |  | 4 | 1 | 1 | 1 | 2 | 3 | tiingo |  |
| JPM | 1 (Very low) | 88.4 | 82 (2) |  | 5 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| V | 1 (Very low) | 88 | 81.3 (2) |  | 5 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| MA | 1 (Very low) | 87.3 | 80 (2) |  | 5 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| BAC | 1 (Very low) | 87.6 | 80.5 (2) |  | 5 | 1 | 2 | 2 | 3 | 4 | tiingo |  |
| WFC | 2 (Low) | 83.7 | 73.6 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| GS | 2 (Low) | 81.5 | 69.6 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| MS | 2 (Low) | 84.4 | 74.8 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| AXP | 2 (Low) | 83.4 | 73 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| BLK | 2 (Low) | 83.2 | 73.5 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| C | 2 (Low) | 85.1 | 76.9 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | tiingo |  |
| LLY | 2 (Low) | 80.2 | 67.9 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| UNH | 2 (Low) | 76.9 | 63.7 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | tiingo |  |
| JNJ | 1 (Very low) | 91.8 | 88.2 (1) |  | 4 | 1 | 1 | 1 | 3 | 4 | fmp |  |
| ABBV | 2 (Low) | 78 | 78.7 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | fmp |  |
| MRK | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| TMO | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| ABT | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| PFE | 1 (Very low) | 86.6 | 82.1 (2) |  | 5 | 1 | 2 | 2 | 3 | 4 | fmp |  |
| AMGN | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| ISRG | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| XOM | 2 (Low) | 84.8 | 75.5 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | fmp |  |
| CVX | 2 (Low) | 84.8 | 76.8 (2) |  | 5 | 2 | 2 | 2 | 4 | 5 | fmp |  |
| COP | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| SLB | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| CAT | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| GE | 2 (Low) | 81.1 | 70 (3) |  | 6 | 2 | 3 | 3 | 4 | 5 | fmp |  |
| HON | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| UPS | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| BA | 3 (Moderately low) | 70.4 | 65.9 (3) |  | 6 | 3 | 3 | 3 | 4 | 5 | fmp |  |
| DE | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| LMT | 2 (Low) | 76.1 | 69.9 (3) |  | 5 | 2 | 3 | 3 | 4 | 5 | fmp |  |
| RTX | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| LIN | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| SHW | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| FCX | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| NEE | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| DUK | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| SO | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| PLD | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| AMT | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |
| O | not rated | — | — |  | — | — | — | — | — | — | none | prices: fetch_failed |

#### 2. Backtest

Spearman rank correlation, per quarter start, between the score and what followed. Negative means higher scores (lower measured risk) went with lower later volatility or smaller later falls; −1 is a perfect ordering, 0 none.

| Set | Horizon | Quarter starts | Median assets | ρ with later volatility | ρ with later largest fall |
|---|---|---|---|---|---|
| Stocks, full score (as built) | 6 months | 16 | 58.00 | -0.75 | -0.50 |
| Stocks, price alone (as built) | 6 months | 16 | 58.00 | -0.82 | -0.56 |
| Stocks, full score (variant B) | 6 months | 16 | 58.00 | -0.77 | -0.52 |
| Stocks, price alone (variant B) | 6 months | 16 | 58.00 | -0.80 | -0.54 |
| Stocks, full score (variant B+C) | 6 months | 16 | 58.00 | -0.76 | -0.51 |
| Coins, price alone (as built) | 6 months | 5 | 32.00 | -0.75 | -0.59 |
| Coins and stocks pooled, price alone (as built) | 6 months | 5 | 90.00 | -0.89 | — |
| Coins, price alone (variant A) | 6 months | 5 | 32.00 | -0.68 | -0.55 |
| Coins and stocks pooled, price alone (variant A) | 6 months | 5 | 90.00 | -0.93 | — |
| Coins, price alone (variant B) | 6 months | 5 | 32.00 | -0.75 | -0.60 |
| Coins and stocks pooled, price alone (variant B) | 6 months | 5 | 90.00 | -0.93 | — |
| Stocks, full score (as built) | 12 months | 14 | 58.00 | -0.76 | -0.54 |
| Stocks, price alone (as built) | 12 months | 14 | 58.00 | -0.83 | -0.59 |
| Stocks, full score (variant B) | 12 months | 14 | 58.00 | -0.77 | -0.55 |
| Stocks, price alone (variant B) | 12 months | 14 | 58.00 | -0.81 | -0.58 |
| Stocks, full score (variant B+C) | 12 months | 14 | 58.00 | -0.76 | -0.54 |
| Coins, price alone (as built) | 12 months | 3 | 32.00 | -0.74 | -0.65 |
| Coins and stocks pooled, price alone (as built) | 12 months | 3 | 90.00 | -0.89 | — |
| Coins, price alone (variant A) | 12 months | 3 | 32.00 | -0.66 | -0.61 |
| Coins and stocks pooled, price alone (variant A) | 12 months | 3 | 90.00 | -0.94 | — |
| Coins, price alone (variant B) | 12 months | 3 | 32.00 | -0.75 | -0.66 |
| Coins and stocks pooled, price alone (variant B) | 12 months | 3 | 90.00 | -0.94 | — |

Stocks at past dates: market cap is today's reference figure scaled by price, net margin is each fiscal year's from SEC filings (filed 90 days after year end), and debt ÷ equity is left out (the route carries no history of it). Coins: Binance.US closes, price behaviour only.

#### 3. Sensitivity

Each parameter moved −20% and +20% alone; the count is how many rated assets change class. All 65 parameters, most sensitive first:

| Parameter | −20% | +20% |
|---|---|---|
| crypto curve: drawdown point 4 (0.7 → 35) | 7/55 | 9/55 |
| stock curve: volatility point 2 (0.25 → 78) | 5/58 | 7/58 |
| crypto weight: Liquidity (0.25) | 5/55 | 1/55 |
| crypto curve: volatility point 3 (0.8 → 55) | 4/55 | 5/55 |
| stock curve: volatility point 4 (0.6 → 38) | 5/58 | 0/58 |
| crypto weight: Drawdown (0.2) | 2/55 | 4/55 |
| crypto curve: volatility point 4 (1.2 → 35) | 4/55 | 4/55 |
| crypto curve: drawdown point 5 (0.85 → 15) | skipped (would reorder the curve) | 4/55 |
| crypto weight: Volatility (0.3) | 3/55 | 1/55 |
| stock curve: volatility point 3 (0.4 → 58) | 3/58 | 1/58 |
| stock curve: drawdown point 3 (0.35 → 55) | 3/58 | 1/58 |
| stock curve: drawdown point 4 (0.5 → 35) | 3/58 | 0/58 |
| crypto curve: volatility point 2 (0.5 → 75) | 1/55 | 2/55 |
| crypto curve: drawdown point 3 (0.5 → 55) | 1/55 | 2/55 |
| crypto curve: turnover point 4 (0.05 → 90) | 0/55 | 2/55 |
| stock curve: drawdown point 2 (0.2 → 75) | 2/58 | 0/58 |
| stock curve: drawdown point 5 (0.7 → 15) | 2/58 | 0/58 |
| crypto weight: Scale (0.25) | 1/55 | 1/55 |
| crypto curve: volatility point 5 (2 → 15) | 1/55 | 0/55 |
| crypto curve: turnover point 3 (0.02 → 75) | 0/55 | 1/55 |
| crypto curve: scale point 2 (2000000000 → 45) | 1/55 | 1/55 |
| crypto curve: scale point 3 (10000000000 → 65) | 0/55 | 1/55 |
| stock weight: Drawdown (0.2) | 1/58 | 0/58 |
| stock weight: Liquidity (0.2) | 0/58 | 1/58 |
| stock weight: Size (0.15) | 0/58 | 1/58 |
| stock weight: Fundamentals (0.2) | 1/58 | 0/58 |
| stock curve: volatility point 5 (0.8 → 22) | 1/58 | 0/58 |
| crypto curve: volatility point 1 (0.3 → 90) | 0/55 | 0/55 |
| crypto curve: drawdown point 1 (0.2 → 90) | 0/55 | 0/55 |
| crypto curve: drawdown point 2 (0.35 → 75) | 0/55 | 0/55 |
| crypto curve: turnover point 1 (0.0005 → 10) | 0/55 | 0/55 |
| crypto curve: turnover point 2 (0.005 → 40) | 0/55 | 0/55 |
| crypto curve: dollarVolume point 1 (10000000 → 10) | 0/55 | 0/55 |
| crypto curve: dollarVolume point 2 (100000000 → 35) | 0/55 | 0/55 |
| crypto curve: dollarVolume point 3 (1000000000 → 60) | 0/55 | 0/55 |
| crypto curve: dollarVolume point 4 (10000000000 → 80) | 0/55 | 0/55 |
| crypto curve: dollarVolume point 5 (30000000000 → 90) | 0/55 | 0/55 |
| crypto curve: scale point 1 (500000000 → 25) | 0/55 | 0/55 |
| crypto curve: scale point 4 (50000000000 → 80) | 0/55 | 0/55 |
| crypto curve: scale point 5 (200000000000 → 90) | 0/55 | 0/55 |
| crypto curve: scale point 6 (1000000000000 → 95) | 0/55 | 0/55 |
| stock weight: Volatility (0.25) | 0/58 | 0/58 |
| stock curve: volatility point 1 (0.15 → 95) | 0/58 | 0/58 |
| stock curve: volatility point 6 (1.2 → 8) | 0/58 | 0/58 |
| stock curve: drawdown point 1 (0.1 → 90) | 0/58 | 0/58 |
| stock curve: dollarVolume point 1 (100000 → 10) | 0/58 | 0/58 |
| stock curve: dollarVolume point 2 (1000000 → 45) | 0/58 | 0/58 |
| stock curve: dollarVolume point 3 (10000000 → 75) | 0/58 | 0/58 |
| stock curve: dollarVolume point 4 (50000000 → 90) | 0/58 | 0/58 |
| stock curve: dollarVolume point 5 (500000000 → 98) | 0/58 | 0/58 |
| stock curve: size point 1 (50000000 → 10) | 0/58 | 0/58 |
| stock curve: size point 2 (300000000 → 40) | 0/58 | 0/58 |
| stock curve: size point 3 (2000000000 → 65) | 0/58 | 0/58 |
| stock curve: size point 4 (10000000000 → 82) | 0/58 | 0/58 |
| stock curve: size point 5 (200000000000 → 95) | 0/58 | 0/58 |
| stock curve: debtToEquity point 1 (0.25 → 92) | 0/58 | 0/58 |
| stock curve: debtToEquity point 2 (0.75 → 80) | 0/58 | 0/58 |
| stock curve: debtToEquity point 3 (1.5 → 60) | 0/58 | 0/58 |
| stock curve: debtToEquity point 4 (3 → 35) | 0/58 | 0/58 |
| stock curve: debtToEquity point 5 (6 → 12) | 0/58 | 0/58 |
| stock curve: netMargin point 1 (-0.3 → 10) | 0/58 | 0/58 |
| stock curve: netMargin point 2 (-0.05 → 35) | 0/58 | 0/58 |
| stock curve: netMargin point 3 (0.02 → 60) | 0/58 | 0/58 |
| stock curve: netMargin point 4 (0.1 → 80) | 0/58 | 0/58 |
| stock curve: netMargin point 5 (0.25 → 95) | 0/58 | 0/58 |

#### 4. Stability

| Set | Assets | Asset-months | Changes, no rule | Per asset per year | Changes, 16-week rule | Per asset per year |
|---|---|---|---|---|---|---|
| Stocks, class (as built) | 58 | 2984 | 239 | 0.96 | 140 | 0.56 |
| Stocks, class (variant B+C) | 58 | 2984 | 230 | 0.92 | 145 | 0.58 |
| Coins, price-alone class (as built) | 35 | 757 | 56 | 0.89 | 22 | 0.35 |
| Coins, price-alone class (variant B) | 35 | 757 | 13 | 0.21 | 8 | 0.13 |

Weekly ratings from each asset's second year of history to today, sampled on the first Monday of each month. The rule is simulated with a reading every week.

#### Data notes

- vbusd: Binance history: no-source
- ampl: Binance history: no-source
- hype: Binance history: no-source
- xmr: Binance history: Error: binance-400
- ton: Binance history: Error: binance-400
- memecore: Binance history: no-source
- cro: Binance history: no-source
- tao: Binance history: Error: binance-400
- pi: Binance history: no-source
- kas: Binance history: no-source
- flr: Binance history: Error: binance-400
- xdc: Binance history: no-source
- gno: Binance history: no-source
- tel: Binance history: no-source
- kaia: Binance history: no-source
- cfx: Binance history: Error: binance-400
- dcr: Binance history: no-source
- MRK: prices: fetch_failed
- TMO: prices: fetch_failed
- ABT: prices: fetch_failed
- AMGN: prices: fetch_failed
- ISRG: prices: fetch_failed
- COP: prices: fetch_failed
- SLB: prices: fetch_failed
- CAT: prices: fetch_failed
- HON: prices: fetch_failed
- UPS: prices: fetch_failed
- DE: prices: fetch_failed
- RTX: prices: fetch_failed
- LIN: prices: fetch_failed
- SHW: prices: fetch_failed
- FCX: prices: fetch_failed
- NEE: prices: fetch_failed
- DUK: prices: fetch_failed
- SO: prices: fetch_failed
- PLD: prices: fetch_failed
- AMT: prices: fetch_failed
- O: prices: fetch_failed
