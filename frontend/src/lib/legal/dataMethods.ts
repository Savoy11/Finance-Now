import { STAKING_PROVIDERS, STAKING_DATA_LAST_VERIFIED } from '@/lib/data/stakingProviders'
import { FALLBACK_STALE_AFTER_DAYS } from '@/lib/server/stakingRates'
import { DISCOVERY_APY_MAX } from '@/lib/data/discoveryApy'
import { FUND_CATALOG, FUND_FEES_LAST_VERIFIED, YIELD_CHECK_AFTER_DAYS, YIELD_KIND_NAMES, YIELD_SHOWN_FOR_DAYS } from '@/lib/data/fundCatalog'
import { META_AS_OF, MONITORED_STABLECOINS } from '@/lib/data/stablecoinMeta'
import { COST_BENCHMARK_ER_PCT, COST_HORIZON_YEARS, COST_RETURN_PCT, PER_WHAT_IF_USD } from '@/lib/data/portfolioCosts'
import { YEARLY_AFTER_DAYS } from '@/lib/data/trackedPortfolioViews'
import { BOND_PROFILE_MIN_PCT, ISSUER_KIND_LABELS, MATURITY_BUCKETS } from '@/lib/utils/fundExposure'
import { EARNINGS_LOOK_AHEAD_DAYS, EARNINGS_SOON_DAYS } from '@/lib/data/earningsCalendar'

/**
 * "How our figures are worked out" (/about/data-methods, D163): the rules behind the figures
 * the app shows, for its readers. Owner, 2026-10-25: "I want these types of decision recorded
 * in the methodology page so users know how these figures are computed."
 *
 * Every count, name and date here is read from the code that applies the rule, so the page
 * cannot say one thing while the app does another; `dataMethods.test.ts` holds the rest. When a
 * decision changes how a figure is worked out, change its section here in the same pull request.
 */
export interface MethodSection {
  /** Anchor on the page. */
  id: string
  title: string
  /** When the rule as written was decided, if one decision dates it. */
  decided?: string
  paragraphs: string[]
  /** Short labelled lines, e.g. the kinds of yield. */
  items?: Array<{ term: string; text: string }>
}

const liveProviders = STAKING_PROVIDERS.filter((p) => !p.defunct).length

/** "Cities and states" → "cities and states", but "US Treasury" stays. */
const inSentence = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label[0].toLowerCase() + label.slice(1))
const listed = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

