# Session-branch restarts — 2026-10-04

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-03.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) four times on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-04 ~06:17 | `b469f15` | `a6264e5` (#264: TS-13, D53, D54, D55) | `refs/pull/264/head`; tag `archive/ccr-3ad5880b-hsbobf@b469f15` | Portfolio Builder plan history and printable rebalance notes (T-065, T-066; D56), restarted from `a6264e5` |
| 2026-10-04 ~06:46 | `993c2d0` | `f498966` (#266: T-065, T-066, D56) | `refs/pull/266/head`; tag `archive/ccr-3ad5880b-hsbobf@993c2d0` | T-192 parked with its siblings (D57), restarted from `f498966` |
| 2026-10-04 ~11:47 | `a7184af` | `7be3b3e` (#267: D57, D58) | `refs/pull/267/head`; tag `archive/ccr-3ad5880b-hsbobf@a7184af` | T-204 parked with the hosting decision (D59), restarted from `7be3b3e` |
| 2026-10-04 ~13:20 | `b99818d` | `fc58ef3` (#268: D59, D60) | `refs/pull/268/head`; tag `archive/ccr-3ad5880b-hsbobf@b99818d` | T-393's open cycle row corrected and the item parked (D61), restarted from `fc58ef3` |

Each tag was created by `.github/workflows/archive-branch.yml` when its PR merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/264/head:restore-264
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@b469f15

git fetch origin refs/pull/266/head:restore-266
git checkout -b ccr-restore-266 archive/ccr-3ad5880b-hsbobf@993c2d0

git fetch origin refs/pull/267/head:restore-267
git checkout -b ccr-restore-267 archive/ccr-3ad5880b-hsbobf@a7184af

git fetch origin refs/pull/268/head:restore-268
git checkout -b ccr-restore-268 archive/ccr-3ad5880b-hsbobf@b99818d
```

None of these is needed for anything: the squash commits `a6264e5`, `f498966`,
`7be3b3e` and `fc58ef3` are on `main` and carry the whole of each change.
