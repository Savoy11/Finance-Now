# Working-document accuracy sweep — 2026-09-19

**Branch:** `docs/accuracy-sweep-2026-09-19`, stacked on `docs/data-availability-2026-09-19` (PR #206)
**Scope:** 18 working documents + 2 code files. **66 corrections applied.**
Tests: 107 files / 1515 passing · `tsc --noEmit` clean · `npm run data-sources -- --verify` reports no drift.

---

## The headline: the queue is a poor map of the drift

Eleven queue items pointed here. When checked against the tree:

| Verdict | Count | Items |
|---|---|---|
| **Already done** | 7 | T-101, T-022, T-381, T-165, T-166, T-158 ×2 |
| **Partly done** | 4 | T-162, T-107, T-108, T-248 |
| **Premise was false** | 1 | T-239 |

And of **52 findings, only 13 came from queue items — 39 were swept by the agents themselves.**

Two structural reasons, both worth keeping:

1. **The queue's line numbers are a 2026-09-07 snapshot and have all drifted.** Same as the
   DATA-AVAILABILITY pass: the quoted *text* was the only reliable locator, and in several
   cases it no longer existed because the fix had already landed.
2. **Its claims age faster than the documents.** T-162 asked to correct "only Cboe is
   verified". By the time it was read, that wording was already gone *and both numbers had
   drifted again in the opposite direction* — #205 took the registry from 4 verified to 18
   the day before, one day after CLAUDE.md's last commit.

### T-239 asked for the opposite of the right fix

It asked to add an annotation **reinforcing** a 2026-09-08 note saying commit `14d6d76`
predates a "2026-08-05 re-root of `main`" and is unreachable. That note is false, and was
false the day it was written:

```
git merge-base --is-ancestor 14d6d76 main   → 0 (it IS an ancestor)
single root bbbd5e5 (2026-05-23) across 473 commits — no re-root in this repo's history
14d6d76 was already reachable from origin/main as it stood on 2026-09-08
```

Both copies (audit + proposals, added together in `046ae69`) were **retracted** rather than
annotated. A verifier then caught that the first retraction draft misattributed the upstream
audit's "three orphaned branches" line to the wrong commit; that was corrected before applying.

---

## Method, and what the adversarial layer caught

21 agents: 8 document surveyors → 8 adversarial verifiers → 2 completeness critics.
**21 of 52 proposed replacements were REFUTED** — a 40% refutation rate, double the previous pass.

The recurring shape, again, was *facts correct, claim around them wrong*:

| Proposed | Why it was refused |
|---|---|
| README: rewrite "33 distinct rate keys … 25 more" | **Correct on its own date** (2026-09-08). Corrected to 27 (8 native + 19 DeFiLlama) **with the date**, not silently |
| CLAUDE.md: "the same is true of `scoreEquity()`" after a D14 marker | `scoreEquity()` has **never had a production call site** — `git log -S` returns only its creating commit. It did not lose one at D14 |
| ROADMAP: annotate the "crypto first, stocks later" decision as reversed later | Writes a **false timeline** — equities shipped 2026-07-07, 35 minutes after the decision it supposedly reversed |
| dataSources: publish a fund-universe fetch time | Five runs spanned 11.3–13.3 s; a single figure would have been **invented**. Size (2,274,590 bytes) kept, timing dropped |
| CLAUDE.md: "that host was refusing *that exit node*" | The repo has **already ruled** this phrasing too broad (2026-09-12). Replaced with the measured AS-number framing |

One proposed replacement also contained a **note addressed to me** rather than file content
(`>>> COMPANION EDIT REQUIRED…`). It was caught by a scan before applying and handled by hand —
it turned out to be right: three comments across two files named a `docs/DATA-SOURCES.md` path
that has never existed (the generator writes `path.join(repoRoot, 'DATA-SOURCES.md')`).

---

## What was fixed

### Two that reach users or cause harm

- **`portfolios/page.tsx:1066`** — the methodology note told users "weighted risk averages each
  holding's **canonical Safety Score**". That score was deleted (RP-6), and the metric actually
  averages `riskTier`, which is **1–10 higher-is-riskier** — the opposite polarity and scale of
  the 0–100 higher-is-safer Safety Score. The only drift in this sweep a *user* sees.
- **`docs/deployment/local-setup.md`** — instructed `poetry run alembic upgrade head`, against
  a database **drizzle owns**, while its own banner eight lines above claimed that step "was
  removed". Also a bare `docker compose up -d` that would start the retired FastAPI service,
  because `docker-compose.yml` declares `backend:` with no `profiles:` guard.

### Counts that had drifted

`CLAUDE.md` 54/56 seeded → **38 seeded / 18 verified**; `59 routes` → **58**; README
`30 exchanges` → **29** (Poloniex removed on *terms*, not availability); `dataSources.ts`
`18 parallel upstreams` → **7**; extended FX `+127` → **+126**; `code-checker.md`
1437 tests/102 files → **1515/107** and two contradicting warning counts (44 and ~52) → **46**.

### Claims that were simply wrong

README lists **Bitcoin.com** as a data provider — zero hits in the tree. `source-terms.md`
told maintainers to update a field called **`verifiedAt`**, which does not exist and never has
(it is `reviewedAt`). `CLAUDE.md`'s directory tree listed **`staking-discovery/page.tsx`**, a
file that no longer exists. `CI-REMEDIATION.md` reported two **deleted CI jobs as green**.
`security.md` said `npm audit` is `|| true` and non-gating — it has been **gating since
2026-09-08** — and that `safety check` runs, which went with the backend under D2.

### Recording work completed

`security.md` now names the two live holes in the dependency posture (CI audits `frontend`
only, so `mcp-server` was covered by nothing but alerts — how six HIGH advisories accumulated
there, fixed in #207; and nothing scans `backend/poetry.lock`, where 3 alerts stay open by
choice). `2026-09-14-owner-decisions.md` marks **terms ratification DECIDED** (#205) and keeps
Group B open. `risk-framework.md` marks the backend scoring divergence **resolved by D2**,
recorded rather than reconciled.

---

## Deferred — proposed, not applied

The two critics found 22 gaps; 14 were fixed. The rest are larger than a correction:

1. **`docs/architecture/overview.md`** describes the retired two-service system as current
   throughout — FastAPI, Celery, TimescaleDB, Kubernetes on EKS — and opens with a botched
   rebrand find/replace ("The Finance Now (Finance Now) is…"). Only a banner was added here;
   it needs a rewrite or an explicit archival.
2. **`docs/runbooks/scaling.md`** and its sibling document operating a Kubernetes deployment
   that has never existed. `runbooks/backup-restore.md` already carries exactly the right
   banner and is the format to copy.
3. **`docs/MARKET-ASSESSMENT.md`** — its own stale-claim banner has itself expired.
4. **`docs/audits/production-readiness-scorecard.md`** scopes the retired backend.
5. **`frontend/src/lib/agents/tools.ts:343`** — the `search_macro_instruments` tool
   description says "18 FX pairs + dollar index", the exact double-count that produced the
   retired "46 macro instruments". **An agent reading that description totals 46.** This is
   live code, not a doc, so it is flagged rather than swept in with the documentation pass.

### The root cause, which is worth more than any single fix

`docs/agents/checklist-steward.md`'s inventory table — the definition of which documents are
kept true — has **no row for the architecture, deployment, runbook, policy or decision
families**. Every document that drifted worst in this sweep is one no agent was ever told to
maintain. Adding those rows is the fix that prevents the next sweep from finding the same thing.
