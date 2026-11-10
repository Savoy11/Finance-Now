# Opportunity proposals — 2026-11-10

**Commit:** `661c1bf` (`claude/dazzling-volta-lbbz61`, "Merge main after #493", D221 included) · **Reviewed:**
`.claude/agents/opportunity-scout.md`; `README.md`; `CLAUDE.md`; `docs/ROADMAP.md` (owner backlog, open decisions);
`docs/TASK-QUEUE.md` (section list); `docs/audits/rejected-proposals.md` (RP-1 to RP-8 and the not-a-rejection notes);
the ledger `docs/audits/task-queue-2026-09-07.json` (398 items: 258 closed, 127 parked, 8 open, 5 blocked; every open
and blocked item read); `docs/audits/parked-review-2026-11-09.md` (all 137 parked and blocked items); owner decisions
D212 to D221 (`docs/decisions/2026-11-08-…`, `2026-11-09-…`, `2026-11-10-owner-decisions.md`), with D21, D92 and D167;
`docs/proposals/2026-11-07-proposals.md`, `2026-11-06-proposals.md` and `2026-09-22-proposals.md`;
`docs/MARKET-ASSESSMENT.md` §3 to §8; `docs/FEATURE-ADDITIONS.md`; `docs/BUSINESS-CHECKLIST.md` §5;
`docs/audits/coverage-matrix-2026-10-14.md`; `DATA-AVAILABILITY.md` (quote and macro rows); and source: the N-PORT
parser and the fund holdings, holdings-history and fund detail pages; the five N-PORT filings in this machine's build
cache; the cost-basis engine, the tracked-portfolio screens and the data export; the company-facts route and the
stock page; the commodity pages; the coin, staking and Reserve Monitor pages; the Treasury curve and history code;
the alert and portfolio-history routes; the Daily Brief; the staking backup-rate table. · **Proposals:** 6

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*How to read the ratings:* **Importance** = what the product and its users gain · **Efficiency** =
that gain for the work it takes · **Practicality** = how ready it is (dependencies, risk). `P0`/`P1`/`P2`
is the net of the three. Effort is given in rough working days for one developer.

> **What this pass looked for.** You asked for work that can be built now. The ledger's 8 open items all wait
> on you, a lawyer or launch, and everything approved on 2026-11-07 is built (T-453 to T-458). So every
> proposal below can be started today from a cloud session, with no step on your machine first.
>
> **Checks every proposal passed.** None publishes a score, grade, rating or ranking of an asset, provider or
> holding, and none tells a reader what to do (RP-3, RP-6, RP-7, RP-8, D14, D26, D64, D92): every new figure is a
> fact from a filing or plain arithmetic on one, labelled with its source and date. None needs a paid plan (D21).
> None fetches a new host: every source below is already in the source-terms registry and already called by the
> app. Proposal 4 uses the stock-and-fund quote ladder, which needs a free key as every stock and fund price
> already does. No mock data, no deletion of project files, nothing for the hidden Transfer Fees, Wallets or
> Backtests pages, and no parked item un-parked. None is an existing ledger item.
>
> **No network requests were made from this session.** Proposal 1's field names were read from the five real
> N-PORT filings already in this machine's build cache (`frontend/.next/cache/fetch-cache`), the same ones D212
> used. Nothing went to sec.gov.

---

## Still waiting on your ruling from earlier passes

> **Ruled 2026-11-10 (D222):** 2026-09-08 #3 REJECTED (D92, D218); 2026-09-22 #1 APPROVED and already
> done by T-439, nothing to file; 2026-09-22 #3 APPROVED, to be filed. Owner: *"Close two, build dates"*.

Three proposals carry no marking. Each was re-checked in today's tree. They are not re-proposed below.

| From | Proposal | State on 2026-11-10 | Suggested marking |
|---|---|---|---|
| 2026-09-08 #3 | Fund risk profile (T-353) | Nothing left to file: T-353 itself closed on 2026-11-09 as superseded by D92 (D218). Funds get facts from their own filings instead, and several shipped since (duration, where it invests, costs) | REJECTED, reason D92 and D218 |
| 2026-09-22 #1 | Measure what survives dropping a vendor | Done in substance by T-439 (D110, D112): the coverage matrix now prints "Working surfaces one vendor carries" and "Ranges one vendor carries", keyless vendors included | APPROVED-and-done, or REJECTED as superseded |
| 2026-09-22 #3 | Show the date behind staking backup rates | **Still unbuilt, and more useful than when proposed.** The backup table holds 45 rates: 21 were measured on 2026-11-05 by the weekly refresh (D186), 24 have no date at all. The route already works out `fallbackProvenance` and no screen shows it; `/staking`'s notice still dates every non-live rate to the catalog's 2026-06-28 compile date. This week's refresh was refused (Benqi read 0), so unless one lands, the 21 dated backups stop being shown after 2026-11-19, and nothing on the page says what date they had | Yours to mark in `docs/proposals/2026-09-22-proposals.md`. Its part (a), showing the date, is small and can be built now |

