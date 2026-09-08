# Opportunity proposals — 2026-09-08

**Commit:** `be27b38d4a4581ded9b88125a75a8695c5c8b6cc` (branch `claude/outstanding-tasks-l86xjw`, working tree — the draft-PR remediation batch, not `origin/main`) · **Reviewed:** `README.md`, `CLAUDE.md`, `docs/TASK-QUEUE.md` (Waves 0–4, Phase 2, Phase 3 incl. the W3 intake and the S3–S6 subproject charters, the maintenance section), `docs/ROADMAP.md` (phases, Macro spec, the 2026-09-08 affiliate status block, owner backlog), `docs/audits/rejected-proposals.md` (RP-1…RP-6 + the not-a-rejection notes), `docs/proposals/2026-07-30-proposals.md`, `docs/agents/checklist-steward.md` (the cross-read rule), `docs/IMPROVEMENT-AGENT-SETUP.md`, `docs/MARKET-ASSESSMENT.md`, `docs/BUSINESS-CHECKLIST.md`, `docs/FEATURE-ADDITIONS.md` ("deliberately NOT added yet", annotated 2026-09-04/08), `docs/assessments/P3-production-review.md` (feature inventory C1–C14), `docs/architecture/risk-framework.md`, `DATA-AVAILABILITY.md`, plus source: the module registry, all 58 `/live-data/*` routes and their consumers, every Zustand store and its consumers, `lib/risk/`, `lib/data/instruments.ts`, `lib/data/fundCatalog.ts`, the four detail-page types, `/compare`, `/headlines`, `/api/v1/*` and `mcp-server/src/index.ts` · **Proposals:** 5

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*Lens legend:* **Importance** = impact / business value · **Efficiency** = value ÷ effort ·
**Practicality** = readiness, dependencies, risk. `P0`/`P1`/`P2` is their net.

> Every item below was checked against `docs/audits/rejected-proposals.md`
> (RP-1…RP-6), `docs/TASK-QUEUE.md`, the ROADMAP's owner backlog and the decided
> policies in CLAUDE.md. None publishes a per-asset risk score (RP-6), ranks a
> universe by score (item 4, 2026-08-18), adds a data source, needs a paid tier,
> or touches exchange key custody (RP-5).

---

## 1. A way to create a price alert · proposed `P1` · target section: `docs/TASK-QUEUE.md` → new "Wave 5 — Improvement-agent intake (2026-09-08)" → "Approved proposals (build work)"

**Status:** PENDING

**What:** Build the missing entry point for the price-alert engine that already
ships and already runs: a create/manage surface (a "set an alert" action on
watchlist rows and detail pages, plus a list of armed and fired alerts in the
TopBar bell alongside the live feed alerts).

**Grounded in:** The whole engine exists and nothing can reach it.
`src/store/usePriceAlertStore.ts` is a complete, persisted store —
`addAlert` / `removeAlert` / `rearmAlert` / `markTriggered`, one-shot alerts
with a re-arm path, `kind: 'crypto' | 'security'` so it already spans coins,
stocks, funds and macro instruments. `src/hooks/usePriceAlertMonitor.ts` polls
every 60s, resolves crypto through `/live-data/portfolio-prices` and securities
through `/live-data/security-quotes`, refuses to fire on a reference price
(`d.source !== 'reference' && !q.reference`), and delivers a toast plus a browser
notification. It is wired app-wide at `src/app/(dashboard)/layout.tsx:40`.
**`addAlert` has zero callers outside its own store** — I grepped `src/` for
every identifier; the store's only consumer is the monitor. So the monitor runs
on every page load, for every user, and always finds an empty array.
`components/alerts/` now contains only `LiveAlertRow.tsx`; the panel that would
have been this UI, `alerts/PriceAlertsPanel.tsx` (165 LOC), was deleted as an
orphan in the 2026-07-27 sweep (`docs/audits/app-audit-2026-07-27.md:181`) —
the store and the monitor were kept, the surface was not.
Business grounding: `docs/MARKET-ASSESSMENT.md` §5's recommended pricing puts
"limited alerts" in the free tier and "full alerts" in Pro. This is a named
tier feature that is 80% built and 0% reachable.

