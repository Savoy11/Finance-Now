# Session-branch restarts — 2026-10-05

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-04.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) four times on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-05 ~00:01 | `9a7b17c` | `9259a2e` (#285: D75) | `refs/pull/285/head`; tag `archive/ccr-3ad5880b-hsbobf@9a7b17c` | T-355 parked under D18 (D76), restarted from `9259a2e` |
| 2026-10-05 ~00:32 | `a967c13` | `4f428d4` (#286: D76) | `refs/pull/286/head`; tag `archive/ccr-3ad5880b-hsbobf@a967c13` | T-357 closed into the risk engine rebuild (D77), restarted from `4f428d4` |
| 2026-10-05 ~10:40 | `9fda000` | `51118c3` (#287: D77) | `refs/pull/287/head`; tag `archive/ccr-3ad5880b-hsbobf@9fda000` | The hosting and paid-data groups parked and the T-395 note applied (D78, D79, D80), restarted from `51118c3` |
| 2026-10-05 ~11:08 | `c400dd9` | `0e4814d` (#288: D78–D80) | `refs/pull/288/head`; tag `archive/ccr-3ad5880b-hsbobf@c400dd9` | The parked list tidied (D81–D84), restarted from `0e4814d` |

Each tag was created by `.github/workflows/archive-branch.yml` when its PR merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/285/head:restore-285
git checkout -b ccr-restore-285 archive/ccr-3ad5880b-hsbobf@9a7b17c

git fetch origin refs/pull/286/head:restore-286
git checkout -b ccr-restore-286 archive/ccr-3ad5880b-hsbobf@a967c13

git fetch origin refs/pull/287/head:restore-287
git checkout -b ccr-restore-287 archive/ccr-3ad5880b-hsbobf@9fda000

git fetch origin refs/pull/288/head:restore-288
git checkout -b ccr-restore-288 archive/ccr-3ad5880b-hsbobf@c400dd9
```

None of these is needed for anything: the squash commits `9259a2e`, `4f428d4`, `51118c3` and
`0e4814d` are on `main` and carry the whole of each change.
