# Branch reset — `claude/vibrant-faraday-3xo7mo`, 2026-10-18

The standing rule in `CLAUDE.md` ("How Changes Land") asks that any force-push land with a dated
note saying what was done and where the prior state lives. This is that note. The ten resets
before it, and the reason for them, are in `branch-reset-2026-10-17.md`.

**What was done.** After PR #375 (the agent evaluation script fixes) was squash-merged into `main`
as `6aa0080`, the branch was restarted from that commit for the fixes the agent evaluation found
and pushed with `--force-with-lease`. A merged pull request cannot carry new work, and stacking new
commits on its already-merged history would have repeated #375's commit in the next pull request.

**Where the prior state lives.** The branch's previous tip, `ba4607a`, its only commit beyond
`8c9bd8b`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@ba4607a`, created by
  `.github/workflows/archive-branch.yml` when #375 merged;
- GitHub's `refs/pull/375/head`;
- its content in `main` as `6aa0080`.

Nothing was deleted; no other ref moved.

## Second reset, after PR #376

**What was done.** After PR #376 (the fixes the agent evaluation found in the app and its data) was
squash-merged into `main` as `b554990`, the branch was restarted from that commit for the three
prompt changes and the two Staking Facts Check rows, and pushed with `--force-with-lease`, for the
same reason as above.

**Where the prior state lives.** The branch's previous tip, `83b6794`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@83b6794`, created by
  `.github/workflows/archive-branch.yml` when #376 merged;
- GitHub's `refs/pull/376/head`;
- its content in `main` as `b554990`.

Nothing was deleted; no other ref moved.
