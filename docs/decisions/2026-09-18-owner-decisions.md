# Owner decisions — 2026-09-18

Continues `2026-09-14-owner-decisions.md`, which numbered D1–D20.

---

## D21 — Paid-service decisions are deferred; build for provider optionality

**Owner, 2026-09-18, verbatim:** *"Any action that required a decision around a paid
service can be deferred until closer to the end of production. Build around it and
ensure that we have options should we decide against using a particular data
provider."*

Two instructions, and the second is the harder one.

**Deferral.** Anything whose remedy is "buy a plan" is not a defect to chase now. It is
recorded, and it waits. A surface blocked only by a paid tier stays as it is; the
correct state for it is an honest empty or a disclosed fallback, not a purchase.

**Optionality is the standing requirement.** No provider may be load-bearing. The test
is concrete and now computed: for each surface, how many independent vendors could
serve it, and what would be left with *nothing* if one were dropped. That is the
"Strands if dropped" column in `docs/audits/coverage-matrix-YYYY-MM-DD.md`, and the
number to drive toward zero.

### Where that stood when the rule was made

Four surfaces are single-sourced — dropping the vendor does not degrade them, it
removes them:

| Surface | Only vendor | Keyless fallback? |
|---|---|---|
| `security-returns` — trailing 1M/3M/YTD/1Y | Tiingo | **none** |
| `videos` — video *search* | YouTube Data API | list works via YouTube RSS; search does not |
| `stock-universe` | FMP (paid tier) | ~79-name curated catalog |
| `fund-holdings` | FMP | catalog, indicative |

`security-returns` is the one with no fallback at all, and it is the one that collides
with an existing ruling: Tiingo was settled on 2026-09-15 as *optional and not added*.

### What the providers actually offer — measured 2026-09-18

Probed directly with the keys already configured. Daily price history, which is what
trailing returns and charts need:

| Provider | Key held | Equities | ETFs (QQQ, VOO) | Mutual funds | Adjusted closes |
|---|---|---|---|---|---|
| Tiingo | no — declined | yes | yes | yes | **yes** (`adjClose`) |
| FMP free | **yes** | yes | SPY only — QQQ/VOO **402** | **402** | see below |
| Twelve Data free | **yes** | yes | **yes** | **yes** | **no** |
| Finnhub free | yes | candles **403** | — | — | — |

**T-272 is settled by this:** FMP's `/stable/historical-price-eod/full` carries **no
`adjClose`** — its fields are `symbol, date, open, high, low, close, volume, change,
changePercent, vwap`. FMP does publish `historical-price-eod/dividend-adjusted`, which
does carry `adjClose`, but on the free tier it answers for AAPL/MSFT/NVDA/SPY and
returns **402** for QQQ, VOO and VTSAX.

Two consequences follow, and they are separate:

1. **The chart ladder violates its own stated invariant.** `fetchTiingoChart`'s
   docstring says the adjusted basis matters because "a chart and a candlestick of the
   same symbol must not disagree across a split" — and the Tiingo rung honours it while
   the FMP rung maps raw `close`. Today the FMP rung serves, so charts are unadjusted.
2. **There is no free, held provider with adjusted closes across funds.** Twelve Data
   has the coverage and not the adjustment; FMP free has neither for funds. So an
   option for `security-returns` means choosing a basis, not just adding a rung.

### What is NOT decided here

Whether to serve trailing returns computed on **unadjusted** closes, clearly labelled,
or to keep the surface dark until a paid or Tiingo decision. That is a data-fidelity
call with a real tradeoff — distributions and splits distort unadjusted returns, and
for mutual funds distributions are the point — and it belongs to the owner. Recorded
here as open so it is not decided by default.
