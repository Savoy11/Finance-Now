# Session-branch restarts — 2026-10-01

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-09-30.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) three times on
this date. Each time its previous work had already been **squash-merged** into `main`, so the branch was
restarted from the latest `main` for the next change rather than stacking new commits on
history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-01 ~02:00 | `d06d528` | `30f5d73` (#256, D49 / D50) | `refs/pull/256/head`; tag `archive/ccr-3ad5880b-hsbobf@d06d528` | the market-hours change (TS-9), restarted from `7c29619` (#257 had merged since) |
| 2026-10-01 ~05:00 | `62b00b1` | `f7668d3` (#258, TS-9) | `refs/pull/258/head`; tag `archive/ccr-3ad5880b-hsbobf@62b00b1` | the About & Legal pages (T-293, D50), restarted from `f7668d3` |
| 2026-10-01 ~10:30 | `f348a12` | `94b338a` (#259, T-293 / D50) | `refs/pull/259/head`; tag `archive/ccr-3ad5880b-hsbobf@f348a12` | the Series A closures (D51) and the transfer-fee check page for T-031 (D52), restarted from `94b338a` |

All three tags were created by `.github/workflows/archive-branch.yml` when their PRs merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/256/head:restore-256     # or refs/pull/258/head, refs/pull/259/head
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@d06d528   # or …@62b00b1, …@f348a12
```

None is needed for anything: the squash commits `30f5d73`, `f7668d3` and `94b338a` are on
`main` and carry the whole changes.
