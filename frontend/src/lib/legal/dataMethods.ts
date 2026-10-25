import { STAKING_PROVIDERS, STAKING_DATA_LAST_VERIFIED } from '@/lib/data/stakingProviders'
import { FUND_CATALOG, FUND_FEES_LAST_VERIFIED, YIELD_KIND_NAMES } from '@/lib/data/fundCatalog'

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
    paragraphs: [
      'A rate read from a provider’s or a data service’s live source is marked live. Every other rate is a stored estimate and is marked as an estimate, not a current reading.',
    ],
  },
  {
    id: 'fund-yields',
    title: 'Fund yields',
    decided: '2026-10-24',
    paragraphs: [
      'A fund’s yield is one of three kinds, and each is labelled as what it is, never as another:',
      'A yield read from the fund’s own page shows the date the page gave. A yield with no date is approximate, compiled by hand, and marked ≈.',
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
    id: 'missing-prices',
    title: 'When there is no live price',
    paragraphs: [
      'When no live quote is available for a stock or fund, the page shows a stored reference price tagged “ref”. Figures that need a live price say so instead of showing a number. Commodities, currencies and rates with no quote show a dash. No price is ever made up to fill a gap.',
    ],
  },
]
