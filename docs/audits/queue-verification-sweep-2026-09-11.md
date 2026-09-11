# Queue verification sweep — the remaining 66 items

**Proposal, not an applied change.** Nothing in `docs/TASK-QUEUE.md` was edited; status
docs move by propose → owner approves → apply.

Follows the 15-item pass in `queue-verification-2026-09-10.md`, which sampled and found
15 of 15 already closed. This covers every remaining open `remote-dev` / `either` item.

## Result

| | Count |
|---|---|
| Verified **CLOSED** (survived an adversarial re-check) | **47** |
| Claimed closed but **OVERTURNED** on re-check | 3 |
| **PARTIAL** — some of it shipped, a named remainder | 14 |
| **OPEN** | 2 |
| Total | 66 |

So of the 81 items the queue listed as open for this role, **62 are closed** (15 + 47)
and 19 carry real remaining work — most of it partial rather than untouched.

## Method, and its weak points

Eleven agents verified ~6 items each against the code, read-only, required to cite a
file, line or command result. Every CLOSED claim then went to a second agent prompted to
**refute** it, defaulting to overturning unless the evidence held.

The audit pass is deliberately one-sided. A wrong CLOSED silently deletes real work from
a backlog; a wrong OPEN just costs a later look. Those are not symmetric errors, so they
do not get symmetric scrutiny.

**It earned its place: 3 of 50 CLOSED claims were overturned** — a 6% first-pass error rate.

⚠ **Two weaknesses in this evidence, stated plainly.**

1. **All 47 upheld claims report `confidence: high`, with zero medium or low.** Real
   verification produces a spread. That uniformity means the confidence field carries no
   information and should not be read as corroboration.
2. **No agent returned UNCLEAR**, though it was offered and encouraged. Either every item
   was genuinely decidable, or the agents were reluctant to admit uncertainty. The
   overturn rate suggests some of the latter.

Four claims were also spot-checked by hand (T-350, T-391, T-277, T-346) and all four held.
T-346 initially looked wrong — 12 surviving `riskScore` references — until reading them
showed every one is either a comment explaining the rename or a test asserting the key is
**absent**. The naive grep was the unreliable step, not the verdict.

## Overturned — claimed closed, still open

**T-001** — Half of the task is explicitly not done, per its own cited evidence. docs/assessments/T6-agent-prompts.md:95-97 states verbatim: "Until that happens, T6 is **half done**: the prompts are verified accurate against the app; their answers are unevaluated," and :93-94 records the blocking precondition: "**Precondition for the output half of T6:** `cd frontend && npm run audit` on the owner's machine …

**T-322** — PARTIAL / NEEDS-OWNER, not done. The PROPOSE artifact is genuine — docs/proposals/2026-09-08-proposals.md exists on main with 5 substantive proposals — but the item cannot be closed. (1) All five are still unruled: '**Status:** PENDING' at lines 21, 90, 134, 237, 287 (line 134: 'PENDING — but its *symptom* is already fixed'). (2) The FILE pass the document's own instruction requires ('Then run th…

**T-328** — PARTIAL, not done — the defects the sweep identified are still present in the tree. Checked each claimed section-A item against current files: A2 — CLAUDE.md:159 is still the bare '│ ├── analytics/' line with no note and no technical/ subdirectory entry, though frontend/src/components/analytics/technical/ holds the nine extracted panels; A3 — docs/agents/code-checker.md:21 still reads 'npx vitest…

## Still carrying work (16)

