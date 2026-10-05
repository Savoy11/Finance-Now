# Session-branch restarts — 2026-10-05

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-04.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) once on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-05 ~00:01 | `9a7b17c` | `9259a2e` (#285: D75) | `refs/pull/285/head`; tag `archive/ccr-3ad5880b-hsbobf@9a7b17c` | T-355 parked under D18 (D76), restarted from `9259a2e` |

The tag was created by `.github/workflows/archive-branch.yml` when #285 merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/285/head:restore-285
git checkout -b ccr-restore-285 archive/ccr-3ad5880b-hsbobf@9a7b17c
```

Neither is needed for anything: the squash commit `9259a2e` is on `main` and carries the
whole change.
