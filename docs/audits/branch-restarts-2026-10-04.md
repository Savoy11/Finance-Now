# Session-branch restarts — 2026-10-04

**Applied.** The dated note `CLAUDE.md`'s standing rule requires for a history-shaping
operation: what was done, and where the prior state lives. Same pattern as
`branch-restarts-2026-10-03.md`.

The session branch `ccr-3ad5880b-hsbobf` was force-pushed (`--force-with-lease`) eighteen times on
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
| 2026-10-04 ~17:20 | `c21f162` | `ac42b26` (#275: T-027 step 3) | `refs/pull/275/head`; tag `archive/ccr-3ad5880b-hsbobf@c21f162` | T-054, deposit status, restarted from `ac42b26` |
| 2026-10-04 ~18:10 | `4017446` | `0ced4c8` (#276: T-054, D66) | `refs/pull/276/head`; tag `archive/ccr-3ad5880b-hsbobf@4017446` | T-058 parked (D67), restarted from `0ced4c8` |
| 2026-10-04 ~20:20 | `af3f606` | `dbad818` (#277: D67) | `refs/pull/277/head`; tag `archive/ccr-3ad5880b-hsbobf@af3f606` | `run_audit` removed from the MCP server (D68), restarted from `dbad818` |
| 2026-10-04 ~20:55 | `d3b54b8` | `1ef4ecb` (#278: D68) | `refs/pull/278/head`; tag `archive/ccr-3ad5880b-hsbobf@d3b54b8` | T-123 and T-124 parked under D49 (D69), restarted from `1ef4ecb` |
| 2026-10-04 ~21:45 | `b9f0507` | `356bbc4` (#279: D69) | `refs/pull/279/head`; tag `archive/ccr-3ad5880b-hsbobf@b9f0507` | The Pump Report kept (D70, T-176), restarted from `356bbc4` |
| 2026-10-04 ~21:52 | `7894fa7` | `5d1a00c` (#280: D70) | `refs/pull/280/head`; tag `archive/ccr-3ad5880b-hsbobf@7894fa7` | Five business-tier items parked under D5's trigger (D71), restarted from `5d1a00c` |
| 2026-10-04 ~22:11 | `20634ef` | `9403290` (#281: D71) | `refs/pull/281/head`; tag `archive/ccr-3ad5880b-hsbobf@20634ef` | T-205 parked with the hosting decision and T-195 with the business tier (D72), restarted from `9403290` |
| 2026-10-04 ~22:36 | `11dbe2d` | `1c9b212` (#282: D72) | `refs/pull/282/head`; tag `archive/ccr-3ad5880b-hsbobf@11dbe2d` | T-206 and T-209 parked until every feature is built and every proposed security feature is in (D73), restarted from `1c9b212` |

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

git fetch origin refs/pull/275/head:restore-275
git checkout -b ccr-restore-275 archive/ccr-3ad5880b-hsbobf@c21f162

git fetch origin refs/pull/276/head:restore-276
git checkout -b ccr-restore-276 archive/ccr-3ad5880b-hsbobf@4017446

git fetch origin refs/pull/277/head:restore-277
git checkout -b ccr-restore-277 archive/ccr-3ad5880b-hsbobf@af3f606

git fetch origin refs/pull/278/head:restore-278
git checkout -b ccr-restore-278 archive/ccr-3ad5880b-hsbobf@d3b54b8

git fetch origin refs/pull/279/head:restore-279
git checkout -b ccr-restore-279 archive/ccr-3ad5880b-hsbobf@b9f0507

git fetch origin refs/pull/280/head:restore-280
git checkout -b ccr-restore-280 archive/ccr-3ad5880b-hsbobf@7894fa7

git fetch origin refs/pull/281/head:restore-281
git checkout -b ccr-restore-281 archive/ccr-3ad5880b-hsbobf@20634ef

git fetch origin refs/pull/282/head:restore-282
git checkout -b ccr-restore-282 archive/ccr-3ad5880b-hsbobf@11dbe2d
```

None of these is needed for anything: the squash commits `a6264e5`, `f498966`,
`7be3b3e`, `fc58ef3`, `f4d9a23`, `0ad260a`, `d29b05c`, `190c887`, `7b48e14`, `5c55869`, `ac42b26`, `0ced4c8`, `dbad818`, `1ef4ecb`, `356bbc4`, `5d1a00c`, `9403290` and `1c9b212` are on `main` and carry the whole of each change.
