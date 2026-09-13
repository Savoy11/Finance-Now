# Can Twelve Data replace FMP? — assessment, 2026-09-13

**Short answer: no, and the hypothesis that prompted this was wrong.**

The idea, formed earlier the same day: FMP §2.2.2 forecloses multi-user display
"irrespective of whether such usage is complimentary or paid", while Twelve Data's ToS
permits display "as expressly permitted by your Subscription Tier, Redistribution Rights
Add-On, or separate agreement". If Twelve Data could cover FMP's exclusive roles, launch
licensing would become a **purchase** rather than a **negotiation**.

It does not hold up, on both halves independently.

## Half 1 — API coverage: 2 of 3 roles, and the missing one is the important one

FMP is the sole source for three things. Checked against Twelve Data's 151 documented
endpoints plus live keyless probes:

| FMP's exclusive role | Twelve Data equivalent | Verdict |
|---|---|---|
| OHLCV fallback | `/time_series` | ✅ Direct |
| `/live-data/market-calendar` | `/earnings_calendar` | ✅ Exists — probed live, returns **403** on free: *"available exclusively with grow or pro or ultra or venture or enterprise plans"* |
| **Stock Registry universe** | **nothing equivalent** | ❌ **Blocker** |

**There is no equity screener in Twelve Data's API.** The only "screener" in their docs
is money-market-fund metrics. The closest substitute is `/stocks`, which works keyless —
1.26MB of NASDAQ listings — but returns only `symbol, name, currency, exchange,
mic_code, country, type, figi_code, cfi_code`.

That is a **ticker list, not a screenable universe**. `UniverseEntry` needs `sector`,
`industry`, `marketCapB`, `referencePrice`, `dividendYieldPct` and `beta`, and
`toEntry()` **rejects outright any row without a market cap** — it is both the sort key
and the screener's primary filter.

Twelve Data does expose `/market_cap`, `/statistics`, `/profile` and `/beta` — **all
per-symbol**. Building the universe from them means thousands of calls per rebuild
instead of FMP's single `company-screener` request. There is a `/batch` async-job
endpoint that might carry it, but that is a rearchitecture of the universe build, not a
provider swap.

**So this was never a like-for-like substitution**, and FMP's single-call screener is
precisely why it is hard to displace.

## Half 2 — licensing: their standard tiers are internal-use too

The ToS clause that started this is real. But the **pricing page**, which is what a tier
actually sells, describes every standard licence as internal:

> **Internal non-display data access** — "Use the data internally for programmatic
> processing, analysis, system integration, and internal display. **The data may not be
> redistributed or made available to external parties.**"
>
> **Internal display data access** — "View-only access for **internal use** within your
> applications and dashboards. The data may be displayed but cannot be programmatically
> processed, stored, transformed, or redistributed."
>
> **Internal non-display usage** — "Data may be used internally for **testing,
> evaluation, or development purposes only**. The data **cannot be displayed to users,
> shared externally, or used in production systems**."

The page's two licence headings are "Personal & non-commercial" and "Commercial &
professional" — and the commercial one is still framed as *internal*. The
"Redistribution Rights Add-On" named in the ToS does **not** appear as a purchasable
line item on the public pricing page; the visible "Data add-ons" are market-coverage
extras (European instruments, ASX).

⚠ **Worth checking separately:** that third descriptor — "testing, evaluation, or
development purposes only… cannot be displayed to users… or used in production systems"
— reads like the free tier. Twelve Data is currently **rung 3 of the live equity quote
ladder**. If that language governs the free key, the free tier is narrower than this
project has assumed, in a way that bites at the same moment FMP does.

## The reframe that actually matters

The recurring axis across FMP, Finnhub and Twelve Data is **not** "personal vs
commercial". It is **internal use vs public-facing display**.

Finance Now is a public-facing display application. That is the category every one of
these providers charges separately for, gates behind an agreement, or excludes from the
standard tiers entirely. Reading the question as "are we commercial yet?" misses it —
a free, non-commercial, publicly reachable app is still **display to third parties**.

## Recommendation

1. **Do not plan a migration off FMP on licensing grounds.** It does not buy a cleaner
   licence and it costs the universe.
2. **Neither provider offers a checkout path.** Both need a conversation. Budget lead
   time before launch rather than expecting a plan upgrade to settle it.
3. **Ask both the same question**, which is now precise: *"We operate a publicly
   reachable web application that displays your data to its users. Which plan or
   agreement covers that, and what does it cost?"* That question is answerable by a
   salesperson in one email; "are we commercial?" is not.
4. **Keep building on the free tiers.** Solo development is licensed under FMP §2.2.1
   and plausibly under Twelve Data's development language. Nothing here blocks feature
   work — it blocks *launch*, which is the right place for it to bite.
