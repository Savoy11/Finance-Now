# Branch archive — 2026-09-11

**Applied, not proposed.** This is the dated note the standing rule in `CLAUDE.md`
requires: a history-shaping operation lands together with a record of what was done
and where the prior state lives. 76 remote branches were deleted on this date, and
every one of them is recoverable.

**Supersedes `docs/audits/branch-cleanup-2026-09-10.md`**, whose count of 63 was
correct when written and is now stale — the day's own PRs (#166, #169, #170, #175,
#176, #177) merged after it and added their branches to the retirable set.

## What was done

Owner decision: *"I would prefer to archive any branches we no longer need"*, and,
asked how, chose **one rule with no exceptions** — every retired branch becomes a tag,
whether or not its commits were already in `main`.

| Step | Count | |
|---|---|---|
| Remote branches before | 100 | |
| Annotated `archive/*` **tags** created and pushed | **78** | every retired branch |
| Branches deleted | **76** | 78 minus 2 held back |
| Remote branches after | **24** | 15 `archive/*` + 6 dependabot + 2 held + `main` |

## Why tags and not `archive/*` branches

The existing convention for preserved work is an `archive/*` **branch** (the 15 that
remain). Extending it here would have put the branch list at 93 and defeated the
cleanup entirely — the list length *was* the problem.

Tags solve both halves: `refs/tags/` is as permanent as `refs/heads/`, but tags do not
appear in `git branch -r`, the PR base picker, or the branch dropdown. The repo had
**zero** tags before this, so `git tag -l 'archive/*'` is now an exact inventory of
retired branches with nothing else mixed in.

The 15 existing `archive/*` branches were **not** converted. `CLAUDE.md` says to keep
them through any cleanup, and every recoverability claim written before the 2026-08-05
re-root resolves to them by name.

## Recovering anything

```bash
git fetch origin --tags
git checkout -b claude/t386-prospectus-fees archive/claude/t386-prospectus-fees
```

Each tag is **annotated**, so it carries its own provenance — read it with
`git show archive/<name>`:

```
Archived 2026-09-11 from branch claude/t386-prospectus-fees

Commits not in main: 2 - not reachable from main (squash-merged or retired)
Also preserved by: refs/pull/174/head (survives branch deletion)
Tip: 7e7a8b5300c95bb84d9d7ebd35f5bd55ee855a17
Last commit: 2026-09-10 funds: CPER was also the management fee, and five guards the probe needed

Restore: git checkout -b claude/t386-prospectus-fees archive/claude/t386-prospectus-fees
Record: docs/audits/branch-archive-2026-09-11.md
```

**This was tested, not asserted.** `archive/claude/t386-prospectus-fees` was restored
to a scratch branch: tip matched `7e7a8b5`, the probe script was present in the tree,
and `rev-list` confirmed the 2 commits `main` lacks.

## The ordering that made it safe

Tags were created, pushed, and then **verified against the remote** — all 78 present,
every one peeling to exactly its branch tip — *before* a single branch was deleted.
Deleting first and tagging after would have been the same operation with no safety net.

## Two branches deliberately kept

Both are tagged like the rest, so nothing is at risk; the **branch** is kept only so the
open question stays visible rather than becoming a tag nobody re-reads.

| Branch | Why it is still here |
|---|---|
| `claude/girls-repos-management-i0rsak` | +67 lines to TASK-QUEUE including **six dependency majors held back**. That entry may still be live and has not been read. |
| `claude/data-sources-regen-j1gr50` | A `DATA-SOURCES.md` regeneration. Believed superseded — that file rebuilds with `npm run data-sources` — but not confirmed. |

Delete both the same way once read; the tags already exist.

## Not touched

- **15 `archive/*` branches** — keep permanently, per `CLAUDE.md`.
- **6 dependabot branches** — all have open PRs. Deleting the head branch closes the PR,
  so these are a merge-or-decide question, not a cleanup one. The oldest has been open
  since #98 and two are majors (`numpy 1.26.4 -> 2.4.6`, `pytest 8.4.2 -> 9.1.1`).

## The squash-merge trap

This repo squash-merges, which rewrites commits. **54 of the 78** retired branches still
carried commits unreachable from `main` — merged in substance, but `git branch --merged`
will call them unmerged forever. A cleanup driven by that flag would have looked careful
and stranded them; tagging first makes the distinction moot, which is the argument for
one rule applied without sorting branches by how merged they look.

## ⚠ How much the tags actually rescued: nothing

Measured after the fact, and it corrects an overstatement this document made in its
first draft. **Not one of the 78 tags was load-bearing.** Every retired branch was
already preserved by something else:

