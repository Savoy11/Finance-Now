# Branch reset — `claude/vibrant-faraday-3xo7mo`, 2026-10-17

The standing rule in `CLAUDE.md` ("How Changes Land") asks that any force-push land with a dated
note saying what was done and where the prior state lives. This is that note.

**What was done.** After PR #365 (T-436) was squash-merged into `main` as `117140d`, the branch
was restarted from that `main` commit for the next piece of work (T-407, Bitget, D129) and pushed
with `--force-with-lease`. A merged pull request cannot carry new work, and stacking new commits
on its already-merged history would have repeated #365's four commits in the next pull request.

**Where the prior state lives.** The branch's previous tip, `9e78d15`, and the three commits
before it are held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo`, created by
  `.github/workflows/archive-branch.yml` when #365 merged (it points at `9e78d15`);
- GitHub's `refs/pull/365/head`, which survives any change to the branch;
- their combined content in `main` as `117140d`.

Nothing was deleted; no other ref moved.

## Second reset, the same day

**What was done.** After PR #366 (T-407: Bitget and XT.com stopped, KuCoin kept; D129–D131) was
squash-merged into `main` as `658c092`, the branch was restarted from that commit for the XT.com
card on the Transfer Fee Check page and pushed with `--force-with-lease`, for the same reason as
above.

**Where the prior state lives.** The branch's previous tip, `5f1e6c6`, and the commit before it
(`8e2a36d`) are held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@5f1e6c6`, created by
  `.github/workflows/archive-branch.yml` when #366 merged (the earlier tag name was taken, so the
  workflow added the short SHA rather than overwrite it);
- GitHub's `refs/pull/366/head`;
- their combined content in `main` as `658c092`.

Nothing was deleted; no other ref moved.

## Third reset, the same day

**What was done.** After PR #367 (the XT.com card on the Transfer Fee Check page) was
squash-merged into `main` as `3a10234`, the branch was restarted from that commit for T-440's
Fund Figures Check page (D132) and pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `817a02a`, its only commit beyond
`658c092`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@817a02a`, created by
  `.github/workflows/archive-branch.yml` when #367 merged;
- GitHub's `refs/pull/367/head`;
- its content in `main` as `3a10234`.

Nothing was deleted; no other ref moved.

## Fourth reset, the same day

**What was done.** After PR #368 (the Fund Figures Check page, T-440, D132) was
squash-merged into `main` as `61b2462`, the branch was restarted from that commit for
D133 (Investing.com's feeds stopped) and pushed with `--force-with-lease`, for the same
reason as above.

**Where the prior state lives.** The branch's previous tip, `faac217`, and the commit before
it (`17a479d`) are held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@faac217`, created by
  `.github/workflows/archive-branch.yml` when #368 merged;
- GitHub's `refs/pull/368/head`;
- their combined content in `main` as `61b2462`.

Nothing was deleted; no other ref moved.

## Fifth reset, the same day

**What was done.** After PR #369 (Investing.com's feeds stopped, D133) was squash-merged into
`main` as `e7a7812`, the branch was restarted from that commit for T-394's Staking Facts Check
page (D134) and pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `e3f4d68`, its only commit beyond
`61b2462`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@e3f4d68`, created by
  `.github/workflows/archive-branch.yml` when #369 merged;
- GitHub's `refs/pull/369/head`;
- its content in `main` as `e7a7812`.

Nothing was deleted; no other ref moved.
