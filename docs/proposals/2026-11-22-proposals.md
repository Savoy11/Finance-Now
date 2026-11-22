# Opportunity proposals — 2026-11-22

**Commit:** `c58f203` (main; working branch `claude/upbeat-allen-cru6ir`, even with it) · **Reviewed:**
`.claude/agents/opportunity-scout.md`; `README.md`; `CLAUDE.md`; `docs/ROADMAP.md` (owner backlog, open decisions,
the D236/D239 notes); the ledger `docs/audits/task-queue-2026-09-07.json` (405 items: 278 closed, 120 parked, 7 open,
0 blocked — every open item read; all seven wait on you, counsel or launch); `docs/TASK-QUEUE.md` (section list);
`docs/audits/rejected-proposals.md` (RP-1 to RP-9 and the not-a-rejection notes); owner decisions D222 to D241
(`docs/decisions/2026-11-10-…` through `2026-11-21-owner-decisions.md`), with D21, D92, D96, D186, D190, D204 and
D209; `docs/proposals/2026-11-10-proposals.md`, `2026-11-07-proposals.md` and `2026-11-06-proposals.md`;
`docs/MARKET-ASSESSMENT.md` §2 to §8; `docs/BUSINESS-CHECKLIST.md` §5; `docs/FEATURE-ADDITIONS.md`;
`docs/LEGAL-REVIEW.md` §1–§2; `docs/audits/coverage-matrix-2026-10-14.md`; and source: the reserves, alerts,
defi-tvl, security-returns, company-facts and earnings-dates routes; `lib/api/live/fmpHistory.ts`;
`lib/data/assetCatalog.ts`, `fomcCalendar.ts`, `releaseCalendar.ts`; the Headlines page;
`components/markets/agentScans.ts` and `MacroCalendarCard.tsx`; `frontend/drizzle/` (migrations 0000–0013) and
`frontend/package.json`'s scripts. · **Proposals:** 5

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*How to read the ratings:* **Importance** = what the product and its users gain · **Efficiency** =
that gain for the work it takes · **Practicality** = how ready it is (dependencies, risk). `P0`/`P1`/`P2`
is the net of the three. Effort is in rough working days for one developer.

> **Nothing is carried forward.** Every proposal from the 2026-09-08, 2026-09-22, 2026-11-06, 2026-11-07 and
> 2026-11-10 passes is now marked, filed or logged (D207, D222; RP-9), and everything approved is built — T-445
> through T-465. The ledger's 7 open items all wait on you, counsel or launch, so each proposal below is new work
> a cloud session can start today.
>
> **Checks every proposal passed.** None publishes a score, grade, rating or ranking of an asset, provider or
> holding, and none tells a reader what to do (RP-3, RP-6 to RP-9, D14, D26, D64, D92): every new figure is a fact
> from a source the app already uses, labelled and dated. None needs a paid plan (D21; proposal 5 names its free-tier
> limits plainly). **None fetches a new host** — proposals 2 and 4 read hosts already in the source-terms registry
> (`stablecoins.llama.fi`, `api.llama.fi`), proposal 5 reads FMP, and proposals 1 and 3 fetch nothing external. No
> mock data, no deletion of anything (proposal 1 creates a scratch database and leaves it; removing it is yours by
> hand), no hidden surface restored, and no parked item un-parked — proposal 1 is explicitly NOT T-131 (the launch
> flip) or T-363 (staging on a host): both stay parked as they are. Nothing below is an existing ledger item
> (checked by keyword against all 405).
>
> **No network requests were made from this session.** Proposal 4's field names are quoted from
> `app/live-data/defi-tvl/route.ts`, which already parses them; proposal 2's one unknown — the shape of DefiLlama's
> stablecoin price history — is stated as a first build step on your machine, the T-455 fixture rule, not assumed.

---

## 1. Rehearse the launch flip: run the dark sign-in kit end to end against a scratch database · proposed `P1` · target section: ledger, new item (category `process`, Auth & accounts)

