# Twelve Data and Binance.US terms — first actual readings, 2026-09-20

**These are readings, not verdicts.** Both documents were captured and read on the owner's
machine. Flipping `review: 'seeded'` → `'verified'`, and changing either `verdict`, are the
owner's acts.

Together with FMP (2026-09-13) and Finnhub (2026-09-20), this closes the reading half of
the personal-vs-commercial question CLAUDE.md records as "eight sources wide".

---

## Method, and why the first attempt was discarded

Both documents were fetched over the owner's residential connection (Spectrum,
`proxy:false`, `hosting:false`) and both returned HTTP 200 to the project's own user-agent.

⚠ **The first pass was thrown away by an adversarial check, and the fault was in the
capture, not the reading.** HTML had been converted to text by replacing every tag with a
space, collapsing each agreement to a **single line**. Headings, lead-in sentences and
numbered sub-clauses ran together as continuous prose. Readers then quoted, entirely in
good faith, sentences that do not exist in the document:

> "heading + lead-in + four list items run together as prose. Verbatim against this file,
> not against the document's actual structure."

Twelve Data's §15.1 service-credit table survived the flattening as
`Monthly uptime percentag Service credit 10% 25%`.

**In a numbered agreement the structure is part of the meaning** — clause numbering and
list boundaries decide what a sentence modifies. The second capture preserves block
structure (2 lines → 1,228 and 1,785). Both re-readings then passed verbatim **and
contiguity** checks with zero bad quotes.

Anyone re-reading these documents should capture them the same way. A byte-for-byte
"verbatim" check does not catch this class of error on its own.

---

## Twelve Data — `twelvedata.com`

Terms of Use, **"Last updated: January 1, 2026"**, Twelve Data Pte. Ltd. (UEN 202006058W),
Singapore.

### It binds an anonymous fetcher, not only an account holder

> BY PURCHASING, ACCESSING, DOWNLOADING, OR USING THE TWELVE DATA PLATFORM AND ANY
> THIRD-PARTY DATA, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND
> BY THIS AGREEMENT.

Four disjunctive triggers; "ACCESSING" and "USING" need no account. And "Platform" is
defined to swallow the API — it includes "the APIs (REST and WebSocket)". So a server-side
request binds the requester.

### The default licence is Internal Use, and §2.2 is a closed list

> "Internal Use" means use solely for Customer's internal business purposes and not for
> redistribution or external commercial purposes.

> Customer is granted a limited, non-exclusive license to:

That lead-in introduces an **enumerated** grant. Anything not listed is ungranted, so the
absence of a prohibition elsewhere cannot manufacture a right.

### Redistribution is defined broadly and gated behind a purchase or a signature

> "Redistribution" means any publication, distribution, or provision of Data to third
> parties.

No carve-out for non-commercial, small-scale, free, or incidental provision.

> (e) Redistribute or provide external display of Data only if and as expressly authorized
> by a Redistribution Rights Add-On or separate written agreement with Twelve Data
> (including compliance with attribution requirements)

**"External display" is named as redistribution.** A web UI other people can load is
squarely inside it. "Only if and as" double-locks it: the permission must exist *and* the
use must stay within its terms.

### ⚠ Two things this document does not settle

1. **"Internal Use" means internal *business* purposes.** Whether an unpaid personal
   project is an internal *business* purpose is genuinely unclear. The app may sit outside
   the only permitted-use category **even today, solo**. Do not assume the solo case is
   safe merely because it is small — nobody has resolved this.
2. **§2.3(g) caps caching by "permitted timeframes specified in the Documentation"**, which
   lives at twelvedata.com/docs and is *not* part of the terms. This app's TTLs are
   unverified against the binding limit.

### Uncapped personal exposure

§9.1(c) makes "Unauthorized use or redistribution of Data" an express indemnity trigger,
and §10.3(a) lifts the §10 liability limits from Customer indemnity obligations. Getting
the redistribution question wrong is not a capped commercial risk.

---

## Binance.US — `binance.us`

Terms of Use, last updated **2026-06-05**, BAM Trading Services Inc.

### The grant, and the four things it excludes

The only permission in the document is the Intellectual Property licence, "for your
non-commercial personal or internal business uses". It is then narrowed:

