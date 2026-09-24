# Owner decisions — 2026-09-24

## D23 — The release bar and the out-of-v1 fence stand as drafted (answers T-299; adopts T-298's bar)

**Owner, 2026-09-24, verbatim:** *"Ill let then stand as they are"* — in answer to being
asked to approve, amend, or supply the Feature-floor list for the two drafts that had sat in
`docs/BUSINESS-CHECKLIST.md` §5.1 and §5.2 as *"DRAFT 2026-09-14 (owner decision D15) —
awaiting approval"* for ten days.

### What is approved

**§5.2 — "Finance Now — explicitly out of v1"** is approved as written. The fence has five
groups (Removed · Hidden from rollout · Declined with a recorded reopen trigger · Deferred
by decision · Gated on external review), and its operating rule is the sentence at its top:
**anything on it returning to v1 is a decision, not a bug report.** T-299 closes.

**§5.1 — "Finance Now — the release bar"** is adopted as the release gate, **as it stands.**
That phrase is doing work and is recorded precisely:

| Floor | State on adoption |
|---|---|
| Data honesty | Filled and measurable — `npm run audit` from verified clean egress, 0 FAIL, every FALLBACK explained. Last measured 64/9/**1** on 2026-09-12; the one FAIL (a Tronscan `429` reproduced outside the app) is recorded as **not met**, and the owner has *not* amended the bar to allow it |
| Quality | Filled and **met** — re-measured 2026-09-24: tsc clean, 0 errors / 46 warnings, 117 files / 1613 tests, CI green on every PR |
| Feature | **Structure approved, list not supplied.** The floor says "the specific list of surfaces that must work, with nothing half-built behind a nav link" and the list is still marked OWNER. Adopting the bar does not fill it |
| Legal | Gated on D22's launch set (the seven unsent enquiries, entity formation, disclosures) — unchanged |
| Operational | Parked under D1 (2026-09-05 rollout ruling) — unchanged |

So the bar is **two floors met, one not met and not waived, one structurally approved but
empty, one gated, one parked.** That is what "stand as they are" approves, and it is written
here so the approval cannot later be read as "the bar is met".

### What D23 changes in the queue

- **T-299 closes.** The fence is approved and mirrored (below).
- **T-298 is re-scoped, not closed.** Its title asked to *define* the bar **and fill** the
  five floors. The definition is adopted; the one floor only the owner can fill — the
  Feature list — remains, and the item now names exactly that and nothing else. Closing it
  would tick a box on a two-of-five bar.
- **The bar is mirrored into `docs/TASK-QUEUE.md` §P3-W3** as the section's entry condition,
  which T-298's own next_action required via propose → approve; D23 is the approval.

### What D23 does not decide

- The Feature-floor list. Deliberately left open and visible.
- Whether the Tronscan `429` clears. The bar says 0 FAIL; the last run had 1; nothing here
  waives it. The cure is a re-run from clean egress, not a sentence.
- Anything the fence *defers* (§5.2's last two groups): those items keep their own
  decisions and reopen triggers.
