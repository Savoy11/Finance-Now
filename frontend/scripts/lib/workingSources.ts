// Which vendor a WORKING surface would lose everything with (T-439, D110, 2026-10-14).
//
// gen-coverage-matrix.ts's "Strands if dropped" column scores only vendors that could fix a surface
// the audit found degraded, so it cannot see a vendor carrying a surface that works. That is the
// case D21 was written about: DefiLlama was the only source of crypto history past 365 days until
// D108 and never appeared in a matrix. These helpers ask the other question: for each surface the
// audit found working, which external vendors could serve it, and is anything behind them?
//
// Kept pure and separate from the script so the rules are unit-tested.
//
// Per surface first, then per range. A vendor that is the only source for some RANGES of a surface
// (DefiLlama for history past 365 days, while CoinGecko served the rest) does not count as sole
// per surface; rangeSlices() finds it from the providers' `limits` (D112). A range is seen only
// where someone recorded the limit, so an unrecorded limit is still invisible.

import type { SourceProvider } from '../../src/lib/data/dataSources'

/**
 * How a registry provider counts when asking what dropping a vendor would do.
 *
 * - `vendor`: an external source. A provider with a host, or one that needs a key (the quote
 *   ladders are written as names, "FMP → Finnhub → …", with no single host).
 * - `static-fallback`: a hand-kept table the surface falls back to (a catalog). Losing the vendor
 *   degrades the surface to it rather than emptying it, which is what D21 asks for.
 * - `other`: not a source. In-app computation (`derived`), a composite of other surfaces (an
 *   aggregator with no host of its own), data the user enters, feeds a user adds, a placeholder.
 */
export type ProviderKind = 'vendor' | 'static-fallback' | 'other'

export function providerKind(p: SourceProvider): ProviderKind {
  if (p.role === 'derived') return 'other'
  if (p.host) return 'vendor'
  if (p.auth === 'key' || p.auth === 'paid') return p.role === 'aggregator' ? 'other' : 'vendor'
  if (p.role === 'fallback') return 'static-fallback'
  return 'other'
}

export interface WorkingSurface {
  id: string
  providers: SourceProvider[]
}

export interface SourcesOfSurface {
  id: string
  /** Every external vendor that could serve the surface, ladders split into their vendors. */
  vendors: string[]
  /** A hand-kept table stands behind the vendors. */
  staticFallback: boolean
}

/**
 * @param vendorsOf  the vendors one provider entry names; the matrix's own `candidatesOf`, so a
 *   ladder is read as the OR it is and "FMP company-screener" counts as FMP.
 */
export function sourcesOf(surface: WorkingSurface, vendorsOf: (p: SourceProvider) => string[]): SourcesOfSurface {
  const vendors = new Set<string>()
  let staticFallback = false
  for (const p of surface.providers) {
    const kind = providerKind(p)
    if (kind === 'vendor') for (const v of vendorsOf(p)) vendors.add(v)
    else if (kind === 'static-fallback') staticFallback = true
  }
  return { id: surface.id, vendors: [...vendors].sort(), staticFallback }
}

export interface LossIfDropped {
  /** Working surfaces this vendor alone carries, with nothing behind it: dropping it empties them. */
  empties: string[]
  /** Working surfaces this vendor alone carries over a hand-kept table: dropping it degrades them. */
  degrades: string[]
}

// ── Ranges (T-439's second half, D112) ──────────────────────────────────────────
//
// A provider's `limits` say what it cannot serve that others on the same surface can. Each limit
// marks out a range of the surface; the vendors left for that range are the ones without the
// limit. So a surface with two vendors can still rest on one for part of what it shows.

export interface RangeSlice {
  /** The range, in words: "history past 365 days", "intervals other than 1d, 1w". */
  range: string
  /** The vendors that can serve it. */
  vendors: string[]
}

/** The ranges some provider on this surface cannot serve, and who can serve each. */
export function rangeSlices(surface: WorkingSurface, vendorsOf: (p: SourceProvider) => string[]): RangeSlice[] {
  const vendorProviders = surface.providers.filter((p) => providerKind(p) === 'vendor')
  const serving = (can: (p: SourceProvider) => boolean) =>
    [...new Set(vendorProviders.filter(can).flatMap(vendorsOf))].sort()
  const slices: RangeSlice[] = []
  const historyLimits = [...new Set(vendorProviders.map((p) => p.limits?.historyDays).filter((d): d is number => d != null))]
  for (const days of historyLimits.sort((a, b) => a - b)) {
    slices.push({
      range: `history past ${days} days`,
      vendors: serving((p) => p.limits?.historyDays == null || p.limits.historyDays > days),
    })
  }
  for (const p of vendorProviders) {
    const only = p.limits?.intervals
    if (!only?.length) continue
    slices.push({
      range: `intervals other than ${only.join(', ')}`,
      vendors: serving((q) => !q.limits?.intervals?.length || q.limits.intervals.some((i) => !only.includes(i))),
    })
  }
  return slices
}

/** Per vendor, what dropping it would do to the working surfaces. Vendors with no loss are left out. */
export function lossIfDropped(surfaces: SourcesOfSurface[]): Map<string, LossIfDropped> {
  const out = new Map<string, LossIfDropped>()
  for (const s of surfaces) {
    if (s.vendors.length !== 1) continue
    const v = s.vendors[0]
    const loss = out.get(v) ?? { empties: [], degrades: [] }
    ;(s.staticFallback ? loss.degrades : loss.empties).push(s.id)
    out.set(v, loss)
  }
  return out
}
