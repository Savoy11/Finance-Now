# Checklist-steward sweep — batched proposal

**Date:** 2026-09-21  
**Scope:** the 22 queue items worked in the `chore/queue-batch-verification` batch  
**Status: PROPOSED — NOTHING HAS BEEN APPLIED.** Every row below awaits owner approval.

Run as four independent steward agents, one per item group. Each was given what the
previous pass concluded and told explicitly that a conclusion is *a pointer, not
evidence* — the charter's rule that a status is never marked done from a summary. Every
`file:line` below was re-read in the current tree during this sweep, not carried forward
from the queue snapshot.

---

## 1. Contradictions — read these before approving anything

These are places where the previous pass was wrong, or where two ledgers disagree.
Several invalidate claims made in the batch commit message.

### C1. _(docs-infra-items)_

The two ledgers disagree, and the JSON is the lagging one. docs/audits/task-queue-2026-09-07.json still carries all five as `"status": "open"` (T-333:2075, T-334:2095, T-370:2234, T-374:2256, T-380:2318) with no `closure` block, while queue-verification-sweep-2026-09-11.md and queue-closure-review-2026-09-13.md record four of them as verified-closed. T-381 — swept in the same batch and adjacent in the same file — DID get its closure block on 2026-09-20 (line 2360). So this is a missed write, not a disagreement about facts.

### C2. _(docs-infra-items)_

The previous pass's "T-333 already fixed" is true but incomplete. Both cited files are clean, and the defect is now unreachable (the rewrite itself is gone, frontend/next.config.mjs:19-37; API_BASE_URL deleted, frontend/src/lib/constants.ts:5). But .github/workflows/cd-staging.yml:185 still carries the `/api` suffix the ConfigMap comment (configmap.yaml:64-66) explicitly forbids. Reporting T-333 as simply "fixed" would leave that unowned.

### C3. _(docs-infra-items)_

T-370's own source document now contradicts the tree. docs/deployment/aws-provisioning.md:219-222 asserts "`cd-staging.yml` **still passes** a `NEXT_PUBLIC_WS_URL` build arg". It does not — cd-staging.yml:184-186 passes two build-args and neither is WS_URL. Banner proposed above; the paragraph stays verbatim as the record of what that 2026-08-07 pass deferred.

### C4. _(docs-infra-items)_

docs/ROADMAP.md:158-159 still plans a "session-aware `useAuthStore`". The store was deleted, not rewired (docs/architecture/auth.md:116-122, 5e1c32a); zero references remain under frontend/src. Phases 1 and 2 carry dated annotation blocks; Phase 0 carries none, which is why this line survived three sweeps.

### C5. _(docs-infra-items)_

The 2026-09-11 sweep's PARTIAL verdict on T-374 is overtaken, not wrong. Its named residue — the "mock data enabled" echoes and the doubled /api/v1 suffix in both start scripts — is cured: start.sh:108 and start.ps1:125 now write the bare origin, and both scripts say "there is no mock data path" (start.sh:110, start.ps1:127). That work landed after 09-11, so the sweep was correct on its date.

### C6. _(docs-infra-items)_

⚠ A stale duplicate tree will make a future grep-based pass reopen all five. `.claude/worktrees/agent-a76f6d909b69cc2de/` holds pre-fix copies of every file in this sweep — local-setup.md:84-86 (NEXT_PUBLIC_API_URL=.../api/v1 + WS_URL + USE_MOCK=true), configmap.yaml:58-59, start.sh:88-90, start.ps1:87-89, README.md:76-77, CLAUDE.md:245-246 (still branded CAEP). It is not the tree of record, but any verifier that greps the repo root without excluding it reads these items as still open. Worth an exclusion note wherever the verification method is written down.

### C7. _(code-items)_

THE PREVIOUS PASS WAS WRONG ON T-259's ATTRIBUTION. The brief says T-259 is 'already bounded by the 2026-09-20 change that bounded 89 outbound fetches'. No such change exists in the repo's record: no doc mentions '89' in that context, and the only files in docs/ mentioning outbound fetches or AbortSignal.timeout are the three queue-verification audits and the 2026-09-19 DA steward proposal (whose line 108 is about `revalidate`, not timeouts). The bound is real but OLDER and NARROWER than described — walletFetch.ts:3-13 attributes it to the 2026-07-27 app audit, and queue-verification-2026-09-10.md:24 already found `AbortSignal.timeout(WALLET_FETCH_TIMEOUT_MS)` present on 2026-09-10, ten days before the date claimed. The closure stands on its own file:line evidence; the sweeping '89 fetches' framing does not, and should not be repeated into the ledger.

### C8. _(code-items)_

