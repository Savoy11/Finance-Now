# Fund catalog facts against the SEC's own data — 2026-10-14 (T-386)

**What this is.** T-386 holds `FUND_DATA_LAST_VERIFIED` at 2026-07-20 until the whole catalog has
been re-checked. Its expense-ratio half was done in September (T-414, T-412, T-417). This is the
first check of the other half: each row's assets (`aumB`), launch year (`inceptionYear`) and yield
(`yieldPct`), against the SEC's data wherever the SEC holds the figure.

It **reports and changes nothing.** `fundCatalog.ts`, its stamp and the app are untouched; what to
apply is for the owner (below). It ran on the owner's machine, egress checked first: no proxy flag,
no hosting flag.

## Sources

| Field | Source | What it gives |
|---|---|---|
| Assets, '40-Act funds | N-PORT data set **2026q3** (published 2026-10-07) | `NET_ASSETS` per fund series. Each filing's period comes from `SUBMISSION.REPORT_DATE`: the periods end 2026-05-31, 2026-06-30 or 2026-07-31 |
| Assets, the trusts that file no N-PORT | Each registrant's own XBRL (data.sec.gov companyfacts), newest fact | See the concept table below |
| Launch year | Risk/Return Summary data sets **2025q3–2026q2** | `PerfInceptionDate` per share class |
| Yield | none | No SEC data set carries a fund's yield |

Tickers were matched to SEC series and classes through the SEC's own `company_tickers_mf.json`,
never by name, with one exception named below (HACK). Share classes per series were counted from
N-PORT's `MONTHLY_TOTAL_RETURN` table: each N-PORT filing covers one series, and lists a return for
each of its classes.

Trusts tag their net assets under different names, so the newest fact among these concepts was
taken, the order breaking ties only. Newest wins because some trusts still carry a concept they
stopped using: IAU's `StockholdersEquity` ends in 2015.

| Concept | Used by |
|---|---|
| `us-gaap:AssetsNet` | most grantor trusts (GLD, the abrdn trusts, GLDM, AAAU, BAR, OUNZ) |
| `us-gaap:PartnersCapital` | the USCF limited partnerships (USO, USL, BNO, UNG, UNL, UGA) |
| `us-gaap:StockholdersEquity` | the Invesco DB funds (DBC, UUP, UDN) |
| `us-gaap:RedeemableNoncontrollingInterestEquityCarryingAmount` | the CurrencyShares trusts |
| `ifrs-full:Equity` | PSLV, a Canadian trust filing a 40-F |
| `us-gaap:FairValueNetAssetLiability` | IAU, SLV, IBIT, ETHA: **the fair value of the metal or coin held**, which approximates net assets and is not them |

## What N-PORT can confirm, and what it cannot

N-PORT reports a fund **series**: every share class together. The catalog's `aumB` is the share
class (the 2026-09-26 note in `fundCatalog.ts`). So N-PORT confirms a row only where its series has
one class. Where it has more, the row is reported and not compared: VTIP's series reads $71.0B,
the figure that note gives for the whole fund, against the catalog's $19B for the ETF class.

## Results

### Assets: 101 of 140 rows checked

| Catalog against the SEC figure | Rows |
|---|---:|
| within 15% | 35 |
| 15% to 67% apart | 41 |
| more than 1.67× apart | 25 |

Of the 66 rows more than 15% apart, **52 are lower than the SEC figure and 14 higher.** The catalog's
values date from early 2026 and carry no date of their own; the SEC's are dated to the month. This
note does not try to say which gaps are markets and fund flows since then and which were wrong when
written: for the catalog's purpose it does not matter, since only one of the two figures can say
when it was true.

The largest gaps, catalog ÷ SEC: PALL 0.17, PSLV 0.27, BNO 0.28, SOXX 0.29 ($14B listed, $47.8B
filed), OUNZ 0.32, FXF 0.35, IYT 0.36, GLDM 0.37, SIVR 0.38, SMH 0.39. The higher ones are led by
USL 2.46, ETHA 2.33, IBIT 1.84 ($80B listed, $43.4B of bitcoin held at 2026-06-30) and IHI 1.65.

