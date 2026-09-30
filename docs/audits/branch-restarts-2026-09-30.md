# Session-branch restarts — 2026-09-30

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) twice
on this date. Each time its previous work had already been **squash-merged** into
`main`, so the branch was restarted from the latest `main` for the next change rather
than stacking new commits on history `main` already holds. No unmerged work was
discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-09-30 ~03:20 | `6b4e9dc` | `094bbae` (#249, T-415 / D34) | `refs/pull/249/head`; tag `archive/ccr-3ad5880b-hsbobf` | `059cfb6` — the brace-expansion fix (#251) |
| 2026-09-30 (this note's PR) | `059cfb6` | `f6299ce` (#251) | `refs/pull/251/head`; tag `archive/ccr-3ad5880b-hsbobf@059cfb6` | the T-414 change (D35–D37) |

Both tags were created by `.github/workflows/archive-branch.yml` when the PRs merged;
the second carries the `@<short-sha>` suffix because the name was already taken, which
is the workflow's never-overwrite rule working as designed.

## Recovering either state

```bash
git fetch origin refs/pull/251/head:restore-251     # or refs/pull/249/head
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@059cfb6   # or the plain tag
```

Neither is needed for anything: both squash commits are on `main`, and a squash commit
carries the whole change.

## The first restart was not recorded at the time

The 03:20 force-push happened without this note. It is recorded here, the same day,
rather than left for a later reader to reconstruct from a PR ref.
