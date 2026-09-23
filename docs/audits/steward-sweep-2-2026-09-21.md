# Checklist-steward sweep 2 — the drifted 23

**Date:** 2026-09-21  
**Status: PROPOSED — NOTHING HAS BEEN APPLIED.**

## Why this sweep exists

On 2026-09-13, `docs/audits/queue-closure-review-2026-09-13.md` re-verified 62 queue
items against `main@55a4b52`, concluded *"62 of 62 evidence intact, 0 regressions"*, and
recommended *"Approve all 62"*. **The ledger write never happened.** 43 of those 62 still
read `"status": "open"` on 2026-09-21.

The first sweep of 2026-09-21 (`steward-sweep-2026-09-21.md`, commit `bb228d5`) closed 20
of the 43. These are the remaining **23**. The "37" figure that first sweep reported was
one agent counting from its own six-item vantage point; 20 of the 43 were covered by that
same sweep, leaving 23.

⚠ **The 2026-09-13 verdict was not treated as evidence here.** It was measured against a
commit that has since moved — and one item in this batch proves the cost: T-361 was
recorded "evidence intact" on 2026-09-13, and owner decision D14 landed the *next day* and
deleted the very helpers it is about. Every verdict below was re-derived from the current
tree.

## Result

| Verdict | Count | Items |
|---|---|---|
| close | 20 | T-257, T-327, T-302, T-100, T-270, T-388, T-173, T-346, T-103, T-081, T-304, T-376, T-377, T-382, T-069, T-118, T-126, T-308, T-391, T-074 |
| supersede | 1 | T-361 |
| still-open | 2 | T-172, T-369 |

**21 of 23 were already done.** Two are genuinely still open and are restated below
against the current tree, because their original `next_action` text has itself gone stale.

---

## 1. Still open — the only two

### T-172

- **Proof point:** `frontend/src/app/live-data/staking-discovery/route.ts:457-467`

**Why it is still open**

The first cure the next_action proposed HAS landed — route.ts:77 sets `UPSTREAM_TIMEOUT_MS = 6_000` and :98 applies `AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)` per fetch, with :80-87 explaining that a timeout is deliberately not retried. But the item is not closable. The second cure (serve last-good immediately, refresh in background) is NOT implemented: route.ts:457-467 keys last-good on `coinFilter|minTvl|minApy|sourceFilter` and returns it only when `pools.length === 0 && anyUpstreamFailed` and the entry is warm, so a cold or differently-filtered request that lands nothing returns `ok: true` with zero pools and no `stale` flag — exactly the hole the 2026-09-19 progress note recorded, still at the same lines. And the latency claim is measurement-derived, so it is not mine to settle: the only fast figure is 2,238 ms / 94 pools in docs/audits/live-data-audit-2026-09-19.json, against 7.6/7.7/9.6 s on same-day re-probes, and DATA-AVAILABILITY.md:843 itself records both. Nothing in the tree has changed on this route since that note.

**What is actually left, restated against today's tree**

Restated against today's tree, the original next_action is half-stale — do NOT re-do the 6 s budget, it is at route.ts:77/98. What is actually left, in the order it should be taken: (1) SPLIT OUT THE DEAD UPSTREAMS. Three of the four sources contribute zero pools — route.ts:227 still fetches `api.yearn.finance/v1/chains/1/vaults/all` (does not resolve), :281 still fetches `api-v2.pendle.finance/core/v1/sdk/1/markets?limit=100&order_by=liquidity:desc` (404s on that exact URL), and Beefy answers 200 landing nothing. That is a correctness defect, not a latency one, it has no ledger item of its own (T-172 is the only queue entry mentioning any of the three), and it should become one rather than riding a perf item. (2) FIX THE COLD-START HOLE at route.ts:457-467: last-good is per-exact-filter-key and only consulted when a fetch failed, so a zero-pool response can ship as `ok: true` with no `stale` flag. (3) ONLY THEN the latency question, and only on the owner's machine: one `npm run audit` plus repeated direct probes, because the single 2,238 ms reading is not reproducible on demand and a single fast sample is not a measurement. Note the ~18-22 s figure in the item's title is superseded by DATA-AVAILABILITY.md:843 (~2.2 s re-measured 2026-09-19) — reopening against 18 s would chase a number that no longer describes the route.

### T-369

- **Proof point:** `.github/workflows/ci.yml:7-12`

**Why it is still open**

Two of the three deliverables are verifiably done, the third — the one the title actually names — has no record anywhere in the tree. Done: (1) the workflow gate, `.github/workflows/cd-staging.yml:87`, so main's push runs are no longer permanently red; (2) the CI status badge for main, README.md:3, `.../workflows/ci.yml/badge.svg?branch=main` linking to `?query=branch%3Amain`; and the signal it reports is real, since `.github/workflows/ci.yml:7-12` includes main in `on.push.branches` with a comment explaining that the PR gate checks the merge preview rather than what lands. NOT done: the recurring check itself. Nothing in the repo adopts or records a habit, routine or automation for glancing at post-merge push runs — `.github/workflows/` has exactly one `schedule:` trigger and it is dependabot-triage.yml:41-42 (weekly Dependabot sweep, unrelated); `.claude/` holds no commands or routines; and a grep of docs/ for 'post-merge' / 'push run' finds only docs/deployment/aws-provisioning.md:17 and :196-197 (the original finding, still worded exactly as the item quotes it) and three TASK-QUEUE lines about #134. The TASK-QUEUE status block at :2236-2250 records the red-X fix — that is T-081's subject — and says nothing about adopting a recurring check, so the 'record the decision in TASK-QUEUE via the steward' half is also unwritten. The item's stated_status in the queue detail was 'proposed', i.e. it was awaiting owner adoption, and no owner adoption is recorded. Closing it would tick a box for a habit nobody has agreed to.

**What is actually left, restated against today's tree**

Only the process half. (a) The owner decides whether to adopt anything beyond the badge — a habit of checking Actions on main after each merge, a scheduled routine, or an explicit 'the badge is the check, nothing further' ruling; the badge at README.md:3 is a reasonable basis for that last answer, since it surfaces main's post-merge CI on the front page. (b) Whichever is chosen, the steward records it as a dated status block in docs/TASK-QUEUE.md — the existing block at :2236-2250 covers only the red X and is not a substitute. The item's own next_action is partly stale: its two code/doc asks (gate cd-staging, add a main CI badge) are already satisfied at cd-staging.yml:87 and README.md:3, so a steward should propose a `progress` block recording those two as done rather than re-requesting them.

---

## 2. Superseded

### T-361

- **Superseded by:** D14 — docs/decisions/2026-09-14-owner-decisions.md:210 (scope table row at :67, confirmed-item-by-item section from :71)
- **Proof:** `frontend/src/lib/data/stakingProviders.ts:207-225`

The item asks CLAUDE.md to describe computeOverallRisk()/getRiskLevel() as `@internal` legacy helpers kept for the /api/v1/staking/opportunities legacy fields. Owner decision D14 (docs/decisions/2026-09-14-owner-decisions.md:210) instead ordered those helpers REMOVED along with the published composite fields, and the tree confirms it: stakingProviders.ts:207-225 is a tombstone comment where they were, no definition survives anywhere under frontend/src (the only hits are that tombstone, comments in affiliates.ts, normalize.ts and stakingAdapter.ts, and the guard assertions in lib/risk/__tests__/riskScoringRemoved.test.ts:161-162,176,193 that fail if either is reintroduced). Writing the requested text into CLAUDE.md would publish a false claim. CLAUDE.md:520 already documents the deletion, and :538 records scoreStakingProvider() as retained with no live consumer — which is the accurate version of what this item wanted said.

**Proposed ledger text**

```
"proposed_closure": {
  "status_was": "open",
  "proposed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "supersede",
  "superseded_by": "D14 — docs/decisions/2026-09-14-owner-decisions.md:210",
  "pending_owner_approval": true,
  "reason": "IMPOSSIBLE AS WRITTEN. This item asks CLAUDE.md to describe computeOverallRisk()/getRiskLevel() as `@internal` legacy helpers retained for the /api/v1/staking/opportunities legacy fields. D14 (2026-09-14) ordered the opposite — 'remove the @internal computeOverallRisk/getRiskLevel helpers, whose only consumer was that API' (docs/decisions/2026-09-14-owner-decisions.md:210) — and the tree confirms the removal: frontend/src/lib/data/stakingProviders.ts:207-225 is a tombstone comment where they stood, no definition of either survives under frontend/src, and lib/risk/__tests__/riskScoringRemoved.test.ts:161-162,176,193 fails if one returns. Applying the next_action would put a false statement into the highest-traffic document in the repo. NOTHING IS OUTSTANDING: CLAUDE.md:520 already records the 2026-09-14 deletion and :538 records scoreStakingProvider() as the retained 0-100 higher-is-safer engine with no live consumer after D14 (D18 defers wiring it up).",
  "citation_drift": "The item's source cites docs/architecture/risk-scale-spec.md:770; the quoted line ('`CLAUDE.md` — `stakingProviders.ts` section, once `computeOverallRisk` is internal-only.') now sits at :864, and its precondition never occurred — the helpers were deleted rather than made internal-only.",
  "evidence": ["docs/decisions/2026-09-14-owner-decisions.md", "frontend/src/lib/data/stakingProviders.ts", "frontend/src/lib/risk/__tests__/riskScoringRemoved.test.ts"]
}
```

---

## 3. Verified done — proposed for closure

### T-257

- **Proof:** `docs/audits/2026-09-08-audit.md:1-6`

The pass ran and its report is in the tree. docs/audits/2026-09-08-audit.md:1-6 records exactly the check set the next_action specified — `npx tsc --noEmit`, `npx vitest run`, `npx eslint .`, `npx next build`, `gen-data-sources --verify`, `npm audit`, `git log` — with `npm run audit`/`smoke` skipped for the recorded IP-skew reason. It is a full baseline rather than another smoke test: five findings (1 P1, 4 P2) plus an 'Examined and clean' section at :268 that covers precisely the areas 2026-07-30-audit.md:156 listed as untouched (RP-5/RP-6 policy scan, the risk-scale sweep across the staking surface, route invariants, provenance dates, the Yahoo block). It ran at f4c850f on branch `claude/outstanding-tasks-l86xjw` rather than the origin/main `2128a18` the next_action named, and the report's own note at :8-13 records that and shows no frontend source differed. This closes the overdue instance only — `.claude/agents/code-auditor.md:3` makes the pass fortnightly, so the next instance (due ~2026-09-22, after the D2/D14 merges) is a new item, not this one.

<details><summary>Proposed ledger text</summary>

