# Opportunity proposals — 2026-11-25

**Commit:** `8c20b29` (`claude/upbeat-allen-cru6ir`, tree identical to main `180e6b6`) · **Reviewed:**
`README.md`; `CLAUDE.md` (full); `docs/ROADMAP.md`; the ledger `docs/audits/task-queue-2026-09-07.json`
(422 items: 284 closed, 120 parked, 7 open — all seven wait on you or counsel, so the build pipeline is empty;
every parked title read); `docs/audits/rejected-proposals.md` (RP-1–RP-9 + the not-rejections);
`docs/proposals/2026-11-22-proposals.md` (all five approved under D242, all built by 2026-11-24) and the
2026-11-07 pass's cut list; owner decisions D234–D244 (`2026-11-21-…`, `2026-11-24-owner-decisions.md`);
`docs/audits/code-audit-2026-11-24.md`; `docs/MARKET-ASSESSMENT.md`; `docs/FEATURE-ADDITIONS.md`;
`docs/assessments/counsel-brief-2026-10-26.md` (A15). Source read, not skimmed:
`frontend/scripts/build-stock-holders.ts` + `scripts/lib/form13f.ts`; `src/lib/data/stockHolders.ts` +
`stockHolders.generated.json` (structure); `components/markets/StockOwnershipCards.tsx`;
`src/lib/utils/holdingsDiff.ts` and the fund page's `FundHoldingsHistory.tsx`; `lib/db/schema/audit.ts`,
`lib/auth/auditEvents.ts`, `lib/server/auditLog.ts`; `lib/data/trackedPortfolioViews.ts` (`moneyFlows`,
`moneyWeightedRate`); `lib/api/live/marketData.ts` (chart `basis`); `app/(dashboard)/brief/page.tsx` +
`app/api/agents/research/route.ts`; `lib/agents/tools.ts` (equity toolset). · **Proposals:** 5

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*How to read the ratings:* **Importance** = what the product and its users gain · **Efficiency** =
that gain for the work it takes · **Practicality** = how ready it is (dependencies, risk). `P0`/`P1`/`P2`
is the net of the three. Effort is in rough working days for one developer.

> **Nothing is carried forward.** The 2026-11-22 pass's five proposals were all approved (D242) and all
> built and merged by 2026-11-24 (T-466–T-470), plus T-471/D243/D244 at your own request. Nothing was
> deferred, so this pass starts clean.
>
> **Checks every proposal passed.** None publishes a score, grade, rating, or ranking of an asset, provider
> or holding, and none tells a reader what to do (RP-3, RP-6–RP-9, D14, D26, D64, D92) — every new figure is
> a filed or computed fact with its source, date and limits beside it. Proposal 1 keeps the shipped
> ownership card's own vocabulary (facts, dates, "largest") and explicitly does NOT build a cross-stock
> "most bought" list — that would be a leaderboard over a universe, the item-4 line. None needs a paid plan
> (D21), none fetches a new host (proposal 1 reads a second file from the same SEC data-set index the
> 2026-11-24 build already read; proposals 2–5 fetch nothing the app does not fetch today), none restores a
> hidden surface, and none un-parks a parked item — proposal 3 names T-193 and leaves it parked; proposal 5
> names T-457's parked API/MCP half and stays off it. None is an existing ledger item (keyword-checked
> against all 422). Proposal 2 re-raises something two scout passes cut, and says exactly what changed.
>
> **One network request was made from this session:** a single GET of the SEC's 13F data-set index page (to
> check whether the 2026-09-30 period set is published), which SEC.gov answered with its rate-threshold
> page — so that fact is stated below as unverified. No provider or publisher host was contacted.

---

## 1. Institutional ownership change on stock pages: the quarter-over-quarter 13F diff · proposed `P1` · target section: ledger, new item (category `feature`, Equities — stock pages; owner_role `either`)

**Status:** APPROVED — owner, 2026-11-25: “Let’s apply all 5”

**What:** Extend the "Who Holds It" card (T-471) with what changed since the previous 13F quarter, per
stock: the change in total reported institutional shares and in the number of reporting managers, and the
largest position changes among managers — biggest increases, biggest reductions, largest new stakes and
largest exits, each in shares with both quarter-end dates shown. Same vocabulary as the card today: facts,
dates, "largest". **Deliberately not built:** any cross-stock "most accumulated this quarter" list (a ranked
universe is the shape item 4 removed; the one-stock diff is explanation of the asset the reader opened), and
no word like accumulation, conviction, bullish or smart money. While the card is being reworked, each top
manager's name also gains a link to its own SEC EDGAR filings page (CIK is already in the data) — today a
reader has no route from "Vanguard Group" to the primary source, against the house rule that sources travel
with figures.