THE LEDGER IS DRIFTING SYSTEMICALLY, NOT ITEM-BY-ITEM. 43 of the 62 items that queue-closure-review-2026-09-13.md re-verified against main@55a4b52 ('62 of 62 evidence intact, 0 regressions') still read "status": "open" in the live ledger: T-069, T-072, T-074, T-080, T-081, T-100, T-103, T-104, T-118, T-126, T-156, T-172, T-173, T-256, T-257, T-259, T-262, T-267, T-268, T-269, T-270, T-273, T-277, T-302, T-304, T-308, T-327, T-330, T-331, T-332, T-333, T-334, T-346, T-350, T-361, T-369, T-370, T-376, T-377, T-380, T-382, T-388, T-391. The 19 that ARE closed were closed on 2026-09-20 through a DIFFERENT route (the doc-accuracy and DATA-AVAILABILITY sweeps, #206/#208/#209) — i.e. the 62-item approval was never applied, and the overlap is coincidence. This is the exact shape of the incidents the charter opens with. I am NOT proposing the other 37 closed: they were verified in September against a commit that has since moved, and closing 37 boxes on another document's say-so is the failure mode, not the fix. They need their own sweep.

### C9. _(code-items)_

THE QUEUE'S OWN LINE NUMBERS ARE UNRELIABLE, AND TWO OF THESE SIX PROVE IT AGAIN. T-262's summary says 'transferFees.ts:2207' — the file is 2,166 lines. T-072 cites FundsClient.tsx:316 — the relevant code is at :186-191 and :365-367. The JSON already warns about this in annotations.passes (2026-09-19): 'The line numbers cited by T-167/168/169/170 had all drifted … Treat a line number in any other entry of this snapshot the same way.' Every citation in my proposals above is to the CURRENT tree, re-read this pass, not carried forward from the queue.

### C10. _(tooling-and-ta-items)_

**T-277: the previous pass's "NOT-REPRODUCIBLE" is wrong, and the wording matters.** D14 did delete `compare_staking_risk` — confirmed at `mcp-server/src/index.ts:372-396`, where a tombstone explains it was deleted rather than hidden because its whole output was what was rejected. But the *other* half of T-277's `next_action` — "bump version to 1.1.0 in package.json and the McpServer constructor (index.ts:64)" — WAS completed, on 2026-09-08, and still stands: `mcp-server/package.json:3` and `mcp-server/src/index.ts:64` both read `1.1.0`. "Not reproducible" says there was nothing there to find, which would erase a landed change; "done" would claim someone did work D14 made impossible. The correct verdict is SUPERSEDED with a pointer to D14, noting the version bump landed — which is what the task's own warning predicted and what is proposed above.

### C11. _(tooling-and-ta-items)_

**Two ledgers disagree about the MCP staking tool, and the stale one is an assessment nobody annotated.** `docs/architecture/risk-scale-spec.md:508-526` carries a D14 banner dated 2026-09-14 saying `compare_staking_risk` was deleted and the composite fields are gone. `docs/assessments/R2-phases-3-5.md:51-81` — cited by T-277 as a source — still asserts in the present tense that the API carries `safetyScore`/`band` (5a "DONE") and that `compare_staking_risk`'s description names both scales with their directions (5b "COMPLETED 2026-09-08"). Both claims are false as of 2026-09-14. D14's own actionable list required exactly this fix — `docs/decisions/2026-09-14-owner-decisions.md:210`, "update R2 §5.3 references" — and only the spec got it. This is the same failure mode as T-225/T-226: the item survived because its SOURCE was never annotated.

### C12. _(tooling-and-ta-items)_

**T-156's own citation is stale in the queue snapshot.** The item quotes `CLAUDE.md:716` as reading `| Social | /social | 🟡 Partial | /live-data/social — verify which signals are live vs derived |`. That string exists nowhere in CLAUDE.md today; the Social row is at `:1238` and already carries the full live/derived/neither split. The queue's own `annotations` block already warns that its line numbers are a 2026-09-07 snapshot — this is another instance, not a new problem, but it means a reader following the citation finds unrelated content.

### C13. _(tooling-and-ta-items)_

**T-104 was not done the way its `next_action` prescribed, and the deviation is correct.** `next_action` asked for asserts "against hand-computed expectations" for the buy/neutral/sell counts, score and verdict. `frontend/src/lib/utils/__tests__/signalSummary.test.ts:5-15` explicitly declines to hand-compute ~25 indicator values — that would test the indicator library, not the fold — and instead recomputes the reported figures from the signal list the same call produced, while hard-coding the fold's *rules* (weight map, non-neutral denominator, ±1.5/±0.5 bands) independently of `indicators.ts:1417-1432`. So the test can still fail on a real aggregation bug. Recording it so the next reader does not "fix" the test toward the item's literal wording.

### C14. _(tooling-and-ta-items)_

**`docs/assessments/P3-production-review.md:360-366` still lists note 6 as "Still open ... (test gaps — D-24)".** That block is dated 2026-08-16 and was true then; it is also already wrong about note 4, and note 4's own annotation at `:381-387` says so in as many words ("the notes sweep above still lists 4 as 'still open' because it was written before D-24 closed in the same pass"). I am proposing to follow that precedent — annotate note 6, leave the dated block as written — rather than editing a dated status block into agreement. Naming it because it looks like an omission and is a deliberate choice.

### C15. _(tooling-and-ta-items)_

**A dated verification record now cites a tool that no longer exists.** `docs/audits/queue-verification-sweep-2026-09-11.md:111` ticks T-277 and quotes `index.ts:364-368` for `compare_staking_risk`'s reworded description; `docs/audits/queue-closure-review-2026-09-13.md:101` ticks the same item on the version-bump evidence. Both were accurate on their dates and neither is being corrected — but the first sends a reader to a tool D14 deleted three days later. A dated pointer is proposed above; the rows stay verbatim.

### C16. _(charter-and-queue-items)_

**The previous pass was WRONG about the test-file count.** `docs/agents/code-checker.md:36` says "a file count taken on 2026-09-21 found **112** test files against the 107 recorded two days earlier." Measured today under vitest's own include (`src/**/*.{test,spec}.{ts,tsx}` from `frontend/`, per `vitest.config.ts:19`): **110**. A repo-root sweep returns **118**, the extra 8 being a scratch checkout under `.claude/worktrees/` that vitest never runs. 112 is neither. The bullet whose entire purpose is to stop undated/unreproducible counts from being carried forward is itself carrying one — which is why the T-330 closure above is paired with a correction rather than proposed alone.

### C17. _(charter-and-queue-items)_

**The previous pass was WRONG about `opportunity-scout.md` being stale.** The queue task flagged it as "a second policy list that was NOT touched — check whether it is still stale." It is not stale. `.claude/agents/opportunity-scout.md` carries RP-6 (:93), ranking-vs-explanation item 4 (:97), RP-3 with the NT7 rejection history (:100-105), the Yahoo hard-block (:106), RP-5 (:108) and free-tier-only (:109-110). The file's mtime is 2026-09-13, so it was brought current eight days ago, not left behind. The RP-3 bullet that the 2026-09-11 sweep named as T-326's *only* remaining gap is present in both `.claude/agents` files. This is a REMAINING GAP claim that does not survive contact with the files, and acting on it would have meant re-doing finished work.

### C18. _(charter-and-queue-items)_

**T-326's scope was misidentified.** The queue task describes T-326 as "code-checker.md was missing the Yahoo terms hard-block, RP-3-as-extended-by-D14, and D21 free-tier-only." T-326's own record says otherwise: title "Bring **both agents'** policy lists up to date", summary "code-auditor.md and opportunity-scout.md", and its single cited source is `docs/IMPROVEMENT-AGENT-SETUP.md:160-161`, whose "both files" are the two `.claude/agents` definitions. `docs/agents/code-checker.md` is a third charter with its own items (T-330/T-331/T-332). The 2026-09-21 edits to code-checker.md are good work and verified correct against the tree — but they are not what T-326 asked for, and closing T-326 on them would have left a mis-scoped record for the next reader. The closure I propose rests on the `.claude/agents` files instead.

### C19. _(charter-and-queue-items)_

**The 2026-09-21 annotation contradicts its own change's commit message.** `code-checker.md:36-37` says "no suite run has since said what that did to the 1515." `.git/COMMIT_EDITMSG` for the same change says "1538 tests, typecheck, docs:check, staleness:check and lint (0 errors) green." Either a suite run happened and the bullet understates what is known, or the commit message is reporting a number nobody measured. I cannot settle it without running vitest, so I propose no edit to that clause — but the next owner-machine run should resolve it, and whichever way it goes, one of the two records needs correcting.

### C20. _(charter-and-queue-items)_

**Two parts of the queue ledger disagree with each other on its own totals.** `counts.by_status` in `docs/audits/task-queue-2026-09-07.json` reports `open: 159, closed: 15`, and `counts.closed_by_annotation: 15`. The file today contains **40** `closure` blocks and **40** `"status": "closed"` items against **134** open. `annotations.note` protects `generated_at` and `main_sha` as generation-time facts but says nothing about `counts`, so these read as current and are not. Not proposed as a fix here — this sweep would itself move them, and a count rewritten mid-batch is the drift that rule exists to stop. Flagging it for the pass that promotes these five closures: bump `counts` in the same change, or add `counts` to the `annotations.note` sentence so it is explicitly generation-time.

### C21. _(charter-and-queue-items)_

**A cited verification record no longer matches the tree, in a harmless direction.** `docs/audits/task-queue-2026-09-07.json` → `detail.T-331.refute` asserts "frontend/src/app/live-data/wallet/ now contains only btc/eth/sol/tron/xrp, no exchange* route." The directory today also lists `exchange/` and `exchange-connections/`. Both are empty — no `route.ts`, no files — so RP-5 holds and T-331's closure stands. Recorded because the next person to run that `ls` will see something the record says is impossible.

---

## 2. Verified proposals

Each carries the exact current text, the proposed replacement, and the `file:line` in the
tree that proves the change. Approval should be a ten-second read per row.

### P1. T-333

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** Item object at lines 2072-2091 ("id": "T-333" at 2073, "status" at 2075). The closure block inserts after the "sources" array closes at 2090.
- **Proof in tree:** `infrastructure/kubernetes/configmap.yaml:67 (NEXT_PUBLIC_API_URL: "https://financenow.example.com" - bare origin) + frontend/next.config.mjs:19-37 (rewrite removed) + frontend/src/lib/constants.ts:5 (API_BASE_URL removed) + docs/deployment/local-setup.md:149`

**Current text**

```
   "id": "T-333",
   "title": "Fix doubled /api/v1/api path in the legacy-backend rewrite",
   "status": "open",
   ... (no "closure" block on the object)
```

**Proposed text**

```
Flip "status": "open" -> "status": "closed" and append, after the "sources" array:

   "closure": {
    "status_was": "open",
    "closed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "reason": "ALREADY DONE, and the defect is now unreachable rather than merely corrected. All four next_action targets are satisfied: docs/deployment/local-setup.md:149 documents NEXT_PUBLIC_API_URL as 'No longer read by anything'; infrastructure/kubernetes/configmap.yaml:67 is the bare origin, with the rule spelled out at :64-66 ('ORIGIN only, no /api or /api/v1 suffix'); docs/architecture/auth.md:98-105 marks the doubling fixed 2026-09-08 and moot since D2. The optional next.config.mjs hardening is moot: the whole /api/* rewrite was REMOVED (frontend/next.config.mjs:19-37) and API_BASE_URL deleted (frontend/src/lib/constants.ts:5), so nothing reads the variable and no value of it can double a path. RESIDUE, outside this item's scope and unticketed: .github/workflows/cd-staging.yml:185 still builds with NEXT_PUBLIC_API_URL=https://staging.financenow.example.com/api - the exact /api suffix the configmap comment forbids. Inert today, a trap if a proxy ever returns.",
    "approved_by": "PENDING - steward sweep 2026-09-21, awaiting owner approval",
    "evidence": [
     "docs/deployment/local-setup.md:149",
     "infrastructure/kubernetes/configmap.yaml:58-67",
     "frontend/next.config.mjs:19-37",
     "frontend/src/lib/constants.ts:5",
     "docs/architecture/auth.md:93-105"
    ]
   }
```

### P2. T-370

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** Item object at lines 2231-2252 ("id": "T-370" at 2232, "status" at 2234). Closure block inserts after the "sources" array closes at 2251.
- **Proof in tree:** `.github/workflows/cd-staging.yml:184-186 (build-args block contains only NEXT_PUBLIC_API_URL and NEXT_TELEMETRY_DISABLED); infrastructure/kubernetes/configmap.yaml:57-68`

**Current text**

```
   "id": "T-370",
   "title": "Remove the inert NEXT_PUBLIC_WS_URL build arg from cd-staging.yml",
   "status": "open",
   ... (no "closure" block on the object)
```

**Proposed text**

```
Flip "status": "open" -> "status": "closed" and append, after the "sources" array:

   "closure": {
    "status_was": "open",
    "closed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "reason": "ALREADY DONE. NEXT_PUBLIC_WS_URL is absent from all five files next_action names, and from cd-production.yml as well: cd-staging.yml:184-186 passes only NEXT_PUBLIC_API_URL and NEXT_TELEMETRY_DISABLED; ci.yml:181-184 the same two plus NEXT_PUBLIC_ENV; docker-compose.yml:50-52 and docker-compose.prod.yml:45-47 carry only API_URL and ENV; configmap.yaml:57-68 carries only ENV, API_URL and TELEMETRY. A whole-tree search finds the name only in prose that records its removal. SIBLING STILL STALE: this item's own source, docs/deployment/aws-provisioning.md:219-222, still asserts cd-staging.yml 'still passes a NEXT_PUBLIC_WS_URL build arg' - a separate proposal banners it.",
    "approved_by": "PENDING - steward sweep 2026-09-21, awaiting owner approval",
    "evidence": [
     ".github/workflows/cd-staging.yml:184-186",
     ".github/workflows/ci.yml:181-184",
     "infrastructure/docker/docker-compose.yml:50-52",
     "infrastructure/docker/docker-compose.prod.yml:45-47",
     "infrastructure/kubernetes/configmap.yaml:57-68"
    ]
   }
```

### P3. T-374

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** Item object at lines 2253-2274 ("id": "T-374" at 2254, "status" at 2256). Closure block inserts after the "sources" array closes at 2273.
- **Proof in tree:** `docs/deployment/local-setup.md:153-156 (dated removal note) + start.sh:108 and start.ps1:125 (bare origin, no /api/v1 suffix) + docs/deployment/local-setup.md:170`

**Current text**

```
   "id": "T-374",
   "title": "Fix stale local-setup.md env instructions (NEXT_PUBLIC_USE_MOCK, NEXT_PUBLIC_WS_URL)",
   "status": "open",
   ... (no "closure" block on the object)
```

**Proposed text**

```
Flip "status": "open" -> "status": "closed" and append, after the "sources" array:

   "closure": {
    "status_was": "open",
    "closed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "reason": "ALREADY DONE, including the residue the 2026-09-11 sweep filed this as PARTIAL for. The frontend env table (docs/deployment/local-setup.md:144-151) is rewritten from CLAUDE.md and lists DATABASE_URL, AUTH_SECRET, FN_ALLOW_LOCAL_USER, NEXT_PUBLIC_API_URL (marked read by nothing), ANTHROPIC_API_KEY and FMP_API_KEY; both dead variables are recorded as removed in the dated note at :153-156. The USE_MOCK troubleshooting line is gone - :170 now reads 'Frontend auth redirect loop: Not reachable at present'. Both bootstrap scripts were fixed the better way: they copy frontend/.env.example (start.sh:93-95, start.ps1:110-112) and their minimal fallback writes the BARE origin NEXT_PUBLIC_API_URL=http://localhost:8000 (start.sh:108, start.ps1:125), so the 'doubled /api/v1 suffix in both start scripts' residue is cured too, as are the 'mock data enabled' echoes (both now say 'there is no mock data path'). The 09-11 PARTIAL verdict is overtaken, not wrong on its date.",
    "approved_by": "PENDING - steward sweep 2026-09-21, awaiting owner approval",
    "evidence": [
     "docs/deployment/local-setup.md:144-156",
     "docs/deployment/local-setup.md:170",
     "start.sh:93-112",
     "start.ps1:109-128",
     "frontend/.env.example (present)"
    ]
   }
```

### P4. T-380

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** Item object at lines 2315-2336 ("id": "T-380" at 2316, "status" at 2318). Closure block inserts after the "sources" array closes at 2335.
- **Proof in tree:** `README.md:22 (row struck, 'Moved to a separate product, 2026-08-20') + README.md:9 + docs/ROADMAP.md:30-34`

**Current text**

```
   "id": "T-380",
   "title": "Update README suite table — Budgeting & Planning no longer planned",
   "status": "open",
   ... (no "closure" block on the object)
```

**Proposed text**

```
Flip "status": "open" -> "status": "closed" and append, after the "sources" array:

   "closure": {
    "status_was": "open",
    "closed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "reason": "ALREADY DONE on all three targets. README.md:9 drops the 'on the roadmap' clause and names only the four shipped modules plus Portfolio Builder. README.md:22 replaces the planned row with a struck one: '~~Budgeting & Planning~~ | ... | Moved to a separate product, 2026-08-20' plus the retained-DB-tables note and the RP-2 reopen-trigger pointer. docs/ROADMAP.md was handled correctly as a record rather than rewritten - line 18 ('Budget & Plan ... New') is kept verbatim as the original framing and the dated block at :20-34 carries the status, including the retained tables and the Retirement Planner going with it. Sibling ledger note: the README's own suite-table sibling, T-381, was closed on 2026-09-20 by the same doc-accuracy sweep; this item was left open only because nobody wrote its closure block.",
    "approved_by": "PENDING - steward sweep 2026-09-21, awaiting owner approval",
    "evidence": [
     "README.md:9",
     "README.md:22",
     "docs/ROADMAP.md:20-34"
    ]
   }
```

### P5. T-334

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** Item object at lines 2092-2119 ("id": "T-334" at 2093, "status" at 2095). Closure block inserts after the "sources" array closes at 2118.
- **Proof in tree:** `frontend/src/app/providers.tsx:65 (<SessionProvider> wraps the tree; imported at :5, closed at :86) + zero useAuthStore hits under frontend/src + docs/architecture/auth.md:21-25`

**Current text**

```
   "id": "T-334",
   "title": "Refresh auth.md — useAuthStore no longer exists, SessionProvider already added",
   "status": "open",
   ... (no "closure" block on the object)
```

**Proposed text**

```
Flip "status": "open" -> "status": "closed" and append, after the "sources" array:

   "closure": {
    "status_was": "open",
    "closed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "reason": "ALREADY DONE, and the tree confirms both halves rather than the doc asserting them. The switches table (docs/architecture/auth.md:13-19) is introduced as 'Two switches' and carries only REQUIRE_AUTH and LOGIN_DISABLED; the dated note at :21-25 records the removed useAuthStore row and why a table naming an absent file is harmful. Goal B step 2 is struck and marked DONE (5e1c32a) at :116-122, explicitly noting the store was DELETED rather than rewired, with steps 1, 3, 4 and 5 left deferred - so the owner's 'do not re-enable without asking' deferral is intact. Verified in the tree, not from the doc: frontend/src contains no reference to useAuthStore at all, and SessionProvider is imported at frontend/src/app/providers.tsx:5 and actually wraps the tree at :65-86. SIBLING STILL STALE: docs/ROADMAP.md:158-159 still plans a 'session-aware useAuthStore' - a separate proposal annotates it.",
    "approved_by": "PENDING - steward sweep 2026-09-21, awaiting owner approval",
    "evidence": [
     "frontend/src/app/providers.tsx:5,65,86",
     "frontend/src (zero useAuthStore references)",
     "docs/architecture/auth.md:13-25",
     "docs/architecture/auth.md:116-122"
    ]
   }
```

### P6. T-370 (sibling)

- **Ledger:** `docs/deployment/aws-provisioning.md`
- **Where:** Lines 219-222, closing paragraph of the "What was fixed" section
- **Proof in tree:** `.github/workflows/cd-staging.yml:184-186 (no WS_URL in build-args) and .github/workflows/cd-staging.yml:185 (the surviving /api suffix)`

**Current text**

```
**Not fixed, flagged instead:** `cd-staging.yml` still passes a
`NEXT_PUBLIC_WS_URL` build arg, but the app opens no socket and that variable was removed
in the M8 sweep (`CLAUDE.md`, Environment Variables). It is inert rather than wrong, and
removing it belongs with a frontend change, not this one.
```

**Proposed text**

```
Keep the paragraph verbatim (it records what the 2026-08-07 pass chose not to fix) and append a dated banner immediately below it, in the docs/runbooks/backup-restore.md format:

> **Overtaken 2026-09-21 — this one WAS fixed.** `cd-staging.yml` no longer passes a
> `NEXT_PUBLIC_WS_URL` build arg: `cd-staging.yml:184-186` passes only
> `NEXT_PUBLIC_API_URL` and `NEXT_TELEMETRY_DISABLED`. The variable is absent from
> `ci.yml`, `cd-production.yml`, both `infrastructure/docker/docker-compose*.yml`
> and `infrastructure/kubernetes/configmap.yaml` as well (queue item T-370). The
> paragraph above is kept as the record of what this runbook's own pass deferred.
>
> ⚠ A different suffix defect is still live in the same block: `cd-staging.yml:185`
> builds with `NEXT_PUBLIC_API_URL=https://staging.financenow.example.com/api`. The
> ConfigMap comment (`infrastructure/kubernetes/configmap.yaml:64-66`) states the rule
> — **origin only, no `/api` or `/api/v1` suffix**, because a suffix plus an appended
> `/api/:path` is what produced `/api/v1/api/...`. Inert today (D2 removed the rewrite
> and nothing reads the variable), but it is the trap re-armed for whoever restores a
> proxy.
```

### P7. T-334 (sibling)

- **Ledger:** `docs/ROADMAP.md`
- **Where:** Phase 0 — Foundation, lines 155-164; the stale line is 158-159, the annotation goes after the "Done when" at 163-164
- **Proof in tree:** `frontend/src/app/providers.tsx:65 + docs/architecture/auth.md:116-122 ("DONE (`5e1c32a`) … the store was deleted rather than rewired")`

**Current text**

```
- Auth.js (credentials now; OAuth later) replacing the mock login;
  session-aware `useAuthStore`.
```

**Proposed text**

```
Keep lines 155-164 verbatim and insert a dated block immediately after the "Done when" sentence, matching the annotation style already used on Phase 1 (:167) and Phase 2 (:207):

> **Note (2026-09-21) — the auth bullet describes an approach that was not taken.**
> `useAuthStore` was **deleted**, not made session-aware: M2 (`5e1c32a`) consolidated
> authentication onto Auth.js, and `frontend/src` contains no reference to the store
> today. `SessionProvider` wraps the tree at `frontend/src/app/providers.tsx:65`, and
> the session is read through `next-auth/react`'s `useSession()` and
> `getCurrentUserId()` (`lib/auth/session.ts`). See `docs/architecture/auth.md:21-25`
> and its Goal B step 2.
>
> This annotates the bullet only. **Phase 0 is NOT being marked done here** — its
> "Done when" includes "log in", and the login wall is deliberately OFF
> (`REQUIRE_AUTH = false`, `LOGIN_DISABLED = true`), so that condition is unmet by
> owner decision rather than by omission.
```

### P8. T-072

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item T-072 — id at line 1119, status at line 1121, sources array closes at line 1139
- **Proof in tree:** `frontend/src/app/(dashboard)/funds/FundsClient.tsx:366`

**Current text**

```
   "status": "open",
```

**Proposed text**

```
KEEP "status": "open" (promotion to "closed" is the owner's act, per annotations.basis_key). INSERT after the item's sources array (after line 1139, before the object's closing brace):

   ,
   "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "pending_owner_approval": true,
    "reason": "ALREADY DONE — the effect is gone, not merely silenced. FundsClient.tsx:3 imports only { useMemo, useState }; the file contains no useEffect call at all, so the react-hooks/set-state-in-effect rule has nothing to fire on. Pagination is now DERIVED from a filter/sort signature: pageState holds { sig, page } (:191), filterSig is rebuilt each render (:365), page = pageState.sig === filterSig ? pageState.page : 0 (:366), and setPage re-stamps the signature (:367). The comment at :186-190 records why the effect was removed rather than rewritten (it reset a render late, painting an empty table for one frame). CAVEAT: `npm run lint` was not run in this pass, so the item's literal acceptance line ('0 warnings for the file') is unverified for OTHER rules; the setState-in-effect warning specifically is structurally impossible now.",
    "evidence": [
     "frontend/src/app/(dashboard)/funds/FundsClient.tsx:3 (no useEffect import)",
     "frontend/src/app/(dashboard)/funds/FundsClient.tsx:186-191 (comment + pageState)",
     "frontend/src/app/(dashboard)/funds/FundsClient.tsx:365-367 (derived page reset)"
    ]
   }
```

### P9. T-259

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item T-259 — id at line 1754, status at line 1756, sources array closes at line 1771
- **Proof in tree:** `frontend/src/app/live-data/wallet/xrp/route.ts:33`

**Current text**

```
   "status": "open",
```

**Proposed text**

```
KEEP "status": "open". INSERT after the item's sources array (after line 1771):

   ,
   "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "pending_owner_approval": true,
    "reason": "ALREADY DONE, and for all five wallet routes rather than XRP alone — which is what the item's own next_action asked for. lib/server/walletFetch.ts:14 exports WALLET_FETCH_TIMEOUT_MS = 5_000. Each of wallet/btc, /eth, /sol, /tron and /xrp makes exactly one upstream fetch and each passes signal: AbortSignal.timeout(WALLET_FETCH_TIMEOUT_MS) on it (XRP at live-data/wallet/xrp/route.ts:33). The structured envelope on abort is also wired, not just the signal: xrp/route.ts:64 returns { ok: false, error: walletFetchErrorMessage(err) } with status 502, and walletFetch.ts:43-46 turns the runtime-varying DOMException into 'Upstream did not respond within 5s'. The helper's own comment (:3-13) cites the 2026-07-27 app-audit 10.2s observation this item derives from.",
    "evidence": [
     "frontend/src/lib/server/walletFetch.ts:14",
     "frontend/src/lib/server/walletFetch.ts:43-46",
     "frontend/src/app/live-data/wallet/xrp/route.ts:33, :64",
     "frontend/src/app/live-data/wallet/{btc,eth,sol,tron}/route.ts — one AbortSignal.timeout each, one fetch each"
    ]
   }
```

### P10. T-262

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item T-262 — id at line 1774, status at line 1776, sources array closes at line 1793
- **Proof in tree:** `frontend/src/lib/data/transferFees.ts:1907`

**Current text**

```
   "status": "open",
```

**Proposed text**

```
KEEP "status": "open". INSERT after the item's sources array (after line 1793):

   ,
   "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "pending_owner_approval": true,
    "reason": "ALREADY DONE — computeSegmentOptions and the SegmentOption type are absent from frontend/src entirely. A repo-wide search finds the name only in prose: docs/assessments/T8-transfer-fees-audit.md:120, docs/audits/queue-verification-2026-09-10.md:25 and this queue file. transferFees.ts is now 2,166 lines — shorter than the 2,207 the item's summary cites — and its last export is findTransferPaths() at :1907.",
    "evidence": [
     "frontend/src/lib/data/transferFees.ts:1907 (last export; file ends at 2166 with no computeSegmentOptions)",
     "repo-wide search for computeSegmentOptions / SegmentOption — zero hits under frontend/src"
    ]
   }
