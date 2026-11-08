import { COMMODITY_CATALOG } from './commodityCatalog'
import { CURRENCY_CATALOG } from './currencyCatalog'

// ─── Which macro instruments a news story names ──────────────────────────────
//
// /live-data/macro-news tags each story with the catalog instruments its text names, linked to
// their pages. The rules lived inside that route until T-456 (D211), when each instrument's own
// page began showing the stories that name it: the page needs the same rules to tell "no story
// names this instrument right now" from "the feed has no way to recognise this instrument".

export interface MacroMatcher { pattern: RegExp; label: string; href: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const MACRO_NEWS_MATCHERS: readonly MacroMatcher[] = [
  // Commodities from the catalog (name match, plus common aliases)
  ...COMMODITY_CATALOG.map((c) => ({
    pattern: new RegExp(`\\b${escape(c.name)}\\b`, 'i'),
    label: c.name,
    href: `/macro/commodities/${c.slug}`,
  })),
  { pattern: /\b(crude|oil price|opec|barrel)\b/i, label: 'WTI Crude Oil', href: '/macro/commodities/wti-crude' },
  { pattern: /\bbrent\b/i,                         label: 'Brent Crude Oil', href: '/macro/commodities/brent-crude' },
  // Currencies: the common names first, then every pair by its written form ("AUD/USD").
  { pattern: /\b(eur\/usd|euro)\b/i,               label: 'EUR/USD', href: '/macro/currencies/eur-usd' },
  { pattern: /\b(gbp\/usd|sterling|pound|cable)\b/i, label: 'GBP/USD', href: '/macro/currencies/gbp-usd' },
  { pattern: /\b(usd\/jpy|yen)\b/i,                label: 'USD/JPY', href: '/macro/currencies/usd-jpy' },
  { pattern: /\b(dollar index|dxy)\b/i,            label: 'Dollar Index', href: '/macro/currencies/dollar-index' },
  { pattern: /\byuan|renminbi|usd\/cny\b/i,        label: 'USD/CNY', href: '/macro/currencies/usd-cny' },
  ...CURRENCY_CATALOG.filter((c) => c.name.includes('/')).map((c) => ({
    pattern: new RegExp(`\\b${escape(c.name)}\\b`, 'i'),
    label: c.name,
    href: `/macro/currencies/${c.slug}`,
  })),
  // Bonds & rates
  // The 5-year only next to a bond word: "five-year" alone is more often a "5-year high" in gold.
  { pattern: /\b(5-year|5 year|five-year)\s+(treasury|treasuries|yield|yields|note|notes)\b/i, label: '5-Year Yield', href: '/macro/rates/5-year-yield' },
  { pattern: /\b(10-year|10 year|ten-year)\b/i,    label: '10-Year Yield', href: '/macro/rates/10-year-yield' },
  { pattern: /\b(30-year|30 year|long bond)\b/i,   label: '30-Year Yield', href: '/macro/rates/30-year-yield' },
  { pattern: /\b(t-bill|3-month|13-week)\b/i,      label: '13-Week Yield', href: '/macro/rates/13-week-yield' },
]

/** At most this many instruments are tagged on one story. */
export const MAX_RELATED = 4

/** The instruments a story's text names, each once, in matcher order. */
export function detectMacroRelated(text: string): Array<{ label: string; href: string }> {
  const seen = new Set<string>()
  const out: Array<{ label: string; href: string }> = []
  for (const m of MACRO_NEWS_MATCHERS) {
    if (out.length >= MAX_RELATED) break
    if (!seen.has(m.href) && m.pattern.test(text)) {
      seen.add(m.href)
      out.push({ label: m.label, href: m.href })
    }
  }
  return out
}

/** Whether the feed can recognise this page's instrument by name at all. */
export function newsCanName(href: string): boolean {
  return MACRO_NEWS_MATCHERS.some((m) => m.href === href)
}
