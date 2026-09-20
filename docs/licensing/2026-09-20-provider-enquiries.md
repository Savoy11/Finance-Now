# Provider licensing enquiries — drafts, 2026-09-20

**These are drafts for the owner to review, edit and send.** Nothing here has been sent,
and no vendor has been contacted. Sending is the owner's act.

## Why these exist

Four provider terms were read on 2026-09-20 (FMP on 2026-09-13). All four say the same
thing in different words: **a deployment other people can reach is outside the default
licence, and buying a higher tier does not change that.** Three name a route through; one
does not.

| Source | The clause | Route it names |
|---|---|---|
| FMP | §2.2.2 — no showcasing on applications "designed for utilization by multiple individuals, irrespective of whether such usage is complimentary or paid" | Order Form under §2.1 |
| Finnhub | "not redistribute or share access to data or derived results … with anyone or any 3rd party" | written approval |
| Twelve Data | §2.2(e) — redistribution "or external display" only as authorised | Redistribution Rights Add-On or separate written agreement |
| Binance.US | IP licence does not permit "distribution, public performance, or public display" | **none stated** |

Readings: `docs/audits/terms-review-fmp-2026-09-13.md`,
`terms-review-finnhub-2026-09-20.md`, `terms-review-twelvedata-binanceus-2026-09-20.md`.

## Three things to decide before sending

1. **Scale and commercial posture are genuinely undecided** (D21 defers paid decisions).
   Each draft therefore asks what options exist rather than committing to one. That is
   honest, and it is also the right negotiating position — but if the owner has a firmer
   answer, saying so will get a more useful reply.
2. **These disclose the project to vendors.** A licensing enquiry tells a provider that an
   application exists, roughly what it does, and that a launch is contemplated. That is
   normal and low-risk, but it is a disclosure and it is the owner's to make.
3. **None of this is legal advice.** The readings are careful but they are readings, and
   two of the four carry unresolved questions (below). Anything that becomes a signed
   agreement deserves a lawyer's eye.

## ⚠ Two questions to ask even if no licence is pursued

These are not commercial questions and they bear on the app **today**, solo:

- **Twelve Data** — "Internal Use" is defined as "internal **business** purposes". Whether
  an unpaid personal project is an internal *business* purpose is unclear, and the app may
  sit outside the only permitted-use category even now.
- **Binance.US** — the IP licence does not permit "the modification or derivative uses of
  the Materials". Finance Now computes indicators from price data, which is arguably
  exactly that.

---

## 1. FMP — Order Form for a multi-user application

> **Subject:** Licensing question — multi-user application under §2.2.2
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that uses the FMP API
> server-side for quotes, a stock-screener universe, a market calendar and historical
> OHLCV. It is currently a solo development project and is not publicly accessible.
>
> I have read the Terms of Service (last updated 1 August 2023) and want to get the
> licensing right before anyone else can reach the application, rather than after.
>
> My reading is that §2.2.1 covers my present use — an individual, own purposes, no
> third-party access — but that §2.2.2 forecloses any deployment "designed for utilization
> by multiple individuals, irrespective of whether such usage is complimentary or paid",
> absent a specific agreement, and that broader rights come from an Order Form under §2.1
> rather than from a higher subscription tier. Three questions:
>
> 1. Is that reading correct — specifically, that no subscription tier by itself permits a
>    multi-user deployment, and that an Order Form is the mechanism?
> 2. What does an Order Form covering a small multi-user application involve, and what is
>    the typical lead time? Scale is modest and not yet fixed; I would rather describe it
>    accurately than guess.
> 3. §2.6.2 incorporates an "Acceptable Data Use Policy" by reference at
>    financialmodelingprep.com/acceptable-data-use-policy and defines its violation as a
>    material breach. That URL currently returns 404 on both financialmodelingprep.com and
>    site.financialmodelingprep.com. Could you point me to the operative document?
>
> Thank you,

*Note: question 3 is worth asking regardless of the licensing outcome. A term incorporated
by reference, whose breach is defined as material, should be readable at the address the
contract gives.*

---

## 2. Finnhub — written approval, and two missing documents

