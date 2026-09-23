# Opportunity proposals — 2026-09-22

**Commit:** not recorded — `git` was deliberately not run this session, so this pass is
against the **working tree** at `C:/Users/marcu/OneDrive/Desktop/Crypto-Stuff` on
2026-09-22. The T-322 next_action cites `origin/main 2128a18`; that sha is the
2026-09-07 queue snapshot's `main_sha` and is two weeks stale, so nothing below rests
on it. Every citation was resolved by **matching quoted text in the file**, never by a
line number inherited from a document. · **Reviewed:** `.claude/agents/opportunity-scout.md`
(the charter), `docs/audits/rejected-proposals.md` (RP-1…RP-6 + the three
not-a-rejection notes), `docs/audits/task-queue-2026-09-07.json` (all 346 outstanding
items — 91 open, 73 blocked, 90 parked, 1 unclear, plus the 91 annotated closed, and
the eight T-399…T-406 filed 2026-09-21), `docs/proposals/2026-09-08-proposals.md`,
`README.md`, `CLAUDE.md`, `docs/ROADMAP.md` (phases, Macro spec, affiliate section,
owner backlog incl. both T-129 steward annotations), `docs/MARKET-ASSESSMENT.md`,
`docs/FEATURE-ADDITIONS.md`, `docs/LEGAL-REVIEW.md`, `docs/TASK-QUEUE.md` (the S3–S6
charters and the Wave 4 intake section), `docs/decisions/2026-09-18-owner-decisions.md`
(D21), `docs/audits/coverage-matrix-2026-09-19.md`,
`docs/audits/live-data-audit-2026-09-19.json`, plus source: the module registry, all 58
`/live-data/*` route files and a consumer count for each, `frontend/scripts/gen-coverage-matrix.ts`,
`lib/data/dataSources.ts`, `lib/server/stakingRates.ts`, `lib/utils/aprDisplay.ts`,
`lib/data/dataGaps.ts`, the four detail-page types, `/compare`, `/research`,
`/brief`, `app/api/agents/research/route.ts`, `lib/agents/prompts.ts`,
`lib/agents/tools.ts`. · **Proposals:** 4

Mark each proposal below: `APPROVED`, `REJECTED`, or `DEFERRED`, and add a
reason for anything rejected. Then run the scout in FILE mode.

*Lens legend:* **Importance** = impact / business value · **Efficiency** = value ÷ effort ·
**Practicality** = readiness, dependencies, risk. `P0`/`P1`/`P2` is their net.

> **Screening.** Every item below was checked against the RP ledger, the 346 outstanding
> queue items and the decided policies in CLAUDE.md. **No RP reopen trigger has fired** —
> RP-2's fired in 2026-08 and is already recorded as reversed; RP-3's and RP-6's need a
> regulatory review that has not happened; RP-4's needs the item-4 removals to have settled
> in practice, which is not a judgement I can make from here; RP-5's needs an
> encrypted-at-rest custody design that does not exist. Nothing below publishes a per-asset
> score (RP-6), ranks a universe by score (item 4, D14), touches exchange key custody
> (RP-5), adds a data source or a host, needs a licence, a key or a paid tier, or depends on
> a measurement I could not take from this machine.
>
> **The 2026-09-08 batch is still entirely `PENDING`** — all five proposals in
> `docs/proposals/2026-09-08-proposals.md` carry no owner marking, and none of them appears
> in the queue. They are not re-raised here and nothing below duplicates them. Proposal 2
> is the nearest neighbour to that file's proposal 2 (a watchlist star on detail pages);
> the relationship is stated in its own section rather than left implicit.

---

## 1. Measure what D21 actually asks: what survives dropping a vendor · proposed `P1` · target section: `docs/TASK-QUEUE.md` → "Wave 5 — Improvement-agent intake" → "Approved proposals (build work)" (the section `docs/proposals/2026-09-08-proposals.md` proposes creating; if that batch is filed first, this joins it rather than opening a second one)

**Status:** PENDING

