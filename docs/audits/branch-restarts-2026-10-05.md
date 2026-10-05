# Session-branch restarts — 2026-10-05

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-04.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) twice on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-05 ~00:01 | `9a7b17c` | `9259a2e` (#285: D75) | `refs/pull/285/head`; tag `archive/ccr-3ad5880b-hsbobf@9a7b17c` | T-355 parked under D18 (D76), restarted from `9259a2e` |
| 2026-10-05 ~00:32 | `a967c13` | `4f428d4` (#286: D76) | `refs/pull/286/head`; tag `archive/ccr-3ad5880b-hsbobf@a967c13` | T-357 closed into the risk engine rebuild (D77), restarted from `4f428d4` |

Each tag was created by `.github/workflows/archive-branch.yml` when its PR merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/285/head:restore-285
git checkout -b ccr-restore-285 archive/ccr-3ad5880b-hsbobf@9a7b17c

git fetch origin refs/pull/286/head:restore-286
git checkout -b ccr-restore-286 archive/ccr-3ad5880b-hsbobf@a967c13
```

None of these is needed for anything: the squash commits `9259a2e` and `4f428d4` are on
`main` and carry the whole of each change.