**Who benefits and how:** Every user who holds or watches anything. Today the
only alerting is the TopBar bell's *editorial* feed — stablecoin depegs and 24h
moves on a fixed list of majors (`/live-data/alerts`); a user cannot express
"tell me if VOO drops below 480" or "tell me if my coin recovers its entry".
It is also the one feature in the suite that gives a reason to come back rather
than a reason to visit, which is what the market assessment's retention gate
(§8: ">30% week-4 retention") actually needs.

**Cost:** Small-to-medium, and it is UI only — no new data source, no key, no
recurring cost; both quote routes are already used by the monitor. Two things
must be stated on the surface rather than assumed: alerts fire **only while the
app is open** (the monitor's own comment says server-side delivery waits on the
backend), and browser notifications need permission. An alert list that looks
like push notification and isn't would be exactly the class of overstatement the
house data-honesty rule exists to prevent.
**Two decisions this carries, both yours:**
1. **Persistence.** Price alerts are localStorage-only while portfolios,
   watchlists, wallets and builder plans are all DB-backed through
   `/api/user/*`. Same optimistic + client-UUID + one-time-import template if
   you want them to survive a browser wipe; leaving them local is defensible for
   a feature that only works with the tab open.
2. **The day-trading question.** You raised it when removing exchange key
   custody (RP-5: *"to avoid encouraging day trading"*). A threshold on an asset
   the user holds or watches is monitoring; a fast-cycle alert feed is closer to
   the concern. If this is approved, framing it as watchlist/portfolio
   monitoring — and not offering intraday or percentage-move triggers in v1 —
   is the lever that keeps it on the right side.

**Depends on:** Nothing blocking. Proposal 2 below is its most natural entry
point but neither needs the other.

*Importance:* High — a named pricing-tier capability that is built, running, and
unreachable. · *Efficiency:* Very high — the engine, the persistence, the
polling, the reference-price guard and the delivery are all done; this is the
form and the list. · *Practicality:* Good — no dependency and no data risk, but
it carries the two decisions above and one honesty constraint that must land in
the copy.

---

## 2. "Add to watchlist" from where the user already is · proposed `P1` · target section: `docs/TASK-QUEUE.md` → new "Wave 5 — Improvement-agent intake (2026-09-08)" → "Approved proposals (build work)"

**Status:** PENDING

**What:** One shared watchlist toggle, rendered on the four detail-page types
(coin, equity, fund, macro instrument) and on the registry table rows, writing
to the existing DB-backed store.

**Grounded in:** `useWatchlistStore.addKey(listId, key)`
(`src/store/useWatchlistStore.ts:45`) has exactly one caller in the whole app:
the `/watchlist` page's own add-search (`watchlist/page.tsx:33`). No detail page
offers it — `assets/[id]/page.tsx` is 1,185 lines with no watchlist affordance,
`equities/[symbol]/page.tsx` (213) has "Analyze with AI" and nothing else,
`funds/[symbol]/page.tsx` (404) has only a back-link, and the macro detail pages
have none. There is no star in `components/ui/`. So the user is looking at the
exact asset they want to track and the only route to tracking it is to navigate
away and type its name into a different page's search box.
The keys already exist for every class — `lib/data/instruments.ts` gives all
seven classes a `sec:`-prefixed or CoinGecko key, which is what the watchlist
stores — so this is one component, not four.

**Who benefits and how:** Everyone, on the most-travelled path in the app. It
also multiplies two features that are already built and currently sit idle for
anyone whose watchlist is empty: the Headlines feed bias
(`lib/watchlist/bias.ts:41`, which reorders the landing page around watched
assets) and the Daily Brief's grounding (`brief/page.tsx:47`, which builds the
morning brief from watchlist + portfolio symbols). Both get better the moment a
watchlist is easy to fill, and today filling one is a deliberate errand.

**Cost:** Small. One component plus a store selector. **No licence, no key, no
recurring cost, no new route.** One design decision: which list a star writes to
when the user has several — the active list is the obvious default, with a small
picker on long-press/secondary click rather than a modal on every add.

**Depends on:** Nothing. The store, its persistence, the optimistic sync and the
cross-class keys all shipped.

