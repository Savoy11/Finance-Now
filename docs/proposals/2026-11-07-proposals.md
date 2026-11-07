# Opportunity proposals — 2026-11-07

**Commit:** `98dde21` (`claude/dazzling-volta-lbbz61`, "Merge main after #483", D206 included) · **Reviewed:**
`.claude/agents/opportunity-scout.md`; `README.md`; `CLAUDE.md`; `docs/ROADMAP.md`; `docs/TASK-QUEUE.md` (section
list); `docs/audits/rejected-proposals.md` (RP-1 to RP-8 and the not-a-rejection notes); the ledger
`docs/audits/task-queue-2026-09-07.json` (392 items: 248 closed, 131 parked, 8 open, 5 blocked); owner decisions
D194 to D206 (`docs/decisions/2026-11-06-owner-decisions.md`, `2026-11-07-owner-decisions.md`), with D47 and D92;
`docs/audits/code-audit-2026-11-07.md`; `docs/proposals/2026-11-06-proposals.md`, `2026-09-22-proposals.md` and
`2026-09-08-proposals.md`; `docs/MARKET-ASSESSMENT.md` §3 to §8; `docs/FEATURE-ADDITIONS.md`;
`docs/BUSINESS-CHECKLIST.md` §5; `docs/audits/coverage-matrix-2026-10-14.md`; and source: the agent tools and
prompts, the Daily Brief, the Portfolio Builder drift check, the tracked-portfolio screens and ledger engine, the
N-PORT parser and fund holdings route, the market and IPO calendar routes, the macro pages and macro news route,
Headlines, the price-alert store and monitor, the watchlist store, the Compare and Research deep links, and the
draft Privacy Policy (`lib/legal/disclosures.ts`). · **Proposals:** 6

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*How to read the ratings:* **Importance** = what the product and its users gain · **Efficiency** =
that gain for the work it takes · **Practicality** = how ready it is (dependencies, risk). `P0`/`P1`/`P2`
is the net of the three. Effort is given in rough working days for one developer.

> **Checks every proposal passed.** None publishes a score, grade, rating or ranking of an asset,
> provider or holding (RP-3, RP-6, RP-7, RP-8, D14, D26, D64, D92). The one new figure about a user's own
> money, proposal 1(d), is plain arithmetic on their own trades, the same kind of figure as the FIFO gains
> the page already shows; D92's line is about risk ratings and is not crossed. None needs a paid plan
> (D21), and proposal 6 removes a single-vendor dependency. None fetches a new host: every source below is
> already in the source-terms registry and already called by the app. One part needs terms readings,
> proposal 4(d): two federal agencies' release calendars, to be copied by hand like the Fed's meeting
> dates and never fetched. No mock data, no deletion of project files, no hidden surface restored, and no
> parked item un-parked. Nothing below is an existing ledger item.
>
> **Five earlier proposals are folded in.** Proposals 2, 4 and 5 take in five of the nine proposals still
> waiting for your ruling (the table below). Each says which, so marking it settles those too.
>
> **No network requests were made from this session.** Nothing went to sec.gov or data.sec.gov, and the
> app was not started. Proposal 3 rests on what the SEC's N-PORT form asks of every holding, not on a
> filing read today; its first build step is one real filing, read on your machine.
>
> **What this pass looked for.** Everything D197 approved is built (T-445 to T-452) and the audit's
> findings are fixed (D206). So this pass looks first at what that work made possible and has not yet
> reached, then at the gaps around it.

---

## Still waiting on your ruling from earlier passes

Nine proposals from the 2026-09-08 and 2026-09-22 passes carry no marking and none is in the ledger. Each
was re-checked in today's tree.