> does not permit (1) the resale of the Materials; (2) the distribution, public
> performance, or public display of any Materials; (3) the modification or derivative uses
> of the Materials; and (4) the use of the Materials other than for their intended
> purposes.

"Materials" expressly covers "information, data, text, code … contained on our Sites or
such other mode of access (including through the BAM APIs)" — so market data is Materials.

### ⚠ The verdict is contested, and it is recorded unresolved

The adversarial pass challenged `conditional` on **limb (3)**: the licence does not permit
"the modification or derivative uses of the Materials", and Finance Now is an **analytics**
app whose purpose is computing indicators from price data. On a strict reading the core use
may sit outside the grant *even solo*.

It is left at `conditional` because `prohibited` is enforced by `assertSourceNotProhibited`
inside `pinnedFetch` — a socket-level block — and Binance.US is the steady-state crypto
price source for a US egress (binance.com returns 451 on US IPs; see CLAUDE.md). **That is
a statement about blast radius, not an answer to the challenge.** The challenge stands.

### Clauses that bind with no account

The Covenants lead-in — "You covenant and agree that you shall not:" — carries no account
predicate:

> (2) use any robot, spider, other automatic device, or manual process to monitor or copy
> our Website without our prior written permission

> (6) take any action that imposes an unreasonable or disproportionately large load on our
> infrastructure

And the Prohibited Use list disclaims its own completeness:

> The specific types of use listed below are representative, but not exhaustive.

### ⚠ No stated route through

FMP names an Order Form. Finnhub names written approval. Twelve Data names a Redistribution
Rights Add-On. **This document names no mechanism for multi-user permission at all** — so
"negotiate terms before launch" has no address to write to here.

### Bounded reading

Three documents are incorporated by reference and unread: Disclosures, the Privacy Policy
"and other policies mentioned therein", and Trading Rules. Risk is asymmetric: the user
indemnity is uncapped and triggers on "breach **or alleged breach**", while BAM's own
liability is capped at $10,000.

---

## The pattern across all four

| Source | Multi-user deployment | Route through | Read |
|---|---|---|---|
| FMP | barred (§2.2.2) | Order Form / specific agreement | 2026-09-13 |
| Finnhub | barred | written approval | 2026-09-20 |
| Twelve Data | barred (§2.2(e)) | Redistribution Rights Add-On or written agreement | 2026-09-20 |
| Binance.US | barred (IP licence limb 2) | **none stated** | 2026-09-20 |

Four independent documents, four different drafting styles, one answer: **a deployment
other people can reach is outside the default licence, and buying a higher tier does not
change that.** Three name a way to ask; one does not.

Two consequences worth stating plainly:

1. **"Obtain written terms" is a programme, not a per-vendor errand**, and its lead time is
   unknown for all four. It belongs before a launch decision, not at one.
2. **It strengthens D21 rather than conflicting with it.** D21 defers *paid* decisions;
   none of these is fixed by paying. The relevant half of D21 is the other one — no
   provider may be load-bearing — and here that is a licensing argument as much as an
   availability one.

## The decision this hands you

1. **`review`** for all four — the documents have been read. Flipping is yours.
2. **`verdict`** — all four stay `conditional`. Binance.US's is contested (above) and FMP's
   §2.2.2 points the same way. ⚠ `prohibited` is a socket block in this codebase; it takes
   surfaces down immediately rather than flagging them.
3. **The action** — one licensing conversation covering FMP, Finnhub and Twelve Data, before
   launch rather than at it. Binance.US needs a different approach, since it offers no route.
4. **State of the eight**, measured 2026-09-20 rather than asserted — and the distinction
   between *read* and *ratified* is the whole point of the `seeded`/`verified` split:

   | | |
   |---|---|
   | Ratified (`verified`) | Tiingo, YouTube, OilPrice, Bitget — flipped 2026-09-19 |
   | **Read, awaiting the flip (`seeded`)** | **FMP, Finnhub, Twelve Data, Binance.US** |
   | Never read | none |

   So the *reading* half of this question is closed and the *ratification* half is open on
   four entries. Registry-wide the split is 18 `verified` / 38 `seeded`; these four are
   the ones where the reading is already done and only the owner's act is missing.
