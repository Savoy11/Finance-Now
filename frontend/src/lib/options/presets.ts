/**
 * Common-structure presets for the Options Calculator and the Trade Risk Scorer (P2-O2).
 * Eleven more structures joined the first four on 2026-11-09 (T-061 on the calculator,
 * owner decision D216). Every preset stays at four legs or fewer, since the scorer's form
 * (switched off, D64) takes four. Since the code review of 2026-11-10 (D221) every strike
 * sits on the underlying's own grid, anchored at the money, and butterflies have equal wings.
 *
 * Presets prefill STRUCTURE — sides, types, and strikes derived from the
 * underlying price — and nothing else. Bid/ask, open interest and delta stay
 * empty because we do not have a chain feed (that is P2-O3, gated on the
 * P2-O1 data audit): prefililng a price we cannot source would be fabrication,
 * and the page tells the user to copy those numbers from their broker's chain.
 *
 * Pure functions, tested. The UI treats the output as a starting point;
 * everything remains editable.
 */

export type PresetId =
  | 'long-call' | 'long-put'
  | 'covered-call' | 'cash-secured-put' | 'protective-put' | 'collar'
  | 'bull-call-spread' | 'bear-put-spread' | 'bull-put-spread' | 'bear-call-spread'
  | 'long-straddle' | 'long-strangle'
  | 'iron-condor' | 'iron-butterfly' | 'long-call-butterfly'

/** A leg with structure filled in and market data left for the user. */
export interface PresetLeg {
  side: 'long' | 'short'
  type: 'call' | 'put'
  strike: number
}

export interface PresetResult {
  legs: PresetLeg[]
  /**
   * Worst-case loss in USD where the STRUCTURE alone determines it, before
   * premium (which we don't know): a cash-secured put can lose at most
   * strike × 100. Undefined where max loss depends on premium paid or on
   * stock owned alongside — guessing those would understate or overstate.
   */
  maxLossUsd?: number
  /**
   * The structure is written around 100 shares held per contract (a covered call,
   * a protective put, a collar). The calculator fills in 100 shares at the current
   * price, which the user then corrects to their own cost.
   */
  withShares?: boolean
  /** Shown beside the prefilled trade — what this structure assumes. */
  note: string
}

export interface PresetInfo {
  id: PresetId
  label: string
  description: string
}

export const PRESETS: PresetInfo[] = [
  {
    id: 'long-call',
    label: 'Long call',
    description: 'Buy a call at the money',
  },
  {
    id: 'long-put',
    label: 'Long put',
    description: 'Buy a put at the money',
  },
  {
    id: 'covered-call',
    label: 'Covered call',
    description: 'Short a call ~5% above spot against 100 shares you own',
  },
  {
    id: 'cash-secured-put',
    label: 'Cash-secured put',
    description: 'Short a put ~5% below spot, cash reserved to take assignment',
  },
  {
    id: 'protective-put',
    label: 'Protective put',
    description: 'Buy a put ~5% below spot against 100 shares you own',
  },
  {
    id: 'collar',
    label: 'Collar',
    description: 'Against 100 shares you own: buy a put ~5% below spot, sell a call ~5% above',
  },
  {
    id: 'bull-call-spread',
    label: 'Bull call spread',
    description: 'Long a call at the money, short one ~5% above — defined risk both ways',
  },
  {
    id: 'bear-put-spread',
    label: 'Bear put spread',
    description: 'Long a put at the money, short one ~5% below — defined risk both ways',
  },
  {
    id: 'bull-put-spread',
    label: 'Bull put spread',
    description: 'Short a put ~5% below spot, long one ~10% below — a credit, defined risk',
  },
  {
    id: 'bear-call-spread',
    label: 'Bear call spread',
    description: 'Short a call ~5% above spot, long one ~10% above — a credit, defined risk',
  },
  {
    id: 'long-straddle',
    label: 'Long straddle',
    description: 'Buy a call and a put at the money',
  },
  {
    id: 'long-strangle',
    label: 'Long strangle',
    description: 'Buy a put ~5% below spot and a call ~5% above',
  },
  {
    id: 'iron-condor',
    label: 'Iron condor',
    description: 'Short strangle ~5% out, long wings ~10% out — income if price stays in the range',
  },
  {
    id: 'iron-butterfly',
    label: 'Iron butterfly',
    description: 'Short a call and a put at the money, long wings ~5% out',
  },
  {
    id: 'long-call-butterfly',
    label: 'Call butterfly',
    description: 'Long a call ~5% below spot, short two at the money, long one ~5% above',
  },
]

/** The strike increment typical of US listings at this price. */
export function strikeIncrement(price: number): number {
  return price < 25 ? 0.5 : price < 100 ? 1 : price < 250 ? 5 : 10
}

/**
 * Round a computed strike onto the exchange's typical strike grid. Real
 * chains vary by underlying; these increments match common US listings well
 * enough for a prefill the user will adjust anyway.
 */
