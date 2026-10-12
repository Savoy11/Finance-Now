# Kraken market-data enquiry — draft, 2026-10-12

**A draft for the owner to review, edit and send.** Nothing here has been sent, and Kraken has
not been contacted. Sending is the owner's act. Same footing as the drafts in
`2026-09-20-provider-enquiries.md` and `marketaux-enquiry-2026-10-07.md`.

## Why it exists

T-423: the crypto charts (`/live-data/ohlcv`) still run on Binance and Binance.US, which D96
allows only until launch. CoinGecko alone cannot replace them on its free service (D102), so a
second chart source is needed. The terms of five keyless exchange feeds were read on
2026-10-12 (`docs/audits/terms-review-chart-feeds-2026-10-12.md`), and none allows public
display on its default terms. **Kraken fits best if permission can be had:** it lists 58 of the
app's 80 coins (Binance.US: 47) and serves 720 daily candles. The owner asked for this letter
on 2026-10-12 (*"merge, and draft the Kraken letter"*).

What its Global Terms of Service (last updated 6 October 2026) say:

| Clause | Text |
|---|---|
| Scope | they "govern your use of our services, and our websites … and any other interfaces we make available" |
| Our Content | permitted "only for your own benefit"; "If you wish to use Our Content for any other purpose you must seek prior permission to do so by contacting" **marketdata@kraken.com** |
| Restrictions | may not "distribute or otherwise commercially exploit or make available to any third party Our Content in any way" |
| Restrictions | may not "create, use, operate, or employ any bots, robots, parsers, spiders, scripts, programs, routines, or any other forms of automation to engage in any activity on Our Content" |

## Before sending

1. **Confirm the address.** Cloudflare hides it in the page text, and it was decoded from the
   page's HTML. Open https://www.kraken.com/legal/global-terms in a browser, find the sentence
   ending "by contacting", and check that it shows marketdata@kraken.com.
2. **It names the AI assistant on purpose.** The app's assistant reads price history to answer
   questions (`get_price_history` in `lib/agents/tools.ts` sends the model a summary, not the
   candles). A permission that doesn't mention that would not cover it, and Coinbase's market
   data terms now bar AI use outright, so data owners do write rules about it. Leaving it out to
   get an easier yes would buy a permission that doesn't fit the app.
3. **It states the commercial plan as recorded.** D22: *"The goal will be commercial"*, and the
   draft disclosures say "Finance Now charges nothing today" with paid plans to be described
   when they start. If that has changed, edit the letter first.
4. **A quoted fee is information, not a commitment.** Under D21, paid decisions wait; record
   whatever Kraken quotes, and decide later.
5. **It discloses the project to a vendor,** and none of this is legal advice. Anything that
   becomes a signed agreement deserves a lawyer's eye.
6. **Fill the blanks:** [NAME], and [COMPANY LLC NAME] if the company exists by then (the
   disclosures carry the same blank). Send from your own address.

---

> **To:** marketdata@kraken.com
>
> **Subject:** Permission to display Kraken chart data in a web application
>
> Hello,
>
> I'm building Finance Now, a financial analytics web application [operated by
> COMPANY LLC NAME]. It is a solo project today and nobody else can reach it, but it is being
> built to become a public, commercial product: nothing is charged now, and paid plans are
> planned but not yet defined. I'd like to use Kraken's public market data for its crypto
> charts, and your Global Terms of Service (last updated 6 October 2026) say that using Our
> Content other than for my own benefit needs prior permission from this address. So I'm asking
> before anyone else can use the application rather than after.
>
> **What I would use.** The public REST endpoints, called server-side without an account:
> `/0/public/AssetPairs` to find which coins Kraken lists, and `/0/public/OHLC` for candles from
> 15-minute to weekly, for about 60 coins. Each response is cached for between one minute and
> one hour depending on the candle size, so volume is low: a full scan of every coin is roughly
> two requests per coin.
>
> **How it would be shown.** Candlestick charts on each coin's page; technical indicators
> computed from the candles (moving averages, RSI and similar); a scanner that looks for chart
> patterns across the coins; and an AI assistant that can look up a coin's price history to
> answer a user's question about it. The application's pages fetch the candles from its own
> server to draw them, but the candles would not be offered through its public API or as a
> download. Each chart and figure would carry "Data provided by Kraken" with a link to
> kraken.com, or whatever credit you prefer.
>
> I have five questions:
>
> 1. Do the Global Terms of Service govern keyless use of the public REST endpoints, or is there
>    a separate API or market-data licence I should read?
> 2. The Restrictions bar using "bots, robots, parsers, spiders, scripts, programs, routines, or
>    any other forms of automation to engage in any activity on Our Content". Can you confirm
>    that this does not apply to calling your documented public API, which is designed to be
>    called by programs?
> 3. What would permission to display charts and indicators derived from Kraken data to the
>    application's users involve: the form of agreement, any fee, the usual lead time, and any
>    limits on caching or the credit line?
> 4. Would that permission cover the AI assistant? When a user asks about a coin, the
>    assistant passes a third-party AI model a short summary worked out from the candles (the
>    first and last close, the period's high and low, and the percentage change), and the
>    model uses it to write its answer. The application does not train any model on the data.
> 5. `/0/public/OHLC` returns the most recent 720 candles for each interval. Is longer daily
>    history available under the same permission, and if so, how?
>
> Thank you,
> [NAME]

---

## After a reply

Whatever comes back is **evidence, not ratification**. Record it as the 2026-09-20 drafts
describe: a dated document in `docs/audits/` quoting the reply word for word, then the owner's
decision. An email saying "that's fine" is not a licence, and should not be recorded as one.

**If Kraken is adopted,** it needs a `sourceTerms.ts` entry and a `dataSources.ts` entry before
the first fetch (the source-terms test fails on an unregistered host), and the chart route's
Binance rungs come out (T-423).