| Item | Verdict | What remains |
|---|---|---|
| T-070 | PARTIAL | Remaining: the remote deliverable (a proposed candidate list of additions with issuer source + ER + 'quotability must be probed on the owner's machine' caveat) and the additions themselves.… |
| T-107 | PARTIAL | The three items named in the task summary (Budget, wallets/NT3, NT5) are all done; the one gap is the Yahoo-removal annotation on the Macro TA status bullet. |
| T-119 | PARTIAL | Engineering half is CLOSED (per-link disclosure component + route + nav + tests). Remaining half is the disclosure prose, which the task itself says not to invent — that piece is NEEDS-OWNE… |
| T-121 | PARTIAL | ROADMAP.md:465 marks click-through tracking ✅ but says nothing about an owner view. Remaining work is the gated surface (owner-only read), not the counter. |
| T-129 | PARTIAL | Two remaining pieces: (a) the steward annotation on ROADMAP.md:519-520 naming what already landed — purely a docs edit, still open; (b) the result-quality sweep, which needs the owner's mac… |
| T-181 | OPEN | Recurring process item; correctly OPEN because its trigger date has not arrived. Nothing in the scorecard has been re-verified since 2026-07-29. |
| T-300 | PARTIAL | Targeted corrections have landed (steward sweep, CI-REMEDIATION 'Open', DATA-AVAILABILITY header, several correction PRs e.g. #175 'correct three VPN-era claims'), but the systematic all-do… |
| T-301 | PARTIAL | Other in-app surfaces do look swept: grep over frontend/src/components/ui and the settings page found no '110 assets'/'750 coins'/'25+ indicators' copy, and frontend/src/components/ui/Popou… |
| T-326 | PARTIAL | Five of the six items in next_action are present verbatim in both files (landed in commit 046ae69, PR #153); the only gap is the explicit RP-3 bullet — one line in each file, and most point… |
| T-338 | PARTIAL | Half the task shipped; the other half is a recorded deliberate decision with a named revisit trigger (backend's future / ROADMAP Phase 6), not an oversight. If the owner accepts that decisi… |
| T-352 | OPEN | Task itself says "Defer", so OPEN here means not-implemented, not neglected. No persisted daily yield series exists to source the vol from either. |
| T-353 | PARTIAL | The next_action ("propose as a TASK-QUEUE item scoped like P2-R3") is drafted with exactly that scoping, but approval/insertion is owner-gated and hasn't happened. Note the proposal itself … |
| T-354 | PARTIAL | The dated note the task asked for landed at §4; §6.2's own draft weight table and the §9 item-8 line are the remaining stale text, and §6.2 now contradicts shipped code rather than merely p… |
| T-360 | PARTIAL | Roughly 90% landed. Only the coin-discovery half of the §Why gap named by the spec is unwritten. |
| T-374 | PARTIAL | Named-variable scope is clean everywhere; the residue is the two 'mock data enabled' echoes, the doubled /api/v1 suffix in both start scripts, and a stray empty markdown table. |
| T-375 | PARTIAL | Headline deliverable (the file + a working README copy step) is done; the start.sh/start.ps1 sub-item of next_action is not. |

## Verified closed (47)

Each survived the refutation pass. Evidence abridged — the full citations are in the run
transcript.

| Item | Evidence |
|---|---|
| T-069 | frontend/src/components/markets/FundFactsSection.tsx exists (176 lines) with a header comment "─── Side-by-side fund facts (S6, T-069) ───" and ROWS covering Type, Issuer, Category, Strategy, Tracks (index), E… |
| T-074 | frontend/src/lib/data/feeImpact.ts:94-96 documents the visual pass first-hand: "…rendered that as \"−$0\" in the amber cost colour: a minus sign on nothing… Found by looking at the rendered page (T-074); no un… |
| T-080 | docs/TASK-QUEUE.md §"Maintenance — dependency majors held for verification (2026-08-11)" (heading at line 2166) now carries a dated steward annotation block: "> **Status: ✅ resolved — annotation added 2026-09-… |
| T-081 | .github/workflows/cd-staging.yml:68 — `if: ${{ vars.STAGING_DEPLOY_ENABLED == 'true' &#124;&#124; github.event_name == 'workflow_dispatch' }}` on the build-and-push job, i.e. option (b) verbatim. It is preceded by a 22-… |
| T-100 | All three guards shipped, owner-approved 2026-09-08, and the pinning tests were flipped to assert them. (1) frontend/src/lib/utils/indicators.ts:1140 `if (slice.length === 0) return null` plus :1146 `if (!Numb… |
| T-101 | docs/assessments/P3-production-review.md:350 (the E13 row) now reads: "&#124; E13 &#124; Sentiment Overview: per-symbol score + pos/neg split, method disclosed on-page. *(Corrected 2026-09-08: the `sentimentScore` FIELD… |
| T-103 | The route was wired, matching the task's own default recommendation. frontend/src/components/pump-report/ScanAllPanel.tsx:40 — `const res = await fetch('/live-data/pump-report/scan', {` — and the panel is rend… |
| T-104 | frontend/src/lib/utils/__tests__/signalSummary.test.ts exists (147 lines), header comment line 6: "E-note-6 (P3 production review) — correctness of the SIGNAL AGGREGATION." It runs a constructed uptrend and a … |
| T-108 | docs/ROADMAP.md:356-358 now reads "- Instruments layer: all 45 macro instruments (19 commodities, 18 FX **including** DXY, 8 rates — corrected 2026-09-08; \"18 FX + DXY\" counted DXY twice, and the catalogs ar… |
| T-118 | frontend/src/lib/data/stakingProviders.ts:176,178 declare the optional fields `affiliateUrl?: string` and `affiliateProgram?: string`, with the integrity rule at :160 ("`affiliateUrl` never overwrites this (RO… |
| T-126 | frontend/src/app/(dashboard)/staking/page.tsx:665-674 — comment "Kept ABOVE the provider grid, not in a footer (T-126)" immediately above `<AffiliateDisclosure />` (:674), which renders at :69-74 "This is info… |
| T-156 | All three targets carry the live-vs-derived finding. (1) frontend/src/lib/data/dataSources.ts:235 notes: "What is live vs derived, since the row said only \"partial\": the Santiment and LunarCrush SOCIAL VOLUM… |
| T-158 | dataSources.ts:349 (fund-holdings) now reads "the stock/bond/cash ASSET MIX is DERIVED FROM N-PORT’s assetCat field (NT9) rather than having no source — the earlier \"no source at all\" note was overtaken by t… |
| T-162 | All four sub-edits are in CLAUDE.md. (a) Module count: line 10 reads "plus **five** optional modules" with an explicit "(This said \"seven\" while listing five; `lib/modules/registry.ts` is the count that matt… |
| T-165 | dataSources.ts:394 (id 'macro-quotes') now reads "FUTURES and FX PAIRS still price through the equity quote/chart routes (no separate plumbing). The four YIELD INDICES no longer do: since D3 (2026-09-03) ^IRX/… |
| T-166 | dataSources.ts:343 (id 'fund-universe') notes now read "Discovered funds ship as compact {symbol,name} rows (2026-07-30, audit follow-up F3). PAGINATION WAS CONSIDERED AND REJECTED in item 11, not deferred: th… |
| T-170 | DATA-AVAILABILITY.md:567 Stock social row now reads: "**Starvation fixed 2026-07-22** (`lib/server/socialBlend.ts`, unit-tested) … The blend now allocates the budget round-robin across providers … **Separately… |
| T-171 | The decision was made and recorded in both code and docs — keep them. frontend/src/app/live-data/fx-rates-extended/route.ts:67-73: "'kpw' (North Korean won) and 'syp' (Syrian pound) are deliberately KEPT even … |
| T-172 | `frontend/src/app/live-data/staking-discovery/route.ts:92` `const UPSTREAM_TIMEOUT_MS = 6_000`, applied per fetch at line 114 `signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)` inside `getJson()` (line 108), w… |
| T-173 | `frontend/src/app/live-data/alerts/route.ts:2-4` now imports `{ coingeckoBase, coingeckoHeaders } from '@/lib/api/live/coingecko'` and `{ recordProviderFetch } from '@/lib/api/live/providers'`; line 99 builds … |
| T-239 | Both target docs carry the dated annotation immediately under the Commit line. docs/audits/2026-07-30-audit.md lines 4-9: "> **Note (2026-09-08):** commit `14d6d76` predates the **2026-08-05 re-root of `main`*… |
| T-248 | docs/architecture/source-terms.md lines 23-30: "**54 of 56 entries** are starting positions drawn from documented posture. Two are `verified`, both read on the owner's machine: … (2026-08-29 — see `docs/audits… |
| T-256 | frontend/package.json:20 `"test:coverage": "vitest run --coverage",` and :79 `"@vitest/coverage-v8": "^3.2.6",` in devDependencies (3 references in frontend/package-lock.json). frontend/vitest.config.ts:20-32 … |
| T-257 | docs/audits/2026-09-08-audit.md exists (323 lines), committed in 046ae69 ("Outstanding-task sweep: 75 of 81 actionable items, plus all three agent passes (#153)"). It is the code-auditor format: header "# Code… |
| T-268 | frontend/src/app/live-data/ohlcv/route.ts:107-112 now reads: "// Cap only. CoinGecko's `/ohlc?days=1` returns 30-minute candles covering one / // day — about 48 bars — so this slice never actually trims. It is… |
| T-269 | frontend/src/lib/utils/confluence.ts exists as an extracted pure module with RATIO thresholds: `export const CONFLUENCE_STRONG_RATIO = 0.75`, `CONFLUENCE_MODERATE_RATIO = 0.6`, `CONFLUENCE_MIN_LOADED = 3`, and… |
| T-270 | frontend/src/components/analytics/technical/ exists with nine panel files: BacktestPanel.tsx, KeyLevelsPanel.tsx, MarketStructurePanel.tsx, MultiTimeframeGrid.tsx, PatternsPanel.tsx, SignalSummaryPanel.tsx, Su… |
| T-277 | mcp-server/package.json:3 `"version": "1.1.0"` and mcp-server/src/index.ts:64 `version: '1.1.0'` in the McpServer constructor. index.ts:364-368 — compare_staking_risk's description now reads "Reports the canon… |
| T-302 | backend/pyproject.toml:87 `addopts = "--cov=app --cov-report=term-missing --cov-fail-under=55"` — above the 45 the task names. The in-file comment at lines 75-85 records the measurement it rests on: "2026-09-0… |
| T-304 | infrastructure/terraform/eks.tf:7 — `version = "~> 20.37"` (the ~> 19.21 pin this task names is gone). eks.tf:111 `authentication_mode = "API"` and eks.tf:121 `access_entries = { … cicd_deploy = { principal_ar… |
| T-308 | The per-page columns are built in frontend/src/app/(dashboard)/equities/EquitiesClient.tsx: import of SecurityReturnsResponse (:18), page-scoped query `['security-returns','equities-page', pageSymbols.join(','… |
| T-327 | docs/agents/checklist-steward.md:112 now reads "## Known open items (state as of 2026-09-08 — verify before relying on this)" followed by "Refreshed from the 2026-09-07 outstanding-task verification sweep (398… |
| T-330 | docs/agents/code-checker.md:21-22 now reads `npx vitest run # 1311 tests in 88 files as of 2026-09-08; must all pass` and `npx eslint . # 0 errors; ~52 pre-existing warnings` (the stale 412/~67 figures are gon… |
| T-331 | docs/agents/code-checker.md:80-88, Security section. The guarded-route bullet now lists only "(agents, provider config writes, video-analyze POST, the pump-report scan/investigate/chat routes)" — no "exchange … |
| T-332 | docs/agents/code-checker.md:104 opens the do-not-fix registry; a new sub-table at "### Added 2026-09-08 (decisions since 2026-08-08)" carries every requested row: RP-6 ("No per-coin risk score anywhere — no `r… |
| T-334 | docs/architecture/auth.md:12-25 — the table is introduced as "**Two** switches" with rows only for `REQUIRE_AUTH = false` and `LOGIN_DISABLED = true`, followed by "> *Corrected 2026-09-08:* this table listed a… |
| T-346 | frontend/src/app/live-data/pump-report/investigate/route.ts:44 declares `suspicionScore: number` and line 85 of the prompt template emits `"suspicionScore": <0.0-10.0>`, with a comment at :33-37 recording the … |
| T-350 | The function now lives at frontend/src/lib/utils/pegFormat.ts:22 (`export function getPegDeviationColorClass(bps: number &#124; null): string`). frontend/src/lib/utils/risk.ts:11-13 carries only a note: "getPegDevi… |
| T-361 | `CLAUDE.md:367` — "- **`computeOverallRisk(risks)` and `getRiskLevel(score)` are `@internal` legacy helpers — do not reach for them in new code.** They run a **1–10, higher-is-RISKIER** scale (weights: counter… |
| T-369 | All three code/doc deliverables are present. (1) Gating: .github/workflows/cd-staging.yml:68 `if: ${{ vars.STAGING_DEPLOY_ENABLED == 'true' &#124;&#124; github.event_name == 'workflow_dispatch' }}` (line 65 comment: "A … |
| T-370 | `grep -c WS_URL` returns 0 for every file named in next_action and for cd-production.yml as well: .github/workflows/cd-staging.yml 0, .github/workflows/ci.yml 0, .github/workflows/cd-production.yml 0, infrastr… |
| T-376 | Option (a) was taken. docs/runbooks/backup-restore.md:3-13 — "> **Correction, 2026-09-08.** This runbook listed an hourly `pg_dump` CronJob writing to `s3://fn-backups`. **Neither exists** ... **Aurora's autom… |
| T-377 | Grep for `fn-cluster` across the whole repo: "No matches found". All three runbooks now use the correct identifier: docs/runbooks/backup-restore.md:37 `--db-cluster-identifier fn-staging-aurora` and :80 `--sou… |
| T-380 | README.md line 7 now reads "Finance Now is one module in a larger suite. The same shell hosts entitlement-gated modules for Equities, Macro Markets, ETFs & Funds, and a Portfolio Builder…" — no 'on the roadmap… |
| T-381 | README.md 'Feature Status (honest)' section header now says "Verified against the running application, July 2026. **Rows corrected 2026-09-08** against `CLAUDE.md`'s feature inventory and `DATA-AVAILABILITY.md… |
| T-382 | `ls infrastructure/docker/` shows only docker-compose.yml, docker-compose.prod.yml, nginx/ — no .env.example, and the README no longer asks for one. README.md:143-151 now reads: "cp backend/.env.example backen… |
| T-391 | frontend/src/lib/technicals/sweep.ts:50 adds `realisedVol30dPct: number &#124; null` to the row type, :78 `export function realisedVolatilityPct(closes: number[], window = REALISED_VOL_WINDOW, periodsPerYear = CRYP… |

## Suggested ruling

1. Approve the 47 as closed, or name any you want re-evidenced from the transcript.
2. The 19 with remaining work are the real backlog for this role. Most are PARTIAL, so
   each needs a scoped remainder rather than a fresh start.
3. Nothing here touches the owner-gated set (terms review, T-056/T-036/T-394/T-130) or
   the GitHub admin items.
