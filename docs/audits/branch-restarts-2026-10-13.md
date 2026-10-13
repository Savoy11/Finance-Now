# Branch rebase — 2026-10-13

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-07.md`, with one difference: this branch was rebased **before** its
PR merged, not restarted after. The owner asked for this note once the merge had landed.

PRs #329 and #330 were open together and both appended to the ledger
(`docs/audits/task-queue-2026-09-07.json`). After #329 merged, #330's branch
`scanner-launch-sources` was rebased onto the new `main` and force-pushed
(`--force-with-lease`). The ledger conflict was resolved by taking `main`'s file and
re-running #330's ledger edit on it, not by hand. No other PR was force-pushed that day;
the PR timelines of #326–#330 were checked for `head_ref_force_pushed`.

| When (UTC) | Tip replaced | Replaced by | Its work landed on `main` as | Prior tip is held by |
|---|---|---|---|---|
| 2026-10-13 16:59:35 | `36a47d4` (on `ccac69e`) | `c8d8060` (on `1f8d067`) | `f8e3ac2` (#330: T-423 step b) | tag `archive/scanner-launch-sources@36a47d4` |

**What differed:** only the ledger hunk's surrounding context, where #329 had added its own
annotation pass (`git range-diff ccac69e..36a47d4 1f8d067..c8d8060`). The code, the tests
and the other records are the same in both.

**Why a tag was needed:** `CLAUDE.md` says an archive tag earns its keep only where no PR ref
holds the commits, and a rebase before merge makes that case. The push moved
`refs/pull/330/head` to the new tip, so unlike the restarts in the earlier notes, no ref held
`36a47d4` afterwards; it lay only among GitHub's unreferenced objects and in a local reflog. The tag was created by hand, named the way
`.github/workflows/archive-branch.yml` names a second tip for one branch. The workflow's own
tag, `archive/scanner-launch-sources`, holds the merged tip `c8d8060`.

## Recovering the prior state

```bash
git fetch origin --tags
git checkout -b scanner-launch-sources-pre-rebase archive/scanner-launch-sources@36a47d4
```

Not needed for anything: the squash commit `f8e3ac2` is on `main` and carries the whole change.
