import type Anthropic from '@anthropic-ai/sdk'
import { EQUITY_CATALOG, SECTOR_INFO } from '@/lib/data/equityCatalog'
import { peText, perShareFromFields, stockFigures, stockFiguresLink, yieldText } from '@/lib/data/stockPerShare'
import { marketCapText, marketCapUsd } from '@/lib/data/stockShares'
import type { StockUniverseResponse } from '@/app/live-data/stock-universe/route'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'
import { FUND_CATALOG, FUND_CATEGORY_INFO, fundAssetsFact, fundSalesCharge, fundYieldFact, getFund, getFundFeeProvenance } from '@/lib/data/fundCatalog'
import type { FundHoldingsResponse } from '@/app/live-data/fund-holdings/route'
import type { FundExposure } from '@/lib/utils/fundExposure'
import type { FundProspectusResponse } from '@/app/live-data/fund-prospectus/route'
import type { FundReturnsResponse } from '@/app/live-data/fund-returns/route'
import type { Quarter as CompanyQuarter } from '@/lib/utils/companyQuarters'
import type { LiveReserveAsset } from '@/app/live-data/reserves/route'
import { COMMODITY_CATALOG, COMMODITY_CATEGORY_INFO } from '@/lib/data/commodityCatalog'
import { CURRENCY_CATALOG, CURRENCY_CATEGORY_INFO } from '@/lib/data/currencyCatalog'
import { RATES_CATALOG, RATES_CATEGORY_INFO } from '@/lib/data/ratesCatalog'
import { parLabelFor } from '@/lib/data/yieldHistory'
import { ECB_RATE_NOTE, ecbPairBySymbol, pairRateBasis } from '@/lib/data/fxReference'
import { FOMC_SOURCE_URL, getFomcCalendarProvenance } from '@/lib/data/fomcCalendar'
import { RELEASE_AGENCIES, getReleaseDatesProvenance } from '@/lib/data/releaseCalendar'
import { macroCalendarAhead } from '@/lib/data/macroCalendar'
import { ohlcvSourceLabel } from '@/lib/utils/ohlcvSource'
import { candleGranularity, candleSizeWords } from '@/lib/utils/candleGranularity'
import { RISK_RATINGS_SHOWN } from '@/lib/risk/visibility'
import { parseCredits, requiredAttributions, sourceForRoute, type RequiredCredit } from '@/lib/data/dataSources'
import { selfRequestHeaders } from '@/lib/server/apiKeys'

// ─── Agent tool registry ──────────────────────────────────────────────────────
//
// Tools expose the platform's own live data to the App Assistant and Research
// agents. Each tool maps to an existing internal endpoint (/api/v1/* or
// /live-data/*), so the agents read exactly what the UI reads — one source of
// truth. The executor fetches against the app's own origin (passed in from the
// route handler), avoiding any external hop or duplicated data logic.

/**
 * What the highest and lowest figures of a daily-history summary are of. Over a long range the
 * routes send each week's last reading, so a day's peak between them is not seen; an agent
 * quoting the "high" must say so (audit 2026-11-07, finding 4).
 */
export function extremesNote(interval: string | undefined): string {
  return interval === 'weekly'
    ? " Over this range the readings are each week's last, so the highest and lowest are of those weekly readings, not of every day."
    : ''
}

export type ToolMarket = 'crypto' | 'equities' | 'macro'
/** Which tool set an agent may call. 'all' exposes every market (App Assistant). */
export type ToolSet = 'crypto' | 'equities' | 'macro' | 'all'

interface RegisteredTool {
  market: ToolMarket
  tool: Anthropic.Tool
}