---

## 1. A fund's own returns, and the money moving in and out of it, from its SEC filing · proposed `P1` · target section: ledger, new item (category `feature`, ETFs & Funds)

**Status:** APPROVED (owner, 2026-11-10, D222)

**In short:** Every fund page gets the returns the fund itself reported to the SEC, and how much money investors
put in and took out. No key is needed: the app already downloads the filing that holds both, and throws them away.

**What a reader would get:**
- **(a) Returns as filed.** This share class's total return for each of the three months the latest filing covers,
  and the 12-month total return wherever the last four filings join up without a gap. Dated: "12 months to
  31 August 2026, as reported to the SEC".
- **(b) Money in and out.** For each of those months: the value of new shares the fund issued, of distributions
  reinvested, and of shares redeemed, with the net, shown against the fund's size.
- **(c)** The in-app AI's fund tool (`get_fund_details`, built under T-457 a) returns the same figures.

**Why it matters:**
- **A fund page shows no return of any kind today.** Its price chart needs a quote key and shows no change figure;
  the Fund Registry's Returns columns need a Tiingo key. D21 names that returns surface as the one with **no fallback
  at all** (Tiingo only), and left a question open: the free providers' prices leave distributions out, *"and for
  mutual funds distributions are the point"* (`docs/decisions/2026-09-18-owner-decisions.md`). The filing's figures
  are total returns, distributions counted, from the fund itself, so they answer that question for funds without
  choosing a weaker basis.
- **Money in and out** is the plainest public sign of whether investors are adding to a fund or leaving it, and no
  surface in the app has it.

**Grounded in:**
- `lib/server/nport.ts` downloads each fund's NPORT-P `primary_doc.xml` and `parseNportReport` keeps the report date,
  net assets, holdings and interest-rate risk. Form N-PORT also asks for Item B.5 (monthly total returns, per share
  class) and Item B.6 (monthly flows), and neither is parsed.
- All five cached filings carry both. Vanguard 500 Index Fund's June-quarter filing, for example:
  `<monthlyTotReturn classId="C000007774" rtn1="10.49014889" rtn2="5.25936275" rtn3="-0.95490903"/>` and
  `<mon3Flow redemption="102779354536.56000000" reinvestment="1706081333.02000000" sales="92586020974.68990000"/>`. The same holds for
  iShares Core Dividend Growth ETF (two filings) and Growth Fund of America (one return row per share class).
- `resolveFundSeries` already returns the fund's class id, so picking the reader's share class is a lookup.
  `/live-data/fund-holdings-history` already lists up to 12 past filings and reads two, so reading four is the same
  machinery.

**What it would take:** About 2 days. Parse the two items (half a day, tested against the five cached filings), a
pure 12-month chaining rule in `lib/utils/` with tests, a card on the fund page, and a methods-page section (D163).
No key, no new host, no recurring cost. One step to do while building: read the form's instruction for Item B.5
once, so the methods page states exactly how the fund works its return out.

**Honest limits, stated on the page:**
- The figures are public about 60 days after the quarter ends, so they are two to four months old; the card names the
  month they run to.
- Trusts that file no N-PORT (SPY, GLD and the other commodity trusts) show nothing, as their holdings already do.
- Flows are for the whole fund, every share class; returns are for the reader's class.
- For an ETF, "new shares issued" are shares created for large dealers, not purchases by individual investors.
- A missing quarter means no 12-month figure, never a guessed one.
- These figures do not go into the Fund Registry's Returns column (see "Considered and cut").

**Depends on:** Nothing.

**Decision needed from you:** None required. Optional: part (b), money in and out. Recommended: yes.

*Importance:* High: every fund page gains its first return figure, keyless, and D21's one no-fallback surface gains
one for funds. · *Efficiency:* Very high: the data is already downloaded. · *Practicality:* Very good: field names
confirmed from real filings already on this machine.

---

## 2. What you sold, year by year: every sale with the purchases it used up · proposed `P1` · target section: ledger, new item (category `feature`, Portfolios → Tracked)

