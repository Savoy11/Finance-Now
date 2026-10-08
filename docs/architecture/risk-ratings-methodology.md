# Risk ratings methodology, v1 (draft for the owner)

**Status: DRAFT, first iteration, 2026-10-07.** T-420 item (1). The owner will revise this; nothing
here is built yet, and nothing built from it is shown until counsel confirms the form and the owner
says so (D92, D4). Every number below is a proposal to be changed.

**Read with the survey.** `docs/assessments/risk-rating-methods-survey-2026-10-07.md` compares this
draft with how regulators, rating firms, crypto raters and index providers do it, and its §3 lists
the changes the research suggests (one-year windows for both classes, a stability rule, turnover as
a floor, a minimum history, a cap rule, validation before launch). This draft is unchanged until the
owner decides on them.

**How later iterations work.** The build will keep every weight, window, curve and threshold in one
file, `frontend/src/lib/risk/methodology/v1.ts`, and the public methodology section will be
rendered from that same file, so the page can never describe numbers the code does not use. A
change to the method means editing that file, bumping its version (v1 → v2), and adding a line to
the changelog at the end of this note. Ratings always show the version that produced them.

---

## 1. What D92 allows, and what this rating is

- **Where:** a rating on each crypto coin's own page and each stock's own page. Nowhere else: not
  beside a user's holdings, not on a portfolio, not in a list or ranking, not in an alert, and not
  in the API, MCP server or AI agents until that is decided separately (D77).
- **What it is:** one measurement of how much an asset's price has moved, how easily it trades,
  how large it is and (for stocks) how its balance sheet stands, combined by a fixed, published
  formula. The same for every reader; it takes no input from the user.