export const DATA_METHODS: readonly MethodSection[] = [
  {
    id: 'staking-terms',
    title: 'Staking minimums and lock-ups',
    decided: '2026-10-25',
    paragraphs: [
      'A minimum is the smallest amount a provider accepts. A lock-up is how many days a stake stays locked before you can withdraw it, and 0 means you can leave at once.',
      'For liquid staking, where you receive a token such as stETH that can be sold at any time, the lock-up is shown as 0 days. Where the provider’s own page gives a wait to withdraw through the provider instead, that wait is in the note beside the figure.',
      'Where a provider gives a range, the longest figure is shown and the range is quoted in the note.',
      `These figures are kept by hand for ${liveProviders} providers, from each provider’s own pages or, where those cannot be read, from search results quoting them, the provider’s public code repository, or the provider’s own contract settings read from its blockchain. The staking page says when the list was last checked as a whole (${STAKING_DATA_LAST_VERIFIED}). No provider is given a risk score or grade.`,
      'A staking total or an audit count is shown only where the provider itself publishes it. Where it publishes none, no figure is shown.',
      'A minimum the provider states only in dollars is shown in dollars, never converted into coins.',
    ],
  },
  {
    id: 'staking-rates',
    title: 'Staking rates',
    decided: '2026-10-26',
    paragraphs: [
      'A rate read from a provider’s or a data service’s live source is marked live. Every other rate is a stored estimate and is marked as an estimate, not a current reading.',
      `The Live Pools tab lists staking pools read from data services. A pool whose reported yield is above ${DISCOVERY_APY_MAX}% is left out, because no staking pool pays that much: it is a broken reading, or a yield paid in reward tokens. The tab says how many it left out and which.`,
      'A live source that reports a rate of 0%, or an implausibly high one, is treated as giving no reading: the stored estimate is shown instead, marked as an estimate, never a live 0%. A source can report 0 because it has stopped updating, not only because the rate is 0.',
      `Stored estimates that were measured from live sources carry the date they were measured, and are withheld once they are more than ${FALLBACK_STALE_AFTER_DAYS} days old; the rate is then shown as a dash.`,
      'Where a live source stops giving a usable reading for good, its stored figure can no longer be measured again. It is then kept as an undated estimate, marked as an estimate like the others, rather than given a new date it was not read on.',
    ],
  },
  {
    id: 'fund-yields',
    title: 'Fund yields',
    decided: '2026-10-25',
    paragraphs: [
      'Yields change often, so every fund’s yield has a link beside it to the fund’s own page, which has the current figure. To see a fund’s current yield, follow that link.',
      'A yield is shown here only where the fund’s own website allows its figures to be read and shown, and only as read from that page, with the date the page gave. It may have changed since that date. Where the website does not allow it, or the yield has not been read yet, no figure is shown, only the link.',
      `Each shown yield is re-read once a quarter: it falls due ${YIELD_CHECK_AFTER_DAYS} days after its date. If it has not been re-read ${YIELD_SHOWN_FOR_DAYS} days after its date, it is no longer shown, and the link remains.`,
      'A shown yield is one of three kinds, and each is labelled as what it is, never as another:',
    ],
    items: [
      { term: YIELD_KIND_NAMES.trailing.label, text: 'income the fund paid out over the past 12 months, as a percent of its price.' },
      { term: YIELD_KIND_NAMES.sec.label, text: 'what the fund’s holdings earned over the last 30 days, after fees, as a yearly rate. For a bond fund it can differ from the 12-month figure by a point or more.' },
      { term: YIELD_KIND_NAMES.effective.label, text: 'the figure a fund’s own page gives under that name, used where the page gives no SEC yield.' },
    ],
  },
  {
    id: 'fund-assets',
    title: 'Fund net assets',
    paragraphs: [
      'For an ETF, the figure is that fund’s own net assets; for a Vanguard ETF, the ETF share class’s own figure. For a mutual fund, it is the whole fund, every share class together, since one share class holds only part of it.',
      'A figure taken from the fund’s SEC filing shows the filing’s date. A few trusts report only the fair value of what they hold; those are labelled “holdings at fair value”, which is close to net assets and not the same figure. A figure with no date is approximate and marked ≈.',
      'For a fund outside the catalog, its size and the trust that filed for it come from the SEC’s quarterly N-PORT data set, which covers about 25,000 fund tickers. That data set reports every share class of a fund together, so the figure is labelled “fund net assets, all share classes” and can be several times one ETF’s own size. It shows when it was built, and may be months old.',
    ],
  },
  {
    id: 'stock-pe-yield',
    title: 'Stock P/E and dividend yield',
    decided: '2026-10-25',
    paragraphs: [
      'A stock’s P/E is its price divided by its earnings per share for its latest fiscal year (diluted, or basic where the company reports no diluted figure). Its dividend yield is the dividends per share for that same fiscal year divided by its price. Both per-share figures come from the company’s own SEC annual report, and each figure shows the fiscal year it is for.',
      'The price is always the live quote. With no live quote, the P/E and yield show a dash and say why: no stored price is used.',
      'If a company’s share count has changed by a split’s worth since that fiscal year, as after a stock split, its per-share figures for that year are in the old shares and the price is in the new. Its P/E and yield then show a dash until its next annual report, and are never adjusted by a guessed ratio.',
      'A dividend counts only when it is for the same fiscal year as the earnings, so a dividend a company has since stopped is never shown as a current yield. A company that lost money shows “Loss” for its P/E. Where the SEC data has no usable figure, the page shows a dash, never a guess. A per-share figure above $100,000 is taken for an error in the filing’s data and not used: the largest real ones, Berkshire Hathaway’s class A shares, earn tens of thousands of dollars each. A link beside each figure opens the company’s SEC filings.',
    ],
  },
  {
    id: 'stock-market-cap-beta',
    title: 'Stock market cap and beta',
    decided: '2026-10-25',
    paragraphs: [
      'A stock’s market cap is its shares outstanding, from the cover page of the company’s latest SEC filing, multiplied by the live price. The figure shows the date of the share count. Without a live price there is no market cap. A company with more than one class of stock reports a share count for each class, so no single count is available and its market cap shows a dash.',
      'A stock’s beta is worked out on its own page from one year of daily closing prices, against the SPDR S&P 500 ETF (SPY): how much the stock’s daily returns have moved with the market’s. It is a measure of the past year, not a forecast. Where the only prices available are not adjusted for stock splits, no beta is worked out, since a split would read as a single day’s move. It is not shown in lists or screens, which would need a year of prices for every stock at once.',
    ],
  },
  {
    id: 'earnings-dates',
    title: 'Earnings dates',
    decided: '2026-11-08',
    paragraphs: [
      'A company’s earnings date comes from Financial Modeling Prep’s earnings calendar first. Alpha Vantage’s earnings calendar, read once a day and covering the next three months, fills in a company Financial Modeling Prep does not list, and every company when Financial Modeling Prep is not available. Where both list a company, Financial Modeling Prep’s date is the one shown, so one company never shows two dates. Each date names the calendar it came from.',
      `Every date is expected, not confirmed: companies often confirm the date late, and can move it. “Today” is counted in New York, where the US market is. A stock’s page shows its first expected report in the next ${EARNINGS_LOOK_AHEAD_DAYS} days, or says none is listed; a watchlist marks a stock whose report falls in the next ${EARNINGS_SOON_DAYS} days.`,
    ],
  },
  {
    id: 'stock-list',
    title: 'Which stocks the Stock Registry lists',
    decided: '2026-11-07',
    paragraphs: [
      'The Stock Registry has two lists. The curated list is 79 large US companies, each with its sector. “Every NYSE & Nasdaq stock” is every common stock that the SEC’s own list of companies, tickers and exchanges names on the New York Stock Exchange or Nasdaq. It needs no data subscription and is refreshed daily.',
      'That list leaves out tickers listed on other exchanges or traded over the counter; preferred shares, warrants, units and rights, which are told apart by the form of their ticker; and funds and exchange-traded trusts, meaning tickers the app already knows as funds and names that say ETF, ETN or Fund. A few closed-end funds or trusts that file reports the way companies do may remain. The page says how many tickers it left out, and why.',
      'Earnings and dividends per share, and shares outstanding, come from each company’s SEC filings by the same rules as P/E and yield above, and the list can be screened and sorted on them across every stock. Price, market cap, P/E and yield need a live quote, so they are worked out only for the 50 stocks on screen, and the list is never sorted or screened on them: a sort that had seen fifty stocks would order them as though it had seen every one. Where a company lists more than one class of shares, its per-share figures are the company’s own and may be stated for one class only, and the row says so.',
      'A sector is known only for the 79 curated stocks. The SEC records each company’s industry, but reading it takes one request per company.',
    ],
  },
  {
    id: 'fund-costs',
    title: 'Fund costs',
    paragraphs: [
      `Expense ratios for all ${FUND_CATALOG.length} funds are checked against each fund’s own SEC filings; the oldest check still standing is from ${FUND_FEES_LAST_VERIFIED}. Where the issuer waives part of the fee, the figure is the fee paid today.`,
      'A sales charge (load) is included in the Fee Drag projection only once its rate is verified from the prospectus. An unverified load is named in words and left out of the figures, which then understate the cost, and the page says so.',
      `A portfolio's costs card adds these expense ratios up across the funds it holds: the expense ratio weighted by value, what it costs in dollars a year, and what it costs over ${COST_HORIZON_YEARS} years against a ${COST_BENCHMARK_ER_PCT}% index fund at ${COST_RETURN_PCT}% a year before fees, worked out as the fund pages work it out. On a tracked portfolio the dollars are the funds' values at live prices, and a fund with no live price is left out and named; a front-end sales charge is paid once at purchase, so on funds already held it is not counted as a cost still to come, and the card says so. On a what-if portfolio, which stands for a purchase, verified sales charges are included. A what-if portfolio has no real dollars, so its costs are shown per ${PER_WHAT_IF_USD.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} invested in its mix. Stocks and coins held directly carry no expense ratio. The card shows figures only: it sets no threshold and gives no warning.`,
    ],
  },
  {
    id: 'bond-duration',
    title: 'Bond fund duration',
    paragraphs: [
      'A bond fund’s duration comes from its own quarterly holdings filing (Form N-PORT): the sum of its holdings’ dollar value of one basis point (DV01), as a positive number, divided by the fund’s net assets, times 10,000. A fund whose filing has no interest-rate section shows no duration.',
    ],
  },
  {
    id: 'fund-countries',
    title: 'Where a fund invests',
    decided: '2026-11-08',
    paragraphs: [
      'A fund’s countries and currencies come from its own quarterly holdings filing (Form N-PORT), the same filing as its holdings and its stock, bond and cash mix. Each holding’s share of the fund’s net assets is added up under the country the fund reports for the company or government that issued it, and under the currency the holding is bought in. A country is where the issuer is based, not where a company sells, and it can differ from the currency. A holding whose filing leaves a field blank, or writes “N/A” as swaps do, is left out rather than guessed, and each split says how much of the fund it covers. Nothing is rescaled to 100%.',
      `For a fund whose bonds are at least ${BOND_PROFILE_MIN_PCT}% of its net assets, the line at which the form itself asks for interest-rate risk, the bonds are also split by the kind of borrower the filing names (${listed(Object.values(ISSUER_KIND_LABELS).map(inSentence))}) and by when they are repaid, counted in calendar years from the filing’s report date: ${listed(MATURITY_BUCKETS.map((b) => b.label.toLowerCase()))}. A bond with no repayment date, or one already past it, is left out of that split. The filing gives no credit ratings, so there is no split by bond quality.`,
      'Across a portfolio, on the Look-through tab and on a tracked portfolio, each fund’s country split is weighted by the fund’s share of the portfolio and added up. Stocks and coins held directly are left out and their share named, since the app records no home country for them outside a fund’s filing; so is a fund whose own filing is not available.',
      'A fund that files no N-PORT, such as a unit investment trust like SPY, shows none of this.',
    ],
  },
  {
    id: 'crypto-charts',
    title: 'Crypto charts and the crypto scanner',
    decided: '2026-10-13',
    paragraphs: [
      'Charts use price candles (open, high, low, close) where they can. Where candles are missing for a range, or come only as 4-day candles, the chart uses daily closing prices instead, from DefiLlama, with Coin Metrics as a backup.',
      'On closing prices the chart draws a line and offers only the indicators that need nothing but a close. Patterns, support and resistance, key levels and the signal summary need highs and lows, so they are left out, and the page says so.',
      'The crypto scanner and the multi-timeframe view read closing prices for every coin, so they run only the setups and signals that a close can feed. Stablecoins are not scanned, since a price held at a peg makes those setups meaningless.',
    ],
  },
  {
    id: 'stablecoin-reserves',
    title: 'Stablecoin reserves',
    decided: '2026-11-05',
    paragraphs: [
      `The Reserve Monitor follows ${MONITORED_STABLECOINS.length} stablecoins. Each coin’s supply in circulation is read live from DefiLlama. Each coin is matched by its own identifier, never by its ticker, because several coins share a ticker; a coin that cannot be matched is named as not found rather than quietly left out.`,
      `The auditor, the date of the latest report, the backing ratio and the reserve mix come from each issuer’s own reports, kept by hand and last checked as a whole on ${META_AS_OF}. Where the issuer’s report itself could not be read, the figure is taken from search results, news reports or stablecoin trackers quoting that report, and carries the date of the report it quotes. These figures are not live.`,
      'A backing ratio is the assets held against the coins issued. Where no current source confirms one, none is shown, and the coin reads “not disclosed”. No stablecoin is given a risk score or grade.',
      'The legacy Frax Dollar (FRAX) and Frax USD (frxUSD) are separate coins. The legacy coin has no $1 guarantee and publishes no reserve report, so it shows none. The alert bell checks frxUSD against $1, not the legacy coin.',
      'A coin’s supply change over 1, 7 and 30 days is its circulating supply now against DefiLlama’s figure for a day, a week and a month earlier, as a percent. A fall means more coins were redeemed than issued. It is shown as a figure only: no alert rings on a fall. The split by blockchain is each chain’s share of the coin’s supply summed across its chains, which can differ slightly from the headline total.',
    ],
  },
  {
    id: 'coin-supply',
    title: 'Coin supply and price history',
    decided: '2026-11-07',
    paragraphs: [
      'A coin’s page shows its circulating, total and maximum supply, its fully diluted value, its price change over 7 and 30 days, and how far below its all-time high it trades, all as CoinGecko reports them. A coin with no maximum in CoinGecko’s data shows “None listed”.',
      'The share of the maximum supply circulating is worked out here: circulating supply divided by maximum supply. Where CoinGecko’s circulating figure is above its maximum, the two disagree and no share is shown.',
    ],
  },
  {
    id: 'treasury-yields',
    title: 'Treasury yields',
    decided: '2026-11-07',
    paragraphs: [
      'Treasury yields come from the US Treasury’s official daily par yield curve. It is published once a day, so these yields show no change during the day.',
      'Their history is the same curve’s, one reading a day; over five or ten years each week’s last reading is drawn. Because there is only one figure a day, the technical-analysis page draws a yield as a line and offers only what reads closing figures, and the scanner counts only those readings.',
      'Expected inflation at a maturity is the ordinary par yield minus the Treasury’s inflation-protected (real) par yield at the same maturity, both from the same day. The Treasury publishes real yields at 5, 7, 10, 20 and 30 years, so expected inflation is shown only at those. It is what the bond market prices in, not a forecast of ours.',
    ],
  },
  {
    id: 'currency-pairs',
    title: 'Currency pairs',
    decided: '2026-11-07',
    paragraphs: [
      'A currency pair shows a live quote where our quote source has one. Where it has none, it shows the European Central Bank’s euro reference rate for the day, marked “ECB” with its date. The Bank publishes these once a working day, around 16:00 Central European Time, for information only; they are not a price anyone can deal at.',
      'The Bank publishes every currency against the euro. A pair without the euro is worked out from two of those rates on the same day: one unit of the first currency, in the second, is the second currency per euro divided by the first currency per euro. So USD/JPY is the yen per euro divided by the dollar per euro. The change shown beside an ECB rate is since the Bank’s previous working day.',
      'Each pair’s chart is the same daily rates; over five or ten years each week’s last rate is drawn. Because there is only one figure a day, the technical-analysis page draws a pair as a line and offers only what reads closing figures, and the scanner counts only those readings. The Dollar Index is ICE’s index, which the Bank does not publish, so it has no such rate.',
    ],
  },
  {
    id: 'tracked-gains-income',
    title: 'Tracked portfolios: gains and income',
    decided: '2026-11-07',
    paragraphs: [
      'Gains on a tracked portfolio are worked out first in, first out: a sale uses up the oldest units first. They are plain differences between what was paid and what was received, and no tax rule is applied to them.',
      'Income received is shown apart from the gains. Cash income, such as a dividend, interest or a fund distribution, is the amount you enter; no units move. Units received as income, such as a staking reward or a dividend paid in shares, count as income at their value on the day, as you enter it, and that value is also what they cost. So a later sale of those units shows only what was gained after they arrived.',
      '“In the last 12 months” counts income received from the same date a year earlier up to today. A file imported from a broker is read the same way: a dividend, interest or distribution row is cash income from the file’s amount, and a staking reward row is units received at the file’s price that day.',
    ],
  },
  {
    id: 'tracked-return-mix',
    title: 'Tracked portfolios: return, mix and drift',
    decided: '2026-11-07',
    paragraphs: [
      'The return on a tracked portfolio is money-weighted. It is the yearly rate at which every amount you put in, from the day you put it in, would grow to what you took out plus what you hold now. Money in is each purchase and each transfer in, a starting position included, at what it cost with its fee. Money out is each sale, after its fee, and each cash income payment. Units received as income and splits move no money, and a cancelled trade is left out.',
      `It is shown as a yearly rate only once the first money put in is ${YEARLY_AFTER_DAYS} days old. Before that, or when the starting position has no date, the plain total return is shown: what you hold now plus what you took out, less what you put in, as a share of what you put in. No figure is shown while any holding has no live price, since a holding is never valued at its cost, or after a transfer out, since the app does not know what the units moved out were worth.`,
      'How a tracked portfolio’s money splits, and what its funds hold, are shares of the live value of the holdings that have a live price. Any holding without one is named and left out. The Portfolio Builder’s drift check reads a tracked portfolio the same way, each holding by its share of the live value; it states how much was left out, measured by what those holdings cost. The Daily Brief is sent only the names of the holdings, never how much is held or what it cost.',
    ],
  },
  {
    id: 'rechecks',
    title: 'How figures are re-checked',
    decided: '2026-10-25',
    paragraphs: [
      'Figures kept by hand are re-checked on a schedule. At the start of each quarter, a report lists every such figure with the date it was read and when it is due: each shown fund yield, each fund’s net assets, and every hand-kept table, such as staking terms. It also lists every stock whose SEC figures have not moved to a newer annual report when one is due, or that have none.',
      'A figure is re-read from its own source, and a change is applied only after it has been checked. Where the source itself cannot be read and the figure is taken from another site quoting it, that table’s section above says so, as the staking and stablecoin sections do. Each table’s page says when it was last checked.',
    ],
  },
  {
    id: 'missing-prices',
    title: 'When there is no live price',
    paragraphs: [
      'When no live quote is available for a stock, the page shows a dash, as it does for commodities, currencies and rates. For a fund it shows a stored reference price tagged “ref”. Figures that need a live price say so instead of showing a number. No price is ever made up to fill a gap.',
    ],
  },
]
