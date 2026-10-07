# Tokenized securities in the coin lists — probe, 2026-10-07

The owner-machine verification that `docs/assessments/tokenized-securities-2026-09-21.md` §10 asked
for, run before building TS-3. Recorded here rather than in the assessment, as §10 says.

**Where it ran.** The owner's Windows machine, from PowerShell. Egress checked first, per CLAUDE.md:
Spectrum, AS11426 (Charter), `proxy: false`, `hosting: false`, so a residential baseline. All calls
were keyless CoinGecko (`api.coingecko.com/api/v3`), spaced about 13 seconds apart.

## 1. The categories exist, under the ids §5 assumed

`/coins/categories/list` returned 1,042 categories. `tokenized-stock` ("Tokenized Stocks") and
`tokenized-products` ("Tokenized Assets") exist as §5 assumed. CoinGecko also has narrower ones:

| Kind | Category ids |
|---|---|
| Securities | `tokenized-stock`, `tokenized-exchange-traded-funds-etfs`, `tokenized-treasuries`, `tokenized-t-bills`, `tokenized-treasury-bonds-t-bonds`, `tokenized-money-market-fund-mmfs`, `tokenized-closed-end-funds-cefs`, `tokenized-credit`, `tokenized-private-credit`, `tokenized-pre-ipo-stocks`, `tokenized-non-us-government-securities` |
| Not securities | `tokenized-gold`, `tokenized-silver`, `tokenized-commodities`, `tokenized-btc`, `tokenized-bank-deposit` |
| Issuer groupings | `xstocks-ecosystem`, `bstocks-ecosystem`, `ondo-tokenized-assets`, `robinhood-chain-stocks-ecosystem`, and others |
| Broad parent | `tokenized-products`: holds most of the above, tokenized gold and silver included |

## 2. Tokenized securities sit inside both universes today

Per category, the top 250 by market cap, counted against overall market-cap rank:

| Category | Tokens | Ranked ≤ 750 | Ranked ≤ 250 |
|---|---:|---:|---:|
| `tokenized-stock` | 250+ | 23 | 2 |
| `tokenized-exchange-traded-funds-etfs` | 250+ | 6 | 0 |
| `tokenized-treasuries` | 15 | 11 | 8 |
| `tokenized-money-market-fund-mmfs` | 9 | 5 | 3 |
| `tokenized-credit` | 22 | 12 | 2 |
| `tokenized-private-credit` | 1 | 1 | 1 |
| `tokenized-pre-ipo-stocks` | 13 | 1 | 0 |
| `tokenized-t-bills`, `tokenized-treasury-bonds-t-bonds` | 0 | 0 | 0 |
| `tokenized-closed-end-funds-cefs` | 1 | 0 | 0 |
| `tokenized-non-us-government-securities` | 5 | 0 | 0 |
| `tokenized-products` (broad parent) | 250+ | 72 | 22 |

The highest: Figure's HELOC token at rank **9** (private credit), Hashnote/Circle USYC at 46, USDY at
48, BlackRock's BUIDL at 50, Superstate/Invesco USTB at 88. The first tokenized stock was Strategy's
STRCX xStock at 217.

**What this means for the app.**
- **Coin Discovery** lists CoinGecko's top 250 by default (750 at most) and was listing these as
  candidate coins. That is the F3 finding, and it was live.
- **The crypto scanner does not sweep CoinGecko's top 750.** Its universe is the app's own catalog
  (`COINGECKO_IDS`, 80 coins), and `coin-list` only supplies names and ranks. The one tokenized
  security in it is USDY, already filed as `assetType: 'tokenized'` (TS-1). The assessment's TS-3 row
  assumed otherwise.

**Gaps in CoinGecko's own tagging**, seen in the broad parent's top 250 and in no security category:
the Spiko SAFO overnight-swap funds (EURSAFO #62, SAFO #181) and Blockchain Capital's BCAP (#80).
Real-estate platform tokens (Reental, Propy) and USAT also sit only in the broad parent.

## 3. USDY accrues, as the assessment expected

`/simple/price?ids=ondo-us-dollar-yield` returned **$1.15**: above $1.00, the yield accrued into the
price. Not a depeg (TS-1's reading, confirmed).

## What was built on this (TS-3)

`frontend/src/lib/server/tokenizedSecurities.ts` reads the seven security categories that had
members inside 750 (stocks, ETFs, Treasuries, money-market funds, credit, private credit, pre-IPO),
cached for a day. Coin Discovery leaves their members out and says so on the page, with the list. If
the categories cannot be read it says the check did not run, and leaves nothing out. The crypto
scanner labels catalog entries filed as tokenized ("Tokenized security"). The broad parent and the
metal, commodity, BTC, bank-deposit and real-estate categories are left out of the list on purpose,
and a test holds that. The SAFO and BCAP gaps are CoinGecko's tagging, stated in the module rather
than patched with a hand-kept list.