```

### P11. T-267

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item T-267 — id at line 1796, status at line 1798, sources array closes at line 1815
- **Proof in tree:** `frontend/src/app/(dashboard)/technical-analysis/page.tsx:191`

**Current text**

```
   "status": "open",
```

**Proposed text**

```
KEEP "status": "open". INSERT after the item's sources array (after line 1815):

   ,
   "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "pending_owner_approval": true,
    "reason": "ALREADY DONE, and the whole path is connected end to end rather than merely present. PRODUCER: live-data/ohlcv/route.ts:253-254 returns source: 'binance' AND venue: host.includes('binance.us') ? 'binance-us' : 'binance-com'. CONSUMER: technical-analysis/page.tsx:32 imports ohlcvSourceLabel, :191 calls ohlcvSourceLabel(data?.source, data?.venue), and :389-390 feeds the result into the DataBadge as `${ohlcvSource} OHLCV`. MAPPING: lib/utils/ohlcvSource.ts:12-22 returns 'Binance.US' for venue 'binance-us', unit-tested at lib/utils/__tests__/ohlcvSource.test.ts:6-7. The same helper is reused by the agent tool at lib/agents/tools.ts:556, so the API surface inherits the fix. The item's second half also holds: neither the /scanner nor the /technical-analysis page contains a hardcoded 'Binance' string.",
    "evidence": [
     "frontend/src/app/live-data/ohlcv/route.ts:253-254",
     "frontend/src/app/(dashboard)/technical-analysis/page.tsx:191, :389-390",
     "frontend/src/lib/utils/ohlcvSource.ts:12-22",
     "frontend/src/lib/utils/__tests__/ohlcvSource.test.ts:6-7",
     "frontend/src/lib/agents/tools.ts:556"
    ]
   }
```

### P12. T-268

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item T-268 — id at line 1818, status at line 1820, sources array closes at line 1837
- **Proof in tree:** `frontend/src/app/live-data/ohlcv/route.ts:107-112`

**Current text**

```
   "status": "open",
```

**Proposed text**

```
KEEP "status": "open". INSERT after the item's sources array (after line 1837):

   ,
   "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "pending_owner_approval": true,
    "reason": "ALREADY DONE, and the replacement comment is accurate against the config it annotates — checked, not assumed. live-data/ohlcv/route.ts:107-112 now reads: 'Cap only. CoinGecko's /ohlc?days=1 returns 30-minute candles covering one day — about 48 bars — so this slice never actually trims. It is a ceiling against a provider that starts serving more, not a window: 168 x 30m would be 3.5 days, not the week an earlier comment here claimed. (The Binance rung is unaffected; it asks for 168 x 1h bars directly.)'. Cross-checked against RANGES['1H'] at :48 — { cgDays: '1', resample: 'none', candleSize: '30m', binanceInterval: '1h', binanceLimit: 168 } — and against the line the comment sits above, :113 `if (cfg.cgDays === '1') return candles.slice(-168)`. Both halves of the comment's arithmetic hold. Docs-only item; nothing else to do.",
    "evidence": [
     "frontend/src/app/live-data/ohlcv/route.ts:107-112 (the reworded comment)",
     "frontend/src/app/live-data/ohlcv/route.ts:48 (RANGES['1H'])",
     "frontend/src/app/live-data/ohlcv/route.ts:113 (the slice it annotates)"
    ]
   }