```
"proposed_closure": {
  "status_was": "open",
  "proposed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE — the overdue baseline pass ran and its report is in the tree. docs/audits/2026-09-08-audit.md:1-6 carries the code-auditor check set this item asked for (tsc --noEmit, vitest, eslint, next build, gen-data-sources --verify, npm audit, git log) and skips `npm run audit`/`smoke` with the recorded IP-skew reason. It is a full pass, not a smoke test: 5 findings (1 P1, 4 P2) plus an 'Examined and clean' section at :268 covering the RP-5/RP-6 policy scan, the risk-scale sweep, route invariants, provenance dates and the Yahoo block — the areas 2026-07-30-audit.md listed as untouched. It ran at f4c850f on branch claude/outstanding-tasks-l86xjw rather than origin/main 2128a18 as the next_action named; the report's note at :8-13 records that and that no frontend source differed. CLOSES THE OVERDUE INSTANCE ONLY: the cadence in .claude/agents/code-auditor.md:3 is fortnightly, so the next pass (due ~2026-09-22, after D2/D14 landed via #191-#193 and #205/#206/#208/#209) is a NEW item, not a reopening of this one.",
  "citation_drift": "This item's own source cites docs/audits/2026-07-30-audit.md 'lines 5-9' for the 'Untouched: the ~15 unverified leads' quote; that text now sits at line 156.",
  "evidence": ["docs/audits/2026-09-08-audit.md"]
}
```

</details>

### T-327

- **Proof:** `docs/agents/checklist-steward.md:140`

The item exists because the charter's known-open block was dated 2026-07-30. docs/agents/checklist-steward.md:140 now reads '## Known open items (state as of 2026-09-08 — verify before relying on this)', and :142-143 states it was refreshed from the 2026-09-07 outstanding-task sweep plus the 2026-09-08 corrections — which is the replacement block the next_action asked to be drafted and approved. It is live in the tree, so it cleared the propose→approve→apply path, and it has been maintained since (the terms bullet at :155 carries a dated 2026-09-19 update with the superseded text struck rather than deleted). Note the block is itself 13 days old today; that is normal ageing of a dated snapshot, not the drift this item was raised on.

<details><summary>Proposed ledger text</summary>

```
"proposed_closure": {
  "status_was": "open",
  "proposed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE — the 2026-07-30 snapshot this item was raised on no longer exists. docs/agents/checklist-steward.md:140 reads '## Known open items (state as of 2026-09-08 — verify before relying on this)', and :142-143 records that it was refreshed from the 2026-09-07 outstanding-task verification sweep (398 items) plus the corrections applied 2026-09-08 — exactly the replacement block the next_action asked to be drafted and put through the owner for approval. It is in the tree, so it cleared propose→approve→apply, and it has been kept current since: the terms bullet at :155 carries a dated 2026-09-19 update with the overtaken sentence marked '(Superseded:)' rather than rewritten. The block is 13 days old today, which is ordinary ageing of a dated snapshot and not the five-plus-week drift this item names.",
  "citation_drift": "The item's source cites docs/agents/checklist-steward.md:112-121 for the '(state as of 2026-07-30)' heading; lines 112-121 are now part of verification rule 6/7, and the heading is at :140 with the current date.",
  "evidence": ["docs/agents/checklist-steward.md"]
}
```

</details>

### T-302

- **Proof:** `backend/pyproject.toml:87`

The ask was: raise the floor above 45% with new tests. backend/pyproject.toml:87 now declares `--cov-fail-under=55`, and the comment block at :70-86 records the raise 45→55 on 2026-09-08 'on the back of 47 new tests over app/scoring'. The tests exist and I counted them rather than trusting the comment: backend/tests/test_scoring/test_components.py has 25 `def test_` and test_normalizer.py has 22 — 47 exactly. docs/CI-REMEDIATION.md:100-117 records the same close ('Closed the way the entry asked for: with tests, not by moving a number') and that the floor is declared once, with ci.yml deliberately not overriding it. The item's next_action also names running pytest to re-measure; that is owner-machine work I did not and may not run, but the deliverable it gates — a raised floor backed by tests — is in the tree. Worth the owner knowing: since D2 (2026-09-14) the backend is frozen and ci.yml has no backend-test job (jobs are frontend-check, docker-build, security-scan, terraform-validate, ci-success), so this floor now gates only a local bare `pytest`; any FURTHER raising is moot under D2, not merely done.

<details><summary>Proposed ledger text</summary>

```
"proposed_closure": {
  "status_was": "open",
  "proposed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE, AND THEN OVERTAKEN. Done: backend/pyproject.toml:87 declares `--cov-fail-under=55` (was 45), and the comment at :70-86 records the 2026-09-08 raise as resting on 47 new tests over app/scoring. The tests were counted first-hand, not taken from the comment: backend/tests/test_scoring/test_components.py carries 25 `def test_` and tests/test_scoring/test_normalizer.py carries 22 — 47 exactly. docs/CI-REMEDIATION.md:100-117 records the same closure ('Closed the way the entry asked for: with tests, not by moving a number') and that the floor is now declared in one place with ci.yml deliberately not overriding it. Overtaken: D2 (2026-09-14) retired the backend — backend/FROZEN.md states no CI job builds or tests it, and .github/workflows/ci.yml now has only frontend-check, docker-build, security-scan, terraform-validate and ci-success — so this floor gates a bare local `pytest` and nothing in CI. Any further raising is moot under D2. NOT re-measured here: `pytest --cov` is owner-machine work and was not run; the closure rests on the config value and the test files, both code-derived.",
  "citation_drift": "The item's source quotes docs/CI-REMEDIATION.md:77-82 asserting `--cov-fail-under=45` against ~51% and 'that work is still outstanding'. That passage no longer exists anywhere in the document; :111 now states the floor is 55.",
  "evidence": ["backend/pyproject.toml", "backend/tests/test_scoring/", "docs/CI-REMEDIATION.md", "backend/FROZEN.md"]
}
```

</details>

### T-100

- **Proof:** `frontend/src/lib/utils/indicators.ts:1705`

All three pinned edge cases are hardened in source, exactly as next_action prescribed, and the code names the ruling. fibRetracement now early-returns null on an empty slice (frontend/src/lib/utils/indicators.ts:1140) and on non-finite bounds (:1145). buildTechnicalRead returns EMPTY_TECHNICAL_READ on candles.length===0 (:1705) with the comment "Returning an explicit empty read says 'nothing to read' rather than inventing a neutral verdict out of arithmetic on nothing (D-24 #4, owner-approved 2026-09-08)". detectSetups requires a non-zero band width before volatility_compression fires — `if (cur > 0 && cur <= min * 1.1)` at frontend/src/lib/utils/scanSetups.ts:82, with the same D-24 #4 owner-approval comment. The pinning tests were flipped to assert the guard rather than document the behaviour: priceTargets.test.ts:77 `expect(fibRetracement([])).toBeNull()`, :82 same for a NaN series, :276 buildTechnicalRead([]) returns the empty read, :376 a 60-bar flat series does NOT produce volatility_compression. So both halves of the item — the decision and the hardening — landed.

<details><summary>Proposed ledger text</summary>

```
In docs/audits/task-queue-2026-09-07.json, item T-100: set "status": "closed" and add:

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DECIDED AND DONE — the owner chose hardening over leaving the three pinned, and all three landed. fibRetracement returns null on an empty slice (lib/utils/indicators.ts:1140) and on non-finite bounds (:1145); buildTechnicalRead returns EMPTY_TECHNICAL_READ on an empty series (:1705); the volatility-compression detector now requires a non-zero band width (lib/utils/scanSetups.ts:82). Both code sites carry the comment 'D-24 #4, owner-approved 2026-09-08'. The pinning tests were flipped from documenting the behaviour to asserting the guard (lib/utils/__tests__/priceTargets.test.ts:77, 82, 276, 376). The item's cited source line had drifted (P3-production-review.md 1071-1072/1084-1087 -> 1111-1116), which is part of why this read as open.",
  "approved_by": "<pending — owner approval of the 2026-09-21 re-verification sweep>",
  "evidence": [
    "frontend/src/lib/utils/indicators.ts:1140, 1145, 1705",
    "frontend/src/lib/utils/scanSetups.ts:82",
    "frontend/src/lib/utils/__tests__/priceTargets.test.ts:77, 82, 276, 376"
  ]
}

Sibling, proposed separately: docs/assessments/P3-production-review.md pinned #4 (now lines 1111-1116) still reads as unresolved. Per the charter its findings text is annotated, never edited — add a dated block immediately after line 1116:

> **Status, 2026-09-21: #4 resolved, not still pinned.** `fibRetracement([])` returns
> `null` (`lib/utils/indicators.ts:1140`), `buildTechnicalRead([])` returns an explicit
> empty read (`:1705`), and the volatility-compression setup now requires a non-zero
> band width (`lib/utils/scanSetups.ts:82`) — all three landed under the owner approval
> of 2026-09-08 recorded in those files' comments, and the pinning tests in
> `priceTargets.test.ts` now assert the guards. Items 1-3 of this list are untouched by
> that pass.
```

</details>

### T-270

- **Proof:** `frontend/src/app/(dashboard)/technical-analysis/page.tsx:86`

The refactor is complete and done the way the item asked. frontend/src/components/analytics/technical/ now exists and holds all nine panels: BacktestPanel, KeyLevelsPanel, MarketStructurePanel, MultiTimeframeGrid, PatternsPanel, SignalSummaryPanel, SupportResistancePanel, TechnicalReadPanel, ThesisBuilderPanel. The page imports eight of them at page.tsx:86-93 and composes them at :397-428; it is now 437 lines, down from the 1,266 the item measured (and 1,791 in the T10 audit). BacktestPanel's hidden-but-recoverable constraint was honoured rather than ignored — page.tsx:82-84 explains it moved with the others but is deliberately NOT imported because it has no routed consumer, and the file is retained at components/analytics/technical/BacktestPanel.tsx. One trivial residue, not a reason to keep the item open and already flagged by the parallel sweep (docs/audits/steward-sweep-2026-09-21.md:1467): `confluenceLabel` is still imported at page.tsx:31 and used nowhere in that file — the real call moved into MultiTimeframeGrid.tsx.

<details><summary>Proposed ledger text</summary>

```
In docs/audits/task-queue-2026-09-07.json, item T-270: set "status": "closed" and add:

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — frontend/src/components/analytics/technical/ exists and holds all nine panels (BacktestPanel, KeyLevelsPanel, MarketStructurePanel, MultiTimeframeGrid, PatternsPanel, SignalSummaryPanel, SupportResistancePanel, TechnicalReadPanel, ThesisBuilderPanel). technical-analysis/page.tsx imports eight at :86-93 and composes them at :397-428; the file is 437 lines, down from the 1,266 this item measured. BacktestPanel's hidden-but-recoverable status was preserved: it moved with the others but is deliberately not imported, and page.tsx:82-84 says so. Residue, flagged not fixed: the now-dead `confluenceLabel` import at page.tsx:31.",
  "approved_by": "<pending — owner approval of the 2026-09-21 re-verification sweep>",
  "evidence": [
    "frontend/src/components/analytics/technical/ (9 files)",
    "frontend/src/app/(dashboard)/technical-analysis/page.tsx:82-93, 397-428",
    "docs/audits/steward-sweep-2026-09-21.md:1467 (dead confluenceLabel import)"
  ]
}

Sibling: docs/assessments/T10-crypto-ta-audit.md:74-80 ("At 1,791 lines the page inlines ~10 self-contained components ... These would move cleanly to `components/analytics/technical/`") is a dated audit record — annotate, do not edit. Proposed block after line 80:

> **Status, 2026-09-21: done.** The nine panels listed here now live in
> `frontend/src/components/analytics/technical/`; `technical-analysis/page.tsx` is 437
> lines and composes them (`:86-93`, `:397-428`). `BacktestPanel` moved with them and is
> deliberately not imported, preserving the 2026-08-20 hidden-but-recoverable posture.
```

