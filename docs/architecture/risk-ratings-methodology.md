# Risk ratings methodology, v1 (draft for the owner)

**Status: DRAFT v1, second revision, 2026-10-07.** T-420 item (1). This revision adopts every change
proposed in `docs/assessments/risk-rating-methods-survey-2026-10-07.md` §3 (owner, 2026-10-07:
*"adopt all the proposed changes and update the draft"*; D94). Nothing is built yet, and nothing
built from it is shown until counsel confirms the form and the owner says so (D92, D4). The weights
and curves are Finance Now's choices and remain provisional until the validation in §8 has run.

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

**Every part is shown:** each dimension's raw value, its sub-score, its weight, the window, the
source, the as-of date, and whether the stability rule (§5) is holding the class. A reader can
recompute the score.

**Recent volatility, shown but not scored:** 90-day annualised volatility appears beside the rating
as context, because it reacts faster than the one-year figure. It never changes the class.

## 3. Crypto coins

**Universe:** coins in the app's catalog, excluding stablecoins (facts only, D92) and tokenized
securities (USDY; TS-1, TS-3). **A coin must have at least 365 days of daily prices** to be rated;
younger coins show "Not enough history to rate (needs one year of prices)".

| Dimension | Weight | Input | Window | Source |
|---|---:|---|---|---|
| Volatility | 0.30 | Annualised standard deviation of daily log returns (sample, × √365) | 365 days | CoinGecko daily history (`/live-data/ohlcv`, keyless; Binance.US fallback) |
| Drawdown | 0.20 | Largest peak-to-trough fall in daily closes | 365 days | same |
| Liquidity | 0.25 | Median daily dollar volume, and median daily volume ÷ market cap (turnover); the stronger of the two | 30 days | CoinGecko markets / history |
| Scale | 0.25 | Market capitalisation | latest daily | CoinGecko markets |

**Curves** (value → sub-score; straight lines between points, flat beyond the ends):

| Dimension | Points |
|---|---|
| Volatility (annualised) | 30% → 90 · 50% → 75 · 80% → 55 · 120% → 35 · 200% → 15 |
| Drawdown | 20% → 90 · 35% → 75 · 50% → 55 · 70% → 35 · 85% → 15 |
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
only, and the page says so. **A stock must have at least one year of daily prices** to be rated.

| Dimension | Weight | Input | Window | Source |
|---|---:|---|---|---|
| Volatility | 0.25 | Annualised standard deviation of daily log returns (sample, × √252) | 1 year | Daily closes (`/live-data/security-ohlcv`: Tiingo, then FMP; keyed) |
| Drawdown | 0.20 | Largest peak-to-trough fall in daily closes | 1 year | same |
| Liquidity | 0.20 | Median daily dollar volume (close × volume) | 30 trading days | same |
| Size | 0.15 | Market capitalisation | latest | Quote ladder / catalog |
| Fundamentals | 0.20 | Long-term debt ÷ shareholders' equity, and net margin (net income ÷ revenue), averaged | latest annual filing (within 15 months) | SEC XBRL company facts (`/live-data/company-facts`, keyless) |

**Curves:**

| Dimension | Points |
|---|---|
| Volatility (annualised) | 15% → 95 · 25% → 78 · 40% → 58 · 60% → 38 · 80% → 22 · 120% → 8 |
| Drawdown | 10% → 90 · 20% → 75 · 35% → 55 · 50% → 35 · 70% → 15 |
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
   rule ensures. Without them the asset is not rated.
2. **Coverage.** Other missing dimensions are dropped and the weights renormalise over the rest,
   provided the dimensions present carry **at least 70% of the weight**. Below that: "Not enough data
   to rate this asset", with the facts available.
3. **Weighted score.** The weighted mean of the sub-scores present.
4. **Cap rule (size and liquidity cannot outweigh price risk).** The **core score** is the weighted
   mean of volatility and drawdown alone (0.60/0.40 for coins, 0.56/0.44 for stocks, their relative
   weights). The final score may not sit more than **one class better** than the core score's class:
   if it would, it is lowered to the highest score of the class one better than the core's. For
   example, a core score in class 5 (30–43) caps the final score at 57, the top of class 4. Large size and deep trading can improve
   the rating by at most one class over what price behaviour alone shows; they can always lower it.
   (After S&P's practice of letting secondary factors only hold or lower a result.)
5. **Class from score**, using the table in §2.
6. **Stability rule (after the EU's four-month rule).** Scores are recomputed daily and recorded
   weekly. The **class shown changes only when the class computed at every weekly reading over the
   past 16 weeks lies outside the class shown**; it then moves to the class matched at most of those
   readings. A new rating starts at its current class. The score itself is always current, and the
   page says when the stability rule is holding the class ("Class held at 4 by the stability rule;
   today's score alone would be class 5"). Storing the weekly readings needs a database table, added
   with the build.
7. **Recompute schedule.** Once a day from the previous day's daily data, cached 24 hours, shown "as
   of" that date. Never intraday, never on a price move, never as a notification.

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
  securities, too little history, stocks outside the catalog, missing data).
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
   Now's choice.

## 9. The build (started 2026-10-09)

1. ✅ `lib/risk/methodology/v1.ts`: every number and rule in §2–§5, with its version.
2. ✅ The engine, `lib/risk/assetRating.ts`, reading only `v1.ts`, with the cap and stability rules
   and tests that recompute ratings by hand (`__tests__/assetRating.test.ts`). Built as a new file
   rather than a rework of `profiles/cryptoAsset.ts` and `profiles/equity.ts`: nothing imports
   those two, and removing them is the owner's call, so they stay until then.
3. A database table for the weekly readings the stability rule needs (a migration the owner runs).
4. A daily rating route for each class, cached 24 hours.
5. The rating panel on `/assets/[id]` and `/equities/[symbol]`, and the methodology section, rendered
   from `v1.ts`.
6. **A new switch, `ASSET_PAGE_RATINGS_SHOWN = false`**, separate from D64's `RISK_RATINGS_SHOWN`,
   which keeps governing the surfaces D92 ruled out. Tests hold that nothing renders, and that no API,
   MCP or agent path reads a rating, while it is false.
7. The validation in §8, written up.

Shown only after counsel confirms the form (D4; the memo's §8, questions 1, 2 and 6), the holdings
policy is written (§11), and the owner says so.

## 10. Candidates for v2

Possible with free data, deliberately not in v1: trading age as a scored factor (Kaiko's bands);
number of exchanges and the share of volume on the top two (from CoinGecko's tickers); free float
(circulating ÷ total supply); Amihud's illiquidity ratio; Altman's Z-score for stocks.

## 11. Owner decisions

**Decided:** the class labels (§2), on 2026-10-07 (D95).

**Parked on 2026-10-07 (D95), each with what brings it back:**
1. **The final weights and curves.** Parked until the validation in §8 has run and been written up;
   that write-up is the point to confirm or change them. Until then the numbers in §3 and §4 stand
   as the provisional v1.
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