export function roundToStrike(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  const increment = strikeIncrement(price)
  return Math.round(price / increment) * increment
}

const cents = (x: number) => Math.round(x * 100) / 100

function tooLow(underlyingPrice: number, step: number): RangeError {
  return new RangeError(
    `At $${underlyingPrice.toFixed(2)} this structure would need a strike of $0 or less on a $${step.toFixed(2)} strike grid. `
    + 'Enter its strikes yourself.',
  )
}

/** The listed strike nearest the price, on the underlying's own grid, and never below one step. */
export function atTheMoney(underlyingPrice: number): number {
  const step = strikeIncrement(underlyingPrice)
  return cents(Math.max(Math.round(underlyingPrice / step) * step, step))
}

/**
 * Strikes for fractions of the underlying price, all on ONE grid, the underlying's own,
 * and anchored at the money (code review 2026-11-10, D221):
 *   • a fraction of 1 is the at-the-money strike;
 *   • one below 1 sits at least one step below the at-the-money strike, and further out
 *     than any fraction nearer 1; one above 1 likewise above.
 * So a strike meant below the price is below it, one meant at the money stays there, and a
 * spread's two strikes are never one. Rounding alone could do none of that at a low price:
 * at $5, 95% and 100% both round to $5.00. Throws when a strike would reach $0, rather than
 * pushing the structure up above the price, which the first version did.
 */
export function strikesAround(underlyingPrice: number, fractions: number[]): number[] {
  const step = strikeIncrement(underlyingPrice)
  const snap = (x: number) => Math.round(x / step) * step
  const atm = atTheMoney(underlyingPrice)
  const out: number[] = new Array(fractions.length)
  const indexed = fractions.map((f, i) => ({ f, i }))
  let prev = atm
  for (const { f, i } of indexed.filter((x) => x.f < 1).sort((a, b) => b.f - a.f)) {
    prev = Math.min(snap(underlyingPrice * f), prev - step)
    out[i] = prev
  }
  prev = atm
  for (const { f, i } of indexed.filter((x) => x.f > 1).sort((a, b) => a.f - b.f)) {
    prev = Math.max(snap(underlyingPrice * f), prev + step)
    out[i] = prev
  }
  for (const { f, i } of indexed) if (f === 1) out[i] = atm
  if (out.some((k) => !(k > 1e-9))) throw tooLow(underlyingPrice, step)
  return out.map(cents)
}

/**
 * A butterfly's three strikes: at the money, and one equal step out either side, about
 * `fraction` of the price away. Equal wings are what make a call butterfly's worst case the
 * net debit paid; rounding each strike on its own left them unequal at about a quarter of
 * all prices (code review 2026-11-10, D221).
 */
export function wingsAround(underlyingPrice: number, fraction: number): [number, number, number] {
  const step = strikeIncrement(underlyingPrice)
  const atm = atTheMoney(underlyingPrice)
  const width = Math.max(Math.round((underlyingPrice * fraction) / step) * step, step)
  if (!(atm - width > 1e-9)) throw tooLow(underlyingPrice, step)
  return [cents(atm - width), atm, cents(atm + width)]
}

/**
 * Build a preset's legs from the underlying price. Throws on a non-positive
 * price — a structure anchored to nothing is not a prefill, it's noise — and, with a
 * message to show, on a price too low for the structure's strikes to stay above $0.
 */
