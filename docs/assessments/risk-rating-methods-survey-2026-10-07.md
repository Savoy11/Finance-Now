# How established entities rate single-asset risk: a survey for T-420 v1

**Date:** 2026-10-07. **Asked for by the owner** before the v1 methodology
(`docs/architecture/risk-ratings-methodology.md`) is settled: *"do a deep search through educational
material on this topic … consider current application by established entities … read through any
methodology resources to learn about similarities between them and … industry standards."*

**How it was done.** Four research passes ran in parallel from the owner's machine, each reading
providers' own methodology documents where they could be opened: (1) regulatory and long-standing
standard scales, (2) stock and fund raters, (3) crypto asset raters and index eligibility rules,
(4) the professional and educational standard for risk measures, composite scores and disclosure.
Every fact below is marked **READ** (the primary document was opened) or **SUMMARY** (seen only in a
search result or secondary page). Several primary pages refused automated access (S&P, Lipper's
PDFs, some Morningstar pages); those facts stay SUMMARY.

> ⚠ **One summarising tool invented numbers.** Asked for the EU's SRRI volatility classes, a web
> summariser returned "0–5%, 5–10% … >50%"; the real grid is far tighter (§1.1). The SRRI grid, its
> formula and its four-month rule were then re-read first-hand from the CESR PDF for this note.
> Treat any threshold in this area as unconfirmed until read in the primary document.

---

## 1. What established entities do

### 1.1 Regulators' standard scales (absolute, volatility-based)

| | EU UCITS **SRRI** (funds, since 2011) | EU PRIIPs **SRI** (packaged products, since 2018) |
|---|---|---|
| Measures | Volatility of returns | Market risk as "VaR-equivalent volatility" (97.5% Cornish-Fisher VaR, so skew and fat tails count), combined with a credit-risk class |
| Data | Weekly returns (monthly if not possible), **last 5 years**, annualised (m = 52, T = 260; sample standard deviation, T − 1) | Category 2 products need ≥ 2 years daily, 4 years weekly or 5 years monthly; monthly-only data adds one class |
| Scale | **1–7**, fixed bands: 0–0.5%, 0.5–2%, 2–5%, 5–10%, 10–15%, 15–25%, ≥ 25% | **1–7** market-risk classes: < 0.5%, 0.5–5%, 5–12%, 12–20%, 20–30%, 30–80%, > 80% |
| Stability rule | Class changes only if volatility sat **outside its band at every weekly point over the preceding 4 months**; if it touched several bands, the majority band | Same 4-month majority rule |
| Short history | Filled from a representative benchmark or model, never assumed low | Penalised (one class up for coarse data; products that can lose more than invested go straight to 7) |
| Says of itself | Must come with "a short narrative description of the limitations of the indicator and … the risks … not fully captured" | "a guide to the level of risk of this product compared to other products"; "may not be a reliable indication of the future"; "the lowest category does not mean risk free" |
| Sources | READ: CESR/10-673 (ESMA). Verified first-hand 2026-10-07 | READ*: Delegated Reg. 2017/653 Annex II–III via the FCA Handbook copy; the credit-risk combination table's cells were not extracted |

**Crypto under PRIIPs (READ):** BlackRock's iShares Bitcoin ETP KID (28 July 2026) classes it **6 of
7**, "the second highest risk class", with "This classification is not guaranteed and may change over
time" and "Don't invest unless you're prepared to lose all the money you invest."

CESR explained its band choice as "a compromise solution … between … an adequate degree of
stability in the risk classification process and … an appropriate spread … across different risk
classes", and "did not consider it desirable to develop an SRRI involving frequent migrations" (READ).

### 1.2 Long-standing publishers' stock ratings

| Provider | Measures | Window | Scale, relative or absolute | Source |
|---|---|---|---|---|
| **Value Line Safety Rank** | Price Stability (standard deviation of weekly price changes) **and** Financial Strength, weighted equally | 5 years weekly | 1–5; ranked against ~1,700 stocks (relative) | READ (user guide) / SUMMARY (weights) |
| **S&P Quality Rankings** | Stability of earnings and dividends | 10 years (US) | A+ to C, D for reorganisation | SUMMARY via Cambridge Associates; S&P: "does not profess to reflect all of the factors … that bear on stock quality" |
| **Weiss Ratings** (stocks) | Equal Risk Model (volatility, solvency, valuation) and Reward Model | not published | A–E; Weiss likens its grades to "Buy," "Sell" and "Hold" | READ |
| **Morningstar Uncertainty** (stocks) | Since 2022, suggested from **trailing 12-month standard deviation of price**, analyst may override | 12 months daily | Low to Extreme; drives the buy/sell margins of safety | READ (FAQ, 2022) |
| **MSCI Barra** | Factor-model forecast volatility and beta (252-day windows, exponential half-life) | 1 year daily | Licensed, no consumer grade | READ (USE4 notes) |