*Importance:* High — it is not a new capability, it is the missing on-ramp to
three existing ones. · *Efficiency:* Very high — smallest change on this list by
a distance. · *Practicality:* Very good — no data, no policy, no dependency;
one small UX decision.

---

## 3. ETF/fund risk profile on the canonical scale (T-353) · proposed `P1` · target section: `docs/TASK-QUEUE.md` → new "Wave 5 — Improvement-agent intake (2026-09-08)" → "Approved proposals (build work)" (cross-reference the S6 — Fund Registry charter and P2-R3, whose pattern it copies)

**Status:** PENDING — but its *symptom* is already fixed, so read the scope again
before ruling.

> **Owner instruction 2026-09-08: "fix the fund risk tier to read strategy".**
> Done, as the narrow fix this proposal itself offered as the cheaper alternative:
> `fundRiskTier()` in `lib/data/instruments.ts` now reads `strategy` and applies a
> speculative FLOOR (leverage raises a tier, never lowers it, so a 3× Treasury
> fund is not a tier-2 bond holding). Five of 126 funds moved, all leveraged or
> inverse and all already `'speculative'` per `fundRiskLevel()`: TQQQ, SQQQ, UPRO,
> SH, SOXL — each 4/10 → 7/10. The other 121 are pinned unchanged by test.
>
> **What this does NOT do**, and is the remaining question for you: the tier is
> still hand-set beside the catalog rather than derived through `composeRisk()` +
> `canonicalToRiskTier` the way the macro profiles are. Expense ratio, AUM and
> type still do not reach the tier at all. So the two-disagreeing-models bug is
> closed and guarded (`instrumentRiskTier.test.ts` fails if `fundRiskTier` and
> `fundRiskLevel` ever disagree on which funds are speculative), while the
> *architectural* half of this proposal stands as written.

**What:** `frontend/src/lib/risk/profiles/fund.ts` — a fund profile scored on the
canonical 0–100 higher-is-safer scale from catalog facts (category, **strategy**,
expense ratio, AUM, type), exposing a static `fundInstrumentRiskTier()` through
`canonicalToRiskTier` so `lib/data/instruments.ts` stops hand-setting fund tiers.
Tests pin the tier shifts. No new UI surface, no new published figure.

**Grounded in:** Two things: a named-but-unbuilt profile, and a number that is
demonstrably wrong today.
- `docs/architecture/risk-framework.md` lists the shipped profiles and names the
  fund profile as planned; `lib/risk/profiles/` currently holds eight and none
  of them is funds.
- `lib/data/instruments.ts:79` is the whole model: `fundRiskTier(category)`,
  five branches on the category string alone. It ignores `strategy`, which the
  catalog carries. The consequence is citable: **UPRO** (ProShares UltraPro S&P
  500, 3× daily leveraged — `fundCatalog.ts:474`, `category: 'us-broad'`) and
  **SH** (−1× inverse S&P, `:475`) both score tier **4** — identical to VOO and
  VTI. **SOXL** (3× daily semiconductors, `:476`) also scores 4, the same as a
  plain sector fund. That tier is not internal: `/portfolios` prints it
  per holding as "4/10" with a colour bar (`portfolios/page.tsx:908-921`) and
  feeds it into the weighted risk average.
- The app already holds a *second*, disagreeing fund-risk representation:
  `fundRiskLevel()` (`fundCatalog.ts:167`) correctly calls all three of those
  funds `speculative`, and it is published on fund detail ("Risk Profile") and
  used as a Fund Registry filter. Two fund-risk models, neither on the canonical
  scale, disagreeing on the riskiest instruments in the catalog, is precisely
  the collision `docs/architecture/risk-scale-spec.md` exists to prevent.
- The template is P2-R3, already shipped: `commodityInstrumentRiskTier` /
  `currencyInstrumentRiskTier` / `rateInstrumentRiskTier` derive their tiers from
  profiles via `canonicalToRiskTier` so "the tier and the profile can never
  disagree" (`lib/risk/profiles/commodity.ts:138-149`). Funds are the class that
  pass was not scoped to cover.

