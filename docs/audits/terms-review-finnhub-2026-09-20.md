# Finnhub terms of service — first actual reading, 2026-09-20

**This is a reading, not a verdict.** The document was captured and read on the owner's
machine. Changing `review: 'seeded'` → `'verified'`, and changing the `verdict`, are the
owner's acts — see "The decision this hands you".

Closes one of the eight sources on the personal-vs-commercial question recorded in
`lib/server/sourceTerms.ts` and CLAUDE.md. Finnhub is a rung of the equity quote ladder
(`fetchSecurityQuotes` → `getEquityQuoteProviders()`), so a `prohibited` verdict here is
not a documentation change — it is a socket-level block via `assertSourceNotProhibited`.

## How it was captured, and one thing that matters about method

Fetched over the owner's residential connection (Spectrum, `proxy:false`, `hosting:false`,
verified the same day), `https://finnhub.io/terms-of-service` → **HTTP 200, 15,739 bytes**.
Unlike FMP, Finnhub does **not** filter by user-agent — the project's own
`PROBE_USER_AGENT` gets a 200 here.

⚠ **The first extraction pass was discarded, and the reason generalises.** Converting the
HTML by replacing every tag with a space flattens a document to a single line: headings,
lead-in sentences and numbered list items run together as continuous prose. A reader then
quotes "verbatim" a sentence that never existed. An adversarial check caught exactly this
on two other documents in the same batch, and both readings were thrown away. The capture
behind this reading preserves block structure. **For a legal document, structure is part
of the meaning** — clause numbering and list boundaries decide what a sentence modifies.

Document metadata: **no date anywhere.** A search for any four-digit year returns nothing,
and the Terms reserve the right to change without notice. This reading therefore has no
established as-of date and can go stale silently.

## The clauses

**Redistribution Rights and Personal Use** — the clause that decides this project's
question:

> You hereby agree to not redistribute or share access to data or derived results from the
> data obtained from Finnhub with anyone or any 3rd party without written approval from
> Finnhub.

It reaches further than "redistribute" suggests. It covers **"derived results"**, so
recomputing into a chart or an indicator does not escape it, and it says **"anyone"**, so
one friend or one reviewer counts as readily as a public launch. No exception is defined
for aggregation, transformation, delay, or small scale. Written approval is the only stated
route through it.

The same section sets the default scope of every plan:

> All plan listed on Finnhub website is strictly for personal use unless explicitly stated
> otherwise.

> Personal plan can’t be used by any business even internally without a written approval.

The second closes the internal-tool loophole: even a purely internal deployment inside a
business is barred, regardless of whether data leaves the building.

**Three disqualifiers, any one alone.** The document introduces them with "if you fall into
ONE of the following categories", in this order:

> You are securities professional (registered with FINRA, SEC, CFTC or relevant regulatory
> bodies)

> You are using this data for your business or registering under your business name
> regardless of the industry

> You are going to deduct this expense as a business expense

The first is a **status test, not a usage test** — it can become true about the maintainer
without the app changing at all. The third is an accounting decision made entirely outside
the codebase, and is the one most likely to be tripped by accident.

**Intellectual Property** — an affirmative engineering obligation:

> All data must be deleted should your subscription to that data ends.

That covers caches, database rows, saved fixtures and committed test snapshots.

> Using the Website does not give you ownership or license of any intellectual property
> rights in the website or in any content, information or data accessed on or through the
> Website, including content, information and data obtained from a third-party website.

> Neither these Terms nor your use of the Website grant you any right to use any trademark
> or service-mark accessed on or through the Website.

> It is your responsibility to comply with any copyright laws that govern the content,
> information or data accessed on or through the Website.

The last pushes third-party rights clearance onto this app. Finnhub aggregates exchange and
vendor data, and this document does not clear those underlying rights.

**API Limit and Access** — the two checkable numbers:

> There is a 30 API calls/second limit on top of all plan's limit

