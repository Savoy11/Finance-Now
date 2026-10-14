# Live-data audit — 2026-10-14, second run (T-434 step 4)

**Owner's machine**, run after the Coin Metrics backup for closing prices landed (#349, D108), on
`main` at `6f2f8c0`. Same dev server and egress as the morning's run
(`live-data-audit-2026-10-14.md`): Spectrum, residential, `proxy` and `hosting` both false. CoinGecko
at 4 a minute (`AUDIT_CG_PER_MIN=4`), the pace the morning's run set. Raw output:
`live-data-audit-2026-10-14-t434.json` beside this file.

| | Morning (paced run) | This run |
|---|---|---|
| Finished (UTC) | 09:39 | 13:04 |
| Wall time | 500s | about 530s |
| **REAL** | 75 | **76** |
| **FALLBACK** | 5 | 5 |
| **UNCONFIGURED** | 8 | 9 |
| **FAIL** | 1 | **0** |
| Checks | 89 | 90 |

Every difference has a cause that landed between the two runs:

- **One more check, REAL:** `ohlcv eth MAX closes (Coin Metrics)`, added with the backup.
- **The one failure is gone.** The morning's FAIL was Tronscan rate-limiting this IP. Since D105 (#344)
  the TRON route calls Tronscan only with a key, and with none set it calls nothing and says why, so
  the check now reads UNCONFIGURED with that reason.
- **`network-fees`: 5 live, was 4.** Polygon's gas price reads from the host proven to answer (#343).
- **`staking-rates`: 23/48 live APRs, 5/6 upstreams, was 23/51 and 5/7.** Stride's rung and its three
  keys went with D107 (#346). Injective's endpoint still answers HTTP 502, as it did this morning.

## T-434 step 4: would dropping DefiLlama thin the charts or empty them?

**The audit's check passed, but it is not the evidence.** It returned 584 weekly ETH closes, credited,
in 44 ms. At that speed it was almost certainly Next's data cache answering, from a test call made
earlier the same day, so it shows the route handles Coin Metrics' answer, not that Coin Metrics
answered just then.

**The evidence is a sweep with fresh calls.** The chart route was asked for every catalog coin's MAX
history from Coin Metrics alone (`source=coinmetrics`), one request every 0.8 seconds, under Coin
Metrics' 10 per 6 seconds. That is what the charts would get past 365 days if DefiLlama were gone.
Raw output: `coinmetrics-sweep-2026-10-14.json`.

| | Coins |
|---|---|
| In the catalog (`COINGECKO_IDS`) | 80 |
| On the Coin Metrics map (`COINMETRICS_ASSETS`) | 69 |
| Served | **69** |
| Served more than a year of history | 69 |
| Weekly spacing, as the range asks | 69 |
| Credited (CC BY-NC 4.0) | 69 |
| Latest price more than 4 days old | 0 |
| Served without being on the map | 0 |

- **Every served series ends on 2026-10-13**, the day before the run; Coin Metrics publishes a day behind.
- **History lengths:** the shortest is USDG, 62 weeks from its 2025-08-12 launch, then RLUSD (95),
  HYPE and EURC (96) and KAIA (101). The longest are Bitcoin (848 weeks, from 2010-07-20), Litecoin (707)
  and Dogecoin (664). The median is 321 weeks.
- **The eleven not served** each answered `coinmetrics-no-mapping`, as designed: TON, PI, TEL, MemeCore,
  EURCV, XSGD, USDM and vBUSD (not carried by Coin Metrics) and MKR, AMPL and USDK (series stopped).

**Answer:** with DefiLlama gone, 69 of the 80 coins keep their full long-range charts and closes-only
readings. The other eleven lose history past 365 days; within 365 days they still fall through to
CoinGecko's candles, subject to its rate limit.

## The coverage matrix cannot see this, and that is a finding

T-434's step 4 also asked for `npx tsx scripts/gen-coverage-matrix.ts` to show that DefiLlama no
longer strands `ohlcv`. Run on this audit (`coverage-matrix-2026-10-14.md`), it reports 32 surfaces
live, 19 degraded, and four accounts for full coverage. **DefiLlama does not appear in it at all, and
it never could have:**

1. **It scores only vendors that could fix a degraded surface.** A keyless vendor carrying a surface
   the audit found healthy, DefiLlama under the charts, is never considered.
2. **It works per surface, not per range.** The `ohlcv` entry lists CoinGecko too, so no single vendor
   is ever its only candidate, even for ranges past 365 days that CoinGecko refuses.

So the matrix showed nothing about DefiLlama before the backup and shows nothing now. CLAUDE.md
calls its "Strands if dropped" column the measure D21 asks to drive to zero. What it measures is
narrower: which keyed vendor's loss would leave a degraded surface with no fix. It does not measure
which vendor's loss would empty a working surface, the case T-434 was filed for.

## What this does and does not license

- **Does:** treat T-434's four steps as done. The backup is confirmed with fresh calls, credited and
  current, for 69 of 80 coins, and the audit has no failure.
- **Needs the owner:**
  - close T-434 with eleven coins uncovered past 365 days, or keep it open for a third source (the
    survey's question 5);
  - whether to file the matrix's blind spot as an item: widen it to keyless vendors and ranges, or
    narrow what CLAUDE.md claims it measures.
- **Does not:** clear the staking fallback refresh. Injective still answers 502, and the refresh's
  clock fires on 2026-10-22.
