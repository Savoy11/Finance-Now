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

## Seventh reset, after PR #381 (2026-10-19)

**What was done.** After PR #381 (FMP's price history on Tiingo's basis, T-441) was squash-merged
into `main` as `4cbe0fe`, the branch was restarted from that commit for the dead-code cleanup the
owner approved on 2026-10-19 (T-129's two parked coin filters, `ohlcvAdjust.ts`), and pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `0ff18f6`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@0ff18f6`, created by
  `.github/workflows/archive-branch.yml` when #381 merged;
- GitHub's `refs/pull/381/head`;
- its content in `main` as `4cbe0fe`.

Nothing was deleted; no other ref moved.

## Eighth reset, after PR #382 (2026-10-19)

**What was done.** After PR #382 (the Coins page's dead filter fields and `ohlcvAdjust.ts`, T-129,
D139) was squash-merged into `main` as `ae771f0`, the branch was restarted from that commit for the
site terms check (D140), and pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `7200270`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@7200270`, created by
  `.github/workflows/archive-branch.yml` when #382 merged;
- GitHub's `refs/pull/382/head`;
- its content in `main` as `ae771f0`.

Nothing was deleted; no other ref moved.

## Ninth reset, after PR #383 (2026-10-19)

**What was done.** After PR #383 (the site terms check, D140) was squash-merged into `main` as
`29c9236`, the branch was restarted from that commit for a fix to that script found on its first
real run (it did not say where the key Anthropic refused came from), and pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `b937443`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@b937443`, created by
  `.github/workflows/archive-branch.yml` when #383 merged;
- GitHub's `refs/pull/383/head`;
- its content in `main` as `29c9236`.

Nothing was deleted; no other ref moved.

## Tenth reset, after PR #385 (2026-10-20)

**What was done.** After PR #385 (why an Anthropic key was refused: the site terms script and
the Integrations Test button) was squash-merged into `main` as `1bc122b`, the branch was
restarted from that commit for the owner's next request: make that Test button run the kind of
request the agents make, since listing models had passed a key no agent could use. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `2dce1b6`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@2dce1b6`, created by
  `.github/workflows/archive-branch.yml` when #385 merged;
- GitHub's `refs/pull/385/head`;
- its content in `main` as `1bc122b`.

Nothing was deleted; no other ref moved.

## Eleventh reset, after PR #386 (2026-10-20)

**What was done.** After PR #386 (the Integrations Test button tests an Anthropic key with a real
one-word request) was squash-merged into `main` as `8ed2ec9`, the branch was restarted from that
commit for a fix to the site terms script found on its first paid run: the agent ran out of page
opens before it reached Kraken's and Vanguard's terms. Pushed with `--force-with-lease`, for the
same reason as above.

**Where the prior state lives.** The branch's previous tip, `4a303db`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@4a303db`, created by
  `.github/workflows/archive-branch.yml` when #386 merged;
- GitHub's `refs/pull/386/head`;
- its content in `main` as `8ed2ec9`.

Nothing was deleted; no other ref moved.

## Twelfth reset, after PR #387 (2026-10-21)

**What was done.** After PR #387 (the site terms check hands the agent the terms links and says
when it ran out) was squash-merged into `main` as `36793d8`, the branch was restarted from that
commit for a fix found on the full paid run: on 22 sites every web tool call failed with an
input error, and the run recorded no error codes to say why. Pushed with `--force-with-lease`,
for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `2e25a5c`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@2e25a5c`, created by
  `.github/workflows/archive-branch.yml` when #387 merged;
- GitHub's `refs/pull/387/head`;
- its content in `main` as `36793d8`.

Nothing was deleted; no other ref moved.

## Thirteenth reset, after PR #388 (2026-10-21)

**What was done.** After PR #388 (the site terms check keeps the web tools' error codes and
re-reads sites whose tools failed) was squash-merged into `main` as `88c8290`, the branch was
restarted from that commit for the owner's next request: make the basic web tools the default,
since the error codes that PR kept showed the newer versions failing on 9 of 10 sites and the
basic ones on none of 22. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `2415f25`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@2415f25`, created by
  `.github/workflows/archive-branch.yml` when #388 merged;
