import {
  INSTRUMENT_BY_KEY, SEC_PREFIX, formatInstrumentQuote, type Instrument,
} from '@/lib/data/instruments'
import { COMMODITY_CATALOG, THINLY_TRADED_COMMODITIES } from '@/lib/data/commodityCatalog'
import { CURRENCY_CATALOG } from '@/lib/data/currencyCatalog'
import { RATES_CATALOG } from '@/lib/data/ratesCatalog'
import { parLabelFor } from '@/lib/data/yieldHistory'

// The macro instrument universe, shared by the module's own pages.
//
// Extracted from the TA page on 2026-08-19 when the scanner moved to its own
// route (short-list item 6/7) — both pages read the same list, and a second
// copy would drift the moment a catalog gained an entry. Module-owned on
// purpose: it lives under /macro rather than in lib/, because nothing outside
// this module should be reading it (boundary rule 1).

export type MacroGroup = 'Commodities' | 'Currencies' | 'Bonds & Rates'

export interface MacroInstrument {
  symbol: string
  name: string
  group: MacroGroup
  detailPath: string
  instrument: Instrument | undefined
  /**
   * Deep enough for indicator output to mean anything. Thin contracts still
   * chart — a user who wants cocoa gets cocoa — but they are kept out of the
   * scanner, where a stale or gappy series would sit in a ranked table next to
   * genuinely liquid ones and read as comparable.
   */
  liquid: boolean
  /**
   * A Treasury yield read off the official par curve (D3). No provider serves
   * these symbols any history, so a candle request for one can never succeed.
   * Since T-446 (D202) its history comes from the curve itself
   * (/live-data/treasury-yield-history): one figure a day, so only what reads
   * closes alone is drawn or counted from it.
   */
  curveYield: boolean
  /** The par curve maturity a curve yield reads ('3M', '5Y'…); null for everything else. */
  curveMaturity: string | null
}

// The thin-market exclusion set lives with the catalog (one source of truth —
// the commodity risk profile reads the same set). Their futures still quote,
// so they remain fully chartable; they are simply not ranked.

export const MACRO_INSTRUMENTS: MacroInstrument[] = [
  ...COMMODITY_CATALOG.map((c) => ({
    symbol: c.symbol,
    name: c.name,
    group: 'Commodities' as const,
    detailPath: `/macro/commodities/${c.slug}`,
    instrument: INSTRUMENT_BY_KEY[`${SEC_PREFIX}${c.symbol}`],
    liquid: !THINLY_TRADED_COMMODITIES.has(c.symbol),
    curveYield: false,
    curveMaturity: null,
  })),
  ...CURRENCY_CATALOG.map((c) => ({
    symbol: c.symbol,
    name: c.name,
    group: 'Currencies' as const,
    detailPath: `/macro/currencies/${c.slug}`,
    instrument: INSTRUMENT_BY_KEY[`${SEC_PREFIX}${c.symbol}`],
    // Majors and the index are deep; EM pairs and crosses quote thinly through
    // the provider and gap over local holidays.
    liquid: c.category === 'major' || c.category === 'index',
    curveYield: false,
    curveMaturity: null,
  })),
  ...RATES_CATALOG.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    group: 'Bonds & Rates' as const,
    detailPath: `/macro/rates/${r.slug}`,
    instrument: INSTRUMENT_BY_KEY[`${SEC_PREFIX}${r.symbol}`],
    liquid: true,
    curveYield: r.quoteBasis === 'pct',
    curveMaturity: r.quoteBasis === 'pct' ? parLabelFor(r.maturityYears) : null,
  })),
]

export const BY_SYMBOL = new Map(MACRO_INSTRUMENTS.map((m) => [m.symbol, m]))
export const GROUPS: MacroGroup[] = ['Commodities', 'Currencies', 'Bonds & Rates']

/**
 * Scanner universe — liquid only, and small enough to be one fetch per row.
 * The Treasury yields have no candle source (D3); they left the sweep on
 * 2026-10-24 (T-129 D) and came back with T-446, read from the official curve's
 * daily history instead of a keyed provider.
 */
export const SCANNER_INSTRUMENTS = MACRO_INSTRUMENTS.filter((m) => m.liquid && (!m.curveYield || m.curveMaturity !== null))
export const CURVE_YIELD_INSTRUMENTS = MACRO_INSTRUMENTS.filter((m) => m.curveYield)


/** Quote text honouring the instrument's own convention — never bare dollars. */
export function fmtLevel(entry: MacroInstrument | undefined, value: number | null | undefined): string {
  return formatInstrumentQuote(entry?.instrument, value) ?? '—'
}