**The method agrees with the rows read most recently.** Of the fourteen added on 2026-09-26 (D27),
whose assets were read from issuer pages on 2026-09-24 and 25, eight have a single class: seven are
within 15% of N-PORT, and BKLN is 16% under it. Six are Vanguard share classes, not compared.

### Not checked: 39 rows

| Rows | Why | What would check them |
|---|---|---|
| 21 Vanguard ETFs | Each is a share class of a larger fund; N-PORT gives only the whole fund | Vanguard's fact sheets, as D27 did |
| 11 mutual funds | Every one has several share classes | First a decision on what `aumB` means for a mutual fund (below) |
| SPY, DIA | Unit investment trusts: no N-PORT and no tagged financial data | State Street's product pages |
| CORN, WEAT, SOYB, CANE | One registrant, the Teucrium Commodity Trust, tags only the whole trust ($0.73B at 2026-03-31) | The four fact sheets, which T-416 already reads for their fees |
| CPER | Its trust's newest tagged figure is from 2012; it now tags per fund | USCF's product page |

**What `aumB` means for a mutual fund is unsettled, and the figures show it.** VOO and VFIAX are two
classes of one series, the Vanguard 500 Index Fund, which filed $1,671B. The catalog lists VOO at
$720B and VFIAX at $1,300B: $2,020B between them, more than the whole fund, so at least one of the
two is not a share-class figure. VTSAX ($1,500B) and VTI ($520B) share a $2,298B fund.

### Launch year: 39 checked, one wrong

**OILK is listed as launched in 2019; its prospectus tags 2016-09-26**
(0001174610-26-000065, read from the 2026q2 data set). The other 38 tagged classes agree on the year.

101 rows are not checked by this pass: 64 '40-Act rows carry no tag, and the 37 trusts file no
Risk/Return data at all. Whether a filing tags the date varies by issuer and by fund, not by age
alone: every iShares '40-Act row is tagged, from 1996 to 2020, and so are PRGFX (1950) and AGTHX (1973);
of the ten Select Sector SPDRs only the youngest, XLC (2018), is, and of the Vanguard rows only
VYMI (2016).

### Yield: not checkable from SEC data

87 rows carry a yield and 53 carry none (shown as a dash). No SEC data set holds a fund's yield, so
this pass checked none. The fourteen rows added on 2026-09-26 had theirs read on 2026-09-25; the rest
date from the July compile. A trailing yield moves with every distribution and every price.

## What this settles, and what it does not

- **Settled:** a dated primary-source asset figure for 101 rows, 66 of which differ from the catalog
  by more than 15%; and one wrong launch year.
- **Not settled:** the assets of 39 rows, the launch year of 101, and every yield.
- **The stamp does not move.** Its window closes on 2026-11-18.

## For the owner

1. **The 101 checked asset figures:** apply them, each with its period end recorded in the catalog's
   banner (the table has one stamp and no per-row date), and the four fair-value rows labelled as
   such? Or leave them?
2. **What `aumB` means for a mutual fund:** the whole fund, which N-PORT gives, or the share class,
   which only the issuer publishes. VOO and VFIAX cannot both be right as they stand.
3. **The 28 rows only a person can read** (21 Vanguard ETF classes, SPY, DIA, the four Teucrium
   funds, CPER): a hand pass from issuer pages, as D27 did.
4. **OILK:** correct 2019 to 2016.
5. **Yields:** a hand pass over 87 rows, or let the notice fire and record a `STALENESS-ACK` saying
   why. Assets and yields change every day, so a "verified" stamp on them goes stale almost at once;
   a launch year never changes. That difference may be worth more than either pass.
6. **Whether to make this check repeatable.** It ran from one-off scripts kept outside the repository,
   and the same clock comes round every 120 days. A report-only `npm run` script, like `fund-fees`,
   would make the next check a single command.

Not touched, and why: `fundFacts.generated.json` records the month its script ran as `asOf` rather
than the period its data covers. Nothing in the app reads the file (T-392, closed under D88), so the
date harms nothing.

## Per-row tables

Generated from the comparison's output, worst first. "Catalog ÷ SEC" below 1 means the catalog
lists less than the filing.

