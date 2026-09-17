# Owner decisions — 2026-09-14

**Applied rulings, made item by item in one session.** The owner asked to go through
everything blocked or awaiting a decision in `finance-now-open-tasks-2026-09-08.json`
(338 outstanding at 2026-09-07). This records every ruling and what it cascades to, so
the next reader of that file — or of `docs/TASK-QUEUE.md` — knows which of its "blocked"
and "owner-decision" entries are no longer either.

**Method.** The 158 blocking decisions still referenced by open items were clustered by
root question. Seven roots governed ~110 items; those were put to the owner first, then
the concrete product calls, then the residue. Each ruling below names its cascade. Items
settled by cascade were computed, not hand-listed, from the file's own `blocking_decision`
and `unblocks` fields.

**Ledger.**

| | |
|---|---|
| Outstanding on 2026-09-07 | 338 |
| Closed before today (62 verified in two passes + 15 closed 2026-09-12/13) | −77 |
| **Settled by today's 20 rulings, including cascades** | **−205** |
| Still open — every one needs the owner's machine, network, or keys | **57** |

Two items the pass found already done: T-071 (PR #147 merged) and T-338's npm half
(gating since 2026-09-08, 0 high advisories after the dependabot merges).

`docs/TASK-QUEUE.md` is **not** edited by this document. Per the checklist-steward
charter, this is the owner's approval recorded; applying it to the ledger is the next
step, and this file is its citation.

---


| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D1 | 2026-09-05 rollout ruling | **Still in force.** All 54 rollout-gated decisions and the parked production/hosting/Transfer-Fees/S3/desktop items stay parked. Not reopened today. | 54 decisions, ~56 items |
| D2 | FastAPI backend fate | **Retire.** Keep the DB schema (drizzle); freeze/delete backend/. All 19 backend-gated items close. Today's pytest/numpy/faker merges become moot. | 15 decisions, 19 items |
| D3 | Personal vs commercial | **Development now, public-facing at launch.** Free tiers are the licensed posture for solo dev; launch needs vendor agreements (FMP first) with lead time. Closes the 17 "are we commercial?" decisions as answered. Reframed axis: internal-use vs public-facing display. | 17 decisions, 18 items |
| D4 | Item-16 legality question | **Legal review before launch.** Build-by-allocation, S5 contribution modeling, and the tax estimator stay built but dark until a qualified review clears them. The 9 items move from blocked-on-owner to blocked-on-review. | 9 decisions, 9 items |

## Batch 2

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D5 | SOC 2 | **Not now — revisit post-launch.** Trigger: first paying customer or first enterprise conversation. The 4 SOC 2 decisions close as deferred with that trigger. Branch-and-PR stays the informal change-management control. | 4 decisions |
| D6 | Scheduled unattended agents | **Dependabot triage only** (T-234), scoped to patch/minor, Tuesdays, never edits docs. Code-auditor scheduling (T-323) declined for now. Needs ANTHROPIC_API_KEY as a repo secret. | 2 items |
| D7 | Affiliate disclosure (T-291) | **Defer with rollout** — parked under D1. Nothing affiliate-related ships before rollout, so the disclosure lands at the same moment. | 4 items |
| D8 | Reddit OAuth (T-245) | **Defer with rollout** — Reddit's API terms are the same personal-vs-commercial class as FMP; read them in the launch vendor pass. Parked under D1/D3. | 1 item |

## Found already done during the pass
- T-071 (merge PR #147, fee-impact screener) — #147 is merged. File was stale.

## Batch 3

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D9 | S4 options-tool subproject | **Defer with rollout** (D1) — and behind the D4 legal review, since it expands an advice-adjacent tool. T-061/062/063 parked. | 3 items |
| D10 | /global-adoption CBDC page (T-135) | **CUT.** Delete the page and /live-data/cbdc-data; run T-137's clean-removal checklist. T-136 closes as not chosen. → ACTIONABLE | 3 items |
| D11 | CR3 sparkline + CR6 on-chain analytics | **Cut both.** Drop the always-n/a 30d sparkline column (T-097) and the on-chain section with its four unreachable charts (T-098). Same reasoning as RP-6. → ACTIONABLE | 2 items |
| D12 | Trade-ledger basis (T-027) + IV history (T-011) | **FIFO** for realised P&L; **manual** IV entry, no snapshot persistence. Both avoid infra ahead of D1. | 2 items |

## Batch 4

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D13 | Business formation (9 items) | **Defer with rollout, except T-289** (federal regulations research stays live — it feeds D4). T-290 country access answered by D3: US-only development. Entity/LLC/EIN/bank/tax-tracker/filings parked under D1. | 9 items |
| D14 | P5 cross-asset risk comparison | **OWNER'S OWN WORDS: "Remove all risk comparisons to avoid potentially sounding like a recommendation."** Stronger than any offered option. Scope to be inventoried and confirmed before cutting. T-349/T-356/T-359 resolve under it. | 3+ items |
| D15 | Planning docs (T-298, T-299, T-292, T-310) | **Draft all four, owner approves.** One PR. → ACTIONABLE | 4 items |
| D16 | Consistency defaults (T-096, T-283, T-128) | **Adopt all three:** Compare accepts non-catalog tickers; Coin Registry gets useScreenerUrl deep-linking; bond ladder extends the builder engine. → ACTIONABLE | 3 items |

## D14 — scope, confirmed item by item

**Owner's principle, verbatim:** *"Risk metrics that use traditional financial formulas can stay and should be visible where appropriate."* The line is the app's own 0–100 risk framework (a judgment) versus standard statistics (arithmetic): Sharpe, Sortino, volatility, drawdown, beta are arithmetic and stay.

| Surface | Ruling |
|---|---|
| `compare_staking_risk` MCP tool | **REMOVE.** Publishes composite Safety Scores side by side — RP-3's rejected surface via MCP. |
| `/api/v1/staking/opportunities` composite risk scores + `max_risk` filter | **REMOVE.** ⚠ API break — this is the R2 §5.3 contract that kept `computeOverallRisk`/`getRiskLevel` alive as `@internal`. With the API no longer serving scores, those helpers lose their only consumer and can go. `get_staking_opportunities` MCP tool reads this route and must drop its risk fields. |
| `/staking` page comparative copy ("highest counterparty risk… lowest custody risk", "Compare … custody risk across") | **REWRITE to neutral.** The list does not sort by risk; only the prose ranks. |
| `/compare` Sharpe / Sortino / volatility / drawdown | **KEEP** — traditional formulas. |
| Portfolios weighted risk (user's own holdings, coverage disclosed) | **KEEP** — RP-6's line: scoring what the user brought is explanation. |

→ ACTIONABLE (code), and a recorded decision that resolves the R2 §5.3 tension.

## Cascades found during the pass
- T-338 (npm audit + safety check gate CI): npm half already gating; 0 high advisories after today's bumps. The `safety check` half is Python backend tooling → closes under D2. ✓

## Batch 5 — final

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D17 | Staking rubric (T-264, T-265) | **Keplr liquidityRisk = 7 confirmed** — Cosmos has a 21-day unbonding period; annotate the reason in stakingProviders.ts. **No impermanent-loss axis** — IL is an LP risk, not a staking-provider risk. → ACTIONABLE (one annotation) | 2 items |
| D18 | More risk profiles (T-352, T-353, T-355) | **Defer all three until a consumer exists.** Trigger: a surface approved to render the score. After D14, the options scorer is lib/risk's last live consumer. | 3 items |
| D19 | Opportunity-scout PROPOSE pass (T-322) | **Defer until rollout planning.** Proposals made now park under D1 immediately. Its five 2026-09-08 proposals remain pending the owner's ruling. | 1 item |
| D20 | T6 agent-prompt evaluation (T-001) | **Run once now; owner judges.** One-off, not scheduled (D6 stands). Needs ANTHROPIC_API_KEY. Closes T-001 and T-129's result-quality half. → ACTIONABLE | 2 items |


---

## The 57 that remain

Every one is `owner-machine` in the file's own classification — it needs the owner's
egress, keys, or local files. **That is not the same as "the owner must do it."** The
session that produced this document runs on the owner's machine with a clean residential
egress, and did the FMP terms reading and the two-egress audit from it. Most of these
are executable from here.


### Probes / live verification (need real egress + keys) (28)

- T-003 — Root-cause staking 4/51 live-rate coverage on the owner's machine
- T-006 — Owner-machine `npm run audit` to regenerate DATA-AVAILABILITY.md post-Yahoo
- T-007 — Re-measure fund-universe payload size after the 2026-07-30 slimming (item 11)
- T-017 — Reconcile the owner's local-wip-s1 WIP branch against hidden backtest files
- T-036 — Verify SPOT_TRADING_FEES seeded maker/taker rates (LOW confidence) per exchange
- T-055 — Flip TAX_GUIDANCE_REVIEW from seeded to verified after reading primary tax sources
- T-056 — Hand-verify the two held-back zero-fee rows (Bitfinex DOT, Bitget USDC/BEP-20)
- T-073 — Verify AGTHX's sales-load rate from the prospectus, wire maxPct, and update the cost-order sentinel test
- T-089 — Verify curve-sourced Treasury yields render live on /macro/rates (D3 follow-up)
- T-090 — Reproduce /equities/social stuck on 'Fetching social signals…' on the owner's IP
- T-105 — Configure COINGECKO_API_KEY so builder drift pricing is not partial
- T-106 — Configure free provider API keys on the Integrations page for key-gated surfaces
- T-130 — Test and fine-tune all 11 agents against the REAL vs FALLBACK rule
- T-155 — Run fund-fee reconciliation on the owner's machine (resolve the SEC RR index URL, --inspect, then full run)
- T-159 — Delete any pre-2026-08-18 .exchange-credentials.json on hosts by hand (RP-5)
- T-236 — Branch protection on main + secret-scanning push protection
- T-238 — Keep an offline mirror clone outside OneDrive; refresh monthly
- T-266 — Live TradingView cross-check of crypto TA on 2–3 coins
- T-271 — Live cross-check of equity TA adjusted series (incl. NVDA)
- T-272 — Confirm FMP historical-price-eod/full carries adjClose
- T-282 — Browser click-through of screener deep-link filters on the owner's machine
- T-305 — Live spot-check that USDP and SNX price in portfolios
- T-367 — Set SLACK_BOT_TOKEN, SLACK_DEPLOY_CHANNEL_ID, STAGING_SMOKE_TEST_KEY secrets
- T-384 — Verify the IPO calendar (#145) at /equities/calendar with a free Alpha Vantage key
- T-386 — Re-verify the 37 non-'40-Act fund expense ratios and unchecked catalog fields before moving FUND_DATA_LAST_VER
- T-394 — Full re-verification of the staking provider catalog before bumping STAKING_DATA_LAST_VERIFIED (stale 2026-09-
- T-397 — Refresh stale staking FALLBACK values, starting with jito_sol 7.5 (real ~5.32%)
- T-398 — Dead/moved staking endpoint sweep (Rocket Pool, Binance Chain, adapools, Subscan, Cosmostation)

### Terms readings (need real egress) (20)

- T-140 — Re-run the news-publisher terms probe from the owner's machine (priority queue)
- T-141 — CoinDesk terms — read, conclude, verify
- T-142 — Cointelegraph terms — read, conclude, verify
- T-143 — Decrypt terms — read, conclude, verify
- T-144 — Bitcoin Magazine terms — read, conclude, verify
- T-145 — Dow Jones feed host (dowjones.io) — read MarketWatch terms, verify
- T-146 — MarketWatch terms — read, conclude, verify
- T-147 — CNBC (NBCUniversal) terms — read, conclude, verify
- T-148 — Investing.com terms — read, conclude, verify
- T-150 — FXStreet terms — read, conclude, verify
- T-152 — FMP terms — read site.financialmodelingprep.com/terms-of-service and answer the three questions
- T-240 — YouTube — read the API Services ToS, not the consumer site terms
- T-241 — Tiingo — obtain and read the plan's layered licence
- T-242 — Bitget — identify and read the operative terms document
- T-243 — CoinGecko — read the rest of the API Terms beyond Scope of Use
- T-244 — Reddit — read the Data API Terms (entry stays seeded)
- T-249 — StockTwits — read terms (low-confidence seeded; only social source served)
- T-250 — Recurring: re-read source verdicts before the 180-day window (oldest 2026-08-06) and quarterly licence re-chec
- T-251 — publicnode.com terms — seeded low confidence, needs a read
- T-252 — Batch-2 withdraw-fee exchange hosts — terms seeded LOW, read each
  - **✅ CLOSED 2026-09-15.** All five read or resolved. Poloniex §9 licenses its API
    "solely for the purposes of trading on Poloniex" → verdict `prohibited`, source
    removed (owner decision, same day). LBank read — binds only on registration, but
    claims database IP independently. XT.com publishes no reachable terms AND geo-blocks
    this region outright, so it stays `seeded` with `reviewedAt` unmoved. Record:
    `docs/audits/terms-review-apis-2026-09-14.md` (addendum, 2026-09-15).
  - ⚠ **XT's geo-block joins the open Bitget US-prohibition question below** — Bitget's is
    written, XT's is enforced at the edge. One decision, now covering two sources.
  - ⚠ **New, unassigned:** establish whether the hand-maintained Poloniex rows in
    `transferFees.ts` were copied from the now-prohibited API (several are dated
    2026-08-22, the day of the owner probe) or read from the published fee page. Needed
    before the next `TRANSFER_FEES_LAST_VERIFIED` bump.

### Fees / catalogs / hand-maintained data (2)

- T-031 — Manual withdrawal-fee worksheet pass over the 428 unreached rows (CORE 45 first) and move TRANSFER_FEES_LAST_V
- T-385 — Settle USO's expense ratio (0.81 vs 0.86) against its prospectus

### Git / branches / local files (2)

- T-102 — 18b — enable 'Require review from Code Owners' on the default branch
- T-371 — Rename pre-rename local databases/users on existing installs (caep→fn)

### Other (1)

- T-392 — Refresh fundFacts.generated.json quarterly from SEC N-PORT

### Not owner-machine, but open (4)

- T-070 [either] — S6 — catalog growth with provenance discipline
- T-181 [remote-dev] — Quarterly review of the production-readiness scorecard (next ~2026-10-29)
- T-289 [owner-decision] — Research federal regulations applicable to website and software
- T-393 [either] — Close out the 2024 cycle row in CYCLE_HISTORY once its trough is final


## Actionable work these rulings created

**Code**
- D10 — delete `/global-adoption` page and `/live-data/cbdc-data`; run T-137's clean-removal checklist
- D11 — drop the always-n/a 30d sparkline column (CR3); remove the coin-detail on-chain section and its four unreachable components (CR6)
- D14 — remove `compare_staking_risk` from the MCP server; remove composite risk fields and `max_risk` from `/api/v1/staking/opportunities` and from the `get_staking_opportunities` MCP tool; rewrite `/staking` copy to neutral; remove the `@internal` `computeOverallRisk`/`getRiskLevel` helpers, whose only consumer was that API; update R2 §5.3 references and `riskScoringRemoved.test.ts`
- D16 — Compare accepts non-catalog tickers; Coin Registry gets `useScreenerUrl` deep-linking; bond ladder tool extends the builder's `bondLadder()`
- D17 — annotate Keplr `liquidityRisk: 7` with the 21-day-unbonding reason
- D2 — retire `backend/`: freeze or delete, drop its CI jobs, keep the DB schema, update CLAUDE.md/README

**Documents**
- D15 — four planning docs as one PR: releasable-product bar, what is out of v1, house source-labeling policy, restate the risk-framework milestone
- D2/D14 — CLAUDE.md sections for the backend and the public API contract

**Runs from this machine**
- D20 — run the 11 agents once; collect outputs for the owner to judge
- D6 — configure the weekly dependabot triage (needs `ANTHROPIC_API_KEY` as a repo secret)
- The 20 terms readings and the remaining probes above

**Session record — 2026-09-15/16**

Written down because this session opened by recovering five outstanding items
from a PowerShell session that died mid-task. A list that lives only in a
terminal is one crash from being gone.

**The list behind the list.** Before that session died, the work was being driven
off `finance-now-open-tasks-2026-09-08.json` — a verified task queue generated
2026-09-07 at `main_sha 2128a18`: 398 tasks merged from 566 raw items, **338
outstanding** (172 open / 90 parked / 75 blocked / 1 unclear), 162 blocking
decisions, and 60 items the docs still presented as open that verification found
done. Every `T-###` in this document, the audits and the queue-verification pass
refers to that file. **It was never committed**, which is why the ids were
unfindable in the repo on 2026-09-15; it lives in an upload folder. The five
recovered items below are a subset of it. Its 338 has not been re-verified
against current `main` — the 2026-09-10 pass proposed 15 more closures and the
D1–D20 rulings parked or closed well over a hundred — and its own `known_gaps`
says 52 verdicts had no tie-break, so the number is a floor, not a count.

**How many of the 338 are done — determined 2026-09-16.** From this document's own
ledger above (338 → −77 → −205 → 57), the two verified-closure audits
(`queue-verification-sweep-2026-09-11.md`, `queue-closure-review-2026-09-13.md`), every
ruling resolved to ids through the queue's `blocking_decisions` map, and git since
2026-09-14. "Settled by rulings" is not "completed" — the 205 mixes done, parked,
declined and answered — so it is split here.

| Tier | Count | Evidence |
|---|---|---|
| Completed, independently re-verified | **77** | 62 re-checked file-and-line on 2026-09-13, 0 regressions; 15 closed in #178/#179 |
| Completed by ruling, landed 2026-09-15 | **35** | D10/D11/D14/D15/D16/D17 (16 named ids) + D2's 19 backend items, via #191–#193. **Never re-verified the 09-13 way** |
| Completed this session | **4** | T-252, T-241 (from the 57); T-234 (D6 workflow built); T-338 cascade |
| **Completed** | **116** | **34% of 338** |
| Read, pending ratification | 14 | Done in fact 2026-09-14; `review` not flipped — owner's act |
| Closed without doing | 2 | T-136 not chosen; T-323 declined |
| Decisions answered, items reframed | ~8 | D3 (5), D12 (2), T-290 |
| Parked by ruling — not done until rollout | ~158 | D1 + cascades, D4, D5, D7, D8, D9, D13, D18, D19. Consistent with the queue's own 165 parked+blocked at generation |
| Genuinely open | ~41 | The 57 minus what moved; each needs the owner's machine, keys, or a vendor reply |

The ledger's rows sum to 339 (one item double-counted; immaterial). The tiers are not
equally solid: the 77 were adversarially re-verified, the 35 merged but not re-checked,
and the 158 depends on cluster boundaries — a widened keyword match returns 72 for D1
against the ~56 above.

| Queue id | Was (2026-09-07) | After this session |
|---|---|---|
| T-252 | open, owner-machine | **Closed** |
| T-241 | open, owner-machine | **Closed** — read, enforced, then Tiingo dropped as optional |
| T-234 | open, owner-decision | **Closed** — D6; triage workflow built |
| T-323 | blocked, owner-decision | **Closed as declined** under D6 |
| T-236 | open, owner-machine | Mostly — secret scanning + push protection on; branch protection already enforced the 09-15 merges |
| T-001 | open, either | Built (D20 harness); run and assessment pending |
| T-130 | open, owner-machine | Instrumented — harness records tool calls; the test waits on the run |
| T-129, T-006, T-102, T-397, T-398 | open | Still open; T-006 is now the prerequisite for the coverage matrix |

| Recovered item | State |
|---|---|
| T-252 — Poloniex / LBank / XT terms | **Closed.** Poloniex `prohibited` and removed; LBank read; XT geo-blocks this region and publishes no reachable terms |
| Tiingo plan question | **Closed.** Starter is the free tier; all five call sites uncached per §1.6(a); Tiingo then settled as optional and not added |
| Dependabot alerts + dependency graph | **Closed** 2026-09-16, plus security updates, secret scanning and push protection (half of T-236) |
| D6 — `ANTHROPIC_API_KEY` secret | **Closed.** Secret set — and the workflow that consumes it did not exist, so it was built |
| D20 — run the 11 agents | **Built, not run.** `npm run agent-eval` (dry run by default). Needs the key in `frontend/.env.local` and the model decision below |

**GitHub settings changed 2026-09-16:** dependency graph, Dependabot alerts,
Dependabot security updates, Secret Protection and push protection all enabled.
Enabling them surfaced **26 open alerts** — 20 in `mcp-server/package-lock.json`,
3 in `frontend`, 2 in `backend/poetry.lock` — and opened five security PRs, taking
open PRs from 6 to 11.

⚠ **Alerts still scan `backend/poetry.lock`.** #193 removed the pip ecosystem from
`dependabot.yml`, which stops the PRs; it cannot stop alerts, because the lockfile
is still in the tree (frozen, not deleted, per the standing no-deletion rule).
Expect a permanent trickle of alerts against a directory nothing runs.

**Open, and each waiting on the owner:**

- **Agent model.** All 11 agents default to `claude-sonnet-4-6`. `claude-sonnet-5`
  is more capable *and* cheaper ($2/$10 per MTok vs $3/$15). Decide BEFORE D20
  runs — an eval against a model you are about to replace describes nothing useful.
- **Terms ratification.** 18 documents read on 2026-09-14; the registry still shows
  4 of 56 `verified`, because both audits say flipping `review` is the owner's act.
- **Distribution model.** BYOK is the working model; a turn-key edition is scoped
  alongside it. Both scopings exist as private artifacts on the owner's account.
- **The coverage matrix** — which providers, in combination, make every value live.
  Unblocked, needs no key, and it is the input to the BYOK decision because it
  produces the number of accounts a user would have to open.
- **`transferFees.ts` Poloniex provenance** — copied from the now-prohibited API,
  or read from the published fee page? Several rows are dated the day of the owner
  probe. Establish before the next `TRANSFER_FEES_LAST_VERIFIED` bump.

**Scheduled together — owner, 2026-09-15**

D20 and the market-data licensing research are one working block, at the owner's
request. They share a prerequisite worth doing first: **D20 needs
`ANTHROPIC_API_KEY`, and so does D6.** Setting the key up ahead of that block
reduces it to "run and judge" rather than "configure, then run, then judge".

The licensing work is scoped and its findings are recorded; what remains is
research, not analysis. Scoping document (private artifact, owner's account):
<https://claude.ai/artifact/ABpR3UNJe5BQmVGpWZuR3a>

Its headline: **the provider question is a distribution question.** Nothing can
be priced until it is settled whether the app is self-hosted (users hold their
own keys — which is what the current architecture already implements), hosted on
the owner's keys (needs display agreements, from ~$399/mo), or hosted with
per-user keys (which would reverse RP-5's removal of third-party key custody).

⚠ Carried into that block, from the 2026-09-15 reading of FMP's own guidance:
**D3's "development now, public-facing at launch" may not be the safe harbour it
reads as.** FMP states that purpose and sponsoring organisation decide
commercial use, not deployment stage — "a private prototype can still be
commercial when it supports an employer, startup, agency… or client". The remedy
vendors name is an authorised commercial evaluation licence, usually free. That
is the cheapest item on the whole agenda and it is worth doing whichever
distribution model wins.