| From | Proposal | State on 2026-11-07 | In this file |
|---|---|---|---|
| 2026-09-08 #1 | A way to create a price alert | Still unbuilt. The monitor runs on every page; nothing calls `usePriceAlertStore.addAlert` | **Folded into proposal 2** |
| 2026-09-08 #2 | "Add to watchlist" from detail pages | Still unbuilt. Only `/watchlist` calls `addKey` | **Folded into proposal 2** |
| 2026-09-08 #3 | Fund risk profile (T-353) | Overtaken by D92: funds get facts from their own documents, not a rating | Suggest marking it REJECTED, reason D92 |
| 2026-09-08 #4 | Macro stories on Headlines | Still unbuilt. Headlines has crypto and markets sections only | **Folded into proposal 4** |
| 2026-09-08 #5 | Funds and SEC fundamentals on `/api/v1` and the MCP server | Still unbuilt. `/api/v1` has no fund, fundamentals or reserves route | **Folded into proposal 5, part (b)** |
| 2026-09-22 #1 | Measure what survives dropping a vendor | Done in substance by T-439 (D110, D112) | Suggest APPROVED-and-done, or REJECTED as superseded |
| 2026-09-22 #2 | Links into Compare from where you are | Still unbuilt. The sidebar entry is still the only link to `/compare` | **Folded into proposal 2** |
| 2026-09-22 #3 | Show the date behind staking backup rates | Still unbuilt. `fallbackProvenance` is built in `lib/server/stakingRates.ts` and rendered nowhere. The weekly refresh (D186) keeps the date fresh, so showing it is cheaper and more useful than when proposed | Not folded; still yours to mark in its own file |
| 2026-09-22 #4 | "Analyze with AI" on coin and macro pages | Still unbuilt. Only the stock page links to `/research` | **Folded into proposal 2** |

---

## 1. Make tracked portfolios the ones the rest of the app reads · proposed `P1` · target section: ledger, new item (category `feature`, Portfolios → Tracked)

**Status:** APPROVED (owner, 2026-11-07, D207: all six approved; the decision each one names is asked when it is built)

**What:** Since this week a tracked portfolio holds real history: imported trades (T-447), income (T-451)
and its fund costs (T-448). But everything else in the app that talks about "your portfolio" still reads only
the what-if portfolios. Four parts, each can be approved on its own:

- **(a) Daily Brief** includes the tickers held in tracked portfolios. Tickers only, never quantities or costs.
- **(b) Look-through and asset-class split** on each tracked portfolio, from live values: what you really own
  through your funds, and how the money splits across coins, stocks, funds and so on. The what-if Analysis tab
  already shows both.
- **(c) Portfolio Builder's drift check** can compare a saved plan with a tracked portfolio's real holdings,
  not only with a what-if portfolio or weights typed in by hand.
- **(d) What your money has earned per year.** One figure per tracked portfolio: the yearly rate that turns
  what you put in, and when you put it in, plus the income and sales you took out, into what the holdings are
  worth today. A portfolio under a year old shows its plain total return instead, since a yearly rate on a few
  weeks exaggerates.

**Grounded in:**
- **Brief:** `app/(dashboard)/brief/page.tsx` reads `usePortfolioStore` (the what-if portfolios) and the
  watchlists. Its own comment says it "grounds the prompt in the user's actual portfolio + watchlist
  symbols", but tracked portfolios never reach it: a tracked portfolio is marked by a `tracked_portfolios`
  row, and the what-if routes leave it out. The draft Privacy Policy already says "Daily Brief sends ticker
  symbols from your portfolios and watchlists, never quantities or costs" (`lib/legal/disclosures.ts`), so
  (a) stays inside that sentence as long as it sends tickers only.
- **Look-through:** `computeLookThrough(positions, holdingsByFund)` (`lib/data/lookThrough.ts`) needs only
  weights, and `valueLedger` (`lib/data/tradeLedger.ts`) gives each tracked holding's live value. The
  component, `PortfolioLookThrough`, takes a what-if `Portfolio`, so it needs a small adapter.
  `TrackedPortfolioDetail.tsx` shows five tiles, Holdings, Costs and Trades, and no look-through or split.
- **Drift:** `components/portfolio-builder/PlanMonitor.tsx` lists only `usePortfolioStore` portfolios. A
  saved plan's link, `builder_plans.linked_portfolio_id`, references `portfolios.id`, and a tracked portfolio
  is a `portfolios` row, so linking one needs no migration.