| Fund | Catalog ($B) | SEC ($B) | Catalog ÷ SEC | As of | Source |
|---|---:|---:|---:|---|---|
| PALL | 0.1 | 0.59 | 0.17 | 2026-06-30 | 10-Q (XBRL) 0001999371-26-017413 |
| PSLV | 4 | 15.1 | 0.27 | 2025-12-31 | 40-F (XBRL) 0001999371-26-005829 |
| BNO | 0.15 | 0.54 | 0.28 | 2026-06-30 | 10-Q (XBRL) 0001104659-26-092631 |
| SOXX | 14 | 47.8 | 0.29 | 2026-06-30 | N-PORT 0002071691-26-019781 |
| OUNZ | 0.8 | 2.54 | 0.32 | 2026-07-31 | 10-Q (XBRL) 0001213900-26-097973 |
| FXF | 0.15 | 0.43 | 0.35 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338693 |
| IYT | 0.8 | 2.23 | 0.36 | 2026-07-31 | N-PORT 0001004726-26-008794 |
| GLDM | 10 | 27.3 | 0.37 | 2026-06-30 | 10-Q (XBRL) 0001437749-26-025679 |
| SIVR | 1.5 | 3.95 | 0.38 | 2026-06-30 | 10-Q (XBRL) 0001999371-26-017415 |
| SMH | 30 | 77.2 | 0.39 | 2026-06-30 | N-PORT 0001410368-26-086937 |
| USDU | 0.15 | 0.38 | 0.39 | 2026-05-31 | N-PORT 0000940400-26-028865 |
| USL | 0.1 | 0.04 | 2.46 | 2026-06-30 | 10-Q (XBRL) 0001104659-26-092628 |
| ITA | 6 | 14.4 | 0.41 | 2026-06-30 | N-PORT 0001004726-26-007012 |
| ETHA | 10 | 4.29 | 2.33 | 2026-06-30 | 10-Q (XBRL) 0001437749-26-026000 (holdings at fair value) |
| TAN | 1 | 2.29 | 0.44 | 2026-05-31 | N-PORT 0001378872-26-001381 |
| XBI | 5 | 10.7 | 0.47 | 2026-06-30 | N-PORT 0001410368-26-089400 |
| UDN | 0.05 | 0.11 | 0.47 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338698 |
| SGOV | 45 | 91.9 | 0.49 | 2026-05-31 | N-PORT 0002071691-26-016719 |
| FXE | 0.2 | 0.38 | 0.53 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338695 |
| IBIT | 80 | 43.4 | 1.84 | 2026-06-30 | 10-Q (XBRL) 0001437749-26-026004 (holdings at fair value) |
| OILK | 0.15 | 0.28 | 0.54 | 2026-05-31 | N-PORT 0002071691-26-017349 |
| URA | 3 | 5.44 | 0.55 | 2026-07-31 | N-PORT 0002048251-26-008623 |
| XLI | 20 | 34.0 | 0.59 | 2026-06-30 | N-PORT 0001410368-26-089138 |
| PAVE | 8 | 13.5 | 0.59 | 2026-05-31 | N-PORT 0002048251-26-006454 |
| SGOL | 4 | 6.74 | 0.59 | 2026-06-30 | 10-Q (XBRL) 0001999371-26-017412 |
| IHI | 5 | 3.02 | 1.65 | 2026-06-30 | N-PORT 0001004726-26-007024 |
| SOXL | 12 | 19.4 | 0.62 | 2026-07-31 | N-PORT 0001193125-26-404435 |
| PPLT | 1.1 | 1.77 | 0.62 | 2026-06-30 | 10-Q (XBRL) 0001999371-26-017414 |
| IEF | 30 | 48.3 | 0.62 | 2026-05-31 | N-PORT 0002071691-26-016715 |
| XLK | 80 | 124 | 0.65 | 2026-06-30 | N-PORT 0001410368-26-089672 |
| ICLN | 1.5 | 2.31 | 0.65 | 2026-07-31 | N-PORT 0001004726-26-008852 |
| TQQQ | 26 | 39.8 | 0.65 | 2026-05-31 | N-PORT 0002071691-26-017348 |
| SH | 1.5 | 0.98 | 1.53 | 2026-05-31 | N-PORT 0002071691-26-017456 |
| GDX | 15 | 22.8 | 0.66 | 2026-06-30 | N-PORT 0001410368-26-086986 |
| LIT | 1 | 1.51 | 0.66 | 2026-07-31 | N-PORT 0002048251-26-008611 |
| IGV | 9 | 13.5 | 0.67 | 2026-06-30 | N-PORT 0002071691-26-019778 |
| HACK | 1.8 | 2.59 | 0.69 | 2026-06-30 | N-PORT (series matched by name) 0001193125-26-372674, series S000082278 |
| FXY | 0.3 | 0.43 | 0.70 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338718 |
| PDBC | 4.5 | 6.39 | 0.70 | 2026-07-31 | N-PORT 0001595386-26-000077 |
| SLV | 20 | 28.2 | 0.71 | 2026-06-30 | 10-Q (XBRL) 0001437749-26-026005 (holdings at fair value) |
| IAGG | 8 | 11.2 | 0.71 | 2026-07-31 | N-PORT 0001410368-26-099845 |
| IBB | 6.5 | 9.09 | 0.71 | 2026-06-30 | N-PORT 0002071691-26-019768 |
| IVV | 640 | 888 | 0.72 | 2026-06-30 | N-PORT 0002071691-26-019760 |
| FXAIX | 600 | 832 | 0.72 | 2026-05-31 | N-PORT 0000035402-26-004626 |
| SCHD | 70 | 94.9 | 0.74 | 2026-05-31 | N-PORT 0001410368-26-075040 |
| JEPQ | 30 | 40.7 | 0.74 | 2026-06-30 | N-PORT 0002071691-26-021122 |
| KRE | 3.5 | 4.74 | 0.74 | 2026-06-30 | N-PORT 0001410368-26-089196 |
| KBE | 2 | 1.48 | 1.35 | 2026-06-30 | N-PORT 0001410368-26-089445 |
| BIL | 35 | 47.1 | 0.74 | 2026-06-30 | N-PORT 0001410368-26-089537 |
| SQQQ | 3 | 2.23 | 1.34 | 2026-05-31 | N-PORT 0002071691-26-017363 |
| OIH | 1.5 | 1.99 | 0.75 | 2026-06-30 | N-PORT 0001410368-26-086988 |
| FXC | 0.1 | 0.08 | 1.32 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338711 |
| FXB | 0.1 | 0.08 | 1.30 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338691 |
| EFA | 60 | 78.0 | 0.77 | 2026-07-31 | N-PORT 0001004726-26-008797 |
| QQQ | 380 | 490 | 0.78 | 2026-06-30 | N-PORT 0001067839-26-000030 |
| RSP | 75 | 96.5 | 0.78 | 2026-07-31 | N-PORT 0001209466-26-001445 |
| TFI | 4 | 3.12 | 1.28 | 2026-06-30 | N-PORT 0001410368-26-089234 |
| XRT | 0.3 | 0.38 | 0.79 | 2026-06-30 | N-PORT 0001410368-26-089535 |
| ARKK | 7 | 5.56 | 1.26 | 2026-07-31 | N-PORT 0000940400-26-037955 |
| IEI | 15 | 18.5 | 0.81 | 2026-05-31 | N-PORT 0002071691-26-016711 |
| IAU | 50 | 60.1 | 0.83 | 2026-06-30 | 10-Q (XBRL) 0001437749-26-026002 (holdings at fair value) |
| UNG | 0.5 | 0.42 | 1.20 | 2026-06-30 | 10-Q (XBRL) 0001104659-26-092626 |
| BKLN | 6 | 7.16 | 0.84 | 2026-05-31 | N-PORT 0001378872-26-001409 |
| MUB | 38 | 45.0 | 0.84 | 2026-05-31 | N-PORT 0002071691-26-016725 |
| XOP | 2.5 | 2.92 | 0.86 | 2026-06-30 | N-PORT 0001410368-26-089276 |
| TLT | 50 | 42.9 | 1.17 | 2026-05-31 | N-PORT 0002071691-26-016714 |
| XLU | 20 | 23.1 | 0.86 | 2026-06-30 | N-PORT 0001410368-26-089590 |
| UNL | 0.02 | 0.02 | 1.15 | 2026-06-30 | 10-Q (XBRL) 0001104659-26-092634 |
| AGG | 120 | 136 | 0.88 | 2026-05-31 | N-PORT 0001410368-26-075254 |
| IAI | 1.5 | 1.33 | 1.13 | 2026-06-30 | N-PORT 0001004726-26-007034 |
| UUP | 0.5 | 0.45 | 1.12 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338699 |
| JEPI | 40 | 44.7 | 0.89 | 2026-06-30 | N-PORT 0002071691-26-021114 |
| BWX | 1.5 | 1.35 | 1.11 | 2026-06-30 | N-PORT 0001410368-26-089157 |
| BAR | 1.2 | 1.33 | 0.90 | 2026-06-30 | 10-K (XBRL) 0001493152-26-037707 |
| UPRO | 5 | 5.54 | 0.90 | 2026-05-31 | N-PORT 0002071691-26-017443 |
| IWM | 75 | 83.0 | 0.90 | 2026-06-30 | N-PORT 0002071691-26-019749 |
| SKYY | 3 | 2.72 | 1.10 | 2026-06-30 | N-PORT 0000940400-26-032772 |
| GLD | 120 | 130 | 0.92 | 2026-06-30 | 10-Q (XBRL) 0001437749-26-025680 |
| EWJ | 23 | 21.3 | 1.08 | 2026-05-31 | N-PORT 0001004726-26-006437 |
| UGA | 0.1 | 0.11 | 0.93 | 2026-06-30 | 10-Q (XBRL) 0001104659-26-092629 |
| HYG | 15 | 16.1 | 0.93 | 2026-05-31 | N-PORT 0001410368-26-075250 |
| HEFA | 8 | 7.53 | 1.06 | 2026-07-31 | N-PORT 0001004726-26-008800 |
| DBC | 1.5 | 1.58 | 0.95 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338697 |
| JETS | 1 | 0.96 | 1.04 | 2026-06-30 | N-PORT 0001193125-26-370745 |
| ITB | 2.5 | 2.60 | 0.96 | 2026-06-30 | N-PORT 0001004726-26-007002 |
| XLC | 23 | 22.3 | 1.03 | 2026-06-30 | N-PORT 0001410368-26-089424 |
| EMB | 15 | 14.6 | 1.03 | 2026-07-31 | N-PORT 0001410368-26-099861 |
| TIP | 15 | 14.6 | 1.03 | 2026-07-31 | N-PORT 0002071691-26-023019 |
| XLF | 50 | 51.4 | 0.97 | 2026-06-30 | N-PORT 0001410368-26-089671 |
| XLY | 22 | 22.6 | 0.97 | 2026-06-30 | N-PORT 0001410368-26-089594 |
| XLP | 14 | 13.6 | 1.03 | 2026-06-30 | N-PORT 0001410368-26-089214 |
| EMLC | 5 | 4.87 | 1.03 | 2026-06-30 | N-PORT 0001410368-26-086966 |
| USO | 1.8 | 1.75 | 1.03 | 2026-06-30 | 10-Q (XBRL) 0001104659-26-092623 |
| XLE | 35 | 35.7 | 0.98 | 2026-06-30 | N-PORT 0001410368-26-089509 |
| XLB | 8 | 8.17 | 0.98 | 2026-06-30 | N-PORT 0001410368-26-089261 |
| SHY | 25 | 25.4 | 0.98 | 2026-05-31 | N-PORT 0002071691-26-016710 |
| XLV | 40 | 40.6 | 0.98 | 2026-06-30 | N-PORT 0001410368-26-089348 |
| QYLD | 8 | 8.09 | 0.99 | 2026-07-31 | N-PORT 0002048251-26-008640 |
| LQD | 30 | 29.8 | 1.01 | 2026-05-31 | N-PORT 0001410368-26-075235 |
| FXA | 0.1 | 0.10 | 1.00 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-338710 |
| AAAU | 2.4 | 2.40 | 1.00 | 2026-06-30 | 10-Q (XBRL) 0001193125-26-340527 |

