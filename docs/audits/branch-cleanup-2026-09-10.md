# Branch cleanup — prepared 2026-09-10 (T-225, T-226)

The dated note CLAUDE.md's standing rule requires for a history-shaping operation,
written **before** the deletion rather than after it. Nothing here has been deleted;
this is the triage and the evidence for it.

## Headline: the queue's numbers were stale

T-225 says "34 orphaned + ~9 squash-merged". Measured against the live remote:

| Group | Count | Verdict |
|---|---|---|
| `archive/*` | 15 | **KEEP — never delete** (CLAUDE.md standing rule) |
| merged into `main` per git | 24 | safe |
| **squash-merged** — PR merged, git cannot tell | **39** | safe |
| open PR | 6 | leave |
| no merged PR, unique commits | 9 | reviewed below — **7 cleared, 2 for a human** |

**63 are safe to delete**, not 43.

## Why 39 branches look unmerged and are not

This repo squash-merges. A squash rewrites the commits, so `git branch --merged` will
never list the source branch even though every line of its content is in `main`. Judging
these by `--merged` alone would either strand 39 branches forever or, if someone forced
it, delete them on a hunch rather than on evidence.

They are cleared here by a different test: **their pull request is in the merged list.**

## The 9 with unique commits — 7 cleared by archive, 2 not

For each, the check was whether the archive ref already contains every commit
(`git rev-list --count <archive>..<branch>` = 0):

| Branch | Archive counterpart | Commits missing from archive |
|---|---|---|
| `claude/responsive-usability` | `archive/pre-reset/responsive-usability` | **0** |
| `claude/blockchain-discussion-2meymb` | `archive/pre-reset/blockchain-discussion-2meymb` | **0** |
| `claude/caep-profitability-feedback-dw7e8x` | `archive/pre-reset/caep-profitability-feedback-dw7e8x` | **0** |
| `feat/live-data-audit` | `archive/pre-reset/live-data-audit` | **0** |
| `claude/asset-class-connectors-lqfbnu` | `archive/pre-reset/asset-class-connectors-lqfbnu` | **0** |
| `claude/locate-improvement-agents-2f56to` | `archive/pre-reset/locate-improvement-agents-2f56to` | **0** |
| `docs/risk-scale-spec` | `archive/pre-reset/risk-scale-spec` | **0** |

Seven are fully contained in an archive branch, so deleting them loses nothing.

**Two have no archive counterpart and need your call.** Both are docs-only:

- **`claude/girls-repos-management-i0rsak`** — 2 commits, +67 lines to
  `docs/TASK-QUEUE.md`: CI verdicts closing out #57/#58, and a queue entry for **six
  dependency majors held back from a merge pass**. That queue entry may still be live —
  worth a read before this goes.
- **`claude/data-sources-regen-j1gr50`** — 1 commit, ±10 lines in `DATA-SOURCES.md`
  ("50 surfaces"). Superseded: that file regenerates with `npm run data-sources`.

## Do this in order

1. **Read the two branches above.** If the dependency-majors entry still matters, port it
   into `docs/TASK-QUEUE.md` first.
2. **T-226 first, then T-225.** Enabling auto-delete before the bulk purge stops the list
   regrowing: Settings → General → Pull Requests → *Automatically delete head branches*.
3. Delete the 63. `archive/*` must survive — every recoverability claim written before
   2026-08-05 resolves there.
4. Re-run this triage afterwards; it is reproducible and should report 0 safe-to-delete.

⚠ Do **not** delete by "unmerged" heuristic. 39 of the 63 are squash-merged and will look
unmerged forever.

## The other two GitHub-admin items

**T-236 — branch protection + secret scanning.** Settings → Branches → Add rule for
`main`: require a PR before merging, require status checks (**CI Success Gate** is the
one gate that covers the others), and dismiss stale approvals. Then Settings → Code
security → enable **Secret scanning** and **Push protection**. Push protection is the one
that matters most here: this repo writes provider keys to gitignored files, and push
protection is what catches the day one of them is not ignored.

**T-102 — require Code Owners review.** Same branch-protection rule: *Require review from
Code Owners*. `.github/CODEOWNERS` already exists, so this only turns on enforcement.

⚠ Note the interaction with how this repo actually works: requiring review on `main` while
you are the only reviewer means every PR needs your explicit approval before merge, not
just a "merge" instruction. That is the intended effect of T-102, but it will change the
flow used all through 2026-09.