**Status:** APPROVED (owner, 2026-11-10, D222) — in Finance Now, with buy and sell dates and days held, and no "held more than a year" mark (the owner's answer to both questions: "Finance Now, dates only")

**In short:** Each tracked portfolio shows one "Realized" total. The app already works out, for every sale, which
purchases it used up and the gain on each. Show that list, by calendar year, with a download.

**What a reader would get:** On each tracked portfolio, a "Sales" section grouped by calendar year. Each sale shows
what was sold, the purchases it used up (oldest first, as FIFO does), when each was bought and when sold, the days
held, cost, proceeds after fees and gain, with totals for the year. A button downloads the same list as a spreadsheet
(CSV).

**Why it matters:** At tax time people need each sale's dates, cost and proceeds, and to check the app's figures
against their broker's year-end statement. A single total cannot be checked against anything. This is the most
useful thing the trade records now in the app (imported under T-447, with income under T-451) can give back.

**Grounded in:**
- `computeCostBasis` (`lib/data/costBasis.ts`) returns `sales: SaleMatch[]`: each part of a sale matched to the lot it
  used up, with quantity, proceeds, cost, gain and whether it rests on a starting position. **No component reads
  it.** `HoldingsTable.tsx` and the Realized tile in `TrackedPortfolioDetail.tsx` show sums only.
- "Download my data" (T-452, D199) exports the trades themselves, not the matches, so the list cannot be rebuilt from
  the download either without redoing FIFO by hand.

**What it would take:** About 1.5 days. A pure grouping rule in `lib/data/` (tested, with an injectable `now`, the
house rule for any figure a user acts on), the section on the tracked portfolio, a CSV through the existing export
route (`?part=sales`), and a paragraph in the methods page's "Tracked portfolios: gains and income" section. No key,
no host, no migration, no recurring cost.

**Honest limits, stated on the page:**
- FIFO, and not adjusted for tax rules (wash sales and the like), as every realized figure already says
  (`REALIZED_METHOD_LABEL`). Not a tax form, and no tax figure or rate anywhere.
- A starting position entered with no date shows "date not entered", and no days held.
- A fraction of a unit paid out in cash on a split appears as the small sale it is; units moved out are not sales and
  are listed apart.

**Depends on:** Nothing.

**Decision needed from you:**
1. **Does this belong in Finance Now?** You moved personal-finance tools to a separate product, and T-064 asks you to
   draw that line. Recommended: yes, it belongs here. It itemises gains this app already records and shows, and it
   works out no tax.
2. **Should a sale be marked "held more than a year"?** Recommended: no. Show the dates and the days held only. The
   one-year line is a tax rule, and the page already says its gains are not adjusted for tax rules.

*Importance:* High for anyone with a tracked portfolio, once a year especially. · *Efficiency:* Very high: the engine
already computes every row. · *Practicality:* Very good: two yes/no questions.

---

## 3. Each stock's latest quarters, not only its last full year · proposed `P1` · target section: ledger, new item (category `feature`, Equities)

**Status:** APPROVED (owner, 2026-11-10, D222)

**In short:** A stock page's revenue and profit come only from the company's last annual report. Add the last eight
quarters, from the same SEC file the page already downloads, next to the next earnings date the page now shows.

**What a reader would get:** On each stock page, revenue, net income and earnings per share for each of the last
eight quarters, with the change from the same quarter a year earlier. Beside the "Next earnings" card (T-458), a
reader sees what the company reported last and when it reports next.

**Why it matters:** For a company whose year ends in December, the page today shows 2025 figures, more than ten
months old, though three quarterly reports have come since. A reader looking at a stock before its earnings date
sees nothing of the recent trend. The in-app AI reads the same route (`get_stock_financials`), so its answers gain
the quarters too.

**Grounded in:** `/live-data/company-facts` downloads the company's whole SEC data file
(`data.sec.gov/api/xbrl/companyfacts/CIK….json`), which carries every quarterly report's figures. Its `annual()` keeps
only full-year figures from 10-K annual reports and skips the rest, with the comment "10-Ks also carry quarterly
comparatives". The route's own header says it: "Income/cash-flow figures come from the latest fiscal year reported
in a 10-K".

**What it would take:** About 1.5 to 2 days. A pure, tested quarterly reader beside `annual()`, a card on the stock
page, a methods-page paragraph (D163). No key, no host, no recurring cost.

**Honest limits, stated on the page:**
- Companies file no separate fourth-quarter report, so Q4 revenue and income are worked out as the full year minus the
  first three quarters, and say so. Q4 earnings per share are not worked out that way (the share count changes during
  the year), so they show only where the company filed them.
- P/E and dividend yield are unchanged: they stay on the latest full year, as D167 decided.
- Companies that file no quarterly data (foreign issuers, which file once a year) show "no quarterly filings".

**Depends on:** Nothing.

**Decision needed from you:** None.

*Importance:* Medium to high: every stock page, and the AI's stock answers. · *Efficiency:* High: the data is already
downloaded on every visit. · *Practicality:* Very good: one known subtlety (the fourth quarter), stated rather than
hidden.

---

## 4. Commodity pages: today's prices of the funds that hold each commodity · proposed `P2` · target section: ledger, new item (category `feature`, Macro Markets)

**Status:** APPROVED (owner, 2026-11-10, D222)

**In short:** A commodity's own price has been a dash on every audit since 2026-09-09. Each commodity page already
lists the funds that hold it (GLD for gold, USO for oil), but shows none of their prices. Show them: they are the
only live figures those pages can show today.

**What a reader would get:** On 13 of the 19 commodity pages, each listed fund's live price and today's change, in
the existing "ETF Proxies" card, under the fund's own name.

**Why it matters:** The commodities area of a paid module shows no live number at all. A reader on the gold page
can at least see how the gold funds are moving today, without leaving the page.

**Grounded in:**
- `CommodityDetailClient.tsx` lists `etfProxies` as links with no quote. 13 commodities have at least one fund, 24
  funds in all, and every one is in the fund catalog.
- Those funds price through the same quote ladder that serves every stock and fund, which the audits measure as live
  (`DATA-AVAILABILITY.md`: quotes REAL, via Finnhub). The futures symbols get nothing from any provider
  (`DATA-AVAILABILITY.md:752`).

**What it would take:** Half a day to a day: one quote request for the page's funds. No new host, no recurring cost.
It needs a free quote key, as every stock and fund price does.

**Honest limits, stated on the page:**
- Shown as the fund's price, never in the commodity's price slot, with one line: a fund's day can differ from the
  contract's (fees, how it rolls its futures, the gap between its price and its holdings).
- Live quotes only. A fund's catalog reference price is not shown here, as the price alerts refuse one too.
- Six commodities have no fund (heating oil, coffee, cocoa, cotton, live cattle, lean hogs); their pages are
  unchanged.

**Depends on:** Nothing.

**Decision needed from you:** Whether to also show the largest fund's price chart where the commodity's chart is
empty, in its own card under the fund's name. Recommended: not now. A gold chart that is really GLD's is easy to
misread, even labelled; the prices alone carry no such risk.

*Importance:* Medium: a paid module's emptiest area gains live figures. · *Efficiency:* Very high: one request
through a working path. · *Practicality:* Very good.

---

## 5. Join up the coin pages with Staking and the Reserve Monitor · proposed `P2` · target section: ledger, new item (category `feature`, Crypto)

**Status:** APPROVED (owner, 2026-11-10, D222)

**In short:** A coin's page has no way to the staking options for that coin, and the Staking page and the Reserve
Monitor have no way back to the coins' pages. Add the links.

**What a reader would get:**
- **(a)** On the 13 coin pages for stakeable coins (ETH, SOL, ADA, DOT, POL, AVAX, BNB, TRX, BTC, CRO, INJ, TIA,
  NEAR), one line: how many providers in the catalog stake it, how many of their rates are live now, and a link to
  the Staking page showing only that coin.
- **(b)** The Staking page opens on a chosen coin from its address (`/staking?coin=eth`), and each provider card's
  coins link back to their pages.
- **(c)** Each row of the Reserve Monitor links to that stablecoin's page. All 10 monitored coins have one.

**Why it matters:** "Can I earn yield on this?" is asked on the coin's page, and the answer is one sidebar trip and a
filter away. In the other direction, a reader comparing staking providers or stablecoin reserves cannot reach the
coin's chart, news or supply in one click. These are the flagship module's dead ends.

**Grounded in:** `staking/page.tsx` keeps its coin filter in page state only (`useState('all')`) and reads only
`?tab=` from the address; its links are "How we make money" and, on the Live Pools tab, each pool's own site. The coin page's only in-app moves are back to
`/assets` and the action row (T-454). `components/analytics/reserves.tsx` links only out of the app (attestation
reports, DefiLlama).

**What it would take:** About a day. No key, no host, no recurring cost.

**Honest limits:** The Staking page names coins its own way: its `matic` is the coin page's `pol`, and ATOM, OSMO and
KSM have no coin page. So the link uses a small hand-kept map held by a test, never a match by ticker (the lesson of
D190). The coin page shows a count and a link, with no list in order of rate and no "best" (the ranking line).

**Depends on:** Nothing.

**Decision needed from you:** None.

*Importance:* Medium. · *Efficiency:* Very high. · *Practicality:* Very good.

---

## 6. How the gap between short and long Treasury yields has moved · proposed `P2` · target section: ledger, new item (category `feature`, Macro Markets)

**Status:** APPROVED (owner, 2026-11-10, D222)

**In short:** Bonds & Rates shows today's gap between the 2-year and 10-year yields, and between the 3-month and
10-year. Add their history, from one month to ten years, with the stretches when short yields were above long ones
("inverted") marked, from the official Treasury figures the yield charts already read.

**What a reader would get:** A chart of both gaps over a chosen range on `/macro/rates`, the inverted stretches
shaded, and when the current stretch began. The macro AI's yield-curve tool can return the same.

**Why it matters:** The page already calls an inverted curve "the classic recession signal" while showing only
today's reading. Whether the curve has just turned, or has been inverted for two years, is the context a reader
needs to make sense of today's number.

**Grounded in:** `RatesClient.tsx` shows `spread2s10s` and `spread3m10y` for today only. `spreadsOf(snapshot)`
(`lib/server/treasuryCurve.ts`) works both out from one day's curve, and `fetchYieldHistory` (T-446) already reads the
Treasury's whole yearly curve files, every maturity of every day, to chart a single yield.

**What it would take:** Half a day to a day. Pure and tested, plus a methods-page line. No key, no new host, no
recurring cost: the files are the ones the yield charts already fetch.

**Honest limits:** Facts only: no recession odds, no signal, no forecast. Readings are daily up to a year and weekly
beyond, as on the yield charts.

**Depends on:** Nothing.

**Decision needed from you:** None.

*Importance:* Medium for Macro readers. · *Efficiency:* Very high: arithmetic on files already fetched.
· *Practicality:* Very good.

---

## Next in line (cut to keep the list short)

Each passed every check above and could be written up in full on request.

- **A backup for CoinGecko on the alert bell.** The coverage matrix lists the bell among five working surfaces
  CoinGecko alone carries. DefiLlama's price service (already in the app) takes CoinGecko's own coin ids and gives a
  24-hour change. It shows the reader nothing new unless CoinGecko fails, which is why it is not above. The other
  surface this was paired with last time, `portfolio-history`, turns out to be read only by the hidden Portfolios
  Backtest tab, so it is out of scope.
- **A "this week" strip on Headlines:** the next Fed meeting and CPI, jobs, GDP and PCE dates, and earnings dates for
  stocks on your watchlists and portfolios. Every table and route exists (T-456, T-458). It overlaps the watchlist's
  earnings marks and the Macro calendar card, which is why it is second.
- **How often each stablecoin has strayed from its peg,** over 90 days, from DefiLlama's stablecoin price history
  (the host the Reserves tab already reads). Its fields need one read to confirm before it can be proposed properly.
- **Funds in the catalog that hold this stock,** on each stock page. Still needs about 130 filings read each day, or
  the quarterly data set built offline.

## Considered and cut

- **Proposal 1's returns as a backup in the Fund Registry's Returns column.** Each fund's filed figure ends on a
  different month, so a column, and any sort on it, would set unlike periods side by side as though they matched.
- **A P/E over the last four quarters, from proposal 3's figures.** D167 decided P/E uses the latest full year.
- **Tax owed, tax rates or short- and long-term labels on proposal 2's sales.** Tax figures are what
  `taxCharacter.ts`'s rule and T-058's legality question keep out of the app.
- **Daily oil and gas prices from the US Energy Information Administration,** for the commodity pages. A new host,
  whose terms would need reading first, and I could not tell from here whether those prices are the agency's own or a
  data vendor's it republishes; FRED was cut on 2026-11-06 for the same reason. Worth a reading if you want energy
  prices, but not proposed on a guess.
- **Tokenized gold's price as a stand-in for gold's.** A token's price wearing gold's name, the reason a home-made
  Dollar Index was cut on 2026-11-06.
- **Positioning data for futures markets from the CFTC.** No grounding in the project's documents.
- **Saving options positions (T-060, D216), live Layer 2 gas (T-057, D217) and the API and MCP half of T-457.** Each
  was parked by a decision this month.
- **Hidden surfaces** (backtests, Transfer Fees, Wallets, the Trade Risk Scorer). Unchanged, and each your call.
- **Anything with a score, grade or rank,** for the reasons in RP-3, RP-6 to RP-8, D14, D26, D64 and D92.

---

*Noticed in passing:* nothing for the code-auditor this time. The two agent-description slips noted on 2026-11-07
(`search_securities`' typed counts, the Assistant's description of tracked portfolios) are both fixed in today's tree.
