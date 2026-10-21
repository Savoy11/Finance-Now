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
