# Opportunity proposals — 2026-11-06

**Commit:** `282b827` (main, "Merge main after #471") · **Reviewed:** `.claude/agents/opportunity-scout.md`;
`README.md`; `CLAUDE.md`; `docs/TASK-QUEUE.md` (section list, S3–S6 charters); `docs/ROADMAP.md` in full;
`docs/audits/rejected-proposals.md` (RP-1 to RP-8 and the not-a-rejection notes); the ledger
`docs/audits/task-queue-2026-09-07.json` (all 384 items: 240 closed, 131 parked, 8 open, 5 blocked,
and the annotation passes through 2026-10-25); every owner decision D1–D194 in `docs/decisions/`;
`docs/proposals/2026-09-08-proposals.md` and `2026-09-22-proposals.md`; `docs/MARKET-ASSESSMENT.md`;
`docs/FEATURE-ADDITIONS.md`; `docs/BUSINESS-CHECKLIST.md` §5 (release bar, Feature floor, out-of-v1 fence);
`docs/assessments/counsel-brief-2026-10-26.md` (question list); `docs/audits/coverage-matrix-2026-10-14.md`;
`docs/audits/live-data-audit-2026-10-26.md`; `DATA-AVAILABILITY.md` (macro, staking, fund rows); and
source: every `/live-data` route and its consumers, `lib/server/sourceTerms.ts`, `lib/data/dataSources.ts`,
the macro, coin, fund, stock and tracked-portfolio pages, `lib/db/schema/invest.ts`,
`lib/legal/disclosures.ts`, and the archived Budget importer on `archive/wave-two-pre-reset`.
· **Proposals:** 8

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*How to read the ratings:* **Importance** = what the product and its users gain · **Efficiency** =
that gain for the work it takes · **Practicality** = how ready it is (dependencies, risk). `P0`/`P1`/`P2`
is the net of the three. Effort is given in rough working days for one developer.

