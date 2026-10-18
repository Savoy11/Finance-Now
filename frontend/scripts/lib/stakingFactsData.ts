/**
 * The data behind the Staking Facts Check page (T-394), assembled from the staking
 * catalog through the shared row list (stakingFactRows.ts). Pure: every input is a
 * parameter, so the tests run it against the real catalog and against fixtures alike.
 */
import type { StakingProvider } from '../../src/lib/data/stakingProviders'
import { stakingFactRows, LLAMA_SLUG, LEAD_SOURCES, type CoinSymbols, type FactRow } from './stakingFactRows'

export interface StakingFactCard {
  id: string
  name: string
  category: StakingProvider['category']
  website: string | null
  rows: FactRow[]
}

export interface StakingFactsData {
  generatedOn: string
  serves: string[]
  catalog: { lastVerified: string; ageDays: number; staleAfterDays: number; providers: number; defunct: number }
  counts: { rows: number; terms: number; providers: number; leads: number }
  /** The checks that raised the rows marked Start here, with how many each raised; only those with any. */
  leadSources: Array<{ by: string; found: string; rows: number }>
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
}

export function buildStakingFactsData(input: BuildStakingFactsInput): StakingFactsData {
  const rows = stakingFactRows(input.providers, input.symbols, input.llamaSlug ?? LLAMA_SLUG)
  const byProvider = new Map<string, FactRow[]>()
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
    counts: { rows: rows.length, terms: rows.filter((r) => r.kind === 'terms').length, providers: cards.length, leads: rows.filter((r) => r.lead).length },
    leadSources: Object.values(LEAD_SOURCES)
      .map((s) => ({ by: s.by, found: s.found, rows: rows.filter((r) => r.lead && r.leadBy === s.by).length }))
      .filter((s) => s.rows > 0),
    providers: cards,
  }
}