- **What it is not:** a recommendation, a forecast, or a judgment of whether the asset suits
  anyone. It does not assess any of the following (RP-6's list, stated on the page):
  the project's code or smart contracts, the team, custody or exchange risk, legal or regulatory
  standing, token supply schedules, accounting quality, or future prices.

## 2. The output

- **Score:** 0 to 100, **higher means lower measured risk**. This is the canonical scale the engine
  already uses (`lib/risk/types.ts`).
- **Band** (proposal, owner decision 1), from the engine's existing thresholds, renamed so that
  each label describes the measurement rather than a type of investor (memo §6, item 5):

  | Score | Engine band | Label shown |
  |---|---|---|
  | 80–100 | low | Lower measured risk |
  | 60–79 | moderate | Moderate measured risk |
  | 40–59 | elevated | Elevated measured risk |
  | 20–39 | high | High measured risk |
  | 0–19 | critical | Very high measured risk |

- **Every part shown:** each dimension's raw value (for example "90-day volatility 48%"), its
  sub-score, its weight, the data window, the source, and the date. A reader can recompute the
  score by hand.
- **Coverage:** if dimensions are missing, the score is computed from those present (weights
  renormalised, as `composeRisk` does today) **only if they carry at least 70% of the weight**
  (owner decision 5). Below that the page shows "Not enough data to rate this asset", with the
  facts that are available.

## 3. Crypto coins, v1

**Universe:** coins in the app's catalog, excluding stablecoins (facts only, D92) and tokenized
securities (USDY; TS-1, TS-3). The page says which coins are rated and why the others are not.

**Changes from the engine as it stands (`profiles/cryptoAsset.ts` 1.0.0), with reasons:**
- **News sentiment: dropped.** It is a keyword match over headlines, changes by the hour, and does
  not measure the asset. A rating that moves with the news cycle also reads as timed to market
  activity (memo §6, item 7).
- **30-day trend: dropped.** Scoring a falling price as riskier is a momentum signal, which is the
  shape of a trading call. Drawdown replaces it.
- **Volatility window: 7 days of hourly prices → 90 days of daily prices.** Seven days reacts to a
  single week; 90 days describes how the asset usually trades.

| Dimension | Weight | Input | Window | Source |
|---|---:|---|---|---|
| Volatility | 0.30 | Annualised standard deviation of daily log returns (× √365) | 90 days | CoinGecko daily history (`/live-data/ohlcv`, keyless; Binance.US fallback) |
| Drawdown | 0.20 | Largest peak-to-trough fall in daily closes | 365 days | same |
| Liquidity | 0.25 | Average daily volume ÷ market cap, and average daily volume in dollars; the stronger of the two | 30 days | CoinGecko markets |
| Scale | 0.25 | Market capitalisation | latest daily | CoinGecko markets |

**Curves** (value → sub-score; straight lines between points, flat beyond the ends):

| Dimension | Points |
|---|---|
| Volatility (annualised) | 30% → 90 · 50% → 75 · 80% → 55 · 120% → 35 · 200% → 15 |
| Drawdown | 20% → 90 · 35% → 75 · 50% → 55 · 70% → 35 · 85% → 15 |
| Liquidity, volume ÷ cap | 0.5% → 25 · 2% → 50 · 5% → 70 · 15% → 90 |
| Liquidity, dollar volume | $10M → 10 · $100M → 35 · $1B → 60 · $10B → 80 · $30B → 90 (capped at 30 under $10M) |
| Scale | $0.5B → 25 · $2B → 45 · $10B → 65 · $50B → 80 · $200B → 90 · $1T → 95 |

The volatility, liquidity and scale curves are the engine's existing ones; the drawdown curve is
new. **These are starting points, not calibrated values** (owner decision 4).

## 4. Stocks, v1

**Universe:** the 79 stocks in the curated catalog (`equityCatalog.ts`). Other tickers show facts
only, and the page says so. (Widening it needs the price history every rated stock depends on.)

**Changes from the engine as it stands (`profiles/equity.ts` 1.0.0):**
- **Bid/ask spread: dropped.** No source the app may use publishes quotes with spreads. Liquidity
  is dollar volume alone.
- **Beta:** shown as evidence next to volatility, with its R² against SPY, but **not scored**, as
  today.

| Dimension | Weight | Input | Window | Source |
|---|---:|---|---|---|
| Volatility | 0.25 | Annualised standard deviation of daily log returns (× √252) | 1 year | Daily closes (`/live-data/security-ohlcv`: Tiingo, then FMP; keyed) |
| Drawdown | 0.20 | Largest peak-to-trough fall in daily closes | 1 year | same |
| Liquidity | 0.20 | Average daily dollar volume (close × volume) | 30 trading days | same |
| Size | 0.15 | Market capitalisation | latest | Quote ladder / catalog |
| Fundamentals | 0.20 | Long-term debt ÷ shareholders' equity, and net margin (net income ÷ revenue), averaged | latest annual filing | SEC XBRL company facts (`/live-data/company-facts`, keyless) |

**Curves:**

| Dimension | Points |
|---|---|
| Volatility (annualised) | 15% → 95 · 25% → 78 · 40% → 58 · 60% → 38 · 80% → 22 · 120% → 8 |
| Drawdown | 10% → 90 · 20% → 75 · 35% → 55 · 50% → 35 · 70% → 15 |
| Dollar volume | $0.1M → 10 · $1M → 45 · $10M → 75 · $50M → 90 · $500M → 98 |
| Size | $50M → 10 · $300M → 40 · $2B → 65 · $10B → 82 · $200B → 95 |
| Debt ÷ equity | 0.25 → 92 · 0.75 → 80 · 1.5 → 60 · 3 → 35 · 6 → 12 |
| Net margin | −30% → 10 · −5% → 35 · 2% → 60 · 10% → 80 · 25% → 95 |

**Edge case (owner decision 7):** negative shareholders' equity makes debt ÷ equity meaningless.
Proposal: score that half at 15, and say why on the page.

**Data dependency (D21):** daily closes need a Tiingo or FMP key. With neither, volatility,
drawdown and liquidity are missing, coverage falls under 70%, and the stock shows "Not enough
data to rate". It degrades to facts rather than to a guess.

## 5. When it changes

- Recomputed **once a day** from the previous day's daily data, cached for 24 hours, and shown
  "as of" that date. Never intraday, never on a price move, and never as a notification (memo
  §6, item 7).
- A change of method is a new version, never a silent edit.

## 6. What the page says (memo §6, mapped)

| §6 item | Where |
|---|---|
| 1. The method on the page | The rating panel shows every dimension, value, weight, window and source; a full methodology section is rendered from `v1.ts` |
| 2. Limits, and that results change | Fixed text under the panel: built from past prices and filings only; changes as the data does; past movement does not predict future results |
| 3. The universe | The methodology section lists which assets are rated and why the others are not |
| 4. Same for every reader | Fixed text: "The same for everyone who views this page. It does not use anything about you." |
| 5. No suitability words | The band labels above; a test fails on "conservative", "aggressive", "suitable", "safe" or "recommend" in the rating's copy |
| 6. Provenance | Source and as-of date on the panel |
| 7. Not timed | Daily recompute (§5 above); no alert reads the rating |
| 8. No paid interest | No paid placement (D49). **A written policy on the owner's own holdings and trading in rated assets is the owner's to write** (owner decision 8) |
| 9. The not-advice text | The existing crypto line on crypto pages, and a short line beside the rating; wording reviewed with T-291 |

## 7. The build (for agreement, not started)

1. `lib/risk/methodology/v1.ts`: every number in §3 and §4, with its version.
2. Rework `profiles/cryptoAsset.ts` and `profiles/equity.ts` to read it (90-day volatility,
   drawdown, no news or trend, no spread), with tests that recompute a rating by hand.
3. A daily rating route for each class, cached 24 hours.
4. The rating panel on `/assets/[id]` and `/equities/[symbol]`, and the methodology section,
   both rendered from `v1.ts`.
5. **A new switch, `ASSET_PAGE_RATINGS_SHOWN = false`**, separate from D64's `RISK_RATINGS_SHOWN`,
   which keeps governing the surfaces D92 ruled out. Tests hold that nothing renders, and that no
   API, MCP or agent path reads a rating, while it is false.

Shown only after counsel confirms the form (D4, memo §8 questions 1, 2 and 6) and the owner says so.

## 8. Decisions for the owner

1. **Band labels**, as in §2, or numbers only?
2. **Windows:** 90 days of volatility for crypto, 1 year for stocks; drawdown over 1 year for both.
3. **Dropping news sentiment and the 30-day trend** from the crypto rating.
4. **Weights and curves** in §3 and §4.
5. **The 70% coverage floor.**
6. **The universes:** catalog coins (no stablecoins or tokenized securities) and the 79 catalog stocks.
7. **Negative equity** scored at 15.
8. **The holdings policy** (memo §6, item 8): yours to write; it goes on the methodology page.

## Changelog

- **v1 draft, 2026-10-07:** first outline, from `profiles/cryptoAsset.ts` and `profiles/equity.ts`
  1.0.0 and the memo's §5.1, §5.3 and §6.