> **Checks every proposal passed.** None publishes a score, grade, rating or ranking of an asset,
> provider or holding (RP-3, RP-6, RP-7, RP-8, D14, D26, D64, D92); every new figure is a fact or plain
> arithmetic, labelled with its source and date. None needs a paid plan (D21); several remove a
> single-vendor dependency. None fetches a new host: every source below is already in the
> source-terms registry and already called by the app. One terms reading is owed (the European
> Central Bank's reuse terms, proposal 1), and it is owed today anyway. No mock data, no deletion of
> project files, and no hidden surface is restored. Nothing below is an existing ledger item, parked
> ones included, except proposal 6, which is labelled as a re-prioritisation of parked T-076.
>
> **Two measurements were taken from this session**, each a single read of an endpoint the app
> already calls, to confirm a data set exists. They say nothing about availability from the owner's
> machine and are not audit results: the Treasury's real-yield feed (proposal 2) and the fields in
> DefiLlama's stablecoin response (proposal 3).
>
> **On timing.** D19 (2026-09-14) deferred scout passes to rollout planning. You asked for this one,
> so it is written as active work; if you would rather approved items be filed and parked, say so
> when you mark them.

---

## Still waiting on your ruling from earlier passes (not re-proposed)

Nine proposals from the last two passes carry no marking and none is in the ledger. They are listed
so this file does not quietly bury them. Each was re-checked in today's tree.

| From | Proposal | State on 2026-11-06 |
|---|---|---|
| 2026-09-08 #1 | A way to create a price alert | Still unbuilt. `usePriceAlertStore` and `usePriceAlertMonitor` run app-wide; nothing in the UI calls `addAlert` |
| 2026-09-08 #2 | "Add to watchlist" from detail pages | Still unbuilt. Only `/watchlist` and `/brief` use the watchlist store |
| 2026-09-08 #3 | Fund risk profile (T-353) | **Overtaken by D92**: funds get facts from their own documents, not a rating. Suggest marking it REJECTED with D92 as the reason |
| 2026-09-08 #4 | Macro stories on Headlines | Still unbuilt. `/headlines` reads `/live-data/news` and `/live-data/market-news` only |
| 2026-09-08 #5 | Funds and SEC fundamentals on `/api/v1` and the MCP server | Still unbuilt. `/api/v1` has no fund or fundamentals route |
| 2026-09-22 #1 | Measure what survives dropping a vendor | **Done in substance** by T-439 (D110, D112). Suggest marking it APPROVED-and-done, or REJECTED as superseded |
| 2026-09-22 #2 | Links into Compare from where you are | Still unbuilt. The sidebar entry is still the only link to `/compare` |
| 2026-09-22 #3 | Show the date behind staking backup rates | Still unbuilt. `fallbackProvenance` is still rendered nowhere |
| 2026-09-22 #4 | "Analyze with AI" on coin and macro pages | Still unbuilt. Only the stock page links to `/research` |

Four of these (09-08 #2, 09-22 #2, 09-22 #4, and the cross-links in the "next in line" list at the
end) share one idea: an asset's own page should offer the actions that belong to it. They could be
decided together as one "actions on every asset page" item.

---

## 1. Price and chart every currency pair from the European Central Bank's daily rates · proposed `P1` · target section: ledger, new item (category `feature`, Macro Markets)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-445 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06).

**What:** Show each currency pair's latest ECB reference rate (with its date, labelled "daily, not a
live quote") wherever the pair now shows a dash: the Currencies table, the 17 pair pages and the Macro
overview. Draw each pair's price chart from the ECB's daily history. As a second step, let the Macro
technical-analysis page and scanner read those daily closes too.

**Grounded in:**
- Pair prices come only from the keyed quote ladder, and on every owner-machine audit since
  2026-09-09 it has served no macro quote (`DATA-AVAILABILITY.md`: `EURUSD=X` missing "with five
  provider keys held"; still 🔑 UNCONFIGURED on 2026-10-26, `docs/audits/live-data-audit-2026-10-26.md`).
  So `CurrenciesClient.tsx` prints `—` for every pair, and `CurrencyDetailClient.tsx` charts through
  `PriceChartCard`, which has nothing to draw.
- **The same page already downloads the answer.** `CurrenciesClient.tsx` fetches `/live-data/fx-rates`
  (30 ECB currencies, keyless) for its converter, a few lines above the table that shows dashes. Every
  currency in the 17 pairs (EUR, GBP, JPY, CHF, CAD, AUD, NZD, MXN, BRL, CNY, INR, KRW, ZAR against USD)
  is in that set.
- History exists on the same host. A single read of frankfurter's time-series form
  (`/v1/2026-10-01..2026-11-05?base=USD&symbols=…`) returned 26 business days for every currency asked.
- The project already settled this pattern for Treasury yields: the 2026-09-03 decision recorded in
  `lib/data/ratesFromCurve.ts` (cited there as D3) moved yields off the paywalled ladder onto an
  official daily figure, labelled as daily with no intraday change. This is the same move for currencies.
- The Macro Scanner leaves out the 10 emerging-market and cross pairs because "their series gap" on
  the keyed providers (`macro/scanner/page.tsx`). The ECB publishes every business day, so on its
  rates that reason goes away.

**Who benefits and how:** Anyone using the Macro module, which is a paid entitlement. Today its
Currencies area shows a working converter and a table of dashes. With this, all 17 pairs show a real,
official, dated rate and a chart, with no key. It also gives currency prices a source that is not a
paid data vendor, which is the D21 rule's other half.

**Cost:** 2 to 4 days. No key, no licence fee, no recurring cost. One cached history request per pair
per day. A methods-page line (`lib/legal/dataMethods.ts`, the D163 rule) for how a USD-based pair is
worked out from the ECB's euro-based rates. The Dollar Index (DXY) stays a dash: it is ICE's index and
the ECB does not publish it.

**Depends on:** One terms reading. frankfurter.dev is verified, but its entry says "The ECB's own
reuse terms, which govern the rates, were not part of that reading." Read the ECB's terms and register
them, as the Federal Reserve Board was registered for the FOMC table without being fetched.

**Decision needed from you:** Where the rate lives. (a) **Page by page**, as D3 did for yields (smaller,
recommended first). (b) **As a last, labelled step in the shared quote ladder**, so Compare, watchlists
and portfolios holding a currency pair get it too. (b) reaches more places but mixes a daily figure into
a route that otherwise serves live quotes, so it needs a marker every consumer respects.

*Importance:* High: a whole area of a paid module goes from dashes to working. · *Efficiency:* High:
the data is on the page already, from a verified keyless host. · *Practicality:* Good: one terms
reading and one design choice.

---

## 2. Bonds & Rates: yield history charts and the bond market's inflation outlook, from the Treasury · proposed `P1` · target section: ledger, new item (category `feature`, Macro Markets)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-446 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06).

**Built:** 2026-11-07 (D202): yield history charts, expected inflation, and the yields back on the Macro TA page and scanner; Compare is decided later with T-445.

**What:** Two things from the same official source the app already uses:
1. **History charts for the four Treasury yields** (13-week, 5-, 10- and 30-year), drawn from the
   Treasury's daily par curve instead of the quote ladder that never answers for them. The Macro
   technical-analysis page and scanner could then include them again, reading closing figures only.
2. **Real yields and "breakeven" inflation.** The Treasury also publishes the yield on
   inflation-protected bonds (real yields) at 5, 7, 10, 20 and 30 years. Ordinary yield minus real
   yield at the same maturity is what the bond market expects inflation to average over that period.
   Show both on `/macro/rates`, with history.

**Grounded in:**
- The yield pages show today's yield from the curve, then chart through
  `<PriceChartCard symbol={entry.symbol} valueFormat="plain" />` (`RatesDetailClient.tsx`), which asks
  the ladder for `^IRX`/`^FVX`/`^TNX`/`^TYX`. `ratesFromCurve.ts` records that no free provider serves
  those (FMP 402, Finnhub nothing, Twelve Data 404, Alpha Vantage empty, Tiingo none). So the chart is
  empty for every user.
- `fetchCurveYear(year)` in `lib/server/treasuryCurve.ts` already reads a whole calendar year of the
  official curve, one request per year. Earlier years come from the same feed by changing the year.
- The yields left the Macro Scanner on 2026-10-24 (T-129 D, D157) because "no provider sends their
  history". The official curve does.
- Real yields: the same endpoint with `data=daily_treasury_real_yield_curve` answered a single read
  from this session with 5Y, 7Y, 10Y, 20Y and 30Y figures for 213 days of 2026, latest 2026-11-05.
- `home.treasury.gov` is `approved` and `verified` in `sourceTerms.ts` (federal works, 17 U.S.C. §105).
  No new host.

**Who benefits and how:** Macro users get the four yield pages working end to end, and a figure the
module has never had: what the market expects inflation to be. That figure is the bridge between the
Treasury curve page and the inflation questions the macro agents are asked. It is arithmetic on two
official published numbers, not a forecast of our own.

**Cost:** 2 to 4 days. No key, no recurring cost. History is cached daily (the curve changes once a
day). A methods-page entry for the breakeven subtraction (D163). The yield pages say the history is
daily, as their headline figure already does (`curveYieldSourceLabel`).

**Depends on:** Nothing.

**Decision needed from you:** Whether yields should also reach Compare. That means letting
`security-chart` answer the four yield symbols from the curve, the ladder question proposal 1 asks
for currencies. Recommended: decide both together.

*Importance:* High: four always-empty charts filled, plus a new official figure. · *Efficiency:* High:
the fetch function and the verified host already exist. · *Practicality:* Very good: no decision blocks
the first part.

---

## 3. Import trades from a broker's CSV file into a tracked portfolio · proposed `P1` · target section: ledger, new item (category `feature`, Portfolios → Tracked)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-447 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06).

**Built:** 2026-11-07 (D200): generic column matching, and one step cancels a whole import by adding cancellation rows.

**What:** On `/portfolios/tracked`, upload a CSV file of trades exported from a broker or exchange.
Map its columns once (date, buy/sell, symbol, units, price, fee), see every row checked before
anything is saved, then save them together. The mapping is remembered for that file layout, and rows
already imported are skipped if the file is uploaded again.

**Grounded in:**
- Today a tracked portfolio is built one entry at a time. `TradeForm.tsx` is "the form for recording one
  trade", and the route takes "POST … /trades → record one trade". Anyone with a few years of trades
  faces hundreds of hand entries before the FIFO gains mean anything.
- The project's own decision on getting user data in: ROADMAP "Budget data via **manual entry + CSV
  import first**". The Budget module built exactly that: column mapping, saved import profiles matched
  by the file's header row, and duplicate-proof re-imports. It went with Budget on 2026-08-20 and is
  recoverable by name from `archive/wave-two-pre-reset`: `frontend/src/lib/budget/csv.ts`, its tests,
  and the import-profiles route.

**Who benefits and how:** Every tracked-portfolio user with real history, the owner first. This is
the difference between the trade ledger (T-027, D65) being a demo and holding real holdings. It also
makes the gains figures trustworthy: a full history imported once beats a partial one typed by hand.

**Cost:** About a week. No key, no host, no recurring cost. Probably one small table for import batches
and saved layouts (the project adds tables rather than columns, as `tracked_portfolios` did), so a
migration on your machine (`npm run db:migrate`). Rules that are not optional:
- **The ledger is append-only.** A mistake is cancelled, never edited or removed. So the preview step
  carries the weight, and a bad import must be reversible as a whole by cancellation rows.
- **Coins are never matched by ticker alone.** The 2026-11-05 Reserve Monitor fix (D190: Gate USD shown
  as Gemini's GUSD) is the reason. Match to the catalog's coin ids or ask the user.
- Every row goes through the same checks as a typed trade (`parseTradeInput`), and the app counts and
  shows the rows it skips, as the old importer did ("importing them as transactions is worse than
  skipping them").

**Depends on:** Nothing. It works with proposal 7: dividends often appear in the same broker files.

**Decision needed from you:** (1) May one step cancel a whole import? (Recommended: yes, done with
cancellation rows, so nothing is removed.) (2) Generic column mapping only, or also ready-made layouts
for the brokers you use? Those need a sample file from you, with the numbers blanked.

*Importance:* High: it makes the trade ledger usable for real portfolios. · *Efficiency:* Good: the
parser and its tests are recoverable, and the trade rules already exist. · *Practicality:* Good: the
append-only rule shapes the design but does not block it.

---

## 4. What your funds cost you each year, across a whole portfolio · proposed `P1` · target section: ledger, new item (category `feature`, Portfolios)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-448 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06).

**What:** A "Costs" card on Portfolios and on each tracked portfolio. It shows the weighted expense
ratio of the funds held, the cost in dollars per year (from live values on a tracked portfolio, or per
$10,000 on a what-if one), and the 10-year cost compared with a 0.03% index fund. Sales charges are
counted where the rate is verified and disclosed where it is not, as the fund page already does. A
coverage line names any fund with no fee on file.

**Grounded in:**
- The arithmetic exists three times over and none of it reaches a portfolio: the Fee Drag Analyzer on
  each fund page (`computeFeeDrag`), the Portfolio Builder's `fees` summary for plans, and
  `reviewPlan`'s fee-creep check. `portfolios/page.tsx` and `components/portfolio/tracked/` contain no
  expense ratio at all.
- The project's own case for the figure (`docs/FEATURE-ADDITIONS.md` §2): "Expense-ratio compounding is
  the single most decision-relevant fact about a fund and the one every issuer page buries."
- The fees are now checked against SEC filings (`FUND_FEES_LAST_VERIFIED`, the D35–D39 and D114–D118
  corrections), so they can carry a total.

**Who benefits and how:** Anyone holding funds. "Your funds cost you $410 a year, about $5,600 over
ten years against an index fund" is a fact a reader can act on, and the app is one of few places that
can work it out across several funds with checked fee data.

**Cost:** 1 to 2 days. No key, no host, no recurring cost. Pure and tested, the house rule for any
dollar figure. A methods-page entry (D163). **No warning or threshold:** the code-checker's do-not-fix
registry records the deliberate absence of a fee warning in the builder, and this keeps to it: a
figure, not a verdict. It rates nothing (D92).

**Depends on:** Nothing.

**Decision needed from you:** None required. Optional: also show it on the Look-through tab.

*Importance:* High for every fund holder. · *Efficiency:* Very high: reuse of tested functions over
checked data. · *Practicality:* Very good.

---

## 5. Show figures the app already downloads and throws away · proposed `P1` · target section: ledger, new item (category `feature`, three parts: Crypto and Funds)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-449 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06), one item carrying parts (a), (b) and (c).

**What:** Three small additions, each from a response the app already fetches. Each can be approved
on its own.

**(a) Stablecoin supply change.** On the Reserves tab and each stablecoin's page: how much each coin's
supply grew or shrank over 1 day, 7 days and 30 days, and how its supply splits across blockchains.
- *Grounded in:* `/live-data/reserves` fetches `stablecoins.llama.fi/stablecoins?includePrices=true`
  and keeps only `circulating`. The same response carries `circulatingPrevDay`, `circulatingPrevWeek`,
  `circulatingPrevMonth` and `chainCirculating`. A single read from this session confirmed the fields
  (for example, USDT about $177.5B against $183.9B a month earlier).
- *Why it matters:* a fast fall in supply means holders are cashing out. It is the plainest public sign
  of strain on a stablecoin, and it would sit beside the peg alert the bell already raises. Facts only.
  An alert on a large fall is possible but needs a threshold, which is a judgement, so it is left to
  you.

**(b) Supply facts on every coin page.** Circulating, total and maximum supply, the share of the
maximum now circulating, fully diluted value, the 7- and 30-day change, and how far the price is
below its all-time high.
- *Grounded in:* `/live-data/markets` already returns `fdv`, `totalSupply`, `maxSupply`, `athChangePct`,
  `priceChange7d` and `priceChange30d`. The coin page's `MarketData` type (`types/asset.ts`) has no
  field for most of them, so the page shows circulating supply only. The Scanner already filters on FDV,
  and the Cycle Context tab already reads `athChangePct` for Bitcoin.

**(c) Issuer and size for the 25,000 funds outside the catalog.** For any fund looked up outside the
140-fund catalog, show its issuer and its net assets from the SEC's N-PORT data set, dated by quarter.
- *Grounded in:* `src/lib/data/fundFacts.generated.json` holds issuer and net assets for 25,003 fund
  tickers (N-PORT, 2026-07) and nothing reads it. T-392 closed as moot on 2026-10-07 with: "wiring it
  into the fund pages, or removing it, would be its own item if wanted." Meanwhile `fund-universe`'s
  non-catalog rows set `issuer: null` and `aumB: null`. The figure must be labelled as the build
  script's header requires ("fund net assets, all share classes"), and it needs a review clock
  (`staleness:check` would find it) and a quarterly re-run of `build-fund-facts.mjs`.

**Who benefits and how:** (a) stablecoin holders, on the flagship module's best-known surface;
(b) every reader of the 108 coin pages; (c) anyone who searches for a fund the catalog lacks.

**Cost:** About a day each. No key, no new host, no recurring cost. (a) rests on DefiLlama, which has
the same standing as the Reserves tab already has (no terms document, personal use before launch,
enquiry parked under T-425). (b) is CoinGecko data, whose credit the coin page already shows.
Methods-page lines for the change percentages (D163).

**Depends on:** Nothing.

**Decision needed from you:** Whether (a) should also raise a bell alert, and at what size of fall.

*Importance:* Medium to high: three surfaces gain facts at almost no cost. · *Efficiency:* Very high:
the data is already in hand. · *Practicality:* Very good.

---

## 6. A Stock Registry past 79 names, built from SEC data (re-prioritises parked T-076) · proposed `P2` · target section: ledger, annotate T-076 and file the build as a new item (category `feature`, Equities)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-450 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06); T-076 gained a progress note naming T-450 and D197, and stays parked.

**What:** A "wider list" mode on the Stock Registry: every SEC-filing company with a ticker, with its
name and its SEC figures (earnings and dividends per share, share count and how it changed). Search and
filters on those figures work over the whole list. Live price, market cap, P/E and yield appear for the
rows on screen, as they do now. Sorting or filtering on price-based figures over the whole list is
refused, because only the visible rows have a price.

**Grounded in:**
- **T-076 (parked):** "paid FMP plan **or a different Stock Registry universe source**". On the free
  key the Registry is the 79-name catalog, and the coverage matrix lists `stock-universe` as stranded if
  FMP is dropped (`coverage-matrix-2026-10-14.md`). This proposal is the "different source" half,
  without paying.
- The server already reads what the list needs, every day. `lib/server/stockPerShare.ts` reads the
  SEC's XBRL frames for "every SEC filer" in a fixed handful of requests whatever the number of stocks
  (about 6,100 symbols with earnings figures, per CLAUDE.md's P/E section). `lib/server/edgar.ts`
  already loads the SEC's ticker list (`company_tickers.json`).
- The project's rule for a screen that cannot see every row, set when fund return screening was
  switched off: refuse the screen rather than filter as though it had seen everything. This keeps it.

**Who benefits and how:** Equities users, who today can browse 79 large caps and nothing else without
paying. It also lets a stock outside the 79 resolve its name with no FMP key; today
`stock-universe?symbol=` answers catalog-only without one.

**Cost:** About a week. No key, no new host, no recurring cost; the SEC's fair-access rules are
already followed. Honest limits to state on the page: **no sector** outside the 79 (the SEC's
industry code needs one request per company), and the SEC's ticker list includes funds, preferred
shares and over-the-counter names that need filtering (the SEC's `company_tickers_exchange.json`, on
the same host, names each listing's exchange).

**Depends on:** Nothing technical. It is a re-prioritisation, so it needs your call.

**Decision needed from you:** (1) Move T-076 from "buy FMP near release" to "build the SEC list now,
decide FMP at release"? (2) Which listings count: NYSE and Nasdaq common stock only (recommended), or
over-the-counter too?

*Importance:* High: the equities module stops being capped at 79 names on the free tier. ·
*Efficiency:* Medium: the data is in hand, but the page needs a second mode with clear limits. ·
*Practicality:* Medium: honest-labelling work, and your call on T-076.

---

## 7. Record dividends, interest and staking rewards in a tracked portfolio · proposed `P2` · target section: ledger, new item (category `feature`, Portfolios → Tracked)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-451 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06).

**Built:** 2026-11-07 (D201): units received cost their value on the day; broker files' dividend and reward rows are read by the import.

**What:** Two new kinds of entry in a tracked portfolio. **Cash income** (a dividend, interest, or a
fund distribution: an amount, a date and a holding; no units move). **Units received** (a staking reward,
or a dividend paid in shares: units and their value that day, which adds a new lot). The portfolio then
shows income received to date and over the last 12 months, per holding and in total.

**Grounded in:**
- `lib/db/schema/invest.ts`: `TRADE_SIDES = ['buy', 'sell', 'transfer_in', 'transfer_out', 'split']`,
  with the comment "side is text, so adding a kind needs no migration".
- What-if portfolios already show an *estimated* annual income (`computeAnnualIncome`, D48). Tracked
  portfolios, the ones holding real money, record no income at all. So a dividend payer's or staked
  coin's return is understated, and the cash it paid appears nowhere.
- Splits were added the same way (T-421), with their detail in their own table (`trade_splits`).

**Who benefits and how:** Anyone tracking dividend stocks, income funds or staked coins, which covers
much of what the Funds, Equities and Staking pages describe. The portfolio's figures become complete.

**Cost:** 2 to 3 days, pure and tested in `costBasis.ts` and `tradeLedger.ts`. Probably one small table
for the amount, as splits needed, so a migration on your machine. No key, no host.

**Depends on:** Nothing. Works with proposal 3: broker files carry dividends.

**Decision needed from you:** What a unit received as income costs, for later gains: its value on the
day as you enter it (recommended), or zero. Either way the label stays plain and says no tax rule is
applied (`REALIZED_METHOD_LABEL`). The federal sale-tax estimator stays a separate parked item behind
D4 (T-058).

*Importance:* Medium to high. · *Efficiency:* High: no migration for the kind itself, and the split
work is the template. · *Practicality:* Good: one decision.

---

## 8. "Download my data": a copy of everything saved for an account · proposed `P2` · target section: ledger, new item (category `feature`, core / launch readiness)

**Status:** APPROVED (owner, 2026-11-06, D197: all eight approved; the decision each one names is asked when it is built)

**Filed as:** T-452 in `docs/audits/task-queue-2026-09-07.json` (2026-11-06).

**What:** One function that gathers everything stored for a user into a file: account (email, created),
the email-notice agreement, portfolios and holdings, tracked portfolios with every trade, split and
cancellation, watchlists, Portfolio Builder plans and saved checks, and saved wallet addresses. The
output is one JSON file plus CSV files for trades and holdings. It has two ways in: an owner command
(`npm run user:export -- --user <email>`, beside `auth:reset` and `auth:consent`), and a "Download my
data" button in Settings for the signed-in user.

**Grounded in:**
- The draft Privacy Policy, §11 (`lib/legal/disclosures.ts`): anyone may ask us to "tell you what
  personal information we hold about you and give you a copy", answered "within 30 days". The About
  page says the same. Today the only way to answer is the owner querying Postgres by hand across about
  a dozen tables.
- The owner-command pattern already exists for the two other account duties (`npm run auth:reset`,
  `npm run auth:consent`).

**Who benefits and how:** Users get their data without asking, including their trade history in a form
a spreadsheet opens. The owner gets a one-line answer to a legal request, ready before launch rather than
written under a 30-day clock.

**Cost:** 1 to 2 days. No key, no host. It leaves out the password hash and reset tokens, and says so.
It also says that browser-stored items (alerts, notes, chart settings) live on the device, as the
Privacy Policy already does. It exports only and deletes nothing.

**Depends on:** Nothing. The button matters once sign-in is on (D174: at launch). Until then it serves
the local user.

**Decision needed from you:** Owner command only for now, or the button too. If the button, the Privacy
Policy could mention it, which is a change to your document first, then copied in (the D50/D60 rule).

*Importance:* Medium: launch-facing, and it turns a written promise into a working feature. ·
*Efficiency:* High. · *Practicality:* Very good.

---

## Next in line (cut only to keep to eight)

Each of these passed every check above and could be written up in full on request.

- **Earnings dates where you look.** Show the next earnings date on each stock page, mark it in
  watchlists, and add a "my stocks only" switch to the Market Calendar. Today earnings dates appear only on
  the calendar and in Research. Add Alpha Vantage's earnings calendar as a second source: it is on the
  same free key the IPO calendar already uses, and FMP is today the only source for earnings dates.
- **News on each macro instrument's page.** `/live-data/macro-news` already tags articles with the
  commodity, currency or yield they mention (`related`, with detail-page links). No macro detail page
  shows news, while coin, stock and fund pages all do.
- **A backup for CoinGecko on portfolio history and the alert bell.** The coverage matrix lists five
  working surfaces CoinGecko alone carries. DefiLlama's price API accepts CoinGecko's own ids
  (`coingecko:<id>`), and `portfolio-prices` already uses it that way as a fallback;
  `portfolio-history` and `alerts` do not.
- **US economic release dates** (inflation, jobs, GDP, PCE) as a hand-kept table like
  `fomcCalendar.ts`. FMP's economic calendar is paid-only, so the calendar shows only Fed meetings on
  the free key. This needs terms readings for bls.gov and bea.gov first.
- **"Funds in the catalog that hold this stock"** on each stock page, built offline from the quarterly
  N-PORT archive that `build-fund-facts.mjs` already downloads. It joins the stock and fund modules
  through a `/live-data` route, as the module rules require.

## Considered and cut

- **A plain (non-AI) list from `/live-data/stock-outliers`.** Its groups are "cheap" and "expensive"
  across the universe, which reads as a ranking. The AI Outlier Scan explains each name instead.
- **A home-made Dollar Index from ECB rates.** DXY is ICE's index; a lookalike would be a different
  number wearing its name.
- **FRED as a macro source.** A new host and a key, and many of its series belong to third parties.
- **A value-over-time chart for tracked portfolios.** It needs keyed stock history for every holding;
  better after proposals 3 and 7.
- **Multi-year dividend history on stock pages.** The SEC data supports it, but it adds little beside
  the yield and P/E already shown.
- **Insider-trading filings (Form 4).** Parsing work, with no grounding in the project's documents.
- **Hidden surfaces.** Closest to restorable is backtesting: D172 fixed the shared maths, T-016 holds
  the restore steps, and it would need a methods-page section. Transfer Fees needs the fee-table check
  (T-031) and the rollout decision (T-312) first. Wallets is T-030. The Trade Risk Scorer waits on
  T-420 and counsel. All four are your call.
- **Anything with a score, grade or rank,** for the reasons in RP-3, RP-6 to RP-8, D14, D26, D64 and D92.

---

*Noticed in passing, for the code-auditor:* the Macro overview's Bonds & Rates strip still asks the
quote ladder for `^IRX`/`^FVX`/`^TNX`/`^TYX` (`app/(dashboard)/macro/page.tsx`), so it shows dashes
while `/macro/rates` reads the same yields from the official curve. Separately, the 2026-10-14 coverage
matrix lists `fund-holdings` and the options calculator as "only FMP", though the registry gives
fund-holdings a keyless SEC primary and the calculator reads the whole quote ladder.
