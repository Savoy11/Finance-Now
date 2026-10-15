# `local-wip-s1` archived, and a mirror outside OneDrive — 2026-10-14

**Applied, not proposed.** This is the dated note the standing rule in `CLAUDE.md` requires
for archiving a workstream. It closes T-017 and records the first half of T-238.

## What was found

T-017 asked whether the owner's WIP branch `local-wip-s1` still existed anywhere. The
ledger's 2026-09-07 sweep looked three times (refute, classify, tie-break), each from a
cloud clone that sees only GitHub, found nothing, and leaned toward the branch being gone,
on the 2026-08-23 repo audit's statement that every change happens in ephemeral Claude Code
sessions. That premise does not hold for sessions run on the owner's machine, whose clone
persists. There, `git branch --list` shows it:

| | |
|---|---|
| Tip | `75f4459`, 2026-08-19, *"WIP: local backtest/indicator work from a parallel session"* |
| Base | `0a5b37f`, 2026-08-08 (#75), 339 commits behind `main` on 2026-10-14 |
| Commits not reachable from any remote branch, tag or PR ref | **1** (the tip) |
| Size | 10 files, +412 / −176 |

What the commit holds that `main` does not:

- `frontend/src/components/charts/indicatorCatalog.ts` (126 lines) and its test (57 lines)
- `frontend/src/store/useThemeStore.ts` (91 lines)
- edits to the three technical-analysis pages, the hidden `/equities/backtests` page, the
  `security-ohlcv` route, `CLAUDE.md` and `package-lock.json`

Until this date it existed in one place: the local clone, inside OneDrive. No PR ref, tag or
`archive/*` branch held it. The 2026-09-11 archive found **0 of 78** branches in that state;
this is the first.

## What was done

1. **Annotated tag `archive/local-wip-s1` pushed**, pointing at `75f4459`. It is a tag
   rather than an `archive/*` branch, per the 2026-09-11 rule
   (`docs/audits/branch-archive-2026-09-11.md`). Its message says what the commit holds,
   that nothing else on GitHub preserves it, and that it should be read before the backtest
   surfaces are restored (T-016).
2. **The local branch is left as it was.** Nothing was merged into `main`, rebased or deleted.
3. **A mirror clone outside OneDrive** (T-238, `git-repo-audit-2026-08-23.md` step 7), at
   `%USERPROFILE%\Finance-Now.git` on the owner's machine: 134 branches, 237 tags and 355
   PR refs, 12 MB, `git fsck --connectivity-only` clean, `main` at `94e3058`. It was made
   after the tag, so it holds `75f4459` too.

**Refreshing the mirror never removes anything.** `git clone --mirror` sets no pruning, so
`git -C Finance-Now.git remote update` adds and moves refs and deletes none. Do not add
`--prune`: a ref deleted on GitHub would then be deleted here too, which is the one thing a
second copy exists to survive.

⚠ **Corrected 2026-10-15: that heading was true for deleted refs only** (D121). A mirror fetches
with `+refs/*:refs/*`, so a branch or tag force-moved on GitHub moves here too. A bare clone keeps
no reflog by default, so the old commits are left unreferenced, and git's automatic cleanup may
discard them after two weeks. The mirror now keeps every ref change and every object:

```
core.logAllRefUpdates      = always   # log every ref move, so an old tip stays reachable
gc.reflogExpire            = never
gc.reflogExpireUnreachable = never
gc.pruneExpire             = never    # cleanup never discards an object
remote.origin.prune        = false    # explicit, so a global fetch.prune cannot turn it on
remote.origin.pruneTags    = false
```

With these set, a refresh only adds. A Windows scheduled task, "Finance Now mirror refresh", runs
it on the 1st of each month at 10:00, or at the next chance if the machine was off. It appends each
run to `Finance-Now-mirror-refresh.log` in the user profile. Its first run on 2026-10-15 exited 0
and brought `main` to `d79e71b`.

## What it does not settle

- **Whether the work is wanted.** The indicator catalog and theme store were written against
  a `main` 339 commits older than today's; restoring any of it is a fresh piece of work, not
  a merge. That question belongs with T-016 if the owner reopens backtesting.
- **The monthly refresh** (T-238's second half) is the owner's reminder to set; nothing here
  schedules it. *(Settled 2026-10-15, D121: the owner chose a scheduled task, described above.)*

## Restore

```bash
git checkout -b local-wip-s1 archive/local-wip-s1
```