**Who benefits and how:** Anyone whose portfolio holds funds — which, for the
Portfolio Builder's own output, is all of them. The weighted risk figure and the
per-holding tier stop treating a daily-reset 3× fund as a total-market index
fund. Second-order: `lib/risk` gains the profile its own architecture document
promises, and the fund half of the instruments layer stops being the one place
where a risk number is hand-set beside eight profiles that aren't.

**Cost:** Small — one profile module in the established shape, its vitest file,
and a one-line change in `instruments.ts`. **No licence, no key, no recurring
cost, no new data source, no new route.** Three things to scope honestly:
1. **Concentration cannot come from `lookThrough.ts` in the static path.**
   `instruments.ts` is a pure static catalog; real concentration needs fetched
   N-PORT holdings. Do it the way `commodity.ts` already does with volatility:
   the dimension exists in the profile, is left unscored when holdings are
   absent, and coverage/confidence say so — so a later caller that *does* have
   holdings (`/portfolios` look-through, `/compare`) can score it fully without
   a second model.
2. **This changes a printed number.** Fund holdings' tiers will move, mostly for
   leveraged/inverse/covered-call funds. That is the point, but it is
   user-visible and the tests should pin the intended shifts by symbol.
3. **One question for you, not for the agent:** should `fundRiskLevel()` — the
   published word and the registry filter — derive from the same profile, so the
   two can never diverge again? It would change a published band's values, so it
   is your call, not a scoping detail. My suggestion is to build the profile
   first and take that decision on the evidence it produces.
**A cheaper alternative, if you want the correction without the profile:** add
`strategy` to `fundRiskTier`'s branch table. It fixes the three funds above in
an afternoon and leaves the architectural gap open. Worth saying out loud so the
choice is yours rather than implied.
**Related, and deliberately *not* folded in:** `lib/risk/profiles/equity.ts` has
**zero consumers** — a full documented profile nothing calls — while
`equityRiskTier(beta)` (`instruments.ts:72`) is hand-set on a four-branch beta
ladder. The same wiring would activate it, but not for free: from catalog facts
only the size dimension scores, so it would silently drop beta, which is what
the current function actually uses. Making it work needs a catalog-facts entry
point (beta as a volatility proxy + market-cap size) — a change to the profile,
not just wiring. If you want it, scope it as its own item.

**Depends on:** Nothing. `lib/risk/`, `canonicalToRiskTier`, and the catalog
facts are all shipped. Independent of the S6 build-out's remaining items (2) and
(4), which are gated on sec.gov access and the D2 key decision respectively.

*Importance:* Medium-high — narrow blast radius (portfolios holding leveraged or
option-income funds), but inside it a published figure is wrong in the
direction that matters. · *Efficiency:* High — established pattern, pure code,
one call site. · *Practicality:* Very good — no source, no key, no new surface;
the only judgement call is the `fundRiskLevel()` question, which is separable.

---

## 4. Macro stories on the Headlines landing page · proposed `P2` · target section: `docs/TASK-QUEUE.md` → new "Wave 5 — Improvement-agent intake (2026-09-08)" → "Approved proposals (build work)"

**Status:** PENDING

**What:** Add `/live-data/macro-news` as a third feed on `/headlines` — a Macro
entry in `MODULE_META`, a query gated on the macro entitlement, a Macro section,
and macro instruments in the watchlist-bias mapping.

**Grounded in:** `headlines/page.tsx` fetches exactly two feeds —
`/live-data/news` (crypto) and `/live-data/market-news` (equities/funds) — and
`MODULE_META` (line 51) has two entries. `/live-data/macro-news` exists, is
keyless (8 RSS feeds), classifies each story into a pillar, drops off-pillar
articles, clamps future `pubDate`s, and detects catalog instruments with links
to their macro detail pages. Its only consumer is `/macro/news`.
The page's own copy says the sections follow the bundle — *"Only modules enabled
in your bundle contribute stories, so the sections below change with your
entitlements"* (line 319) — and `funds` carries a written explanation for
sharing the Markets section. Macro carries no such note anywhere in source or in
`docs/assessments/P3-production-review.md` (row C1 records the page as
"crypto + markets"); it is an omission, not a decision.
The sharpest form of it: `{!cryptoOn && !marketsOn && …}` at line 352 means a
bundle with **Macro enabled and nothing else** lands on `/headlines` — the app's
landing page and post-login redirect — and reads *"No news-carrying modules are
enabled in your bundle."*
`MacroNewsArticle` maps onto the page's `Story` shape field-for-field
(id/title/summary/source/url/publishedAt/sentiment/isBreaking, `pillar` →
category, `related` → tags with detail links), and its sentiment union is
identical, so the adapter is the same shape as the two that exist.

