# Owner decisions — 2026-10-04

Recorded from the owner's answers while working through the blocked list, starting at its top:
T-119, then T-005. Same form as `2026-10-03-owner-decisions.md`: one row per ruling, what it
cascades to, and what was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D54 | Which 2026-09-26 source-terms readings to mark `verified` (T-005), held under D46 on 2026-09-30 with "Not yet" | **Option 1, "All 17 fully read and settled"**, in reply to the same three options D46 offered: *"Close t-119 and go with option 1 for t-005."* The 17 are the set as offered on 2026-09-30: the eleven clean readings (sec.gov, home.treasury.gov, frankfurter.dev, wikipedia.org, cdn.jsdelivr.net, alternative.me, mempool.space, lunarcrush.com, lido.fi, marinade.finance, and yahoo.com, which stays prohibited), plus the six ruled on in that session's first batch of questions (okx.com, nasdaqtrader.com, kucoin.com, alphavantage.co, messari.io, santiment.net). → APPLIED | Each entry in `sourceTerms.ts` goes `review: 'seeded'` → `'verified'`, with `reviewedAt` set to 2026-09-26, the day the document was read. The registry goes from 26 to 43 verified of 56, and from 30 to 13 seeded. Each `finding` now says what the document says, in place of text written before anyone had read it. The only verdict that moves is alternative.me's (see the notes). T-005 closes |

## Notes

**What "verified" means here.** The registry keeps two separate facts about each source.
`review` says whether someone has read the source's terms. The verdict is what we concluded
from them. Marking an entry verified records the first fact. It does not say the permission
is enough for a public launch. Four of the 17 are for personal use only (KuCoin under D42;
Alpha Vantage, Messari and Santiment under D43). OKX is prohibited (D40). Nasdaq Trader's
question is still open under T-407 (D41). Each entry keeps those conditions as they were.

**Why these 17 and not the four ruled on later that day.** On 2026-09-30 the sign-off
question came in the same batch as the CoinMarketCap question (D44) and the Jito, Rocket
Pool and Pendle question (D45). So option 1 named the six sources already ruled on and left
out "the four with an open question". Those four have been ruled on since, but they stay
`seeded`: marking them needs a separate yes. Eight more stay seeded for reasons D54 does
not touch:

- CryptoPanic: its API terms page would not open.
- Binance.com, HTX and XT.com: they could not be read.
- DefiLlama, Blockchain.com, Stride and Beefy: they publish no terms document.

Yearn is no longer fetched at all.

**alternative.me's verdict moved from approved to conditional.** Its terms allow commercial
use "as long as the attribution is given right next to the display of the data". The
registry uses `conditional` for exactly that: a use that is allowed while a condition holds.
`approved` means no condition. The app fetches nothing differently. The Cycle Context card
already named alternative.me in the caption under the figure. The Market Structure panel
named it only in its header badge, and now also credits it beside the figure. A test checks
both places, and it fails if either credit is removed or the verdict is set back.

**Addresses.** Four `termsUrl` fields now point at the document that was actually read,
instead of an API documentation page:

- **Treasury:** the live policy page the reading found.
- **OKX:** the API Agreement, which the T-005 note asked to have recorded.
- **Nasdaq Trader:** its Copyright & Disclaimer page.
- **KuCoin:** its Terms of Use.

The last three were found by web search on 2026-10-04. This cloud session cannot open those
sites, so each entry says how its address was found and asks for it to be confirmed at the
next reading. A search did not turn up mempool.space's Terms of Service. Its entry still
links the API docs, and its finding names the Terms of Service as the document read.

**Two tests changed with the facts.** Two registry tests measured the Treasury entry's age
from a fixed test date, 2026-08-06. The entry is now dated 2026-09-26, after that date, so
both tests count from the entry's own date instead. The provenance test already worked that
way.

**T-119, closed the same day.** This was a status change on a ledger item, not a new
ruling. T-119 was waiting for the owner's wording for four blank sections on the old How We
Make Money page. That page was replaced when the How we make money section of `/about` was
built (D50, T-293). With no paid links at launch (D49), there are no referral programs to
list or to name a paid entity for. The owner's Draft v1 text covers the rest: who runs the
sites, a complaints route, and a statement that the sites are for people in the United
States. Two things remain, and each already has an item. T-291 tracks the remaining blanks
(company name, contact email) and the owner's approval of the text. T-125 tracks the UK rules
on financial promotions and other countries' rules, parked until paid links are considered
after launch.
