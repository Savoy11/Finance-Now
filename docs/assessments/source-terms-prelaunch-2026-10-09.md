# Every source re-read under "pre-launch use is personal use" (D96)

**Date:** 2026-10-09. **Owner, verbatim:** *"Consider anything done pre launch as personal use;
revaluate and apply that to all of the current sources."* Recorded as D96.

**What the rule means.** Until launch, every use of every source is the owner's personal use. Launch
is the moment D22 already named: **the first page load by anyone other than the owner** (a private
beta, a demo link or a shared staging address counts). D96 does not move that line; it states that
everything before it is personal, for every source, not only the eight D22 listed.

**What it cannot do.** A personal-use rule only helps where a source's limit *is* personal use.
Terms that ban automated access outright, limit an API to one purpose, or bar re-use "commercially
and non-commercially" are not about who the user is, and they stay as they were.

**Method.** All 57 entries in `frontend/src/lib/server/sourceTerms.ts` on `main`, plus Marketaux
(added in PR #313, T-430), were listed with their verdicts, and every entry whose text mentions
personal, commercial, internal or redistribution limits was read in full before being classified.

## The result

| Group | Count | What D96 changes |
|---|---:|---|
| A. Blocked whatever the user | 5 | Nothing |
| B. Reconsidered and kept blocked | 1 | Nothing (owner's choice) |
| C. Personal-use licences: fine before launch, a named step at launch | 15 (+ Marketaux) | Marked in the registry |
| D. Open for reasons other than personal use | 8 | Nothing |
| E. No personal-use limit (public data, open APIs, commercial use allowed, syndication feeds) | 28 | Nothing |

### A. Blocked whatever the user (5)

| Source | Why personal use does not help |
|---|---|
| yahoo.com | Its Terms forbid collecting data "using any automated means … for any purpose" without permission |
| cboe.com | Its quote pages forbid "auto-extraction programs/queries and/or software" |
| poloniex.com | §9 licenses the API "solely for the purposes of trading on Poloniex"; §23 bars crawling |
| dowjones.io | §9.1 would allow personal use, but §9.4.1 separately bars any automated ingestion "without our prior written consent" |
| marketwatch.com | Governed by the same Dow Jones Terms |

### B. Reconsidered and kept blocked (1)

**okx.com** (funding rates, D40). §9.4 allows Market Data "solely for your own personal,
non-commercial trading and account management purposes", which personal use might reach, but also
bars using it "to build, operate, or contribute to any … analytics platform". Pre-launch work is
building one. The owner kept it blocked on 2026-10-09; `/live-data/funding-rates` keeps answering
"no source" with the reason.

### C. Personal-use licences: fine before launch (15, plus Marketaux)

Each now carries a condition saying it is satisfied before launch and naming what launch requires.
Eleven already carried D22's "single user: satisfied today, blocking at release" marker; D96 added
the same kind of condition to four that lacked one.

| Source | What launch requires (from its entry) | Marked |
|---|---|---|
| financialmodelingprep.com | An Order Form under §2.1; no tier lifts §2.2.2's multi-user bar | D22 |
| finnhub.io | Finnhub's written approval for any redistribution, derived results included | D22 |
| twelvedata.com | A Redistribution Rights Add-On or a separate written agreement (§2.2(e)) | D22 |
| tiingo.com | A licence beyond the free tier's personal use | D22 |
| alphavantage.co | A licence beyond §2(a)'s personal use | D22 |
| coinmarketcap.com | A plan or agreement beyond the personal licence (D44) | D22 |
| binance.us | None named: its licence is "personal to you"; long-lead | D22 |
| kucoin.com | Per its entry (D42) | D22 |
| bitget.com | None named (§10.1); and see D: the US is a Prohibited Country | D22 |
| messari.io | Use only portions marked shareable, or an agreement | D22 |
| santiment.net | None named (§10.3); ask Santiment | D22 |
| coindesk.com | Written consent: the Terms grant no display to others (T-407) | **D96** |
| nasdaqtrader.com | Decide whether the symbol files are "Content", or Nasdaq's written consent (T-407) | **D96** |
| lbkex.com | Ask LBank, or stop showing its fees (only consumer, Transfer Fees, is hidden, D89) | **D96** |
| bitfinex.com | Bitfinex's written consent, Prohibited Use (g) (Transfer Fees only, hidden) | **D96** |
| marketaux.com | Marketaux's approval, and confirmation of its "automated means" clause (enquiry drafted) | **D96, in #313** |

### D. Open for reasons other than personal use (8)

| Source | The open question | Tracked |
|---|---|---|
| investing.com | Limitations on Use (c) forbids automated extraction "for any purpose"; whether RSS paths are inside it | T-407 |
| publicnode.com | Bars re-use "commercially and non-commercially", which read literally forbids using an RPC service at all | T-407 |
| lunarcrush.com | Licence "solely for purposes approved by LunarCrush" | its entry |
| reddit.com | Its robots.txt disallows this app's agent; lifts only with OAuth | T-245 |
| binance.com, huobi.pro (HTX), xt.com | Terms could not be read (and XT geo-blocks the US) | seeded |
| cryptopanic.com | API terms would not open | seeded |

Bitget's second problem belongs here too: §1 lists the United States among Prohibited Countries
while the owner is US-resident (T-407). That is about whether it may be called at all.

### E. No personal-use limit (28)

Public and government data (home.treasury.gov, sec.gov, federalreserve.gov), open or commercial-use
APIs (coingecko.com, alternative.me, frankfurter.dev, cdn.jsdelivr.net, mempool.space, llama.fi,
blockchain.info, wikipedia.org under CC BY-SA, googleapis.com and youtube.com under the YouTube API
terms), staking protocols' published endpoints (lido.fi, marinade.finance, jito.network,
rocketpool.net, pendle.finance, stride.zone, beefy.finance, yearn.finance), publishers' syndication
feeds (cnbc.com, cointelegraph.com, decrypt.co, bitcoinmagazine.com, fxstreet.com, oilprice.com), and
stocktwits.com (display with credit). Their conditions are obligations to honour at any time.

**One of these still has a launch step:** CoinGecko's API Terms §7 require a binding user agreement
and privacy policy, with six specific terms, the moment the app is offered to anyone outside the
owner's entity.

## What T-407 now holds

T-407 grouped four sources kept on an unresolved judgement. Under D96:
- **CoinDesk** and **Nasdaq Trader** are satisfied before launch; their question becomes a launch step.
- **Investing.com** and **publicnode** stay open: their limits are not about who the user is.
- **Bitget** stays open on the US Prohibited Country clause.

## The launch list

Everything in group C, plus CoinGecko's §7, is what the first non-owner page load requires.
`docs/LEGAL-REVIEW.md` carries it forward; the provider enquiries drafted on 2026-09-20 and for
Marketaux on 2026-10-07 are the start of it, and none has been sent.
