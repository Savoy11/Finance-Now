# Owner decisions — 2026-09-26

Recorded by the session steward from the owner's replies in chat. Same form as
`2026-09-14-owner-decisions.md`: one row per ruling, what it cascades to, and what
was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D27 | Fund catalog candidates (T-070; `docs/proposals/2026-09-21-fund-catalog-candidates.md`, probed in `docs/audits/fund-candidates-probe-2026-09-26.md`) | **Add all fourteen** — sector XLC/XLP/XLY/XLB, bond VCSH/VMBS/VTIP/EMLC/BKLN, international VSS/VGK/EWJ/VYMI/HEFA — *"and we will subtract out what doesn't work."* **VYMI: add** (category left to the steward — filed `international`, see below). **BKLN: add under `bond`** — *"because the underlying investments are bonds."* **Apply the six-row 0.09 → 0.08 Select Sector SPDR correction.** → ACTIONABLE, applied the same day | T-070 closes; T-410 (sector tilt widening) and T-411 (fee-script reach) opened |

## Notes the ruling did not settle, and how they were resolved

**VYMI's category.** The owner said "add" without choosing between
`dividend-income` (moderate band) and `international` (aggressive band). Filed as
`international`: it is non-US large-cap equity with full currency exposure, which is
the risk the band describes, and it sits beside VSS/VGK/EWJ/HEFA where a reader
looking for non-US exposure will find it. The description says "high dividend yield"
so the income angle is not lost. One-field change if the owner prefers the other.

**BKLN under `bond`.** Applied as ruled. `fundRiskLevel()` therefore bands it
`conservative`, alongside HYG and EMB, which the proposal flagged. The row's
description says plainly that senior loans are below investment grade and floating
rate; the band itself is unchanged, per the ruling.

**The 0.08 correction.** Six rows moved. `FUND_DATA_LAST_VERIFIED` did **not** move
— a fee spot-check on six rows does not re-verify the other 134, and the provenance
comment in `fundCatalog.ts` records the change with the accession number.

**"Subtract out what doesn't work."** Nothing was found not to work: all fourteen
were quotable, actively trading, and fee-sourced before the ruling. If a row later
fails a quote or a holdings fetch, the removal is the owner's to call, and the
probe record is the baseline to compare against.