**What:** Give D21's optionality half a measurement that matches its own wording. Add a
registry-derived **vendor-drop survivability** report — for every surface × every vendor,
does dropping that vendor *remove* the surface (no provider left at all), *degrade* it
(a keyless or catalog rung survives), or change nothing — and make the "number to drive
to zero" the count of **removes**. It reads `lib/data/dataSources.ts` only, so it runs in
CI and from any machine, unlike today's matrix.

**Grounded in:** D21 states the test in words the current metric does not implement.
`docs/decisions/2026-09-18-owner-decisions.md` §D21: *"for each surface, how many
independent vendors could serve it, and what would be left with nothing if one were
dropped. That is the 'Strands if dropped' column … and the number to drive toward zero."*

What that column actually computes, in `frontend/scripts/gen-coverage-matrix.ts`:

- `remedy()` (the function whose body is `const keyed = entry.providers.filter((p) => p.auth === 'key' || p.auth === 'paid')`)
  keeps **only keyed providers**. Keyless rungs are invisible to everything downstream.
- `degraded` is `rows.filter((r) => r.verdict && r.verdict !== 'REAL' && !r.throttled)` — a
  surface only enters the calculation if **one audit run** saw it non-REAL.
- `fixable` is `degraded.filter((r) => r.keyed.length > 0)`, and `soleFor()` — commented
  *"Surfaces this vendor is the ONLY candidate for — what strands if we drop it"* — filters
  `fixable` for `c.length === 1`.

So "Strands if dropped" means *"degraded surfaces whose only keyed remedy is this vendor"*.
The report then prints, under `### Single-sourced surfaces — the optionality risk`, the
sentence *"dropping that vendor does not degrade the surface, it removes it."* Three
consequences, all verified in the tree and in the run's own JSON:

1. **`fund-holdings` is not single-sourced at all.** `lib/data/dataSources.ts` gives it
   `providers: [{ ...SEC_EDGAR, name: 'SEC N-PORT' }, { name: 'FMP', … auth: 'key' }, { name: 'Catalog', role: 'fallback', auth: 'none' }]`
   — the **primary is keyless**. Its own note says *"N-PORT is keyless and authoritative."*
   It lands in `degraded` only because `worst()` takes the worst verdict across probes and
   one probe is expected to fall back: `live-data-audit-2026-09-19.json` carries
   `"fund-holdings (SPY, UIT — catalog expected)" … "FALLBACK" … "expected: SPY is a UIT and files no N-PORT"`,
   beside `"fund-holdings (VOO, N-PORT filer)" … "REAL" … "513 holdings via sec"`.
2. **`stock-universe` has a registered keyless fallback too** — `{ name: 'Curated catalog', role: 'fallback', auth: 'none' }`,
   and the audit row reads `"79 stocks from curated catalog"`. Dropping FMP degrades it;
   it does not remove it.
3. **The one surface with no fallback at all is missing from the list.** D21's own table
   names `security-returns` — *"Tiingo | **none**"* — as the row that matters most. It does
   not appear in the 2026-09-19 matrix, because its probe came back
   `"REAL" … "2 symbols via tiingo"` that day, so it never reached `degraded`. **The metric
   drops the worst case precisely when the vendor is working.**

D21's own table already contains the contradiction: the prose above it says *"dropping the
vendor does not degrade them, it removes them"* while the table's third column is headed
*"Keyless fallback?"* and answers "~79-name curated catalog" and "catalog, indicative" for
two of the four rows.

**Who benefits and how:** The owner, and only the owner — this is a maintainer-facing
measurement, not a user surface. What it buys is that a standing rule stops being checked
by a number that means something else. Concretely it prevents two wasted moves: building a
keyless fallback for `fund-holdings`, which has had one since NT9, and reading a green
"strands: 0" as optionality satisfied when the row with genuinely no fallback happened not
to be probed as degraded. It also detaches the check from the audit, which
CLAUDE.md requires be run on the owner's residential IP — vendor *dependence* is a property
of the registry, not of one egress on one day, so this half can run in CI beside
`docs:check` and `staleness:check`.

**Cost:** Small. One script (or a second report section in the existing one) plus a vitest
file; the registry already carries `role` and `auth` per provider, which is everything the
computation needs. **No licence, no key, no recurring cost, no new host, no new data
source.** Four things to scope honestly:
- **Keep the existing matrix.** It answers a different and still useful question — *which
  account would light up which degraded surface today* — and that answer genuinely needs a
  live audit. This adds a measure; it should not replace one.