**Status:** PENDING

**What:** A report-only harness, `npm run launch:rehearse`, that does once, today, what launch day will do for the
first time otherwise: start the app with the launch environment (`FN_REQUIRE_AUTH=true`, `AUTH_SECRET`,
`FN_SITE_OPEN=true`) against a scratch Postgres migrated from zero, and walk one account through the whole built-dark
stack — an anonymous page redirected to /login; sign-up refused without the consent box and accepted with it;
sign-in; TOTP enrollment, a code at sign-in, a recovery code; entitlements as D234 decided them (standard modules on,
Builder "not included", then included after `npm run entitlements -- --grant builder`); "Download my data"; and the
audit log holding the rows the walk produced, with an UPDATE attempt refused by the WORM trigger. It reports PASS
per step and fixes nothing; exit 2 (inconclusive) when there is no server or no scratch database, the probe
convention.

**Grounded in:**
- The launch recipe is environment-only and has never run as one. D232: *"launch sets `FN_REQUIRE_AUTH=true`,
  `AUTH_SECRET` and `FN_SITE_OPEN=true` and changes no code"* (`docs/decisions/2026-11-16-owner-decisions.md`).
  D232–D235 built the wall, sign-up with consent, TOTP and recovery codes, database entitlements with the premium
  Builder, and the WORM audit log — every one dark, every one unit-tested, and no process has ever run them
  together with the flags on. Fourteen migrations (0000–0013) sit under `frontend/drizzle/`, ten of them annotated
  "until it runs, 503".
- The repo's own recorded lesson says per-piece green plus never-run is how a whole breaks silently: the model swap
  "broke every agent, and nothing noticed for a month … no test reaches the paid API" (`CLAUDE.md`, the
  2026-10-17 finding). The walled mode is the highest-stakes never-run path left, and its first real run is
  currently scheduled for launch day.
- The shape is the house shape: `npm run audit` already talks to a running dev server and reports REAL vs FALLBACK;
  this does the same for the account stack. T-131 (the flip itself, parked) and T-363 (staging, parked under
  hosting D229) are neighbours, not duplicates — this needs no host, changes no parked status, and makes T-131's
  eventual flip a re-run of something known to work rather than a first run.

**Who benefits and how:** You, on launch day: the one person doing the flip gets a command that proves the whole
recipe beforehand, and a re-runnable check after any change to auth, entitlements or a migration.

**Cost:** 1.5–2 days. No key, no host, no new dependency, no recurring cost. Safety is part of the design: the
harness takes an explicit scratch `DATABASE_URL` (never the ambient one), creates the database if asked and
**deletes nothing** — the scratch database is left in place and named in the report, yours to remove by hand
(the no-deletion standing rule). Optional second pass, same harness: `FN_SITE_OPEN` unset, asserting the D174 site
lock answers 401/redirect-to-/owner.

**Depends on:** A reachable Postgres for the scratch database (Docker locally or in CI; the owner's machine also
works). Nothing else.

*Importance:* High — the business's whole next step is launch, and this converts its riskiest moment from a first
run into a re-run. · *Efficiency:* High — a script in the established probe pattern over code that all exists.
· *Practicality:* Very good — report-only, no host, no parked item touched.

---

## 2. How far each stablecoin has strayed from its peg, over the last 90 days · proposed `P2` · target section: ledger, new item (category `feature`, Crypto — Reserve Monitor)

**Status:** PENDING