- GitHub's `refs/pull/388/head`;
- its content in `main` as `88c8290`.

Nothing was deleted; no other ref moved.

## Fourteenth reset, after PR #389 (2026-10-21)

**What was done.** After PR #389 (the site terms check uses the basic web tools by default) was
squash-merged into `main` as `4e0b887`, the branch was restarted from that commit for the next
step: keeping the owner's rulings on the site terms worksheet in their own file, since every
paid run rewrites the worksheet and would have wiped boxes ticked by hand. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `772d17a`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@772d17a`, created by
  `.github/workflows/archive-branch.yml` when #389 merged;
- GitHub's `refs/pull/389/head`;
- its content in `main` as `4e0b887`.

Nothing was deleted; no other ref moved.

## Fifteenth reset, after PR #390 (2026-10-21)

**What was done.** After PR #390 (the site terms check keeps the owner's rulings in their own
file) was squash-merged into `main` as `f244259`, the branch was restarted from that commit for
the next step: the Fund Figures Check pre-fill, built as a trial on the four sites the owner then
ruled Allowed (D141). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `265f68f`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@265f68f`, created by
  `.github/workflows/archive-branch.yml` when #390 merged;
- GitHub's `refs/pull/390/head`;
- its content in `main` as `f244259`.

Nothing was deleted; no other ref moved.

## Sixteenth reset, after PR #391 (2026-10-21)

**What was done.** After PR #391 (the Fund Figures Check pre-fill trial) was squash-merged into
`main` as `49b8577`, the branch was restarted from that commit for the next step: the trial's
first run on the owner's machine was refused before reading anything, because the newer models
answer a forced tool choice with a 400, so the pre-fill now asks for its answer as structured
output. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `6a6594f`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@6a6594f`, created by
  `.github/workflows/archive-branch.yml` when #391 merged;
- GitHub's `refs/pull/391/head`;
- its content in `main` as `49b8577`.

Nothing was deleted; no other ref moved.

## Seventeenth reset, after PR #392 (2026-10-21)

**What was done.** After PR #392 (the pre-fill asks for structured output, not a forced tool) was
squash-merged into `main` as `4ab31c5`, the branch was restarted from that commit for the next
step: the trial's second run on the owner's machine read SPY correctly but left VOO's net assets
unanswered and quoted VOO's yield by its date alone, so the answer form now has one required slot
per figure. This restart was made on the owner's machine, not in a cloud session. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `75ab109`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@75ab109`, created by
  `.github/workflows/archive-branch.yml` when #392 merged;
- GitHub's `refs/pull/392/head`;
- its content in `main` as `4ab31c5`.

Nothing was deleted; no other ref moved.

## Eighteenth reset, after PR #393 (2026-10-21)

**What was done.** After PR #393 (one required answer per figure) was squash-merged into `main`
as `51114a2`, the branch was restarted from that commit on the owner's machine for the next
step: the third trial run answered both of VOO's figures but quoted each one's date entry, so
page data is now laid out one sorted line per value. Pushed with `--force-with-lease`, for the
same reason as above.

**Where the prior state lives.** The branch's previous tip, `8b7dd0f`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@8b7dd0f`, created by
  `.github/workflows/archive-branch.yml` when #393 merged;
- GitHub's `refs/pull/393/head`;
- its content in `main` as `51114a2`.

Nothing was deleted; no other ref moved.

## Nineteenth reset, after PR #394 (2026-10-21)

**What was done.** After PR #394 (page data laid out one line per value) was squash-merged into
`main` as `76dc793`, the branch was restarted from that commit on the owner's machine for the
next step: the full pre-fill run answered three Vanguard bond funds' yields from one payment's
yield in a list of recent distributions, so that is now refused. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `9457684`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@9457684`, created by
  `.github/workflows/archive-branch.yml` when #394 merged;
- GitHub's `refs/pull/394/head`;
- its content in `main` as `76dc793`.

Nothing was deleted; no other ref moved.
## Twentieth reset, after PR #396 (2026-10-21)

**What was done.** After PR #396 (one payment's yield refused as a yield) was squash-merged into
`main` as `65f9d69`, the branch was restarted from that commit on the owner's machine for the
next step: a page that lays the pre-fill's suggestions out for the owner to read beside the
Fund Figures Check. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `ba8c172`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@ba8c172`, created by
  `.github/workflows/archive-branch.yml` when #396 merged;