**Grounded in:**
- **The data is collected and the time dimension is the one thing the card cannot answer.** The 2026-11-24
  build streams the full quarter's 3.83M rows through `foldInfoRow()`, which holds per-CUSIP, per-manager
  share totals in memory (`scripts/lib/form13f.ts:143-161`) — everything a diff needs — then keeps only one
  quarter's top ten. `npm run holders:build` takes `--set-url` for any quarter's zip
  (`build-stock-holders.ts:64,156`), so the second quarter is a second pass of code that exists. The
  2026-11-24 code audit closed with exactly this: *"the generated holders file records everything needed for
  a 'top institutional buyers/sellers vs last quarter' diff; that is the opportunity-scout's call"*
  (`docs/audits/code-audit-2026-11-24.md:165-166`).
- **You asked for this surface twice in one day** (D243: the ownership sections; D244: *"I want to confirm
  all searchable stocks are being considered"*) — demonstrated demand on exactly this card, not a scout's
  guess about interest.
- **The fund side already has this shape and stocks do not** (capability asymmetry): fund pages show a
  quarter-over-quarter holdings diff with added/exited/increased/decreased vocabulary
  (`FundHoldingsHistory.tsx`, `lib/utils/holdingsDiff.ts`). The stock side's ownership is a single point in
  time.
- **The hazards have named house guards.** A split between the two quarters would make every manager look
  like a buyer by the ratio — the card already withholds its percent on D170's share-count band
  (`institutionalPctWithheldForSplit`, `PCT_WITHHELD_SPLIT_NOTE`); the diff withholds the same way. A CUSIP
  retired between quarters (the BlackRock/Linde case D244 measured) must read "no comparison — the
  identifier was not in the prior quarter's filings", never "every holder is new". Amendment semantics
  (restatement vs add) are already per-quarter in `effectiveFilings()`. All pure, testable on synthetic rows
  like the existing `stockHolders.test.ts`.

**Who benefits and how:** Anyone reading a stock page: "is institutional money arriving or leaving, and
who moved" becomes checkable fact with both filing dates on it, beside the as-filed caveats the card already
carries (45-day lag, short-sale double counting). It deepens the surface you just commissioned rather than
opening a new one.

**Cost:** 2–3 days: the build computes the diff where the full data lives (two sets in one run), the file
gains a compact per-stock change block (~1–2 MB more on the committed 3.3 MB file — manager names reuse the
existing dictionary; cap the rows per direction if you want it smaller), pure diff rules + tests, the card
section, a methods-page line (D163). One extra ~100 MB set download per rebuild, cached. No key, no new
host, no recurring cost.

**Depends on:** The prior quarter's set URL confirmed on the index page at build time (the build's own
`latestSetUrl()` parses that page; the 2026-11-24 run proved this environment can fetch SEC sets). One fact
is unverified from here: whether the 2026-09-30 period set is published yet (filings were due 2026-11-16;
my one index-page request was refused with SEC's rate-threshold page). If it is out, the diff ships current
(Q3 vs Q2) and the whole card refreshes; if not, it ships as Q2 vs Q1 today and goes current on the next
scheduled rebuild (`STOCK_HOLDERS_BUILT_ON`, 120-day clock).

*Importance:* High — the owner-requested surface gains the question it exists to raise, on 4,269 stocks.
· *Efficiency:* High — the aggregation, resolution, guards and card all exist; the diff is a second pass
plus rendering. · *Practicality:* Good — one build-time URL check; every hazard has a shipped precedent.

---

## 2. A tracked portfolio beside "the same money in an index fund" — your decision first · proposed `P2` · target section: ledger, new item (category `decision` then `feature`, Portfolios — tracked; owner_role `owner-decision`)

**Status:** APPROVED — owner, 2026-11-25: “Let’s apply all 5”

**What:** On a tracked portfolio, one more pair of figures beside the T-453 return tile: the value the same
deposits and withdrawals would have reached if each had gone into one broad index fund (SPY or VOO, reader's
pick from a short fixed list), and that path's money-weighted rate — computed by replaying the portfolio's
own dated cash flows against the benchmark's dividend-adjusted closes. Two figures side by side, the method
named, the Builder's not-advice line beside them. **No verdict word** — not "underperformed", "beat", or any
colour-coding of the gap — and no figure at all where the portfolio's own rate is already withheld
(transfer out, unpriced holding), or where the benchmark history's `basis` is `unadjusted` (the rule
`StockBetaCard` already follows, D170).