</details>

### T-388

- **Proof:** `frontend/src/components/analytics/technical/MultiTimeframeGrid.tsx:44`

Both warnings are structurally gone, and each fix names the rule it removes. The old page.tsx:361 warning (MultiTimeframeGrid calling setRows synchronously at the top of an effect) is fixed in the extracted component: state is keyed on the asset with a lazy initialiser (MultiTimeframeGrid.tsx:50-53) and the comment at :44-49 says so explicitly — "State is KEYED on the asset rather than reset by a synchronous setState at the top of the effect ... it cost a cascading render every time (react-hooks/set-state-in-effect). Deriving the reset makes both go away." Its remaining useEffect (:55-71) only calls setState inside async callbacks, which the rule does not flag. The old page.tsx:770-773 warning (setStrategyKey in an effect) is fixed exactly as next_action prescribed: BacktestPanel.tsx imports only `useState, useMemo` (:11), has no useEffect at all, and derives `defaultKey` via useMemo at :67-72 with `const activeKey = strategyKey ?? defaultKey` at :73. Across the whole technical/ folder MultiTimeframeGrid is the only file with a useEffect, and technical-analysis/page.tsx's single remaining effect (:168-178) sets state only inside a mousedown handler. Caveat: I did not execute eslint (a steward proposes and this sweep forbids running suites), so this is verified from source rather than from a lint run.

<details><summary>Proposed ledger text</summary>

```
In docs/audits/task-queue-2026-09-07.json, item T-388: set "status": "closed" and add:

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — both react-hooks/set-state-in-effect sites are gone, fixed the way next_action specified and during the T-270 panel extraction. The MultiTimeframeGrid warning (was page.tsx:361) is cured by keying state on the asset with a lazy initialiser (components/analytics/technical/MultiTimeframeGrid.tsx:50-53); its comment at :44-49 names the rule. The backtest warning (was page.tsx:770-773) is cured by deriving the default with useMemo (components/analytics/technical/BacktestPanel.tsx:67-73); that file imports no useEffect at all (:11). MultiTimeframeGrid is the only file in components/analytics/technical/ with an effect, and its setState calls sit inside async callbacks. Verified from source, not from an eslint run — the steward does not run suites; a lint pass on the next PR would confirm zero warnings.",
  "approved_by": "<pending — owner approval of the 2026-09-21 re-verification sweep>",
  "evidence": [
    "frontend/src/components/analytics/technical/MultiTimeframeGrid.tsx:44-53, 55-71",
    "frontend/src/components/analytics/technical/BacktestPanel.tsx:11, 67-73",
    "frontend/src/app/(dashboard)/technical-analysis/page.tsx:168-178 (only remaining effect; handler-scoped setState)"
  ]
}
```

</details>

### T-173

- **Proof:** `frontend/src/app/live-data/alerts/route.ts:100`

The item's title has two halves and both are settled — one by fix, one by a recorded deliberate decision. The hardcode and the registry bypass are fixed: alerts/route.ts:2 imports `coingeckoBase, coingeckoHeaders` from lib/api/live/coingecko, builds the URL at :100 with `${coingeckoBase()}` and sends `coingeckoHeaders()` at :103, and records utilization on both the error and success paths (:114, :189). The comment at :95-99 states what changed: "This route used to bypass both: pointing the app at a proxy or a Pro endpoint silently missed it, and it was billed against the free-tier limit even on a paid plan." That is the same path markets/route.ts uses (markets/route.ts:3-4, 37-38). The pinnedFetch half was deliberately NOT done, with reasoning recorded at lib/api/live/coingecko.ts:14-21: pinnedFetch attaches a custom dispatcher that takes the request out of Next's fetch cache, and every CoinGecko call site depends on `next: { revalidate }` to stay inside the rate limit — so routing through it would trade a terms gate on an already terms-verified host for multiplied request volume. Worth flagging: that decision lives only in a code comment; there is no entry for it in docs/decisions/ or docs/audits/rejected-proposals.md.

<details><summary>Proposed ledger text</summary>

```
In docs/audits/task-queue-2026-09-07.json, item T-173: set "status": "closed" and add:

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "SETTLED — both halves. The hardcode and registry bypass are FIXED: live-data/alerts/route.ts now resolves the endpoint and key through the shared lib/api/live/coingecko.ts helper (:2, :100, :103) and records provider utilization on both paths (:114, :189), which is the same path markets/route.ts uses (:3-4, 37-38); the comment at :95-99 records the change. The pinnedFetch half is DELIBERATELY DECLINED with reasoning at lib/api/live/coingecko.ts:14-21 — pinnedFetch's custom dispatcher removes the request from Next's fetch cache, and every CoinGecko call site depends on `next: { revalidate }` to stay inside the rate limit, so it would trade a terms gate on an already terms-verified host for multiplied request volume. Note for the owner: that decision is recorded ONLY in a code comment, not in docs/decisions/ or rejected-proposals.md, and DATA-AVAILABILITY.md:131 and :610 still assert the pre-fix state.",
  "approved_by": "<pending — owner approval of the 2026-09-21 re-verification sweep>",
  "evidence": [
    "frontend/src/app/live-data/alerts/route.ts:2, 95-105, 114, 189",
    "frontend/src/lib/api/live/coingecko.ts:14-21, 26-28, 42-47",
    "frontend/src/app/live-data/markets/route.ts:3-4, 37-38"
  ]
}

Siblings (both inside dated audit-run narratives in DATA-AVAILABILITY.md, so annotate, never edit). After line 131:

> **Correction, 2026-09-21 (code reading, not a re-measurement).** The parenthetical above
> no longer describes the route. `live-data/alerts/route.ts` resolves CoinGecko through the
> shared `lib/api/live/coingecko.ts` helper (`:2`, `:100`, `:103`) and records provider
> utilization (`:114`, `:189`), so `COINGECKO_BASE_URL` and a configured key DO apply here.
> `pinnedFetch` is still not used, deliberately — see the rationale at
> `lib/api/live/coingecko.ts:14-21`. The rate-limit reading this run made is unaffected.

And the same block after line 610.
```

</details>

### T-346

- **Proof:** `frontend/src/app/live-data/pump-report/investigate/route.ts:45`

The rename shipped in full, including the guard test the item asked for. The route declares `suspicionScore: number` (investigate/route.ts:45) and the prompt asks the model for `"suspicionScore": <0.0-10.0>` (:86); the doc comment at :34-38 records why ("Named `suspicionScore`, not `riskScore` ... a 0-10 higher-is-worse scale collided with that"). PumpReportTab.tsx reads `report.suspicionScore` at :118 and serialises it into the chat context at :471. A dedicated guard test exists at frontend/src/app/live-data/pump-report/__tests__/suspicionScore.test.ts — it asserts the prompt and interface use suspicionScore, that PumpReportTab reads it, and at :45-50 that no live `riskScore:` key or `.riskScore` read survives anywhere on the pump-report surface (comments explaining the rename are allowed). A repo grep of live-data/pump-report/ and components/pump-report/ finds `riskScore` only in those explanatory comments and test assertions. Independently corroborated by docs/audits/2026-09-08-audit.md:300.

<details><summary>Proposed ledger text</summary>

```
In docs/audits/task-queue-2026-09-07.json, item T-346: set "status": "closed" and add:

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — Phase 6 of the risk-scale spec shipped. live-data/pump-report/investigate/route.ts declares `suspicionScore: number` (:45) and prompts for it (:86), with the rationale at :34-38; components/pump-report/PumpReportTab.tsx reads report.suspicionScore (:118, :471). The 'no riskScore key' test the next_action asked for exists: live-data/pump-report/__tests__/suspicionScore.test.ts, whose :45-50 case fails on any live `riskScore:` key or `.riskScore` read across the pump-report surface. Corroborated by docs/audits/2026-09-08-audit.md:300. The item's cited source line had drifted — risk-scale-spec.md's Phase 6 table is at 500-504, not 471-476.",
  "approved_by": "<pending — owner approval of the 2026-09-21 re-verification sweep>",
  "evidence": [
    "frontend/src/app/live-data/pump-report/investigate/route.ts:34-38, 45, 86",
    "frontend/src/components/pump-report/PumpReportTab.tsx:118, 471",
    "frontend/src/app/live-data/pump-report/__tests__/suspicionScore.test.ts:19-20, 24-25, 29-30, 45-50",
    "docs/audits/2026-09-08-audit.md:300"
  ]
}

Sibling: docs/architecture/risk-scale-spec.md is the contract and still reads as though Phase 6 is pending. Its header (line 3) says "RATIFIED AND IMPLEMENTED — R2 shipped this migration (phases 1-5 ...)". Proposed dated block after the Phase 6 table (after line 504):

> **Status, 2026-09-21: Phase 6 shipped.** 6.1 and 6.2 both landed —
> `live-data/pump-report/investigate/route.ts` declares and prompts `suspicionScore`
> (`:45`, `:86`) and `PumpReportTab.tsx` reads it (`:118`, `:471`), guarded by
> `live-data/pump-report/__tests__/suspicionScore.test.ts`. 6.2's "ensure no
> RiskScoreBadge reuse" is moot: the badge was deleted under RP-6 (2026-08-29).

And a pointer on the now-stale §3.4 row at line 310, which still describes the route as emitting `riskScore`:

> (Row superseded 2026-09-21 by Phase 6 — the field is `suspicionScore`; see the Phase 6 status block.)
```

</details>

### T-103

- **Proof:** `frontend/src/components/pump-report/ScanAllPanel.tsx:40`

The decision was made and the chosen option was built — the route was wired, which was the item's own default recommendation. frontend/src/components/pump-report/ScanAllPanel.tsx POSTs to /live-data/pump-report/scan at :40 and renders a "Scan all addresses" action at :68, and the panel is mounted on the live page at frontend/src/app/(dashboard)/pump-report/page.tsx:158 (`<ScanAllPanel targets={targets} />`), fed by the same `targets` memo the deep investigation uses (:47-63). The panel's header comment at :11-21 records the ruling: "It went into the P3 review as an orphan (2026-09-08 owner decision: wire it up rather than delete it), and this panel is that wiring." The route still exists and exports ScanTarget/ScanFinding/ScanResponse (scan/route.ts:10, 16, 25) with a target cap surfaced rather than swallowed (:31-33). So the route is no longer orphaned and ScanTarget is no longer a type-only import — the two facts the item rested on.

<details><summary>Proposed ledger text</summary>

