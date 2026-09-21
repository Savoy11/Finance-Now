# FMP terms of service — first actual reading, 2026-09-13

**This is a reading, not a verdict.** The document was opened and the licensing
clauses read on the owner's machine. Changing `review: 'seeded'` → `'verified'`, and
changing the `verdict`, are the owner's acts — see "The decision this hands you".

Closes the open question recorded in `lib/server/sourceTerms.ts` since 2026-09-02 and
described there as "the load-bearing one": FMP backs **7 live-data routes across 20
files** — the first rung of the quote ladder, the only source for the Stock Registry
universe and `/live-data/market-calendar`, and the OHLCV fallback.

## Why it was never read before, and it was not the document's fault

`docs/audits/terms-review-2026-09-09.md` records, for this host:

> | Probe outcome | `registry-seeded` |
> | robots.txt | robots.txt not readable (fetch failed) — no stated restriction |
> | Terms found at | _none found at the usual locations_ |

Fetched today from a clean residential egress (Charter/AS11426, `proxy:false`):

```
https://site.financialmodelingprep.com/terms-of-service   HTTP 200   83,749 bytes   0.96s
```

It reads fine. The 2026-09-09 run was behind Bitdefender WireGuard (AS62651), the same
egress that made mempool.space look dead — so "terms not found" was never a fact about
FMP. **That is the fourth time in this repo a transport failure has been recorded as a
property of a source.** The rule already written in `CLAUDE.md` — *"couldn't read it is
not permission"* — did its job: the entry stayed `seeded` rather than drifting to
cleared. The gap was that nobody re-ran it from a second egress.

> ### ⚠ Correction, 2026-09-20 — the paragraph above misdiagnosed its own example
>
> The cause was the **User-Agent**, not the egress. Measured from a clean residential
> connection (Spectrum, `proxy:false`, `hosting:false`) — same host, same second, varying
> only the request header:
>
> | request | result |
> |---|---|
> | no User-Agent | `403`, 919 bytes |
> | `PROBE_USER_AGENT` (`FinanceNow/1.0 …`) | `403`, 919 bytes |
> | `curl/8.0` | `403`, 919 bytes |
> | a browser UA | **`200`, 83,325 bytes** |
>
> `site.financialmodelingprep.com` filters by user-agent. The VPN was never the variable,
> and the 2026-09-13 success was almost certainly a browser fetch rather than a change of
> network. The paragraph above names this exact failure mode — a transport failure
> recorded as a property of a source — and then commits a variant of it, swapping one
> transport-layer cause for another without testing between them. **Counting the instances
> is not the same as ruling one out.**
>
> Two things follow. The reading itself is unaffected: the clauses below were read from
> the real document and none of this touches them. But **`npm run terms:report` will report
> FMP unreadable from every network, forever**, because the probe sends
> `PROBE_USER_AGENT` — so item 4's "this one took about ten minutes from a working egress"
> understates it for any host that filters agents. The cure there is a browser, not a
> different network.
>
> Not a licence to spoof a browser UA for **data** fetches: the app's honest agent is what
> its robots.txt compliance is built on. This is about a human reading a public legal page.

Document metadata: **"Terms of Service - FMP API", last updated 1 August 2023.**

## The clauses

**§2.2 Data License** grants access "to the extent intended and permitted by the
functionality thereof in sections 2.2.1 and 2.2.2." Those are the only two.

**§2.2.1 Personal Use** —

> This license may only be used by a Customer who is an individual, and strictly for
> their own personal, non-business and non-commercial purposes. In no event may the
> Customer use this licence on behalf of a company, partnership, organization, group,
> entity or any other third party. This license is personal to the Customer, and the
> Customer may not share FMP Services or Data, resell, permit other users access to our
> Services through the Customer's account, **integrate the Data or Services into any
> tools or applications accessible by any third parties**, or use the Services to host,
> share, display, or provide content for others.

Its definition of "Commercial Use" is unusually broad:

> **Association with Business or Commercial Entities:** Any association with a company,
> organization, or **non-personal domain**, including but not limited to being an
> employee, contractor, representative, or having any affiliation suggesting a
> connection with a business or commercial entity.