- **`derived` and `aggregator` roles need a rule.** `stock-outliers` lists only
  `{ name: 'Derived from stock-universe', role: 'derived', auth: 'none' }`; it survives or
  dies with its input, so survivability has to follow the dependency rather than count the
  row as keyless-and-safe.
- **"Degrade" is not free, and the report must say how far.** `stock-universe` falling back
  to ~79 curated names out of a universe of thousands is a real loss even though the surface
  survives. The output should carry the fallback's own description, not just a verdict word.
- **This overlaps a defect.** The prose in `gen-coverage-matrix.ts` is wrong about what its
  own numbers mean, and that is `code-auditor` territory rather than mine. I am proposing the
  missing measurement, not the correction; if you would rather have only the one-line prose
  fix, that is a smaller and entirely legitimate answer to this item.

**Depends on:** Nothing. Independent of T-401 (the `security-returns` adjusted-close
decision) and of the D2/FMP paid-tier conversation — every input is already in the repo.

*Importance:* High — a standing owner rule whose check does not measure what the rule says,
in a direction that both hides the worst row and invents two false ones. · *Efficiency:*
Very high — pure computation over a registry that already carries the fields. ·
*Practicality:* Very good — no key, no network, no user-facing change; the only judgement
calls are the `derived` rule and how loudly to report a degrade.

---

## 2. A way into Compare from where the user already is · proposed `P1` · target section: `docs/TASK-QUEUE.md` → "Wave 5 — Improvement-agent intake" → "Approved proposals (build work)"

**Status:** PENDING

**What:** Entry points into `/compare`: a "Compare with…" action on the four detail-page
types, and a small multi-select on the three registry tables that hands the chosen rows
to Compare. Both write the `?symbols=` URL the page already accepts.