**Who benefits and how:** Macro-module users, who currently get a landing page
that either ignores their module or tells them they have no news at all. It also
makes the macro entitlement worth what it is sold for — the same argument that
carried the macro TA proposal on 2026-07-30: a module absent from the app's
front door is harder to price.

**Cost:** Small. **No licence, no key, no recurring cost** — the route is
keyless and already built and cached. One detail worth respecting: the top strip
round-robins across feeds precisely so a noisy feed cannot monopolise it, so
macro joins as a third pool rather than being merged into Markets.

**Depends on:** Nothing.

*Importance:* Medium — no new capability, but it closes a promise the page makes
in its own copy and removes an empty landing page for one bundle. ·
*Efficiency:* Very high — one query, one adapter, one section, on a route that
already exists. · *Practicality:* Very good — keyless, no policy surface, no new
host.

---

## 5. Funds and filed fundamentals on `/api/v1` + MCP · proposed `P2` · target section: `docs/TASK-QUEUE.md` → new "Wave 5 — Improvement-agent intake (2026-09-08)" → "Approved proposals (build work)"

**Status:** PENDING

**What:** Extend the agent surface to the two keyless datasets it cannot see:
fund holdings / look-through / pairwise overlap, and SEC XBRL company
fundamentals. Concretely `GET /api/v1/funds/holdings?symbol=`,
`GET /api/v1/funds/overlap?symbols=`, `GET /api/v1/securities/fundamentals?symbol=`,
plus the mirroring MCP tools. Additive only.

**Grounded in:** The v1 surface is 13 route files — the discovery root plus
`prices`, `exchanges`, `network-fees`, `transfer/routes` (withheld),
`staking/opportunities`, `news`, `securities/quotes`, `securities/history`,
`macro/yield-curve`, `macro/fx-rates`, `options/score` and `openapi.json` — and
the MCP server exposes 12 tools (13 minus the commented-out
`find_transfer_routes`). **Not one of either is fund-aware, and neither can read a filed
fundamental.** Meanwhile the app has, already built and keyless:
`/live-data/fund-holdings` (SEC N-PORT direct, authoritative), `lib/data/lookThrough.ts`
(pure + vitest-tested, and it already answers the pairwise-overlap question on
`/compare`), and `/live-data/company-facts` with its ratio maths extracted pure
into `lib/utils/companyRatios.ts`.
Business grounding, and it is the strongest in the repo:
`docs/MARKET-ASSESSMENT.md` §4.3 names the agent-native surface *"the most
future-proof differentiator"*, §6 Phase 3 calls it *"the scenario with
non-linear upside"*, and §8's go/no-go list includes *"5 external consumers of
the API/MCP surface"*. `docs/FEATURE-ADDITIONS.md`'s not-added list carried
"`/api/v1` + MCP tools for equities/funds"; its 2026-09-04 annotation records
the quotes/history half as shipped and is silent on the rest, which is the half
that is actually differentiated — anyone can serve a quote; "do these two funds
hold the same companies, and how much of my portfolio is really one issuer" is
answered by an engine this repo built and tested.

**Who benefits and how:** Agent builders and the owner's own MCP usage, and the
Daily Brief / research agents indirectly, since agent tools read the same routes.
**I cannot size external demand and will not pretend to** — there are zero known
external consumers today, and this proposal is a bet on a stated strategy rather
than an observed need. What it does have is the best value-to-effort ratio of
any agent-surface work available: the engines are pure, tested and keyless, so
this is a wrapper, not a build.

**Cost:** Small-to-medium. **No licence, no key, no recurring cost** — SEC EDGAR
is keyless and already used. Constraints that are not optional:
- **Additive only.** The v1 stability rule from R2 stands; no existing contract
  moves.
