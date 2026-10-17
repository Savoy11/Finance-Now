# Live-data audit — 2026-10-17 (residential)

**Owner's machine.** The egress was checked first the same afternoon:
`curl.exe -s "http://ip-api.com/json/?fields=isp,proxy,hosting"` answered Spectrum, `proxy: false`,
`hosting: false`. `npm run audit` ran against the dev server on port 3001, because another copy of
the app held port 3000 (`BASE_URL=http://localhost:3001`). The code was `main` at `e7a7812`, the
D133 merge: Investing.com's feeds were out, and the Staking Facts Check and the two ledger pull
requests had not landed yet, none of which changes a route. The run was paced at
`AUDIT_CG_PER_MIN=4`. That was not needed: the owner has had a CoinGecko Demo key saved since
2026-10-15 (T-105), and that day's run passed at the default pace. The pacing held this run for
437.9 s.

This record was written from the printed output. The raw text is on the owner's machine
(`audit-2026-10-17.txt`); it is not in the repository.

| | 2026-10-14 (paced) | 2026-10-15 (Demo key) | **2026-10-17** |
|---|---:|---:|---:|
| 🟢 REAL | 75 | 77 | **78** |
| 🟡 FALLBACK | 5 | 4 | **4** |
| 🔑 UNCONFIGURED | 8 | 9 | **9** |
| ⚪ EMPTY | — | — | **1** |
| 🔴 FAIL | 1 | 0 | **0** |

**No failure.** Each of the 14 checks that did not read REAL is explained below: 4 by design or a
paid plan, 9 by a decision or a missing key, and 1 that answered with nothing to list.

## What changed since 2026-10-14

| Check | 2026-10-14 | 2026-10-17 | Why |
|---|---|---|---|
| `wallet tron` | FAIL, Tronscan 429 | UNCONFIGURED, no key, nothing called | D105: the route calls Tronscan only with `TRONSCAN_API_KEY` |
| `network-fees` | 18 networks, 4 live | **5 live** | #343 moved Polygon's gas ladder to `polygon-bor.publicnode.com` |
| `staking-rates` | 23/51 live, 5/7 upstreams | **24/48 live, 6/6 upstreams** | Stride's three keys went (catalog: defunct); Injective now calls its documented `sentry` endpoint (D113) |
| `withdraw-fees` | 6/6 feeds, 115 fees | **4/4 feeds, 77 fees** | Bitget and XT.com stopped (D129, D131); KuCoin, HTX, LBank and Bitfinex remain |
| `macro-news` | | 20 articles across all 3 pillars | Investing.com's three feeds stopped (D133). Every pillar still has stories, the check D133's "every pillar keeps a source" needed |
| `config` | 57 providers | **54** | Investing.com's three provider rows removed (D133) |
| `source-terms` | 73 entries: 47 verified, 26 seeded, 6 prohibited | **75: 56 verified, 19 seeded, 9 prohibited** | D105, D106, D108, D113; Bitget, XT.com and Investing.com became prohibited |
| `ipo-calendar` | 6 upcoming IPOs | **EMPTY, 0 upcoming** | See finding 2 |
| `coin-discovery` | REAL | REAL, **"partial check"** | See finding 1 |

## Findings