**§2.2.2 Data Display** — the clause that decides this for Finance Now:

> **Without a specific agreement with FMP**, customers are prohibited from showcasing
> FMP Services or Data on platforms including but not limited to websites, blogs,
> software products, or applications **designed for utilization by multiple
> individuals, irrespective of whether such usage is complimentary or paid**, and
> whether it pertains to internal or external organizational purposes.

**§2.1 The Services License** — where broader rights actually come from:

> FMP hereby grants to Customer a limited, revocable, non-exclusive, non-transferable,
> non-sublicensable right and license to access the Data and FMP APIs **specified in the
> Order Form** or in Customer's account during the Subscription Period **for the purposes
> stated on the Subscription**.

**§2.6.1 Restrictions** applies regardless of tier: no reselling, sublicensing,
distributing "or otherwise provid[ing] access to The Services, or data or information
contained in or derived from The Services, to any third party."

## Both recorded claims were wrong

| Source | Asserted | The document |
|---|---|---|
| `sourceTerms.ts` `finding` (seeded, 2026-08-06) | "Redistribution beyond the licensed application requires **a higher plan**" | Says no such thing. Broader rights come from a **specific agreement / Order Form**, never from tier |
| 2026-09-01 fund-fee assessment | "personal use on **every** tier" | Nearer, but not exact — §2.1 lets an Order Form state other purposes |

**There is no Commercial Use licence section in the ToS.** The "Personal Use" and
"Commercial Use" links visible on the site are **navigation**, sitting between "Pricing"
and "Sign In" — not clauses. Both prior claims were reasonable-sounding inferences from
the pricing page. Neither survived the document.

## What it means for this project, by stage

- **Solo development and testing (today).** §2.2.1 plausibly covers it: an individual,
  own purposes, an app not accessible to third parties. **Staying on the free tier is
  the licensed posture for this stage, not merely the cheap one.**
- **Anyone else can reach the app.** §2.2.2 applies — it names "software products or
  applications designed for utilization by multiple individuals" and forecloses the
  obvious escape with "irrespective of whether such usage is complimentary or paid".
  A free beta is not a loophole.
- **⚠ Paying does not fix it.** An earlier suggestion in this session — buy a month of
  paid near launch and the licence resolves itself — is **wrong on this reading**, and
  is corrected here so it is not repeated. Tier buys coverage; §2.2.2 is released by an
  *agreement*. Those are different purchases, and the second has a lead time.

## The §2.6.2 document does not exist

> Customer shall comply with the FMP Acceptable Data Use Policy ("ADUP"), posted here
> financialmodelingprep.com/acceptable-data-use-policy at all times. **Violations of the
> FMP ADUP will constitute a material breach of the Agreement.**

That URL returns **404** on both `financialmodelingprep.com` and
`site.financialmodelingprep.com`. A term incorporated by reference, whose breach is
defined as material, is currently unreadable at the address the contract gives. Worth
raising with FMP alongside any licensing conversation — not a loophole to rely on.

## The decision this hands you

1. **`review`** — the document has now been read. Flipping to `'verified'` is yours.
2. **`verdict`** — currently `conditional`. On §2.2.2 a multi-user deployment without an
   agreement looks closer to `prohibited`. ⚠ **Do not flip that casually:** in this
   codebase `prohibited` is enforced by `assertSourceNotProhibited` in `pinnedFetch`,
   i.e. a hard socket-level block. It would take 7 live-data routes down immediately —
   quotes, Stock Registry universe, market calendar, OHLCV fallback. The honest interim
   is `conditional` with conditions rewritten to match the document.
3. **The action** — contact FMP about an Order Form covering a multi-user application,
   before launch rather than at it.
4. **The other seven.** Finnhub's entry already reads "free tier is explicitly not for
   commercial redistribution" and is also `seeded`. The same reading now needs doing for
   Twelve Data, Tiingo, Binance.US, YouTube, OilPrice and Bitget. This one took about
   ten minutes from a working egress.
