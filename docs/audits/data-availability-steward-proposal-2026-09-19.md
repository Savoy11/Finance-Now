# DATA-AVAILABILITY.md — checklist-steward proposal, 2026-09-19

**Branch:** `docs/data-availability-2026-09-19` · **Base:** `516220f` (main)
**Scope:** `DATA-AVAILABILITY.md` living sections only. **No code changes.**

This is the steward proposal that four queue items (T-167, T-168, T-169, T-170) each
asked for by name — every one of their `next_action` fields reads *"draft a checklist-steward
proposal amending DATA-AVAILABILITY.md … and apply after owner approval."* It also closes
T-138 as moot and answers T-004.

---

## The authority this pass ran under

The document records the owner's 2026-09-08 ruling in its own header:

> **apply where the evidence is a file-and-line contradiction with no judgement in it;
> propose the judgement calls.**

Every one of the 74 edits below is the first kind — a file, a line, a commit, an audit
probe or a direct HTTP response says what it says. The judgement calls are in
[Part 3](#part-3--proposed-not-applied) and nothing there has been touched.

---

## Part 1 — How this was measured, and where it is weak

A 21-agent workflow (`wf_d8f103ba-f4f`), all agents completed:

| Layer | Count | Job |
|---|---|---|
| Surveyors | 6 | One per document section; re-derive every claim from the tree and the running app |
| Adversarial lenses | 12 | Two per section, each told to **refute** — one re-probing, one auditing for overclaim |
| Completeness critics | 3 | "What is missing that no surveyor was asked to look at?" |

**84 findings: 23 still-accurate, 48 stale, 7 self-contradictory, 6 outright wrong.**
Of 168 challenges the lenses raised, **36 were refutations.**

### The refutation layer earned its cost, and this is the part worth reading

In **five** cases a surveyor's diagnosis was right while its proposed replacement would
have written a **new false fact** into the document. Those are more dangerous than the
staleness being fixed, because they arrive wearing a fresh date:

| Line | The proposed "fix" | Why it was refused |
|---|---|---|
| 35 | Silently change "25 provider keys" → 19 | **25 was correct when written.** `62b8388` dropped six keys on 2026-09-09, the day *after* the 09-08 pass wrote that row. Substituting 19 erases a correct dated measurement and misreports *why* the number moved |
| 65, 66 | Write "Tiingo → FMP → Twelve Data" into the **Predicted** column | That column records a **2026-08-06 forecast**. Twelve Data did not exist as a rung until six weeks later. The facts were right; the cell was wrong, and the document would have misreported its own prediction |
| 175 | "200 browser-UA, 429 app-UA" for Reddit `.rss` | Measured three rounds: **429 to browser, app and default agents alike.** It is a per-IP rate window. Publishing a UA split invites someone to "fix" it by spoofing a user agent — which would fail *and* breach the robots gate the same row documents |
| 187 | "mempool.space is egress-dependent, 20s timeout (VPN on)" | Reinstates, in a living row, the over-broad claim this project formally **retracted** on 2026-09-12. It was one exit node (AS62651); the host answered fine through AS22781 |
| 669 | "CoinGecko 429s somewhere below 10 calls/minute" | **Inverts the measurement.** 10/min is the harness's self-imposed floor and the 09-19 run sustained it with zero 429s. The rate that actually 429'd was ~22–33/min |

A sixth, at line 593, matters enough to state on its own: two independent survey findings
wanted to write **"no keyed rung carries the macro symbols."** The run does not support it.
`provider-config-2026-09-19.json` records FMP answering **402** — a paid plan, not an absent
capability — while four other rungs "returned no quotes" for Yahoo-style tickers, which may
be a **symbology** mismatch. Coverage and symbol vocabulary are different problems with
different fixes, and nothing measured distinguishes them. Both places now say so.

### Where this pass is weak

- **`/live-data/ipo-calendar` has no harness check.** Its new 🟢 rests on a direct probe only.
  Same for `withdraw-fees`, `global`, `coin-profile`, `source-terms`.
- **The 22-of-27 overstated-fallback spread was not re-measured.** #203 refreshed the values;
  whether the spread closed is unknown, and the document now says so rather than implying it.
- **One number is asserted from a structural grep, not a runtime read:** `stakingProviders.ts`
  carries 188 `staticApr` entries.

---

## Part 2 — Applied (74 edits + 1 new section)

Full diff on the branch. Grouped by what kind of wrong each was:

### 2a. The document contradicted itself (7)

| Where | The contradiction |
|---|---|
| Header vs line ~24 | "**Do not hand-edit the statuses**" stated absolutely, against the 2026-09-08 ruling forty lines below authorising exactly that. Now scoped: a *status* needs a re-run; a claim about *which code exists* may be corrected from a reading |
| Legend | Defines five statuses, **none of them ⚪** — which the body uses in nine places for "Removed". Added, plus a warning that the **harness** uses ⚪ for EMPTY and 🔑 for UNCONFIGURED |
| Legend | "Never leave a ⬜ row after a regeneration" — futures term structure has sat ⬜ through three. Now carried as an explicit open admission rather than a silent rule violation |
| Refresh table | `/live-data/markets` listed **twice**, at 60 s and 30 s. Both are right — two consumers, one endpoint — and the table now says so instead of reading as a defect |
| Fund catalog size | **Three different figures in one file**: 118 (item 11), ~55 (reference data), 126 (measured). It is **126** |
| Fund holdings | VOO at **511**, against 513 in the same file's measured table *and* in today's audit. It is **513** |
| Action item 18 vs macro row | Item 18 records the macro quote path as measured since 09-09; the macro row said "never measured directly". Reconciled |

### 2b. Real staleness (48)

Date `2026-09-10` → `2026-09-19`; the Tiingo key lighting chart / OHLCV / trailing returns
(three rows that were **dark, not degraded** — the key turned them on rather than improving
them); `staking-discovery` ~18 s → ~2.2 s; `fund-universe` 14 MB → 2.27 MB (**84% cut**,
the measurement action item 11 had been waiting on since 2026-07-30); `staking-rates`
18 upstreams → 7; `stock-social` ~6 s → ~0.8 s; route count 56 → 58; `fx-rates-extended`
124/126 → **126/126**, which lapses the "permanent FALLBACK" decision of 2026-09-08 — the
*reasoning* is kept because it still governs the next unquoted code.

### 2c. Wrong, not merely stale (6)

- **`chart` has one consumer, not none.** `/compare` has fetched it for every crypto series
  since 2026-07-20. It reads closes only, which is safe — but "no consumers" invites deletion.
- **TA event markers were cut, not shipped** (`94b26d6`, 2026-07-01) — listed 🟡 Partial for
  eleven weeks.
- **Peg-deviation history and sparklines** are ⚪ Removed (D11), not 🔴 Not available.
- **Reddit is not an IP block.** It sat in the "blocked by IP, cannot be fixed by paying
  anyone" bucket. It is 🔑 gated by **our own** robots decision, lifted by `REDDIT_CLIENT_ID`
  *and accepting Reddit's Data API Terms*. Mis-bucketing it is what sent earlier debugging
  after a network fault that was never there.
- **`revalidate` is not on every outbound fetch.** The ✅ came from a **file-level** grep.
  Per call site: `config` has 17 probe fetches and **one** carries `next: { revalidate }`.
  Deliberate — probes must never be cached — but satisfied by Next's default, not by the code.

### 2d. Newly recorded

- **`## Run of 2026-09-19`** — full section, matching the existing run structure, placed before
  the 09-09 run. Carries the **egress record the document's own gate requires**:
  **AS11426 Charter/Spectrum, `proxy: false`, `hosting: false`.** This is the first run in the
  file whose egress was captured *before* its results rather than reconstructed after — which
  matters because the most-cited run in this document (2026-09-09) ran through AS62651 with
  `proxy: true` and had reachability rows wrong in both directions.
- **"65 REAL" is not a count of live data.** Seven of the 65 assert something is *correctly
  absent or correctly refused* — withdrawn routes, a withheld 503, two correct 400s. **58 of 77**
  probes represent an upstream answering.
- **"Reachability is not availability."** Three shipped features have every route 🟢 while the
  page redirects away: Transfer Fees, Wallets, Equity Strategy Backtests (`next.config.mjs:60,
  66, 101`). The words "rollout", "hidden" and "redirect" appeared nowhere in the file, and
  line 605 asserted in so many words that equity backtests work. They do — and no user can
  reach them. This bears directly on the file's opening promise that "a walk-through of the app
  surfaces exactly what is and is not backed by real data."
- **Evidence pointers.** `grep "docs/audits" DATA-AVAILABILITY.md` previously returned nothing,
  while that directory holds every run's JSON, the coverage matrix and the provider config.

### What was deliberately left alone

The dated run sections (2026-09-09 and 2026-07-29) are **byte-identical** — verified, not
assumed. They are history. Where they are overtaken, the living sections say so and cite them.

---

## Part 3 — Proposed, NOT applied

Five judgement calls. Nothing below has been touched.

### P1 — The `/api/v1` public API has no row anywhere in the living record

The 2026-09-19 audit probes it **ten times** and every probe passes. The living record is
organised as a *UI feature map*, so the whole v1 layer — plus `agents` (1 probe) and `infra`
(2) — has no home. `/api/v1/staking/opportunities` served catalog estimates for **6 of 7 keys**
for weeks (fixed by #203) and this document could not have shown that, because it has no row
for it.

**Ask:** add a "Public API (`/api/v1`)" subsection? It expands the document's remit from
"what the app shows" to "what we publish", which is a scope decision, not a correction.

### P2 — Five live, user-facing routes are in neither the document nor the harness

`global`, `coin-profile`, `withdraw-fees`, `source-terms`, `ipo-calendar`. All five answered a
direct probe today. `source-terms` is the route behind #203, #205 and the Poloniex removal and
is invisible in all three records.

**Ask:** this wants **harness checks** (a code change in `scripts/test-live-data.mjs`), not
just doc rows — otherwise the next run still cannot see them. Approve as a follow-up PR?

### P3 — Should "Reachability" be a first-class status?

I recorded it as a note plus a table. The alternative is a Legend status (🚫 Held from rollout)
applied per row, so a reader scanning statuses cannot miss it. That changes the Legend's meaning
— every other status describes *data*, this one describes *access*.

**Ask:** note (as applied), or a real status?

### P4 — Two provenance clocks fire within the week

`STAKING_DATA_LAST_VERIFIED = '2026-06-28'` + 90 days ⇒ **low confidence on 2026-09-26**, seven
days out. `FUND_DATA_LAST_VERIFIED` is still 2026-07-20 (T-386). Both are re-verification work,
not doc work, and both are judgement: re-date the table, or let the notice fire and say so.

**Ask:** re-verify, or let it fire?

### P5 — This document has no generator, and it is now 986 lines

It accumulates dated runs beside living sections and is maintained by hand. Its own header says
"do not hand-edit the statuses" — advice that is unfollowable, because there is nothing else to
do. Two 09-18 and 09-12 runs were never recorded at all. A generator that emitted the living
tables from the audit JSON, leaving prose hand-written, would make "regenerate" mean something.

**Ask:** worth a subproject, or is hand-maintenance the right cost here?

---

## Part 4 — Queue annotations requested

| Item | Now | Basis |
|---|---|---|
| **T-167** | open → **closed** on approval | Its quoted text — *"Live EVM gas providers remain the next step"* — was still present verbatim in action item 6, four weeks after `01d6bfe` took that step. Now rewritten to 5 of 18 🟢 with the L2 reasoning |
| **T-168** | open → **closed** on approval | Its quoted row was already ⚪ Removed, but a residual `wallet/exchange` reference survived in the conventions audit. Now marked deleted (RP-5) |
| **T-169** | open → **closed** on approval | Its quoted row was already ⚪ Removed. Residual: the row still listed *staking-provider risk* among the live consumers of `lib/risk/`, which D14 struck on 2026-09-14. Corrected |
| **T-170** | open → **closed** on approval | Its quoted "Known issue" text was already gone. Residual staleness in **three** other places: the IP-block bucket, the `stock-social` latency row, and item 10's 10/10 split (now 20/0 by the robots gate). All three corrected |
| **T-138** | open → **moot** | The fabricated `updatedAt` lived in `live-data/cbdc-data/route.ts`, **deleted 2026-09-14 (D10)**. Only an empty untracked directory remains; `git ls-files` returns nothing. Nothing to fix |
| **T-004** | **answered** | "Do the staking rungs answer?" — **27 of 51 live, 7/7 upstreams healthy, `defillama-yields` 19/19**, measured on the owner's machine and re-confirmed 2026-09-19 |

⚠ **The four queue items' line numbers had all drifted** — they cite a 2026-09-07 snapshot and
point at unrelated content today. Their **quoted text** is what identified the real residue, and
in every case it was in a different place than the citation said. Worth knowing before trusting
a line number in any other queue entry.

---

## Verification

- 74 anchors, each asserted to match **exactly once** — a scripted no-match aborts without
  writing, because a silently-skipped edit is the exact failure this document exists to catch.
- Dated run sections **byte-identical** to `516220f`.
- All markdown table rows align with their headers (escaped `\|` handled).
- No code touched, so the suite is unaffected.
