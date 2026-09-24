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

> ## ✅ ANSWERED 2026-09-23 — D22
>
> **Owner: *"The goal will be commercial; currently it is personal but we are building with
> the goal of it being public."*** See `docs/decisions/2026-09-23-owner-decisions.md`.
>
> Measured against the test this section states below, that resolves into two states:
>
> - **Today — inside every one of the four licences.** Verified in the tree, not assumed:
>   `STAGING_DEPLOY_ENABLED` has never been set, production deploy is `workflow_dispatch`
>   only, and there is no `.tfstate` anywhere. Nobody but the owner can load a page, so
>   nothing is owed today.
> - **At release — outside all four, and no tier cures it.** The table below is unchanged
>   and is now a launch checklist rather than an open question.
>
> ⚠ **The trigger is the FIRST NON-OWNER PAGE LOAD** — not a launch date, not monetisation,
> not incorporation. A private beta, a demo link and a shared staging URL all cross it while
> feeling nothing like "going commercial".
>
> Two consequences worth carrying forward: the seven enquiries in
> `docs/licensing/2026-09-20-provider-enquiries.md` are now **launch-blocking and still
> unsent**, and **Binance.US is the longest-lead of the four** because it is the only one
> naming no route at all.
>
> The section below is left as written — it is the reasoning the answer was given against.

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

> **⚠ UPDATED 2026-09-23 — all three claims above have been overtaken.** Left as written
> because the paragraph is dated and is the reasoning §7 was reached from.
>
> - **The registry is 26 `verified` / 30 `seeded` of 56**, measured on 2026-09-23.
> - **The news-publisher cluster is CLOSED.** T-140–T-150 are all read, verified and
>   closed; so are T-240, T-242, T-244 and T-249. What remains seeded is infrastructure
>   and API hosts, a different character of risk — mostly a rate limit or an attribution
>   line rather than a syndication licence. **T-243 (CoinGecko) is the one to watch**: its
>   finding still ends "the remainder of the document was not [read]", it is the app's
>   most-used keyless source, and at `reviewedAt: 2026-08-29` it is the registry's oldest
>   entry.
> - **T-247's premise did not survive the readings.** No publisher is headline-and-link-only
>   and none will be. Instead, two grant **no display permission at all** — a state the
>   item's model had no slot for. It is re-scoped and the four affected sources are §7.

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

**G. Tokenized securities** (opened 2026-09-21). Full record:
`docs/assessments/tokenized-securities-2026-09-21.md`. The SEC's five-year "innovation
exemption" for on-chain trading of tokenized listed US stocks took effect on 2026-09-17;
Nasdaq's and NYSE's same-CUSIP tokenized trading rules were approved in March–April 2026;
Dinari sells tokenized US stocks to US persons, while Kraken, Coinbase, Robinhood and Ondo
sell them only outside the US. None of it touches an information service — the exemption
relieves venues and liquidity providers, not publishers — so the app's posture holds **as
long as it stays analytics-only and labels truthfully**. Five questions are open, none
answered:

1. Whether showing a security the viewer cannot lawfully buy, with an eligibility label,
   creates any obligation for a public deployment (rides on T-151).
2. Whether on-chain price data for a security is "market data" in the licensed sense — it
   is not exchange data, but each venue's and feed operator's terms govern redistribution,
   including the trade feeds the exemption compels venues to publish.
3. Whether a premium/discount figure between a token and its underlying stays on the
   explanation side of RP-3 (working answer: yes — it is arithmetic on two published
   prices, the D14 line — if labelled derived and never framed as cheap/expensive).
4. Affiliate placements (E above) for products that exclude US persons — proposed rule:
   none, ever.
5. Anything called "trading" — order routing, buy buttons, key custody — is a
   broker-dealer / introducing-broker question, barred today by RP-5 and unresolved by
   T-151. Not proposed.

The app already carries one tokenized security misfiled as a stablecoin (Ondo USDY, coin
registry); that is an engineering item in the assessment, listed here only because the
misfile is also a disclosure defect.

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
5. **On the tokenized-securities dates** in the assessment's §3.3: DTC's pilot rollout
   (October 2026, reported), Nasdaq's 23-hour trading launch (2026-12-06, reported), the
   GENIUS Act taking effect (2027-01-18), and the innovation exemption's expiry
   (2031-09-17). Each changes what a truthful label has to say, not whether one is owed.
6. **On the four sources in §7** (added 2026-09-23). Not a date and not a re-read — those
   documents have been read and will not say anything different next time. The trigger is
   whichever comes first: taking professional advice (CoinDesk and Investing.com turn on
   one shared question a lawyer can answer once for both), or trigger 1 above, since three
   of the four are questions about what may be *displayed* and bite when a second person
   can load a page. **Bitget is the exception and does not wait for either** — its §1
   Prohibited-Countries clause names the United States while the owner is US-resident, and
   that is a question about whether the app may call the host at all, today.

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

---

## 6. What changed on 2026-09-21