| Also preserved by | Count |
|---|---|
| A GitHub PR ref (`refs/pull/N/head`) | 45 |
| An `archive/*` branch | 7 |
| Both | 26 |
| **Nothing — the tag was the only ref** | **0** |

`refs/pull/N/head` **survives head-branch deletion**. Verified directly: `claude/queue-sweep`
was deleted, and `refs/pull/177/head` still resolves to `34a3b02`, the same commit as
`archive/claude/queue-sweep`. GitHub keeps a PR's head commit permanently, so any branch
that ever had a PR was never at risk — which is 71 of the 78 here.

That is worth stating plainly because the first version of these tag messages asserted
"this tag is the only ref preserving them" for 54 branches. It was wrong for 47 of them.
All 78 tags were rewritten to name what else holds the commits, so a reader can tell a
convenience copy from a rescue.

**What the tags are actually worth**, which is not nothing:

- **An inventory.** `git tag -l 'archive/*'` lists every retired branch by its original
  name. Recovering from a PR ref requires knowing the PR number, which nobody remembers.
- **Provenance.** `git show archive/<name>` states when it was retired, how many commits
  `main` lacks, and what else preserves it.
- **They travel.** `git fetch --tags` brings all 78; PR refs are not fetched by default.

**Consequence for the auto-delete setting:** enabling *Automatically delete head
branches* does **not** create an exception to the tag-everything rule, because a merged
PR's commits live at `refs/pull/N/head` regardless. The rule earns its keep for branches
that never had a PR — 7 of the 78 here.

## Inventory

`in main` = commits already reachable from `main` (true merge; the tag is a label).
A number = commits the tag is the **only** ref preserving.