export function buildPreset(id: PresetId, underlyingPrice: number): PresetResult {
  if (!Number.isFinite(underlyingPrice) || underlyingPrice <= 0) {
    throw new RangeError('Preset needs a positive underlying price')
  }
  // One grid, anchored at the money (D221): see strikesAround and wingsAround.
  const at = (fraction: number) => strikesAround(underlyingPrice, [fraction])[0]
  const ladder = (...fractions: number[]) => strikesAround(underlyingPrice, fractions)

  switch (id) {
    case 'long-call':
      return {
        legs: [{ side: 'long', type: 'call', strike: at(1.0) }],
        // Max loss = the premium paid, which needs the price we don't prefill.
        note: 'Max loss is the premium paid.',
      }
    case 'long-put':
      return {
        legs: [{ side: 'long', type: 'put', strike: at(1.0) }],
        note: 'Max loss is the premium paid.',
      }
    case 'covered-call':
      return {
        legs: [{ side: 'short', type: 'call', strike: at(1.05) }],
        // Max loss is the stock's downside, which depends on the shares — not
        // the option structure. Leave it to the user rather than misstate it.
        withShares: true,
        note: 'Assumes you own 100 shares per contract — the short call alone is naked. '
          + 'Max loss is the stock’s downside, so set it from your share cost basis.',
      }
    case 'cash-secured-put': {
      const strike = at(0.95)
      return {
        legs: [{ side: 'short', type: 'put', strike }],
        maxLossUsd: strike * 100,
        note: 'Worst case is assignment at the strike with the stock at zero: strike × 100, '
          + 'less the premium collected.',
      }
    }
    case 'protective-put':
      return {
        legs: [{ side: 'long', type: 'put', strike: at(0.95) }],
        // Depends on what the shares cost: (cost − strike) × 100 plus the premium.
        withShares: true,
        note: 'Assumes you own 100 shares per contract. Below the strike the put makes up the shares’ fall, '
          + 'so the most you can lose is the shares’ cost less the strike, plus the premium.',
      }
    case 'collar': {
      const [put, call] = ladder(0.95, 1.05)
      return {
        legs: [
          { side: 'long', type: 'put', strike: put },
          { side: 'short', type: 'call', strike: call },
        ],
        withShares: true,
        note: 'Assumes you own 100 shares per contract. The put sets a floor under the shares and the call '
          + 'caps them; the premium of one pays for some or all of the other.',
      }
    }
    case 'bull-call-spread': {
      const [low, high] = ladder(1.0, 1.05)
      return {
        legs: [
          { side: 'long', type: 'call', strike: low },
          { side: 'short', type: 'call', strike: high },
        ],
        // Max loss = net debit paid, which needs the prices we don't prefill.
        note: 'Max loss is the net debit paid — fill it in once you’ve entered both legs’ prices.',
      }
    }
    case 'bear-put-spread': {
      const [low, high] = ladder(0.95, 1.0)
      return {
        legs: [
          { side: 'long', type: 'put', strike: high },
          { side: 'short', type: 'put', strike: low },
        ],
        note: 'Max loss is the net debit paid — fill it in once you’ve entered both legs’ prices.',
      }
    }
    case 'bull-put-spread': {
      const [low, high] = ladder(0.9, 0.95)
      return {
        legs: [
          { side: 'long', type: 'put', strike: low },
          { side: 'short', type: 'put', strike: high },
        ],
        maxLossUsd: (high - low) * 100,
        note: 'Worst case is the gap between the strikes × 100, less the credit collected.',
      }
    }
    case 'bear-call-spread': {
      const [low, high] = ladder(1.05, 1.1)
      return {
        legs: [
          { side: 'short', type: 'call', strike: low },
          { side: 'long', type: 'call', strike: high },
        ],
        maxLossUsd: (high - low) * 100,
        note: 'Worst case is the gap between the strikes × 100, less the credit collected.',
      }
    }
    case 'long-straddle':
      return {
        legs: [
          { side: 'long', type: 'call', strike: at(1.0) },
          { side: 'long', type: 'put', strike: at(1.0) },
        ],
        note: 'Max loss is the two premiums paid, if the price ends at the strike.',
      }
    case 'long-strangle': {
      const [put, call] = ladder(0.95, 1.05)
      return {
        legs: [
          { side: 'long', type: 'put', strike: put },
          { side: 'long', type: 'call', strike: call },
        ],
        note: 'Max loss is the two premiums paid, if the price ends between the strikes.',
      }
    }
    case 'iron-condor': {
      const [longPut, shortPut, shortCall, longCall] = ladder(0.9, 0.95, 1.05, 1.1)
      return {
        legs: [
          { side: 'long', type: 'put', strike: longPut },
          { side: 'short', type: 'put', strike: shortPut },
          { side: 'short', type: 'call', strike: shortCall },
          { side: 'long', type: 'call', strike: longCall },
        ],
        // Wing width bounds the loss before credit; put and call wings can
        // differ after strike rounding, and the worst case is the wider one.
        maxLossUsd: Math.max(shortPut - longPut, longCall - shortCall) * 100,
        note: 'Worst case is one wing’s width × 100, less the credit collected.',
      }
    }
    case 'iron-butterfly': {
      const [longPut, middle, longCall] = wingsAround(underlyingPrice, 0.05)
      return {
        legs: [
          { side: 'long', type: 'put', strike: longPut },
          { side: 'short', type: 'put', strike: middle },
          { side: 'short', type: 'call', strike: middle },
          { side: 'long', type: 'call', strike: longCall },
        ],
        // The wings are equal (wingsAround), so either one's width is the worst case.
        maxLossUsd: (middle - longPut) * 100,
        note: 'Worst case is one wing’s width × 100, less the credit collected.',
      }
    }
    case 'long-call-butterfly': {
      const [low, middle, high] = wingsAround(underlyingPrice, 0.05)
      return {
        // Two short calls at the middle strike, entered as two legs so the
        // preset stays structure-only (side, type, strike) like every other.
        legs: [
          { side: 'long', type: 'call', strike: low },
          { side: 'short', type: 'call', strike: middle },
          { side: 'short', type: 'call', strike: middle },
          { side: 'long', type: 'call', strike: high },
        ],
        note: 'Max loss is the net debit paid. The two middle legs are the two calls sold.',
      }
    }
  }
}