- Opened §3.G (tokenized securities) and revisit trigger 5, on the strength of
  `docs/assessments/tokenized-securities-2026-09-21.md`. Research only; no code changed;
  no vendor contacted; nothing sent. The assessment's primary documents were **not opened**
  from the session that wrote it (sandbox egress), which its banner says in as many words —
  read the SEC order and any venue terms on the owner's machine before acting on a clause.

---

## 7. Sources kept `conditional` on an unresolved judgement (opened 2026-09-23)

**Owner, 2026-09-23:** *"I have some concerns around coindesk which will require some
additional research, for now annotate and we will revisit this and any similar cases."*

Chasing "similar cases" through the registry turned up **four**, and they are a genuinely
different animal from the other conditional entries. Everywhere else, `conditional` means
*permitted while conditions hold* and the conditions are obligations to honour —
attribution, a rate limit, a link back. In these four it means **we are proceeding on a
question the document does not answer.** Same word, different claim, and the registry has
no field that distinguishes them.

| Source | What the document actually says | Why it is not `prohibited` | Live surface |
|---|---|---|---|
| **CoinDesk** | No display permission. View/print/download for personal, non-commercial use; republication needs prior written consent. "rss", "syndicat", "feed" return **zero hits** in 300 lines | Reading proposed `prohibited` and an adversarial pass sustained it; **scope** could not be settled — either the feed is inside the expansive "Services", or a ToU that never reaches feeds does not govern one the publisher deliberately publishes | `coindesk-rss` → `/live-data/news`, headline + 280-char summary |
| **Investing.com** | No display permission; Limitations on Use (c) expressly forbids automated extraction "for any purpose" | It **publishes** the feeds this app reads and robots.txt permits `/rss/`. Publishing a feed and allowing it in robots is an invitation; the ToS bars extraction in general terms. Both true, and the document reconciles neither | 3 of the macro-news feeds |
| **publicnode.com** | Bars re-use "commercially **and non-commercially**" — the broadest clause in the registry | Read literally it prohibits consuming an RPC provider at all, since answering calls *is* the product. That cannot be the intent, and narrowing it is not a maintainer's call | `/live-data/wallet/eth`; `/wallets` already hidden from rollout. ✅ **DECIDED 2026-09-24 (D25): narrow reading kept** — owner, *"for safety"*; three of the four remain |
| **Bitget** | §1 lists the **UNITED STATES** among Prohibited Countries; a Restricted Person is one who resides there. §10.1 licenses "non-commercial personal or internal business use" | The Prohibited-Country clauses attach to **Accounts and Services**, which §3.1 gates behind registration — and this is a keyless call with no account. "Platform" is defined to include API access. Unclear, not obviously either way | `withdrawFeeAdapters.ts` → `api.bitget.com`, keyless |

### ⚠ Bitget is the sharpest, and for a reason the other three do not raise

It is **the only source where a clause may bar use outright rather than limit its scope**,
and **the owner is US-resident**. Everything else in this document is a question about what
may be *shown*; this is a question about whether the app may *call the host at all*.

### ⚠ A D22 gap, found while annotating this section

D22 (2026-09-23) answered the personal-vs-commercial question for the **eight** sources
CLAUDE.md names: FMP, Finnhub, Twelve Data, Tiingo, Binance.US, YouTube, OilPrice and
Bitget. An explicit D22 condition was written onto **four** of them, because T-153 — the
item that carried the work — was scoped to four by name. Of the remaining four:

- **OilPrice** correctly needs none. Its reading records no personal-use restriction at
  all: "permits syndication of headline/link/summary with attribution and a link back."
- **YouTube** correctly needs none. Its "personal, non-commercial use" clause came from the
  **consumer site terms**, and the entry already records that this does not describe Data
  API v3 use, which `termsUrl` governs separately.
- **Tiingo** and **Bitget** are real gaps. Tiingo's condition reads "Free tier is personal
  use — no redistribution"; Bitget's §10.1 licenses "non-commercial personal or internal
  business use". Both are the shape D22 speaks to, and **no open item covered either** —
  they fell in the gap between T-153's four and the set's eight.

**T-408** now covers both. The lesson is narrower than "T-153 was wrong": an item scoped by
*naming members* silently stops covering a set that is defined elsewhere, and nothing fails
when the two drift apart.

### What "revisit" means here

Not a re-read — all four documents have been read, carefully, and re-reading them will not
produce a different text. What is owed is a **decision on each**, and they do not all need
the same one:

1. **CoinDesk and Investing.com** turn on one shared question: *does a terms document that
   never mentions feeds govern a feed the publisher deliberately publishes and permits in
   robots.txt?* Answer it once and both resolve. It is a question for a professional, not
   for another careful reading.
2. **publicnode** needs only a judgement on whether to keep reading an absurdly broad
   clause narrowly. Exposure is one route on a hidden page.
3. **Bitget** needs its own answer, because the question is different in kind.

Until then the annotation on each entry is the control, and `T-407` is the tracking item.
**Nothing here is an emergency and nothing here should be quietly closed.** Three of the
four were the owner's deliberate 2026-09-20 calls made *with* the readings in hand; this
section exists so those calls stay visible rather than ageing into apparent settledness.