**Grounded in:** Compare has a complete, shareable deep-link contract and **not one inbound
link anywhere in the app.** In `frontend/src/app/(dashboard)/compare/page.tsx` the page
reads `searchParams.get('symbols')`, resolves case-insensitively against the catalogs,
dedupes, caps at `MAX_SYMBOLS = 6`, and — since T-096 — keeps an off-catalog symbol rather
than dropping it, with the comment *"A shared /compare?symbols=TSLA,VOO reaches someone
whose page has no idea what TSLA is."* It also syncs state back to the URL
(`router.replace(\`?${params.toString()}\`, { scroll: false })`), so any comparison a user
builds is copyable. A grep of `frontend/src/` for `'/compare`, `"/compare` and `` `/compare ``
returns **exactly one hit** — the sidebar entry in `lib/modules/registry.ts`
(`{ href: '/compare', label: 'Compare', icon: GitCompareArrows }`). There is no compare
affordance in `components/`, none on any registry table, none on any detail page.

So the only route into a core, always-on feature is: leave the asset you are looking at,
open Compare from the sidebar, and re-type every symbol into a picker. The feature on the
other side of that errand is not small — CLAUDE.md's inventory lists date-aligned
growth-of-100, window stats, correlation, beta vs a selectable benchmark with R², the
funds-only `FundFactsSection` (S6 build-out item 1, shipped 2026-09-08), the
holdings-overlap section over `lib/data/lookThrough.ts`, and the cross-class structural
panel from `lib/data/assetClassProfiles.ts`. That last one fires only *"when ≥2 distinct
asset classes are selected"* — a state a user reaches by hand-assembling a cross-class
comparison from a search box, which is exactly the assembly nobody does.

**Who benefits and how:** Every user, on the most-travelled paths in the app — a registry
table and a detail page. It is not a new capability; it is the on-ramp to one that is
finished and idle. Two second-order gains: the fund-overlap and cross-class panels stop
depending on a user who already knows they exist, and the shareable URL becomes reachable
without knowing it is a URL, which is the acquisition property `docs/MARKET-ASSESSMENT.md`
§6 Phase 1 values in the fee optimizer (*"it's inherently shareable"*).

**Cost:** Small. One shared component plus a selection state on three tables. **No licence,
no key, no recurring cost, no new route, no new data source** — Compare already fetches
everything it needs. Three constraints that are not optional:
1. **A coin outside `assetCatalog.ts` must not be linked by bare symbol.** `provisionalOption(symbol)`
   returns `{ symbol, name: symbol, kind: 'stock', cls: 'equity' }` on purpose, and its
   docblock explains why: `fetchPoints` sends crypto to `/live-data/chart?id=` (a CoinGecko
   id an unknown symbol does not have) and everything else to `security-chart`. A coin the
   catalog does not know, deep-linked by ticker, therefore resolves as a stock and reaches
   the `missing` banner. Either offer the action only for catalog instruments, or extend the
   URL with a class hint — a decision, not a detail.
2. **`MAX_SYMBOLS = 6`.** A multi-select on a table must refuse the seventh row *in the
   table*, where the user can see it, rather than silently truncating in Compare's parser.
3. **No ranking.** This selects instruments the user picked; it adds no sort, no score and
   no ordering over a universe, so it sits on the explanation side of the item-4 line.

**Depends on:** Nothing blocking. It shares a premise with proposal 2 of the 2026-09-08
file (*"Add to watchlist from where the user already is"*, still `PENDING`) — that a detail
page should offer the actions that belong to what it is showing. They are independent
builds over different stores; if you reject that premise, reject both. Adjacent to **T-096**
(open: *"Decide whether Compare accepts non-catalog tickers"*), which the code appears to
have already answered — see the closing note.

*Importance:* High — a core module's flagship feature reachable only by errand. ·
*Efficiency:* Very high — no engine work, no data work; the receiving contract is built,
tested in the wild and already syncs its own URL. · *Practicality:* Very good — the only
real risk is the non-catalog coin resolution, which is nameable and avoidable up front.

---

## 3. Date the 24 fallback APRs that have no date, and show the date that exists · proposed `P1` · target section: `docs/TASK-QUEUE.md` → "Wave 5 — Improvement-agent intake" → "Approved proposals (build work)" (cross-reference the S3/staking work and T-394, which is a different clock — see below)

**Status:** PENDING

**What:** Two halves. **(a)** Render the `fallbackProvenance` block the staking route
already computes and no screen has ever shown, and stop the page-level notice dating
route-served fallback APRs to the *catalog's* compile date. **(b)** Give the 24 undated
keys in the fallback table their own dated provenance, so the 14-day withholding rule can
cover them at all.

**Grounded in:** `frontend/src/lib/server/stakingRates.ts` carries two kinds of number in
one table and only one kind has a date. Parsing the file today: `FALLBACK` holds **51**
keys, `FALLBACK_MEASURED` names **27** of them, leaving **24** with no vintage recorded
anywhere. (Counts derived by parsing the two blocks, the same way
`lib/server/__tests__/stakingFallbackProvenance.test.ts` does; the file's own docblock says
27 and 24.) The consequences are structural, not stylistic:

- **The staleness guard cannot fire for the undated 24, by construction.** `expiredMeasurement()`
  opens with `if (!FALLBACK_MEASURED.has(key)) return false`. `FALLBACK_STALE_AFTER_DAYS = 14`
  — chosen from measurement, per its docblock, after *"the exact combination that published
  yields up to 20× real in the 2026-09-09 finding"* — therefore protects the 27 keys whose
  age is known and is silent on the 24 whose age is not.
- **The file says so itself and calls it open work.** The comment above that constant:
  *"⚠ This bounds ONLY the keys in FALLBACK_MEASURED. The other 24 are undated hand-written
  figures … Giving them their own dated provenance is separate, open work."* I checked the
  346 outstanding queue items: nothing covers it. T-397 (*"Refresh stale staking FALLBACK
  values"*) was closed 2026-09-19 with the reason *"19 of the 27 measured keys rewritten"* —
  the measured half only.
- **`fallbackProvenance` is computed and never rendered.** The route returns
  `fallbackProvenance: { measuredOn: FALLBACK_MEASURED_ON, measuredKeys, unmeasuredKeys }`.
  A grep of `frontend/src/` finds it in `stakingRates.ts` and its test, and **in no `.tsx`
  file and no other route** — including `/api/v1/staking/opportunities`.
- **The page currently attributes those numbers to the wrong table's date.** `/staking`'s
  `ProvenanceNotice` is built from `getStakingDataProvenance()` and says
  *"compiled {STAKING_DATA_LAST_VERIFIED} ({ageDays} days ago) … every other rate, lock-up,
  minimum, and risk score is a curated estimate."* `STAKING_DATA_LAST_VERIFIED` is
  `'2026-06-28'` in `lib/data/stakingProviders.ts` — the **catalog's** compile date. But a
  non-live APR on that page is not always the catalog's `staticApr`: `lib/utils/aprDisplay.ts`
  returns `{ apr: live, live: false, gap: … }` when the route served a **fallback-table**
  number, and only otherwise falls through to `staticApr`. So a figure from a table dated
  2026-09-18 (or from no date at all) is shown under a notice dated 2026-06-28.

The per-key *reason* machinery is already excellent and is not what is missing:
`lib/data/dataGaps.ts` and the `gaps` map are rendered per row, and README says each
estimate *"now says WHY on hover"*. What no surface says is **when**. One precision note for
whoever builds this: the docblock states the 24 *"report `curated-estimate`"*, and that is
true of only **3** of them — cross-checking `GAP_BY_KEY` against the undated set gives 14
`no-upstream`, 5 `derived-estimate`, 3 `curated-estimate`, 2 `needs-api-key`, with the 24
GAP_BY_KEY entries matching the 24 undated keys exactly and overlapping the measured set
nowhere.

**Who benefits and how:** Every reader of `/staking` and every caller of
`/api/v1/staking/opportunities` and the `get_staking_opportunities` MCP tool — a yield
figure is a number people act on, and its age is part of the number. This is the
data-honesty rule the README leads with (*"estimates are labeled as estimates"*) taken one
step further to *how old the estimate is*, and it is the brand claim
`docs/MARKET-ASSESSMENT.md` §4.4 calls *"a real trust story in a market notorious for fake
data."* It also gives the maintainer the thing the 2026-09-09 incident showed was missing:
a clock on the half of the table that currently has none.

**Cost:** Split, and the split matters.
- **(a) is small and can be done from anywhere** — render the provenance block, date the
  notice by the table the number actually came from, carry `measuredOn` into the v1
  response. **No licence, no key, no recurring cost.**
- **(b) is owner-machine work and is not cheap.** The 24 keys are undated precisely because
  *"most CeFi desks publish a rate on a marketing page and nowhere machine-readable"*
  (`aprDisplay.ts`), so `npm run refresh-staking-fallbacks` cannot reach them —
  they need hand verification, one desk at a time, and then a `FALLBACK_CURATED_ON`-style
  anchor with its own window.
- **Do not simply extend the 14-day window over them.** The existing comment already argues
  against that (*"gating them on a date they have never had would blank half the catalog"*),
  and it is right: a date nobody verified, wearing a window that implies somebody did, is
  the staleness lie the whole provenance section exists to prevent. A longer, separately
  named window — or an explicit *"vintage unknown"* marker, which is honest and costs
  nothing — is the safer shape.
- **Watch the `STALENESS-ACK` convention.** Any new dated anchor becomes a clock
  `npm run staleness:check` discovers, so it arrives with the obligation to be acknowledged
  or refreshed; that is the point, but it should be a decision, not a surprise.

**Depends on:** Nothing blocking. **Not** T-394 (*"Full re-verification of the staking
provider catalog before bumping STAKING_DATA_LAST_VERIFIED"*) — that is
`lib/data/stakingProviders.ts`'s 90-day catalog clock, a different file and a different
table from `stakingRates.ts`'s fallback APRs. They should not be merged, and (a) is not
gated on either.

*Importance:* High — a published yield of unknown vintage, on the surface whose risk
taxonomy `docs/MARKET-ASSESSMENT.md` §4.2 names as one of the product's three wins. ·
*Efficiency:* High for (a) — the route already computes the answer; medium for (b), which is
24 manual checks. · *Practicality:* Good — (a) has no dependency at all; (b) needs the
owner's machine and a window decision.

---

## 4. "Analyze with AI" for coins and macro instruments · proposed `P2` · target section: `docs/TASK-QUEUE.md` → "Wave 5 — Improvement-agent intake" → "Approved proposals (build work)"

**Status:** PENDING

**What:** Put the same **Analyze with AI** action the equity detail page already has onto
the coin and macro detail pages, and make `/research`'s `?symbol=` deep link respect the
market it is given instead of forcing equities.

**Grounded in:** The deep link is hard-wired to one module. In
`frontend/src/app/(dashboard)/research/page.tsx`, the effect commented
*"Deep-link prefill: /research?symbol=MSFT (or ?task=...) — from a stock page"* runs
`setMarket('equities')`, `setAgentId(RESEARCH_AGENT.equities)` and an equity-shaped prompt
(*"business and industry, financial health, valuation vs history and peers…"*) for **any**
`?symbol=`, unconditionally. The page already resolves `?market=` and `?agent=` for its
initial state a few lines above — so `/research?market=crypto&symbol=btc` sets crypto and
then has it overwritten. `RESEARCH_AGENT` maps all three markets
(`crypto: 'research-analyst'`, `equities: 'equity-research'`, `macro: 'macro-research'`)
and `AGENT_MARKET` covers all eight whitelisted agents, so everything the fix needs is in
the file.

Only one detail page uses it: `equities/[symbol]/page.tsx` renders
`<Link href={\`/research?symbol=${encodeURIComponent(symbol)}\`}>` with the title
*"Run the Equity Research Agent on this stock"*. The **coin detail page has no internal
navigation of any kind** — `assets/[id]/page.tsx` is 1,145 lines whose only `href`s are
outbound (`asset.website`, `asset.whitepaper`, `article.url`, `liveAsset.attestationUrl`)
and whose only in-app moves are two `router.push('/assets')` back-buttons. The macro detail
pages have a back-link and, for commodities, ETF-proxy links into `/funds/[symbol]` — no
analyze path. So the module README calls *"the flagship"*, with a dedicated
`research-analyst` agent and a full crypto toolset, cannot be reached from the page showing
the asset, while equities can.

**Who benefits and how:** Crypto and macro users, on the page where the question forms.
This is the "dead end in the user path" case in its cleanest form — the capability exists,
the agent exists, the route accepts the deep link, and only the two buttons and one branch
are missing. It also stops a latent wrong answer: today a hand-written
`/research?symbol=BTC` link would silently run the **equity** research agent with an
equity-analyst prompt against a coin, which is the same class of miss that
`AGENT_MARKET`'s own docblock records being fixed for `?agent=` in W4-C8.

**Cost:** Small, and it is UI plus one effect. **No licence, no key beyond the
`ANTHROPIC_API_KEY` the Research page already requires, no recurring cost, no new route, no
new data source.** Two honest qualifications:
- **The app-wide `AssistantWidget` is not this.** It is mounted in
  `app/(dashboard)/layout.tsx`, so a user on a coin page can already chat — but that is the
  `app-assistant` agent through `/api/agents/chat`, a different agent with a different
  prompt and a shorter budget, and it is not prefilled with the asset in front of them. The
  gap is real; it is narrower than "no AI on this page".
- **The per-market prompts are editorial, not mechanical.** A coin is not analysed on
  *"valuation vs history and peers"*; the crypto and macro prompts need writing, and a bad
  prompt would be worse than no button. `lib/agents/__tests__/researchAgents.test.ts`
  already guards picker ↔ route ↔ catalog symmetry, so the wiring has a net; the copy does
  not.

**Depends on:** Nothing. Independent of T-130 (owner-machine agent tuning) and T-001.

*Importance:* Medium — one module's existing capability made reachable from two others, plus
a latent mis-routing closed. · *Efficiency:* Very high — two links and one branch over
machinery that is entirely built. · *Practicality:* Very good — no data, no policy surface;
the only work of substance is two prompt strings.

---

## Considered and cut

- **Anything score-shaped** — a per-coin or per-fund published score, a sortable score
  column, a staking composite, score-history persistence. RP-6, RP-3, D14, item 4
  (2026-08-18) and RP-4. No reopen trigger has fired for any of them, so none is re-raised.
- **The five proposals of 2026-09-08** (price-alert UI, watchlist star, `fund.ts` profile
  on the canonical scale, macro on Headlines, funds+fundamentals on `/api/v1`+MCP). All
  still `PENDING`, none filed, none rejected. Re-proposing a pending proposal would only
  make the ledger harder to read.
- **A funds-module build-out.** The nav asymmetry is real and measurable — counting `href:`
  entries per module in `lib/modules/registry.ts` gives core 11, crypto 8, equities 7,
  macro 7, Portfolio Builder 1, **ETFs & Funds 1** — and a paid-entitlement module with one
  page is hard to price. But it is not an unnoticed gap: the S6 charter in
  `docs/TASK-QUEUE.md` scopes four build-out items, two shipped 2026-09-05/08, and the other
  two are gated on sec.gov from the owner's machine (T-070) and the D2 paid-tier
  conversation. Raising it as new would be noise; if it needs attention it needs
  re-prioritisation of S6, which is the owner's call.
- **The Daily Brief's agent choice.** `/brief` POSTs to `/api/agents/research` with no
  `agentId`, and the route defaults to `'research-analyst'` — the *crypto* agent — for a
  prompt that asks for *"overall crypto + equity market tone"* over the user's whole
  cross-class holdings list. This looked like a clear defect and is not:
  `lib/agents/prompts.ts` gives that agent `toolset: 'all'` with the comment *"'all' (not
  'crypto') because the Daily Brief runs through this agent over mixed crypto + stock/fund
  holdings"*, and its system prompt tells it to use the equity/fund tools for those symbols.
  Recorded because it is exactly the parts-inventory read that the repo's canonical JWT
  incident warns about, run in the other direction — the wiring is right and the name is
  misleading.