| Fund | Why not checked |
|---|---|
| SPY | a unit investment trust: no N-PORT and no tagged financial data |
| VOO | N-PORT reports the whole fund across 4 share classes (1671.23B, 2026-06-30); the catalog row is one class |
| VTI | N-PORT reports the whole fund across 6 share classes (2297.84B, 2026-06-30); the catalog row is one class |
| DIA | a unit investment trust: no N-PORT and no tagged financial data |
| VUG | N-PORT reports the whole fund across 4 share classes (379.29B, 2026-06-30); the catalog row is one class |
| VTV | N-PORT reports the whole fund across 4 share classes (254.48B, 2026-06-30); the catalog row is one class |
| VYM | N-PORT reports the whole fund across 2 share classes (99.19B, 2026-07-31); the catalog row is one class |
| VIG | N-PORT reports the whole fund across 2 share classes (130.90B, 2026-07-31); the catalog row is one class |
| VT | N-PORT reports the whole fund across 3 share classes (97.89B, 2026-07-31); the catalog row is one class |
| VXUS | N-PORT reports the whole fund across 6 share classes (645.86B, 2026-07-31); the catalog row is one class |
| VEA | N-PORT reports the whole fund across 5 share classes (316.42B, 2026-06-30); the catalog row is one class |
| VWO | N-PORT reports the whole fund across 5 share classes (162.04B, 2026-07-31); the catalog row is one class |
| VSS | N-PORT reports the whole fund across 3 share classes (13.55B, 2026-07-31); the catalog row is one class |
| VGK | N-PORT reports the whole fund across 5 share classes (38.51B, 2026-07-31); the catalog row is one class |
| VYMI | N-PORT reports the whole fund across 2 share classes (21.87B, 2026-07-31); the catalog row is one class |
| VNQ | N-PORT reports the whole fund across 4 share classes (73.11B, 2026-07-31); the catalog row is one class |
| BND | N-PORT reports the whole fund across 6 share classes (397.11B, 2026-06-30); the catalog row is one class |
| BNDX | N-PORT reports the whole fund across 4 share classes (122.53B, 2026-07-31); the catalog row is one class |
| VWOB | N-PORT reports the whole fund across 3 share classes (6.68B, 2026-07-31); the catalog row is one class |
| VTEB | N-PORT reports the whole fund across 2 share classes (48.52B, 2026-07-31); the catalog row is one class |
| VCSH | N-PORT reports the whole fund across 3 share classes (50.23B, 2026-05-31); the catalog row is one class |
| VMBS | N-PORT reports the whole fund across 3 share classes (17.05B, 2026-05-31); the catalog row is one class |
| VTIP | N-PORT reports the whole fund across 4 share classes (71.01B, 2026-06-30); the catalog row is one class |
| CPER | newest tagged figure is from 2012-03-31; the registrant now tags it per fund |
| CORN | Teucrium Commodity Trust files several funds under one registrant; the tagged figure (0.73B, 2026-03-31) is the whole trust |
| WEAT | Teucrium Commodity Trust files several funds under one registrant; the tagged figure (0.73B, 2026-03-31) is the whole trust |
| SOYB | Teucrium Commodity Trust files several funds under one registrant; the tagged figure (0.73B, 2026-03-31) is the whole trust |
| CANE | Teucrium Commodity Trust files several funds under one registrant; the tagged figure (0.73B, 2026-03-31) is the whole trust |
| VTSAX | N-PORT reports the whole fund across 6 share classes (2297.84B, 2026-06-30); the catalog row is one class |
| VFIAX | N-PORT reports the whole fund across 4 share classes (1671.23B, 2026-06-30); the catalog row is one class |
| VTIAX | N-PORT reports the whole fund across 6 share classes (645.86B, 2026-07-31); the catalog row is one class |
| VBTLX | N-PORT reports the whole fund across 6 share classes (397.11B, 2026-06-30); the catalog row is one class |
| VWELX | N-PORT reports the whole fund across 2 share classes (124.71B, 2026-05-31); the catalog row is one class |
| VWINX | N-PORT reports the whole fund across 2 share classes (47.53B, 2026-06-30); the catalog row is one class |
| FCNTX | N-PORT reports the whole fund across 2 share classes (179.96B, 2026-06-30); the catalog row is one class |
| PRGFX | N-PORT reports the whole fund across 5 share classes (50.14B, 2026-06-30); the catalog row is one class |
| AGTHX | N-PORT reports the whole fund across 21 share classes (360.91B, 2026-05-31); the catalog row is one class |
| DODGX | N-PORT reports the whole fund across 2 share classes (118.35B, 2026-06-30); the catalog row is one class |
| PIMIX | N-PORT reports the whole fund across 7 share classes (230.68B, 2026-06-30); the catalog row is one class |

