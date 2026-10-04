# Session-branch restarts — 2026-10-04

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-03.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) once on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-04 ~06:17 | `b469f15` | `a6264e5` (#264: TS-13, D53, D54, D55) | `refs/pull/264/head`; tag `archive/ccr-3ad5880b-hsbobf@b469f15` | Portfolio Builder plan history and printable rebalance notes (T-065, T-066; D56), restarted from `a6264e5` |

The tag was created by `.github/workflows/archive-branch.yml` when #264 merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/264/head:restore-264
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@b469f15
```

Neither is needed for anything: the squash commit `a6264e5` is on `main` and carries the
whole change.