const TOOL_REGISTRY: RegisteredTool[] = [
  // ── Crypto ──────────────────────────────────────────────────────────────────
  {
    market: 'crypto',
    tool: {
      name: 'get_prices',
      description: 'Get current USD prices for one or more coins. Use whenever the user asks about the price of a specific coin.',
      input_schema: {
        type: 'object',
        properties: {
          coins: { type: 'array', items: { type: 'string' }, description: 'Coin symbols, e.g. ["btc","eth","sol"]' },
        },
        required: ['coins'],
      },
    },
  },
  {
    market: 'crypto',
    tool: {
      name: 'get_market_overview',
      description: 'Get a broad crypto market snapshot: price, market cap, 24h volume, and 24h change for tracked coins. Use for "how is the crypto market doing" or ranking questions.',
      input_schema: { type: 'object', properties: {} },
    },
  },
  {
    market: 'crypto',
    tool: {
      name: 'list_exchanges',
      description: 'List supported crypto exchanges with the coins and networks each supports.',
      input_schema: {
        type: 'object',
        properties: { tier: { type: 'number', description: 'Optional: 1 for major/regulated, 2 for smaller exchanges' } },
      },
    },
  },
  {
    market: 'crypto',
    tool: {
      name: 'get_network_fees',
      description: 'Get current gas/network fees for all supported blockchains (e.g. Ethereum, Bitcoin, Solana, Polygon).',
      input_schema: { type: 'object', properties: {} },
    },
  },
  // find_transfer_routes HIDDEN 2026-08-22 (owner: Transfer Fees out of the
  // initial rollout). Commented rather than deleted so restoring is one edit.
  // The agent surface is dark for the same reason the page is: an assistant
  // quoting a 447-day-old withdrawal fee to a user is the same harm as the UI
  // showing it. See lib/modules/registry.ts for the full surface list.
  // {
  //   market: 'crypto',
  //   tool: {
  //     name: 'find_transfer_routes',
  //     description: 'Find the cheapest way to move a coin between two exchanges (or a wallet), including multi-hop routes.',
  //     input_schema: {
  //       type: 'object',
  //       properties: {
  //         from: { type: 'string', description: 'Source exchange id (e.g. "binance") or "wallet"' },
  //         to: { type: 'string', description: 'Destination exchange id or "wallet"' },
  //         coin: { type: 'string', description: 'Coin symbol, e.g. "usdt"' },
  //         amount: { type: 'number', description: 'Amount to transfer in coin units' },
  //       },
  //       required: ['from', 'to', 'coin'],
  //     },
  //   },
  // },
  {
    market: 'crypto',
    tool: {
      name: 'get_staking_opportunities',
      description: 'Get staking options for a coin with APY (live where available), lock-up terms, custody model, receipt token, TVL and audit count. There are NO risk scores, ratings or dimensions of any kind (owner decisions D14, 2026-09-14, and D26, 2026-09-25) and no risk-based filter. Report the facts; do not rate, rank or recommend providers, and do not invent a risk assessment the data does not carry.',
      input_schema: {
        type: 'object',
        properties: {
          coin: { type: 'string', description: 'Coin symbol, e.g. "eth"' },
          category: { type: 'string', enum: ['cefi', 'wallet', 'liquid'], description: 'Optional provider category' },
        },
        required: ['coin'],
      },
    },
  },
  {
    market: 'crypto',
    tool: {
      name: 'get_stablecoin_reserves',
      description: "Get the Reserve Monitor's figures for the monitored stablecoins, or one of them: price against its peg, circulating supply and its change over 1, 7 and 30 days, which blockchains it sits on, and the issuer's last attestation (who attests, when, the collateral ratio where disclosed, and the reserve mix). Price and supply are live; the attestation facts are kept by hand and dated (asOf). Report figures; do not grade a stablecoin's safety.",
      input_schema: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'Optional stablecoin ticker, e.g. "USDC". Omit for every monitored coin.' } },
      },
    },
  },
  {
    market: 'crypto',
    tool: {
      name: 'get_news',
      description: 'Get recent crypto news articles for a coin, with sentiment and source.',
      input_schema: {
        type: 'object',
        properties: {
          coin: { type: 'string', description: 'Coin symbol, e.g. "btc"' },
          limit: { type: 'number', description: 'Max articles (default 10)' },
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'], description: 'Optional sentiment filter' },
        },
        required: ['coin'],
      },
    },
  },
  {
    market: 'crypto',
    tool: {
      name: 'get_price_history',
      description: 'Get price history for a coin over a range. Returns a compact summary (first, last, high, low, change). Built from candles where the candle source serves the range. Past that (CoinGecko’s free service stops at 365 days) it is built from closing prices, one per period, and reports highestClose and lowestClose instead of periodHigh and periodLow: closing prices carry no intraday high or low.',
      input_schema: {
        type: 'object',
        properties: {
          coin: { type: 'string', description: 'Coin symbol, e.g. "btc"' },
          range: { type: 'string', enum: ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'MAX'], description: 'Time range (default 1Y)' },
        },
        required: ['coin'],
      },
    },
  },

  // ── Equities ────────────────────────────────────────────────────────────────
  {
    market: 'equities',
    tool: {
      name: 'get_stock_quote',
      description: 'Get current price, day change, market cap, and volume for one or more stock/ETF/fund symbols. Use for any equity price question.',
      input_schema: {
        type: 'object',
        properties: {
          symbols: { type: 'array', items: { type: 'string' }, description: 'Ticker symbols, e.g. ["AAPL","MSFT","BRK-B"]' },
        },
        required: ['symbols'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_financials',
      description: 'Get audited fundamentals and computed financial ratios for a stock from SEC filings: revenue, net income, margins, ROE/ROA, P/E, current ratio, debt, cash flow, and YoY growth, plus revenue, net income and earnings per share for each of the last eight quarters with the change from a year earlier. The primary tool for fundamental analysis.',
      input_schema: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'Ticker symbol, e.g. "AAPL"' } },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_profile',
      description: "Get a company's registrant profile from SEC EDGAR: official SIC industry classification, headquarters, state of incorporation, fiscal year end, exchange. Also a background summary from Wikipedia, which is not SEC data: when you use it, credit Wikipedia and give its article link (background.url), as its licence (CC BY-SA 4.0) requires.",
      input_schema: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'Ticker symbol, e.g. "AAPL"' } },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_filings',
      description: "Get a company's recent SEC filings (10-K annual, 10-Q quarterly, 8-K material events) with dates, decoded event items, and document links.",
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Ticker symbol, e.g. "AAPL"' },
          form: { type: 'string', description: 'Form filter: "8-K", "10-K", "10-Q", or "10-K,10-Q" (default "8-K")' },
          limit: { type: 'number', description: 'Max filings (default 8)' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_news',
      description: 'Get recent market news headlines for a stock, with sentiment, category, and source.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Ticker symbol, e.g. "AAPL"' },
          limit: { type: 'number', description: 'Max articles (default 10)' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_social',
      description: 'Get recent social sentiment for a stock from StockTwits, with a bullish/bearish summary. Reddit is not read while its robots.txt disallows this app; the response\'s withheld list says so.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Ticker symbol, e.g. "AAPL"' },
          limit: { type: 'number', description: 'Max posts (default 20)' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_price_history',
      description: 'Get OHLC candle history for a stock over a range. Returns a compact summary (first, last, high, low, change).',
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Ticker symbol, e.g. "AAPL"' },
          range: { type: 'string', enum: ['1M', '3M', '6M', '1Y', '5Y', 'MAX'], description: 'Time range (default 1Y)' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_stock_outliers',
      description: 'Scan the WHOLE stock universe and return the statistical outliers, computed sector-relative (z-scores vs each stock\'s sector). Returns categories: cheap (low P/E vs sector), expensive (high P/E), highYield; P/E and yield are against live prices, and a stock with no live quote is left out and counted. Use this FIRST for any "find outliers / screen the market / what stands out" request, then drill into flagged names with the other tools.',
      input_schema: {
        type: 'object',
        properties: {
          min_mcap: { type: 'number', description: 'Minimum market cap in $B to include (default 2 — filters out micro-caps)' },
        },
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_fund_details',
      description: "Get an ETF or mutual fund's details from its own filings, as its page shows them: its largest holdings and how many it holds, its stock/bond/cash mix, where it invests by country and currency and, for a bond fund, who borrowed and when the bonds are repaid, its duration where it files one (bond funds), its own monthly total returns and 12-month return and the money moving in and out of it, as it reported them to the SEC, the date of the filing, its summary prospectus link, and, for a fund in the app's catalog, its expense ratio, sales charge, net assets and yield. Use it for questions about what a fund holds or costs; search_securities only finds funds.",
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Fund ticker, e.g. "VOO" or "BND"' },
          top: { type: 'number', description: 'How many of the largest holdings to list (default 15, max 40)' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'search_securities',
      // The counts are worked out from the catalogs: this said "~70 … ~55" while they held 79 and 140 (D207).
      description: `Search the equities and funds catalogs (${EQUITY_CATALOG.length} US large-cap stocks, ${FUND_CATALOG.length} ETFs/mutual funds) by ticker, name, sector, or category. Use to find the right symbol, discover what stocks/funds the platform tracks, or get facts (sector, industry, expense ratio, top holdings, and for stocks P/E, yield and market cap against the live price).`,
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Ticker or name substring, e.g. "NVDA" or "vanguard"' },
          type: { type: 'string', enum: ['stock', 'etf', 'mutual'], description: 'Optional: restrict to stocks, ETFs, or mutual funds' },
          sector: { type: 'string', description: 'Optional stock sector filter, e.g. "technology", "healthcare", "financials"' },
        },
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_market_news',
      description: 'Get general stock-market news headlines (no specific ticker) with sentiment and category tags. Use for "what is moving the market today" questions; for per-company news use get_stock_news.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max articles (default 10, max 25)' },
        },
      },
    },
  },
  {
    market: 'equities',
    tool: {
      name: 'get_market_calendar',
      description: 'Get upcoming earnings dates and US economic events (CPI, Fed, jobs reports) for the next N days. FOMC meeting dates are always included (rows with source "federal-reserve"; "tentative" means the Fed has not yet confirmed the date); earnings and other releases need an FMP key. Use for "when does X report earnings", "when is the next Fed meeting" or "what events are coming up" questions.',
      input_schema: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Days ahead to look (default 14, max 30)' },
        },
      },
    },
  },

  {
    market: 'equities',
    tool: {
      name: 'score_options_trade',
      description:
        'Score the risk of an options position the USER describes, across liquidity, IV environment, ' +
        'assignment, time decay and defined risk. Returns a 0-100 safety score (HIGHER = SAFER) with ' +
        'per-dimension detail. Use when someone describes a specific options trade and asks how risky ' +
        'it is. IMPORTANT: this explains risk, it does NOT recommend trades or predict profit — say so. ' +
        'There is no options chain feed, so every option-level number must come from the user (their ' +
        'broker chain); never invent a bid, ask, open interest or IV rank to fill the call. Ask for what ' +
        'is missing instead. Optional fields left out lower the confidence figure rather than the score.',
      input_schema: {
        type: 'object',
        properties: {
          underlyingPrice: { type: 'number', description: 'Current price of the underlying' },
          daysToExpiry: { type: 'number', description: 'Calendar days until expiry' },
          legs: {
            type: 'array',
            description: 'The position, 1-8 legs. Every leg needs side, type, strike, bid and ask.',
            items: {
              type: 'object',
              properties: {
                side: { type: 'string', enum: ['long', 'short'] },
                type: { type: 'string', enum: ['call', 'put'] },
                strike: { type: 'number' },
                bid: { type: 'number' },
                ask: { type: 'number' },
                openInterest: { type: 'number', description: 'Optional: contracts of open interest' },
                volume: { type: 'number', description: 'Optional: contracts traded today' },
                delta: { type: 'number', description: 'Optional: signed delta per contract, e.g. -0.30 for an OTM short put' },
              },
              required: ['side', 'type', 'strike', 'bid', 'ask'],
            },
          },
          ivRank: { type: 'number', description: 'Optional 0-100: where current IV sits in its 52-week range. No free source carries this — only pass it if the user supplies it.' },
          earningsInDays: { type: 'number', description: 'Optional: days until the next earnings report, if inside the trade horizon' },
          exDividendInDays: { type: 'number', description: 'Optional: days until the ex-dividend date' },
          maxLossUsd: { description: 'Optional: worst-case loss in USD, or the string "unbounded" for naked short exposure. "unbounded" is a real answer — do not omit it to make a trade score better.' },
          maxProfitUsd: { type: 'number', description: 'Optional: best-case profit in USD' },
        },
        required: ['underlyingPrice', 'daysToExpiry', 'legs'],
      },
    },
  },

  // ── Macro (commodities, currencies, bonds/rates) ────────────────────────────
  {
    market: 'macro',
    tool: {
      name: 'search_macro_instruments',
      description: `Search the macro catalogs — ${COMMODITY_CATALOG.length} commodity futures, ${CURRENCY_CATALOG.length} FX entries (pairs plus the dollar index), and ${RATES_CATALOG.length} treasury yield indices/bond futures — ${COMMODITY_CATALOG.length + CURRENCY_CATALOG.length + RATES_CATALOG.length} instruments in total — by name, symbol, or category. Returns the market symbol (usable with get_macro_quote / get_macro_price_history), quote convention, and ETF proxies. Use FIRST to find the right symbol. NOTE: macro quote coverage depends on the API key configured — an unpriced instrument returns no quote rather than a guess, and you must say so instead of estimating.`,
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or symbol substring, e.g. "gold", "EURUSD", "10-year"' },
          area: { type: 'string', enum: ['commodities', 'currencies', 'rates'], description: 'Optional: restrict to one area' },
        },
      },
    },
  },
  {
    market: 'macro',
    tool: {
      name: 'get_macro_quote',
      description: 'Get live prices for macro symbols: commodity futures (GC=F, CL=F), FX pairs (EURUSD=X, JPY=X), the dollar index (DX-Y.NYB), and bond futures (ZN=F). Mind each market\'s quote convention from search_macro_instruments (grains quote in cents). Treasury yield indices (^IRX/^FVX/^TNX/^TYX) are NOT quoted here — no free provider carries them; use get_yield_curve, which returns the official yields in plain percent. Where this returns nothing for an FX pair, get_fx_rates returns every catalog pair at the European Central Bank\'s daily reference rate, worked out for you: quote that, saying it is the ECB\'s daily rate and giving its date, not a live quote.',
      input_schema: {
        type: 'object',
        properties: {
          symbols: { type: 'array', items: { type: 'string' }, description: 'Market symbols, e.g. ["GC=F","EURUSD=X","^TNX"]' },
        },
        required: ['symbols'],
      },
    },
  },
  {
    market: 'macro',
    tool: {
      name: 'get_macro_price_history',
      description: 'Get OHLC history summary for a macro symbol (futures contract, FX pair, or yield index) over a range: first/last, high, low, and percent change. For a Treasury yield (^IRX/^FVX/^TNX/^TYX) it reads the official daily curve instead, one figure a day: first/last, highest/lowest yield and the change in basis points, worked out for you. For an FX pair (all but the dollar index) it reads the European Central Bank\'s daily reference rates, one figure a working day: first/last, highest/lowest rate and the percent change, worked out for you.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Market symbol, e.g. "CL=F" or "EURUSD=X"' },
          range: { type: 'string', enum: ['1M', '3M', '6M', '1Y', '5Y', 'MAX'], description: 'Time range (default 1Y)' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    market: 'macro',
    tool: {
      name: 'get_yield_curve',
      description: 'Get the official US Treasury par yield curve (13 maturities, treasury.gov daily data) with 2s10s and 3m10y spreads, curve shape (normal/flat/inverted), and month-ago / year-start snapshots for comparison, each with its own spreads (monthAgoSpreads, yearStartSpreads) and each maturity\'s change since then in basis points (changeSinceMonthAgo, changeSinceYearStart): quote those to say how far a yield has moved and whether the curve has steepened or flattened, rather than working them out yourself. It also returns expectedInflation: at 5Y, 7Y, 10Y, 20Y and 30Y, the ordinary yield, the inflation-protected (real) yield and their difference, the inflation the bond market prices in, all from one day; quote it rather than subtracting. The authoritative rates tool — prefer it over quoting ^TNX for curve questions.',
      input_schema: { type: 'object', properties: {} },
    },
  },
  {
    market: 'macro',
    tool: {
      name: 'get_fx_rates',
      // ⚠ 126 is TYPED here, against the derive-don't-type rule, and the reason is a
      // boundary rather than laziness: the allowlist is `EXTENDED_CURRENCIES` inside
      // app/live-data/fx-rates-extended/route.ts, unexported, and this file imports only
      // from lib/ — pulling a value out of a route would drag route code into the agent
      // bundle. The real fix is to move the allowlist into lib/data/ beside the other
      // catalogs, after which this interpolates like the macro tool two entries above.
      // Corrected 2026-09-22: it said 127 until then. It has been 126 since 'bgn' was
      // removed on 2026-07-22, when Bulgaria adopted the euro — and an agent reads this
      // number out to a user.
      description: 'Get daily USD-based FX reference rates: 30 currencies from the ECB (official tier) and, when include_extended is true, 126 more community-sourced currencies (labeled non-official). Also returns pairRates: every catalog FX pair (EUR/USD, USD/JPY, EUR/GBP…) at the ECB\'s newest daily rate, with its date and the percent change since the ECB\'s previous working day, worked out for you; quote those rather than dividing rates yourself. For intraday pair quotes use get_macro_quote instead.',
      input_schema: {
        type: 'object',
        properties: {
          currencies: { type: 'array', items: { type: 'string' }, description: 'Optional ISO codes to filter, e.g. ["EUR","JPY","MXN"]' },
          include_extended: { type: 'boolean', description: 'Also fetch the extended community tier (default false)' },
        },
      },
    },
  },
  {
    market: 'macro',
    tool: {
      name: 'get_macro_news',
      description: 'Get recent macro-market news classified into pillars — commodities, currencies, bonds — with sentiment and detected instruments. Use for "what is moving oil/FX/rates" questions.',
      input_schema: {
        type: 'object',
        properties: {
          pillar: { type: 'string', enum: ['commodities', 'currencies', 'bonds'], description: 'Optional: one pillar only' },
          limit: { type: 'number', description: 'Max articles (default 10, max 25)' },
        },
      },
    },
  },
  {
    market: 'macro',
    tool: {
      name: 'get_economic_calendar',
      description: "Get the dates of the Fed's rate decisions and of the US CPI, jobs report, GDP and PCE inflation releases in the days ahead, from the app's tables copied from the Federal Reserve Board's calendar and the BLS and BEA schedules. Use for \"when is the next Fed meeting / CPI / jobs report\". Name the source of each date; an agency can move a date, and the table ends where the published schedules end (scheduleThrough).",
      input_schema: {
        type: 'object',
        properties: { days: { type: 'number', description: 'How many days ahead (default 60, max 400)' } },
      },
    },
  },
]