### 1.3 Fund risk ratings

| Provider | Measures | Window | Scale | Source |
|---|---|---|---|---|
| **Morningstar Risk** | Downside-weighted variation (Return − Risk-Adjusted Return) | 3, 5, 10 years monthly; **no rating under 36 months** | Relative within category: 10% Low · 22.5% Below Avg · 35% Avg · 22.5% Above Avg · 10% High | READ (2006 methodology) |
| **Morningstar Portfolio Risk Score** | Forward-looking volatility | factor model | **Absolute** fixed grid, 28.2% volatility = 100, grid "fixed for a year", because percentile ranks are "unstable when the market environment shifts dramatically or securities are removed from or added to the investment universe" | READ (2023) |
| **Lipper Preservation** | Sum of negative monthly returns | 3, 5, 10 years | Quintiles within asset class; "relative, rather than absolute" | SUMMARY |

### 1.4 Crypto raters and index eligibility rules

| Provider | What it rates | Inputs relevant here | Source |
|---|---|---|---|
| **Weiss Crypto Risk Index** | Price risk | "relative and absolute price fluctuations over multiple time frames", "declines from peak to trough in terms of frequency and magnitude"; volume not mentioned; Overall Rating "not an average of the component grades" | READ |
| **Kaiko Asset Ranking** (Jan 2026) | Tradability, not price risk | Volume (incl. top-2 exchange share: < 50% best, ≥ 75% worst), order-book depth and spread, market availability, **maturity: days since first listing (< 365, 365–730, 730–1,825, > 1,825)**, custody, market cap; quarterly; stablecoins excluded | READ |
| **S&P Stablecoin Stability Assessment** | Stablecoins | An anchor (asset quality), then factors that "can only be either neutral or negative" | SUMMARY |
| **CME CF Crypto Market Index** | Eligibility | Turnover and liquidity ratios **> 0.05%** as a *floor*; ≥ 2 constituent exchanges; custody; no DACS meme coins | READ |
| **Bitwise** (2019) | Eligibility | ≥ 2 exchanges; > 10% of free-float cap traded in 30 days (floor); eligibility lost only after **30 consecutive days** in breach; fee-charging exchanges only, "to exclude exchanges that encourage wash sale trading" | READ |
| **FTSE Russell / DAR** (v1.9, 2026) | Vetting | ≥ 3 vetted exchanges; free float ≥ 10%; market cap > $50M; "natural buy and sell patterns" tests | READ |
| **S&P Cryptocurrency Indices** | Eligibility | ≥ 3 months traded; ≥ $100M market cap on a **7-day median price**; **3-month median daily value traded** ≥ $100,000 | SUMMARY |
| Coin Metrics / Glassnode | Volatility convention | √365 (crypto trades every day); windows 30d, 90d, 180d, 1y | READ / SUMMARY |

**Fake volume (SUMMARY):** Bitwise's 2019 SEC filing found about 95% of CoinMarketCap-reported
bitcoin volume was not real.

### 1.5 The professional standard (education and practice)

- **Volatility:** log or simple returns, sample standard deviation, annualised by √252 (stocks),
  √365 (crypto) or √52 (weekly) (READ: CESR; RiskMetrics). RiskMetrics' EWMA (λ = 0.94 daily) reacts
  within weeks: right for a "recent volatility" readout, wrong for a stable rating (READ).
- **Drawdown:** path-dependent and grows with window length, so it compares only over the same
  window (SUMMARY: Magdon-Ismail & Atiya, 2004).
- **Beta:** changes with the index, period and return interval; show it with R² and its standard
  error (READ: Damodaran, NYU).
- **Liquidity:** Amihud's illiquidity ratio (|return| ÷ dollar volume) needs only daily data and is
  among the best low-frequency proxies, in crypto too (SUMMARY).
