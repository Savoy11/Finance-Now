# Session-branch restarts — 2026-10-03

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-01.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) once on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-03 ~10:50 | `61990cc` | `63d34a5` (#262, NT6) | `refs/pull/262/head`; tag `archive/ccr-3ad5880b-hsbobf@61990cc` | the tokenized-securities news tags (TS-13), restarted from `63d34a5` |

The tag was created by `.github/workflows/archive-branch.yml` when #262 merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/262/head:restore-262
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@61990cc
```

Neither is needed for anything: the squash commit `63d34a5` is on `main` and carries the
whole change.
