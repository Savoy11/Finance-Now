/**
 * The data behind the Staking Facts Check page (T-394), assembled from the staking
 * catalog through the shared row list (stakingFactRows.ts). Pure: every input is a
 * parameter, so the tests run it against the real catalog and against fixtures alike.
 */
import type { StakingProvider } from '../../src/lib/data/stakingProviders'
import { stakingFactRows, LLAMA_SLUG, LEAD_SOURCES, type CoinSymbols, type FactRow } from './stakingFactRows'

/**
 * A pre-fill suggestion for one figure of a row, as the card shows it (npm run
 * staking-facts-prefill, D153). Read from the provider's own pages on a site the owner ruled
 * Allowed, and a hint only: the answer box is never filled from it.
 */
export interface FieldSuggestion {
  field: string
  /** `suggested` carries a figure; `none` carries only why there is none. */
  status: 'suggested' | 'none'
  /** As the page prints it, and as the check page would store it. */
  shown: string
  figure: number | null
  /** Whether that is the catalog's figure now. */
  matches: boolean | null
  quote: string
  url: string | null
  why: string
}

export interface RowSuggestion {
  /** The day the pre-fill read the pages. */
  readOn: string
  fields: FieldSuggestion[]
}

export type StakingFactRow = FactRow & { suggestion?: RowSuggestion }

export interface StakingFactCard {
  id: string
  name: string
  category: StakingProvider['category']
  website: string | null
  rows: StakingFactRow[]
}

export interface StakingFactsData {
  generatedOn: string
  serves: string[]
  catalog: { lastVerified: string; ageDays: number; staleAfterDays: number; providers: number; defunct: number }
  counts: { rows: number; terms: number; providers: number; leads: number; quick: number }
  /** The checks that raised the rows marked Start here, with how many each raised; only those with any. */
  leadSources: Array<{ by: string; found: string; rows: number }>
  /** When the pre-fill's suggestions were saved, and how many figures carry one; null without them. */
  suggestions: { savedAt: string; suggested: number; none: number } | null
  providers: StakingFactCard[]
}

export const STAKING_FACTS_SERVES = ['T-394'] as const

/**
 * The order to work the cards in: liquid-staking protocols first, whose docs are public;
 * then wallets; then exchanges, which often show their terms only after sign-in. Within a
 * group, catalog order.
 */
export const CATEGORY_ORDER: ReadonlyArray<StakingProvider['category']> = ['liquid', 'wallet', 'cefi']

export interface BuildStakingFactsInput {
  providers: readonly StakingProvider[]
  symbols: CoinSymbols
  lastVerified: string
  ageDays: number
  staleAfterDays: number
  generatedOn: string
  llamaSlug?: Readonly<Record<string, string>>
  /** Keyed by row key, from suggestionsByRow. */
  suggestions?: { savedAt: string; byRow: ReadonlyMap<string, RowSuggestion> } | null
}

const SUGGESTION_TEXT_MAX = 600

/**
 * The pre-fill's file (staking-facts-suggestions-v1, its `providers`) as one suggestion per row.
 * A provider whose pages were not read gives each of its rows a `none` with the reason. Text is
 * cut to a length a card can carry; everything else in the file stays behind.
 */
export function suggestionsByRow(
  reads: ReadonlyArray<{
    id: string; readAt: string; outcome: string; why: string
    facts?: ReadonlyArray<{ key: string; field: string; status: string; shown: string; value: number | null; matches: boolean | null; quote: string; url: string | null; why: string }>
  }>,
  rows: readonly FactRow[],
): Map<string, RowSuggestion> {
  const cut = (s: unknown) => { const t = typeof s === 'string' ? s : ''; return t.length > SUGGESTION_TEXT_MAX ? `${t.slice(0, SUGGESTION_TEXT_MAX)}…` : t }
  const out = new Map<string, RowSuggestion>()
  for (const p of reads) {
    const readOn = typeof p.readAt === 'string' ? p.readAt.slice(0, 10) : ''
    if (p.outcome !== 'read') {
      for (const r of rows) {
        if (r.providerId !== p.id || r.kind === 'site') continue
        out.set(r.key, { readOn, fields: r.fields.map((f) => ({ field: f.name, status: 'none', shown: '', figure: null, matches: null, quote: '', url: null, why: cut(`The pages were not read: ${p.why || p.outcome}`) })) })
      }
      continue
    }
    for (const x of p.facts ?? []) {
      const ok = x.status === 'suggested'
      const row = out.get(x.key) ?? { readOn, fields: [] }
      row.fields.push({
        field: x.field,
        status: ok ? 'suggested' : 'none',
        shown: ok ? cut(x.shown) : '',
        figure: ok && typeof x.value === 'number' ? x.value : null,
        matches: ok ? x.matches === true : null,
        quote: ok ? cut(x.quote) : '',
        url: ok && typeof x.url === 'string' ? x.url : null,
        why: cut(x.why),
      })
      out.set(x.key, row)
    }
  }
  return out
}

export function buildStakingFactsData(input: BuildStakingFactsInput): StakingFactsData {
  const rows: StakingFactRow[] = stakingFactRows(input.providers, input.symbols, input.llamaSlug ?? LLAMA_SLUG).map((r) => {
    const s = input.suggestions?.byRow.get(r.key)
    return s ? { ...r, suggestion: s } : r
  })
  const byProvider = new Map<string, StakingFactRow[]>()
  for (const r of rows) {
    const list = byProvider.get(r.providerId) ?? []
    list.push(r)
    byProvider.set(r.providerId, list)
  }
  const index = new Map(input.providers.map((p, i) => [p.id, i]))
  const rank = (c: StakingProvider['category']) => {
    const i = CATEGORY_ORDER.indexOf(c)
    return i === -1 ? CATEGORY_ORDER.length : i
  }
  const cards: StakingFactCard[] = input.providers
    .filter((p) => byProvider.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, category: p.category, website: p.website ?? null, rows: byProvider.get(p.id)! }))
    .sort((a, b) => rank(a.category) - rank(b.category) || (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0))

  return {
    generatedOn: input.generatedOn,
    serves: [...STAKING_FACTS_SERVES],
    catalog: {
      lastVerified: input.lastVerified,
      ageDays: input.ageDays,
      staleAfterDays: input.staleAfterDays,
      providers: input.providers.length,
      defunct: input.providers.filter((p) => p.defunct).length,
    },
    counts: { rows: rows.length, terms: rows.filter((r) => r.kind === 'terms').length, providers: cards.length, leads: rows.filter((r) => r.lead).length, quick: rows.filter((r) => r.kind === 'site' || r.kind === 'founded').length },
    leadSources: Object.values(LEAD_SOURCES)
      .map((s) => ({ by: s.by, found: s.found, rows: rows.filter((r) => r.lead && r.leadBy === s.by).length }))
      .filter((s) => s.rows > 0),
    suggestions: input.suggestions
      ? {
          savedAt: input.suggestions.savedAt,
          suggested: rows.reduce((n, r) => n + (r.suggestion?.fields.filter((f) => f.status === 'suggested').length ?? 0), 0),
          none: rows.reduce((n, r) => n + (r.suggestion?.fields.filter((f) => f.status === 'none').length ?? 0), 0),
        }
      : null,
    providers: cards,
  }
}
