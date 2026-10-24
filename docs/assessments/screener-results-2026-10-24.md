# Screener results, read on the owner's machine (T-129), 2026-10-24

T-129's remaining half: open the seven screens with the dev server running, and for each write
down what the default view returns and what one narrowed filter returns, **before any default
is changed**. Read beside `docs/audits/live-data-audit-2026-10-17.md`.

- **Machine and network.** The owner's machine, `npm run dev` on `main` at `2f6b6cd`. Egress checked
  first: Spectrum, AS11426, `proxy: false`, `hosting: false`.
- **Keys.** FMP (free plan), Finnhub, Twelve Data, Tiingo and a CoinGecko Demo key are set. No paid
  plan.
- **What this records.** Counts and names, not prices. Stock, fund and crypto prices come from
  licensed feeds and stay out of the repository.

## What each screen returned

| Screen | Default view | One narrowed filter |
|---|---|---|
| Stock Registry `/equities` | 79 matches, the curated catalog: `company-screener` needs a paid FMP plan (D21). Prices live. | **Dividend payers only**: 68. The 11 non-payers (AMZN, TSLA, BRK-B, NFLX, PLTR, AMD, NOW, ISRG and others) drop out; the filter is kept in the address (`?payers=1`). |
| Fund Registry `/funds` | 29,210 funds in the universe (5,654 listed ETFs, 23,416 mutual-fund classes, 140 curated). 140 curated matches, average curated expense ratio 0.44%, cheapest FXAIX. Live prices arrive about 15 seconds after the page loads; until then the rows show reference prices marked `ref`. | **ETFs + Bond**: 24, all curated, average expense ratio 0.17%. Category is a curated-only field, so listed ETFs outside the catalog are left out while it is set; the page says so. **Risk profile → Conservative**: 0 of 29,210 (fixed below). |
| Coins `/assets` | 110 matches: the 108 catalog coins plus the 2 this browser added from Coin Discovery (OP, USDS). The cards count the 108; total market cap from live caps. Of the 108, **78 have a live price** (the feed answers for the 80 coins with a confirmed CoinGecko id; the rest show N/A by design). | **Layer 1**: 54, which is 52 catalog Layer 1 coins plus the 2 added coins, since added coins bypass the type filter by design (`useAssets.ts`). So USDS, a stablecoin, appears under Layer 1, and OP is labelled Layer 1 though it was saved as a Layer 2. |
| Coin Discovery `/coin-discovery` | First load after the server started: 197 candidates, 12 tokenized securities left out, and the notice that some categories could not be read. CoinGecko had refused the tokenized-credit category (HTTP 429) and the walk stopped, so private credit and pre-IPO were not tried. Figure Heloc, the Janus Henderson AAA CLO fund and three SSTN notes were among the candidates. **On the next load the check completed**: 17 left out, 192 candidates. | **Stablecoin**: 17. Three are not stablecoins: STABLE (a network's token named "Stable"), apyUSD and reUSD (yield-bearing tokens priced above $1). Several are missed and filed "Unknown": Global Dollar, GHO, EURC, AUSD, JPY Coin and others. The type comes from the coin's id (`usd`, `stable`, `dai`; `swap`, `dex`, `defi`), labelled "(heuristic)" on the page. |
| Crypto Scanner `/scanner` (1D, with setups) | 80 scanned, 1 unavailable, 1 left out (4-day candles only), 11 with a setup. **3 of the 11 are stablecoins** (EURC, Cap USD, USDM): a squeeze or a death cross on a coin held at $1. | **Signal = Buy, all coins**: 11, of which **5 are stablecoins** (USDG, PYUSD, RLUSD, DAI, vBUSD). |
| Equity Scanner `/equities/scanner` | Nothing runs until **Run scan** (79 keyed requests); that is by design. Before any scan it already said "0 names have at least one setup" (fixed below). After a scan: 13 with a setup, **42 of 79 with no history**. The page blamed a missing key; both keys were set. | Not run: a second sweep would have spent quota already used up. |
| Macro Scanner `/macro/scanner` | 29 of 45 instruments, all "no data", as the 2026-10-17 audit expected: macro history is not served on these plans. | Not applicable: there were no rows to narrow. |

## Why 42 stocks had no history

`/live-data/security-ohlcv` answered `fetch_failed` with no reason. With the change below it names
each provider and its answer: **Tiingo 429** (its hourly request limit, reached partway through the
sweep) and **FMP 402** (the free plan does not serve these symbols' history; AAPL's it does). So on
these plans one full Equity Scan cannot finish within an hour. That is a paid-plan question and
waits under D21. Later the same session FMP also answered 429: the readings above had used its
allowance for the day.

## Fixed in this change

1. **The equity price-history route says why it failed.** `security-ohlcv` now returns `failures`,
   each provider tried and its answer, in ladder order ("tiingo: Tiingo 429"), with anything shaped
   like a key in a URL taken out (tested by breaking the scrub on purpose).
2. **The Equity Scanner gives that reason in words**, grouped: "42 because Tiingo: request limit
   reached (429); FMP: not on this plan (402)" (`lib/utils/ohlcvFailures.ts`, tested). It no longer
   counts setups before a scan has run.
3. **Coin names and ranks are matched by CoinGecko id, not ticker**, on the Crypto Scanner and the
   Technical Analysis coin picker (`lib/utils/catalogCoinMeta.ts`, tested, and a guard on both
   pages). 14 tickers are shared inside CoinGecko's top 750, and the last, lower-ranked holder won:
   Maker's DAI (#24) showed as "DAI on PulseChain" (#429) and sorted there; MemeCore showed as
   "Mantis" with no rank. The scanner's default sort is by that rank. Checked after: "DAI — Dai
   (#24)", "GUSD — Gemini Dollar (#571)".
4. **The Fund Registry's Risk profile filter is behind the D64 switch.** The fund risk level has
   been off since 2026-10-04 and the fund list's feed sends none, so every choice emptied the list,
   while the filter still offered Conservative to Speculative. The filter, its note and the `?risk=`
   address parameter now follow `RISK_RATINGS_SHOWN`; an old `?risk=` link opens the full list.
   `riskRatingsHidden.test.ts` covers it.
5. **The Coins page's 24h Breadth card no longer prints a count as a percentage.** It passed
   advancers minus decliners (21 − 54) to a field shown as a percentage, so it read "−33.00%". It
   now says how many coins the count covers ("of 75 with a 24h change").

## For the owner to decide (nothing changed)

| # | Finding | Options |
|---|---|---|
| A | **Coins added from Coin Discovery show the price and market cap saved when they were added**, in the live price column with no label. This browser's three were saved on 2026-06-28; OP's saved price is about 12% below CoinGecko's current one. They also skip the type filter, and a Layer 2 is shown as Layer 1. | (a) fetch their live prices like the catalog's (one CoinGecko request covers them); (b) label the saved price with its date; (c) leave as is. |
| B | **Stablecoins in the Crypto Scanner.** 3 of 11 setups and 5 of 11 Buy signals were coins held at $1, where a setup means nothing. | (a) leave stablecoins out of the sweep and say so on the page; (b) keep them, with a "pegged" label; (c) leave as is. |
| C | **The scanner's "Oversold bounce" fires below RSI 38** and says "turning up off oversold"; the same app's signal summary calls oversold "below 30". | (a) change the wording to give the threshold ("RSI 37, under 38, turning up"); (b) move the threshold to 30; (c) leave as is. |
| D | **The Macro Scanner runs its 29 keyed requests on every visit** (again after 10 minutes), where the Equity Scanner waits for Run scan to spare the quota. Four are the Treasury yields, which no provider serves (D3 moved them to the official curve), so those four can never succeed. | (a) add Run scan as on Equities and drop the four yields from the sweep, or read them from the Treasury curve; (b) leave as is. |
| E | **Coin Discovery types coins from their id**, which mislabels STABLE, apyUSD and reUSD and misses most non-dollar stablecoins. | (a) read CoinGecko's own stablecoin category, one more request a day, cached like the tokenized check; (b) leave the labelled heuristic. |

### The owner’s answers (2026-10-24, D157)

All five picks, as recommended, built in the next pull request:

- **A.** Added coins are priced in the catalog’s own request and filtered like any coin; a coin
  with no live quote shows no price. OP is labelled Layer 2 and matches no type chip.
- **B.** Stablecoins are left out of the Crypto Scanner, and the page names them.
- **C.** The setup reads “RSI 37.4, under 38, turning up”; the overbought fade reads the same way
  against its 68.
- **D.** The Macro Scanner runs on Run scan; the four Treasury yields are out of its sweep.
- **E.** Stablecoin labels come from CoinGecko’s `stablecoins` category, read once a day.

## Seen in passing

- **The Coins page header says "110 coins monitored · live prices via CoinGecko"** while 30 of the
  108 catalog coins have no price. The N/A is right; the header overstates.
- **Coin Discovery's first view after a cold start can be partial** (above). The page says so, and
  a reload completes it. Spiko's SAFO funds, YLDS and OnRe's reinsurance token stay among the
  candidates: CoinGecko does not file them under a securities category, a gap
  `lib/server/tokenizedSecurities.ts` already records.
- **This browser's saved data-tier choice still names Binance for prices** (the TopBar is on
  "Custom"), from before Binance left on 2026-10-13. The server serves CoinGecko whatever it says,
  so nothing is wrong with the prices; the saved value is stale.
- **The Stock Registry's market caps are reference figures** (marked `ref`) beside live prices; for
  a few names (Oracle, Netflix) the two are visibly far apart, and the market-cap filter runs on the
  reference figure. Live caps come with a paid FMP plan (D21).