- **Return per year:** the ledger holds every dated buy, sell, starting position and income entry
  (`TRADE_SIDES` in `lib/db/schema/invest.ts`, `computeCostBasis` in `lib/data/costBasis.ts`), and the page
  already has live values. Today it shows gains in dollars, which cannot tell a reader whether a $5,000 gain
  on $20,000 over six years is good or poor.

**Who benefits and how:** Everyone who imported their history this week, the owner first. The features that
speak about "your portfolio" (the Brief, the look-through, the plan check) start speaking about the real one,
and the portfolio answers the question people ask first: how has my money done each year?

**Cost:** About 4 to 5 days in all: (a) half a day, (b) one day, (c) one day, (d) one and a half to two days.
(d) is pure and tested in `lib/data/`, with an injectable `now` (the house rule for any figure a user acts
on), and gains a paragraph in the methods page's "Tracked portfolios: gains and income" section (D163). No
key, no host, no migration, no recurring cost. A holding with no live price stays out of every figure and is
named, as it is out of "Value now" today. No tax rule is applied (`REALIZED_METHOD_LABEL`). Nothing is rated
(D92).

**Depends on:** Nothing.

**Decision needed from you:**
1. **For (c):** the drift check lists the buys and sells that would bring holdings back to the plan. Today it
   does that for a what-if portfolio or typed weights; pointed at a tracked portfolio, those become trade lists
   for real money. D47 cleared the builder without a legal review, and D47 also cleared the advice clause of
   T-116's blocker, so I read this as inside what is already live. It is still a step worth your yes.
   Recommended: yes, with the builder's existing not-advice line beside it.
2. **For (d):** yearly figure only once a portfolio is a year old, with a plain total before that
   (recommended), or the yearly figure always.

*Importance:* High: real holdings finally reach the features built around a portfolio. · *Efficiency:*
High: every part reuses a tested engine. · *Practicality:* Very good: one yes for (c), one choice for (d).

---

## 2. One row of actions on every asset page: watch it, set an alert, compare it, ask the AI · proposed `P1` · target section: ledger, new item (category `feature`, core, cross-module)

**Status:** APPROVED (owner, 2026-11-07, D207: all six approved; the decision each one names is asked when it is built)

**Folds in four earlier proposals:** 2026-09-08 #1 (price alerts), 2026-09-08 #2 (add to watchlist),
2026-09-22 #2 (links into Compare) and 2026-09-22 #4 ("Analyze with AI" for coins and macro). Marking this
one settles those four.

**What:** One shared row of buttons at the top of every coin, stock, fund and macro instrument page:
- **Add to watchlist**, choosing which list. Every page.
- **Set a price alert**, above or below a price you type. Coin, stock and fund pages. Plus a short list of your
  alerts (on the Watchlist page) where each can be seen, removed or re-armed.
- **Compare**, which opens `/compare` with this asset already chosen.
- **Ask the AI**, which opens Research with this asset and its module's agent. The stock page has this today;
  the row brings it to coins, funds and macro instruments.

**Grounded in:**
- **The alert machinery is built and nothing feeds it.** `usePriceAlertMonitor` runs from the dashboard layout
  on every page, checks prices once a minute, shows a message and a browser notification, refuses to fire on a
  reference price, and carries the CoinGecko credit (`hooks/usePriceAlertMonitor.ts`). `usePriceAlertStore`
  has `addAlert`, `removeAlert` and `rearmAlert`. No component calls any of them.
- **The business case names alerts.** The market assessment's positioning sentence promises the product
  "watches your pegs and positions", and its pricing table puts "limited alerts" in Free and "full alerts" in
  Pro (`docs/MARKET-ASSESSMENT.md` §5). The bell watches pegs; nothing watches a user's positions.
- **Watchlist:** `useWatchlistStore.addKey` is called only on `/watchlist`. A reader on Apple's page has to
  leave it, open Watchlist and search for Apple again.
