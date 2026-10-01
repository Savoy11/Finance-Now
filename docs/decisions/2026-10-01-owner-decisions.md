# Owner decisions — 2026-10-01

Recorded from the owner's answers to a review of the ledger's parked items, the session's
two questions at its end. Same form as `2026-09-30-owner-decisions.md`: one row per
ruling, what it cascades to, and what was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D51 | The old platform's Series A plan (T-218, T-222, T-224) | **Close all three.** *"Lets close the three from the old platform model."* The paying institutional pilots, the 1,000-requests-a-second load test and the business proof points (ARR, NRR, TAM, positioning, narrative, advisors) come from the Series A Readiness Roadmap in `docs/audits/production-readiness-scorecard.md`, written for the CAEP-era stablecoin-risk product before the multi-asset suite. Chosen over "keep them parked in case investor money is raised later". → APPLIED | T-218, T-222 and T-224 close as moot. The scorecard section stays as dated history, under a banner that says so. A future fundraising plan starts fresh rather than from these items. T-217 (enterprise operations) is not part of this ruling and stays parked under D5 |
| D52 | T-031, the hand check of the transfer-fee table, while Transfer Fees is hidden | **Work on it now, and keep the Transfer Fees tool hidden.** *"Lets work on T-031 but keep the transfer fees tool hidden."* Chosen over parking T-031 with the rest of Transfer Fees, which the session had recommended. → IN PROGRESS | T-031 stays open. T-028's withhold is unchanged: no nav entry, the `/transfer-fees` redirect stays, `/api/v1/transfer/routes` still answers 503 and the MCP route tool stays withheld. `TRANSFER_FEES_LAST_VERIFIED` moves only when every row has been checked |

## Notes

**How D51 was read.** The session had asked one question about three items, the Series A
ones, and the owner's answer names three. The review also proposed closing three settings
of the retired Python backend (T-336, T-337, T-339); that proposal was separate, was not
answered, and is not applied by this ruling.

**How D52 is worked.** This environment's network policy refuses every exchange host,
both the fee pages and the keyless fee feeds (checked 2026-10-01: help.coinbase.com,
support.kraken.com, api.kucoin.com and others, each refused at the gateway). So the owner
reads the fee pages, and the rest is done from the owner's answers:

1. `npm run fee-check-page -- <out.html>` builds a check page from `transferFees.ts`: one
   card per exchange with its fee-page link and its rows, the 45 highest-impact rows on
   exchanges with no keyless fee feed first, and each exchange's entry-tier trading fee.
   The fee re-check leads of T-037–T-053 sit on the exchanges they concern.
2. Each answer (matches, different, not offered, can't see it) is saved in the page's own
   database as it is given. A page regeneration never touches them.
3. The session reads the answers and applies them in a pull request. A changed fee goes
   through `npm run fee-apply`, whose guards abort the whole run if a row does not resolve
   or the table has moved since the owner compared it. Nothing is applied that the owner
   did not record.

Rows on the six exchanges with a keyless fee feed (KuCoin, HTX, Bitget, LBank, Bitfinex,
XT.com) are left for `npm run fee-reconcile` on the owner's machine, which checks most of
them in one run; they come after everything else on the page.
