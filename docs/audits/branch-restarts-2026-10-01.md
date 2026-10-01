# Session-branch restarts — 2026-10-01

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-09-30.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) on this
date. Its previous work had already been **squash-merged** into `main`, so the branch was
restarted from the latest `main` for the next change rather than stacking new commits on
history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-01 ~02:00 | `d06d528` | `30f5d73` (#256, D49 / D50) | `refs/pull/256/head`; tag `archive/ccr-3ad5880b-hsbobf@d06d528` | the market-hours change (TS-9), restarted from `7c29619` (#257 had merged since) |

The tag was created by `.github/workflows/archive-branch.yml` when #256 merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/256/head:restore-256
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@d06d528
```

Neither is needed for anything: the squash commit `30f5d73` is on `main` and carries the
whole change.
