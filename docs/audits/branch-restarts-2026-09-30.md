# Session-branch restarts — 2026-09-30

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) three
times on this date. Each time its previous work had already been **squash-merged** into
`main`, so the branch was restarted from the latest `main` for the next change rather
than stacking new commits on history `main` already holds. No unmerged work was
discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-09-30 ~03:20 | `6b4e9dc` | `094bbae` (#249, T-415 / D34) | `refs/pull/249/head`; tag `archive/ccr-3ad5880b-hsbobf` | `059cfb6` — the brace-expansion fix (#251) |
| 2026-09-30 ~09:50 | `059cfb6` | `f6299ce` (#251) | `refs/pull/251/head`; tag `archive/ccr-3ad5880b-hsbobf@059cfb6` | the T-414 change (D35–D37, #253) |
| 2026-09-30 ~10:40 | `e253f1d` | `0deb6d4` (#253) | `refs/pull/253/head`; tag `archive/ccr-3ad5880b-hsbobf@e253f1d` | the T-412 change (D38–D39) |

All three tags were created by `.github/workflows/archive-branch.yml` when the PRs merged;
the later two carry the `@<short-sha>` suffix because the name was already taken, which
is the workflow's never-overwrite rule working as designed.

## Recovering any prior state

```bash
git fetch origin refs/pull/251/head:restore-251     # or refs/pull/249/head, refs/pull/253/head
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@059cfb6   # or the plain tag
```

None is needed for anything: every squash commit is on `main`, and a squash commit
carries the whole change.

## The first restart was not recorded at the time

The 03:20 force-push happened without this note. It is recorded here, the same day,
rather than left for a later reader to reconstruct from a PR ref.
