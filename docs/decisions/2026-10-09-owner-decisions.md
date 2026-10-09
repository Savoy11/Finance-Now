# Owner decisions — 2026-10-09

Continuing from `2026-10-07-owner-decisions.md`, which ends at D95. Same form: one row per ruling,
what it cascades to, and what was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D96 | How the sources' personal-use limits apply before launch. D22 (2026-09-23) answered T-151 for eight sources: the app is personal today and commercial at release, the trigger being the first page load by anyone other than the owner. The owner, reading Marketaux's terms (T-430), asked for the rule to cover every source | **Owner, verbatim:** *"Consider anything done pre launch as personal use; revaluate and apply that to all of the current sources."* → APPLIED. Asked separately whether OKX, blocked under D40, should return for the pre-launch period: **"Keep blocked"** | Every source was re-read under the rule (`docs/assessments/source-terms-prelaunch-2026-10-09.md`). Five stay blocked whatever the user (Yahoo, Cboe, Poloniex, Dow Jones, MarketWatch): their bans are not about who uses them. OKX is kept blocked: its §9.4 bars using market data "to build, operate, or contribute to any … analytics platform", and pre-launch work is building one. Fifteen personal-use licences are fine before launch, each with a named launch step; four that lacked a marker now carry one in `sourceTerms.ts` (CoinDesk, Nasdaq Trader, LBank, Bitfinex), and Marketaux carries one in PR #313. T-407: CoinDesk and Nasdaq Trader become launch steps; Investing.com, publicnode and Bitget's US clause stay open. The launch trigger is unchanged |
