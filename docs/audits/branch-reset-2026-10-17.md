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