- **Compare and Research already take links:** Compare reads `?symbols=` and Research reads `?symbol=` and
  `?agent=`. Only `equities/[symbol]/page.tsx` links to either; the sidebar is the only way into Compare.

**Who benefits and how:** Every reader of every asset page. Each page stops being a dead end and becomes the
start of the app's own loop: watch it, get told when it moves, see it in the Brief.

**Cost:** 2 to 3 days. One shared component in `components/markets` (module rule 1). No key, host or recurring
cost. Honest limits stated beside the alert form: an alert fires only while Finance Now is open in a browser,
since alerts are kept on the device (as the draft Privacy Policy already says); a stock or fund alert needs a
live quote, so a quote key, because the monitor never fires on a reference price. No alerts on macro
instruments: most of their quotes are unserved, and the alert text is in dollars while grains are quoted in
cents and yields in percent.

**Depends on:** Nothing.

**Decision needed from you:** None required. Later, at launch with sign-in: whether alerts move from the
browser into your account, so they follow you between devices.

*Importance:* High: it touches every asset page and switches on a built feature. · *Efficiency:* High: the
store, monitor and deep links exist. · *Practicality:* Very good.

---

## 3. Where a fund invests: countries and currencies, and for bond funds, who borrowed and when it is repaid · proposed `P1` · target section: ledger, new item (category `feature`, ETFs & Funds)

**Status:** APPROVED (owner, 2026-11-07, D207: all six approved; the decision each one names is asked when it is built)

**What:** On each fund page, beside the asset mix it already shows:
- **(a) Countries and currencies:** how the fund's money splits by the country of the companies or governments
  it holds, and by the currency those holdings are in.
- **(b) For bond funds, who borrowed and when it is repaid:** the split by kind of borrower (US Treasury,
  government agencies, companies, cities and states, foreign governments) and by when the bonds fall due (under
  1 year, 1 to 3, 3 to 5, 5 to 10, 10 to 20, over 20).
- **(c) Optional:** the country split across a whole portfolio, on the Look-through tab (and on tracked
  portfolios, with proposal 1(b)).

All from the fund's own SEC filing, dated by its report date, with each split's coverage shown.

**Grounded in:**
- `/live-data/fund-holdings` already downloads each fund's full N-PORT filing and reads every holding in it
  (`lib/server/nport.ts`, `parseNportReport`). It keeps each holding's ticker, name, identifiers, units, value,
  weight and asset category, and drops the rest.
- The form asks more of every holding. Its Part C asks for the issuer's country, the holding's currency, the
  issuer type, and for a bond its maturity date and coupon. In the filing's XML these are `invCountry`,
  `curCd`, `issuerCat` and `debtSec`'s `maturityDt`. None is parsed. (These names are from the SEC's published
  form, not from a filing read today; see Depends on.)
- This is the move the app has made before. NT9 derived the stock/bond/cash mix from `assetCat` in the same
  filing because the sector chart needs an FMP key (`fund-holdings/route.ts`); country and currency are the
  same kind of keyless fact.
- Today the international funds (VXUS, VGK, EWJ, VSS, BNDX, EMB among them) cannot say which countries they
  hold, and a bond fund's "If Rates Move" card gives its duration but not what kind of borrower stands behind
  it or when the bonds are repaid. The Portfolio Builder's own notes say "VXUS already carries unhedged FX
  exposure"; the currency split is that fact, measured from the filing.

**Who benefits and how:** Anyone holding an international or bond fund, and the "what do I really own"
question the Look-through tab exists to answer, taken one level further.

