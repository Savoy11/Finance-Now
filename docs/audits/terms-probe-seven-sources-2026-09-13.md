# The other seven sources — probe, 2026-09-13

**This is a clause scan, not a reading.** Only FMP was read properly today
(`terms-review-fmp-2026-09-13.md`). Everything here is "what the document's own words
appear to say", gathered from a clean residential egress. `CLAUDE.md`'s rule stands: a
keyword scan is not a reading, and none of these should flip to `verified` on this.

It is still worth writing down, because it **falsifies the framing this project has been
using** — including in this session an hour ago.

## The framing that was wrong

CLAUDE.md describes one open "personal-vs-commercial question" deciding **eight**
sources, as though a single ruling would settle them. It will not. The documents answer
on different axes:

| Source | What the document appears to say | Same shape as FMP? |
|---|---|---|
| **Finnhub** | Personal-only free tier, redistribution barred outright | **Yes** |
| **Twelve Data** | **Tier-dependent, explicitly** — and they sell a Redistribution Rights Add-On | **No — opposite** |
| **YouTube** | Different axis entirely: attribution and Brand Features compliance, not a personal/commercial gate | **No** |
| Bitget, Tiingo, Binance.US, OilPrice | Not established — see "registry defects" | — |

**Twelve Data is the one that breaks the pattern**, and it matters because it is the
only source so far where *paying more actually buys the permission*:

> Twelve Data grants Customer a limited… license to access and use the Platform solely
> for **Internal Use** during the subscription term, **except as otherwise expressly
> permitted by your Subscription Tier, Data add-ons, or a separate written agreement**…
>
> (b) **Display Data to Authorized Users** in accordance with this Agreement **or third
> parties as expressly permitted by your Subscription Tier, Redistribution Rights
> Add-On, or separate agreement**

with "Internal Use" defined as *"use solely for Customer's internal business purposes
and not for redistribution or external commercial purposes."*

Contrast FMP §2.2.2, which forecloses exactly that route: *"irrespective of whether such
usage is complimentary or paid."* **FMP needs an agreement; Twelve Data sells a tier.**
One ruling could never have covered both.

**Finnhub** reads like FMP, and its free tier is narrower than "non-commercial":

> You hereby agree to not redistribute or share access to data or derived results from
> the data obtained
>
> …personal use unless explicitly stated otherwise. **Personal plan can't be used by any
> business even**…

**YouTube** produced no personal/commercial restriction at all — its clauses are about
attribution, Brand Features and retained ownership. Whatever the YouTube risk is, it is
not the one this question was framed around, and it should be tracked separately.

## Registry defects found: 4 of 8 `termsUrl`s are wrong or dead

Independent of any verdict, and definite rather than interpretive:

| Entry | Registered `termsUrl` | Result |
|---|---|---|
| `tiingo.com` | `https://www.tiingo.com/about/terms` | **404** — and 4 plausible alternates also 404 |
| `binance.us` | `https://www.binance.us/terms` | **404** — 3 alternates also 404 |
| `oilprice.com` | `https://oilprice.com/terms-of-use` | **404** (a *soft* 404: serves 93KB with a 404 status) |
| `bitget.com` | `https://www.bitget.com/api-doc/spot/market/Get-Coin-List` | 200, but it is an **API documentation page, not a terms document** |

That last one is the worst of the four: it returns HTTP 200, so any probe that checks
only status would score it as "terms reachable". It has never pointed at terms.

> **Resolved same day (3 of 4).** Found via each site's own footer rather than by
> guessing paths, and each verified HTTP 200:
>
> | Entry | Corrected `termsUrl` |
> |---|---|
> | `binance.us` | `https://www.binance.us/terms-of-use` |
> | `oilprice.com` | `https://oilprice.com/terms-and-conditions` |
> | `bitget.com` | `https://www.bitget.com/terms/legal` |
>
> **Tiingo remains unresolved and needs a browser.** `tiingo.com` is an Angular SPA:
> every valid route returns the identical 20,263-byte shell, so HTTP status cannot
> distinguish a real route from a guess; the shell contains no terms link; and the main
> JS bundle has no `terms` route string, so it is lazy-loaded in a chunk. Four guessed
> paths and five candidate routes were tried. Until someone opens the site and clicks
> through, Tiingo's terms cannot be read — and it stays `seeded`, because "couldn't read
> it" is not permission.

These are fixable without any legal judgment — find the live URL, update the entry — and
until they are fixed nobody can read those four even if they want to. **"Couldn't read
it" is still not permission**; all four stay `seeded`.

## What was actually established today

| | |
|---|---|
| **Read properly** | FMP (1 of 8) |
| **Clause-scanned, shape established** | Finnhub, Twelve Data, YouTube (3 of 8) |
| **Cannot be read until the registry is fixed** | Tiingo, Binance.US, OilPrice, Bitget (4 of 8) |

## Recommended order of work

1. **Fix the four broken `termsUrl`s.** Mechanical, no judgment, unblocks everything else.
2. **Read Twelve Data properly.** It is the one source where a paid tier may genuinely
   buy redistribution rights, which makes it the cheapest route to a licensed
   multi-user deployment — and it is already a rung on the quote ladder.
3. **Read Finnhub properly.** Looks like FMP; confirm whether it also needs an agreement
   rather than a tier.
4. **Re-scope the YouTube entry** away from this question and onto attribution compliance.
