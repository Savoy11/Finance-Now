# Queue closure review — all 62 items re-verified on `main`, 2026-09-13

**Scope, stated first.** The owner asked for all 62 proposed closures reviewed. This pass
checks every item's recorded evidence against **current `main` (`55a4b52`)** — which is
**18 commits past** the sweep that produced the 47, and 25 past the pass that produced
the 15. The question it answers: *has anything regressed since those passes said "closed"?*

It does **not** re-adjudicate whether the evidence was *sufficient* to close each item.
That was the 2026-09-11 sweep's refutation pass, which sent every CLOSED claim to a
second agent told to overturn it and did overturn 3 of 50 (T-001, T-322, T-328). Those
three are not in this 62. Repeating a 62-item adversarial adjudication is a workflow, not
a check, and the owner did not ask for one.

## Result: 62 of 62 evidence intact, 0 regressions

| | Count |
|---|---|
| Cited file present **and** quoted evidence found verbatim | 44 |
| Command re-run with the recorded result (eslint ×2, ls, grep -c, file-exists) | 17 |
| Evidence present but **changed by me today** — still a valid closure | 1 (T-330) |
| Evidence missing, item should reopen | **0** |

**T-330 deserves a note.** Its evidence was `code-checker.md` recording "1311 tests in 88
files". I updated that line this morning to 1437 in 102 (T-328). The closure stands — the
item was "record a baseline", and one is recorded — but a reader diffing the sweep's
evidence against the file would see a mismatch and should know why.

## How the check was done, including where it first went wrong

A mechanical pass extracted file paths and quoted strings from each item's evidence and
checked them against the tree. **It initially flagged 32 of 62 as suspect.** Every one
turned out to be an artifact of the extraction, not drift:

- 9 cited bare filenames (`dataSources.ts`, `ohlcvAdjust.ts`, the nine panel names) that
  the resolver did not search deep enough for.
- 21 had a "quote" that was really a command (`npx eslint` — must be *run*), a
  backslash-broken span, an ellipsis, or a line-number reference rather than text.
- 2 had prose evidence with nothing quotable.

Each of the 32 was then re-checked by hand with the correct path and a distinctive
search term, or by running the command. All 32 came back OK. **The first-pass number
was a property of the checker, not the items** — worth saying because "32 suspect" would
have read as a finding if reported before the second look.

One check was itself wrong on the first try: T-377 was grepped in `infrastructure/`
when the evidence was about the three **runbooks** in `docs/`. The string was exactly
where the evidence said. The lesson from the two-egress audit applies to file paths too.

## Recommendation

Approve all 62. Apply them to `docs/TASK-QUEUE.md` as closed, citing this document and
the two verification passes. Per the checklist-steward charter this is the owner's act;
nothing in `TASK-QUEUE.md` has been edited.

## The 62

| Item | Pass | What was checked on `main@55a4b52` | |
|---|---|---|---|
| T-022 | 09-10 | grep -i weekly on equities TA page — 0 hits | ✅ |
| T-072 | 09-10 | eslint run on FundsClient.tsx — exit 0 | ✅ |
| T-138 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-259 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-262 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-267 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-273 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-333 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-388 | 09-10 | eslint run on crypto TA page — exit 0 | ✅ |
| T-167 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-168 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-169 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-163 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-164 | 09-10 | cited file present and quoted evidence found verbatim | ✅ |
| T-004 | 09-10 | DATA-AVAILABILITY records 27/51 | ✅ |
| T-069 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-074 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-080 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-081 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-100 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-101 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-103 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-104 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-108 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-118 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-126 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-156 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-158 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-162 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-165 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-166 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-170 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-171 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-172 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-173 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-239 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-248 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-256 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-257 | 09-11 | docs/audits/2026-09-08-audit.md exists, 323 lines | ✅ |
| T-268 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-269 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-270 | 09-11 | ls analytics/technical/*.tsx — 9 files | ✅ |
| T-277 | 09-11 | 1.1.0 in both package.json and index.ts | ✅ |
| T-302 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-304 | 09-11 | terraform pins 20.37 | ✅ |
| T-308 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-327 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-330 | 09-11 | baseline line present — NOTE: updated by me today (1311→1437), still a recorded baseline | ✅ |
| T-331 | 09-11 | guarded-route bullet present, no "exchange" | ✅ |
| T-332 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-334 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-346 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-350 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-361 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-369 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-370 | 09-11 | grep -c WS_URL cd-production.yml — 0 | ✅ |
| T-376 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-377 | 09-11 | fn-staging-aurora in all 3 runbooks; fn-cluster in 0 files | ✅ |
| T-380 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-381 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
| T-382 | 09-11 | infrastructure/docker/.env.example absent | ✅ |
| T-391 | 09-11 | cited file present and quoted evidence found verbatim | ✅ |