```

### P13. T-350

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item T-350 — id at line 2143, status at line 2145, sources array closes at line 2162
- **Proof in tree:** `frontend/src/lib/utils/pegFormat.ts:22`

**Current text**

```
   "status": "open",
```

**Proposed text**

```
KEEP "status": "open". INSERT after the item's sources array (after line 2162):

   ,
   "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "basis": "verified-here",
    "verdict": "close",
    "pending_owner_approval": true,
    "reason": "ALREADY DONE, including the import updates the item asked for. The function is declared at lib/utils/pegFormat.ts:22 and ALL THREE consumers import it from there: app/(dashboard)/assets/[id]/page.tsx:50, components/assets/AssetCard.tsx:7, components/assets/AssetTable.tsx:10 — no consumer still reaches through lib/utils/risk.ts. risk.ts holds no such function; :10-13 is a note recording the move and its reasoning. A dedicated test file exists at lib/utils/__tests__/pegFormat.test.ts. SIBLING ALREADY CLEAN: docs/architecture/risk-scale-spec.md carries the move in its 2026-09-08 post-implementation block at :355-357, so its design text at :367 is already covered and needs no annotation.",
    "evidence": [
     "frontend/src/lib/utils/pegFormat.ts:22",
     "frontend/src/lib/utils/risk.ts:10-13 (note only)",
     "frontend/src/app/(dashboard)/assets/[id]/page.tsx:50; components/assets/AssetCard.tsx:7; components/assets/AssetTable.tsx:10",
     "docs/architecture/risk-scale-spec.md:355-357 (sibling already annotated)"
    ]
   }
```

### P14. T-267 / T-268 (sibling annotation)

- **Ledger:** `docs/assessments/T10-crypto-ta-audit.md`
- **Where:** Under the heading '## Minor observations (not bugs; no action taken here)' at line 61 — insert as a block at line 62, above the two bullets at :63-70
- **Proof in tree:** `frontend/src/app/live-data/ohlcv/route.ts:254`

**Current text**

```
## Minor observations (not bugs; no action taken here)

- **Provenance label reads "Binance" for what is really Binance.US.** The chart's `DataBadge`
```

**Proposed text**

```
## Minor observations (not bugs; no action taken here)

> **⚠ OUTCOME (added 2026-09-21) — the first two observations below have since been
> fixed. The text is left exactly as written.** The `DataBadge` no longer says
> "Binance" for Binance.US: `/live-data/ohlcv` now emits a `venue` field
> (`frontend/src/app/live-data/ohlcv/route.ts:253-254`) and the page derives the
> label from it via `ohlcvSourceLabel(data?.source, data?.venue)`
> (`technical-analysis/page.tsx:191`; badge at `:389-390`; mapping and tests in
> `lib/utils/ohlcvSource.ts:12-22`). The `1H` route comment was reworded
> (`ohlcv/route.ts:107-112`) and now states the real window — the `slice(-168)` is a
> cap that never trims, not "last week of 30m bars". Tracked as queue items T-267
> and T-268. The third bullet (confluence thresholds) is untouched and still stands.

- **Provenance label reads "Binance" for what is really Binance.US.** The chart's `DataBadge`
```

### P15. T-262 (sibling annotation)

- **Ledger:** `docs/assessments/T8-transfer-fees-audit.md`
- **Where:** Line 120 — insert the block immediately after it
- **Proof in tree:** `frontend/src/lib/data/transferFees.ts:1907`

**Current text**

```
Also noted: `computeSegmentOptions()` is dead code (its custom-route-builder consumer is gone).
```

**Proposed text**

```
Also noted: `computeSegmentOptions()` is dead code (its custom-route-builder consumer is gone).

> **⚠ OUTCOME (added 2026-09-21) — `computeSegmentOptions()` has since been deleted.**
> It and its `SegmentOption` type are absent from `frontend/src` entirely;
> `transferFees.ts` is now 2,166 lines (the item that tracked this cited `:2207`)
> and its last export is `findTransferPaths()` at `:1907`. The line above is left
> as written — it records what was found on the audit date. Tracked as queue item
> T-262.
```

### P16. sweep bookkeeping (all six)

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** annotations.passes array — opens at line 34235, last entry closes at line 34282; append as a new element before the closing ']' at line 34283
- **Proof in tree:** `docs/audits/task-queue-2026-09-07.json:34282 — bookkeeping entry; the tree proof for each closure is carried on its own item above`

**Current text**

```
     ".github/workflows/archive-branch.yml"
    ]
   }
  ]
 }
}
```

**Proposed text**

```
     ".github/workflows/archive-branch.yml"
    ]
   },
   {
    "on": "2026-09-21",
    "what": "6 closures PROPOSED from a checklist-steward sweep — T-072, T-259, T-262, T-267, T-268, T-350 — each re-verified first-hand in the tree, plus two dated annotations on the assessments that originated them (T8 for T-262, T10 for T-267/T-268)",
    "basis_key": "proposed_closure.pending_owner_approval = true means the evidence is recorded but the owner has NOT approved the close. Statuses were left at 'open'; promotion is the owner's act.",
    "caveat": "All six were ALREADY recorded as verified-closed by the 2026-09-10, 09-11 and 09-13 passes, and none of those closures ever reached this file's `status` fields. 43 of the 62 items queue-closure-review-2026-09-13.md re-verified on main@55a4b52 still read \"status\": \"open\" here. These six are the ones re-verified in THIS pass; the other 37 are unswept, not cleared, and should not be closed on the strength of this entry.",
    "evidence": [
     "docs/audits/queue-verification-2026-09-10.md",
     "docs/audits/queue-verification-sweep-2026-09-11.md",
     "docs/audits/queue-closure-review-2026-09-13.md"
    ]
   }
  ]
 }
}
```

### P17. T-156

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[9] — the T-156 item object (no `closure` or `proposed_closure` key exists on it today)
- **Proof in tree:** `frontend/src/lib/data/dataSources.ts:239 (registry note) proven against frontend/src/app/live-data/social/route.ts:345-348, :408-410, :462`

**Current text**

```
  "id": "T-156",
  "title": "Verify which /social signals are live vs derived",
  "status": "open",
```

**Proposed text**

```
Keep `"status": "open"` until the owner approves, then set it to "closed". Add this key to the item object (same shape as the 2026-09-19 pass documented in `annotations.passes`):

  "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "basis": "verified-here",
    "verdict": "close",
    "reason": "DONE. frontend/src/lib/data/dataSources.ts:239 now states the live/derived split AND separates the three derived sentiment labels instead of calling all of them a keyword classifier — the note says so in as many words ('this note used to call all of them a keyword classifier over the post text, which is true only of Reddit and quietly vouched for the other two'). Each claim checked against the route, not the note: Reddit's label is two regexes over the post's own text (live-data/social/route.ts:345-348, comment at :339-343); LunarCrush's is a galaxy-score threshold >=60 positive / <=35 negative (:408-410) and NOT the provider's own `sentiment` field, which the route does receive and print in the body line (:417) but never classifies on; Santiment's is hardcoded 'neutral' on every point (:462); Reddit `score` is a literal 0 sentinel and `upvoteRatio` is never set (:358-364). The generator was run — DATA-SOURCES.md:62 carries the regenerated copy verbatim, so the committed copy matches the registry. Siblings already agree and need no change: CLAUDE.md:1238 and DATA-AVAILABILITY.md:47 + :688. NOTE ON THIS ITEM'S OWN CITATION: its source quotes CLAUDE.md:716 as reading '/live-data/social — verify which signals are live vs derived'. That text exists nowhere in CLAUDE.md today; the row is at :1238. Another instance of the line-number drift this snapshot's annotations caveat already warns about.",
    "evidence": [
      "frontend/src/lib/data/dataSources.ts:239",
      "frontend/src/app/live-data/social/route.ts:345-348, :358-364, :408-410, :417, :462",
      "DATA-SOURCES.md:62 (generated copy in sync)",
      "CLAUDE.md:1238",
      "DATA-AVAILABILITY.md:47, :688"
    ]
  }
```

### P18. T-269

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[27] — the T-269 item object (no `closure` or `proposed_closure` key exists on it today)
- **Proof in tree:** `frontend/src/lib/utils/confluence.ts:36-46 called from frontend/src/components/analytics/technical/MultiTimeframeGrid.tsx:78, rendered at frontend/src/app/(dashboard)/technical-analysis/page.tsx:406`

**Current text**

```
  "id": "T-269",
  "title": "Make multi-timeframe confluence thresholds proportional",
  "status": "open",
```

**Proposed text**

```
Keep `"status": "open"` until the owner approves, then set it to "closed". Add:

  "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "basis": "verified-here",
    "verdict": "close",
    "reason": "DONE, and the connected path — not just the pieces — was followed. The function was extracted to a pure module exactly as next_action asked: frontend/src/lib/utils/confluence.ts:17-20 defines CONFLUENCE_STRONG_RATIO = 0.75, CONFLUENCE_MODERATE_RATIO = 0.6 and CONFLUENCE_MIN_LOADED = 3, and :36-46 bands on bullish/loadedCount rather than on an absolute count. The caller is live: components/analytics/technical/MultiTimeframeGrid.tsx:78 calls confluenceLabel(loaded.length, bullish, bearish) where `loaded` (:74) is the timeframes that actually answered, and that panel is rendered by app/(dashboard)/technical-analysis/page.tsx:406. The unit test next_action asked for exists and pins both readings the absolute form got backwards: a unanimous 3/3 is 'strong' and 4/6 is 'moderate' (lib/utils/__tests__/confluence.test.ts:17-24), picked up by vitest.config.ts:18 include. The suite was NOT run in this pass (instructed not to); this is a source reading.",
    "evidence": [
      "frontend/src/lib/utils/confluence.ts:17-20, :36-46",
      "frontend/src/components/analytics/technical/MultiTimeframeGrid.tsx:74-78",
      "frontend/src/app/(dashboard)/technical-analysis/page.tsx:406",
      "frontend/src/lib/utils/__tests__/confluence.test.ts:17-24",
      "docs/assessments/T10-crypto-ta-audit.md:71-73 (annotated 2026-09-21 in the same batch)"
    ]
  }
```

### P19. T-269

- **Ledger:** `docs/assessments/T10-crypto-ta-audit.md`
- **Where:** ## Minor observations (not bugs; no action taken here) — the third bullet, lines 71-73
- **Proof in tree:** `frontend/src/lib/utils/confluence.ts:17-20`

**Current text**

```
- **Confluence thresholds** (`bullish >= 4 / >= 3`) are absolute rather than proportional to
  the number of timeframes that loaded — slightly conservative when few TFs return, harmless
  at full load.