- GitHub's `refs/pull/396/head`;
- its content in `main` as `65f9d69`.

Nothing was deleted; no other ref moved.

## Twenty-first reset, after PR #397 (2026-10-21)

**What was done.** After PR #397 (a page to read the pre-fill's suggestions by) was
squash-merged into `main` as `b9dd44e`, and dependabot's #395 and #384 after it, the branch was
restarted from `main` (`5d0980f`) on the owner's machine for the next step: updating the frozen
backend's lockfile so the security scanner's open alerts close. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `347c4ed`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@347c4ed`, created by
  `.github/workflows/archive-branch.yml` when #397 merged;
- GitHub's `refs/pull/397/head`;
- its content in `main` as `b9dd44e`.

Nothing was deleted; no other ref moved.

## Twenty-second reset, after PR #399 (2026-10-21)

**What was done.** After PR #399 (the frozen backend's locked packages updated to clear the
security scan's alerts) was squash-merged into `main` as `b4c7588`, the branch was restarted
from that commit on the owner's machine for the next step: showing the pre-fill's suggestions
on the Fund Figures Check's cards. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `f198cc3`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@f198cc3`, created by
  `.github/workflows/archive-branch.yml` when #399 merged;
- GitHub's `refs/pull/399/head`;
- its content in `main` as `b4c7588`.

Nothing was deleted; no other ref moved.

## Twenty-third reset, after PR #400 (2026-10-21)

**What was done.** After PR #400 (the pre-fill's suggestions shown on the Fund Figures Check's
cards) was squash-merged into `main` as `b63cebd`, the branch was restarted from that commit on
the owner's machine for the next step: the three check-page plans could not read a real export
of the page's database on Windows, where `:` is saved in a file name as `%3A`. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `c0333f4`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@c0333f4`, created by
  `.github/workflows/archive-branch.yml` when #400 merged;
- GitHub's `refs/pull/400/head`;
- its content in `main` as `b63cebd`.

Nothing was deleted; no other ref moved.

## Twenty-fourth reset, after PR #401 (2026-10-21)

**What was done.** After PR #401 (the check-page plans read a saved export's ids from its file
names) was squash-merged into `main` as `bf7cff2`, the branch was restarted from that commit on
the owner's machine for the next step: putting the Fund Figures Check's first 60 readings into
the fund catalog, as the owner approved. Pushed with `--force-with-lease`, for the same reason
as above.

**Where the prior state lives.** The branch's previous tip, `fb5f6a6`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@fb5f6a6`, created by
  `.github/workflows/archive-branch.yml` when #401 merged;
- GitHub's `refs/pull/401/head`;
- its content in `main` as `bf7cff2`.

Nothing was deleted; no other ref moved.

## Twenty-fifth reset, after PR #402 (2026-10-21)

**What was done.** After PR #402 (the Fund Figures Check's first 60 readings, dated, in the
fund catalog) was squash-merged into `main` as `4fd22a6`, the branch was restarted from that
commit on the owner's machine for the next step: recording the day's work in the task-queue
ledger and the day's owner decisions (D142–D145), as the owner approved. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `b3fed81`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@b3fed81`, created by
  `.github/workflows/archive-branch.yml` when #402 merged;
- GitHub's `refs/pull/402/head`;
- its content in `main` as `4fd22a6`.

Nothing was deleted; no other ref moved.

## Twenty-sixth reset, after PR #403 (2026-10-22)