1. **Coin Discovery's tokenized-securities check was partial.** The route left 11 tokenized
   securities out of 197 candidates, but at least one of the seven CoinGecko categories it reads
   (tokenized stocks, ETFs, Treasuries, money-market funds, credit, private credit, pre-IPO stocks)
   did not answer. The page said so, as designed ("some of those could not be read, so it may be
   incomplete"). **Neither the response nor the audit said which category or why**, so the cause
   cannot be told from this run. The route reads the categories one at a time and stops at a rate
   limit, and the reads are cached for a day, so a refusal or a renamed category would both look
   like this.
   - **Fixed in this PR:** the response now carries `tokenizedSecurities.failed` ("category:
     reason" for each one that did not answer), and the audit prints it. The next run will name the
     cause.
2. **The IPO calendar answered with nothing to list.** Alpha Vantage answered with a CSV with no
   upcoming rows. It is not a hidden rate limit: `parseIpoCalendar` reports Alpha Vantage's JSON
   refusals ("Information", "Note") as `rate-limited` with `ok: false`, which the audit would show
   as a failure. On 2026-10-14 it listed 6. An empty list on a Saturday is plausible; if it stays
   empty across runs, read the raw feed.
3. **The audit's macro-news label still said "8 RSS feeds".** The route has had 4 since D133, the
   same morning. Fixed in this PR: the label and the empty-result message no longer name a count,
   which the response does not report.

## Expected, and the same as before

| Cause | Checks |
|---|---|
| **By design** | `chart`: synthetic candles, marked `synthetic: true`. `fund-holdings` SPY: from the catalog, because a UIT files no N-PORT |
| **A decision** | `funding-rates` (D40). `futures-curve` (Yahoo, on terms). Reddit on both social routes (robots gate, D58), which leaves crypto Social with 0 signals and Stock Social with StockTwits' 30. `wallet tron` without a key (D105). `ohlcv eth MAX candles`: CoinGecko's free tier refuses candles past 365 days, and the charts read DefiLlama's closes, with Coin Metrics behind them (D103, D108) |
| **Paid plan, deferred under D21** | `stock-universe` at the 79-name catalog; `stock-outliers` over 66 of them |
| **No key** | `video-search` (YouTube) and `video-analyze`. `macro quotes`: `GC=F`, `EURUSD=X` and `ZN=F` went unserved by any keyed provider, the open question since 2026-09-09 |

## Figures, for the next run to compare

- `markets`: 78 assets via CoinGecko, BTC $81,542.
- `ohlcv eth MAX closes`: 584 weekly closes over 4,081 days from both DefiLlama and Coin Metrics, the latter credited.
- `coin-list`: 750 coins. `coin-discovery`: 197 candidates, 11 tokenized securities left out.
- `network-fees`: 18 networks, 5 live. The cross-layer checks agree, and BTC's fee is live from mempool.space.
- `security-quotes`: 3/3 live via Finnhub. `security-ohlcv` and `security-returns` via Tiingo.
- `fund-universe`: the 140-fund catalog plus 29,076 discovered funds (29,053 on 2026-10-14).
- `treasury-yield-curve`: 13 maturities, 2s10s 0.35, 3m10y 0.83, normal (2026-10-16 curve).
- `v1 exchanges`: 29. `agent prompts`: 11 agents. `config`: 54 providers, no keys leaked.

**Slow checks:** `fund-universe` at 12.0 s, a cold read of NASDAQ Trader's directory and the SEC's
fund dataset. `risk-scores (withdrawn RP-6)` at 3.5 s, a 404 on a route that no longer exists, so
it was most likely the dev server compiling the not-found page on first request.

## What this does and does not license

- **Does:** treat the data layer as healthy on the owner's line. This is also the precondition
  T-001, T-129 and T-130 name: an audit on the owner's machine before judging agent or screener
  output.
- **For judging agents (T-130, and T-001's remaining half), what the tools will see:**
  - every crypto, fund, equity and `/api/v1` route they read answers live data;
  - with five exceptions:
    - macro instruments have no prices (`macro quotes` unconfigured), so the macro agents will
      name unpriced instruments rather than quote them;
    - the equity screener works over the 79-name catalog, not the whole market;
    - crypto social has no signals;
    - video search has no key;
    - Reddit is withheld on both social routes.
  - A vague answer in any of those areas is a data gap, not a prompt problem.
- **For the screeners (T-129):**
  - the Equity Scanner and the AI Outlier Scan cover the curated catalog, by D21;
  - the Crypto Scanner reads DefiLlama's closes (REAL here);
  - the Macro Scanner depends on macro price history, which this audit checks only through the
    quote ladder, where it is unconfigured.
- **Next run:** use the default pace (`npm run audit`, no `AUDIT_CG_PER_MIN`), since the Demo key
  is saved, and read what `coin-discovery` names if its check is partial again.
