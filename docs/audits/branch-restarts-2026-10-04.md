# Session-branch restarts — 2026-10-04

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-03.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) ten times on
this date. Its previous work had already been **squash-merged** into `main`, so the branch
was restarted from the latest `main` for the next change rather than stacking new commits
on history `main` already holds. No unmerged work was discarded.

| When (UTC) | Tip replaced | Its work landed on `main` as | Prior tip is held by | Replaced by |
|---|---|---|---|---|
| 2026-10-04 ~06:17 | `b469f15` | `a6264e5` (#264: TS-13, D53, D54, D55) | `refs/pull/264/head`; tag `archive/ccr-3ad5880b-hsbobf@b469f15` | Portfolio Builder plan history and printable rebalance notes (T-065, T-066; D56), restarted from `a6264e5` |
| 2026-10-04 ~06:46 | `993c2d0` | `f498966` (#266: T-065, T-066, D56) | `refs/pull/266/head`; tag `archive/ccr-3ad5880b-hsbobf@993c2d0` | T-192 parked with its siblings (D57), restarted from `f498966` |
| 2026-10-04 ~11:47 | `a7184af` | `7be3b3e` (#267: D57, D58) | `refs/pull/267/head`; tag `archive/ccr-3ad5880b-hsbobf@a7184af` | T-204 parked with the hosting decision (D59), restarted from `7be3b3e` |
| 2026-10-04 ~13:20 | `b99818d` | `fc58ef3` (#268: D59, D60) | `refs/pull/268/head`; tag `archive/ccr-3ad5880b-hsbobf@b99818d` | T-393's open cycle row corrected and the item parked (D61), restarted from `fc58ef3` |
| 2026-10-04 ~13:40 | `4bfa1fb` | `f4d9a23` (#269: D61) | `refs/pull/269/head`; tag `archive/ccr-3ad5880b-hsbobf@4bfa1fb` | T-387 parked with a test on the swept coin list (D62), restarted from `f4d9a23` |
| 2026-10-04 ~13:50 | `240a787` | `0ad260a` (#270: D62) | `refs/pull/270/head`; tag `archive/ccr-3ad5880b-hsbobf@240a787` | T-009 parked beside the other options items (D63), restarted from `0ad260a` |
| 2026-10-04 ~14:15 | `787c014` | `d29b05c` (#271: D63) | `refs/pull/271/head`; tag `archive/ccr-3ad5880b-hsbobf@787c014` | Every risk rating switched off until the risk engine is rebuilt (D64), restarted from `d29b05c` |
| 2026-10-04 ~15:10 | `a62655a` | `190c887` (#272: D64) | `refs/pull/272/head`; tag `archive/ccr-3ad5880b-hsbobf@a62655a` | T-027's two open questions answered and its FIFO lot engine built (D65), restarted from `190c887` |
| 2026-10-04 ~15:35 | `7e02313` | `7b48e14` (#273: D65) | `refs/pull/273/head`; tag `archive/ccr-3ad5880b-hsbobf@7e02313` | T-027 step 2, saving trades, restarted from `7b48e14` |
| 2026-10-04 ~16:30 | `c61d132` | `5c55869` (#274: T-027 step 2) | `refs/pull/274/head`; tag `archive/ccr-3ad5880b-hsbobf@c61d132` | T-027 step 3, the tracked-portfolio screen, restarted from `5c55869` |

Each tag was created by `.github/workflows/archive-branch.yml` when its PR merged.

## Recovering the prior state

```bash
git fetch origin refs/pull/264/head:restore-264
git checkout -b ccr-restore archive/ccr-3ad5880b-hsbobf@b469f15

git fetch origin refs/pull/266/head:restore-266
git checkout -b ccr-restore-266 archive/ccr-3ad5880b-hsbobf@993c2d0

git fetch origin refs/pull/267/head:restore-267
git checkout -b ccr-restore-267 archive/ccr-3ad5880b-hsbobf@a7184af

git fetch origin refs/pull/268/head:restore-268
git checkout -b ccr-restore-268 archive/ccr-3ad5880b-hsbobf@b99818d

git fetch origin refs/pull/269/head:restore-269
git checkout -b ccr-restore-269 archive/ccr-3ad5880b-hsbobf@4bfa1fb

git fetch origin refs/pull/270/head:restore-270
git checkout -b ccr-restore-270 archive/ccr-3ad5880b-hsbobf@240a787

git fetch origin refs/pull/271/head:restore-271
git checkout -b ccr-restore-271 archive/ccr-3ad5880b-hsbobf@787c014

git fetch origin refs/pull/272/head:restore-272
git checkout -b ccr-restore-272 archive/ccr-3ad5880b-hsbobf@a62655a

git fetch origin refs/pull/273/head:restore-273
git checkout -b ccr-restore-273 archive/ccr-3ad5880b-hsbobf@7e02313

git fetch origin refs/pull/274/head:restore-274
git checkout -b ccr-restore-274 archive/ccr-3ad5880b-hsbobf@c61d132
```

None of these is needed for anything: the squash commits `a6264e5`, `f498966`,
`7be3b3e`, `fc58ef3`, `f4d9a23`, `0ad260a`, `d29b05c`, `190c887`, `7b48e14` and `5c55869` are on `main` and carry the whole of each change.
