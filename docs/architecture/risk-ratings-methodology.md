# Risk ratings methodology, v1

**Status: v1, numbers decided 2026-10-11 (D97, D98, D99).** T-420 item (1). The draft's second revision
(2026-10-07) adopted every change proposed in `docs/assessments/risk-rating-methods-survey-2026-10-07.md`
§3 (owner: *"adopt all the proposed changes and update the draft"*; D94). After the validation in §8,
the owner adopted one set of price curves for coins and stocks derived from the EU PRIIPs bands, and no
lift from the other parts (D97), with the score held at the price score itself (D98), and left out
coins nobody trades or whose supply steers their price (D99); the weights and the other curves are
Finance Now's choices, kept.
Nothing built from this note is shown until counsel confirms the form and the owner says so (D92, D4).

**How later iterations work.** The build keeps every weight, window, curve, threshold and rule in one
file, `frontend/src/lib/risk/methodology/v1.ts`, and the public methodology section is rendered from
that same file, so the page can never describe numbers the code does not use. A change to the method
means editing that file, bumping its version (v1 → v2), and adding a line to the changelog at the end
of this note. Every rating shows the version that produced it.

---

## 1. What D92 allows, and what this rating is

- **Where:** a rating on each crypto coin's own page and each stock's own page. Nowhere else: not
  beside a user's holdings, not on a portfolio, not in a list or ranking, not in an alert, and not in
  the API, MCP server or AI agents until that is decided separately (D77).
- **What it is:** a measurement of how much an asset's price has moved and fallen over the past year,
  how easily it trades, how large it is, and (for stocks) how its balance sheet stands, combined by a
  fixed, published formula. The same for every reader; it takes no input from the user.
- **What it is not:** a recommendation, a forecast, or a judgment of whether the asset suits anyone.
  It does not assess, and the page says so: the project's code or smart contracts, the team, custody
  or exchange risk, legal or regulatory standing, token supply schedules, accounting quality,
  order-book depth, whether reported volume is genuine, or future prices.

## 2. The output