**What:** On the Reserve Monitor (and each stablecoin's own Reserves tab), beside the supply change T-449 added:
for each monitored coin, over the last 90 days, the largest distance its price moved from its peg and the date it
happened, the number of days it closed more than half a percent off, and a small price-vs-peg sparkline. Figures and
dates only — no grade, no band, no "stable/unstable" word, and no alert (the posture D204 chose for supply).

**Grounded in:**
- The Monitor states the peg question's present tense and nothing else: `app/live-data/reserves/route.ts` serves
  today's price (or null, D214), supply change and chain split; the bell (`/live-data/alerts`) fires on a current
  deviation. Nothing anywhere answers "has this coin actually held its peg?", which is the question a reserve
  monitor exists for — the market assessment counts reserve transparency and data honesty among the product's four
  wins (§4).
- The history is on a host the app already reads: `stablecoins.llama.fi` is the Monitor's own registered source,
  and DefiLlama publishes per-coin history endpoints on it. Coins are picked by DefiLlama id already
  (`pickMonitoredStablecoins`, D190), so the history request reuses the same ids — no ticker matching.
- A deviation count is arithmetic on published prices, the kind D14 kept: *"Risk metrics that use traditional
  financial formulas can stay."* It is not a per-coin risk score (RP-6): no composite, no verdict, each figure
  named and dated.

**Who benefits and how:** Anyone using the crypto module's best-known surface to judge a stablecoin before holding
it. "USDT's largest move from its peg in 90 days was 0.4% on …" is checkable fact where today there is only a
point-in-time price.

**Cost:** 1–1.5 days once the endpoint is confirmed. Keyless, no recurring cost. Pure, tested aggregation
(injectable `now`, the house rule), a methods-page entry (D163), SourceLine unchanged (same provider).

**Depends on:** **One real response read first, on your machine** — the T-455 fixture rule. The history endpoint's
field names must be confirmed from an actual response before the parser relies on them (this cloud session cannot
reach provider hosts, and the 2026-11-10 pass left this in "next in line" for exactly this reason). If the endpoint
turns out not to carry usable prices, the proposal dies at that step having cost an hour. DefiLlama publishes no
terms document; that is the already-recorded state of the Reserves tab (D96 pre-launch; the enquiry is T-425's), and
this adds no new condition to it.

*Importance:* Medium-high — the flagship module's signature surface gains the fact it exists to establish.
· *Efficiency:* High — one endpoint on an existing source, small pure math. · *Practicality:* Good — one fixture
read gates it; everything after is routine.

---

## 3. "This week" on Headlines: the dates the app already knows, where every session starts · proposed `P2` · target section: ledger, new item (category `feature`, core — Headlines)

**Status:** PENDING

**What:** A one-line strip (or small card) at the top of Headlines: the next Fed meeting, the next CPI / jobs /
GDP / PCE release, and — for stocks on your watchlists — earnings expected in the coming days, each linking to the
page that has the detail. Sections follow the entitlement store exactly as the news sections do: macro dates with
the Macro or Equities module on, earnings rows with Equities on; a reader with neither sees no strip.

**Grounded in:**
- Every piece exists and none reaches the landing page. `lib/data/fomcCalendar.ts` and `lib/data/releaseCalendar.ts`
  (both hand-kept, keyless, with review clocks — T-456, D211) render on `/macro`, `/macro/rates` and
  `/equities/calendar`; `/live-data/earnings-dates` (T-458, D213) marks watchlist stocks reporting within 14 days —
  on the Watchlist page. `app/(dashboard)/headlines/page.tsx` renders a top strip and per-module news sections and
  not a single date.
- Headlines is the landing page (`/` and post-login both arrive there, `CLAUDE.md`), so this is the difference
  between "the dates are in the app" and "the dates are where a reader starts the day".
- `MacroCalendarCard` (`components/markets/`, shared) already renders the two calendar tables; the strip reuses its
  data path and the watchlist query the Watchlist page uses. Core pages may import `components/markets` (module
  rule 1).

**Who benefits and how:** Every reader, every session: the week's known market dates — the ones that move what they
hold — without a trip into two modules' sub-pages. The overlap with the Watchlist marks and the Macro card is real
and is the point: those surfaces keep the detail, the landing page gets the glance.

**Cost:** 0.5–1 day. No key for the Fed and release dates; earnings rows inherit T-458's sources and its "expected,
by source" labelling (they are the strip's only fetch, and they already power the watchlist marks). No new host, no
recurring cost.

**Depends on:** Nothing.

*Importance:* Medium — small surface, but on the one page everyone sees. · *Efficiency:* Very high — assembly of
built parts. · *Practicality:* Very good.

---

## 4. A DeFi coin's protocol, measured: value locked and its change, from a feed the app already polls · proposed `P2` · target section: ledger, new item (category `feature`, Crypto — coin pages)

**Status:** PENDING

**What:** On the coin pages for catalog coins whose token belongs to a DeFi protocol (UNI, AAVE, MKR, CRV, LDO,
SNX; the catalog files ten as `assetType: 'defi'`), a small card: the value locked in the protocol, its 24-hour and
7-day change, and its DefiLlama category — with one plain line that this measures the protocol, not the token: the
token's price is not a claim on that value. Coins with no protocol (GRT, LINK, AMPL, vBUSD) show nothing.

**Grounded in:**
- **The data is already fetched and shown nowhere a coin reader looks.** `app/live-data/defi-tvl/route.ts` polls
  `api.llama.fi/protocols` every 5 minutes and parses exactly these fields — `name`, `tvl`, `change_1d`,
  `change_7d`, `category` — then keeps the top 50 for its one consumer, the crypto TA page's Market Structure panel
  (verified: `MarketStructurePanel.tsx` is the route's only reader). A reader on AAVE's page cannot see Aave's TVL
  while the app downloads it continuously.
- Stocks got their filings (T-461 quarters), funds their N-PORT figures (T-459), stablecoins their supply (T-449) —
  DeFi tokens are the one catalog kind whose underlying thing has a public fundamental the app holds and does not
  show.
- The coin→protocol match is a hand-kept map held by a test, never a name or ticker match — D190's lesson, the same
  rule as `COINMETRICS_ASSETS` and T-463's coin↔staking maps. The lookup reads the full protocol list before the
  route's top-50 slice, so a mapped protocol outside the top 50 still resolves.

**Who benefits and how:** Readers of the flagship module's DeFi pages, who today get price, news and supply but
nothing about the protocol the token governs. Facts only; nothing is scored or ranked (the TA panel's aggregate
rankings are untouched).

**Cost:** About 1 day: the map + test, a serving shape on the existing route (or a thin `?protocols=` view of the
same fetch), the card, a methods-page line. Keyless, no new host, no recurring cost. Optional extra, **not**
assumed: per-protocol fee revenue from the fees overview endpoint — its per-protocol fields are unconfirmed, so it
takes the same one-read-first step as proposal 2, or stays out.

**Depends on:** Nothing for TVL and change (fields confirmed in the route's own parser today).

*Importance:* Medium — ten pages, but the flagship module's only missing fundamental. · *Efficiency:* Very high —
the data is already on the server. · *Practicality:* Very good.

---

## 5. A second rung under trailing returns: FMP's dividend-adjusted history behind Tiingo · proposed `P2` · target section: ledger, new item (category `resilience`, Equities & Funds)

**Status:** PENDING

**What:** When Tiingo serves nothing for a symbol (no key, an outage, or the vendor gone), `/live-data/security-returns`
computes the same trailing 1M/3M/YTD/1Y returns from FMP's dividend-adjusted daily history — the reader T-441
already built (`lib/api/live/fmpHistory.ts`), which is on Tiingo's basis (splits and dividends taken out) exactly so
the two sources cannot disagree about what a return means. Every figure keeps the route's existing per-symbol
`adjusted` labelling (T-401), and the response's `source` says which rung served.

**Grounded in:**
- **This is D21's one named zero.** The standing rule record calls `security-returns` "the only one with no
  fallback at all", the route's own header says "Tiingo is its ONLY source", and the coverage matrix lists it
  under *Empties if dropped* (`docs/audits/coverage-matrix-2026-10-14.md:91`). D21's words: those counts are the
  ones to drive to zero.
- **The reason it stayed single-sourced no longer holds.** The 2026-09-18 decision record reasoned "there is no
  free, held provider with adjusted closes across funds" — true then. T-441 (D138, 2026-10-18) then built exactly
  that reader for the chart and OHLCV ladders: FMP `/dividend-adjusted`, measured on the app's own key. The
  returns route was never revisited.
- **The risk is no longer hypothetical.** D241 just removed a quote rung at launch (Finnhub, enquiry dropped), and
  Tiingo's own permission enquiry is drafted and unsent (T-425). If Tiingo exits the same way, trailing returns on
  the Stock and Fund registries and the stock pages go from live to nothing — the outcome D21 exists to prevent.

**Who benefits and how:** Nobody visibly today, and that is stated plainly: this is resilience, not a new figure.
It converts "Tiingo or a dash" into "Tiingo, else FMP where FMP carries the symbol, else a dash", with the basis
labelled either way.

**Cost:** About 1 day. No new host (FMP is the quote ladder's first rung). **Free-tier limits stated, not hidden
(D21):** on the free FMP key the dividend-adjusted endpoint serves stocks but answered 402 for QQQ, VOO and VTSAX
when measured (2026-09-18, quoted in `fmpHistory.ts`) — so on free keys the rung mostly protects the **stock** side,
and most funds still rest on Tiingo; the fund side joins only on a paid FMP plan, which stays deferred. FMP's
250-calls-a-day free budget is why the rung serves only fallback traffic, never a second always-on source. Tiingo's
no-persistent-cache condition is Tiingo's alone and does not bind the FMP rung.

**Depends on:** Nothing.

*Importance:* Medium — invisible until the day it is the only thing standing, and that day has a named path to
happening. · *Efficiency:* High — reuses T-441's reader and the route's existing arithmetic. · *Practicality:*
Very good — free-tier coverage limits are measured and disclosed.

---

## Considered and cut

- **An AI scan on the Crypto Scanner** (parity with the Equity Outlier and Macro Movers scans — crypto is the one
  section with neither a scan panel nor a screener agent, and no decision rules it out). Cut because it spends your
  Anthropic budget per run, adds a twelfth agent to the evaluation cadence you run by hand (D20), and the keyless
  scanner already lists its setups without narration. Say the word and it can be written up in full.
- **A tracked portfolio against "the same money in VOO".** The 2026-11-07 cut said it needs keyed history for every
  holding; re-examined, the benchmark side needs only ONE symbol's history applied to the portfolio's own cash-flow
  dates, so it is cheaper than recorded. Still cut: it is the most advice-adjacent figure yet proposed for that
  page ("you underperformed the index"), and that reading deserves your yes before any build, not inside one.
- **A CoinGecko backup on the alert bell** (third pass). Unchanged: it shows a reader nothing until CoinGecko
  fails, and the Demo key (T-105) ended the measured refusals.
- **Wiring NewsAPI/GNews into equity news** to soften the documented CNBC single-sourcing. Both carry a recorded
  launch step of "paid plan or dropped" (D106) — building more weight onto sources already slated for removal
  inverts D21 rather than serving it.
- **A launch-steps aggregation report** over the sourceTerms entries' recorded launch steps. `docs/LEGAL-REVIEW.md`
  already is that document, maintained and dated; a parallel derived list would drift against it.
- **Fund Registry returns from filed N-PORT figures, tax labels on the sales list, more release-calendar rows,
  macro price alerts, yields/FX in Compare** — each decided already (2026-11-10 cut; D211, D203, D209, the sales
  list's no-tax-label test).
- **T-457's API/MCP half, options position saving, Layer-2 live gas, hosting, staging, desktop updates** — parked
  by recent decisions (D230, D216, D217, D229, D239); none is re-offered.
- **Hidden surfaces** (Transfer Fees, Wallets, backtests, the Trade Risk Scorer) — each yours, unchanged.
- **Anything with a score, grade or rank** — RP-3, RP-6 to RP-9, D14, D26, D64, D92.

---

*Noticed in passing, one line for the code-auditor:* nothing new — the two agent-description slips noted on
2026-11-07 were already fixed by 2026-11-10, and this pass found no fresh defect worth a report.