```

**Proposed text**

```
Leave the three lines above byte-identical and insert this dated block immediately after them (assessments are annotated, never rewritten):

  > **Status: ✅ fixed — annotation added 2026-09-21 (queue item T-269).** The thresholds
  > are proportional now, and the function was extracted so it could be tested.
  > `frontend/src/lib/utils/confluence.ts:17-20` defines `CONFLUENCE_STRONG_RATIO = 0.75`,
  > `CONFLUENCE_MODERATE_RATIO = 0.6` and `CONFLUENCE_MIN_LOADED = 3`; `:36-46` bands on
  > `bullish / loadedCount`. The live caller is
  > `components/analytics/technical/MultiTimeframeGrid.tsx:78`, passing the count of
  > timeframes that actually answered (`:74`), and that panel is rendered by
  > `app/(dashboard)/technical-analysis/page.tsx:406`. This observation called the absolute
  > form "harmless at full load"; it was not — 4 of 6 (67%) read *strong* while a unanimous
  > 3 of 3 read *moderate*, so the weaker agreement got the stronger word. Both are now
  > pinned as tests (`lib/utils/__tests__/confluence.test.ts:17-24`).
```

### P20. T-273

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[29] — the T-273 item object (no `closure` or `proposed_closure` key exists on it today)
- **Proof in tree:** `frontend/src/lib/utils/ohlcvAdjust.ts:46, reached from frontend/src/app/live-data/security-ohlcv/route.ts:89`

**Current text**

```
  "id": "T-273",
  "title": "Adjust volume across splits in adjustCandles",
  "status": "open",
```

**Proposed text**

```
Keep `"status": "open"` until the owner approves, then set it to "closed". Add:

  "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "basis": "verified-here",
    "verdict": "close",
    "reason": "DONE, all three halves of next_action. (1) frontend/src/lib/utils/ohlcvAdjust.ts:46 — `const volume = Number.isFinite(c.volume) ? c.volume / f : c.volume`, i.e. the inverse of the price factor f = adj / close, so a 4:1 split that quarters price quadruples share volume instead of leaving a 4x cliff. Non-finite volume passes through, so a provider that omits it cannot become NaN. (2) The reasoning and its known limit are stated in the module docblock (:16-29): adjClose folds dividends in with splits and cannot be separated from this input, so the correction also picks up a smooth dividend drift of roughly a yield per year — a few percent tilt against the 4x step it removes. That is a disclosed limitation, not a silent one. (3) The test exists: __tests__/ohlcvAdjust.test.ts:68-107, including the exact 4:1 case next_action named (:69-87, asserting the pre/post-split volume ratio sits inside 0.9-1.1 where it was 4). Connected path confirmed — the only caller is app/live-data/security-ohlcv/route.ts:89, which is the route every equity/fund/macro TA, backtest and candlestick surface reads. Suite NOT run (instructed not to); source reading only.",
    "evidence": [
      "frontend/src/lib/utils/ohlcvAdjust.ts:46, docblock :16-29",
      "frontend/src/app/live-data/security-ohlcv/route.ts:89",
      "frontend/src/lib/utils/__tests__/ohlcvAdjust.test.ts:68-107",
      "docs/assessments/T11-equity-ta-audit.md:72-75 (annotated 2026-09-21 in the same batch)"
    ]
  }
```

### P21. T-273

- **Ledger:** `docs/assessments/T11-equity-ta-audit.md`
- **Where:** ## Observations (reported, not changed) — second bullet, lines 72-75
- **Proof in tree:** `frontend/src/lib/utils/ohlcvAdjust.ts:46`

**Current text**

```
- **Volume is left unadjusted across splits.** `adjustCandles` rescales price only; a split
  still steps volume (e.g. ×4 more shares post-split). Price is what makes indicators read a
  crash, so this is the right priority; volume-based indicators (VWAP, volume panel) see a step
  at the split date. Minor; documented.
```

**Proposed text**

```
Leave the four lines above byte-identical and insert this dated block immediately after them. (T-273's next_action says "strike the T11 observation" — do NOT strike it; assessments are annotated, never rewritten, and the struck-through form belongs to ROADMAP, not to an assessment.)

  > **Status: ✅ fixed — annotation added 2026-09-21 (queue item T-273).** `adjustCandles`
  > now scales volume by the inverse of the price factor:
  > `frontend/src/lib/utils/ohlcvAdjust.ts:46` —
  > `const volume = Number.isFinite(c.volume) ? c.volume / f : c.volume` (`f = adjClose /
  > close`). A 4:1 split therefore leaves share volume continuous instead of stepping ×4,
  > pinned at `__tests__/ohlcvAdjust.test.ts:69-87`. The fix reaches every surface through
  > the single caller, `app/live-data/security-ohlcv/route.ts:89`. One limitation is stated
  > rather than hidden (module docblock `:16-29`): `adjClose` folds dividends in with
  > splits and they cannot be separated from this input, so the volume correction also
  > carries a smooth drift of roughly a dividend yield per year on older bars — a few
  > percent tilt, against the ×4 step it removes. A smooth tilt fires no signal; the step
  > did. Volume passing through untouched when it is not a finite number is deliberate.
```

### P22. T-104

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[5] — the T-104 item object (no `closure` or `proposed_closure` key exists on it today)
- **Proof in tree:** `frontend/src/lib/utils/__tests__/signalSummary.test.ts:68-75 pinning frontend/src/lib/utils/indicators.ts:1417-1423`

**Current text**

```
  "id": "T-104",
  "title": "E-note-6 — correctness-of-aggregation test for TA signal-summary vote weighting",
  "status": "open",
```

**Proposed text**

```
Keep `"status": "open"` until the owner approves, then set it to "closed". Add:

  "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "basis": "verified-here",
    "verdict": "close",
    "reason": "DONE, with one deliberate and documented deviation from next_action's wording. The file exists at the path next_action named — frontend/src/lib/utils/__tests__/signalSummary.test.ts, 147 lines, header naming E-note-6 — and vitest.config.ts:18 (`include: ['src/**/*.{test,spec}.{ts,tsx}']`) picks it up. DEVIATION: next_action asked for assertions 'against hand-computed expectations'. The test does not hand-compute the ~25 indicator values; its header (:5-15) says why — that would test the indicator library rather than the fold — and instead recomputes the reported numbers from the signal list the same call produced. That is not a tautology, because the test encodes the fold's RULES independently of the implementation and would fail if the implementation changed: :68-75 hard-codes the weight map and the load-bearing NON-NEUTRAL denominator that indicators.ts:1417-1423 uses; :58-65 recomputes buy/sell with the strong variants folded in; :81-88 hard-codes the +-1.5 / +-0.5 band boundaries against indicators.ts:1429-1432. It also pins live behaviour that a widened band would break (an uptrend correctly reporting 'neutral' at score < 0.5, :117-129) and a flat series reporting no conviction (:140-146). Both the uptrend and downtrend mirrors requested by next_action are present (:40-41). The suite was NOT run (instructed not to), so this closes the item on the test EXISTING and being structurally able to fail, not on a green run.",
    "evidence": [
      "frontend/src/lib/utils/__tests__/signalSummary.test.ts:1-147",
      "frontend/src/lib/utils/indicators.ts:1417-1432 (the fold this pins)",
      "frontend/vitest.config.ts:18",
      "docs/assessments/P3-production-review.md:392-394 (annotated 2026-09-21 in the same batch)"
    ]
  }
```

### P23. T-104

- **Ledger:** `docs/assessments/P3-production-review.md`
- **Where:** Equities notes list, note 6, lines 392-394
- **Proof in tree:** `frontend/src/lib/utils/__tests__/signalSummary.test.ts:68-88`

**Current text**

```
6. Signal-summary vote weighting and pattern detection have degenerate-input tests
   only; underlying indicator math is heavily tested. Correctness-of-aggregation test
   is a nice-to-have, not a blocker.
```

**Proposed text**

```
Leave the finding text byte-identical and append the dated parenthetical in the same italic form note 4 of this list already uses (:381-387) — this is the status half, which the charter carve-out puts in the steward's hands, not the finding half:

6. Signal-summary vote weighting and pattern detection have degenerate-input tests
   only; underlying indicator math is heavily tested. Correctness-of-aggregation test
   is a nice-to-have, not a blocker.
   *(Closed 2026-09-21 — queue item T-104. `lib/utils/__tests__/signalSummary.test.ts`
   (147 lines) now pins the AGGREGATION rather than the indicator math: the weight map
   and the non-neutral denominator at `:68-75`, the strong-variant fold at `:58-65`, and
   the ±1.5/±0.5 band boundaries at `:81-88`, each hard-coded against
   `indicators.ts:1417-1432`. It also pins two live behaviours worth keeping: a 0.5%/bar
   advance correctly reports **neutral** because the trend indicators and the
   mean-reversion oscillators disagree (`:117-129`), and a flat series reports no
   conviction (`:140-146`). Pattern detection's own tests are unchanged and are not part
   of this closure. The dated 2026-08-16 sweep block at `:360-366` still lists 6 as
   "still open" and is left as written — same treatment note 4 records for itself.)*
```

### P24. T-256

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[21] — the T-256 item object (no `closure` or `proposed_closure` key exists on it today)
- **Proof in tree:** `frontend/package.json:20`

**Current text**

```
  "id": "T-256",
  "title": "Add a test:coverage script",
  "status": "open",
```

**Proposed text**

```
Keep `"status": "open"` until the owner approves, then set it to "closed". Add:

  "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "basis": "verified-here",
    "verdict": "close",
    "reason": "DONE, and more completely than next_action asked. frontend/package.json:20 carries `\"test:coverage\": \"vitest run --coverage\"` and :83 `\"@vitest/coverage-v8\": \"^3.2.6\"` in devDependencies; the package is actually installed (frontend/node_modules/@vitest/coverage-v8/package.json present), so the script can run rather than merely existing. Beyond the ask, frontend/vitest.config.ts:20-41 configures it: provider v8, text+html reporters, and an `include` scoped to the five lib layers the repo's testing convention targets (data, risk, utils, server, technicals) with a comment explaining that measuring pages and route handlers would bury the signal under JSX nobody intends to unit-test. It sets NO thresholds, deliberately, with the reasoning written in place (:37-40) — a failing threshold would block a fix for arriving without a test while saying nothing about whether the covered lines carry a user-facing number. Not run in this pass (instructed not to). Separately, and NOT part of this item: `test:coverage` appears in no workflow under .github/workflows/, so coverage is reportable on demand but is not produced by CI.",
    "evidence": [
      "frontend/package.json:20, :83",
      "frontend/vitest.config.ts:20-41",
      "frontend/node_modules/@vitest/coverage-v8/package.json (installed)",
      "docs/audits/2026-07-30-audit.md:122 (annotated 2026-09-21 in the same batch)"
    ]
  }
```

### P25. T-256

- **Ledger:** `docs/audits/2026-07-30-audit.md`
- **Where:** ## Checks that could not be run — third bullet, line 122
- **Proof in tree:** `frontend/package.json:20 and frontend/vitest.config.ts:20-41`

**Current text**

```
- **Test coverage** — not recorded. `npm test` is `vitest run` with no `--coverage` flag, so the run reports pass/fail only. There is no `test:coverage` script in `package.json`.
```

**Proposed text**

```
Leave line 122 byte-identical (dated audit record) and insert this block immediately after it:

  > **Status: ✅ resolved — annotation added 2026-09-21 (queue item T-256).** A coverage
  > script now exists: `frontend/package.json:20` — `"test:coverage": "vitest run
  > --coverage"` — with `@vitest/coverage-v8` at `:83` and installed. `vitest.config.ts:20-41`
  > scopes it to `src/lib/{data,risk,utils,server,technicals}` and sets **no thresholds**,
  > both with the reasoning written in place: coverage over pages and route handlers would
  > bury the signal this audit wanted, and a threshold gate blocks a fix for arriving
  > without a test while saying nothing about whether the covered lines carry a
  > user-facing number. ⚠ Still true from this audit's point of view: **CI does not run
  > it.** `test:coverage` appears in no file under `.github/workflows/`, so the number is
  > available on demand and is not recorded per-run.
