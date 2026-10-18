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

## Third reset, after PR #377

**What was done.** After PR #377 (the three prompt changes and two Staking Facts Check rows) was
squash-merged into `main` as `7650d23`, the branch was restarted from that commit for a fix to the
Staking Facts Check's wording about those rows, and pushed with `--force-with-lease`, for the same
reason as above.

**Where the prior state lives.** The branch's previous tip, `b7df21e`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@b7df21e`, created by
  `.github/workflows/archive-branch.yml` when #377 merged;
- GitHub's `refs/pull/377/head`;
- its content in `main` as `7650d23`.

Nothing was deleted; no other ref moved.

## Fourth reset, after PR #378

**What was done.** After PR #378 (the Staking Facts Check naming which check raised each Start
here row) was squash-merged into `main` as `20047f1`, the branch was restarted from that commit
for a ledger correction to T-129, and pushed with `--force-with-lease`, for the same reason as
above.

**Where the prior state lives.** The branch's previous tip, `ec414a1`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@ec414a1`, created by
  `.github/workflows/archive-branch.yml` when #378 merged;
- GitHub's `refs/pull/378/head`;
- its content in `main` as `20047f1`.

Nothing was deleted; no other ref moved.

## Fifth reset, after PR #379

**What was done.** After PR #379 (the T-129 ledger correction) was squash-merged into `main` as
`01503eb`, the branch was restarted from that commit for the second agent run's record and fixes,
and pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `a11686a`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@a11686a`, created by
  `.github/workflows/archive-branch.yml` when #379 merged;
- GitHub's `refs/pull/379/head`;
- its content in `main` as `01503eb`.

Nothing was deleted; no other ref moved.

## Sixth reset, after PR #380

**What was done.** After PR #380 (the second agent run: worked-out curve changes, the staking
catalog's wording) was squash-merged into `main` as `249bdf8`, the branch was restarted from that
commit for T-441 (FMP's price history on the same basis as Tiingo's), and pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `b339a58`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@b339a58`, created by
  `.github/workflows/archive-branch.yml` when #380 merged;
- GitHub's `refs/pull/380/head`;
- its content in `main` as `249bdf8`.

Nothing was deleted; no other ref moved.