**Headline: a class from 1 to 7**, the scale EU regulators chose after consumer testing (survey §1.5).
Class 1 is the lowest measured risk. Underneath it, the **score from 0 to 100** (higher means lower
measured risk, the engine's canonical scale), and every part that produced it.

| Score | Class | Label shown |
|---|---|---|
| 86–100 | 1 | Very low |
| 72–85 | 2 | Low |
| 58–71 | 3 | Moderately low |
| 44–57 | 4 | Moderate |
| 30–43 | 5 | Moderately high |
| 15–29 | 6 | High |
| 0–14 | 7 | Very high |

**The labels are decided (owner, 2026-10-07, D95).** The panel heading says what is measured once,
"Measured risk: Class 4 of 7", and the label follows it ("Moderate"), so each label stays short. A
label is never shown without that heading. The labels describe the measurement, never a kind of
investor (no "conservative" or "aggressive"), and there are no letter grades or stars, which
commercial raters use for buy and sell (survey §2, item 10).

**One absolute scale for coins and stocks.** The same thresholds apply to both, as on the EU's
scales, so a class means the same thing on every page. Most coins will sit in classes 5 to 7 because
they are far more volatile than most stocks. That is the measurement, not a flaw, and the methodology
section says so. (A regulated bitcoin fund's own EU document puts it at 6 of 7.)

**One set of price curves for coins and stocks (D97, 2026-10-11).** Volatility and drawdown become
sub-scores through the same curves for both, worked out from the EU PRIIPs market-risk bands rather
than chosen: each band edge sits half a point under the matching class boundary, so volatility alone
lands in the class whose band holds it (the edge itself in the higher class, as PRIIPs counts it).
PRIIPs has no drawdown measure, so each drawdown point is the fall a random walk at that volatility
typically shows in a year, 1 − e^(−σ·√(π/2)) (Magdon-Ismail et al., 2004), to 0.01%. The two price
measures then speak one scale: an asset whose largest fall is what its volatility suggests scores
alike on both, and one that fell further scores worse on drawdown.

| Volatility (annualised) | Largest fall | Sub-score | Class boundary it marks |
|---:|---:|---:|---|
| 0% | 0% | 100 | |
| 0.5% | 0.62% | 85.5 | 1 / 2 |
| 5% | 6.07% | 71.5 | 2 / 3 |
| 12% | 13.96% | 57.5 | 3 / 4 |
| 20% | 22.17% | 43.5 | 4 / 5 |
| 30% | 31.34% | 29.5 | 5 / 6 |
| 80% | 63.31% | 14.5 | 6 / 7 |
| 160% | 86.54% | 0 | |

`PRICE_CURVES` in `v1.ts` writes these out, and a test recomputes them from the bands. The EU's own
figure is a VaR-equivalent volatility that counts fat tails, usually at or above plain volatility, so
an asset's class on an EU document can be higher than here; the page says so. The bands keep classes
1 and 2 for volatility under 5%, which no asset this site rates reaches, and class 6 spans 30–80%, so
on this site the classes gather at the top (validation write-up §7). Within a class, the score tells
assets apart: the cap rule holds it at the price-behaviour score, not at the top of the class (D98,
§5 item 4).

**Every part is shown:** each dimension's raw value, its sub-score, its weight, the window, the
source, the as-of date, and whether the stability rule (§5) is holding the class. A reader can
recompute the score.

**Recent volatility, shown but not scored:** 90-day annualised volatility appears beside the rating
as context, because it reacts faster than the one-year figure. It never changes the class.

## 3. Crypto coins

**Universe:** coins in the app's catalog, excluding stablecoins (facts only, D92), tokenized
securities (USDY; TS-1, TS-3), and coins whose supply is adjusted to steer their price, named in
`v1.ts` (`rebasingCoins`: Ampleforth; D99). Their price movement does not measure what it measures for
other coins. **A coin must have at least 365 days of daily prices** to be rated; younger coins show
"Not enough history to rate (needs one year of prices)". **And it must have traded:** a coin with a
median daily volume of zero over the 30-day volume window is not rated, because its price is not a
market's (D99, `tradedAboveUsd`). Venus BUSD, a lending receipt for a retired stablecoin, reported no
volume on any of the 365 days to 2026-10-10, and one bad price gave it 282% volatility. A coin with no
volume figure at all is a different case: liquidity is missing and the coverage floor (§5) decides.

| Dimension | Weight | Input | Window | Source |
|---|---:|---|---|---|
| Volatility | 0.30 | Annualised standard deviation of daily log returns (sample, × √365) | 365 days | CoinGecko daily history (`market_chart`, keyless) |
| Drawdown | 0.20 | Largest peak-to-trough fall in daily closes | 365 days | same |
| Liquidity | 0.25 | Median daily dollar volume, and median daily volume ÷ market cap (turnover); the stronger of the two | 30 days | same (volume across all exchanges) |
| Scale | 0.25 | Market capitalisation | latest daily | same |

**One source, one request (2026-10-10).** CoinGecko's daily chart carries the closes, the volume
across all exchanges and the market cap together, so a coin's rating is one request. Not
`/live-data/ohlcv`: its candles cost two CoinGecko requests and carry no market cap, and until
2026-10-13 it asked Binance first, whose volume is one exchange's while liquidity measures the
total. There is no fallback, because without CoinGecko's volume and market cap, liquidity
and scale would both be missing, below the 70% coverage floor (§5), so a second price source could
not produce a rating. That makes coin ratings single-sourced, a D21 gap recorded here rather than
chased now. The free tier serves exactly 365 daily closes, which is exactly the minimum: a day missing
from CoinGecko's data leaves a coin unrated until it ages out.

**Curves** (value → sub-score; straight lines between points, flat beyond the ends):

| Dimension | Points |
|---|---|
| Volatility (annualised) | The shared price curve (§2) |
| Drawdown | The shared price curve (§2) |
| Turnover (median volume ÷ cap) | 0.05% → 10 · 0.5% → 40 · 2% → 75 · 5% → 90, **flat above 5%** |
| Median dollar volume | $10M → 10 · $100M → 35 · $1B → 60 · $10B → 80 · $30B → 90 (capped at 30 under $10M) |
| Scale | $0.5B → 25 · $2B → 45 · $10B → 65 · $50B → 80 · $200B → 90 · $1T → 95 |

**Turnover is a floor, not a reward.** Index providers use it as a minimum (CME CF: 0.05%), and very
high turnover is a sign of wash trading (survey §1.4), so the curve gives no extra credit above 5% and
starts at the CME CF floor. **Medians, not means**, so one spike cannot dominate. The page states that
reported crypto volume is not vetted.

**Dropped from the engine as it stands** (`profiles/cryptoAsset.ts` 1.0.0): news sentiment (a keyword
match that moves with the news cycle) and the 30-day trend (a momentum signal; Weiss keeps trend in a
separate reward index, not in risk).

## 4. Stocks

**Universe:** the 79 stocks in the curated catalog (`equityCatalog.ts`). Other tickers show facts
only, and the page says so. **A stock must have at least one year of daily prices** to be rated, and
reported trading over the last 30 trading days (the coins' rule, D99).

| Dimension | Weight | Input | Window | Source |
|---|---:|---|---|---|
| Volatility | 0.25 | Annualised standard deviation of daily log returns (sample, × √252) | 1 year | Daily closes (`/live-data/security-ohlcv`: Tiingo, then FMP; keyed) |
| Drawdown | 0.20 | Largest peak-to-trough fall in daily closes | 1 year | same |
| Liquidity | 0.20 | Median daily dollar volume (close × volume) | 30 trading days | same |
| Size | 0.15 | Market capitalisation | latest | Catalog reference figure, shown with its date (the quote ladder carries no market cap) |
| Fundamentals | 0.20 | Long-term debt ÷ shareholders' equity, and net margin (net income ÷ revenue), averaged | latest annual filing (within 15 months) | SEC XBRL company facts (`/live-data/company-facts`, keyless) |

**Where the stock figures come from (2026-10-10).** The rating reads the app's own routes, so each
figure matches what the stock page shows: daily candles from `/live-data/security-ohlcv` and the
filing from `/live-data/company-facts`. That route takes income and revenue from the latest full
fiscal year and debt and equity from the latest balance sheet (a 10-K or 10-Q); the 15-month rule
applies to the fiscal year. Size uses the catalog's reference market cap because no source the app
uses quotes one. The figure is dated on the panel, and on this coarse curve a few months' drift
rarely moves the sub-score. A company with no usable SEC filing is rated without fundamentals, with
the reason shown; SEC being unreachable is not rated at all, so a passing outage never becomes the
week's stored reading.

**Curves:**

| Dimension | Points |
|---|---|
| Volatility (annualised) | The shared price curve (§2) |
| Drawdown | The shared price curve (§2) |
| Median dollar volume | $0.1M → 10 · $1M → 45 · $10M → 75 · $50M → 90 · $500M → 98 |
| Size | $50M → 10 · $300M → 40 · $2B → 65 · $10B → 82 · $200B → 95 |
| Debt ÷ equity | 0.25 → 92 · 0.75 → 80 · 1.5 → 60 · 3 → 35 · 6 → 12 |
| Net margin | −30% → 10 · −5% → 35 · 2% → 60 · 10% → 80 · 25% → 95 |

**Fundamentals rules:**
- **Financial companies are left out of this dimension** (the catalog's Financials sector: banks,
  insurers, brokers). Debt ÷ equity does not describe a lender's balance sheet. The dimension is
  marked "not applied to financial companies" and the weights renormalise over the other four.
- **Negative shareholders' equity** makes debt ÷ equity meaningless: that half scores 15, with the
  reason shown.
- **No filing within 15 months:** the dimension is missing, with the reason shown.
- These are two **components** of the standard financial-strength models, not a validated model
  themselves, and the page calls them that. Altman's Z-score is the candidate for v2.

**Changes from the engine as it stands** (`profiles/equity.ts` 1.0.0): the bid/ask spread is dropped
(no source the app may use publishes one), and beta is shown as evidence with its R² and standard
error against SPY, but not scored.

**Data dependency (D21):** daily closes need a Tiingo or FMP key. With neither, the stock is not
rated, because volatility and drawdown are required (§5). It degrades to facts, not to a guess.

## 5. How the score becomes a class

1. **Required inputs.** Volatility and drawdown must both be present, which the one-year history
   rule ensures. Without them the asset is not rated. Nor is an asset whose median daily volume over
   the volume window is zero (§3, D99): "No trading reported over the last 30 days, so there is no
   market price to measure."
2. **Coverage.** Other missing dimensions are dropped and the weights renormalise over the rest,
   provided the dimensions present carry **at least 70% of the weight**. Below that: "Not enough data
   to rate this asset", with the facts available.
3. **Weighted score.** The weighted mean of the sub-scores present.
4. **Cap rule (the other parts cannot outweigh price risk).** The **core score** is the weighted
   mean of volatility and drawdown alone (0.60/0.40 for coins, 0.56/0.44 for stocks, their relative
   weights). The final score may not be **higher than the core score**: if it would be, it is lowered
   to the core score. For example, a coin whose price behaviour scores 32.9 scores at most 32.9,
   however large and deeply traded it is. The other parts (liquidity and scale for coins; liquidity,
   size and fundamentals for stocks) can lower the score and the class but never raise either above
   what price behaviour alone shows (D97, D98). Both scores are rounded to one decimal before they are
   compared, and each class is the class of a score as shown. The draft let the other parts raise the
   class by one, which lifted every coin in the first sanity reading; D97 removed that lift but still
   let them raise the score to the top of the core's class, which held almost every asset at one score
   per class (§8). After S&P's practice of letting secondary factors only hold or lower a result.
5. **Class from score**, using the table in §2.
6. **Stability rule (after the EU's four-month rule).** Scores are recomputed daily and recorded
   weekly. The **class shown changes only when the class computed at every weekly reading over the
   past 16 weeks lies outside the class shown**; it then moves to the class matched at most of those
   readings. A new rating starts at its current class. The score itself is always current, and the
   page says when the stability rule is holding the class ("Class held at 4 by the stability rule;
   today's score alone would be class 5"). The readings are kept in the `asset_rating_readings`
   table (migration 0007), under three rules: a week's reading is the **first** rating computed
   that week (Monday to Sunday, UTC), and is never rewritten; the 16 weeks must be **consecutive**,
   so a week with no reading holds the class rather than helping it move; and only readings under
   the **current methodology version** count, so a new version starts every asset at its current
   class.
7. **Recompute schedule.** Once a day from the previous day's daily data, shown "as of" that date.
   Never intraday, never on a price move, never as a notification. Both routes drop anything dated
   today (UTC), so every computation during a day reads the same inputs. Coin ratings are also
   cached for the day (one CoinGecko request per coin per day). Stock ratings are recomputed on
   each request instead, because Tiingo's Starter terms (§1.6(a)) bar keeping its data past the
   calculation. Their result does not change within a day either, since the inputs stop at
   yesterday.

## 6. What the page says

The wording follows the regulators' phrasing (survey §2, item 9) and FINRA Rule 2214's elements:

- "A guide to the level of measured price risk compared with other assets on this site, on a scale
  of 1 (lowest) to 7 (highest)."
- "Based on past prices and filings, which may not be a reliable indication of the future. It
  changes as new data arrives."
- "The lowest class does not mean risk free."
- "The same for everyone who views this page. It does not use anything about you, and it is not a
  recommendation to buy, sell or hold."
- What it does not assess (the list in §1), and that reported crypto volume is not vetted.
- The universe: which assets are rated, and why the others are not (stablecoins, tokenized
  securities, coins whose supply steers their price, no reported trading, too little history, stocks
  outside the catalog, missing data).
- Where the numbers come from (D97): "Volatility and drawdown use one set of curves for coins and
  stocks, worked out from the EU's PRIIPs risk bands so that volatility alone lands in the class whose
  band holds it. The EU's own figure counts sharp falls more heavily, so an asset's EU class can be
  higher. The weights and the other curves are Finance Now's choice; no published source supports any
  particular weights."
- The methodology **version** and date; and once ratings have been shown for a year, their track
  record (how well each class matched the volatility and drawdown that followed).

## 7. The memo's checklist (§6 of the risk-ratings memo), mapped

| §6 item | Where it is met |
|---|---|
| 1. The method on the page | The rating panel and the methodology section, both rendered from `v1.ts` |
| 2. Limits, and that results change | §6 wording |
| 3. The universe | §6 wording; §3 and §4 rules |
| 4. Same for every reader | §6 wording |
| 5. No suitability words | §2 labels; a test fails on "conservative", "aggressive", "suitable", "safe" or "recommend" in the rating's copy |
| 6. Provenance | Source and as-of date on the panel |
| 7. Not timed | §5 items 6 and 7 |
| 8. No paid interest | No paid placement (D49); the owner's holdings policy (§11, parked until before anything is shown) on the methodology page |
| 9. The not-advice text | The existing crypto line on crypto pages, and a short line beside the rating; wording reviewed with T-291 |

## 8. Validation before anything is shown

The build is not finished until these have run and their results are written up (survey §3):

1. **Sanity ordering:** large stable stocks should rate in the low classes, small or meme coins in the
   high ones; any surprise is investigated before launch.
2. **Backtest:** compute the score at past dates and check its rank correlation with the volatility
   and drawdown over the following 6 and 12 months.
3. **Sensitivity:** move each weight and each curve point ±20% and count how many assets change class.
4. **Stability:** count how often the shown class changes month to month, with and without the
   stability rule.
5. **The weights and curves are then confirmed or changed by the owner**, and the result recorded as
   the final v1 numbers. No source supports any particular weights; the page says they are Finance
   Now's choice. ✅ **2026-10-11 (D97):** the price curves changed to the shared EU-derived set (§2),
   the lift went (§5 item 4), and the weights and other curves stayed; recorded as `v1 (2026-10-11)`.

### The full run, 2026-10-10 (items 1–4)

Written up in `docs/assessments/risk-ratings-validation-2026-10-10.md`, from `npm run ratings:validate`
(`frontend/scripts/validate-ratings.ts`; reads only, stores nothing). In short:

1. **Sanity:** the order within each asset class is mostly sensible, but the level is too low for
   stocks as well as coins: against the class each asset's volatility would get on the EU PRIIPs scale
   (indicative, a lower bound), coins sit 2.35 classes lower on average and stocks 3.21. Variants A
   (one set of price curves) and C (no lift) together put 53 of 55 coins within one class of that band.
   vBUSD (untraded, rated on a pricing glitch) and Ampleforth (supply steers its price) should not be
   rated.
2. **Backtest:** scores at past quarter starts ranked later volatility at about −0.75 (Spearman) for
   stocks and coins; price behaviour alone ranked it slightly better than the full stock score; one set
   of curves orders coins against stocks better (−0.93 against −0.89).
3. **Sensitivity:** no weight or curve point moved ±20% changes more than 9 of 55 coins or 7 of 58
   stocks; 38 of 65 parameters change nothing.
4. **Stability:** the 16-week rule cuts class changes from 0.96 to 0.56 a year for stocks and from
   0.89 to 0.35 for coins.

Item 5, the owner's confirmation or change of the numbers, was open at the time; the write-up's §6 set
out the four decisions and recommended the EU-aligned reading of the scale. Decided 2026-10-11 (D97),
below.

**EU-tuned curves, tested the same evening (write-up §7).** One shared set of volatility and drawdown
curves derived from the PRIIPs band edges (variant B), with no lift from size and liquidity (C), puts
every rated coin and stock within one class of its PRIIPs band (mean gaps −0.05 for coins, 0.29 for
stocks) and keeps the ordering (stocks −0.76, coins −0.75, pooled −0.93). Bitcoin rates 6, as in the
regulated Bitcoin fund's own document; Apple 4. The cost is a compressed scale on this site: no asset in
classes 1 or 2, and 39 of 55 coins in class 7. It is the variant recommended for the EU-aligned reading.

### The owner's decision, 2026-10-11 (item 5, D97)

The owner adopted the recommendation: the EU-aligned reading, with B and C. In `v1.ts` the volatility
and drawdown curves of both asset classes became `PRICE_CURVES` (§2), `capClassesAboveCore` went from 1
to 0 (§5 item 4), `provisional` became false, and the version became `v1 (2026-10-11)`. The weights,
the other curves and every other rule are unchanged. The two readings stored under the draft stop
counting; nothing was removed. The universe question (vBUSD, Ampleforth; write-up §6 item 3) was not
part of it; it was decided the same day (D99, §3, §11).

### Confirmation run, 2026-10-11

The validation re-run on the adopted method (write-up §8) reproduces §7's results:
- **Coins:** all 55 within one class of their PRIIPs band, mean gap −0.07.
- **Stocks:** all 58 rated stocks within one class, mean gap 0.29.
- **Ordering:** stocks −0.76, coins −0.75, coins and stocks pooled −0.93.
- **Stability:** stocks change class 0.58 times a year with the 16-week rule.

**It also found that the cap rule now sets almost every score.** It holds the score of every rated
stock and 49 of 55 coins at the top of the price class, because large, deeply traded assets score high
on liquidity and size. So Bitcoin, Ethereum, Solana and Dogecoin all score 29, and the liquidity, size
and fundamentals weights move no stock's class. Classes are unaffected. The option it raised, to
lower an over-high score to the price score rather than to the top of its class, was decided the same
day (D98, below).

### The owner's decision on the score, 2026-10-11 (D98)

The owner adopted the recommendation: an over-high score is lowered to the price score itself (§5
item 4). The version stays `v1 (2026-10-11)`: the decision came before that version merged or stored a
reading (the readings table held only the draft's two). Classes do not change, with one exception
the rule had to settle. D97 put the price score in a class by its unrounded value but showed it
rounded, so a price score of 85.96 showed as 86.0, which starts class 1, and was filed in class 2.
Capping at that score would carry the 86.0 into the final score. Both scores are now rounded before
they are compared or classed, so a class is always the class of the number shown.
`__tests__/assetRating.test.ts` checks the rule on 4,000 generated assets against D97's.

**Re-run on it, 2026-10-11 (write-up §9).**
- **Classes:** all 113 rated assets keep their class, compared asset by asset with the confirmation
  run. None was in the rounding case.
- **Scores:** 111 are held at their price score, so scores differ within a class again (Bitcoin 23.6,
  Ethereum 17.8, Solana 15.4, Dogecoin 15.6). Five rose a little, because D97's ceiling was a whole
  number below their price score (Polygon 14 to 14.8, for instance).
- **Ordering:** the stocks' full score now ranks later volatility as well as price alone, −0.80 over
  6 months (was −0.76).
- **Stability:** unchanged with the 16-week rule. Without it, the rounding rule moved a few past weekly
  readings (stocks 228 class changes instead of 230, coins 15 instead of 13).
- **The other parts:** for 111 of the 113, liquidity, size, scale and fundamentals now change neither
  class nor score; they act only on an asset weak on them (Maker, class 6 on price alone, rates 7).

**The universe (D99), re-run the same evening (write-up §10).** Ampleforth leaves the universe and
vBUSD is not rated, with the reason. Nothing else moved:
- coins: 53 of 53 within one class of their PRIIPs band, mean gap −0.09;
- every other asset keeps its class and score;
- the backtest and stability are unchanged, since neither token had the Binance history they use.

### First sanity reading, 2026-10-10 (item 1, partial)

The end-to-end check after migration 0007 ran on the owner's machine, under `v1 (draft, 2026-10-09)`,
on data to 2026-10-09. Bitcoin and Apple went through the routes and stored this week's readings, two
rows; the other coins ran through the same engine in memory only, from CoinGecko's daily chart.
Chainlink was skipped when CoinGecko's free tier refused the request (HTTP 429).

| Asset | Class (label) | Score | Price behaviour alone (class) | Volatility | Largest fall | Price behaviour alone, on the **stock** curves |
|---|---|---:|---:|---:|---:|---|
| Bitcoin | 2 (Low) | 81.3 | 70 (3) | 44% | 49% | 45.9, class 4 |
| Ethereum | 3 (Moderately low) | 71 | 57 (4) | 62% | 63% | 29.9, class 6 |
| Solana | 3 (Moderately low) | 69 | 52.6 (4) | 66% | 70% | 25.3, class 6 |
| Dogecoin | 3 (Moderately low) | 65.5 | 52.8 (4) | 68% | 68% | 25.3, class 6 |
| Cardano | 4 (Moderate) | 57 | 42 (5) | 79% | 80% | 19.4, class 6 |
| Apple | 1 (Very low) | 88 | 81 (2) | 25% | 14% | (already the stock curves) |

**Finding: the coins rate far lower than this note expects.** Every coin lands in classes 2–4, and
Dogecoin, a meme coin, shares Ethereum's class. §2 expects most coins in classes 5 to 7, and a regulated
Bitcoin fund's own EU document puts Bitcoin at 6 of 7. For comparison only, since both regulators
measure differently from this rating (the UCITS indicator uses five years of weekly volatility, the
PRIIPs indicator a VaR-equivalent volatility that counts fat tails; survey §1.1): the PRIIPs scale puts
30–80% in class 6 and 20–30% in class 5, and the UCITS scale puts 25% and above in class 7. Apple at
class 1, "Very low", needs the same check.

**Cause, in two parts:**
1. **Coins are scored on gentler curves than stocks.** The class boundaries are shared, but each asset
   class turns volatility and drawdown into a sub-score with its own curve, and the coin curves are far
   more lenient: 44% volatility scores 79 on the coin curve and about 54 on the stock curve. Shared
   boundaries do not make the "one absolute scale" §2 promises when the curves differ. On the stock
   curves, Bitcoin's price behaviour alone would be class 4 and the other four coins' class 6.
2. **Size and liquidity then lift each coin one class.** They carry half a coin's weight, and the cap
   rule (§5 item 4) allows exactly a one-class lift over price behaviour alone. Every coin above took it.

**Not acted on.** The weights and curves are parked until this validation is written up (§11, D95), so
no number changed. The options for the owner then: (a) one set of price curves for coins and stocks,
which restores §2's one absolute scale; (b) re-tune the coin curves against the regulators' bands;
(c) tighten the cap rule so size and liquidity cannot lift the class; and in each case check Apple's
class 1 against the same bands. The two stored readings are under the draft version, so they stop
counting once the numbers change and the version moves on; nothing needs removing.

## 9. The build (started 2026-10-09)

1. ✅ `lib/risk/methodology/v1.ts`: every number and rule in §2–§5, with its version.
2. ✅ The engine, `lib/risk/assetRating.ts`, reading only `v1.ts`, with the cap and stability rules
   and tests that recompute ratings by hand (`__tests__/assetRating.test.ts`). Built as a new file
   rather than a rework of `profiles/cryptoAsset.ts` and `profiles/equity.ts`: nothing imports
   those two, and removing them is the owner's call, so they stay until then.
3. ✅ The `asset_rating_readings` table for the weekly readings (`lib/db/schema/ratings.ts`,
   migration `drizzle/0007_asset-rating-readings.sql`), and `lib/risk/ratingReadings.ts`, which
   turns an asset's stored readings into the stability rule's input and the row to store
   (`__tests__/ratingReadings.test.ts`). ⚠ **Run `npm run db:migrate` on the owner's machine**;
   nothing reads the table until item 4, so nothing changes before then.
4. ✅ A daily rating route for each class: `/live-data/coin-rating?id=` and
   `/live-data/stock-rating?symbol=`. `lib/risk/ratingInputs.ts` decides the universe and turns the
   feeds into the engine's inputs, `lib/server/ratingStore.ts` loads and stores the weekly readings,
   and `lib/server/assetRatingRoute.ts` holds what the two share (`__tests__/ratingInputs.test.ts`,
   `lib/server/__tests__/assetRatingRoutes.test.ts`). An outage answers 503 and is never cached or
   stored; a missing key or filing is answered, with the reason. ⚠ The database part is not yet run
   against Postgres: it needs migration 0007 (`npm run db:migrate`) on the owner's machine.
5. ✅ The rating panel on `/assets/[id]` and `/equities/[symbol]` (`components/markets/AssetRatingPanel.tsx`)
   and the methodology page at `/about/risk-ratings` (`components/legal/RatingMethodology.tsx`), both
   rendered from `v1.ts` and `lib/risk/ratingCopy.ts`, which holds the §1, §5 and §6 wording with
   every number read from `v1.ts`. The panel shows the class under "Measured risk: Class N of 7" on a
   1–7 row with the class marked (neutral colour, as on the EU's indicator), the held-class and
   cap-rule sentences when they apply, every part with its raw figure, sub-score, weight, window and
   source, the as-of date, and the §6 disclosures. Tests render both with ratings from the real
   engine (`__tests__/assetRatingPanel.test.tsx`) and fail on a suitability word anywhere in the
   rating's copy except the not-a-recommendation sentence (`__tests__/ratingCopy.test.ts`). The
   holdings policy (§11) shows as not yet written.
6. ✅ **A new switch, `ASSET_PAGE_RATINGS_SHOWN = false`** (`lib/risk/visibility.ts`), separate from
   D64's `RISK_RATINGS_SHOWN`, which keeps governing the surfaces D92 ruled out. While it is false the
   panel renders nothing and mounts nothing, the methodology page answers 404, and the two routes
   answer only on the owner's machine (a localhost request) or to `FN_ADMIN_TOKEN`, through the guard
   the AI routes use, so the §8 validation can run locally while a deployed build stays closed.
   `__tests__/assetRatingsHidden.test.ts` holds all of that, that no `/api/v1` route, MCP tool or
   agent tool reads a rating, and that the switch cannot be on while the holdings policy is unwritten.
7. ✅ The validation in §8, written up: `docs/assessments/risk-ratings-validation-2026-10-10.md`,
   re-runnable with `npm run ratings:validate`, which now compares the method with the first draft it
   replaced. Item 5, the owner's decision, was taken on 2026-10-11 (D97) and is in `v1.ts`.

Shown only after counsel confirms the form (D4; the memo's §8, questions 1, 2 and 6), the holdings
policy is written (§11), and the owner says so.

## 10. Candidates for v2

Possible with free data, deliberately not in v1: trading age as a scored factor (Kaiko's bands);
number of exchanges and the share of volume on the top two (from CoinGecko's tickers); free float
(circulating ÷ total supply); Amihud's illiquidity ratio; Altman's Z-score for stocks.

## 11. Owner decisions

**Decided:** the class labels (§2), on 2026-10-07 (D95). The numbers, on 2026-10-11 (D97): the
EU-aligned reading of the scale, one set of price curves for coins and stocks derived from the PRIIPs
bands (§2), no lift from the other parts (§5 item 4), and the weights and other curves as they were.
The score under the cap rule, the same day (D98): held at the price score itself, not at the top of
its class (§5 item 4, §8).

The universe, the same day (D99): no rating for an asset with no reported trading over the volume
window, which leaves out vBUSD, and Ampleforth left out by name as a coin whose supply steers its price
(§3). Chosen over re-filing both as stablecoins in the catalog, which would call neither what it is
and would count and filter both as stablecoins on the Coins page.

**Parked on 2026-10-07 (D95), each with what brings it back:**
1. ~~**The final weights and curves.**~~ **Decided 2026-10-11 (D97), above.** Parked until the validation in §8 has run and been written up;
   that write-up is the point to confirm or change them. Until then the numbers in §3 and §4 stand
   as the provisional v1. ⚠ The first sanity reading (§8, 2026-10-10) already shows the coin curves
   cannot stand as they are: they rate Bitcoin class 2 and Dogecoin class 3. **Ready for decision
   since 2026-10-10:** the full validation is written up (`docs/assessments/risk-ratings-validation-2026-10-10.md`),
   and its last section sets out what to decide: what the scale means (EU-aligned or relative to this
   site), the curves (for the EU-aligned reading, the tested variant is B and C: shared curves derived
   from the PRIIPs bands, and no lift), the universe (vBUSD, Ampleforth), and the role of size,
   liquidity and fundamentals.
2. **The holdings policy** (the memo's §6, item 8): a written policy on the owner's own holdings and
   trading in rated assets, for the methodology page. Parked until before anything is shown: it is a
   precondition of turning `ASSET_PAGE_RATINGS_SHOWN` on, alongside counsel's confirmation (D4).

## Changelog

- **v1 draft, 2026-10-07:** first outline, from `profiles/cryptoAsset.ts` and `profiles/equity.ts`
  1.0.0 and the memo's §5.1, §5.3 and §6.
- **v1 draft, second revision, 2026-10-07 (D94):** adopted the survey's changes: a 1–7 class as the
  headline over the 0–100 score; one absolute scale for coins and stocks; one-year windows for both,
  with 90-day volatility shown unscored; the 16-week stability rule; turnover as a saturating floor and
  30-day medians; a one-year minimum history; the cap rule; financial companies left out of the
  fundamentals dimension; regulator-style disclosure wording and a published version and track record;
  validation before anything is shown.
- **2026-10-07 (D95):** class labels decided (Very low … Very high, under the heading "Measured risk:
  Class N of 7"); the final weights and curves parked until validation, and the holdings policy parked
  until before anything is shown.
- **2026-10-09:** the numbers in §2–§5 moved into `lib/risk/methodology/v1.ts`, which is now the
  single source; this note describes them and must change with it. No number changed.
- **2026-10-09:** §5 item 6 now states how weekly readings are kept: the first rating of each week,
  16 consecutive weeks, and only readings under the current version. These settle questions the
  rule left open; they change no number.
- **2026-10-10:** the sources as built (§3, §4, §5 item 7). Coins read CoinGecko's daily chart
  alone, not `/live-data/ohlcv` with a Binance.US fallback, because Binance's volume is one
  exchange's. Stock size uses the catalog's dated reference market cap, because the quote ladder
  carries none, and debt and equity come from the latest balance sheet. Stock ratings are not cached
  across requests, under Tiingo's terms. The two `source` labels in `v1.ts` changed to match; no
  number changed.
- **2026-10-10:** the panel and the methodology page built (§9 item 5), hidden. The page's wording
  is this note's §1, §5 and §6, with the regulators' phrasing kept; no number changed.
- **2026-10-10:** first sanity reading recorded (§8): coins rate in classes 2–4, far below §2's
  expectation, because the coin curves are gentler than the stock curves and size and liquidity lift
  each coin a class. Recorded, not acted on; no number changed.
- **2026-10-10:** the full §8 validation run and written up (items 1–4): good ordering, a level too
  low for stocks and coins against the EU scale, robust to ±20% changes, the stability rule halving
  class changes. The owner's decision (item 5) is open; no number changed.
- **2026-10-10:** EU-tuned curves tested (validation write-up §7): shared curves derived from the
  PRIIPs bands, with no lift, line up coins and stocks with the regulators' scale and keep the
  ordering, at the cost of a compressed scale. Tested, not adopted; no number changed.
- **v1, 2026-10-11 (D97):** the numbers decided. The volatility and drawdown curves for coins and
  stocks are now one set derived from the PRIIPs bands (§2, §3, §4); the other parts can lower a
  class but never raise it (§5 item 4, was one class); the method is no longer provisional. The
  weights and the other curves are unchanged. Version `v1 (2026-10-11)`, replacing
  `v1 (draft, 2026-10-09)`.
- **2026-10-11:** confirmation run recorded (§8): the adopted method reproduces the tested results, and
  the cap rule holds the score of every rated stock and most coins at the top of the price class. The
  question this raises about the headline score is open (§11); no number changed.
- **v1, 2026-10-11 (D98):** the cap rule holds an over-high score at the price score itself, not at
  the top of its class (§5 item 4), and both scores are rounded before they are compared or classed.
  No class changes except where a price score within 0.05 under a class line was shown as the start
  of the class above while filed below it; none of the rated assets was, and the re-run (§8) found all
  113 classes unchanged. Version unchanged: nothing had merged or been stored under `v1 (2026-10-11)`.
- **v1, 2026-10-11 (D99):** the universe. An asset with a median daily volume of zero over the
  volume window is not rated (`tradedAboveUsd`), which leaves out vBUSD, and coins whose supply
  steers their price are left out by name (`rebasingCoins`: Ampleforth) (§3, §4, §5 item 1). Version
  unchanged, for the same reason as D98.
- **2026-10-13 (T-423):** the validation's coin backtest and stability read DefiLlama's daily closes
  (`/live-data/ohlcv`, `source=defillama`) instead of Binance.US closes, which the app no longer
  fetches. A re-run of §8 therefore reads a different price history for coins than the 2026-10-10
  and 2026-10-11 runs did; DefiLlama's is a price across markets, not one exchange's. The rating
  itself is unaffected: it reads CoinGecko's daily chart, as before. No number changed.
