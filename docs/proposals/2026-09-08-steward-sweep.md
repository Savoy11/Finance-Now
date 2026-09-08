# Checklist-steward sweep — 2026-09-08

**Commit:** `be27b38` (branch `claude/outstanding-tasks-l86xjw`, PR #153)
**Task:** T-328 · **Previous snapshot:** 2026-07-30 (`docs/agents/checklist-steward.md`)

**Everything below awaits your ruling except A1, which is marked ✅ APPLIED.** This is
one batched proposal, per the steward charter's approval protocol: tick or strike each
item and I will apply exactly what is approved.

The single exception was applied later the same day, alongside two matching count
contradictions the code-auditor found independently — see A1 for why a count with
exactly one right answer sits on the apply side of the owner's 2026-09-08 rule.

Swept against the branch head rather than `origin/main`, because PR #153 is about to
merge and a sweep of the pre-merge state would go stale the moment it did.

**Every entry was verified in source.** No item here rests on a commit message, a
summary, or another document. Nothing measurement-derived is proposed — no coverage
ratio, latency or REAL/FALLBACK verdict is touched, since those change only from an
owner-machine `npm run audit`.

---

## A. Verified — counts and paths that no longer match the tree

### A1. `CLAUDE.md:92` — live-data route count · ✅ APPLIED 2026-09-08

| | |
|---|---|
| **Current** | `└── live-data/  # Server-side API proxy routes (no API keys exposed) — 58 routes` |
| **Proposed** | `— 59 routes` |
| **Proof** | `find frontend/src/app/live-data -name route.ts \| wc -l` → **59**. The 59th is `live-data/ipo-calendar/route.ts`, added by `ad026c2` (#145). |

Not this PR's drift — the count went stale when #145 merged to `main`.

**Applied rather than left for a ruling**, together with two more pure count contradictions the code-auditor found the same day (`README.md` asserting both 108 and 110 crypto assets; `DATA-AVAILABILITY.md` saying 17 `staking-rates` upstreams against 18 in the `allSettled` array). A count with exactly one right answer carries no judgement, so it falls on the apply side of the owner's 2026-09-08 rule. Nothing else in this document has been applied.

### A2. `CLAUDE.md:154` — the components tree omits the new panel directory

| | |
|---|---|
| **Current** | `│   ├── analytics/` (bare, no note) |
| **Proposed** | `│   ├── analytics/                  # Reserve UI + technical/ — the 9 crypto TA panels` <br> `│   │   └── technical/              # Extracted from technical-analysis/page.tsx (T-270, 2026-09-08)` |
| **Proof** | `frontend/src/components/analytics/technical/` now holds nine files: `TechnicalReadPanel`, `SupportResistancePanel`, `SignalSummaryPanel`, `PatternsPanel`, `KeyLevelsPanel`, `MultiTimeframeGrid`, `ThesisBuilderPanel`, `MarketStructurePanel`, `BacktestPanel`. |

Worth a note rather than a bare line: the file already warns twice about `analytics/`
(the reserve-UI "do not re-inline it" rule at CLAUDE.md:713), and a reader scanning the
tree for where TA panels live currently finds nothing.

### A3–A4. `docs/agents/code-checker.md:21,22` — baseline figures, both stale within a day

| | Current | Proposed | Proof |
|---|---|---|---|
| **A3** (line 21) | `npx vitest run  # 1311 tests in 88 files as of 2026-09-08` | `# 1360 tests in 91 files as of 2026-09-08` | `npx vitest run` → **Test Files 91 passed (91) · Tests 1360 passed (1360)** |
| **A4** (lines 22, 29) | `npx eslint .  # 0 errors; ~52 pre-existing warnings` | `# 0 errors; ~44 pre-existing warnings` | `npx eslint .` → **44 problems (0 errors, 44 warnings)** |

Both were written **earlier today on this same branch** and were overtaken by work later
the same day. That is the general point, not an accident: a count in prose goes stale
faster than any other kind of claim, which is why the same file already tells reviewers
to *diff instances, not counts*. Consider whether these two lines should carry a
figure at all, or should just say "run it and diff against your branch point".

### A5. `docs/audits/production-readiness-scorecard.md:49` — the coverage floor

| | |
|---|---|
| **Current** | `**Stale.** The floor is **45%**, not 80% — reconciled deliberately in 2026-07 so pyproject.toml matched what CI actually enforced` |
| **Proposed** | `**Stale scoring, current floor.** The floor is **55%** (`backend/pyproject.toml:87`), raised from 45 on 2026-09-08 with new tests rather than by moving the number; measured 57.31% locally without Postgres. It is now declared **once** — `ci.yml:146` deliberately does not override it, so a bare local `pytest` and CI gate on the same figure` |
| **Proof** | `backend/pyproject.toml:87` — `addopts = "--cov=app --cov-report=term-missing --cov-fail-under=55"`; `.github/workflows/ci.yml:146` carries the comment saying the floor is set once, in pyproject. |

The row's **75/75 score is left alone** — re-scoring is not a steward act.

---

## B. Verified — P3 review status surfaces the code has overtaken

These are inside the charter's carve-out: Appendix D completion markers are the
steward's to maintain, while the findings text and the owner's decision rows are not.
**Only the "why it is still open" column is proposed for change. No decision row, no
verdict, no finding text.**

The pattern is worth stating on its own: this table was accurate on 2026-08-17 and has
been overtaken by roughly three weeks of build work that nobody came back to tick.

### B1. Row 11, 13 — `P3-production-review.md:935`

| | |
|---|---|
| **Current** | "Confirmed gap, not yet built. Today the catalog carries LQD and HYG only — no international (BNDX/IAGG/BWX/EMB/VWOB), no muni (MUB/VTEB/TFI), no muni row in `BOND_ETF_SHELF`, no muni tier in `RateCreditQuality`, and no tax-equivalent-yield concept, which is the whole point of holding munis" |
| **Proposed** | "✅ **BUILT 2026-08-19.** All eight funds are in the catalog and the tax-equivalent-yield calculator exists with tests. The row's remaining question is whether the muni tier in `RateCreditQuality` is populated to the owner's satisfaction" |
| **Proof** | Every one of the eight symbols returns exactly one `symbol: '…'` match in `frontend/src/lib/data/fundCatalog.ts` (MUB, VTEB, TFI, BNDX, IAGG, BWX, EMB, VWOB). `frontend/src/lib/utils/taxEquivalentYield.ts` and its `__tests__/taxEquivalentYield.test.ts` both exist. `ratesCatalog.ts:94` names MUB municipal in the bond shelf. |

### B2. Row 2b — `P3-production-review.md:940`

| | |
|---|---|
| **Current** | "Asked for in T3, never delivered; still absent. Needs a benchmark-series fetch and a choice of benchmark" |
| **Proposed** | "✅ **BUILT.** Beta vs a selectable benchmark (SPY/QQQ/IWM/VT/AGG/BTC) with R² shown alongside" |
| **Proof** | 21 `beta`/`Beta` references in `frontend/src/app/(dashboard)/compare/page.tsx`. |

The identical sentence also sits at **line 777**, inside Appendix E's "Decided" list.
That one is an owner decision row — **not proposed for change**, flagged only so the
contradiction is visible in one place.

### B3. Row 16 — `P3-production-review.md:938`

| | |
|---|---|
| **Current** | "…This is a second engine, not an edit: `BuilderInputs` has no target-weight field and every weight is derived" (reads as scoped-but-unbuilt) |
| **Proposed** | Append: "✅ **BUILT 2026-08-19** — `buildFromAllocation()` in `lib/data/portfolioBuilder.ts` plus `components/portfolio-builder/AllocationBuilder.tsx`; both modes emit the same `BuiltPortfolio`, so a hand-built plan shares saved-plan storage, the drift monitor and `reviewPlan`" |
| **Proof** | `buildFromAllocation` present in `portfolioBuilder.ts`; `AllocationBuilder.tsx` exists. |

### B4. Rows 6, 7 — `P3-production-review.md:934`

| | |
|---|---|
| **Current** | "**Owner still deciding** whether equities gets one combined scanner or several… Note the maturity gap: crypto has 7 setup detectors, 3 timeframes and auto-refresh; equities has 24 hardcoded large-caps" |
| **Proposed** | "✅ **BUILT 2026-08-19.** One scanner per section, each promoted to nav. The equities question was answered by merging: the same seven setup detectors over the curated catalog, combined with the AI Outlier Scan, replacing the 24-symbol RSI/SMA tab" |
| **Proof** | `app/(dashboard)/scanner/page.tsx`, `equities/scanner/page.tsx` and `macro/scanner/page.tsx` all exist, and `lib/modules/registry.ts` carries four matching nav hrefs. |

### B5. Rows 4 and 5b — decisions executed, framing **not** proposed for change

Both rows' *builds* are done and verifiable: `lib/risk/__tests__/riskScoringRemoved.test.ts`
guards the risk-score removal, and the "Strong Add / Too Speculative" vocabulary survives
only inside a comment at `app/live-data/coin-discovery/route.ts:8` explaining its own
retirement.

**No change proposed.** Both rows also carry a *regulatory* framing ("parked pending
regulatory review", `BUSINESS-CHECKLIST.md:40-43`), and only the owner can close that.
Listed here so the sweep is not silently selective.

---

## C. Verified — historical documents, annotation only

The charter forbids editing findings, assessments and prompts. These get a dated status
block appended, nothing rewritten.

### C1. `docs/assessments/T10-crypto-ta-audit.md:3, 76`

Says the TA page is **1,791 lines** and that its ~10 inline panels "would move cleanly to
`components/analytics/technical/`. A refactor of that size… should be its own task."

That task became T-270 and shipped on 2026-09-08 — to that exact directory. Proposed
annotation: a dated block recording that the extraction happened, that the page is now
**435 lines**, and that the audit's own list was already historical when written
(`ScannerPanel` had moved to `/scanner` on 2026-08-19, so nine panels moved, not ten).

### C2. `docs/TASK-QUEUE.md:610, 617, 636`

The T10 deployable prompt states "1,791 lines — largest page in the app" three times and
instructs the agent to "note extraction opportunities, but do not undertake a large
refactor".

A deployable prompt is a historical artefact, so the prompt text stays. Proposed: one
dated line above the `<details>` block recording that the extraction it declined is done,
so nobody re-runs the brief against a page that no longer matches its description. Worth
noting the prompt also carries a stale local path (`C:\Users\marcu\…\Crypto-Stuff\frontend`)
— pre-monorepo naming, already flagged generally in CLAUDE.md.

---

## D. Could not fully verify — owner calls, left open

Per the charter: a wrongly ticked box costs more than a stale open one.

### D1. FIX-FIRST row `S1-1` — `P3-production-review.md:840`

"Equity backtest Sharpe annualized at 52/12 bars-per-year against data that is daily on
every range" is listed as **must land before rollout**.

What I can verify: `/equities/backtests` now redirects to `/equities`
(`next.config.mjs:103`), and all three backtest surfaces were hidden on 2026-08-20 with
subproject P3-W2-S1 suspended, not cancelled.

What I cannot: whether a fix that must land *before rollout* still blocks rollout when
the surface it affects is not in the rollout. That is a scope decision, not a fact about
the tree. **Left open**, with two readings offered — reclassify as "blocked on S1's
un-suspension" (the defect is real and unfixed), or leave as-is if hiding a surface is
not meant to relax its entry condition.

### D2. Appendix D closing note — "Ten are approved build work"

If B1–B4 are applied, that tally is wrong, but recounting depends on how rows 4 and 5b
are classified — and those are the two the owner has parked. **Left open** until B is
ruled on.

### D3. Everything measurement-derived

Untouched by design. Live-APR coverage (4 of 51), the fund-universe payload
re-measurement, `staking-discovery` latency, every LIVE/PARTIAL verdict: all still need
one `npm run audit` on the owner's machine. This session is a cloud session, where
Binance.com 451s and Reddit/LunarCrush block datacenter IPs, so any figure measured here
would be systematically wrong.

---

## E. Cross-file siblings checked and found clean

Recorded so the next pass knows what was covered.

- **`docs/CI-REMEDIATION.md`** — both "Open" items (coverage floor, EKS v19 pin) were
  closed in this PR by the commits that resolved them, with the reasoning at the entries.
  No stale twin remains.
- **`DATA-AVAILABILITY.md`** — the 2026-09-08 correction pass is current, and the crypto
  social row was extended today with the live-vs-derived split (T-156). Its 429/coverage
  sentence is a measurement and was deliberately not touched.
- **`CLAUDE.md` Social row** — matches `dataSources.ts` and `DATA-AVAILABILITY.md`; all
  three now carry the same finding.
- **No live-data routes were added or removed by this PR**, so A1's drift is inherited,
  not introduced.
- **`lib/risk/profiles/`** — still eight profiles; CLAUDE.md's count is correct. (A ninth,
  `fund.ts`, is with the opportunity-scout as a proposal, not built.)