```
In docs/audits/task-queue-2026-09-07.json, item T-103: set "status": "closed" and add:

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DECIDED AND BUILT — the owner chose 'wire it', the item's own default recommendation. components/pump-report/ScanAllPanel.tsx POSTs /live-data/pump-report/scan (:40) behind a 'Scan all addresses' action (:68) and is mounted on the live page at (dashboard)/pump-report/page.tsx:158, sharing the `targets` memo with the deep investigation (:47-63). The panel comment at :11-21 records the ruling: '2026-09-08 owner decision: wire it up rather than delete it'. The route and its ScanTarget/ScanFinding/ScanResponse types remain (scan/route.ts:10, 16, 25). The 'zero page consumers' and 'type-only import' facts this item rested on are both no longer true.",
  "approved_by": "<pending — owner approval of the 2026-09-21 re-verification sweep>",
  "evidence": [
    "frontend/src/components/pump-report/ScanAllPanel.tsx:11-21, 40, 68",
    "frontend/src/app/(dashboard)/pump-report/page.tsx:8, 47-63, 155-158",
    "frontend/src/app/live-data/pump-report/scan/route.ts:10, 16, 25, 31-33"
  ]
}

Sibling: docs/assessments/P3-production-review.md:316-319 still lists `pump-report/scan` among "Orphaned routes (zero page consumers)". Findings text is annotated, never edited — proposed block after line 319:

> **Status, 2026-09-21: all four wired.** `fear-greed`, `btc-stats` and `defi-tvl` joined
> the crypto TA market-structure panel under NT11. `pump-report/scan`, which NT11
> explicitly did not cover (line 794), was wired on the 2026-09-08 owner decision as the
> "Scan all addresses" panel — `components/pump-report/ScanAllPanel.tsx:40`, mounted at
> `(dashboard)/pump-report/page.tsx:158`. No route in this list is orphaned today.
```

</details>

### T-081

- **Proof:** `.github/workflows/cd-staging.yml:87`

Option (b) of next_action landed verbatim in the current tree. `.github/workflows/cd-staging.yml:87` reads `if: ${{ vars.STAGING_DEPLOY_ENABLED == 'true' || github.event_name == 'workflow_dispatch' }}` on the `build-and-push` job, preceded by a 19-line rationale comment at :68-86 that names the ~90 failed pushes since 2026-07-18. The rest of the pipeline follows it: `deploy-staging` has `needs: build-and-push` (:201) so it skips too, `smoke-tests` needs `deploy-staging` (:323), and `notify` is guarded by `always() && needs.build-and-push.result != 'skipped'` (:380) so a skipped run posts nothing. The `push: branches: [main]` trigger is still at :4-5 — deliberately, since the gate is a job-level `if:`, not a trigger removal — and the AWS_ACCOUNT_ID preflight still fails by name on a manual dispatch, which is the documented design (:84-86). Cross-checked against two other ledgers that agree: docs/TASK-QUEUE.md:2236-2250 (dated status block, 2026-09-08) and docs/audits/production-readiness-scorecard.md:28-31, which cites the same line 87. I could not observe GitHub Actions run history (no network, no git), so 'no red X since' rests on the workflow file rather than on observed runs — but the gate itself is the deliverable the item asked for.

<details><summary>Proposed ledger text</summary>

```
"status": "closed",
"proposed_closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE — option (b) landed verbatim. .github/workflows/cd-staging.yml:87 gates build-and-push on `vars.STAGING_DEPLOY_ENABLED == 'true' || github.event_name == 'workflow_dispatch'`, with the rationale at :68-86. deploy-staging needs build-and-push (:201) so it skips with it, and notify is guarded by `needs.build-and-push.result != 'skipped'` (:380) so a skipped run reports nothing. The push:[main] trigger at :4-5 is retained on purpose — the gate is job-level — and the AWS_ACCOUNT_ID preflight still fails by name on a manual dispatch, which is the designed behaviour, not residue. AWS remains unprovisioned; the owner's provision-vs-mute choice was answered by muting.",
  "citation_note": "The item's cited source docs/TASK-QUEUE.md:2191-2198 has drifted: the quoted 'Pushing to main triggers cd-staging.yml' paragraph now sits at :2252-2255, beneath the dated status block at :2236-2250.",
  "caveat": "Verified from the workflow file only. GitHub Actions run history was not consulted in this sweep (no network, no git), so 'main is no longer red' is inferred from the gate, not observed.",
  "evidence": [
    ".github/workflows/cd-staging.yml:87",
    ".github/workflows/cd-staging.yml:380",
    "docs/TASK-QUEUE.md:2236-2250",
    "docs/audits/production-readiness-scorecard.md:28-31"
  ]
}
```

</details>

### T-304

- **Proof:** `infrastructure/terraform/eks.tf:7`

The migration is done in the tree. `infrastructure/terraform/eks.tf:7` now reads `version = "~> 20.37"` (the `~> 19.21` pin the item names is gone), `:111` sets `authentication_mode = "API"`, and `:121-138` declares an `access_entries` map whose `cicd_deploy` entry references `aws_iam_role.cicd_deploy.arn` with `kubernetes_groups = ["fn-deployers"]`. A grep for `manage_aws_auth_configmap` / `aws_auth_roles` / `aws_auth_users` in that file returns only the comment at :94 recording that v20 removed them. The rationale for choosing `API` over `API_AND_CONFIG_MAP` (an unprovisioned cluster has no ConfigMap to preserve) is documented at :91-108. The write-up next_action asked for exists — docs/CI-REMEDIATION.md:120-155, '### eks module pinned to v19 — RESOLVED', which also records that `terraform validate` was run against the real module v20.37.2 with aws 5.95 and was confirmed capable of failing, that `terraform fmt -check -recursive` is clean, and that no `plan` was run because that needs AWS credentials. Two deviations from next_action, both benign: the doc landed in CI-REMEDIATION.md rather than docs/deployment/aws-provisioning.md (which carries no mention of the migration), and `terraform plan` is genuinely not runnable while AWS is unprovisioned.

<details><summary>Proposed ledger text</summary>