- **Financial strength:** Altman Z, Piotroski F and Ohlson O are the standard models; all are
  computable from 10-K data. Debt ÷ equity and net margin are components, not a validated model, and
  debt ÷ equity is meaningless for banks and for negative equity (SUMMARY).
- **Composite scores** (READ: OECD/JRC *Handbook on Constructing Composite Indicators*, 2008):
  ranks resist outliers but lose levels; z-scores let extremes dominate; fixed reference points keep
  levels. Linear weights let one strong component offset a weak one ("compensability"); caps or
  geometric means limit that. Missing data: delete, impute, or require coverage; state which.
- **Disclosure** (READ: FINRA Rule 2214, not binding on this app but the closest US template):
  "describes the criteria and methodology used, including … limitations and key assumptions";
  "explains that results may vary with each use and over time"; describes the universe considered;
  "clear and prominent … in written … narrative form". IOSCO's code for rating agencies asks for the
  methodology, its version and historical performance to be published (SUMMARY).
- **Scale format:** EU consumer testing found people "more confident in their ability to compare
  funds and assess their level of risk" with a numerical 1–7 scale plus narrative (READ: CESR).

## 2. Where they agree: the industry standard

1. **Past price volatility is the core measure of an asset's risk**, chosen by EU regulators as
   "well-known and well-established" and able "to capture the effects of very different risk
   factors" (READ). Drawdown or downside variation is the usual second measure.
2. **Long windows for a rating, short windows only as a readout.** Regulators use 5 years of weekly
   data; stock quant ratings 12 months of daily data; crypto sources 30 days to 1 year.