**What was done.** After PR #403 (the ledger brought up to 2026-10-21) was squash-merged into
`main` as `d407e94`, the branch was restarted from that commit on the owner's machine for the
next step: recording the 2026-10-22 site rulings and the readers the owner chose not to build
(D146–D148). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `377d83f`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@377d83f`, created by
  `.github/workflows/archive-branch.yml` when #403 merged;
- GitHub's `refs/pull/403/head`;
- its content in `main` as `d407e94`.

Nothing was deleted; no other ref moved.

## Twenty-seventh reset, after PR #404 (2026-10-22)

**What was done.** After PR #404 (the 2026-10-22 site rulings, D146–D148) was squash-merged into
`main` as `c7121dd`, the branch was restarted from that commit on the owner's machine for the
next step: the staking pre-fill, the pre-fills' shared fetch gate, and the decisions behind them
(D149–D154). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `60802db`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@60802db`, created by
  `.github/workflows/archive-branch.yml` when #404 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/404/head`;
- its content in `main` as `c7121dd`.

Nothing was deleted; no other ref moved.

## Twenty-eighth reset, after PR #405 (2026-10-22)

**What was done.** After PR #405 (the staking pre-fill and D149–D154) was squash-merged into
`main` as `3d2e387`, the branch was restarted from that commit on the owner's machine for the
ledger pass that records it (T-394, T-440, D155). Pushed with `--force-with-lease`, for the same
reason as above.

**Where the prior state lives.** The branch's previous tip, `8ada0c0`, is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@8ada0c0`, created by
  `.github/workflows/archive-branch.yml` when #405 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/405/head`;
- its content in `main` as `3d2e387`.

**One more archive the same day, by hand.** Dependabot's #398 was closed unmerged (D155). Before
closing, `archive-branch.yml` was run by hand (`workflow_dispatch`, run 39867978716) and created
`archive/dependabot/pip/backend/certifi-2026.10.19` → `51b1443` (tag object `765c3fd`), checked on
the remote. The branch itself was left alone; GitHub's `refs/pull/398/head` also holds the commit.

Nothing was deleted; no other ref moved.

## Twenty-ninth reset, after PR #406 (2026-10-24)

**What was done.** After PR #406 (the ledger pass for D149–D155) was squash-merged into `main` as
`7404ed6`, and Dependabot's #408 after it as `2f6b6cd`, the branch was restarted from `2f6b6cd` on
the owner's machine for the screener walkthrough (T-129). Pushed with `--force-with-lease`, for the
same reason as above.

**Where the prior state lives.** The branch's previous tip, `3cf7b57` (#406's last commit, the merge
of `main` that `gh pr update-branch` added), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@3cf7b57`, created by
  `.github/workflows/archive-branch.yml` when #406 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/406/head`;
- its content in `main` as `7404ed6`.

#408's branch was archived the same way when it merged:
`archive/dependabot/npm_and_yarn/mcp-server/ip-address-10.7.4` → `8243fdd`, checked on the remote.

Nothing was deleted; no other ref moved.

## Thirtieth reset, after PR #409 (2026-10-24)

**What was done.** After PR #410 (the dependency fixes, D156) was squash-merged into `main` as
`4fa4b1f`, and PR #409 (the T-129 walkthrough) after it as `1dae2f2`, the branch was restarted from
`1dae2f2` on the owner's machine to build the owner's answers to T-129's choices A to E. Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `728a8f6` (#409's last commit, the merge
of `main` that `gh pr update-branch` added), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@728a8f6`, created by
  `.github/workflows/archive-branch.yml` when #409 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/409/head`;
- its content in `main` as `1dae2f2`.

#410's branch was archived the same way when it merged: `archive/claude/deps-2026-10-24` →
`86459ad`, checked on the remote. The branch itself was left alone.

Nothing was deleted; no other ref moved.

## Thirty-first reset, after PR #411 (2026-10-24)

**What was done.** After PR #411 (the owner's answers to T-129's choices A to E, D157) was
squash-merged into `main` as `2648d2f`, the branch was restarted from `2648d2f` on the owner's
machine to give VNQ's adjusted effective yield a label of its own (D150) and apply the Direxion
pre-fill's result to T-440. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `262303e` (#411's last commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@262303e`, created by
  `.github/workflows/archive-branch.yml` when #411 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/411/head`;
- its content in `main` as `2648d2f`.

