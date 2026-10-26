import { STAKING_PROVIDERS, STAKING_DATA_LAST_VERIFIED } from '@/lib/data/stakingProviders'
import { FALLBACK_STALE_AFTER_DAYS } from '@/lib/server/stakingRates'
import { FUND_CATALOG, FUND_FEES_LAST_VERIFIED, YIELD_CHECK_AFTER_DAYS, YIELD_KIND_NAMES, YIELD_SHOWN_FOR_DAYS } from '@/lib/data/fundCatalog'

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

export const DATA_METHODS: readonly MethodSection[] = [
  {
    id: 'staking-terms',
    title: 'Staking minimums and lock-ups',
    decided: '2026-10-25',
    paragraphs: [
      'A minimum is the smallest amount a provider accepts. A lock-up is how many days a stake stays locked before you can withdraw it, and 0 means you can leave at once.',
      'For liquid staking, where you receive a token such as stETH that can be sold at any time, the lock-up is shown as 0 days. Where the provider’s own page gives a wait to withdraw through the provider instead, that wait is in the note beside the figure.',
      'Where a provider gives a range, the longest figure is shown and the range is quoted in the note.',
      `These figures are kept by hand from each provider’s own pages, for ${liveProviders} providers. The staking page says when the list was last checked as a whole (${STAKING_DATA_LAST_VERIFIED}). No provider is given a risk score or grade.`,
    ],
  },
  {
    id: 'staking-rates',
    title: 'Staking rates',
    decided: '2026-10-25',
    paragraphs: [
      'A rate read from a provider’s or a data service’s live source is marked live. Every other rate is a stored estimate and is marked as an estimate, not a current reading.',
      'A live source that reports a rate of 0%, or an implausibly high one, is treated as giving no reading: the stored estimate is shown instead, marked as an estimate, never a live 0%. A source can report 0 because it has stopped updating, not only because the rate is 0.',
      `Stored estimates that were measured from live sources carry the date they were measured, and are withheld once they are more than ${FALLBACK_STALE_AFTER_DAYS} days old; the rate is then shown as a dash.`,
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
      'A dividend counts only when it is for the same fiscal year as the earnings, so a dividend a company has since stopped is never shown as a current yield. A company that lost money shows “Loss” for its P/E. Where the SEC data has no usable figure, the page shows a dash, never a guess. A link beside each figure opens the company’s SEC filings.',
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
    id: 'fund-costs',
    title: 'Fund costs',
    paragraphs: [
      `Expense ratios for all ${FUND_CATALOG.length} funds are checked against each fund’s own SEC filings; the oldest check still standing is from ${FUND_FEES_LAST_VERIFIED}. Where the issuer waives part of the fee, the figure is the fee paid today.`,
      'A sales charge (load) is included in the Fee Drag projection only once its rate is verified from the prospectus. An unverified load is named in words and left out of the figures, which then understate the cost, and the page says so.',
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
    id: 'treasury-yields',
    title: 'Treasury yields',
    paragraphs: [
      'Treasury yields come from the US Treasury’s official daily par yield curve. It is published once a day, so these yields show no change during the day.',
    ],
  },
  {
    id: 'rechecks',
    title: 'How figures are re-checked',
    decided: '2026-10-25',
    paragraphs: [
      'Figures kept by hand are re-checked on a schedule. At the start of each quarter, a report lists every such figure with the date it was read and when it is due: each shown fund yield, each fund’s net assets, and every hand-kept table, such as staking terms. It also lists every stock whose SEC figures have not moved to a newer annual report when one is due, or that have none.',
      'A figure is re-read from its own source, never from another site’s copy of it, and a change is applied only after it has been checked. Each table’s page says when it was last checked.',
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