```
"status": "closed",
"proposed_closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE — infrastructure/terraform/eks.tf:7 pins `~> 20.37`; :111 sets `authentication_mode = \"API\"`; :121-138 declares `access_entries` with the cicd_deploy entry bound to `aws_iam_role.cicd_deploy.arn`. The v19 `manage_aws_auth_configmap`/`aws_auth_roles`/`aws_auth_users` arguments survive only as the explanatory comment at :94. Recorded at docs/CI-REMEDIATION.md:120-155 ('eks module pinned to v19 — RESOLVED'), which also reports `terraform validate` run against the real module v20.37.2 with aws 5.95 and confirmed capable of failing, and `terraform fmt -check -recursive` clean.",
  "deviations_from_next_action": "The migration was written up in docs/CI-REMEDIATION.md, not docs/deployment/aws-provisioning.md — that runbook still has no note of it. `terraform plan` was not run and cannot be while AWS is unprovisioned (T-363).",
  "citation_note": "The item's cited source docs/CI-REMEDIATION.md:90-95 has drifted: those lines are now the '## Open — (Nothing outstanding...)' section, and the quoted ~> 19.21 sentence no longer exists in that file.",
  "evidence": [
    "infrastructure/terraform/eks.tf:7",
    "infrastructure/terraform/eks.tf:111",
    "infrastructure/terraform/eks.tf:121-138",
    "docs/CI-REMEDIATION.md:120-155"
  ]
}
```

</details>

### T-376

- **Proof:** `docs/runbooks/backup-restore.md:26-27`

Option (a) was taken. docs/runbooks/backup-restore.md:3-13 carries a dated banner ('Correction, 2026-09-08') stating the hourly pg_dump CronJob and the s3://fn-backups bucket never existed, that Aurora automated backups + PITR are the only mechanism this deployment has, and that the owner chose remove-rather-than-provision. The strategy table at :24-29 now reads '| PostgreSQL (RDS Aurora) | Automated snapshots + PITR | Daily (continuous for PITR) | rds_backup_retention_days, default 7 |' and '| PostgreSQL (self-hosted k8s) | Ad-hoc pg_dump only — **no scheduled backup exists** | On demand | Operator-managed |'. The dump procedure at :41-56 is relabelled ad-hoc, points at local disk, and :53-56 explains why there is deliberately no `aws s3 cp` step. The banner at :15-20 also resolves the two-Postgres-worlds confusion the item's refute block named. The other half of the verdict — that (b) was NOT done — also holds: a grep for `CronJob` and `pg_dump` across infrastructure/ and .github/ returns nothing, and no Terraform resource creates an fn-backups bucket, which is consistent with removing the claim rather than building the thing.

<details><summary>Proposed ledger text</summary>

```
"status": "closed",
"proposed_closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE via option (a) — remove, not provision. docs/runbooks/backup-restore.md:3-13 carries the dated 'Correction, 2026-09-08' banner recording that neither the CronJob nor s3://fn-backups ever existed and that Aurora automated backups + PITR are the only mechanism; the strategy table at :24-29 now lists the Aurora row plus a self-hosted row reading 'Ad-hoc pg_dump only — no scheduled backup exists'; :41-56 relabels the dump as ad-hoc, points it at local disk, and explains why there is deliberately no `aws s3 cp` step. The banner at :15-20 also separates the Aurora and k8s-StatefulSet paths the item's refute block flagged as mixed. Confirmed that (b) was not silently done instead: grep for CronJob/pg_dump across infrastructure/ and .github/ returns nothing and no Terraform resource creates an fn-backups bucket.",
  "citation_note": "The item's cited source lines (backup-restore.md:5-11, 22-30, 43-51) have drifted and the quoted 'PostgreSQL (manual) | pg_dump via cronjob | Hourly | 24 hours' row no longer exists; the replacement table is at :24-29.",
  "evidence": [
    "docs/runbooks/backup-restore.md:3-13",
    "docs/runbooks/backup-restore.md:24-29",
    "docs/runbooks/backup-restore.md:53-56"
  ]
}
```

</details>

### T-377

- **Proof:** `docs/runbooks/backup-restore.md:37`

The literal `fn-cluster` is gone from every runbook. A repo-wide grep for `fn-cluster` (md/tf/yml/yaml) returns only two hits, both inside dated audit records describing the fix (queue-verification-sweep-2026-09-11.md:126 and queue-closure-review-2026-09-13.md:116) — zero in the runbooks themselves. All three named files now use the Terraform-derived identifier: docs/runbooks/backup-restore.md:37 `--db-cluster-identifier fn-staging-aurora` and :80 `--source-db-cluster-identifier fn-staging-aurora`; docs/runbooks/incident-response.md:196 `describe-db-clusters --db-cluster-identifier fn-staging-aurora` and :202 `failover-db-cluster --db-cluster-identifier fn-staging-aurora`; docs/runbooks/scaling.md:104 `--db-cluster-identifier fn-staging-aurora`. That matches the source of truth the item cites, infrastructure/terraform/rds.tf:156 `cluster_identifier = "${local.name_prefix}-aurora"`. incident-response.md:185-187 goes further and documents the derivation explicitly, including that the plan was never applied, so a reader knows the identifier is a prediction rather than an observed resource.

<details><summary>Proposed ledger text</summary>

```
"status": "closed",
"proposed_closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE — a repo-wide grep for `fn-cluster` finds zero hits in any runbook (only two inside audit records that describe this very fix). All five cited call sites now carry the Terraform-derived name: backup-restore.md:37 and :80, incident-response.md:196 and :202, scaling.md:104, all `fn-staging-aurora`, matching infrastructure/terraform/rds.tf:156 `cluster_identifier = \"${local.name_prefix}-aurora\"`. incident-response.md:185-187 additionally records the derivation and warns the plan was never applied, so the identifier reads as a prediction rather than an observed resource.",
  "citation_note": "The item's cited source lines (backup-restore.md:17-19, 36-40, 55-58) have drifted — :17-19 is now a note about the two Postgres paths, and the corrected command sits at :37.",
  "evidence": [
    "infrastructure/terraform/rds.tf:156",
    "docs/runbooks/backup-restore.md:37",
    "docs/runbooks/incident-response.md:196",
    "docs/runbooks/scaling.md:104"
  ]
}
```

</details>

### T-382

- **Proof:** `README.md:160-164`

The broken instruction is gone and the gap is documented rather than papered over. README.md:156-164 now reads: `docker compose -f infrastructure/docker/docker-compose.yml up --build`, followed by 'The compose file supplies its own defaults for every variable it reads (`${VAR:-default}`), so it starts without an env file. There is deliberately no `infrastructure/docker/.env.example` — this line used to tell you to copy one that has never existed.' That claim checks out against the compose file itself: infrastructure/docker/docker-compose.yml:18-20 interpolates `${COINGECKO_API_KEY:-}`, `${DEFILLAMA_API_KEY:-}` and `${CHAINLINK_RPC_URL:-https://eth-mainnet.public.blastapi.io}` — all with defaults, so no env file is required, which resolves the refute block's worry that the missing example was a genuine gap. `ls infrastructure/docker` shows only docker-compose.yml, docker-compose.prod.yml and nginx/; the repo's only .env.example files are backend/.env.example and frontend/.env.example. README.md:81 now points at the frontend one, and docs/deployment/local-setup.md:36 copies `frontend/.env.example`, so the two documents agree.

<details><summary>Proposed ledger text</summary>

```
"status": "closed",
"proposed_closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "pending_owner_approval": true,
  "reason": "DONE — the README no longer instructs a copy of a file that never existed. README.md:160-164 states plainly that the compose file supplies its own `${VAR:-default}` values so it starts without an env file, and that there is deliberately no infrastructure/docker/.env.example. Verified against infrastructure/docker/docker-compose.yml:18-20, where COINGECKO_API_KEY, DEFILLAMA_API_KEY and CHAINLINK_RPC_URL all carry defaults — so the refute block's concern that the missing example was a real gap is answered, not ignored. `ls infrastructure/docker` = docker-compose.yml, docker-compose.prod.yml, nginx/ only; the repo's sole example files are backend/.env.example and frontend/.env.example, and README.md:81 and docs/deployment/local-setup.md:36 both point at the frontend one.",
  "citation_note": "The item's cited source README.md:91-98 has drifted — those lines are now the ANTHROPIC_API_KEY/FMP_API_KEY block; the Docker section is at :142-164.",
  "evidence": [
    "README.md:160-164",
    "infrastructure/docker/docker-compose.yml:18-20",
    "README.md:81"
  ]
}
```

</details>

### T-069

- **Proof:** `frontend/src/app/(dashboard)/compare/page.tsx:819`

The fund comparison view exists and is wired end to end. `components/markets/FundFactsSection.tsx` (208 lines, header comment at :12 cites "S6, T-069") renders a side-by-side facts table with Type, Issuer, Category, Strategy, Tracks, Expense ratio, Sales charge, fee cost in dollars, Yield (TTM) at :114, AUM at :115, Inception at :117 and Trading restriction at :122. It is mounted on /compare at compare/page.tsx:819, filtered to `resolve(s).kind === 'fund'`, beside the existing holdings-overlap section, and imported at :33. It reuses `feeImpact`/`feeCostDisplay` from lib/data/feeImpact.ts rather than recomputing, and is guarded by lib/data/__tests__/fundFacts.test.ts. The one element of the original ask that is NOT delivered — bond duration/credit tier — is deliberate and stated in the component itself (:23-30): `FundEntry` carries neither field, so the table prints `indexTracked` verbatim and says outright that no duration figure exists rather than deriving one from a fund name. docs/TASK-QUEUE.md:1989-2010 already carries a dated Status block recording this as shipped 2026-09-08; only the queue JSON still reads "open".

<details><summary>Proposed ledger text</summary>

```
"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — shipped 2026-09-08 as frontend/src/components/markets/FundFactsSection.tsx, mounted on /compare at compare/page.tsx:819 (imported :33) beside the holdings-overlap section. Rows: type, issuer, category, strategy, tracked index, expense ratio, sales charge, 20-year fee cost in dollars, yield, AUM, inception, trading restriction; fee figures reuse lib/data/feeImpact.ts so the section cannot drift from the detail-page analyzer. Bond duration/credit tier is deliberately absent and said so on the page — FundEntry carries neither field, and deriving one from indexTracked would be a fabricated number on a comparison surface (FundFactsSection.tsx:23-30). Guarded by lib/data/__tests__/fundFacts.test.ts. docs/TASK-QUEUE.md's S6 charter already carries the dated Status block; this queue entry is the last place it read open.",
  "approved_by": "PENDING — proposed by the 2026-09-21 re-verification sweep; owner approves before it is applied",
  "evidence": [
    "frontend/src/components/markets/FundFactsSection.tsx:12, 23-30, 42-124",
    "frontend/src/app/(dashboard)/compare/page.tsx:33, 815-819",
    "frontend/src/lib/data/__tests__/fundFacts.test.ts:10",
    "docs/TASK-QUEUE.md:1989-2010"
  ]
}
```

</details>

### T-118

- **Proof:** `frontend/src/lib/data/stakingProviders.ts:200-202`

Every element of the ask is in the tree. `affiliateUrl?` and `affiliateProgram?` sit beside `website?` on StakingProvider (stakingProviders.ts:189, 200, 202), with a declaration comment stating website is never overwritten and that the field must be read only through `resolveOutboundLink()`. The shared component is components/ui/SponsoredLink.tsx: :67 emits `rel={link.sponsored ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}` and :74 renders a visible **Paid link** tag from the same value that chose the URL. lib/data/affiliates.ts carries the structural guard — `RankableProvider = Omit<StakingProvider,'affiliateUrl'|'affiliateProgram'>` (:40), a defunct-provider refusal in `resolveOutboundLink` (:80-83, stronger than asked: Celsius can never be monetised), and computed coverage-bias reporting (:107-121). /staking links out only through SponsoredLink (staking/page.tsx:16-17, 180, 222). lib/data/__tests__/affiliates.test.ts:60-73 pins that `affiliateUrl` is unset for every provider, so nothing is monetised yet, exactly as the item required; :118-137 is the source-scan backstop and :138-146 forbids a bare anchor. docs/ROADMAP.md:447-479 carries the dated status block. One wrinkle, and it does not reopen the item: the next_action asked for a test proving `computeOverallRisk` cannot read the affiliate fields — D14 (2026-09-14) DELETED that function, so the surviving test pins `scoreStakingProvider(risks: RiskProfile)` instead (affiliates.test.ts:81-100, which says so in as many words). The rule was preserved through the deletion, not lost with it.

<details><summary>Proposed ledger text</summary>

```
"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — shipped 2026-09-08. StakingProvider carries affiliateUrl?/affiliateProgram? beside website? (stakingProviders.ts:189, 200-202), which is never overwritten. One shared outbound component, components/ui/SponsoredLink.tsx, emits rel='sponsored noopener noreferrer' on paid links only (:67) and a visible 'Paid link' tag rendered from the same value that decides the URL (:74); /staking links out only through it (staking/page.tsx:16-17, 180, 222). The engine-isolation rule is structural, not a promise: lib/data/affiliates.ts:40 defines RankableProvider as Omit<StakingProvider,'affiliateUrl'|'affiliateProgram'> so reading one inside a comparator is a compile error, resolveOutboundLink refuses any link for a defunct provider even with an affiliate URL set (:80-83), and lib/data/__tests__/affiliates.test.ts:118-137 source-scans the scoring/ranking paths. Every affiliateUrl ships UNSET, pinned by affiliates.test.ts:60-73, so nothing is monetised — matching the item's 'ship with every affiliateUrl unset' condition. SUPERSEDED DETAIL: the next_action asked for a test proving computeOverallRisk cannot read the affiliate fields; D14 (2026-09-14) deleted computeOverallRisk, and the guard was carried onto scoreStakingProvider(risks: RiskProfile) instead (affiliates.test.ts:81-100). The rule survived the deletion. Still open and NOT covered by this closure: the owner-copy placeholders on /how-we-make-money (T-120/T-125 territory) and desktop-app link placement.",
  "approved_by": "PENDING — proposed by the 2026-09-21 re-verification sweep; owner approves before it is applied",
  "evidence": [
    "frontend/src/lib/data/stakingProviders.ts:181-202",
    "frontend/src/components/ui/SponsoredLink.tsx:56-97",
    "frontend/src/lib/data/affiliates.ts:40, 80-121",
    "frontend/src/lib/data/__tests__/affiliates.test.ts:60-73, 81-100, 118-146",
    "docs/ROADMAP.md:447-533"
  ]
}
```

</details>

### T-126

- **Proof:** `frontend/src/app/(dashboard)/staking/page.tsx:689`

The item's own completion criterion was "carry into T-118's PR acceptance criteria … tick ROADMAP once that PR lands". T-118's PR landed 2026-09-08 and every clause landed with it. On /staking the not-advice framing is a block comment naming T-126 explicitly (page.tsx:681-688) followed by `<AffiliateDisclosure />` at :689, ABOVE `<NetworkAprReference />` (:692) and the provider grid; the disclosure text at :69-72 reads "This is information, not advice" and points at Celsius rating well on every dimension before it froze funds. Affiliate rows carry a per-link visible tag (SponsoredLink.tsx:74), and the coverage-bias paragraph (:77-93) is COMPUTED from the catalog and states that ordering is a fixed catalog order never influenced by payment. A test enforces the placement rather than leaving it to review: lib/data/__tests__/affiliates.test.ts:163-168 asserts the not-advice string is present and that `<AffiliateDisclosure />` appears before `<NetworkAprReference />`, with the comment "Above the provider grid, not below it (T-126)". The one act the item names that HAS NOT happened is the ledger tick itself — docs/ROADMAP.md:543-544 still reads `- [ ]`. That is precisely what this proposal supplies, so the item closes with the tick rather than staying open pending it.

<details><summary>Proposed ledger text</summary>

```
TWO EDITS, both proposed.

(1) docs/ROADMAP.md:543-544 — replace

- [ ] Keep the informational framing already in the risk register — a paid link next to a risk
      score edges closer to "recommendation"; disclaimers must stay prominent.

with

- [x] **Keep the informational framing already in the risk register.** ✅ Shipped 2026-09-08 with the
      affiliate plumbing. `AffiliateDisclosure` renders the not-advice paragraph ABOVE the provider grid
      (`app/(dashboard)/staking/page.tsx:689`, before `<NetworkAprReference />` at :692), every paid link
      carries its own visible **Paid link** tag, and the coverage-bias line is computed from the catalog
      rather than written in prose. Placement is pinned by a test, not by review:
      `lib/data/__tests__/affiliates.test.ts:163-168` fails if the disclosure moves below the grid.
      Still open under this heading: the FTC/FCA disclosure prose (owner copy) and the per-program terms
      review, both listed separately above.

(2) task-queue-2026-09-07.json, item T-126 —

"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — the item's own criterion was 'carry into T-118's PR acceptance criteria … tick ROADMAP once that PR lands'. It landed 2026-09-08 and all three clauses hold in the tree: the not-advice disclaimer sits above the provider grid (staking/page.tsx:681-689, with a comment naming T-126 and the FTC 'clear and conspicuous' reasoning), affiliate rows carry a per-link visible tag (SponsoredLink.tsx:74), and placement is enforced by affiliates.test.ts:163-168 rather than by review. The code-auditor invariants the next_action pointed at have moved from :109-120 to .claude/agents/code-auditor.md:154-165 but are unchanged in substance. The ROADMAP tick, the last outstanding act, is proposed with this closure.",
  "approved_by": "PENDING — proposed by the 2026-09-21 re-verification sweep; owner approves before it is applied",
  "evidence": [
    "frontend/src/app/(dashboard)/staking/page.tsx:61-93, 681-692",
    "frontend/src/components/ui/SponsoredLink.tsx:74, 82-97",
    "frontend/src/lib/data/__tests__/affiliates.test.ts:163-168",
    "docs/ROADMAP.md:543-544"
  ]
}
```

</details>

### T-308

- **Proof:** `frontend/src/app/(dashboard)/equities/EquitiesClient.tsx:227-228`

The half the item calls actionable is built, exactly as the next_action specified. EquitiesClient.tsx imports `SecurityReturnsResponse` (:18), declares `ytdPct`/1Y on its row type (:55-56), queries `/live-data/security-returns?symbols=` for the visible page only (:218-233 — with a comment explaining that `?universe=` is refused rather than truncated), maps results onto rows (:237-245), renders YTD and 1Y headers at :391-395 and cells at :438, and prints a footer at :479-483 saying returns cover the visible page only and are not sortable or screenable, plus an amber note when no Tiingo/FMP key is configured. Sorting and screening are deliberately off — the same reason fund return screening is off. The universe-wide half remains refused by the route itself (security-returns/route.ts:99-110 returns an explicit reason; MAX_SYMBOLS=60 at :39) and is now parked under D21 (docs/decisions/2026-09-18-owner-decisions.md:7-25), which names `security-returns` as the single-sourced surface with no fallback and explicitly defers the paid remedy. The next_action's own instruction for that half was "leave parked", so nothing actionable remains under this item. docs/FEATURE-ADDITIONS.md already carries a dated 2026-09-08 update saying the possible half is built; the queue JSON is the only ledger still reading open.

<details><summary>Proposed ledger text</summary>

```
"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE for the half the item called actionable, and the other half was never this item's work. The Stock Registry carries per-page YTD and 1Y columns: EquitiesClient.tsx:218-233 queries /live-data/security-returns?symbols= for the visible page, :237-245 maps them onto rows, :391-395 renders the headers with tooltips stating they are not sortable or screenable, :438 renders the cells, and :479-483 discloses the page-scope and the missing-key state. Deliberately not sortable or screenable — a sort over fifty of several thousand rows would order as though it had seen every one, the same reason fund return screening is off. UNIVERSE-WIDE SCREENING STAYS PARKED, by the item's own next_action and now by D21 (2026-09-18): /live-data/security-returns/route.ts:99-110 still refuses ?universe= with a stated reason and caps ?symbols= at 60 (:39), and D21 names security-returns as the one surface with no fallback at all while deferring every paid remedy until late production. docs/FEATURE-ADDITIONS.md carries the matching dated 2026-09-08 annotation.",
  "approved_by": "PENDING — proposed by the 2026-09-21 re-verification sweep; owner approves before it is applied",
  "evidence": [
    "frontend/src/app/(dashboard)/equities/EquitiesClient.tsx:18, 55-56, 218-245, 391-395, 438, 479-483",
    "frontend/src/app/live-data/security-returns/route.ts:39, 99-110",
    "docs/decisions/2026-09-18-owner-decisions.md:7-38",
    "docs/FEATURE-ADDITIONS.md:242-250"
  ]
}
```

</details>

### T-391

- **Proof:** `frontend/src/lib/data/coinFilters.ts:109-112`

Built exactly as the next_action prescribed, including the honest-shrink step. `realisedVol30dPct: number | null` is on TechnicalRow (sweep.ts:42-50), computed by `realisedVolatilityPct()` (sweep.ts:78) as the annualised stdev of daily log returns and populated in `computeTechnicals` (sweep.ts:135); a 30-close minimum returns null rather than a fabricated 0. The FILTER_FIELD exists in the `technical` group at coinFilters.ts:109-112 with a hint that names the 365-day annualisation and states plainly that it is "a description of how much the price HAS moved, not a forecast and not a risk score" — which keeps it clear of RP-6/D14. The Volatility line is GONE from UNAVAILABLE_FACTORS, which now holds only 'On-chain metrics' (coinFilters.ts:138-144), with a comment recording that realised volatility moved out on 2026-09-08. The path is connected, not just declared: AssetRegistryClient.tsx:21,325 renders `FILTER_FIELDS`; useAssets.ts:112 runs `useTechnicalSweep` over the whole tracked universe only when a technical rule is active and threads `sweep.data` into the query params. Tests exist at lib/technicals/__tests__/sweep.test.ts:105-112 and lib/data/__tests__/coinFilters.test.ts:230,237 (the latter pins the exact set of technical field keys).

<details><summary>Proposed ledger text</summary>

```
"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here",
  "verdict": "close",
  "reason": "DONE — shipped 2026-09-08, and done in the order the item asked for. realisedVol30dPct is a field on TechnicalRow (lib/technicals/sweep.ts:42-50), computed by realisedVolatilityPct() (:78) as the annualised standard deviation of daily log returns over the last 30 candles and returned null below 30 closes rather than reported as 0. It is a 'technical' group FILTER_FIELD at lib/data/coinFilters.ts:109-112, whose hint states it is a description of past movement, not a forecast and not a risk score — which is what keeps it on the right side of RP-6/D14. The Volatility entry was REMOVED from UNAVAILABLE_FACTORS, which now lists only 'On-chain metrics' (:138-144), with a comment recording the removal — the 'list must shrink honestly' rule was followed. Reachable end to end: AssetRegistryClient.tsx:21,325 renders FILTER_FIELDS, and useAssets.ts:112 runs the sweep over the whole tracked universe when a technical rule is active. Tests: sweep.test.ts:105-112 and coinFilters.test.ts:230,237.",
  "approved_by": "PENDING — proposed by the 2026-09-21 re-verification sweep; owner approves before it is applied",
  "evidence": [
    "frontend/src/lib/technicals/sweep.ts:42-50, 78, 135",
    "frontend/src/lib/data/coinFilters.ts:109-112, 138-144",
    "frontend/src/hooks/useAssets.ts:106-131",
    "frontend/src/lib/technicals/__tests__/sweep.test.ts:105-112",
    "frontend/src/lib/data/__tests__/coinFilters.test.ts:230, 237"
  ]
}
```

</details>

### T-074

- **Proof:** `frontend/src/lib/data/feeImpact.ts:94-96`

This is the least certain of my five closes, and I want the annotation to say so rather than hide it. The blocker is cleared — #147 merged 2026-09-08 (docs/TASK-QUEUE.md:1991-1994; docs/decisions/2026-09-14-owner-decisions.md:51) and lib/data/feeImpact.ts is now on main with the 'fees' ColumnTab live in FundsClient.tsx:28, 666, 682, 844-870. The visual pass itself is recorded FIRST-HAND in the tree, and it is not merely a claim: feeImpact.ts:89-101 describes a defect that only a rendered page could surface — VOO and IVV charge exactly the 0.03% benchmark, so the naive sign rule printed "−$0" in warning amber on the two cheapest funds in the catalog — and states "Found by looking at the rendered page (T-074); no unit test on the arithmetic could have caught it, because the arithmetic was right." The artifact of that pass is `feeCostDisplay()` (:105-111), consumed by the registry at FundsClient.tsx:849 and 856-860. That covers the VOO spot-check the next_action names. The AGTHX spot-check has no first-hand record, AND its expected appearance has since changed: T-073 verified AGTHX's 5.75% front load on 2026-09-10 (fundCatalog.ts:547, with SEC source and verifiedAt), so the row now renders 'incl. load' with the load priced into the figure (FundsClient.tsx:866-869; feeImpact.test.ts:36-46, 56-73) — not the '+load — true cost is higher than shown' flag the next_action predicted. I close on the item's purpose being met and a real defect fixed, and I name the unrecorded half in the annotation so nobody reads this as a full two-row sign-off.

<details><summary>Proposed ledger text</summary>

```
"closure": {
  "status_was": "open",
  "closed_on": "2026-09-21",
  "basis": "verified-here (partial — see the AGTHX note)",
  "verdict": "close",
  "reason": "DONE, with one half of the spot-check unrecorded and named here rather than glossed. The blocker cleared: #147 merged 2026-09-08, lib/data/feeImpact.ts is on main, and the 'Fee impact' ColumnTab is live in FundsClient.tsx:28, 666, 682, 844-870. The visual pass happened and left an artifact, not just a claim — feeImpact.ts:89-101 records, first-hand, that the rendered registry printed '−$0' in warning amber for VOO and IVV (both exactly at the 0.03% benchmark), says 'Found by looking at the rendered page (T-074); no unit test on the arithmetic could have caught it, because the arithmetic was right', and feeCostDisplay() (:105-111) is the fix, consumed at FundsClient.tsx:849. That is the VOO row of the two the next_action named. NOT RECORDED: the AGTHX row. Its expected appearance has also changed — T-073 verified the 5.75% front load on 2026-09-10 (fundCatalog.ts:547), so AGTHX now renders 'incl. load' with the charge priced INTO the figure (FundsClient.tsx:866-869; feeImpact.test.ts:36-46, 56-73), not the '+load — true cost is higher than shown' flag this item predicted. The '+load' flag still exists and still fires for funds whose load exists but is unverified; it simply no longer describes AGTHX. If the owner wants a clean two-row sign-off, re-open as a fresh one-line check against the CURRENT expected rendering, not against this item's stale prediction.",
  "approved_by": "PENDING — proposed by the 2026-09-21 re-verification sweep; owner approves before it is applied",
  "evidence": [
    "frontend/src/lib/data/feeImpact.ts:89-111",
    "frontend/src/app/(dashboard)/funds/FundsClient.tsx:28, 666, 682, 844-870",
    "frontend/src/lib/data/fundCatalog.ts:547",
    "frontend/src/lib/data/__tests__/feeImpact.test.ts:36-46, 56-73",
    "docs/TASK-QUEUE.md:1991-1994",
    "docs/decisions/2026-09-14-owner-decisions.md:51"
  ]
}
```

</details>

---

## 4. Contradictions

**C1.** T-302 is 'status: open' in the ledger while docs/CI-REMEDIATION.md:100-117 has carried a 'Closed 2026-09-08 — Coverage floor … RESOLVED' section since 2026-09-08, and backend/pyproject.toml:87 has carried the raised floor since the same date. The ledger and the remediation doc have disagreed for thirteen days.

**C2.** T-327 is 'status: open' while the very document it tracks (docs/agents/checklist-steward.md:140) has carried the refreshed 2026-09-08 block since 2026-09-08. The charter that instructs the steward to keep ledgers true is itself the evidence that this ledger row is false.

**C3.** T-361's next_action instructs an edit to CLAUDE.md that would contradict CLAUDE.md:520 and stakingProviders.ts:207-225 and would be rejected by lib/risk/__tests__/riskScoringRemoved.test.ts:161-162. A queue item whose stated action fails the repo's own guard test is a contradiction between the ledger and the tree, not merely a stale row.

**C4.** T-172's title ('~18–22 s') contradicts DATA-AVAILABILITY.md:843 (~2.2 s, re-measured 2026-09-19) and its own progress block. The item is still correctly open, but on different grounds than its title states — anyone reading the title alone would chase a latency figure the route no longer exhibits.

**C5.** backend/FROZEN.md states no CI job builds or tests the backend (confirmed: .github/workflows/ci.yml has only frontend-check, docker-build, security-scan, terraform-validate, ci-success), while backend/pyproject.toml:87 still enforces `--cov-fail-under=55` on a suite nothing in CI runs. Not a defect — the file was deliberately frozen as-is — but the 'floor lives HERE and nowhere else' comment at :70-75 now describes a gate with no CI counterpart, and a reader of T-302's next_action would not learn that from either file alone.

**C6.** Cross-sweep, for the owner's attention rather than a per-item verdict: docs/audits/queue-closure-review-2026-09-13.md recorded 'T-361: evidence intact' against main@55a4b52 on 2026-09-13; D14 landed the day after and deleted the very helpers T-361 is about. That is the mechanism the warning in docs/audits/steward-sweep-2026-09-21.md:50 describes — a verdict measured against a commit that then moved. It is one more reason not to promote any of the 2026-09-13 review's 43 unapplied recommendations without re-verification.

**C7.** docs/audits/queue-closure-review-2026-09-13.md vs docs/audits/task-queue-2026-09-07.json — all six of my items still read "status": "open" in the live ledger despite that review's "62 of 62 evidence intact … Approve all 62". I did not use that review as evidence for anything; I re-derived every verdict from the current tree. The drift itself is already named at docs/audits/steward-sweep-2026-09-21.md:50, which lists T-100, T-103, T-173, T-270, T-346 and T-388 among the 43 never written back.

**C8.** DATA-AVAILABILITY.md:131 and :610 vs frontend/src/app/live-data/alerts/route.ts:2, 100-103 — the file twice asserts the alerts route "hardcodes its CoinGecko URL, with no provider registry and no `pinnedFetch` involvement." Half of that is now false: the route resolves base URL and key through lib/api/live/coingecko.ts and records provider utilization at :114 and :189. Both occurrences sit inside dated audit-run narratives, so the fix is a dated annotation, not an edit. This matters beyond wording — it is the live file a reader consults to decide whether COINGECKO_API_KEY applies to alerts, and today it does.

**C9.** docs/architecture/risk-scale-spec.md:310 vs frontend/src/app/live-data/pump-report/investigate/route.ts:45, 86 — the spec's §3.4 table still describes that route as emitting "LLM-emitted `riskScore` 0.0–10.0". The field has been `suspicionScore` since Phase 6 shipped. The spec is the contract and wins over risk-framework.md where they disagree, so a stale row here is load-bearing.

**C10.** docs/architecture/risk-scale-spec.md:3 vs :499-504 — the header says "RATIFIED AND IMPLEMENTED — R2 shipped this migration (phases 1–5 …)", and the Phase 6 table carries no status marker, so the document reads as "Phase 6 outstanding" while the code and its guard test say otherwise (investigate/route.ts:45, 86; __tests__/suspicionScore.test.ts).

**C11.** docs/assessments/P3-production-review.md:1111-1116 vs frontend/src/lib/utils/indicators.ts:1140, 1705 and scanSetups.ts:82 — pinned #4 still states that `fibRetracement([])` returns non-finite values, `buildTechnicalRead([])` throws, and a flat series triggers volatility compression. All three now guard, under an owner approval the code comments date to 2026-09-08. Items 1-3 of that same list were NOT touched by that pass and remain accurate, so the annotation must scope itself to #4.

**C12.** docs/assessments/P3-production-review.md:316-319 vs frontend/src/components/pump-report/ScanAllPanel.tsx:40 and (dashboard)/pump-report/page.tsx:158 — the review lists `pump-report/scan` among "Orphaned routes (zero page consumers)" alongside three routes NT11 has since wired. None of the four is orphaned today.

**C13.** Decision-record gap rather than a document conflict, but it is the same failure shape: three of these six closures rest on owner decisions dated 2026-09-08 that exist ONLY as code comments — "D-24 #4, owner-approved 2026-09-08" (indicators.ts:1704, scanSetups.ts:81) and "2026-09-08 owner decision: wire it up rather than delete it" (ScanAllPanel.tsx:16). There is no 2026-09-08 file in docs/decisions/ (only 2026-09-14 and 2026-09-18), and docs/audits/2026-09-08-audit.md records the suspicionScore rename as observed fact without citing a ruling. The pinnedFetch declination for CoinGecko (coingecko.ts:14-21) is in the same position. The decisions are real and the code proves the outcome, but a future sweep looking for the ruling will not find it where the charter says rulings live.

**C14.** The JSON ledger disagrees with four other ledgers, and the JSON is the lagging one — the C8 pattern, on five more items. docs/audits/task-queue-2026-09-07.json still carries T-081, T-304, T-376, T-377 and T-382 as `"status": "open"` with no closure or progress block, while the tree and the prose ledgers record each as finished: docs/TASK-QUEUE.md:2236-2250 ('Status: ✅ fixed 2026-09-08') for T-081's subject, docs/CI-REMEDIATION.md:120-155 ('eks module pinned to v19 — RESOLVED') for T-304, docs/runbooks/backup-restore.md:3-13 ('Correction, 2026-09-08 … Owner decision, 2026-09-08: remove rather than provision') for T-376, and README.md:160-164 for T-382. This is a missed write, not a factual dispute.

**C15.** Direct contradiction between the queue item and its own cited source, resolved in the source's favour. T-304 quotes docs/CI-REMEDIATION.md as saying the v20 migration 'remains a separate, deliberate follow-up — unchanged since PR #22'. That file today says at :93-96 '## Open — *(Nothing outstanding. The two items that stood here were closed on 2026-09-08 — see below.)*' and then documents the completed migration at :120-155. The tree agrees with the document, not the queue (eks.tf:7 = `~> 20.37`).

**C16.** docs/deployment/aws-provisioning.md has drifted against the tree and against its own sibling runbooks. Its 'Read this first' section at :12-17 still asserts, with no dated banner, that 'CD — Deploy to Staging has run on every push to `main` since 2026-07-18 and failed every single time' and that 'the failure was invisible because nobody checks post-merge push runs' — which reads as the current state while .github/workflows/cd-staging.yml:87 has gated the job off. Two sibling runbooks already carry the correcting banner (docs/runbooks/incident-response.md:15 and docs/runbooks/scaling.md:14, both 'gated off behind STAGING_DEPLOY_ENABLED, which has never been set'); aws-provisioning.md does not. It is the source document for both T-081 and T-369, so the omission is load-bearing. A dated banner is the fix — the 90-run count and the lesson at :196-197 are a record and should stay verbatim.

**C17.** T-304's next_action asked for the migration to be recorded in docs/deployment/aws-provisioning.md; it was recorded in docs/CI-REMEDIATION.md:120-155 instead, and aws-provisioning.md still contains no mention of the v20 module, `authentication_mode` or `access_entries`. Its Step 4/Step 5 sections read as though the v19 arrangement is current. Not a blocker for closing T-304, but it means a provisioner following that runbook will not learn the access model changed.

**C18.** Carried forward from the 2026-09-21 sweep's C6 and confirmed here: `.claude/worktrees/agent-a76f6d909b69cc2de/` holds a pre-fix duplicate of the tree (a `find` for .env.example returns `.claude/worktrees/agent-a76f6d909b69cc2de/backend/.env.example` alongside the real ones). Every verdict above was taken against the repo root only. Any future grep-based pass that does not exclude that directory risks reopening these items on evidence from a tree that is not of record.

**C19.** THE QUEUE JSON DISAGREES WITH EVERY OTHER LEDGER ON FOUR OF THESE SIX. task-queue-2026-09-07.json reads "status": "open" for T-069, T-118, T-308 and T-391, while the ledgers that own those surfaces already carry dated annotations saying they shipped: docs/TASK-QUEUE.md:1989-2010 ('items (1) and (3) done. 2026-09-08 / 2026-09-05'), docs/ROADMAP.md:447-479 ('✅ plumbing + disclosure shipped 2026-09-08'), docs/FEATURE-ADDITIONS.md:242-250 ('Update (2026-09-08): the half that is possible is built'), and the in-code note at coinFilters.ts:139-142. The queue JSON is the outlier, not the tree.

**C20.** docs/ROADMAP.md:543-544 still reads `- [ ] Keep the informational framing already in the risk register …` while the thing it describes shipped on 2026-09-08 and is enforced by a test that names T-126 (affiliates.test.ts:163-168). An unticked box next to a test-enforced guarantee, in the same file whose section header two hundred lines earlier says the work is done.

**C21.** frontend/src/lib/data/affiliates.ts:9-11 states, in the module docblock that explains WHY the file exists, that "`computeOverallRisk()` rates 55 staking providers across six risk dimensions". That function was deleted by owner decision D14 on 2026-09-14 — stakingProviders.ts:206-214 is its tombstone, and CLAUDE.md says no composite staking score exists anywhere. The file's own test (affiliates.test.ts:81-93) already records the correction; the docblock above it does not. The reasoning still holds on the six published dimensions, so this is a wrong name in a live rationale, not a wrong rule.

**C22.** T-074's next_action predicts AGTHX will carry the '+load — true cost is higher than shown' flag. Since T-073 verified the 5.75% front load on 2026-09-10 (fundCatalog.ts:547), AGTHX takes the opposite branch: `includesLoad` is true, the charge is priced into the dollar figure, and the row renders 'incl. load' (FundsClient.tsx:866-869; feeImpact.test.ts:56-73). A verifier following that instruction literally would report a regression that is actually the fix landing.

**C23.** docs/decisions/2026-09-18-owner-decisions.md:71-77 records as explicitly NOT decided whether trailing returns may be served on unadjusted closes — while frontend/src/app/live-data/security-returns/route.ts:89 already reads `row.adjClose ?? row.close`, i.e. it silently falls back to unadjusted when the provider carries no adjusted series. That is the open question being answered by default in code, which is the exact thing D21's closing paragraph says it recorded to prevent. It does not change any verdict above (T-308's columns render whatever the route returns), but it belongs in the next batch.