> You will have 1 API limit for Fundamental data and 1 API limit for Market data API.

Quota does not stack; subscribing to multiple plans does not raise the limit.

**Introduction** — why any verdict from this document expires:

> We may change the Terms from time to time without notice, so be sure to check this page
> regularly.

## What the adversarial check corrected

All 13 quotes were confirmed verbatim by `grep -F` against the source, including the curly
apostrophe in "can’t" and the document's own ungrammatical "You are securities
professional". Nothing was tidied or stitched. Four corrections were applied to the
*commentary* before it reached this document:

1. **Attribution was inferred from silence, and that was wrong.** The first draft concluded
   "no attribution required". The document never addresses attribution either way; its
   silence is not a finding that none is owed. Corrected to: the document is silent, and
   separately grants no right to any mark.
2. **"Tolerated as personal use" invented a word.** The document grants nothing
   affirmative. There is no residual right to fall back on.
3. **The disqualifiers were mis-ordered** in the commentary (securities professional is
   listed first, not second). Quotes were intact; only the narration was wrong. Fixed above.
4. **The conditions were framed as a safe harbour.** There is none — see below.

## ⚠ There is no safe harbour

Finnhub may terminate access at its **sole discretion without prior notice** for conduct it
believes violates the Terms. It judges compliance unilaterally. The conditions below reduce
exposure; they do not license it, and meeting them does not make a deployment safe.

Two further exposures this reading does **not** resolve:

- **The clause cuts inward.** "Share access to data ... with anyone or any 3rd party",
  read as broadly as the redistribution analysis requires, arguably reaches the hosting
  provider, CDN, and log/error-reporting services of any deployment. Unresolved. Worth
  raising in any written request rather than discovering later.
- **Two incorporated documents are absent**: "Page 23-24 of UTP plan data policies", which
  carries the operative Non-Professional definition, and the Subscriber Agreement form. The
  real Non-Professional test lives there, not here.

## What it means for this project, by stage

- **Solo development and testing (today).** Personal use is contemplated and permitted —
  "All plan listed ... is strictly for personal use" presupposes it. This is the licensed
  posture for this stage, not merely the cheap one.
- **Anyone else can reach the app.** The redistribution clause bites, and it bites on
  *derived* results too. A single invited tester is "anyone".
- **⚠ Paying does not fix it.** No tier in this document "explicitly states otherwise".
  Written approval is the only stated route. ⚠ But note the honest limit of that claim:
  the escape hatch is written into the clause, and the absence of a commercial tier *in
  the ToS* is **not** evidence that no such tier exists. The pricing page and any
  Enterprise agreement are not part of this document.

## This is the same shape as FMP, arrived at independently

| | FMP §2.2.2 | Finnhub |
|---|---|---|
| Multi-user deployment | barred without a "specific agreement" | barred without "written approval" |
| Does a higher tier fix it? | No — "irrespective of whether such usage is complimentary or paid" | No — no tier "explicitly states otherwise" |
| Route through | Order Form under §2.1 | written approval |

Two of the eight sources on the personal-vs-commercial question now read the same way from
two unrelated documents. That makes it a pattern rather than one vendor's quirk, and it
argues for treating "obtain written terms before launch" as a programme rather than a
per-vendor errand.

## The decision this hands you

1. **`review`** — the document has been read. Flipping to `'verified'` is yours.
2. **`verdict`** — currently `conditional`, and that is the right label on this evidence:
   personal use is affirmatively contemplated, so this is not a flat prohibition. ⚠ **Do
   not flip to `prohibited` casually** — that is a `pinnedFetch` socket block and Finnhub
   is a quote-ladder rung.
3. **The action** — written approval must be sought before any multi-user launch. Same
   conversation as FMP's Order Form, and worth having once rather than twice.
4. **Still unread on this question:** Twelve Data and Binance.US. Both were attempted in
   this batch; both readings were rejected by the adversarial check and are being redone.