- **Coverage travels with the answer.** Per-fund `source`, `asOf` and
  `holdingsCount`, and a partial list is never rescaled to 100% — the same rule
  the look-through UI already follows. Filers that publish no N-PORT (UITs such
  as SPY) must return an explicit "no filing" rather than an empty holdings list
  that reads as "holds nothing".
- **NT12 moves with it.** `lib/server/__tests__/boundaryDrift.test.ts` pins the
  MCP tool count against the README and CLAUDE.md's table; new tools mean those
  descriptions move in the same change or the guard fails — which is the guard
  working.

**Depends on:** Nothing blocking. Unrelated to the D2/enterprise-key
conversation — every dataset here is keyless.

*Importance:* Medium — high strategic value against a stated objective, unproven
near-term demand. · *Efficiency:* High — a wrapper over pure tested engines and
one keyless route. · *Practicality:* Good — no new source; the real work is
contract discipline (coverage, additive-only, drift guard), not code volume.

---

## Considered and cut

- **Extending affiliate links to a second surface** (Coin Registry / funds /
  brokerage referrals, all named in the ROADMAP's "Other surfaces to consider").
  The plumbing, the `RankableProvider` compile-time guard, the per-link tag and
  `/how-we-make-money` all shipped 2026-09-08 — but `affiliateUrl` is unset for
  all 55 providers and the disclosure page still renders four "Owner copy
  required" placeholders. Adding surfaces before the disclosure prose exists
  inverts the sequencing the ROADMAP itself sets. This is a "you write four
  paragraphs" item, not an engineering one.
- **A macro / economic calendar.** The macro module has no calendar while
  `/equities/calendar` exists, and economic events are macro by nature — but
  FMP's `economic-calendar` is paid (402 on the free tier,
  `market-calendar/route.ts:66`), and the keyless alternatives
  (federalreserve.gov, bls.gov) are unregistered hosts that would each need a
  terms reading, on a registry where 54 of 56 entries are still `seeded`.
  Sequenced behind D2 or a terms pass; not proposable today.
- **Surfacing the live withdraw-fee overlay anywhere else.**
  `/live-data/withdraw-fees` is keyless, live, and currently dark because its
  only consumer is the withheld Transfer Fees page. Putting it on the Coin
  Registry would be that withheld surface in another shape — your 2026-08-22
  decision, not mine to route around.
- **`MarketStructurePanel` on coin detail.** It is symbol-parameterised and only
  renders on crypto TA, which looks like cheap leverage — but funding/OI covers
  10 OKX instruments, so most coin pages would render a column of "n/a", and
  coin detail is the exact surface RP-6 just finished clearing. Not worth
  reopening for a mostly-empty panel.
- **A thesis/journal panel for equities and macro.** `useThesisStore` is
  crypto-TA-only and localStorage-only, so the asymmetry is real — but
  entry/invalidation/target is trading-journal vocabulary sitting next to your
  recorded day-trading concern (RP-5). Not proposing it without that decision
  first.
- **Entitlement issuance / license keys** (the `entitlements` table exists,
  nothing serves it; modules unlock by clearing localStorage). Already tracked —
  ROADMAP Phase 6, "Entitlement issuance + billing (Stripe)". Raising it as new
  would be noise; if it needs attention it needs re-prioritisation.
- **Anything score-shaped:** restoring a per-coin or per-fund published score, a
  sortable score column over any registry, or score-history persistence — RP-6,
  item 4 (2026-08-18) and RP-4 respectively. Nothing in the circumstances has
  changed, so none of them is re-raised.
- **Anything needing `npm run audit`, provider reachability or REAL-vs-FALLBACK
  evidence** — IP-dependent and owner-machine-only. I read code and documents
  from here; I did not measure anything, and no proposal above rests on a
  measurement.

*One closing note, not a proposal:* two record gaps for `code-auditor` /
`checklist-steward` rather than for me — `docs/assessments/P3-production-review.md`'s
core inventory (C1–C14) contains **no row for alerts at all**, neither the TopBar
bell nor the price-alert monitor, so a shipped feature and a running background
job have never carried a rollout decision; and `/headlines`'s on-page copy claims
its sections follow the user's bundle while the macro module is excluded from it.