/**
 * Tools switched off with every risk rating until the risk engine is rebuilt
 * (D64, lib/risk/visibility.ts). They stay in the registry so restoring is the
 * switch alone, and are left out of everything an agent is offered: an
 * assistant quoting a trade's risk score is the same harm as the page showing it.
 */
export const WITHHELD_TOOLS: ReadonlySet<string> = new Set(RISK_RATINGS_SHOWN ? [] : ['score_options_trade'])

const OFFERED_TOOLS = TOOL_REGISTRY.filter((r) => !WITHHELD_TOOLS.has(r.tool.name))

/** All tool definitions an agent may be offered (every market). */
export const AGENT_TOOLS: Anthropic.Tool[] = OFFERED_TOOLS.map((r) => r.tool)

/** Tool definitions exposed to an agent, filtered by its toolset. */
export function toolsForAgent(toolset: ToolSet = 'crypto'): Anthropic.Tool[] {
  if (toolset === 'all') return AGENT_TOOLS
  return OFFERED_TOOLS.filter((r) => r.market === toolset).map((r) => r.tool)
}

// ─── Executor ───────────────────────────────────────────────────────────────

/**
 * Fetch an internal route as JSON.
 *
 * On a non-OK status this throws the ROUTE'S OWN error message when it has
 * one. It used to throw a bare `HTTP 404 for /live-data/company-facts?…`,
 * which discarded exactly the diagnosis the agent needed — the routes already
 * return things like "No SEC registrant found for ticker XOM", and every
 * `if (!data.ok) return { error: data.error }` branch downstream was
 * unreachable because this threw first.
 *
 * It carries the internal token (selfRequestHeaders), which the public API's key check and the
 * site lock both accept (D173, D174).
 */
async function getJson(origin: string, path: string, credits?: RequiredCredit[]): Promise<unknown> {
  const res = await fetch(origin + path, { headers: selfRequestHeaders({ Accept: 'application/json' }) })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `HTTP ${res.status}`
    throw new Error(`${detail} (${path})`)
  }
  if (credits) {
    for (const c of creditsFor(path, body)) if (!credits.some((x) => x.text === c.text)) credits.push(c)
  }
  return body
}

/**
 * The credits an answer built on this response must carry (D101). A response that
 * states its own (`attributions`, the agent API under D100) is taken at its word; a
 * /live-data route's come from the registry entry that owns it, which is where its
 * SourceLine on a page reads them. A route that reported failure (`ok: false`)
 * supplied no data, so it adds none.
 */
function creditsFor(path: string, body: unknown): RequiredCredit[] {
  if (body && typeof body === 'object') {
    if ((body as { ok?: unknown }).ok === false) return []
    const own = (body as { attributions?: unknown }).attributions
    if (Array.isArray(own)) return parseCredits(own)
  }
  const entry = sourceForRoute(path)
  return entry ? requiredAttributions(entry) : []
}

/**
 * Did an internal route report failure in its body?
 *
 * Several routes answer HTTP 200 with `ok: false` — a deliberate "reachable
 * but degraded" signal. Tools that read only the data array turn that into
 * "there is no news" / "no earnings scheduled", which the model then states as
 * fact. An upstream outage must never be indistinguishable from an empty
 * result, so tools call this and return an explicit error instead.
 */
function routeFailed(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'upstream returned no data'
  const d = data as { ok?: unknown; error?: unknown }
  if (d.ok === false) {
    return typeof d.error === 'string' ? d.error : 'upstream reported a failure'
  }
  return null
}

type ToolInput = Record<string, unknown>

/** What a tool returned, and the credits its data's licences require (D101). */
export interface ToolOutcome {
  result: unknown
  credits: RequiredCredit[]
}

/** Execute a tool by name and return a JSON-serializable result for the model. */
// ─── Fund details and stablecoin reserves (T-457, D210) ─────────────────────
//
// What the fund pages and the Reserve Monitor show, for the agents: read from the same routes,
// shaped here with what an agent needs to report it honestly (where each figure comes from and
// how old it is).

const HOLDINGS_SOURCE: Record<FundHoldingsResponse['source'], string> = {
  sec: "the fund's own N-PORT filing to the SEC",
  fmp: 'Financial Modeling Prep',
  catalog: "the app's catalog: a few indicative holdings typed in by hand, not a filing; say so if you use them",
}

/** A fund's sales charge for an agent: never a rate nobody has verified (fundCatalog's SalesCharge rule). */
export function salesChargeFact(charge: NonNullable<ReturnType<typeof fundSalesCharge>>): { kind: string; maxPct: number | null; note: string } {
  return charge.maxPct == null
    ? { kind: charge.kind, maxPct: null, note: 'A sales charge applies; its rate has not been verified, so do not state one.' }
    : { kind: charge.kind, maxPct: charge.maxPct, note: `Read from ${charge.source} on ${charge.verifiedAt}.` }
}