| Retired branch | Last commit | Tip | Commits not in `main` |
|---|---|---|---|
| `chore/improvement-agents` | 2026-07-30 | bb1c3d6 | in main |
| `claude/agthx-verified-load` | 2026-09-10 | bf9ff7d | **1** |
| `claude/api-terms-triage` | 2026-09-02 | b1c65de | **2** |
| `claude/archive-branch-note` | 2026-08-29 | eba9f73 | **1** |
| `claude/asset-class-connectors-lqfbnu` | 2026-07-03 | bf0e67b | **1** |
| `claude/blockchain-discussion-2meymb` | 2026-07-25 | bfdf84e | **3** |
| `claude/branch-and-pr-default` | 2026-08-22 | dc20e2d | **1** |
| `claude/caep-app-audit-hvze9s` | 2026-07-30 | befef3a | **16** |
| `claude/caep-app-files-fwrmxd` | 2026-07-08 | 0306f70 | in main |
| `claude/caep-name-depth-ojm76t` | 2026-08-12 | fa28275 | **2** |
| `claude/caep-profitability-feedback-dw7e8x` | 2026-07-02 | d1e0cf9 | **2** |
| `claude/caep-staking-page-listings-o6z6x0` | 2026-07-25 | 2fffbcc | **2** |
| `claude/coin-discovery-links` | 2026-08-29 | 91bf660 | **2** |
| `claude/coingecko-attribution` | 2026-08-30 | 3981a01 | **3** |
| `claude/compare-all-assets` | 2026-08-29 | 8907d0b | **1** |
| `claude/crlf-and-dns-test-fixes` | 2026-09-09 | 05ed86c | **2** |
| `claude/crypto-analytics-platform-cZIf6` | 2026-05-24 | 13b1000 | **4** |
| `claude/cycle-gauge-scope` | 2026-08-29 | de05e53 | **4** |
| `claude/d3-rates-probe` | 2026-09-02 | de2d37f | **1** |
| `claude/data-gap-notes` | 2026-09-10 | 0a079ce | **3** |
| `claude/data-sources-drift` | 2026-08-30 | c977f95 | **2** |
| `claude/data-sources-regen-j1gr50` | 2026-08-25 | e062871 | **1** _(branch kept)_ |
| `claude/desktop-app-item-list-x3fb14` | 2026-07-08 | 0306f70 | in main |
| `claude/evm-rpc-dead-rungs` | 2026-09-10 | 1c0ec42 | **3** |
| `claude/finance-alternatives-cost-zrft0z` | 2026-08-08 | fdea9b8 | in main |
| `claude/finance-now-7j8i2u` | 2026-07-30 | 3542beb | in main |
| `claude/finance-wave-two-62esqa` | 2026-09-05 | 58521d1 | **2** |
| `claude/fmp-terms-scope` | 2026-09-02 | 0f1fe7e | **1** |
| `claude/gap-notice-taxonomy` | 2026-09-10 | aa6d40d | **1** |
| `claude/girls-repos-management-i0rsak` | 2026-08-11 | 8076d10 | **2** _(branch kept)_ |
| `claude/git-repo-audit-j1gr50` | 2026-08-30 | 50c78d1 | **8** |
| `claude/git-repo-management-i0rsak` | 2026-08-12 | 0b667c1 | **1** |
| `claude/implementing-recommendations-6a01xd` | 2026-08-08 | d2eb57a | **6** |
| `claude/locate-improvement-agents-2f56to` | 2026-08-04 | 3148c76 | **1** |
| `claude/market-news-search` | 2026-08-29 | a0700c4 | **2** |
| `claude/new-session-h5t7gn` | 2026-07-20 | fc719e3 | in main |
| `claude/new-session-zsz9og` | 2026-07-18 | cf4840b | in main |
| `claude/outstanding-tasks-l86xjw` | 2026-09-09 | 2284141 | **11** |
| `claude/owner-machine-verifications` | 2026-09-09 | de31068 | **1** |
| `claude/p3-w1-production-review-ojm76t` | 2026-08-12 | 1ef43dc | **4** |
| `claude/p3-w1-provenance-note-ojm76t` | 2026-08-16 | 9c9d10f | **1** |
| `claude/portfolio-all-assets` | 2026-08-29 | e446de5 | **1** |
| `claude/portfolio-fund-search` | 2026-08-29 | 1bf99e7 | **1** |
| `claude/pre-reset-record-j1gr50` | 2026-08-25 | f954d01 | **3** |
| `claude/queue-production-review-ojm76t` | 2026-08-12 | 88b867d | **1** |
| `claude/queue-sweep` | 2026-09-11 | 34a3b02 | **1** |
| `claude/r2-risk-migration` | 2026-07-20 | 2c8949c | in main |
| `claude/rates-probe-diagnostics` | 2026-09-03 | e775ec9 | **1** |
| `claude/reddit-robots-gate` | 2026-08-29 | 16a7a5d | **1** |
| `claude/remove-risk-case-studies` | 2026-07-20 | 005c828 | in main |
| `claude/responsive-usability` | 2026-05-26 | e5b5924 | **8** |
| `claude/risk-methodology` | 2026-08-30 | d85cbaf | **4** |
| `claude/roadmap-docs-accuracy-ojm76t` | 2026-08-12 | a6bc28a | **1** |
| `claude/security-next-rce-patch` | 2026-09-08 | c46b5de | **2** |
| `claude/small-bug-batch` | 2026-09-11 | b5e48b8 | **2** |
| `claude/staking-discovery-live` | 2026-07-20 | 479fccd | in main |
| `claude/staking-fallback-refresh` | 2026-09-09 | fe3905d | **3** |
| `claude/t10-crypto-ta-audit` | 2026-07-20 | 7d63777 | in main |
| `claude/t11-equity-ta-audit` | 2026-07-20 | d1c71a3 | in main |
| `claude/t12-equity-backtests` | 2026-07-20 | 3d91680 | in main |
| `claude/t2-verify-ta-math` | 2026-07-20 | 8841ea0 | in main |
| `claude/t3-compare-page` | 2026-07-20 | 77791bb | in main |
| `claude/t386-prospectus-fees` | 2026-09-10 | 7e7a8b5 | **2** |
| `claude/t4-coins-rename` | 2026-07-20 | f3ea37f | in main |
| `claude/t5-global-deroute` | 2026-07-20 | 3093daa | in main |
| `claude/t5-utility-triage` | 2026-07-20 | 9549f3c | in main |
| `claude/t8-transfer-fees-audit` | 2026-07-20 | 19b8caa | in main |
| `claude/t9-staking-audit` | 2026-07-20 | 53de5f9 | in main |
| `claude/transfer-fees-fixes` | 2026-07-20 | 5134fb9 | in main |
| `claude/uso-expense-ratio` | 2026-09-10 | 6546ac6 | **1** |
| `claude/vpn-reexamination` | 2026-09-10 | aaabe94 | **2** |
| `claude/website-work-tg4ggg` | 2026-07-27 | b6d8e94 | **1** |
| `claude/yahoo-finance-removal-terms-check-0pz88s` | 2026-08-07 | c61a676 | **2** |
| `docs/risk-scale-spec` | 2026-07-19 | 15f6eda | **1** |
| `feat/auth-phase0` | 2026-07-20 | 35cc1e3 | in main |
| `feat/live-data-audit` | 2026-07-20 | c052a07 | **2** |
| `wave-2-changes` | 2026-08-19 | fd220b1 | in main |
| `wave-3-changes` | 2026-08-22 | 69ac95d | in main |