**Cost:** 2 to 3 days for (a) and (b), one more for (c). No key, no new host, no recurring cost: the filing is
already fetched and cached. Pure, tested aggregation in `lib/utils/`, like `assetMix.ts`, and methods-page
lines (D163). Honest limits to state on the page: a holding's country is the issuer's country as the fund
reports it (a company's home, not where it sells); some filers leave fields blank, so each split shows how much
it covers, as the asset mix does; N-PORT carries no credit ratings, so there is no "quality" split, and none is
implied; and trusts such as SPY file no N-PORT, so nothing shows for them.

**Depends on:** One real N-PORT filing as a test fixture, read on your machine, to confirm the field names
before the parser relies on them. This session sends nothing to the SEC, whose requests carry your email as
the contact. IEF's and BND's interest-rate sections went into `nport.test.ts` the same way, copied from real
filings.

**Decision needed from you:** None required. Optional: part (c).

*Importance:* Medium to high: facts every international and bond fund holder looks for. · *Efficiency:* Very
high: the data is already downloaded. · *Practicality:* Good: one fixture to read first.

---

## 4. The Macro module: Fed meetings, release dates and news where its readers look · proposed `P1` · target section: ledger, new item (category `feature`, Macro Markets)

**Status:** APPROVED (owner, 2026-11-07, D207: all six approved; the decision each one names is asked when it is built)

**Folds in one earlier proposal:** 2026-09-08 #4 (macro stories on Headlines), as part (c).

**What:** Four parts, each can be approved on its own:
- **(a) Fed meetings on the Macro pages.** "Next Fed meeting" on `/macro` and `/macro/rates`, and the year's
  schedule on Bonds & Rates, from the same hand-kept table the Equities calendar uses. The macro AI agents get
  the calendar too.
- **(b) News on each instrument's page.** Each commodity, currency and yield page shows the macro stories that
  name it.
- **(c) A Macro section on Headlines** for readers who have the Macro module on.
- **(d) Official US release dates:** inflation (CPI), the jobs report, GDP and PCE inflation, in a hand-kept
  table copied from the Bureau of Labor Statistics' and the Bureau of Economic Analysis' published schedules,
  with a review clock like the Fed table's. Shown on the Macro pages and on the Equities calendar.

**Grounded in:**
- **Fed dates:** `lib/data/fomcCalendar.ts` (keyless; the Federal Reserve Board is in `sourceTerms.ts`; a
  90-day review clock) is read only by `/live-data/market-calendar` and `/equities/calendar`. No Macro page
  mentions the Fed's meetings. A reader with Macro and without Equities never sees when the Fed meets, the date
  that moves rates and currencies most.
- **The macro agents cannot see them either.** `get_market_calendar` is tagged `market: 'equities'` in
  `lib/agents/tools.ts`, and `toolsForAgent('macro')` gives an agent only macro-tagged tools. So `macro-research`
  cannot answer "when is the next Fed meeting", a question the calendar tool's own description says it answers.
- **News:** `/live-data/macro-news` already tags each story with the instruments it names (`related`, each with
  that instrument's page address, from `detectRelated`). Only `/macro/news` reads the tags. Coin, stock and fund
  pages all show their news; the 45 macro pages show none.
- **Headlines** renders a section per enabled module (`headlines/page.tsx`: crypto, and "markets" for Equities
  and Funds). Macro is the one module with a news feed and no section.
- **Release dates:** FMP's economic calendar is paid-only, and the Feature floor accepts `/equities/calendar`
  with its "economic calendar empty on the free tier" (`docs/BUSINESS-CHECKLIST.md` §5.1.1). Part (d) is the
  free way to fill it, as the Fed table filled the meeting rows on 2026-10-03.

**Who benefits and how:** Macro module readers (a paid module) and its two AI agents, who gain the dates and
the stories that matter to what they are looking at; Equities calendar readers too, for (d).

**Cost:** (a) half a day, (b) half a day, (c) half a day to a day, (d) one to two days, then a re-copy once a
year when the agencies publish the next year's schedule, and a check whenever a date moves (they have moved
releases before). No key, no recurring cost. (a) to (c) use only what the app already reads. (d) needs two terms
readings, bls.gov and bea.gov, each registered like the Fed (copied by hand, never fetched). Both are federal
agencies whose own material is usually public domain, but that is to be read, not assumed; bls.gov tends to
refuse automated reads, so the reading may have to be in your browser.

**Depends on:** Nothing for (a) to (c). For (d), the two readings.

**Decision needed from you:** None for (a) to (c). For (d): yes or no now, and which releases (recommended: CPI
and the jobs report, which the calendar tool's description already names, plus GDP and PCE inflation).

*Importance:* Medium to high: a paid module gains the dates and news its readers come for. · *Efficiency:* Very
high for (a) to (c), which reuse what is in hand. · *Practicality:* Very good for (a) to (c); good for (d).

---

## 5. Let the AI see the Funds module and the Reserve Monitor · proposed `P2` · target section: ledger, new item (category `feature`, AI agents)

**Status:** APPROVED (owner, 2026-11-07, D207: all six approved; the decision each one names is asked when it is built)

**Folds in one earlier proposal:** 2026-09-08 #5 (funds and SEC fundamentals on `/api/v1` and the MCP server),
as part (b).

**What:**
- **(a) Two tools for the in-app agents** (the Assistant, Research and the Daily Brief). **Fund details:** a
  fund's holdings and asset mix from its filing, its duration where filed, its net assets and their date, and
  its prospectus link. **Stablecoin reserves:** each monitored stablecoin's price against its peg, its supply
  change over 1, 7 and 30 days, its split across blockchains, and the issuer's last attestation with the date
  that says how old that curated part is. Both read the routes the pages read.
- **(b) The same two, plus the SEC fundamentals behind `get_stock_financials`,** on `/api/v1` and the MCP
  server.

**Grounded in:**
- The agent tools are tagged crypto (8), equities (12) and macro (6) (`lib/agents/tools.ts`). None reads
  `/live-data/fund-holdings` or `/live-data/reserves`. For funds the only tool is `search_securities`, which
  returns the catalog's indicative top holdings, not the filing. For stablecoins an agent has a price and
  nothing more: the Reserve Monitor, the crypto module's best-known surface, which gained supply change this
  week (D204), is invisible to every agent.
- Tools read the same routes as the pages (one source of truth), and credits travel on their own:
  `runToolWithCredits` collects each response's required credit (D101), so a new tool needs no credit work.
- The market assessment counts the agent-facing surface among the four things the product wins on (§4, item 3),
  and "5 external consumers of the API/MCP surface" is one of its go/no-go milestones (§8). `app/api/v1/` has no
  fund, fundamentals or reserves route today.

**Who benefits and how:** Anyone asking the Assistant or Research about a fund they hold or a stablecoin they
use, who today gets an answer from the catalog or a web search rather than the app's own filing data; and you,
through the MCP server in Claude Desktop, for (b).

**Cost:** (a) one to two days. (b) about two days: routes, the OpenAPI file, MCP tools, and the key guard every
`/api/v1` route carries (D173). No key, no host, no recurring cost. After (a), re-running the agent evaluation for
the agents that gain a tool is worth doing on your machine; it bills a few dollars, so it is your call (D20).

**Depends on:** Nothing for (a). For (b): the reserve figures come from DefiLlama, which publishes no terms
document. That is fine before launch (D96), and the enquiry to DefiLlama is parked under T-425, so a reserves
endpoint carries the same launch step the Reserves tab already does.

**Decision needed from you:** (a) alone, or (a) and (b). Recommended: (a) now, and (b) when you want the MCP
server to cover funds.

*Importance:* Medium. · *Efficiency:* High: thin tools over routes that exist. · *Practicality:* Very good.

---

## 6. The next earnings date where you look, with a second source · proposed `P2` · target section: ledger, new item (category `feature`, Equities)

**Status:** APPROVED (owner, 2026-11-07, D207: all six approved; the decision each one names is asked when it is built)

**What:** Show the next expected earnings date on each stock page, mark stocks on a watchlist whose earnings
fall in the next two weeks, and add a "my watchlist only" switch to the Market Calendar. Add Alpha Vantage's
earnings calendar as a second source behind FMP, so earnings dates survive losing FMP.

**Grounded in:**
- Earnings dates appear only on `/equities/calendar` and through the agents' calendar tool. `equities/[symbol]`
  and `/watchlist` show none.
- FMP is the only source: `/live-data/market-calendar` reads earnings from `financialmodelingprep.com/stable`
  and nothing else. D21 asks that losing any one vendor degrade a surface rather than remove it.
- Alpha Vantage is already in the app on the same free key: `/live-data/ipo-calendar` calls its
  `IPO_CALENDAR`. Its `EARNINGS_CALENDAR` is the sister call: one request returns every US company's expected
  dates for the next three months, so one call a day covers every stock.

**Who benefits and how:** Anyone holding or watching a stock. The earnings date is one of the few dates known
in advance to move a stock, and today a reader has to go to the calendar to find it.

**Cost:** 1 to 2 days. No new host, no recurring cost. Alpha Vantage's terms entry (`conditional`, verified
2026-09-26) allows 25 requests a day on the free tier, for personal use: one call a day fits beside the IPO
calendar's four and the quote ladder's Alpha Vantage rung, and everything before launch is personal use (D96);
the launch step is already on the entry. Dates are labelled "expected": companies often confirm late, and a date
can move.

**Depends on:** Nothing. An Alpha Vantage key, which the IPO calendar already needs.

**Decision needed from you:** None.

*Importance:* Medium. · *Efficiency:* High: one daily call on an existing key. · *Practicality:* Very good.

---

## Next in line (cut to keep the list short)

Each passed every check above and could be written up in full on request.

- **A backup for CoinGecko on the alert bell and portfolio history.** The coverage matrix lists five working
  surfaces CoinGecko alone carries, `alerts` and `portfolio-history` among them. DefiLlama's price API takes
  CoinGecko's own ids, and `portfolio-prices` already falls back to it; the bell's depeg half needs only a price.
  Less urgent since the Demo key (T-105) ended the refusals on 2026-10-15.
- **Funds in the catalog that hold this stock,** on each stock page: the reverse of the fund pages' links to
  their holdings. It needs about 130 filings read once a day on your machine, or the quarterly N-PORT data set
  built offline.
- **The gap between the 2-year and 10-year Treasury yields over time,** from the curve history T-446 now reads
  (`fetchCurveYear`): arithmetic on figures already fetched.
- **The Costs card on the what-if Look-through tab,** T-448's optional extra, not built.

## Considered and cut

- **Treasury yields and currency pairs in Compare, watchlists and portfolios.** Decided on 2026-11-07 (D202,
  D203): on their own pages only.
- **A bell alert when a stablecoin's supply falls.** Decided (D204): figures only.
- **A value-over-time chart for tracked portfolios.** It still needs keyed price history for every stock and fund
  held. Proposal 1(d) answers "how has my money done" without any history.
- **A tracked portfolio's return against an index** ("the same money put into VOO"). Same keyed history; worth
  another look after 1(d).
- **Expected income over the next 12 months on a tracked portfolio.** Most fund yields are withheld under D166
  (shown only where the fund's site allows it), so the figure would be partial in a way a reader would take for
  complete.
- **Sectors for the stocks outside the 79 on the SEC list (T-450).** One SEC request per company, or the SEC's
  bulk company file; little gain for the cost.
- **Price alerts on macro instruments.** Most of their quotes are unserved, and their units (cents, percent) do not
  fit a dollar alert.
- **Insider filings (Form 4).** Parsing work, still with no grounding in the project's documents.
- **Hidden surfaces** (backtests, Transfer Fees, Wallets, the Trade Risk Scorer). Unchanged since 2026-11-06, and
  each your call.
- **Anything with a score, grade or rank,** for the reasons in RP-3, RP-6 to RP-8, D14, D26, D64 and D92.

---

*Noticed in passing, for the code-auditor:* the `search_securities` agent tool still describes "~70 US large-cap
stocks, ~55 ETFs/mutual funds" (`lib/agents/tools.ts:276`, a typed count against 79 and 140), and the Assistant's
description of tracked portfolios (`lib/agents/prompts.ts:260`) lists "starting positions, buys, sells, splits" with
no word of file import (D200) or income (D201), so it may tell a user neither exists.