3. **Absolute, published thresholds where the score must mean the same thing across assets and over
   time** (SRRI, PRIIPs, Morningstar's Portfolio Risk Score), because a rank moves when other assets
   move. Relative ranks are used for peer comparison (fund categories, sector grades), and they read
   as "better than its peers".
4. **Results shown as a small number of classes**, typically 1–7, with words that describe the
   measurement and a narrative of limits.
5. **A rule that stops ratings flipping**: four months consistently outside a band (EU), or thirty
   consecutive days (Bitwise).
6. **Minimum history before rating**, and short history never defaults to a good score (Morningstar:
   36 months; PRIIPs: 2 years daily; Kaiko scores maturity; S&P requires 3 months).
7. **Nobody trusts raw crypto volume.** Turnover is a floor, not a "more is better" score; medians
   resist spikes; vetted-exchange data or depth replaces reported volume where available.
8. **For stocks, financial strength is a separate leg** (Value Line, Weiss, S&P), not mixed silently
   into price risk.
9. **The same disclaimers recur**: a guide compared with other assets; based on past data that may
   not be a reliable indication of the future; may change over time; the lowest class is not risk
   free; names what is not captured.
10. **Commercial stock grades are tied to buy/sell** (Weiss, Seeking Alpha, Zacks, Morningstar's
    margins of safety); letter grades and stars carry that meaning. Morningstar's Portfolio Risk
    Score is explicitly a *suitability* tool ("Conservative" to "Extreme"). Both are shapes this app
    avoids (D92; the memo's §6, item 5).

## 3. What this means for the v1 draft

| v1 draft says | The research | Proposed change for the owner to decide |
|---|---|---|
| 0–100 score, five bands | The standard is a 1–7 class with narrative; 0–100 exists (Morningstar PRS) but proportional to volatility | Keep 0–100 as the computed value; consider **showing a 1–7 class** as the headline, which consumer testing favours |
| One scale for coins and stocks | Absolute scales are the regulatory norm; Bitcoin sits at PRIIPs class 6 | **Keep one absolute scale**, and say plainly that most coins will sit in the higher-risk classes because they are more volatile. That is the honest result, not a flaw |
| Crypto volatility over 90 days, stocks over 1 year | Ratings use long windows; 90 days is a readout window | **1 year of daily data for both** (comparable, more stable); show 90-day volatility beside it as "recent", unscored |
| Recomputed daily, band shown as computed | Regulators hold a class for 4 months unless the change persists | **Add a stability rule**: change the shown band only after the score has been outside it at every weekly reading for 16 weeks (needs stored weekly readings) |
| Liquidity: volume ÷ cap, more is better | Turnover is a floor; very high turnover is a wash-trading signal | **Score turnover as a floor that saturates** (no extra credit above a cap); use the **30-day median** dollar volume, not the mean; say reported volume is not vetted |
| No history requirement | Every rater requires minimum history | **Require 365 days of trading** (and 1 year of prices for stocks); below that, "not enough history to rate" |
| — | Kaiko scores maturity; index rules count exchanges and their concentration | Candidates for v2 with free data: **trading age**, **number of exchanges and top-2 share** (CoinGecko tickers), **free float** |
| Weighted average of all dimensions | Linear weights let size offset volatility; S&P lets secondary factors only lower a result | Consider a **cap rule**: scale and liquidity can lower the score but not lift it more than one band above what volatility and drawdown alone give |
| Stocks: debt ÷ equity and net margin | Components of standard models, not a model; undefined for banks and negative equity | Keep for v1, labelled as components; **exclude financials from the fundamentals leg**; consider **Altman Z** for v2 |
| Weights 0.30 / 0.20 / 0.25 / 0.25 and 0.25 / 0.20 / 0.20 / 0.15 / 0.20 | No source supports any specific weights | **State them as Finance Now's choice**, and test their sensitivity before launch |
| Band labels describing measured risk | Matches Morningstar's neutral "Low … High"; avoid Conservative/Aggressive, letters and stars | **Keep** |
| Disclosure mapped to the memo's §6 | FINRA 2214, IOSCO and the EU phrases set the standard wording | Use the regulators' phrasing nearly verbatim (§2, item 9), and publish the methodology **version** and later its track record |

**Validation before anything is shown** (the professional standard, §1.5):
1. Sanity ordering: Treasury ETFs and mega-caps should score low risk, micro-caps and meme coins high.
2. Backtest: compute the score at past dates and check its rank correlation with the volatility and
   drawdown that followed over 6–12 months.
3. Sensitivity: move each weight and breakpoint ±20% and count how many assets change band.
4. Stability: count how often bands change month to month, with and without the stability rule.

## 4. What established raters measure that free data cannot

State these on the page as not assessed; do not approximate them: order-book depth and true
spreads; vetted-exchange volume and wash-trading tests; custody and regulated-product availability;
protocol security and 51%-attack exposure; code and developer audits; analysts' technology,
adoption and moat judgments.

## 5. Unresolved

- PRIIPs: the credit-risk combination table's cells and the exact Cornish-Fisher coefficients were
  not read in a primary source.
- S&P Quality Rankings: letter cut-offs and update frequency not found; no S&P primary document opened.
- Altman's, Piotroski's, Ohlson's and Amihud's original papers were not opened (formulas are SUMMARY).
- Two of the research passes disagreed on whether the SRRI formula divides by T or T − 1; the CESR
  PDF, read for this note, shows **T − 1**.

## 6. Sources

**READ:** CESR/10-673 SRRI guidelines (esma.europa.eu); Delegated Regulation 2017/653 Annexes II–III
(FCA Handbook copy); iShares Bitcoin ETP PRIIPs KID (blackrock.com, 28 July 2026); Value Line user
guide; Weiss Ratings model and definitions pages (weissratings.com); Weiss Crypto Ratings pages and
free list; Morningstar Rating Methodology (2006), Uncertainty Rating FAQ (2022), Portfolio Risk Score
methodology (2023); MSCI Barra USE4 methodology notes (2011); RiskMetrics Technical Document (1996);
Kaiko Asset Ranking Rulebook (Jan 2026); CME CF Crypto Market Index methodology; Bitwise index
methodology (2019); FTSE Russell / DAR vetting guide v1.9 (2026); CoinDesk Market Index methodology
(2025); Coin Metrics realized volatility docs; OECD/JRC Handbook on Composite Indicators (2008);
Damodaran's NYU slides; FINRA Rule 2214.

**SUMMARY:** Lipper Leaders methodology; S&P Quality Rankings (via Cambridge Associates, 2007); S&P
Stablecoin Stability Assessment; Moody's stablecoin proposal (Dec 2025); S&P Cryptocurrency Indices;
Seeking Alpha and Zacks rating pages; Glassnode; IOSCO code; Magdon-Ismail & Atiya (2004); Amihud
(2002); Altman, Piotroski and Ohlson scores; Bitwise's 2019 SEC filing on volume.
