# Session-branch restarts — 2026-10-07

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-05.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) three
times on this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-07 ~00:19 | `3b5b00d` | `e8c0a8a` (#290: D85) | `refs/pull/290/head`; tag `archive/ccr-3ad5880b-hsbobf@3b5b00d` | The open-items review (D86–D91), restarted from `e8c0a8a` |
| 2026-10-07 ~01:05 | `ba469e6` | `251916c` (#291: D86–D91) | `refs/pull/291/head`; tag `archive/ccr-3ad5880b-hsbobf@ba469e6` | T-293, the short not-advice lines beside features, restarted from `251916c` |
| 2026-10-07 ~01:30 | `0cb311a` | `cc94d8b` (#296: T-293) | `refs/pull/296/head`; tag `archive/ccr-3ad5880b-hsbobf@0cb311a` | T-421, splits in tracked portfolios, restarted from `cc94d8b` |

Each tag was created by `.github/workflows/archive-branch.yml` when its PR merged.

On 2026-10-06 the local branch was briefly moved onto `main` and then pointed back at
`3b5b00d`, so that nothing would be pushed before the owner's answer; nothing on the remote
changed that day.

## Recovering the prior state

```bash
git fetch origin refs/pull/290/head:restore-290
git checkout -b ccr-restore-290 archive/ccr-3ad5880b-hsbobf@3b5b00d

git fetch origin refs/pull/291/head:restore-291
git checkout -b ccr-restore-291 archive/ccr-3ad5880b-hsbobf@ba469e6

git fetch origin refs/pull/296/head:restore-296
git checkout -b ccr-restore-296 archive/ccr-3ad5880b-hsbobf@0cb311a
```

Not needed for anything: the squash commits `e8c0a8a`, `251916c` and `cc94d8b` are on `main`
and carry the whole of each change.