/** Where a fund invests, for an agent (T-455): the largest countries and currencies, and a bond fund's splits. */
function whereItInvests(e: NonNullable<FundHoldingsResponse['exposure']>): Record<string, unknown> {
  const list = (s: FundExposure['countries'], n: number) => s.slices.slice(0, n).map((x) => ({ name: x.label, code: x.code, pct: x.pct }))
  return {
    asOf: e.asOf,
    countries: list(e.countries, 10),
    countriesStatedPct: e.countries.statedPct,
    currencies: list(e.currencies, 8),
    currenciesStatedPct: e.currencies.statedPct,
    bonds: e.bonds
      ? {
        bondsPct: e.bonds.bondsPct,
        borrowers: e.bonds.borrowers.slices.map((x) => ({ kind: x.label, pct: x.pct })),
        maturities: e.bonds.maturities.slices.map((x) => ({ repaid: x.label, pct: x.pct })),
      }
      : null,
    note: "Shares of the fund's net assets from its own N-PORT filing, never rescaled to 100. A holding's country is where its issuer is based, not where a company sells. A field the filer left blank is left out, never guessed; the stated percent says how much of the fund each split covers. The filing carries no credit ratings, so say nothing about bond quality from it.",
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const wholeUsd = (n: number | null) => (n === null ? null : Math.round(n))

/**
 * A fund's own returns and money flows for an agent (T-459, D222, D223), from /live-data/fund-returns:
 * the figures the fund page shows, with the months they cover. Exported for its tests.
 */
export function fundReturnsFact(symbol: string, r: FundReturnsResponse | Error): Record<string, unknown> {
  if (r instanceof Error) return { error: `returns unavailable: ${r.message}` }
  if (!r.ok) return { error: `returns unavailable: ${r.error ?? 'the route reported a failure'}` }
  if (!r.filer) return { none: `${symbol} files no N-PORT report with the SEC (unit investment trusts and commodity trusts do not), so it has no reported returns here.` }
  const v = r.returns
  if (!v) return { none: r.error ?? 'No N-PORT filing could be read.' }
  return {
    source: "The fund's own NPORT-P filings with the SEC",
    filingFor: v.asOf,
    filedAt: v.filedAt,
    shareClass: r.classId,
    monthlyTotalReturnsPct: v.classFound
      ? v.months.map((m) => ({ month: m.month, pct: m.returnPct === null ? null : round2(m.returnPct) }))
      : null,
    twelveMonthReturn: v.twelveMonths
      ? { from: v.twelveMonths.from, to: v.twelveMonths.to, pct: round2(v.twelveMonths.returnPct) }
      : null,
    twelveMonthNote: v.twelveMonthsMissing,
    moneyInAndOut: v.flows
      ? {
        months: v.flows.months.map((m) => ({
          month: m.month, newSharesUsd: wholeUsd(m.sales), reinvestedUsd: wholeUsd(m.reinvestment),
          redeemedUsd: wholeUsd(m.redemption), netUsd: wholeUsd(m.net),
        })),
        netUsd: wholeUsd(v.flows.net),
        netAssetsUsd: wholeUsd(v.flows.netAssets),
        netPctOfNetAssets: v.flows.netPctOfAssets === null ? null : round2(v.flows.netPctOfAssets),
      }
      : null,
    note: "Total returns for this share class as the fund reported them, payouts included. The 12-month return compounds twelve reported months and is given only when none is missing; never work one out from fewer. Money in and out is for the whole fund, every share class; for an ETF, new and redeemed shares are dealers' creations and redemptions, not individual investors' purchases. The filings appear about 60 days after each quarter ends, so name the months these cover. Do not set them beside other funds' figures for other months, and do not rate the fund on them.",
  }
}

/**
 * A company's last eight quarters for an agent (T-461): each figure with whether it was worked out
 * and the change from a year earlier, as the stock page shows them. Exported for its tests.
 */
export function quartersFact(quarters: CompanyQuarter[]): Record<string, unknown> {
  if (quarters.length === 0) {
    return { none: 'No quarterly reports (Form 10-Q) are on file with the SEC for this company; a company based outside the US usually reports once a year. Do not estimate quarterly figures.' }
  }
  const fig = (q: CompanyQuarter['revenue']) => (q ? { value: q.value, workedOut: q.workedOut } : null)
  const pct = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)
  return {
    quarters: quarters.map((q) => ({
      periodStart: q.start, periodEnd: q.end,
      revenueUsd: fig(q.revenue), revenueChangePct: pct(q.revenueChangePct),
      netIncomeUsd: fig(q.netIncome), netIncomeChangePct: pct(q.netIncomeChangePct),
      eps: q.eps ? { value: q.eps.value, basis: q.eps.concept === 'EarningsPerShareBasic' ? 'basic' : 'diluted' } : null,
      epsChangePct: pct(q.epsChangePct),
    })),
    note: "From the company's 10-Q and 10-K reports, newest first. Each change is from the same quarter a year earlier, and is null where that figure was a loss or zero. Companies file no separate fourth-quarter report, so a figure marked workedOut is the full year less the first nine months; fourth-quarter earnings per share are given only where the company filed them, so never work one out. P/E and dividend yield stay on the latest full year.",
  }
}

/** Exported for its tests. */
export function fundDetails(
  symbol: string,
  holdings: FundHoldingsResponse | Error,
  prospectus: FundProspectusResponse | Error,
  top: number,
  returns?: FundReturnsResponse | Error,
): Record<string, unknown> {
  const f = getFund(symbol)
  const charge = f ? fundSalesCharge(f) : null
  const y = f ? fundYieldFact(f) : null
  const catalog = f ? {
    name: f.name, issuer: f.issuer, type: f.type,
    category: FUND_CATEGORY_INFO[f.category].label, indexTracked: f.indexTracked,
    expenseRatioPct: f.expenseRatioPct,
    expenseRatioCheckedOn: getFundFeeProvenance().verifiedAt,
    salesCharge: charge ? salesChargeFact(charge) : null,
    netAssetsB: f.aumB, netAssetsAsOf: f.aumAsOf ?? null, netAssetsMeasure: fundAssetsFact(f, String).label,
    yieldPct: y?.shown ? f.yieldPct : null, yieldKind: y?.shown ? y.kind : null, yieldAsOf: y?.shown ? y.asOf : null,
    yieldNote: y?.explain ?? null,
    website: f.website,
  } : null

  let filing: Record<string, unknown>
  if (holdings instanceof Error) filing = { error: `holdings unavailable: ${holdings.message}` }
  else if (!holdings.ok) filing = { error: `holdings unavailable: ${holdings.error ?? 'the route reported a failure'}` }
  else {
    const shown = holdings.holdings.slice(0, top)
    filing = {
      source: HOLDINGS_SOURCE[holdings.source],
      asOf: holdings.asOf,
      positions: holdings.holdingsCount,
      completeList: holdings.full,
      largestHoldings: shown.map((h) => ({ name: h.name, symbol: h.symbol, weightPct: Math.round(h.weightPct * 100) / 100 })),
      largestHoldingsTotalPct: Math.round(shown.reduce((s, h) => s + h.weightPct, 0) * 10) / 10,
      assetMix: holdings.assetAllocation.length ? holdings.assetAllocation : null,
      assetMixCoveredPct: holdings.assetAllocationCoverage?.coveredPct ?? null,
      sectorWeights: holdings.sectorWeights.length ? holdings.sectorWeights : null,
      duration: holdings.rateSensitivity
        ? {
          years: holdings.rateSensitivity.durationYears, asOf: holdings.rateSensitivity.asOf,
          note: "Worked out from the interest-rate risk the fund reports in the same filing: roughly the percent its value changes for each one-point move in rates.",
        }
        : null,
      whereItInvests: holdings.exposure ? whereItInvests(holdings.exposure) : null,
      weightsNote: 'Weights are percent of the fund’s net assets as filed, never rescaled to 100.',
    }
  }

  const prospectusOut = prospectus instanceof Error
    ? { error: `prospectus lookup failed: ${prospectus.message}` }
    : prospectus.prospectus
      ? { kind: prospectus.prospectus.kind, filedAt: prospectus.prospectus.filedAt, url: prospectus.prospectus.url }
      : { none: prospectus.reason ?? prospectus.error ?? 'No prospectus was found.' }

  return {
    symbol,
    inCatalog: !!f,
    catalog,
    filing,
    returns: returns === undefined ? null : fundReturnsFact(symbol, returns),
    prospectus: prospectusOut,
    ...(f ? {} : { note: `${symbol} is not in the app's fund catalog, so there is no expense ratio, sales charge or yield here; the filing figures above are still the fund's own. Do not estimate the missing ones.` }),
  }
}

/** Exported for its tests. */
export function stablecoinReserves(
  assets: LiveReserveAsset[],
  notFound: string[],
  metaAsOf: string | null,
  symbol: string | null,
): Record<string, unknown> {
  const wanted = symbol?.trim().toUpperCase() || null
  const picked = wanted ? assets.filter((a) => a.symbol.toUpperCase() === wanted) : assets
  if (wanted && picked.length === 0) {
    return { error: `${wanted} is not among the monitored stablecoins.`, monitored: assets.map((a) => a.symbol) }
  }
  return {
    coins: picked.map((a) => ({
      symbol: a.symbol, name: a.name, pegType: a.pegType, pegMechanism: a.pegMechanism,
      priceUsd: a.price,
      // Only a dollar coin's price is against its own peg; a euro coin's dollar price is not. No
      // price, no distance from the peg (D214).
      pegDeviationBps: a.pegType === 'peggedUSD' && a.price !== null ? Math.round((a.price - 1) * 10_000) : null,
      circulatingUsd: Math.round(a.circulatingUsd),
      supplyChangePct: a.supplyChange,
      largestChains: a.chainSplit.top.map((c) => ({ chain: c.chain, pct: c.pct })),
      otherChains: a.chainSplit.others ? { count: a.chainSplit.others.count, pct: a.chainSplit.others.pct } : null,
      attester: a.attester,
      attestationUrl: a.attestationUrl === '#' ? null : a.attestationUrl,
      lastAttestedDate: a.lastAttestedDate,
      collateralizationRatio: a.collateralizationRatio,
      reserveMix: a.composition.map((c) => ({ category: c.category, pct: c.percentage })),
    })),
    attestationFactsAsOf: metaAsOf,
    notFound,
    note: `Price and supply are live from DefiLlama. The attester, attestation date, collateral ratio and reserve mix are kept by hand${metaAsOf ? ` as of ${metaAsOf}` : ''}, not live; several were taken from news reports and trackers quoting the issuers, and a null collateral ratio means it is not publicly disclosed. pegDeviationBps is the price's distance from $1 in hundredths of a percent, for dollar coins only. A null priceUsd means DefiLlama sent no price for that coin: say so, and do not call it on its peg. Report the figures; do not grade a coin's safety.`,
  }
}

export async function runTool(
  name: string,
  input: ToolInput,
  origin: string,
  watchlistTerms?: string[]
): Promise<unknown> {
  return (await runToolWithCredits(name, input, origin, watchlistTerms)).result
}

/**
 * runTool, plus the credits an answer built on its result must carry: "Powered by
 * CoinGecko" for a coin price, and whatever else a source's licence requires. The
 * runner gathers them across a run and the agent routes send them with the answer,
 * for the page to show under it (D101). Every fetch goes through `get` below, so a
 * new tool collects its credits without doing anything.
 *
 * Watchlist terms forwarded from the client, OR-matched by the news routes.
 *
 * Agents run server-side and the watchlist lives in localStorage, so the server
 * cannot discover it — it has to be passed in. Without this, an agent asked
 * "what's in the news" would answer from a different, unbiased feed than the one
 * the user is looking at, which is more confusing than no biasing at all.
 */
export async function runToolWithCredits(
  name: string,
  input: ToolInput,
  origin: string,
  watchlistTerms?: string[]
): Promise<ToolOutcome> {
  const credits: RequiredCredit[] = []
  const result = await execute(name, input, origin, credits, watchlistTerms)
  return { result, credits }
}

async function execute(
  name: string,
  input: ToolInput,
  origin: string,
  credits: RequiredCredit[],
  watchlistTerms?: string[]
): Promise<unknown> {
  const get = (path: string) => getJson(origin, path, credits)
  const watchlistParam = watchlistTerms?.length ? watchlistTerms.join(',') : null
  // A model can name a tool it was not offered. A withheld one answers with the
  // reason instead of running, so the reply says it is switched off.
  if (WITHHELD_TOOLS.has(name)) {
    return { error: `${name} is switched off in this build: risk ratings are off until the risk engine is rebuilt and reviewed. Do not estimate a score yourself.` }
  }
  try {
    switch (name) {
      case 'get_prices': {
        const coins = (input.coins as string[] | undefined)?.join(',') ?? ''
        return await get(`/api/v1/prices?coins=${encodeURIComponent(coins)}`)
      }
      case 'get_market_overview':
        return await get(`/live-data/markets`)
      case 'list_exchanges': {
        const tier = input.tier ? `?tier=${input.tier}` : ''
        return await get(`/api/v1/exchanges${tier}`)
      }
      case 'get_network_fees':
        return await get(`/api/v1/network-fees`)
      // find_transfer_routes handler — hidden with its tool definition above.
      // case 'find_transfer_routes': {
      //   const p = new URLSearchParams({
      //     from: String(input.from ?? ''),
      //     to: String(input.to ?? ''),
      //     coin: String(input.coin ?? ''),
      //   })
      //   if (input.amount != null) p.set('amount', String(input.amount))
      //   return await get(`/api/v1/transfer/routes?${p.toString()}`)
      // }
      case 'get_staking_opportunities': {
        const p = new URLSearchParams({ coin: String(input.coin ?? '') })
        if (input.category) p.set('category', String(input.category))
        // No max_risk: the upstream route stopped serving a composite under D14,
        // so forwarding the param would set a filter the API silently ignores.
        return await get(`/api/v1/staking/opportunities?${p.toString()}`)
      }
      case 'get_stablecoin_reserves': {
        const data = (await get('/live-data/reserves')) as {
          ok?: boolean; error?: string; assets?: LiveReserveAsset[]; notFound?: string[]; metaAsOf?: string
        }
        const failure = routeFailed(data)
        if (failure) return { error: `reserve data unavailable: ${failure}` }
        return stablecoinReserves(data.assets ?? [], data.notFound ?? [], data.metaAsOf ?? null, input.symbol ? String(input.symbol) : null)
      }
      case 'get_news': {
        const p = new URLSearchParams({ coin: String(input.coin ?? '') })
        p.set('limit', String(input.limit ?? 10))
        if (input.sentiment) p.set('sentiment', String(input.sentiment))
        // Only when the agent hasn't asked for a specific coin — an explicit
        // "news about SOL" must not be silently narrowed to the watchlist.
        if (watchlistParam && !input.coin) p.set('watchlist', watchlistParam)
        return await get(`/api/v1/news?${p.toString()}`)
      }
      case 'get_price_history': {
        const coin = String(input.coin ?? '')
        const range = String(input.range ?? '1Y')
        type Series = {
          ok?: boolean; candles?: { time: number; open: number; high: number; low: number; close: number }[]
          source?: string; bars?: 'ohlc' | 'close'; error?: string
        }
        const base = `/live-data/ohlcv?id=${encodeURIComponent(coin)}&range=${encodeURIComponent(range)}`
        // Candles first: a candle's high and low are the period's trading range, and
        // even CoinGecko's 4-day candles (what it sends past 30 days) carry the true
        // extremes. Only when the candle request fails (past 365 days on CoinGecko's
        // free service, or a refusal) does the summary fall back to DefiLlama's
        // closing prices (T-423, D103), and then it says so in its field names.
        const candles = (await get(base)) as Series
        const series = candles.ok && candles.candles?.length ? candles : (await get(`${base}&closes=1`)) as Series
        const rows = series.candles ?? []
        // The route's reason travels with the refusal, and "no data" alone reads as a
        // coin with no history.
        if (!series.ok || rows.length === 0) {
          return { error: 'no price history available', reason: series.error ?? candles.error, coin, range }
        }
        const first = rows[0], last = rows[rows.length - 1]
        const size = candleSizeWords(candleGranularity(rows.map((c) => c.time)))
        const changePct = Number((((last.close - first.open) / first.open) * 100).toFixed(2))
        // `source` is the provider key and `sourceName` the label to cite. Two fields
        // rather than the label in `source`: get_stock_price_history also emits
        // `source`, and one field name with two vocabularies misleads the model.
        const head = { coin, range, source: series.source, sourceName: ohlcvSourceLabel(series.source) }
        // Return a compact summary — never dump hundreds of rows into context.
        if (series.bars === 'close') {
          const closes = rows.map((c) => c.close)
          return {
            ...head,
            // Separate names, not periodHigh with a caveat beside it: the highest close
            // is not the period's high, and a reader skimming for "high" must not find one.
            prices: `closing prices only, ${size ?? 'one per period'}: no intraday high or low`,
            priceCount: rows.length,
            firstClose: first.close, lastClose: last.close,
            highestClose: Math.max(...closes), lowestClose: Math.min(...closes),
            changePct,
            candlesUnavailable: candles.error ?? 'the candle source sent none',
          }
        }
        return {
          ...head,
          // Measured, not assumed: a 1Y range is 4-day candles from CoinGecko, and
          // candleCount means nothing without it (T-423).
          candleSize: size,
          candleCount: rows.length,
          firstClose: first.close, lastClose: last.close,
          periodHigh: Math.max(...rows.map((c) => c.high)), periodLow: Math.min(...rows.map((c) => c.low)),
          changePct,
        }
      }
      case 'get_fund_details': {
        const symbol = String(input.symbol ?? '').trim().toUpperCase()
        if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return { error: 'Pass a fund ticker, e.g. "VOO".' }
        const top = Math.min(Math.max(Math.round(Number(input.top ?? 15)) || 15, 1), 40)
        const q = encodeURIComponent(symbol)
        const [holdings, prospectus, returns] = await Promise.all([
          (get(`/live-data/fund-holdings?symbol=${q}`) as Promise<FundHoldingsResponse>).catch((e: Error) => e),
          (get(`/live-data/fund-prospectus?symbol=${q}`) as Promise<FundProspectusResponse>).catch((e: Error) => e),
          (get(`/live-data/fund-returns?symbol=${q}`) as Promise<FundReturnsResponse>).catch((e: Error) => e),
        ])
        return fundDetails(symbol, holdings, prospectus, top, returns)
      }
      case 'search_securities': {
        const query = String(input.query ?? '').trim().toLowerCase()
        const type = input.type ? String(input.type) : undefined
        const sector = input.sector ? String(input.sector).toLowerCase() : undefined

        const stockHits = (type && type !== 'stock') ? [] : EQUITY_CATALOG
          .filter((e) => !sector || e.sector === sector)
          .filter((e) => !query || e.symbol.toLowerCase().includes(query) || e.name.toLowerCase().includes(query) || e.industry.toLowerCase().includes(query))
          .slice(0, 15)
        // D167/D170: P/E, dividend yield and market cap from each company's SEC filings,
        // against the LIVE price, never the catalog's hand-typed figures or a stored price.
        // perShareAsOf is the fiscal year they are for; secFilings is where they come from.
        // Read through the Stock Registry's own routes, so the agent sees what the page shows.
        const list = encodeURIComponent(stockHits.map((e) => e.symbol).join(','))
        const [sec, quotes] = stockHits.length
          ? await Promise.all([
            get(`/live-data/stock-universe?symbols=${list}`) as Promise<StockUniverseResponse>,
            get(`/live-data/security-quotes?symbols=${list}`) as Promise<SecurityQuotesResponse>,
          ])
          : [null, null]
        const secBySymbol = new Map((sec?.entries ?? []).map((u) => [u.symbol, u]))
        const stocks = stockHits.map((e) => {
          const u = secBySymbol.get(e.symbol)
          const q = quotes?.quotes?.[e.symbol]
          const livePrice = q && !q.reference && q.price != null && q.price > 0 ? q.price : null
          const f = stockFigures(perShareFromFields(u), livePrice)
          const cap = marketCapText(u?.shares, livePrice)
          return {
            symbol: e.symbol, name: e.name, type: 'stock' as const,
            sector: SECTOR_INFO[e.sector].label, industry: e.industry,
            livePrice, marketCapUsd: marketCapUsd(u?.shares, livePrice), sharesAsOf: u?.shares?.end ?? null,
            peRatio: f.pe, dividendYieldPct: f.dividendYieldPct, dividendState: f.dividend,
            perShareAsOf: f.asOf,
            figuresNote: `${peText(f).explain} ${yieldText(f).explain} Market cap: ${cap.explain}${livePrice == null ? ' No live quote was available, so none of these is given; do not estimate them.' : ''}`,
            secFilings: stockFiguresLink(e.symbol).href,
          }
        })
        const funds = (type === 'stock') ? [] : FUND_CATALOG
          .filter((f) => !type || f.type === type)
          .filter((f) => !query ||
            f.symbol.toLowerCase().includes(query) ||
            f.name.toLowerCase().includes(query) ||
            f.issuer.toLowerCase().includes(query) ||
            (f.focusIndustry != null && (f.focusIndustry.toLowerCase().includes(query) || query.includes(f.focusIndustry.toLowerCase()))) ||
            (f.focusSector != null && SECTOR_INFO[f.focusSector].label.toLowerCase().includes(query)))
          .slice(0, 15)
          .map((f) => ({
            symbol: f.symbol, name: f.name, type: f.type, issuer: f.issuer,
            category: f.focusSector
              ? `${FUND_CATEGORY_INFO[f.category].label} · ${SECTOR_INFO[f.focusSector].label}${f.focusIndustry ? ` (${f.focusIndustry})` : ''}`
              : FUND_CATEGORY_INFO[f.category].label,
            // aumAsOf is the SEC filing's period end; null means the figure is approximate.
            // aumMeasure says what it counts: a mutual fund's is the whole fund (D115).
            expenseRatioPct: f.expenseRatioPct, aumB: f.aumB, aumAsOf: f.aumAsOf ?? null,
            // yieldKind says which yield it is: 'sec' is a 30-day SEC yield and 'effective' the
            // page's adjusted effective yield, never a 12-month one. A yield is given only where
            // it is shown (D166), dated and possibly changed since; yieldNote and website say so.
            aumMeasure: fundAssetsFact(f, String).label,
            ...(() => {
              const y = fundYieldFact(f)
              return {
                yieldPct: y.shown ? f.yieldPct : null,
                yieldKind: y.shown ? y.kind : null,
                yieldAsOf: y.shown ? y.asOf : null,
                yieldNote: y.explain,
                website: f.website,
              }
            })(),
            indexTracked: f.indexTracked,
            topHoldings: f.topHoldings.slice(0, 5).map((h) => `${h.symbol} ${h.weightPct}%`),
          }))
        if (stocks.length === 0 && funds.length === 0) {
          return { stocks, funds, note: 'No catalog matches — the symbol may still be quotable via get_stock_quote.' }
        }
        return { stocks, funds }
      }

      // ── Equity tools ──────────────────────────────────────────────────────────
      case 'get_stock_quote': {
        const symbols = (input.symbols as string[] | undefined)?.map((s) => s.toUpperCase()).join(',') ?? ''
        const data = (await get(`/live-data/security-quotes?symbols=${encodeURIComponent(symbols)}`)) as {
          source?: string; quotes?: Record<string, { price: number; changePercent: number | null; marketCap: number | null; volume: number | null; reference?: boolean }>
        }
        const quotes = data.quotes ?? {}
        // A stock with no live quote is absent, never given a stored price (D170).
        const missing = symbols.split(',').filter((s) => s && !quotes[s])
        return { source: data.source, quotes, ...(missing.length ? { missing, missingNote: 'No live quote for these: say so, and do not estimate a price.' } : {}) }
      }
      case 'get_stock_financials': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const data = (await get(`/live-data/company-facts?symbol=${encodeURIComponent(symbol)}`)) as {
          ok?: boolean; error?: string; company?: string; fiscalYearEnd?: string; fundamentals?: unknown; ratios?: unknown
          quarters?: CompanyQuarter[]
        }
        if (!data.ok) return { error: data.error ?? 'no fundamentals available', symbol }
        // Trim to the analytically useful fields — omit the annual history series. T-461 adds the quarters.
        return {
          symbol, company: data.company, fiscalYearEnd: data.fiscalYearEnd, fundamentals: data.fundamentals, ratios: data.ratios,
          lastQuarters: quartersFact(data.quarters ?? []),
        }
      }
      case 'get_stock_profile': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const data = (await get(`/live-data/company-profile?symbol=${encodeURIComponent(symbol)}`)) as {
          ok?: boolean; error?: string; profile?: unknown; wiki?: { extract?: string; url?: string | null } | null
        }
        if (!data.ok) return { error: data.error ?? 'no profile available', symbol }
        // Wikipedia's text, with its name and link. Wikipedia's terms ask for a link to
        // the article (sourceTerms.ts), and the stock page gives one. This returned the
        // text alone until 2026-10-17, when the agent evaluation found an agent crediting
        // it to SEC EDGAR, the only source the tool named.
        const background = data.wiki?.extract
          ? { text: data.wiki.extract, source: 'Wikipedia', url: data.wiki.url ?? null, licence: 'CC BY-SA 4.0' }
          : null
        return { symbol, profile: data.profile, background }
      }
      case 'get_stock_filings': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const form = String(input.form ?? '8-K')
        const limit = Number(input.limit ?? 8)
        const data = (await get(`/live-data/sec-filings?symbol=${encodeURIComponent(symbol)}&form=${encodeURIComponent(form)}&limit=${limit}`)) as {
          ok?: boolean; error?: string; company?: string; filings?: Array<{ form: string; filedAt: string; reportDate: string | null; itemLabels: string[]; url: string }>
        }
        if (!data.ok) return { error: data.error ?? 'no filings available', symbol }
        return {
          symbol, company: data.company,
          filings: (data.filings ?? []).map((f) => ({ form: f.form, filedAt: f.filedAt, reportDate: f.reportDate, events: f.itemLabels, url: f.url })),
        }
      }
      case 'get_stock_news': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const limit = Number(input.limit ?? 10)
        const data = (await get(`/live-data/market-news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`)) as {
          ok?: boolean; articles?: Array<{ title: string; source: string; publishedAt: string; sentiment: string; category: string; url: string }>
        }
        const failure = routeFailed(data)
        if (failure) return { error: `news feeds unavailable for ${symbol}: ${failure}`, symbol }
        const articles = (data.articles ?? []).map((a) => ({ title: a.title, source: a.source, publishedAt: a.publishedAt, sentiment: a.sentiment, category: a.category, url: a.url }))
        if (articles.length === 0) return { symbol, articles: [], note: 'feeds reachable, but no recent articles matched this symbol' }
        return { symbol, articles }
      }
      case 'score_options_trade': {
        // The only tool that POSTs — a multi-leg trade doesn't fit a query
        // string — so it can't use getJson(). The route validates and returns
        // its reasons in `details`; pass those through verbatim rather than
        // collapsing them, so the model can ask the user for exactly what is
        // missing instead of guessing at it.
        const res = await fetch(origin + '/api/v1/options/score', {
          method: 'POST',
          headers: selfRequestHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
          body: JSON.stringify(input),
        })
        const data = await res.json().catch(() => null) as
          | { error?: string; details?: string[]; risk?: unknown; netShortPremium?: boolean; disclaimer?: string }
          | null
        if (!res.ok || !data) {
          return {
            error: data?.error ?? `HTTP ${res.status}`,
            details: data?.details,
            hint: 'Ask the user for the missing or invalid values — do not substitute your own.',
          }
        }
        return {
          risk: data.risk,
          netShortPremium: data.netShortPremium,
          disclaimer: data.disclaimer,
          scale: '0-100, higher = safer. Report the band and the weakest dimensions, not just the number.',
        }
      }
      case 'get_stock_social': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const limit = Number(input.limit ?? 20)
        const data = (await get(`/live-data/stock-social?symbol=${encodeURIComponent(symbol)}&limit=${limit}`)) as {
          ok?: boolean; summaries?: unknown; providers?: Array<{ name: string }>
          signals?: Array<{ platform: string; title: string; sentiment: string; score: number; url: string }>
          withheld?: Array<{ name: string; reason: string }>
        }
        const failure = routeFailed(data)
        if (failure) return { error: `social providers unavailable for ${symbol}: ${failure}`, symbol }
        return {
          symbol,
          providers: (data.providers ?? []).map((p) => p.name),
          // Why a source is missing (Reddit's robots gate), so the agent can say so
          // instead of reading a StockTwits-only feed as the whole picture.
          withheld: (data.withheld ?? []).map((w) => ({ name: w.name, reason: w.reason })),
          summary: data.summaries ?? [],
          topPosts: (data.signals ?? []).slice(0, 10).map((s) => ({ platform: s.platform, text: s.title, sentiment: s.sentiment, score: s.score, url: s.url })),
        }
      }
      case 'get_stock_price_history': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const range = String(input.range ?? '1Y')
        const data = (await get(`/live-data/security-ohlcv?symbol=${encodeURIComponent(symbol)}&range=${range}`)) as {
          ok?: boolean; candles?: { time: number; open: number; high: number; low: number; close: number }[]; source?: string
        }
        const candles = data.candles ?? []
        if (!data.ok || candles.length === 0) return { error: 'no candle data available', symbol, range }
        const first = candles[0], last = candles[candles.length - 1]
        const high = Math.max(...candles.map((c) => c.high))
        const low = Math.min(...candles.map((c) => c.low))
        const changePct = ((last.close - first.open) / first.open) * 100
        // Compact summary — never dump hundreds of candles into context.
        return {
          symbol, range, source: data.source, candleCount: candles.length,
          firstClose: first.close, lastClose: last.close,
          periodHigh: high, periodLow: low,
          changePct: Number(changePct.toFixed(2)),
        }
      }
      case 'get_market_news': {
        const limit = Math.min(Number(input.limit ?? 10) || 10, 25)
        // Equity feeds are per-ticker RSS rather than text-searchable, so the
        // watchlist widens coverage by fetching each ticker's own feed. Only
        // the ticker-shaped terms apply here; crypto ids would match nothing.
        const wlSymbols = (watchlistTerms ?? [])
          .filter((t) => /^[A-Za-z.\-]{1,6}$/.test(t))
          .map((t) => t.toUpperCase())
        const p = new URLSearchParams({ limit: String(limit) })
        if (wlSymbols.length > 0) p.set('watchlist', wlSymbols.slice(0, 6).join(','))
        const data = (await get(`/live-data/market-news?${p.toString()}`)) as {
          ok?: boolean
          articles?: { title: string; url: string; source: string; publishedAt: string; summary: string; sentiment: string; category: string; relatedSymbols: string[] }[]
        }
        const failure = routeFailed(data)
        if (failure) return { error: `market news feeds unavailable: ${failure}` }
        const articles = (data.articles ?? []).slice(0, limit).map((a) => ({
          title: a.title, source: a.source, publishedAt: a.publishedAt,
          sentiment: a.sentiment, category: a.category, relatedSymbols: a.relatedSymbols,
          summary: a.summary.length > 200 ? `${a.summary.slice(0, 200)}…` : a.summary,
          url: a.url,
        }))
        return { count: articles.length, articles }
      }
      case 'get_market_calendar': {
        const days = Math.min(Number(input.days ?? 14) || 14, 30)
        const data = (await get(`/live-data/market-calendar?days=${days}`)) as {
          ok?: boolean; configured?: boolean; earnings?: unknown[]; economic?: unknown[]; from?: string; to?: string
          earningsGap?: string | null
        }
        if (data.configured === false) {
          // FOMC meeting dates are keyless (lib/data/fomcCalendar.ts) and still come back;
          // only earnings and the other economic releases need the key. Say which is which,
          // so an empty earnings list is never read as "nobody reports".
          return {
            from: data.from, to: data.to,
            earnings: [],
            earningsUnavailable: 'Earnings need an FMP or Alpha Vantage API key, and economic releases other than the Fed meetings and the CPI, jobs report, GDP and PCE dates need an FMP key; neither is configured on this instance.',
            economic: (data.economic ?? []).slice(0, 25),
          }
        }
        // Configured but both upstream legs failed: the route answers 200 with
        // ok:false and empty arrays. Returning those verbatim reads as "no
        // earnings scheduled", which is a confident wrong answer to "when does
        // NVDA report?".
        const failure = routeFailed(data)
        if (failure) return { error: `calendar upstream unavailable: ${failure}` }
        return {
          from: data.from, to: data.to,
          earnings: (data.earnings ?? []).slice(0, 40),
          earningsNote: 'Earnings dates are expected, not confirmed: companies often confirm late and can move a date. Each row names its source: FMP first, Alpha Vantage for companies FMP does not list.'
            + (data.earningsGap ? ` ${data.earningsGap} Do not say a company has no report coming because it is missing here.` : ''),
          economic: (data.economic ?? []).slice(0, 25),
        }
      }
      case 'get_stock_outliers': {
        const minMcap = input.min_mcap != null ? Number(input.min_mcap) : 2
        const data = (await get(`/live-data/stock-outliers?min_mcap=${minMcap}`)) as {
          ok?: boolean; configured?: boolean; universeSize?: number; evaluated?: number
          sectorsEvaluated?: number; peCoverage?: number; note?: string; categories?: unknown
        }
        if (!data.ok) return { error: 'outlier scan failed' }
        return {
          universeSize: data.universeSize, evaluated: data.evaluated,
          sectorsEvaluated: data.sectorsEvaluated, peCoverage: data.peCoverage,
          coverageNote: data.note, categories: data.categories,
        }
      }
      // ── Macro tools ───────────────────────────────────────────────────────────
      case 'search_macro_instruments': {
        const query = String(input.query ?? '').trim().toLowerCase()
        const area = input.area ? String(input.area) : undefined
        const match = (...hay: string[]) => !query || hay.some((h) => h.toLowerCase().includes(query))
        const commodities = (area && area !== 'commodities') ? [] : COMMODITY_CATALOG
          .filter((c) => match(c.name, c.symbol, c.category))
          .map((c) => ({
            symbol: c.symbol, name: c.name, area: 'commodities' as const,
            category: COMMODITY_CATEGORY_INFO[c.category].label, exchange: c.exchange,
            quotesIn: c.quoteBasis === 'cents' ? `US cents per ${c.unit}` : `USD per ${c.unit}`,
            etfProxies: c.etfProxies,
          }))
        const currencies = (area && area !== 'currencies') ? [] : CURRENCY_CATALOG
          .filter((c) => match(c.name, c.symbol, c.base, c.quote))
          .map((c) => ({
            symbol: c.symbol, name: c.name, area: 'currencies' as const,
            category: CURRENCY_CATEGORY_INFO[c.category].label,
            pair: `1 ${c.base} = X ${c.quote}`,
            etfProxies: c.etfProxies,
          }))
        const rates = (area && area !== 'rates') ? [] : RATES_CATALOG
          .filter((r) => match(r.name, r.symbol))
          .map((r) => ({
            symbol: r.symbol, name: r.name, area: 'rates' as const,
            category: RATES_CATEGORY_INFO[r.category].label,
            quotesIn: r.quoteBasis === 'pct' ? 'yield in plain percent, from the official daily Treasury par curve (use get_yield_curve)' : 'points of par',
            etfProxies: r.etfProxies,
          }))
        if (commodities.length + currencies.length + rates.length === 0) {
          return { commodities, currencies, rates, note: 'No catalog matches — the symbol may still be quotable via get_macro_quote.' }
        }
        // Capped like search_securities: an empty query would otherwise dump
        // all 46 catalog entries with their etfProxies arrays into context.
        return {
          commodities: commodities.slice(0, 15),
          currencies: currencies.slice(0, 15),
          rates: rates.slice(0, 15),
          ...(commodities.length + currencies.length + rates.length > 45
            ? { note: 'Results capped at 15 per area — narrow the query for more specific matches.' }
            : {}),
        }
      }
      case 'get_macro_quote': {
        const symbols = (input.symbols as string[] | undefined)?.map((s) => s.toUpperCase()).join(',') ?? ''
        const data = (await get(`/live-data/security-quotes?symbols=${encodeURIComponent(symbols)}`)) as {
          source?: string; quotes?: Record<string, { price: number; changePercent: number | null; volume: number | null; reference?: boolean }>
        }
        return { source: data.source, quotes: data.quotes ?? {} }
      }
      case 'get_macro_price_history': {
        const symbol = String(input.symbol ?? '').toUpperCase()
        const range = String(input.range ?? '1Y')
        // T-446: a Treasury yield has no candles anywhere (D3); its history is the official curve's.
        const curveEntry = RATES_CATALOG.find((r) => r.quoteBasis === 'pct' && r.symbol === symbol)
        const maturity = curveEntry ? parLabelFor(curveEntry.maturityYears) : null
        if (maturity) {
          const hRange = ({ '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', MAX: '10y' } as Record<string, string>)[range] ?? '1y'
          const h = (await get(`/live-data/treasury-yield-history?maturity=${maturity}&range=${hRange}`)) as {
            ok?: boolean; error?: string; interval?: string; points?: { date: string; yieldPct: number }[]
          }
          const pts = h.points ?? []
          if (!h.ok || pts.length === 0) return { error: h.error ?? 'no yield history available', symbol, range }
          const ys = pts.map((p) => p.yieldPct)
          return {
            symbol, maturity, range, source: 'treasury.gov official daily par curve', interval: h.interval, readings: pts.length,
            note: `One official figure a day, in percent; there is no intraday high or low.${extremesNote(h.interval)}`,
            firstDate: pts[0].date, firstYieldPct: ys[0], lastDate: pts[pts.length - 1].date, lastYieldPct: ys[ys.length - 1],
            highestYieldPct: Math.max(...ys), lowestYieldPct: Math.min(...ys),
            changeBp: Math.round((ys[ys.length - 1] - ys[0]) * 100),
          }
        }
        // T-445: an FX pair's history is the ECB's daily reference rates; no keyed provider has sent one since 2026-09-09.
        const pair = ecbPairBySymbol(symbol)
        if (pair) {
          const hRange = ({ '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', MAX: '10y' } as Record<string, string>)[range] ?? '1y'
          const h = (await get(`/live-data/fx-pair-history?pair=${pair.slug}&range=${hRange}`)) as {
            ok?: boolean; error?: string; interval?: string; points?: { date: string; rate: number }[]
          }
          const pts = h.points ?? []
          if (!h.ok || pts.length === 0) return { error: h.error ?? 'no reference rate history available', symbol, range }
          const rs = pts.map((p) => p.rate)
          return {
            symbol, pair: pair.name, range, source: 'European Central Bank euro reference rates (via Frankfurter)', interval: h.interval, readings: pts.length,
            note: `${ECB_RATE_NOTE} One figure a working day; there is no intraday high or low.${extremesNote(h.interval)} ${pairRateBasis(pair)}`,
            firstDate: pts[0].date, firstRate: rs[0], lastDate: pts[pts.length - 1].date, lastRate: rs[rs.length - 1],
            highestRate: Math.max(...rs), lowestRate: Math.min(...rs),
            changePct: Number((((rs[rs.length - 1] - rs[0]) / rs[0]) * 100).toFixed(2)),
          }
        }
        const data = (await get(`/live-data/security-ohlcv?symbol=${encodeURIComponent(symbol)}&range=${range}`)) as {
          ok?: boolean; candles?: { time: number; open: number; high: number; low: number; close: number }[]; source?: string
        }
        const candles = data.candles ?? []
        if (!data.ok || candles.length === 0) return { error: 'no candle data available', symbol, range }
        const first = candles[0], last = candles[candles.length - 1]
        const high = Math.max(...candles.map((c) => c.high))
        const low = Math.min(...candles.map((c) => c.low))
        const changePct = ((last.close - first.open) / first.open) * 100
        // Compact summary — never dump hundreds of candles into context.
        return {
          symbol, range, source: data.source, candleCount: candles.length,
          firstClose: first.close, lastClose: last.close,
          periodHigh: high, periodLow: low,
          changePct: Number(changePct.toFixed(2)),
        }
      }
      case 'get_yield_curve': {
        const data = (await get(`/live-data/treasury-yield-curve`)) as {
          ok?: boolean; error?: string; latest?: unknown; monthAgo?: unknown; yearStart?: unknown
          spread2s10s?: number; spread3m10y?: number; shape?: string
          monthAgoSpreads?: unknown; yearStartSpreads?: unknown
          changeSinceMonthAgo?: unknown; changeSinceYearStart?: unknown; expectedInflation?: unknown
        }
        if (!data.ok) return { error: data.error ?? 'yield curve unavailable' }
        // The comparison curves' spreads and each maturity's change come worked out, so a
        // trend is read off published figures rather than the model's own subtraction
        // (2026-10-17 evaluation; on 2026-10-18 two agents put one move at +53bp and +8bp).
        return {
          latest: data.latest, monthAgo: data.monthAgo, yearStart: data.yearStart,
          spread2s10s: data.spread2s10s, spread3m10y: data.spread3m10y, shape: data.shape,
          monthAgoSpreads: data.monthAgoSpreads, yearStartSpreads: data.yearStartSpreads,
          changeSinceMonthAgo: data.changeSinceMonthAgo, changeSinceYearStart: data.changeSinceYearStart,
          expectedInflation: data.expectedInflation,
          source: 'treasury.gov official daily par curve',
        }
      }
      case 'get_fx_rates': {
        const wanted = (input.currencies as string[] | undefined)?.map((c) => c.toUpperCase())
        const pick = (rates: Record<string, number>) =>
          wanted?.length ? Object.fromEntries(Object.entries(rates).filter(([k]) => wanted.includes(k))) : rates
        const official = (await get(`/live-data/fx-rates`)) as {
          ok?: boolean; error?: string; date?: string; rates?: Record<string, number>
        }
        const out: Record<string, unknown> = official.ok
          ? { officialDate: official.date, officialSource: 'ECB reference rates', officialRates: pick(official.rates ?? {}) }
          : { officialError: official.error ?? 'official rates unavailable' }
        if (input.include_extended === true) {
          const ext = (await get(`/live-data/fx-rates-extended`)) as {
            ok?: boolean; error?: string; date?: string; rates?: Record<string, number>
          }
          if (ext.ok) {
            out.extendedDate = ext.date
            out.extendedSource = 'community currency-api — NOT official; always attribute as community-sourced'
            out.extendedRates = pick(ext.rates ?? {})
          } else {
            out.extendedError = ext.error ?? 'extended rates unavailable'
          }
        }
        out.base = 'USD'
        // T-445: each catalog pair at the ECB's newest rate, already worked out, with its change.
        const ref = (await get(`/live-data/fx-reference-pairs`)) as {
          ok?: boolean; error?: string; date?: string
          pairs?: Record<string, { date: string; rate: number; previousDate?: string; changePct?: number }>
        }
        if (ref.ok) {
          const wantedPair = (code: string, name: string) => !wanted?.length || name.split('/').some((c) => wanted.includes(c)) || wanted.includes(code)
          out.pairRates = CURRENCY_CATALOG.filter((c) => ref.pairs?.[c.slug] && wantedPair(c.symbol, c.name)).map((c) => ({
            pair: c.name, symbol: c.symbol, ...ref.pairs![c.slug],
          }))
          out.pairRatesNote = `${ECB_RATE_NOTE} changePct is since the ECB's previous working day (previousDate). A pair without the euro is worked out from the two euro rates of the same day.`
        } else {
          out.pairRatesError = ref.error ?? 'ECB pair rates unavailable'
        }
        return out
      }
      case 'get_economic_calendar': {
        const days = Math.min(Math.max(Math.round(Number(input.days ?? 60)) || 60, 1), 400)
        const fomc = getFomcCalendarProvenance()
        const rel = getReleaseDatesProvenance()
        return {
          days,
          events: macroCalendarAhead(days),
          scheduleThrough: { fedMeetings: fomc.through, releases: rel.through },
          checkedOn: { fedMeetings: fomc.verifiedAt, releases: rel.verifiedAt },
          sources: {
            fedMeetings: `Federal Reserve Board, ${FOMC_SOURCE_URL}`,
            releases: `U.S. Bureau of Labor Statistics (CPI, jobs report) and U.S. Bureau of Economic Analysis (GDP, PCE), ${RELEASE_AGENCIES.bls.scheduleUrls.join(', ')}, ${RELEASE_AGENCIES.bea.scheduleUrls.join(', ')}`,
          },
          note: 'Copied by hand from each publisher; times are as the schedules list them, with no time zone written. A Fed date stays tentative until the meeting before it. Past scheduleThrough, no date means none published yet, not none planned.',
        }
      }
      case 'get_macro_news': {
        const limit = Math.min(Number(input.limit ?? 10) || 10, 25)
        const p = new URLSearchParams({ limit: String(limit) })
        if (input.pillar) p.set('pillar', String(input.pillar))
        const data = (await get(`/live-data/macro-news?${p.toString()}`)) as {
          ok?: boolean
          articles?: { title: string; url: string; source: string; publishedAt: string; summary: string; sentiment: string; pillar: string; related: { label: string }[] }[]
        }
        const failure = routeFailed(data)
        if (failure) return { error: `macro news feeds unavailable: ${failure}` }
        const articles = (data.articles ?? []).slice(0, limit).map((a) => ({
          title: a.title, source: a.source, publishedAt: a.publishedAt,
          sentiment: a.sentiment, pillar: a.pillar,
          relatedInstruments: a.related.map((r) => r.label),
          summary: a.summary.length > 200 ? `${a.summary.slice(0, 200)}…` : a.summary,
          url: a.url,
        }))
        return { count: articles.length, articles }
      }
      default:
        return { error: `Unknown tool: ${name}` }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'tool execution failed' }
  }
}
