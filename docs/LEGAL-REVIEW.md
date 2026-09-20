# Legal review — standing note

**Opened 2026-09-20 at the owner's request**, after four provider terms were read and four
licensing enquiries were drafted. Its purpose is to stop this from being rediscovered: the
legal questions in this project are spread across the task queue, several audits, and now a
drafts folder, and no single place said what they add up to.

> ⚠ **None of this is legal advice, and none of it was written by a lawyer.** The terms
> readings are careful, quoted verbatim and adversarially checked — they are still
> readings. Anything that becomes a signed agreement, a filed entity, or a published
> disclosure deserves a professional.

---

## 1. What is drafted and unsent

`docs/licensing/2026-09-20-provider-enquiries.md` holds four enquiries. **Nothing has been
sent and no vendor has been contacted.** Sending is the owner's act.

| Provider | Asks for | Status |
|---|---|---|
| FMP | Order Form under §2.1; also flags that §2.6.2's Acceptable Data Use Policy URL 404s | drafted |
| Finnhub | written approval; also requests two referenced documents nobody can locate | drafted |
| Twelve Data | Redistribution Rights Add-On; also asks where §2.3(g)'s cache limits actually live | drafted |
| Binance.US | *not* a permission request — it names no route. Asks which instrument governs API access at all | drafted |

**Two of the questions are not about launch.** They bear on the app as it runs today, solo:

- **Twelve Data** — "Internal Use" is defined as internal *business* purposes. Whether an
  individual's unpaid project qualifies is unresolved, so the app may already sit outside
  the only permitted-use category.
- **Binance.US** — the IP licence does not permit "the modification or derivative uses of
  the Materials", and computing indicators from price data is arguably exactly that.

Sending these discloses the project's existence and plans to vendors. Normal, low-risk, and
still the owner's disclosure to make.

---

## 2. The keystone question

**T-151 — "Is Finance Now personal/internal or commercial?"** Everything below bends around
it, and as of 2026-09-20 it is better informed than it has ever been but still unanswered.

Four independent documents, read on the owner's machine, now say the same thing:

| Source | Multi-user deployment | Route it names |
|---|---|---|
| FMP §2.2.2 | barred | Order Form / specific agreement |
| Finnhub | barred | written approval |
| Twelve Data §2.2(e) | barred | Redistribution Rights Add-On or written agreement |
| Binance.US | barred | **none stated** |

**A deployment other people can reach is outside every one of those default licences, and
buying a higher tier does not change that.** That is not a pricing problem, so D21 — which
defers *paid* decisions — does not defer it. The operative half of D21 here is the other
one: *no provider may be load-bearing.*

Answering T-151 does not require answering whether the product is ever monetised. It
requires answering whether **anyone other than the owner will be able to load a page**,
because that is the line every one of these documents draws.

---

## 3. The rest, grouped

Counts below are from the **2026-09-07 queue sweep snapshot** and were accurate then; the
snapshot is stale by design (it is a dated record, not a live index). Re-derive before
relying on any number. 65 open or blocked items matched a legal/licensing filter.

**A. Data licensing.** ~20 items. The source-terms registry is **22 `verified` / 34
`seeded` of 56** as of 2026-09-20. The eight on the personal-vs-commercial question are now
all read. The remaining cluster is the **news publishers** (T-140–T-150) — CLAUDE.md calls
them the priority because they are the only keyless content sources and their permission
rests on a syndication policy rather than an API licence. T-247 is the sharp one: if any
publisher permits headline-and-link only, the app must stop rendering feed summaries — a
code change, not a note.

**B. Entity formation.** T-284 to T-288, plus T-295 and T-297. One entity or two, LLC and
whether S-Corp election is worth the payroll overhead, registered agent, EIN, operating
agreement, bank account, annual filings calendar. Sequential — T-287 and T-288 are blocked
on the first three.

**C. Disclosure documents.** T-291 to T-294, plus T-119. What must be disclosed, where it
sits (footer versus point of relevance), and keeping one canonical copy of each shared
document rather than several drifting ones.

**D. Advice-adjacent features.** T-058 and T-059 — the owner's own item-16 legality
question, unrecorded since 2026-08-17: does advice-adjacent tooling (a federal sale-tax
estimator over user-supplied basis and holding period) cross into regulated advice? This is
the same line RP-3 and RP-6 already drew for risk scores — *ranking versus explanation* —
applied to a different feature. It blocks the tax estimator outright.

**E. Affiliate programmes.** T-119, T-120, T-124, T-125. FTC disclosure and other
jurisdictions (UK FCA), plus per-programme terms on placement, comparison tables and
ranking. Nothing here ships before B and C.

**F. Enterprise and SOC 2.** T-196, T-203, T-210, T-211, T-216. All blocked behind the
2026-09-05 "not ready for rollout" ruling and the hosting decision. Deliberately parked —
listed so it is not rediscovered as new.

---

## 4. When to revisit

This note is not on a timer, because the triggers are events rather than dates:

1. **Before any decision that lets a second person load the app.** That is the moment every
   licence in §2 bites, and the enquiries have unknown lead time — so the conversation
   starts before the decision, not at it.
2. **When a vendor replies.** Record the reply as evidence, not ratification: a dated audit
   document with verbatim quotes, then the registry entry, then the `review`/`verdict`
   flags as a separate deliberate act. **An email saying "that's fine" is not a licence
   amendment** and must not be recorded as one.
3. **When answering T-151.** Re-read §2 first; the four readings are the evidence base.
4. **On the source-terms staleness window.** Verdicts go stale at 180 days. The oldest
   entries date to 2026-08-06, so the first wave falls due **2027-02-02** — 135 days from
   this note. T-250 already tracks it.

⚠ `npm run staleness:check` does **not** watch any of this. It watches curated *data*
tables (`*_LAST_VERIFIED`), not terms verdicts or legal workstreams. Extending it to the
registry's 180-day window is a real option and is not currently built — do not assume the
guard has this covered.

---

## 5. What changed on 2026-09-20

- FMP, Finnhub, Twelve Data and Binance.US read and ratified — registry 18 → 22 `verified`.
- The reading half of the eight-source personal-vs-commercial question **closed**. The
  decision half (T-151) is open.
- Four enquiries drafted, none sent.
- Corrected a misattribution: FMP's terms page 403s on **user-agent**, not egress, so
  `npm run terms:report` will report it unreadable from every network forever. The cure is
  a browser, not a different connection.
- Established that both large "terms review" worksheets in `docs/audits/` are *unfilled
  generated checklists*, not readings. One is now in `docs/audits/archive/` saying so.