**Grounded in:**
- **Two scout passes cut this without putting it to you, and the second cut's own reason is an argument for
  asking.** 2026-11-07 cut it as needing keyed history for every holding — re-examined on 2026-11-22 as
  wrong (the benchmark side needs ONE symbol's history) but cut again because the advice-adjacency
  *"deserves your yes before any build, not inside one"*. This proposal **is** the mechanism for that yes:
  nothing is built unless you approve, and if you reject, the rejection log finally records it with your
  reason instead of scouts re-cutting it forever. That is what changed — not the facts, but that the
  recorded objection is answered by proposing rather than by staying silent.
- **The parts exist and are tested.** `moneyFlows()` already turns a tracked portfolio's trades into dated
  cash flows and `moneyWeightedRate()` already solves the rate (`lib/data/trackedPortfolioViews.ts:207,239`)
  — the benchmark replay applies the same flows to `/live-data/security-chart` closes, whose first two rungs
  are dividend-adjusted and labelled per response (T-441, `marketData.ts:470-475`). Pure engine, injectable
  `now`, the `costBasis.ts` house pattern.
- **The precedent for approving advice-adjacent work with counsel attached is yours**: D237 built the
  drift-breach reminders now, with counsel brief A15 reviewing the advice edge before launch. If approved,
  this figure's question joins the brief beside A15 ("does a side-by-side with an index make the tracker
  comparative advice?") — asked before launch, like A15, not discovered after.

**Who benefits and how:** The users with real money recorded — the tracked page is where they are — get the
one question every tracker is opened to answer ("how did I actually do against just buying the index"),
computed honestly against their own deposit dates rather than a price chart. CoinStats/Delta, the market
assessment's closest price anchors (§3), treat performance-vs-benchmark as table stakes.

**Cost:** 1–1.5 days after your yes. One history request per benchmark choice (the app's existing keyed
ladder; SPY history serves on the free Tiingo key today, with T-470's FMP rung behind it). A methods-page
entry. No new host, no recurring cost.

**Depends on:** Your decision, explicitly — approve, reject with the reason for the log, or defer to
counsel's A15 sitting. A cash flow dated before the benchmark history's start withholds the figure with the
reason (no guessing backwards).

*Importance:* High if approved — the most-asked portfolio question, answered with the user's own dates.
· *Efficiency:* High — two shipped functions plus one replay. · *Practicality:* Medium — gated on your
ruling and a counsel-brief addition; the build itself is routine.

---

## 3. Settings → Security activity: show an account its own audit-log rows · proposed `P2` · target section: ledger, new item (category `security`, Auth & accounts; owner_role `remote-dev`)

**Status:** APPROVED — owner, 2026-11-25: “Let’s apply all 5”

**What:** A Settings card (beside the Two-step sign-in panel) listing the signed-in account's recent
security events from the D235 audit log — sign-ins and refused sign-ins, password resets, two-factor
changes, recovery-code use, module grants, data exports — newest first, in the plain words the vocabulary
already carries. Built dark like its neighbours: renders nothing without a real session (`getSessionUserId`,
never the shared local user — the D233 rule), and a database without migration 0013 reads "not recording
yet", never an error.

**Grounded in:**
- **The data is written and nothing reads it back to the person it is about.** `lib/server/auditLog.ts`
  exports only `recordAudit()` — thirteen call sites write, zero surfaces read. The schema was built for
  exactly this query: `audit_log_user_idx` on `(user_id, at)` (`lib/db/schema/audit.ts:36`), and
  `AUDIT_EVENTS` already maps every event id to a user-facing sentence ("Signed in", "Two-step sign-in
  turned on" — `lib/auth/auditEvents.ts`), so the card is one session-scoped GET route plus a list.
- **It is the user-facing half of the protection D233 built.** Two-factor stops a break-in; seeing "Sign-in
  failed: wrong password, yesterday 03:12" is how an account holder notices one being attempted. T-088's
  hardening row closed with the log's existence; the log answering to its own account is the piece with
  user value.
- **No new personal data and no policy change:** the rows already belong to the account ("Download my data"
  exports them, T-452), no IP or browser string exists to show (D235's deliberate line), and the view
  displays only what is stored. T-193 (signed audit export, enterprise) is a different thing and stays
  parked untouched.

**Who benefits and how:** Every account holder after the launch flip — self-service answer to "did someone
try to get into my account", which is also one fewer owner-support question. Before launch it costs nothing
and rehearses nothing new (the rehearsal harness already proves the log fills).

**Cost:** ~1 day: `/api/user/security-activity` (GET, session-only, newest N), the Settings card, tests on
the D233 pattern (session-only, missing-table behaviour). No migration, no host, no recurring cost.

**Depends on:** Nothing. Visible value arrives with launch, and that is stated rather than hidden.

*Importance:* Medium — invisible today, standard and genuinely protective the day accounts are real.
· *Efficiency:* High — the vocabulary, index and patterns all exist. · *Practicality:* Very good.

---

## 4. Ground the Daily Brief's "what's ahead" in the dates the app already knows · proposed `P2` · target section: ledger, new item (category `feature`, core — Daily Brief; owner_role `remote-dev`)

**Status:** APPROVED — owner, 2026-11-25: “Let’s apply all 5”

**What:** When the Brief's prompt is assembled, append the same facts T-468's "Coming up" strip shows — the
next Fed decision, the next CPI/jobs/GDP/PCE release, and the user's watchlist/held stocks reporting within
14 days — as given context with their publishers named ("CPI release 2026-12-10, per the BLS schedule";
earnings dated "expected, per <source>", T-458's labelling), gated by the entitlement store exactly as the
strip is. The agent writes "Worth watching" from dates the app knows instead of what web search happens to
find.

**Grounded in:**
- **The Brief asks for exactly this and cannot reach it.** Its task says *"Worth watching — 2-3 upcoming
  considerations"* (`brief/page.tsx:95`), but it runs `research-analyst` — the crypto toolset
  (`api/agents/research/route.ts:52`) — which has no `get_economic_calendar` (macro toolset) and no earnings
  tool, while briefing a cross-module universe of stocks, funds and coins. Today the section is whatever the
  agent's web search surfaces, for users whose page one screen away shows the real dates.
- **The assembly is already pure and shipped**: `lib/data/thisWeek.ts` (T-468, tested) builds the strip from
  the two hand-kept calendars plus `/live-data/earnings-dates`; the Brief page already waits on a tracked
  query before generating (`brief/page.tsx:85,140`), so one more client-side input is its established shape.
  Known dates stated as context also cannot be mis-tooled — the 2026-10-17 agent-evaluation lesson (D136)
  was to hand agents the figures they will quote, worked out, with their sources.
- D211's citation condition (BLS/BEA named wherever their dates show) travels into the prompt text, so the
  Brief's output inherits it.

**Who benefits and how:** Every Brief reader: the flagship AI feature's forward-looking section becomes
grounded and consistent with the Headlines strip, at zero marginal token cost worth mentioning and no new
fetch (earnings only when Equities is on and the user holds/watches stocks — the strip's own gating).

**Cost:** ~0.5 day: prompt assembly from `thisWeek.ts`, a test that the dates and publisher names reach the
task string and respect the entitlement gating. No key beyond what the Brief already needs, no new host.

**Depends on:** Nothing.

*Importance:* Medium — a quality floor under a flagship feature's weakest section. · *Efficiency:* Very
high — assembly of built parts. · *Practicality:* Very good.

---

## 5. Let the equity agents see who holds a stock — in-app tool only · proposed `P2` · target section: ledger, new item (category `feature`, AI agents; owner_role `remote-dev`)

**Status:** APPROVED — owner, 2026-11-25: “Let’s apply all 5”

**What:** A `get_stock_holders` tool on the equities toolset (Assistant, Equity Research, Diligence)
reading `/live-data/stock-holders` — the share split, institutional totals, largest managers and the catalog
funds holding the stock — returning, with the figures, everything the card shows beside them: the 13F
period and 45-day-lag note, the as-filed double-counting note, `builtOn`, and the recorded unresolved
reason when there is no entry. **In-app only**: T-457's parked half (the same data on `/api/v1` and the MCP
server) stays parked and untouched, exactly as D210 handled the fund-details and reserves tools.

**Grounded in:**
- **The route exists and no agent can read it** — none of the equity-tagged tools in `lib/agents/tools.ts`
  touches `/live-data/stock-holders`, so an agent asked "who holds NVDA, and is it in any index funds I
  could buy?" must web-search past data sitting in the app (the one-source-of-truth rule: tools read what
  the UI reads).
- **The pattern is three weeks old and yours**: D210 added `get_fund_details` and
  `get_stablecoin_reserves` as in-app tools while parking the API/MCP half on T-457 at your choice. This is
  the same move for the surface you commissioned in D243/D244.
- **The notes travel with the figures by design**, because the measured failure mode of agent tools is
  handing over a number without what honest reporting needs (the 2026-10-17 evaluation, D136). An agent that
  narrates "institutions report 9.7B shares" must also be holding "as filed, can top the company's own
  count, quarter ended …" — the tool returns them as one payload, and the tool test pins that.

**Who benefits and how:** Research and Assistant users asking ownership questions get filed figures with
their limits instead of search results; if proposal 1 lands, the quarter-over-quarter change flows through
the same tool with no second build.

**Cost:** ~0.5 day: the tool, its entry in the toolset, a test on the existing tool-test pattern. No key,
no new host, no recurring cost.

**Depends on:** Nothing (proposal 1 enriches it but is not required).

*Importance:* Medium — completes the surface's reach into the app's AI layer. · *Efficiency:* Very high.
· *Practicality:* Very good — a shipped pattern, repeated.

---

## Considered and cut

- **A cross-stock "most bought / most sold by institutions" page.** The same data as proposal 1, ranked
  over the universe — which is the leaderboard shape item 4 removed and RP-6's reasoning reaches ("smart
  money is buying X" is a recommendation wearing a fact's clothes). Proposal 1 deliberately stops at the
  one-stock diff.
- **Institutional % as a screenable Stock Registry column.** A fact, not a score, so the item-4 line does
  not bar it — but 1,435 of 5,704 listings are unresolved and multi-class/split cases withhold the percent,
  so a universe screen would silently filter on coverage. The per-stock card states those gaps; a filter
  cannot.
- **"Who holds this ETF" via 13F.** ETFs are 13(f) securities, but the build's CUSIP resolution rests on
  fund filings holding the security, and funds do not hold other funds — the evidence chain that makes
  stock resolution trustworthy is absent. Not worth a weaker parallel rule.
- **Manager pages ("what does BlackRock hold").** A different generated shape (per-manager portfolios), a
  research-platform feature the market assessment says not to fight Nansen/Messari on (§4 "where CAEP
  loses"). Proposal 1's EDGAR links give readers the route to the primary source instead.
- **An AI scan on the Crypto Scanner** — unchanged from the 2026-11-22 cut (your paid budget per run, a
  twelfth agent on the D20 evaluation cadence). Say the word and it gets written up.
- **Wiring NewsAPI/GNews into equity news** to soften CNBC single-sourcing — unchanged: both carry a
  recorded "paid plan or dropped" launch step (D106), and no keyless alternative is grounded in the
  project's documents.
- **A diagnosis pass on the macro quote gap** (paid-FMP-plan vs symbol-mapping, open since 2026-09-09).
  Owner-machine measurement with no user-visible build at the end of it; D21 defers the paid half, the
  audits already carry the open question, and T-462 just gave the commodity pages their honest workaround.
- **Expected income over 12 months, value-over-time charts, tax labels on the sales list, macro price
  alerts, yields/FX in Compare** — each cut or decided in the 2026-11-07/11-10 passes (D203, D209, D222)
  and nothing has changed.
- **Hidden surfaces** (Transfer Fees, Wallets, backtests, the Trade Risk Scorer) and **everything
  score-shaped** — yours and settled, respectively (D64, D92, RP-6–RP-9).

---

*Noticed in passing, for the record rather than the code-auditor:* all four findings of the 2026-11-24 code
audit are already fixed in-tree at this commit (the split guard and scope note ship in
`stockHolders.ts`, the generated file's `source` names the SEC set, and `launch-rehearse.ts` now spawns
through `process.execPath` with the Windows kill path). No new defect found this pass.