Nothing was deleted; no other ref moved.

## Thirty-second reset, after PR #412 (2026-10-24)

**What was done.** After PR #412 (VNQ's adjusted effective yield and the Direxion pre-fill, D158)
was squash-merged into `main` as `9bf186a`, the branch was restarted from `9bf186a` on the
owner's machine to record the owner's ruling on redundant cross-checks (D159) and close T-266 and
T-025 under it. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `5ca81ac` (#412's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@5ca81ac`, created by
  `.github/workflows/archive-branch.yml` when #412 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/412/head`;
- its content in `main` as `9bf186a`.

Nothing was deleted; no other ref moved.

## Thirty-third reset, after PR #413 (2026-10-24)

**What was done.** After PR #413 (D159, the ruling on redundant cross-checks) was squash-merged
into `main` as `4b534d9`, the branch was restarted from `4b534d9` on the owner's machine to close
T-437 (D160). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `fdff3f2` (#413's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@fdff3f2`, created by
  `.github/workflows/archive-branch.yml` when #413 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/413/head`;
- its content in `main` as `4b534d9`.

Nothing was deleted; no other ref moved.

## Thirty-fourth reset, after PR #414 (2026-10-24)

**What was done.** After PR #414 (D160, T-437 closed) was squash-merged into `main` as `2614b96`,
the branch was restarted from `2614b96` on the owner's machine to apply D161, wording fixes on 34
parked items. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `2cc100e` (#414's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@2cc100e`, created by
  `.github/workflows/archive-branch.yml` when #414 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/414/head`;
- its content in `main` as `2614b96`.

Nothing was deleted; no other ref moved.

## Thirty-fifth reset, after PR #415 (2026-10-25)

**What was done.** After PR #415 (D161, the parked-item review) was squash-merged into `main` as
`a62c779`, the branch was restarted from `a62c779` on the owner's machine to apply the staking
facts' first automated check (D162). Pushed with `--force-with-lease`, for the same reason as
above.

**Where the prior state lives.** The branch's previous tip, `0e48db7` (#415's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@0e48db7`, created by
  `.github/workflows/archive-branch.yml` when #415 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/415/head`;
- its content in `main` as `a62c779`.

Nothing was deleted; no other ref moved.

## Thirty-sixth reset, after PR #416 (2026-10-25)

**What was done.** After PR #416 (D162, the staking facts' first automated check) was
squash-merged into `main` as `f0b91ec`, the branch was restarted from `f0b91ec` on the owner's
machine to build the data methods page and park T-425 (D163). Pushed with `--force-with-lease`,
for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `2870e5c` (#416's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@2870e5c`, created by
  `.github/workflows/archive-branch.yml` when #416 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/416/head`;
- its content in `main` as `f0b91ec`.

Nothing was deleted; no other ref moved.

## Thirty-seventh reset, after PR #417 (2026-10-25)

**What was done.** After PR #417 (D163, the data methods page and T-425 parked) was squash-merged
into `main` as `0b55f97`, the branch was restarted from `0b55f97` on the owner's machine to park
T-154 (D164). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `2ec416f` (#417's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@2ec416f`, created by
  `.github/workflows/archive-branch.yml` when #417 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/417/head`;
- its content in `main` as `0b55f97`.

Nothing was deleted; no other ref moved.

## Thirty-eighth reset, after PR #418 (2026-10-25)

**What was done.** After PR #418 (D164, T-154 parked) was squash-merged into `main` as `6c42bec`,
the branch was restarted from `6c42bec` on the owner's machine to record D165 and the fund issuers'
permission drafts. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `fbd6f6a` (#418's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@fbd6f6a`, created by
  `.github/workflows/archive-branch.yml` when #418 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/418/head`;
- its content in `main` as `6c42bec`.

Nothing was deleted; no other ref moved.

## Thirty-ninth reset, after PR #419 (2026-10-25)

**What was done.** After PR #419 (D165, the fund issuers' permission drafts) was squash-merged into
`main` as `532319e`, the branch was restarted from `532319e` on the owner's machine to record D166:
a link to the fund's own page beside every yield, yields shown only where the fund's site allows it,
and a quarterly accuracy check. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `974e61c` (#419's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@974e61c`, created by
  `.github/workflows/archive-branch.yml` when #419 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/419/head`;
- its content in `main` as `532319e`.

Nothing was deleted; no other ref moved.

## Fortieth reset, after PR #420 (2026-10-25)

**What was done.** After PR #420 (D166, a link beside every fund yield and the quarterly accuracy
check) was squash-merged into `main` as `9d060ad`, the branch was restarted from `9d060ad` on the
owner's machine to record D167: stock P/E and dividend yields worked out from SEC filings. Pushed
with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `c119d29` (#420's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@c119d29`, created by
  `.github/workflows/archive-branch.yml` when #420 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/420/head`;
- its content in `main` as `9d060ad`.

Nothing was deleted; no other ref moved.

## Forty-first reset, after PR #421 (2026-10-25)

**What was done.** After PR #421 (D167, stock P/E and dividend yields from SEC filings) was
squash-merged into `main` as `b1ff8bd`, the branch was restarted from `b1ff8bd` on the owner's
machine to record D168: the filed fund asset figures re-read against their newest SEC filings, and
a note beside each fund link whose page lacks the figure. Pushed with `--force-with-lease`, for the
same reason as above.

**Where the prior state lives.** The branch's previous tip, `c1352bc` (#421's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@c1352bc`, created by
  `.github/workflows/archive-branch.yml` when #421 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/421/head`;
- its content in `main` as `b1ff8bd`.

Nothing was deleted; no other ref moved.

## Forty-second reset, after PR #422 (2026-10-25)

**What was done.** After PR #422 (D168, filed fund assets re-read against their newest SEC
filings) was squash-merged into `main` as `cb2908f`, the branch was restarted from `cb2908f` on the
owner's machine to record D169: a staking rate read as 0 is no rate, on the page as in the fallback
refresh. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `593cd19` (#422's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@593cd19`, created by
  `.github/workflows/archive-branch.yml` when #422 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/422/head`;
- its content in `main` as `cb2908f`.

Nothing was deleted; no other ref moved.

## Forty-third reset, after PR #423 (2026-10-25)

**What was done.** After PR #423 (D169, a staking rate read as 0 is no rate) was squash-merged
into `main` as `2bfbbcd`, the branch was restarted from `2bfbbcd` on the owner's machine to record
D170: stock market cap from SEC shares × the live price, no stock reference prices, and beta
worked out from prices on each stock's page. Pushed with `--force-with-lease`, for the same reason
as above.

**Where the prior state lives.** The branch's previous tip, `c141100` (#423's only commit), is
held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@c141100`, created by
  `.github/workflows/archive-branch.yml` when #423 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/423/head`;
- its content in `main` as `2bfbbcd`.

Nothing was deleted; no other ref moved.

## Forty-fourth reset, after PR #424 (2026-10-25)

**What was done.** After PR #424 (D170, stock market cap, prices and beta) was squash-merged into
`main` as `ec6df63`, the branch was restarted from `ec6df63` on the owner's machine to add the
Staking Facts Check's Quick facts view. Pushed with `--force-with-lease`, for the same reason as
above.

**Where the prior state lives.** The branch's previous tip, `8534a77` (#424's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@8534a77`, created by
  `.github/workflows/archive-branch.yml` when #424 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/424/head`;
- its content in `main` as `ec6df63`.

Nothing was deleted; no other ref moved.

## Forty-fifth reset, after PR #425 (2026-10-26)

**What was done.** After PR #425 (the Staking Facts Check's Quick facts view) was squash-merged
into `main` as `882ec89`, the branch was restarted from `882ec89` on the owner's machine to fix
what the Fund Figures Check was missing and to park T-440 until before launch (D171). Pushed with
`--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `a7faea5` (#425's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@a7faea5`, created by
  `.github/workflows/archive-branch.yml` when #425 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/425/head`;
- its content in `main` as `882ec89`.

Nothing was deleted; no other ref moved.

## Forty-sixth reset, after PR #426 (2026-10-26)

**What was done.** After PR #426 (D171, the Fund Figures Check's fixes and T-440's park) was
squash-merged into `main` as `0f7b0c6`, the branch was restarted from `0f7b0c6` on the owner's
machine to write the brief for counsel (T-289). Pushed with `--force-with-lease`, for the same
reason as above.

**Where the prior state lives.** The branch's previous tip, `26fdb86` (#426's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@26fdb86`, created by
  `.github/workflows/archive-branch.yml` when #426 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/426/head`;
- its content in `main` as `0f7b0c6`.

Nothing was deleted; no other ref moved.

## Forty-seventh reset, after PR #427 (2026-10-26)

**What was done.** After PR #427 (T-289, the brief for counsel) was squash-merged into `main` as
`8bb2b29`, the branch was restarted from `8bb2b29` on the owner's machine to write the hosting
brief (T-112). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `bb207ac` (#427's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@bb207ac`, created by
  `.github/workflows/archive-branch.yml` when #427 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/427/head`;
- its content in `main` as `8bb2b29`.

Nothing was deleted; no other ref moved.

## Forty-eighth reset, after PR #428 (2026-10-26)

**What was done.** After PR #428 (T-112, the hosting brief) was squash-merged into `main` as
`7ab50cd`, the branch was restarted from `7ab50cd` on the owner's machine to build the brief's
owner access and health route. Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `8a91d1d` (#428's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@8a91d1d`, created by
  `.github/workflows/archive-branch.yml` when #428 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/428/head`;
- its content in `main` as `7ab50cd`.

Nothing was deleted; no other ref moved.

## Forty-ninth reset, after PR #429 (2026-10-26)

**What was done.** After PR #429 (owner access off localhost and the health route) was
squash-merged into `main` as `870d8ce`, the branch was restarted from `870d8ce` on the owner's
machine to correct the legal notes the counsel brief rests on. Pushed with `--force-with-lease`,
for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `e15928e` (#429's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@e15928e`, created by
  `.github/workflows/archive-branch.yml` when #429 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/429/head`;
- its content in `main` as `870d8ce`.

Nothing was deleted; no other ref moved.

## Fiftieth reset, after PR #430 (2026-10-26)

**What was done.** After PR #430 (Live Pools' yield bound, the audit checks and the legal notes)
was squash-merged into `main` as `78955fb`, the branch was restarted from `78955fb` on the owner's
machine for the hidden backtests (D172). Pushed with `--force-with-lease`, for the same reason as
above.

**Where the prior state lives.** The branch's previous tip, `6638af6` (#430's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@6638af6`, created by
  `.github/workflows/archive-branch.yml` when #430 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/430/head`;
- its content in `main` as `78955fb`.

Nothing was deleted; no other ref moved.

## Fifty-first reset, after PR #431 (2026-10-26)

**What was done.** After PR #431 (the hidden backtests, D172) was squash-merged into `main` as
`0a401a8`, the branch was restarted from `0a401a8` on the owner's machine for the public API's keys
and rate limit (D173). Pushed with `--force-with-lease`, for the same reason as above.

**Where the prior state lives.** The branch's previous tip, `e99c5da` (#431's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@e99c5da`, created by
  `.github/workflows/archive-branch.yml` when #431 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/431/head`;
- its content in `main` as `0a401a8`.

Nothing was deleted; no other ref moved.

## Fifty-second reset, after PR #432 (2026-10-26)

**What was done.** After PR #432 (the public API's keys and rate limit, D173) was squash-merged
into `main` as `777fb5f`, the branch was restarted from `777fb5f` on the owner's machine for the
ledger notes on the items that waited on the same question. Pushed with `--force-with-lease`, for
the same reason as above.

**Where the prior state lives.** The branch's previous tip, `3576686` (#432's head), is held by:

- the annotated tag `archive/claude/vibrant-faraday-3xo7mo@3576686`, created by
  `.github/workflows/archive-branch.yml` when #432 merged, and checked on the remote before the
  restart;
- GitHub's `refs/pull/432/head`;
- its content in `main` as `777fb5f`.

Nothing was deleted; no other ref moved.