> **Subject:** Written approval for a multi-user application, and two referenced documents
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that uses the Finnhub API
> server-side for equity quotes. It is a solo development project today and is not publicly
> accessible.
>
> Reading the Terms of Service, the operative clause appears to be under "Redistribution
> Rights and Personal Use": that I may not "redistribute or share access to data or derived
> results from the data obtained from Finnhub with anyone or any 3rd party without written
> approval from Finnhub". I want to resolve this before anyone else can reach the
> application. Four questions:
>
> 1. What is the process for obtaining that written approval, and what does it typically
>    involve?
> 2. The same section says "All plan listed on Finnhub website is strictly for personal use
>    unless explicitly stated otherwise." Is there a plan or licence that does explicitly
>    state otherwise — i.e. one permitting display of Finnhub-derived data to users?
> 3. How far does "derived results" reach? A computed indicator or chart derived from price
>    data, displayed to a user, appears to be covered on a plain reading. Is that the
>    intended scope?
> 4. Two documents are referenced but I have not been able to locate them: "Page 23-24 of
>    UTP plan data policies", which governs the Non-Professional definition, and the
>    Subscriber Agreement form. Could you send both?
>
> Thank you,

*Note: the Terms carry no date anywhere and reserve the right to change without notice, so
it is worth asking, informally, whether a dated copy can be provided.*

---

## 3. Twelve Data — Redistribution Rights Add-On, and a definitional question

> **Subject:** Redistribution Rights Add-On, and a question about "Internal Use"
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that uses the Twelve Data
> API server-side for quotes and historical price data. It is a solo development project
> today and is not publicly accessible.
>
> I have read the Terms of Use (last updated 1 January 2026). Three questions, the first of
> which applies to my use right now rather than to any future launch:
>
> 1. **"Internal Use"** is defined as "use solely for Customer's internal business purposes
>    and not for redistribution or external commercial purposes", and §2.1/§2.2(a) scope the
>    licence to it. My use is an individual's own project, not a business activity. Does
>    "internal business purposes" cover an individual using the data for their own
>    non-commercial project, or is a different licence appropriate for that?
> 2. §2.2(e) permits redistribution "or external display" only as authorised by a
>    Redistribution Rights Add-On or a separate written agreement. What does the Add-On
>    cover and cost, and does "external display" include showing data within a web
>    application's own UI to its users, as distinct from re-serving the data through an API?
> 3. §2.3(g) limits storage and caching to "permitted timeframes specified in the
>    Documentation". I have not been able to locate those timeframes at
>    twelvedata.com/docs — could you point me to them? I would like to confirm my cache
>    TTLs are inside the limit.
>
> Thank you,

*Note: question 3 has a concrete engineering consequence — this app's cache TTLs are
currently unverified against a binding limit it cannot find.*

---

## 4. Binance.US — no stated route, so this one asks a different question

Binance.US names **no mechanism** for multi-user permission. So rather than requesting one,
this enquiry asks whether a different instrument governs API market data at all.

> **Subject:** Which terms govern programmatic market-data access?
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that reads public market-data
> endpoints from binance.us server-side, at low volume and without an account. It is a solo
> development project and is not publicly accessible.
>
> I want to confirm which terms govern that use. Three questions:
>
> 1. Is the Terms of Use (last updated 5 June 2026) the operative document for programmatic
>    market-data access, or is there a separate API or market-data licence?
> 2. The Intellectual Property licence is granted "for your non-commercial personal or
>    internal business uses" and states it does not permit "the modification or derivative
>    uses of the Materials". My application computes technical indicators from price data
>    and displays the results. Is that within the licence, or does it require separate
>    permission?
> 3. If an application were to become accessible to other users, is there a route to
>    permission for displaying binance.us market data to them? The Terms of Use does not
>    appear to describe one.
>
> Thank you,

*Note: question 2 is the one that matters most and it is not a launch question — it bears on
what the app does today. Question 3 may simply have the answer "no", which is itself useful:
it would make Binance.US a source to design away from rather than negotiate with.*

---

## After the replies

Whatever comes back is **evidence, not ratification**. Record it the way the readings were
recorded — a dated audit document with verbatim quotes, then the registry entry, then the
`review`/`verdict` flags as a separate, deliberate act. A vendor's email saying "that's
fine" is not a licence amendment, and should not be recorded as one.