| Fund | Catalog | Prospectus inception | Filing |
|---|---:|---|---|
| OILK | 2019 | 2016-09-26 **differs** | 0001174610-26-000065 |
| AGG | 2003 | 2003-09-22 | 0001193125-26-275730 |
| AGTHX | 1973 | 1973-12-01 | 0000051931-25-001201 |
| BKLN | 2011 | 2011-03-03 | 0001104659-25-122454 |
| EFA | 2001 | 2001-08-14 | 0001193125-25-291438 |
| EMB | 2007 | 2007-12-17 | 0001193125-26-064179 |
| EWJ | 1996 | 1996-03-12 | 0001193125-25-327007 |
| HEFA | 2014 | 2014-01-31 | 0001193125-25-291438 |
| HYG | 2007 | 2007-04-04 | 0001193125-26-275730 |
| IAGG | 2015 | 2015-11-10 | 0001193125-26-064179 |
| IAI | 2006 | 2006-05-01 | 0001193125-25-162603 |
| IBB | 2001 | 2001-02-05 | 0001193125-25-162603 |
| ICLN | 2008 | 2008-06-24 | 0001193125-25-187621 |
| IEF | 2002 | 2002-07-22 | 0001193125-26-275730 |
| IEI | 2007 | 2007-01-05 | 0001193125-26-275730 |
| IGV | 2001 | 2001-07-10 | 0001193125-25-162603 |
| IHI | 2006 | 2006-05-01 | 0001193125-25-162603 |
| ITA | 2006 | 2006-05-01 | 0001193125-25-162603 |
| ITB | 2006 | 2006-05-01 | 0001193125-25-162603 |
| IVV | 2000 | 2000-05-15 | 0001193125-25-162603 |
| IWM | 2000 | 2000-05-22 | 0001193125-25-162603 |
| IYT | 2003 | 2003-10-06 | 0001193125-25-187621 |
| JEPI | 2020 | 2020-05-20 | 0001193125-25-246367 |
| JEPQ | 2022 | 2022-05-03 | 0001193125-25-246367 |
| LQD | 2002 | 2002-07-22 | 0001193125-26-275730 |
| MUB | 2007 | 2007-09-07 | 0001193125-26-275730 |
| PAVE | 2017 | 2017-03-06 | 0001432353-26-000311 |
| PDBC | 2014 | 2014-11-07 | 0001104659-26-020374 |
| PRGFX | 1950 | 1950-04-11 | 0001999371-26-004113 |
| RSP | 2003 | 2003-04-24 | 0001104659-25-084008 |
| SGOV | 2020 | 2020-05-26 | 0001193125-26-275730 |
| SHY | 2002 | 2002-07-22 | 0001193125-26-275730 |
| SKYY | 2011 | 2011-07-05 | 0001445546-26-000657 |
| SOXX | 2001 | 2001-07-10 | 0001193125-25-162603 |
| TAN | 2008 | 2008-04-15 | 0001104659-25-122454 |
| TIP | 2003 | 2003-12-04 | 0001193125-26-064179 |
| TLT | 2002 | 2002-07-22 | 0001193125-26-275730 |
| VYMI | 2016 | 2016-02-25 | 0001193125-26-077482 |
| XLC | 2018 | 2018-06-18 | 0001193125-26-027312 |