```

### P26. T-277

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[30] — the T-277 item object (no `closure` or `proposed_closure` key exists on it today)
- **Proof in tree:** `mcp-server/src/index.ts:372 (tombstone comment; the tool is absent), corroborated at frontend/src/app/api/v1/staking/opportunities/route.ts:156`

**Current text**

```
  "id": "T-277",
  "title": "5b — finish MCP canonical-field adoption and bump the MCP version",
  "status": "open",
```

**Proposed text**

```
Keep `"status": "open"` until the owner approves, then set it to "closed". Add — note `verdict: "superseded"`, NOT "close", and NOT "not-reproducible":

  "proposed_closure": {
    "status_was": "open",
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "basis": "superseded-by-owner-decision",
    "verdict": "superseded",
    "reason": "SUPERSEDED by owner decision D14 (2026-09-14) — and one half of it had already LANDED, which is why 'not reproducible' would be the wrong wording. Confirmed absent first-hand: `compare_staking_risk` is deleted from mcp-server/src/index.ts, with a 25-line tombstone in its place at :372-396 saying it was deleted rather than hidden, that its whole output — a side-by-side table of composite Safety Scores — was the thing rejected, and that the upstream route no longer serves the fields it needed. The upstream confirms it: frontend/src/app/api/v1/staking/opportunities/route.ts:156 states 'Removed 2026-09-14: the safetyScore, band, riskScore and riskLevel fields and the max_risk, min_safety and max_safety parameters', and the surviving MCP tool get_staking_opportunities (index.ts:252-324) requests and prints only the six 1-10 dimensions, never a composite. Guarded, and the guard can fail: frontend/src/lib/risk/__tests__/riskScoringRemoved.test.ts:200-211 strips comments before asserting (so the tombstone cannot satisfy it) and asserts positives alongside the absences. WHAT DID LAND: the version bump half of next_action is done and stands — mcp-server/package.json:3 and mcp-server/src/index.ts:64 both read 1.1.0, shipped 2026-09-08 per docs/assessments/R2-phases-3-5.md:67-81. So the item is not empty; it is half-completed and half-overtaken. Nothing further should be built: the canonical fields this item existed to adopt no longer exist to adopt, and CLAUDE.md records that no composite staking risk score exists anywhere in the app, its API or its MCP server.",
    "approved_by": "owner decision D14, 2026-09-14 — 'Remove all risk comparisons to avoid potentially sounding like a recommendation' (docs/decisions/2026-09-14-owner-decisions.md:67, scope row :77)",
    "evidence": [
      "mcp-server/src/index.ts:372-396 (tombstone — tool absent)",
      "mcp-server/package.json:3 and mcp-server/src/index.ts:64 (version 1.1.0, the half that landed)",
      "frontend/src/app/api/v1/staking/opportunities/route.ts:156",
      "frontend/src/lib/risk/__tests__/riskScoringRemoved.test.ts:200-211",
      "docs/decisions/2026-09-14-owner-decisions.md:67, :77, :210",
      "docs/architecture/risk-scale-spec.md:508-526 (already annotated)",
      "docs/assessments/R2-phases-3-5.md:49 (annotated 2026-09-21 in the same batch)"
    ]
  }
```

### P27. T-277

- **Ledger:** `docs/assessments/R2-phases-3-5.md`
- **Where:** ## Phase 5 — Public API (`/api/v1/staking/opportunities`) — heading at line 49, covering the 5a bullet (51-63) and the 5b bullet (67-81)
- **Proof in tree:** `mcp-server/src/index.ts:372-396 and frontend/src/app/api/v1/staking/opportunities/route.ts:156`

**Current text**

```
## Phase 5 — Public API (`/api/v1/staking/opportunities`)

- **5a (additive, non-breaking) — DONE.** Each opportunity now carries `safetyScore`
  (0–100 higher = safer) + `band` (5-level), via `scoreStakingProvider()`.
```

**Proposed text**

```
Leave every bullet byte-identical and insert this banner between the heading (line 49) and the 5a bullet (line 51). It must cover 5a as well as 5b, because both describe fields that no longer exist — 5b alone would leave the reader believing the API still serves `safetyScore`. D14's own actionable list already required this (`docs/decisions/2026-09-14-owner-decisions.md:210`, "update R2 §5.3 references"); the sibling `risk-scale-spec.md` got its banner on 2026-09-14 and this file was missed.

> ⚠ **OVERTAKEN 2026-09-14 by owner decision D14 — annotation added 2026-09-21 (queue
> item T-277). Everything in this Phase 5 section describes fields and a tool that no
> longer exist.** `safetyScore`, `band`, `riskScore` and `riskLevel` were removed from
> `/api/v1/staking/opportunities`, along with the `max_risk` / `min_safety` /
> `max_safety` parameters — see the route's own `note` at
> `frontend/src/app/api/v1/staking/opportunities/route.ts:156`. `compare_staking_risk`
> was **deleted** from the MCP server; a tombstone sits where it was
> (`mcp-server/src/index.ts:372-396`), and the guard is
> `frontend/src/lib/risk/__tests__/riskScoringRemoved.test.ts:200-211`.
>
> **So 5a is reversed and 5b's first half is void.** The one part of 5b that still
> stands is the version bump: `mcp-server/package.json:3` and
> `mcp-server/src/index.ts:64` read **1.1.0**, as recorded below. The surviving tool,
> `get_staking_opportunities`, publishes the six curated 1–10 dimensions and no
> composite (`mcp-server/src/index.ts:252-324`).
>
> Removal was on **editorial** grounds, not scale-migration grounds: a single number
> ranking providers against each other reads as a recommendation (RP-3). The scale work
> recorded here was correct and is simply no longer load-bearing — do not restart it.
> See `docs/decisions/2026-09-14-owner-decisions.md` (D14) and
> `docs/architecture/risk-scale-spec.md:508-526`.
```

### P28. T-277

- **Ledger:** `docs/audits/queue-verification-sweep-2026-09-11.md`
- **Where:** After the hand-spot-check paragraph at lines 43-46, before the "## Overturned — claimed closed, still open" heading
- **Proof in tree:** `mcp-server/src/index.ts:372-396`

**Current text**

```
Four claims were also spot-checked by hand (T-350, T-391, T-277, T-346) and all four held.
```

**Proposed text**

```
Leave the sweep's text and its T-277 table row (line 111) byte-identical — both were true on 2026-09-11 — and insert a dated pointer immediately after line 46:

> **Pointer added 2026-09-21 — one of those four has since been overtaken.** The T-277
> row (line 111) cites `index.ts:364-368` for `compare_staking_risk`'s reworded
> description. That tool was **deleted** three days after this sweep, under owner
> decision D14 (2026-09-14); a tombstone now occupies
> `mcp-server/src/index.ts:372-396`. The other half of the row — version **1.1.0** in
> `mcp-server/package.json:3` and `mcp-server/src/index.ts:64` — still holds. Nothing
> above is corrected; this only stops a reader following the citation to a tool that no
> longer exists.
```

### P29. T-331

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item "T-331", lines 2026-2047 (status at :2029, sources tail at :2040-2047)
- **Proof in tree:** `docs/agents/code-checker.md:97 (bullet with no "exchange creds"); docs/agents/code-checker.md:99 (the RP-5 forbids-custody replacement); frontend/src/app/(dashboard)/wallets/page.tsx:315 ("credential store, its two routes and lib/server/exchangeCredentials.ts went")`

**Current text**

```
   "sources": [
    {
     "file": "docs/agents/code-checker.md",
     "lines": "80-81",
     "quote": "Sensitive routes (agents, provider config writes, exchange creds, video-analyze POST) call `guardSensitiveRoute` first."
    }
   ]
  },
```

**Proposed text**

```
   "sources": [
    {
     "file": "docs/agents/code-checker.md",
     "lines": "80-81",
     "quote": "Sensitive routes (agents, provider config writes, exchange creds, video-analyge POST) call `guardSensitiveRoute` first."
    }
   ],
   "proposed_closure": {
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "verdict": "close",
    "basis": "verified-here",
    "reason": "DONE. code-checker.md:97-98 now reads 'Sensitive routes (agents, provider config writes, video-analyze POST, the pump-report scan/investigate/chat routes) call guardSensitiveRoute first' — 'exchange creds' is gone — and :99-104 carries the replacement bullet 'Exchange API-key custody is forbidden, not guarded (RP-5, 2026-08-18)', which states that a diff reintroducing exchange-key storage is a red finding regardless of how well it is guarded. Verified against the tree, not the charter: frontend/src/app/live-data/wallet/ has no exchange route.ts (the exchange/ and exchange-connections/ directories survive but are EMPTY, so no handler is compiled), and the only remaining references to the credential store anywhere in frontend/src are historical comments at (dashboard)/wallets/page.tsx:311-316 and lib/api/live/providers.ts:822.",
    "evidence": [
     "docs/agents/code-checker.md:97-104",
     "frontend/src/app/(dashboard)/wallets/page.tsx:311-316",
     "docs/audits/rejected-proposals.md:43 (RP-5)"
    ]
   }
  },
```

### P30. T-332

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item "T-332", lines 2048-2071 (status at :2051, sources tail at :2064-2071)
- **Proof in tree:** `docs/agents/code-checker.md:150 ("### Added 2026-09-08 (decisions since 2026-08-08)"), with rows at :154 (RP-6), :155 (item 4), :156 (D3), :157 (RP-5), :158 (redirects), :159 (StatusBar)`

**Current text**

```
   "sources": [
    {
     "file": "docs/agents/code-checker.md",
     "lines": "95-125",
     "quote": "When a review establishes a *new* deliberate decision, propose adding it to this table — that's how it stays cheaper than re-litigating."
    }
   ]
  },
```

**Proposed text**

```
   "sources": [
    {
     "file": "docs/agents/code-checker.md",
     "lines": "95-125",
     "quote": "When a review establishes a *new* deliberate decision, propose adding it to this table — that's how it stays cheaper than re-litigating."
    }
   ],
   "proposed_closure": {
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "verdict": "close",
    "basis": "verified-here",
    "reason": "DONE. code-checker.md:150 opens a sub-table '### Added 2026-09-08 (decisions since 2026-08-08)' carrying every row the next_action asked for: RP-6 (:154), short-list item 4 ranking-vs-explanation (:155), D3 ratesCatalog-bypasses-security-quotes (:156), RP-5 exchange linking absent from Wallets (:157), the hidden-feature redirects (:158) and the removed StatusBar market status (:159). The guard test the rows cite exists on disk (frontend/src/lib/risk/__tests__/riskScoringRemoved.test.ts, 11329 bytes). One wording note for the record: the rows cite the decisions by RP id rather than by the rejected-proposals.md path the next_action names; the ids resolve at docs/audits/rejected-proposals.md:41 (RP-3), :43 (RP-5), :44 (RP-6).",
    "evidence": [
     "docs/agents/code-checker.md:150-159",
     "frontend/src/lib/risk/__tests__/riskScoringRemoved.test.ts (exists)",
     "docs/audits/rejected-proposals.md:41,43,44"
    ]
   }
  },
