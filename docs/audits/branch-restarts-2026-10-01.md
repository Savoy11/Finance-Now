# Session-branch restarts — 2026-10-01

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-09-30.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) twice on
this date. Each time its previous work had already been **squash-merged** into `main`, so the branch was
restarted from the latest `main` for the next change rather than stacking new commits on
history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-01 ~02:00 | `d06d528` | `30f5d73` (#256, D49 / D50) | `refs/pull/256/head`; tag `archive/ccr-3ad5880b-hsbobf@d06d528` | the market-hours change (TS-9), restarted from `7c29619` (#257 had merged since) |
| 2026-10-01 ~05:00 | `62b00b1` | `f7668d3` (#258, TS-9) | `refs/pull/258/head`; tag `archive/ccr-3ad5880b-hsbobf@62b00b1` | the About & Legal pages (T-293, D50), restarted from `f7668d3` |

Both tags were created by `.github/workflows/archive-branch.yml` when their PRs merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/256/head:restore-256     # or refs/pull/258/head
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@d06d528   # or …@62b00b1
```

None is needed for anything: the squash commits `30f5d73` and `f7668d3` are on `main` and
carry the whole changes.
