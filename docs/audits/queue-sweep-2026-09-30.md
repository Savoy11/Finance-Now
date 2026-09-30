# Queue sweep — 2026-09-30

**Status: APPLIED 2026-09-30.** Proposed first, per the checklist-steward protocol; the
owner approved all 47 (*"Yes, update all 47"*). One changed on the way in: the owner
answered T-059's question rather than sending it to a review — D47, *"A lawyer doesn't
need to review this"* — so it **closed** instead of moving to blocked (§4). The two
findings in the last section were ruled on the same day (D47, D48).

## Why this pass

The next four owner-decision items in the ledger (`docs/audits/task-queue-2026-09-07.json`)
were T-096, T-097, T-098 and T-099. Three of them had been **decided on 2026-09-14 and
built the same day**: D11 cut the Coin Registry's 30d column and the coin-detail on-chain
section (`e384d83`, #191), and D16 let Compare take any ticker (`f5b7651`, #192). The
ledger still listed all three as waiting on the owner.

`docs/decisions/2026-09-14-owner-decisions.md` says of itself: *"applying it to the ledger
is the next step, and this file is its citation."* It was applied in pieces — six
owner-record closures on 2026-09-19, D18 on 2026-09-26 — and never in full. The rulings
name some items by id and reach others by cascade (D2: *"All 19 backend-gated items
close"*; D5: SOC 2 *"not now"*), and a pass that searches by id finds only the first kind.

**Method.** Every item not closed was matched against every ruling in `docs/decisions/`.
Each claim of "done" was checked against the tree or GitHub, not against another
document. Items the rulings only *seem* to cover are listed separately and left alone.

## 1. Decided, and the work is done — close (9)

| Item | Ruling | Evidence |
|---|---|---|
| **T-096** Compare accepts non-catalog tickers | D16 | `compare/page.tsx:65` (header), `:92` `provisionalOption`, `:113` `searchRemoteOptions` — shipped in `f5b7651` (#192) |
| **T-097** CR3 — the always-"n/a" 30d column | D11: cut | Column and `Sparkline.tsx` deleted in `e384d83` (#191); `AssetTable.tsx` has no 30d column |
| **T-098** CR6 — coin-detail on-chain section | D11: cut | Four panels and the `AnalyticsBundle` types deleted in `e384d83`; `assets/[id]/page.tsx:778` and `types/asset.ts:124` record the cut |
| **T-283** Coin Registry deep links | D16 | `AssetRegistryClient.tsx:82` wires `useScreenerUrl` — `f5b7651` (#192) |
| **T-135** /global-adoption: cut or rework? | D10: CUT | Page and `/live-data/cbdc-data` deleted in `e384d83` |
| **T-136** If INVEST: rework as a CBDC tracker | D10 | Not chosen |
| **T-137** If CUT: the clean-removal checklist | D10 | Run in `e384d83`: page, route and registry entry gone; no `routePrefixes` entry; the smoke check now expects a 404 (`test-live-data.mjs:313`). The redirect stays **on purpose** (`next.config.mjs:52`) so bookmarks land on /headlines |
| **T-128** Bond ladder: standalone or extend the builder? | D16: extend `bondLadder()` | Recorded at `ROADMAP.md:581`; the build itself is an unscheduled backlog entry there, not a ledger item |
| **T-079** Dependabot redis-py for the backend (#59/#97) | D2: backend retired | Both PRs closed unmerged — #59 on 2026-08-17, #97 on 2026-09-09 |

## 2. Decided "no", or made moot — close (13)

| Item | Ruling | Why it closes |
|---|---|---|
| **T-011** IV rank: persist a daily snapshot? | D12 | Manual entry, no snapshot. `equities/options/page.tsx:166` is the manual input |
| **T-349** P5: is cross-asset-class risk comparison supported? | D14 | No — *"Remove all risk comparisons."* D14's scope table keeps the Portfolios weighted-risk figure (the user's own holdings, coverage shown), and D33's Methodology Guide lists cross-asset comparisons among what is not scored |
| **T-356** Calibration pass — only if P5 were yes | D14 | P5 is no |
| **T-114** Does the FastAPI backend return? | D2 | Retired and frozen (`backend/FROZEN.md`) |
| **T-219** Backend monitoring in production | D2 | Nothing left to monitor |
| **T-220** Validate the backend scoring model | D2 (and RP-6) | The engine is retired |
| **T-348** Reconcile backend scoring bands before reactivation | D2 | `FROZEN.md:91` already makes the canonical bands a condition of any revival |
| **T-182, T-183, T-184, T-186, T-187, T-335** | D2 | Backend-only features: JWT blocklist, WebSocket backplane, `mfa_secret` encryption, TimescaleDB retention, FastAPI `/docs`, refresh-token rotation. Reviving any needs a decision reversing D2 first (`FROZEN.md:76`) |

## 3. Decided "later" — park, with the trigger (24)

`parked` is the ledger's word for *"owner deliberately deferred (do not start unprompted)"*.

| Items | Ruling | Trigger |
|---|---|---|
| **T-245** Reddit OAuth | D8 | The rollout's vendor-terms pass |
| **T-291** Disclosure documents | D7 | The rollout — nothing affiliate-related ships before it. ⚠ **Wrong, and reversed the same day** — see the correction at the end |
| **T-060, T-061, T-062, T-063** S4 options subproject | D9 (names T-061–T-063) | The rollout, behind the D4 legal review |
| **T-202** SOC 2 change-management policy | D5 | First paying customer or first enterprise conversation. Until then *"branch-and-PR stays the informal change-management control"* — D5 answers this item's own question |
| **T-196, T-197, T-198, T-200, T-201, T-203, T-207, T-208, T-210, T-211** the SOC 2 programme | D5 | Same trigger |
| **T-295, T-296, T-297** tax tracker, bookkeeping, annual filings | D13 | The rollout (entity formation targeted January 2027, D28) |
| **T-288** Business bank account | D28 | D28 says in so many words that T-287 and T-288 *"stay parked under D13"*; the ledger had T-288 as blocked |
| **T-290** Which countries can use it | D13 | Answered for development: US-only (D3). The launch list comes back with the rollout, so the item stays tracked rather than closed |
| **T-127** Desktop update mechanism | D1 | *"desktop items stay parked"* |
| **T-222** Load test | D2 + D1 | D2 answered its backend half; the rest needs a deployment |

## 4. Answered by a review, not by the owner — open → blocked (1)

| Item | Ruling | Blocker from now on |
|---|---|---|
| **T-059** the item-16 legality question | D4 | A qualified legal review before launch. None is engaged for now (D30). Its dependants (T-058, T-064, T-065, T-068, T-116) stay blocked on it, correctly |

> **Applied differently.** Asked about the finding below, the owner ruled D47: build-by-
> allocation — item 16 itself — needs no legal review. T-059 therefore **closed**. D4 still
> gates the two unbuilt tools, so T-058, T-064 and T-068 were re-pointed to D4's review by
> name (T-064 and T-068 had named T-059), and T-116's item-16 clause was dropped as cleared.
> T-065's blocker never named T-059 and was left alone.

## 5. Narrowed — a note, no status change (1)

| Item | Ruling | What is left |
|---|---|---|
| **T-027** Trade ledger cost basis | D12: FIFO | Two questions for when the trade ledger is built: one method for every portfolio or per portfolio, and how a holding's typed-in average cost becomes its opening lot |

## Left alone on purpose

- **Inferred, not named** — each looks deferred, but no ruling names it, so it is the
  owner's call: **T-125** affiliate legal review (D7 says nothing affiliate-related ships
  before rollout), **T-365 / T-366** AWS cost and production (D1, and D21 defers paid
  decisions), **T-154** FMP at release (D21/D22), **T-026** activating S3–S6 (S4 is
  deferred by D9 and S5 gated by D4, but S3 and S6 are not ruled on).
- **T-357, T-012** — risk figures for equities/API/MCP and macro profiles. D34 declined,
  in writing, to extend its reasoning to anything else.
- **T-289** — D13 keeps federal-regulation research live.

## Found while sweeping — for the owner, not the ledger

1. **"Set my own weights" is visible, but D4 says it is dark.** → **Ruled D47: no review
   needed; it stays live.** D4 (restated by D30):
   build-by-allocation *"stay[s] built but dark until a qualified review clears"* it, and
   `BUSINESS-CHECKLIST.md:230` lists it under *"Gated on external review … built, dark"*.
   The mode switch is live at `portfolio-builder/page.tsx:278`.
2. **`BUSINESS-CHECKLIST.md:230` calls two things built that are not.** → **Corrected** —
   the line now names only the two unbuilt tools, as not built, and says why
   build-by-allocation left it. S5 contribution
   modeling and the federal sale-tax estimator do not exist; their items (T-067, T-058)
   say "do not build" until the review.
3. **T-099 is a real open decision.** → **Ruled D48: priced holdings only, with the
   coverage shown. Built, and T-099 closed.** `computeAnnualIncome` counts a holding with no live
   price at its planned amount (`portfolioUtils.ts:283`, pinned at
   `portfolioUtils.test.ts:254`), while the same page promises positions without a live
   price are *"excluded from totals, never valued at cost"* (`portfolios/page.tsx:1065`).
   That is PB-1's shape, which was fixed for the value and P&L totals on 2026-08-18.

## Counts

| Status | Before | As proposed | As applied (with D47, D48) |
|---|---|---|---|
| closed | 148 | 170 | **172** |
| open | 47 | 32 | **31** |
| blocked | 68 | 45 | **44** |
| parked | 93 | 109 | **109** |
| unclear | 1 | 1 | **1** |
| **total** | **357** | **357** | **357** |

Open owner-decision items — the "waiting on you" list — went from 23 to **7**: T-125,
T-154, T-215, T-289, T-365, T-366 and T-407.

## Also found, outside the ledger

While checking descriptions against the fee rows, VUG's still said "at 4 bps" after D38
moved its row to 0.03 — a slip in the T-412 change — and VTEB's said "MUB's twin at the
same fee" against 0.03 and 0.05, wrong since the re-root. Both reworded;
`fundCatalog.test.ts` now fails any description whose "N bps" disagrees with its row.

## Correction, the same day — T-291 should not have been parked

**What went wrong.** This sweep matched items against `docs/decisions/` and the tree, and never
read the ledger page's workspace log — the `log` collection other sessions write to when
something happens away from the repository. The FN & NC business chat had recorded two things
there that bear on T-291: a first draft of the whole disclosure set on 29 September, and the
owner's decision on 30 September about where the legal pages go. So T-291 was parked ("do not
start unprompted") while the owner was working on it. The log also recorded a third decision the
sweep had left as an owner question: no paid or affiliate links at launch.

**How it was fixed.** After #254 merged, the log was read and the owner was asked to confirm
each decision before it was recorded. Both were confirmed and recorded as **D49** and **D50**
(`docs/decisions/2026-09-30-owner-decisions.md`):

| Item | Was (after this sweep) | Now | Ruling |
|---|---|---|---|
| **T-291** Disclosure documents | parked | **open** — reopened, with a correction on the item | D50 |
| **T-293** Placement rules | blocked on T-291 | **open** — the rule is decided; the build remains | D50 |
| **T-120** Affiliate program terms | open | **parked** until after launch | D49 |
| **T-125** Affiliate legal review | open (left alone above) | **parked** until after launch | D49 |

Counts after the correction: closed 172, open 31, blocked 43, parked 110, unclear 1.

**The lesson, for the next sweep.** Read the workspace `log` before proposing anything. Decisions
reach it before they reach the repository — here because this file's own PR was still open — and
a sweep that checks the repository alone will park work that is under way.