```

### P31. T-080

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item "T-080", lines 1141-1164 (status at :1144, sources tail at :1157-1164)
- **Proof in tree:** `docs/TASK-QUEUE.md:2203 ("> **Status: ✅ resolved — annotation added 2026-09-08.**"), outcome rows at :2210 (#50), :2211 (#52), :2212 (#45 superseded by #135 Node 24)`

**Current text**

```
   "sources": [
    {
     "file": "docs/TASK-QUEUE.md",
     "lines": "2158-2160, 2174",
     "quote": "- **#45, #50, #52** — still unrebased, still unverified."
    }
   ]
  },
```

**Proposed text**

```
   "sources": [
    {
     "file": "docs/TASK-QUEUE.md",
     "lines": "2158-2160, 2174",
     "quote": "- **#45, #50, #52** — still unrebased, still unverified."
    }
   ],
   "proposed_closure": {
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "verdict": "close",
    "basis": "verified-here",
    "reason": "DONE, and in the charter's format. docs/TASK-QUEUE.md:2203 carries '> **Status: ✅ resolved — annotation added 2026-09-08.**' immediately after the 'What CI said once these were rebased' block, with an outcome table at :2208-2212 recording #50 merged (02ec56f), #52 merged (4fc6e62 with ac3e836/#133), #45 closed-superseded by 936e1a8 (#135, Node 24 LTS across Dockerfile + CI + engines), #54/#47 closed 2026-09-02, and #59 declined. The original table and the CI notes above it are left verbatim, which is what the charter requires of a historical record. It also absorbs the two siblings that were filed pointing at it: T-078 and T-082 both carry next_action text saying 'fold into the T-080 steward annotation', and both are satisfied — #54/#47 at :2211 and ci.yml-on-push-to-main (#134, e3d629f) at :2216-2217. Both already read status 'done' in closed_but_still_listed_as_open_in_docs, so no sibling update is needed.",
    "evidence": [
     "docs/TASK-QUEUE.md:2203-2217",
     "docs/audits/task-queue-2026-09-07.json closed_but_still_listed_as_open_in_docs → T-078, T-082 (status: done)"
    ]
   }
  },
```

### P32. T-326

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item "T-326", lines 1982-2005 (status at :1985, sources tail at :1998-2005)
- **Proof in tree:** `.claude/agents/opportunity-scout.md:100 (the RP-3 bullet the 2026-09-11 sweep named as the only gap) and .claude/agents/code-auditor.md:114 ("No composite staking risk score ANYWHERE (RP-3 2026-08-17, extended by D14 2026-09-14)"), with the rescoped scale bullet at code-auditor.md:134`

**Current text**

```
   "sources": [
    {
     "file": "docs/IMPROVEMENT-AGENT-SETUP.md",
     "lines": "160-161",
     "quote": "**New policy decided?** Add it to the policy list in both files the same day. An agent auditing against yesterday's rules is worse than none."
    }
   ]
  },
```

**Proposed text**

```
   "sources": [
    {
     "file": "docs/IMPROVEMENT-AGENT-SETUP.md",
     "lines": "160-161",
     "quote": "**New policy decided?** Add it to the policy list in both files the same day. An agent auditing against yesterday's rules is worse than none."
    }
   ],
   "proposed_closure": {
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "verdict": "close",
    "basis": "verified-here",
    "reason": "DONE in both files this item actually names. 'Both files' here means the two .claude/agents definitions (per docs/IMPROVEMENT-AGENT-SETUP.md:160 and the item's own summary 'code-auditor.md and opportunity-scout.md'), NOT docs/agents/code-checker.md. .claude/agents/code-auditor.md carries RP-6 (:104), item 4 (:111), RP-3-as-extended-by-D14 with the scoreStakingProvider() correction (:114-141), Yahoo hard-block (:144), RP-5 (:148) and free-tier-only (:150); the 'risk scores 0-100' bullet the next_action asked to rescope now reads 'Where a score IS published — after D14 that is the options Trade Risk Scorer, plus the macro/equity profiles' (:134-141). .claude/agents/opportunity-scout.md carries RP-6 (:93), item 4 (:97), RP-3 (:100), Yahoo (:106), RP-5 (:108) and free-tier-only (:109). The RP-3 bullet that the 2026-09-11 sweep named as the single remaining gap is present in both. Tree check behind the RP-3/D14 claim: scoreStakingProvider() has no production caller — grep over frontend/src finds it only in lib/risk/profiles/stakingAdapter.ts:61 and two test files — and /api/v1/staking/opportunities/route.ts:156 states in its own response note that it publishes no composite score.",
    "scope_note": "A pass on 2026-09-21 recorded this item against docs/agents/code-checker.md instead (Yahoo block, RP-3/D14, D21 free-tier, and a scoreStakingProvider() correction — all now present at code-checker.md:86-95, 165-175 and 193-203). That work is real and worth keeping, but it is T-332's family, not this item's scope. Closing T-326 on the .claude/agents evidence above, which was verified first-hand today.",
    "evidence": [
     ".claude/agents/code-auditor.md:104-151",
     ".claude/agents/opportunity-scout.md:93-110",
     "frontend/src/lib/risk/profiles/stakingAdapter.ts:61 (only definition; no production caller)",
     "frontend/src/app/api/v1/staking/opportunities/route.ts:156"
    ]
   }
  },
```

### P33. T-326

- **Ledger:** `docs/audits/queue-verification-sweep-2026-09-11.md`
- **Where:** Insert immediately before the heading "## Verified closed (47)" at line 77 (i.e. after the "Still carrying work (16)" table ends at line 75)
- **Proof in tree:** `.claude/agents/opportunity-scout.md:100 and .claude/agents/code-auditor.md:114 — the RP-3 bullet this document named as the outstanding gap, present in both files`

**Current text**

```
## Verified closed (47)
```

**Proposed text**

```
> **Annotation — 2026-09-21 (checklist steward). The T-326 row above is overtaken.**
> Its named remainder was *"the only gap is the explicit RP-3 bullet — one line in each
> file"*. Both files now carry it: `.claude/agents/opportunity-scout.md:100-105` and
> `.claude/agents/code-auditor.md:114-133`, the latter also carrying D14's extension of
> RP-3 to every surface and the correction of the "scoreStakingProvider() is live" claim.
> The row is left as written; this block is the current state.
>
> Also for a reader diffing this document against the tree: the **T-330** row in
> "Verified closed (47)" below quotes `code-checker.md` as reading "1311 tests in 88
> files". It has not said that since 2026-09-19. Read every figure in this document as a
> 2026-09-11 reading.

## Verified closed (47)
```

### P34. T-330

- **Ledger:** `docs/agents/code-checker.md`
- **Where:** Baseline section, the "DATED READINGS" bullet, lines 32-39
- **Proof in tree:** `frontend/vitest.config.ts:19 (`include: ['src/**/*.{test,spec}.{ts,tsx}']`); count over that glob from frontend/ = 110 files; the same sweep from the repo root = 118, the extra 8 all under .claude/worktrees/agent-a76f6d909b69cc2de/frontend/src/`

**Current text**

```
- **The figures above are DATED READINGS, not live values — re-measure before relying on
  them.** They stood as "412 tests / ~67 warnings" with no date at all until 2026-09-19,
  which is the exact failure this note prevents: an undated count reads as current forever
  and nothing fails when it drifts. They are already drifting — a file count taken on
  2026-09-21 found **112** test files against the 107 recorded two days earlier, and no
  suite run has since said what that did to the 1515. Read them as of their date, run the
  commands yourself for the real numbers, and never carry a figure forward under a fresh
  date.
```

**Proposed text**

```
- **The figures above are DATED READINGS, not live values — re-measure before relying on
  them.** They stood as "412 tests / ~67 warnings" with no date at all until 2026-09-19,
  which is the exact failure this note prevents: an undated count reads as current forever
  and nothing fails when it drifts. They are already drifting — a file count taken on
  2026-09-21 found **110** test files against the 107 recorded two days earlier, and no
  suite run has since said what that did to the 1515. **Count the way vitest does**, or
  this bullet acquires the defect it warns about: `src/**/*.{test,spec}.{ts,tsx}` from
  `frontend/` (`vitest.config.ts:19`) → 110. A repo-root sweep returns 118, because eight
  test files under `.claude/worktrees/` are a scratch checkout vitest never runs. *(This
  bullet said 112 when it was written on 2026-09-21; that figure did not reproduce under
  either method and was corrected the same day.)* Read them as of their date, run the
  commands yourself for the real numbers, and never carry a figure forward under a fresh
  date.
```

### P35. T-330

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** outstanding[] item "T-330", lines 2006-2025 (status at :2009, sources tail at :2018-2025). APPLY ONLY TOGETHER WITH the code-checker.md:32-39 correction above.
- **Proof in tree:** `docs/agents/code-checker.md:21 ("# 1515 tests in 107 files as of 2026-09-19"), :22 ("0 errors; 46 pre-existing warnings as of 2026-09-19"), :113 ("Tailwind compiles at build time (`aa35239`)")`

**Current text**

```
   "sources": [
    {
     "file": "docs/agents/code-checker.md",
     "lines": "17-24, 29-31",
     "quote": "npx vitest run          # 412 tests as of 2026-07-30; must all pass"
    }
   ]
  },
```

**Proposed text**

```
   "sources": [
    {
     "file": "docs/agents/code-checker.md",
     "lines": "17-24, 29-31",
     "quote": "npx vitest run          # 412 tests as of 2026-07-30; must all pass"
    }
   ],
   "proposed_closure": {
    "proposed_on": "2026-09-21",
    "pending_owner_approval": true,
    "verdict": "close",
    "basis": "verified-here",
    "reason": "DONE — all three deliverables. (1) code-checker.md:21 reads 'npx vitest run # 1515 tests in 107 files as of 2026-09-19'; (2) :22 reads 'npx eslint . # 0 errors; 46 pre-existing warnings as of 2026-09-19' and :29 agrees; (3) the stale prebuilt-CSS invariant is gone — :113-117 now reads 'Tailwind compiles at build time (aa35239)' with its own dated correction marker. The undated '412 / ~67' figures the item was filed against are absent. NOT verified here and deliberately not touched: the 1515 and the 46 themselves — re-measuring those means running the suite, which this pass did not do.",
    "caveat": "This closure is paired with a correction. The DATED-READINGS bullet added on 2026-09-21 (:32-39) cited '112 test files on disk today'. That figure does not reproduce: vitest's own include (src/**/*.{test,spec}.{ts,tsx} from frontend/, vitest.config.ts:19) matches 110, and a repo-root sweep matches 118 by counting 8 files in a .claude/worktrees scratch checkout. Closing this item without fixing 112 would ratify the exact defect the bullet exists to prevent, so the two changes go together.",
    "evidence": [
     "docs/agents/code-checker.md:21-22, 29, 113-117",
     "frontend/vitest.config.ts:19"
    ]
   }
  },
```

### P36. (sweep bookkeeping — all five items)

- **Ledger:** `docs/audits/task-queue-2026-09-07.json`
- **Where:** annotations.passes[] — append a new entry at the end of the array (file tail, lines 34278-34283)
- **Proof in tree:** `docs/audits/task-queue-2026-09-07.json:34233 ("annotations") — the block's own note states the convention: every later change is an item-level closure/progress block carrying its own date and citation, logged as a pass`

**Current text**

```
     ".github/workflows/archive-branch.yml"
    ]
   }
  ]
 }
}
```

**Proposed text**

```
     ".github/workflows/archive-branch.yml"
    ]
   },
   {
    "on": "2026-09-21",
    "what": "5 closures PROPOSED by a checklist-steward sweep (T-080, T-326, T-330, T-331, T-332) — all five verified first-hand in the tree, none closed on a prior pass's summary",
    "basis_key": "proposed_closure.pending_owner_approval = true: evidence recorded, owner has NOT approved. A follow-up pass promotes proposed_closure to closure and sets status.",
    "caveat": "Two corrections came out of the verification rather than the items. (1) T-326's scope is the two .claude/agents policy lists, not docs/agents/code-checker.md; a 2026-09-21 pass recorded it against code-checker.md, and the .claude/agents files had in fact been up to date since 2026-09-13/14. (2) The DATED-READINGS bullet added to code-checker.md:32-39 on 2026-09-21 cites 112 test files; the reproducible count under vitest's own include is 110. T-330's closure is paired with that correction.",
    "evidence": [
     "docs/agents/code-checker.md:21-22, 97-104, 113-117, 150-159",
     ".claude/agents/code-auditor.md:104-151",
     ".claude/agents/opportunity-scout.md:93-110",
     "docs/TASK-QUEUE.md:2203-2217",
     "frontend/vitest.config.ts:19"
    ]
   }
  ]
 }
}
```

---

## 3. Could not fully verify — kept separate on purpose

Per the charter: *"separate the certain from the uncertain."* Nothing here is proposed
for closure.

### U1. T-374 (residue item)

- **Sits at:** docs/audits/queue-verification-sweep-2026-09-11.md:74 (the PARTIAL row for T-374)
- **Missing:** The 2026-09-11 sweep listed "a stray empty markdown table" as part of T-374's residue but did not name the file. I could not locate it. docs/deployment/local-setup.md contains three markdown tables (lines 5-11, 130-137, 144-151) and all three are populated, so it is not there. I am proposing T-374 closed on its own next_action, which never mentioned a table — but this observation should not be silently dropped, and if the owner knows which file it meant, it needs its own check.

### U2. All five (approval history)

- **Sits at:** docs/audits/queue-closure-review-2026-09-13.md:50-53 ("Recommendation: Approve all 62 … nothing in TASK-QUEUE.md has been edited")
- **Missing:** Whether the owner already approved the 2026-09-13 closure review's "approve all 62" recommendation (which covered T-333, T-334, T-370 and T-380). If approval already happened, the correct `approved_by` string is that approval, not this sweep. I was instructed not to run git, so I could not check the commit/PR record; the `approved_by` field in every proposal above is therefore written as PENDING for the owner to replace with the real basis.

### U3. all six — which block type to use (proposed_closure vs closure)

- **Sits at:** docs/audits/queue-closure-review-2026-09-13.md:47-52 and docs/decisions/2026-09-14-owner-decisions.md (the 338-item tier table)
- **Missing:** I could not establish whether the owner has ALREADY approved these. queue-closure-review-2026-09-13.md ends 'Approve all 62', and docs/decisions/2026-09-14-owner-decisions.md:~250 counts '77 — Completed, independently re-verified — 62 re-checked file-and-line on 2026-09-13, 0 regressions', which reads as an acceptance. If that counted as approval, the correct write is a full `closure` block with basis 'owner-record' and status set to 'closed', not the `proposed_closure` I drafted. I cannot run git and found no merge or ruling naming these six. I took the conservative shape deliberately: a pending flag that turns out to be redundant costs one follow-up pass; a closure the owner never gave costs the thing this ledger exists to protect.

### U4. T-072 — the literal acceptance criterion

- **Sits at:** frontend/src/app/(dashboard)/funds/FundsClient.tsx:3
- **Missing:** The item's next_action ends 'confirm `npm run lint` shows 0 warnings for the file'. I did not run lint (the brief forbids running the suite), so I cannot assert the file is warning-free for OTHER rules. What I verified is stronger for the DEFECT: FundsClient.tsx has no useEffect at all, so the setState-in-effect warning cannot fire. The closure is proposed on the defect, and the reason text says so; if the owner wants the literal criterion met, one eslint run on the owner's machine closes the gap.

### U5. T-330

- **Sits at:** docs/agents/code-checker.md:21-22 (the figures), :36-37 (the "no suite run has since" clause)
- **Missing:** The two figures the baseline actually asserts — **1515 tests** and **46 eslint warnings** — could not be re-verified. Re-measuring means running `npx vitest run` and `npx eslint .`, which this pass was instructed not to do. I verified only the surrounding, code-derivable facts: the file-count method and the number of test files on disk. The closure proposal for T-330 says this explicitly and does not touch either figure. Separately, the bullet's own claim that "no suite run has since said what that did to the 1515" is contradicted by the same change's commit message (.git/COMMIT_EDITMSG), which reports "1538 tests … green". One of the two is wrong, and only an owner-machine run settles which. I propose NO change to that clause.

### U6. T-326

- **Sits at:** docs/agents/code-checker.md:86-95 (Yahoo), :165-175 ("### Added 2026-09-21" staking rows), :193-203 (D21)
- **Missing:** Whether docs/agents/code-checker.md genuinely LACKED the Yahoo hard-block, the RP-3/D14 rows and the D21 free-tier bullet before 2026-09-21 — the premise of the pass that added them. They are all present now (code-checker.md:86-95, 165-175, 193-203) and all correct against the tree, so the current state is fine either way; but establishing that they were absent needs git history, which this pass was instructed not to read. This is why the T-326 closure above rests on the .claude/agents files instead, where I could verify the end state directly.

---

## 4. No ledger entry — nothing to update, worth knowing

Observations with no status row anywhere. Recorded so the next sweep does not re-derive
them, and so the genuinely new ones can become queue items if the owner wants.

1. The `/api` suffix on .github/workflows/cd-staging.yml:185 (`NEXT_PUBLIC_API_URL=https://staging.financenow.example.com/api`) has NO queue item and no status entry anywhere. It is the same defect shape T-333 fixed in local-setup.md and configmap.yaml, in a third file T-333 never cited. Harmless while the /api/* rewrite is gone (D2), but configmap.yaml:64-66 states the rule it violates. Recommend a new queue item rather than folding it into T-333's closure.

2. docs/TASK-QUEUE.md carries no entry for any of T-333, T-334, T-370, T-374 or T-380 — the T-### numbering lives only in docs/audits/task-queue-2026-09-07.json and the dated sweep audits. Nothing to update there; naming it so the next pass does not go hunting.

3. docs/audits/production-readiness-scorecard.md carries no entry for any of the five (its only hit for these topics is an infrastructure inventory line at :23). Nothing to update.

4. docs/ROADMAP.md has no entry for the five items as items; its only stale sibling is the Phase 0 useAuthStore bullet, proposed above.

5. DATA-AVAILABILITY.md: none of the five touch it. No action — and per charter its statuses are not hand-editable anyway.

6. T-259's originating observation — docs/audits/app-audit-2026-07-27.md:223 ('the XRP wallet route burned 10.2s on an unreachable upstream') — sits in §2 body prose, NOT in the file's remediation table. The file states its own policy at :13-15: 'The audit text below is the original 2026-07-27 assessment and is left unedited — findings are historical records, not live tickets. This table is the current state.' The remediation table is keyed on numbered findings (C1, H1–H3, M1–M8, L1–L11); the XRP note was never numbered, so there is no row to move and adding one would be inventing a finding. Nothing to update; worth knowing so the next sweep does not re-propose it.

7. T-072 has no entry in ANY markdown ledger. Its only sources are an uncommitted scratchpad path (/tmp/.../tasksweep/open-prs.json, recorded in the queue JSON at :1131-1135) and the three verification audits. docs/TASK-QUEUE.md, ROADMAP.md, README.md, DATA-AVAILABILITY.md, the scorecard, P3-production-review.md, FEATURE-ADDITIONS.md, CI-REMEDIATION.md and rejected-proposals.md carry nothing on it. The queue JSON is the whole ledger surface.

8. docs/TASK-QUEUE.md carries no T-### ids at all and no row for any of the six subjects (searched: computeSegmentOptions, setState-in-effect, FundsClient, DataBadge, getPegDeviationColorClass, timeout budget). Despite queue-closure-review-2026-09-13.md:50 recommending 'Apply them to docs/TASK-QUEUE.md as closed', these items have no home there — the live ledger is the queue JSON's status/closure fields, as docs/decisions/2026-09-14-owner-decisions.md:105 states. No TASK-QUEUE proposal is warranted.

9. docs/architecture/risk-scale-spec.md needs nothing for T-350: its 2026-09-08 post-implementation block already records the move at :355-357 ('getPegDeviationColorClass moved to lib/utils/pegFormat.ts, since a peg deviation is a distance from $1.00 rather than a point on this scale'). The design line at :367 that T-350 quotes is covered by that banner. A second annotation would be noise.

10. The JSON's `detail` map (the 2026-09-07 adjudication record, e.g. detail['T-072'] at :16642) is NOT a status surface. Confirmed by precedent: T-022, T-167 and T-004 are all `status: closed` with full closure blocks, and their detail entries still read stated_status 'open' / 'done-but-contradicted', untouched. annotations.note says the same — 'every later change is an item-level closure or progress block'. No proposal there.

11. Dead import: `frontend/src/app/(dashboard)/technical-analysis/page.tsx:31` imports `confluenceLabel` from `@/lib/utils/confluence`, but the symbol is used nowhere in that file — the only other occurrence is the JSX comment `{/* Multi-timeframe confluence */}` at :405. The real call moved into `MultiTimeframeGrid.tsx` during the T-270 panel extraction and the import was left behind. Harmless, no ledger entry anywhere, and NOT proposed as a fix here — a steward proposes status text, not code edits. Flagging it so it lands in someone's batch rather than staying invisible.

12. CI does not run `test:coverage`. `frontend/package.json:20` defines it and `@vitest/coverage-v8` is installed, but no file under `.github/workflows/` references it (searched all workflow YAML). So the number is available on demand and is recorded on no run. T-256 only asked for the script, so this is outside that item and has no ledger entry of its own. Worth an owner call rather than a silent gap — `docs/audits/2026-07-30-audit.md:122` raised coverage as a check that "could not be run", and it still cannot be read from a CI run.

13. `docs/assessments/T10-crypto-ta-audit.md:69-70` carries a second unaddressed minor observation from the same list — the `1H` range serving 30-minute bars while the route comment says "last week of 30m bars" (~half a week off). I did not verify it in source and it has no queue id in `task-queue-2026-09-07.json` under any of the six ids swept. Named only so it is not mistaken for something this batch covered.

14. `docs/assessments/T11-equity-ta-audit.md:67-71` carries "VWAP on daily candles is semantically loose" in the same Observations list as T-273's volume finding. No queue id among the six covers it and I did not verify it. Same reason for naming it: the T-273 annotation sits directly beneath it and must not be read as settling it.

15. **`.claude/agents/opportunity-scout.md:119` still carries the unscoped bullet "Risk scores are 0–100, higher = safer."** Its twin in `code-auditor.md` was rescoped after D14 to "Where a score IS published — after D14 that is the options Trade Risk Scorer, plus the macro/equity profiles…" (:134-141). The scout's was not. It is not wrong — 0–100 higher-is-safer is still the canonical scale — but it is the same under-scoping that T-326's next_action asked be fixed in the auditor, and no queue item covers the scout's copy. Small, one line, worth a future batch; I am not proposing it here because it is outside every item in this sweep's scope.

16. **`frontend/src/app/live-data/wallet/exchange/` and `…/exchange-connections/` still exist as EMPTY directories** (mtime 2026-08-19, i.e. after RP-5). No `route.ts`, no files at all, so nothing compiles and RP-5 is not violated — but a directory listing reads as though the routes survive, and the 2026-09-07 verification record asserts "Only btc/eth/sol/tron/xrp subdirs remain", which is not what `ls` shows today. Git does not track empty directories, so this is local-checkout residue rather than a repo defect. Worth knowing before someone reads the listing and files a false RP-5 alarm.

17. **`docs/IMPROVEMENT-AGENT-SETUP.md:3` reads "Updated 28 July 2026."** It is the document that defines what "the policy list in both files" means (:160) — the source cited by T-326 — and both of those files have changed substantially since (code-auditor.md 2026-09-14, opportunity-scout.md 2026-09-13). The setup document itself is not a status ledger and has no queue item; flagging only because it is the authority T-326 rests on, and its header date is now two policy generations old.

18. **`.claude/worktrees/agent-a76f6d909b69cc2de/` holds a partial second `frontend/src` checkout** with 8 test files in it. Nothing references it and vitest never sees it, but it is the most likely explanation for a repo-root file count disagreeing with a `frontend/`-scoped one. No ledger entry anywhere mentions it.

---

**Totals:** 36 proposals, 6 uncertain, 18 no-ledger observations, 21 contradictions.