**C24.** .claude/agents/code-auditor.md:154-164 frames the affiliate rule as 'a commission-bearing URL is a defect **while the integrity rules in the ROADMAP are unimplemented**'. All five of those rules are now ticked and test-enforced (ROADMAP.md:509-527). The sentence is conditional so it is not false, but an auditor reading it today is told to treat the finished state as the unfinished one; it reads as current when it is describing a period that ended 2026-09-08.

---

## 5. Stale citations

Items whose own cited `file:line` no longer points at what they claim. None of these is a
defect in the code — they are the queue snapshot ageing. Listed so a reader following a
citation is not misled.

1. T-257 → docs/audits/2026-07-30-audit.md 'lines 5-9': the quoted 'Untouched: the ~15 unverified leads…' sentence is now at line 156. (The item's second source, .claude/agents/code-auditor.md:3, still holds — the fortnightly sentence is on line 3.)

2. T-327 → docs/agents/checklist-steward.md 'lines 112-121': those lines are now verification rules 6-7. The 'Known open items' heading is at :140 and reads 'state as of 2026-09-08', not the 2026-07-30 the citation quotes.

3. T-361 → docs/architecture/risk-scale-spec.md ':770': the quoted line ('`CLAUDE.md` — `stakingProviders.ts` section, once `computeOverallRisk` is internal-only.') is now at :864, and its stated precondition never happened — D14 deleted the helpers instead of making them internal-only, so the cited follow-up is unreachable by design.

4. T-302 → docs/CI-REMEDIATION.md 'lines 77-82': the quoted text ('`--cov-fail-under=45` against a measured ~51% … That work is still outstanding') no longer appears anywhere in that file. Lines 77-82 are now the F-B Terraform section, and :111 states the floor is 55.

5. T-172 → DATA-AVAILABILITY.md 'lines 234-239, 273, 391': the quoted 'staking-discovery 21.8s · fund-universe 12.4s…' block is now at :647-650, inside a dated historical run record; lines 234-239 are the Reddit robots-gating paragraph. The living figure is the Performance-outliers row at :843 (~2.2 s, re-measured 2026-09-19).

6. T-172 progress block → cited evidence 'docs/audits/data-availability-steward-proposal-2026-09-19.md' does not contain the claims attributed to it. That file mentions staking-discovery once (:91, the ~18 s → ~2.2 s summary) and contains no mention of Yearn, Pendle or Beefy and no 7.6/7.7/9.6 s re-probe figures. Only the 2,238 ms / 94 pools half is supported, and that is in the OTHER cited file, docs/audits/live-data-audit-2026-09-19.json. The zero-pool finding currently exists nowhere in docs/ except the ledger note itself — it needs a dated record before anyone can act on it.

7. T-100 — cites docs/assessments/P3-production-review.md "1071-1072, 1084-1087" for the quote "Minor, pinned or noted: `fibRetracement([])` returns non-finite values…". That text now begins at line 1111 and runs to 1116; lines 1071-1087 are the D-24 status block and the D-9…D-23 claim table. The item's own `detail` evidence is stale twice over as well: priceTargets.test.ts:70-78 no longer contains "Pinned behavior, not an endorsement" (:77 now asserts `fibRetracement([])` is null), and indicators.degenerate.test.ts:47-54 no longer covers the flat-series volatility-compression case at all — that assertion moved to priceTargets.test.ts:376.

8. T-173 — cites DATA-AVAILABILITY.md "90-91, 204-206" for "the route hardcodes its CoinGecko URL, with no provider registry and no `pinnedFetch` involvement." That sentence is now at line 610, with a near-duplicate at line 131; lines 90-91 are the Treasury/FX rows of a reachability table and 204-206 are the Binance geo-block rows.

9. T-173 — the cited claim itself is now false of the tree, not merely re-numbered: alerts/route.ts:2 and :100-103 resolve CoinGecko through lib/api/live/coingecko.ts, so "no provider registry" no longer holds. Only the pinnedFetch half survives, and it survives as a recorded decision (lib/api/live/coingecko.ts:14-21) rather than an oversight.

10. T-346 — cites docs/architecture/risk-scale-spec.md "471-476" for the Phase 6 table row "| 6.1 | …pump-report/investigate/route.ts | `riskScore` → `suspicionScore` …". The Phase 6 heading is now at line 499 and row 6.1 at line 503; lines 465-485 are Phase 3 (staking onto the canonical scale).

11. T-103 — cites docs/assessments/P3-production-review.md "316-319, 767". The orphaned-routes paragraph is still at 316-319 (accurate), but the NT11 quote "`pump-report/scan` is an agent path and is not covered by this decision" is now at line 794, not 767; line 767 is Portfolio Builder drift-pricing prose.

12. T-388 — not re-anchorable rather than stale: its only source is a commit message (git:15646b4 / #129, "The one ESLint warning … is pre-existing and unrelated"), which was already wrong when written (there were two) and describes a state that no longer exists (zero). Nothing in the tree to re-point it at; the warning sites it named, page.tsx:361 and :770-773, were moved out of that file entirely by the T-270 extraction.

13. T-270 — checked and NOT stale: docs/assessments/T10-crypto-ta-audit.md:75-80 still carries the quoted "Extraction opportunities" text. Its content is now historical (the page is 437 lines, not 1,791), which is an annotation case, not a citation drift.

14. T-081 → docs/TASK-QUEUE.md:2191-2198. The quoted text ('Pushing to `main` triggers `cd-staging.yml`, which fails its preflight with `Missing repository secret(s): AWS_ACCOUNT_ID`…') now sits at :2252-2255, beneath the dated status block at :2236-2250 that closes it. Lines 2191-2198 are now Dependabot CI notes about PRs #54/#47/#59. The item's second source, docs/deployment/aws-provisioning.md:155-168, is still exact (the AWS_ACCOUNT_ID table row is at :162, 'Only AWS_ACCOUNT_ID blocks a deploy' at :167).

15. T-304 → docs/CI-REMEDIATION.md:90-95. The quoted sentence about eks.tf pinning `~> 19.21` no longer exists anywhere in that file. Lines 90-96 are now the '## Open' heading followed by '*(Nothing outstanding. The two items that stood here were closed on 2026-09-08 — see below.)*'. The replacement content is '### eks module pinned to v19 — RESOLVED' at :120-155.

16. T-376 → docs/runbooks/backup-restore.md:5-11, 22-30, 43-51. The quoted row '| PostgreSQL (manual) | `pg_dump` via cronjob | Hourly | 24 hours |' is gone from the file. Lines 5-11 are now part of the 2026-09-08 correction banner; the current strategy table is at :24-29 and says the opposite ('no scheduled backup exists').

17. T-377 → docs/runbooks/backup-restore.md:17-19, 36-40, 55-58. The quoted `--db-cluster-identifier fn-cluster` no longer appears in any runbook. Lines 17-19 are now a note about the two Postgres paths; the corrected command is at :37. Same drift in the item's detail evidence for incident-response.md:85,91 (now :196,202) and scaling.md:34 (now :104).

18. T-382 → README.md:91-98. The quoted `cp infrastructure/docker/.env.example infrastructure/docker/.env   # fill in secrets` is gone. Lines 91-98 are now the FMP_API_KEY block; the Docker section is at :142-164 and explicitly states the example file was never real.

19. T-081 and T-369 detail blocks → .github/workflows/cd-staging.yml:3-5, annotated 'Still `on: push: branches: [main]` → red X on every merge until provisioned'. The lines still read `push: branches: [main]`, but the claim attached to them is now false: the job-level gate at :87 means the push no longer produces a failing run. A verifier who checks only the trigger lines will wrongly confirm the item as open.

20. docs/audits/queue-verification-sweep-2026-09-11.md:87 and :123 (repeated into queue-closure-review-2026-09-13.md) cite the STAGING_DEPLOY_ENABLED gate at .github/workflows/cd-staging.yml:68 and its comment at :65. In the current tree the `if:` is at :87 and the comment block runs :68-86 — the file has grown by ~19 lines since. The claim is right, the line number is not.

21. T-391 — `frontend/src/lib/data/coinFilters.ts:129-141`, quoted as "{ label: 'Volatility', needs: 'a realised-volatility calculation over the candle sweep — not yet built' },". That line NO LONGER EXISTS. Lines 129-141 are now the ProviderGroup labels and the UNAVAILABLE_FACTORS docblock; the list itself (138-144) contains only 'On-chain metrics', with a comment at :139-142 recording that realised volatility moved out on 2026-09-08. The item's sole source is evidence that it is done, read at today's line numbers.

22. T-118 — `docs/ROADMAP.md:379-381, 385-387, 391`, quoted as the affiliate implementation notes. Those lines are now inside the Macro TA correction block ('The Scanner is no longer a tab', '/macro/scanner'). The affiliate section has moved to ROADMAP.md:440-533, where the quoted 'Hook: StakingProvider.website? already exists …' text now sits around :514-527 and is ticked `- [x]`.

23. T-118 — `frontend/src/lib/data/stakingProviders.ts:157`, cited as `website?: string` with no affiliate fields. Line 157 is now `lockupDays: number`. `website?` is at :189 and the affiliate fields it said were absent are at :200 and :202.

24. T-118 — the next_action requires "a test proving computeOverallRisk and sort/filter paths cannot read the affiliate fields". `computeOverallRisk()` was DELETED by D14 on 2026-09-14 (tombstone at stakingProviders.ts:206-214). The rule was carried onto `scoreStakingProvider()` instead — affiliates.test.ts:81-100 says so explicitly. The instruction is stale; the guarantee is not.

25. T-126 — `docs/ROADMAP.md:408-409`, quoted as 'Keep the informational framing already in the risk register…'. Lines 408-409 are now the macro-agent toolset bullet. The quoted checkbox is at ROADMAP.md:543-544 and still reads `- [ ]`.

26. T-126 — `.claude/agents/code-auditor.md:109-120`, cited for 'no paid placement in ranked or scored output' and the affiliate invariants. Lines 109-120 now hold the RP-6 / ranking-vs-explanation / D14 block. The affiliate invariants are at code-auditor.md:154-164 and the paid-placement line at :165; the text is unchanged in substance, only relocated.

27. T-074 — its ONLY source is `/tmp/claude-0/-home-user-Finance-Now/2bbbd67e-…/scratchpad/tasksweep/open-prs.json:10`, a cloud-session scratchpad path that does not exist on this machine and cannot be re-read. The claim it carried (PR #147 open, fee columns verified only by unit tests) has since been overtaken: #147 merged 2026-09-08. Same class of unverifiable source in T-069's second entry (`…/scratchpad/tasksweep/session-context.md:18`).

28. T-308 — `docs/FEATURE-ADDITIONS.md:237-241` still resolves to the quoted text, but reading only those lines is now misleading: the very next paragraph (:242-250) is a dated 2026-09-08 update stating the per-page half was built. A verifier stopping at the cited range would conclude the item is open.

29. T-069 — `docs/TASK-QUEUE.md:1980-1981` still resolves verbatim to the quoted build-out line, but the S6 charter now carries a dated Status block at :1989-2010 saying items (1) and (3) are done. Same trap as T-308: the citation is accurate and the conclusion drawn from it is not.

---

**Totals:** 23 verdicts (20 close, 1 supersede, 2 still open), 24 contradictions, 29 stale citations.