- **A live health strip on `/data-sources`.** The page fetches only `/live-data/source-terms`
  and renders `DATA_SOURCES`' **declared** `status` field, so a source failing right now
  still reads "live". Tempting, but making it honest means either probing on page load
  (fan-out over every upstream, from a browser) or reading the audit, which CLAUDE.md
  requires be run on the owner's residential IP. That is a measurement I cannot design from
  here without guessing at the cost, and "I cannot size this" is the honest answer.
- **Surfacing the `upstreams` diagnostics block** (`/live-data/staking-rates` returns a
  per-upstream outcome string — `live (3/3)`, `partial (19/25 live; no match: …)`,
  `timeout after 6s`, `reachable but no usable rate (0/n)` — with no consumer anywhere in
  `frontend/src/`). Genuinely unsurfaced data, but it is maintainer diagnostics, not a user
  answer, and it overlaps `npm run staking-upstreams`, which already reports it better and
  groups by cure. Folded into proposal 3's (a) as a smaller question — whether the staking
  page should name a failed upstream — rather than proposed on its own.
- **Anything needing a live measurement.** Provider reachability, REAL-vs-FALLBACK verdicts,
  agent output quality, whether a rate is currently right. IP-dependent and owner-machine
  only. I read code and documents; no proposal above rests on a measurement I took.

---

*Three record gaps, for `checklist-steward` / `code-auditor` rather than for me:*
**T-096** (*"Decide whether Compare accepts non-catalog tickers"*) is listed `open`, but its
`next_action`'s "if yes" branch — *"extend Compare's search to call
/live-data/stock-universe?symbol= and /live-data/coin-search for unmatched input, mirroring
the Portfolios add-search"* — is shipped, as `searchRemoteOptions` and `provisionalOption`
in `compare/page.tsx`, with T-096 named in the code comment. **`gen-coverage-matrix.ts`**
prints prose that misstates its own computation (proposal 1 names the exact sentences).
And three **empty directories** survive under `frontend/src/app/live-data/` —
`cbdc-data/`, `risk-scores/` and `tier/` — with no `route.ts` in any of them; harmless, since
git does not track directories, but `cbdc-data` and `risk-scores` are the two routes CLAUDE.md
and RP-6 record as deleted, and a directory bearing a deleted route's name is the kind of
residue that later reads as a partial removal.
