import { fundStrategy, type FundEntry } from './fundCatalog'

/**
 * What a fund is built from, in plain words: the facts that replace the
 * switched-off "Risk Profile" label on fund pages (D92, 2026-10-07; T-420).
 *
 * The label sorted funds into Conservative … Speculative, which is the language
 * of an investor's risk tolerance. These are facts about the fund itself, read
 * only from fields the catalog already records (strategy, category, tracked
 * index). Where those fields do not settle a fact, no line is written: a
 * commodity fund may hold the metal or futures contracts, and the catalog has
 * no field saying which, so that difference stays in the fund's description.
 */
export interface FundStructureFact {
  /** Short heading for the fact. */
  label: string
  /** The fact, one or two plain sentences. */
  text: string
}

type StructureInput = Pick<FundEntry, 'strategy' | 'indexTracked' | 'category'>

/**
 * The daily multiple a leveraged or inverse fund aims for, read from its
 * tracked-index name ("Nasdaq-100 (3× daily)", "S&P 500 (−1× daily)").
 * Returns null when the name does not state one.
 */
export function dailyMultiple(indexTracked: string | null): number | null {
  if (!indexTracked) return null
  const m = indexTracked.match(/\(\s*([−-])?\s*(\d+(?:\.\d+)?)\s*[×x]\s*daily\s*\)/i)
  if (!m) return null
  const n = Number(m[2])
  return m[1] ? -n : n
}

function formatMultiple(n: number): string {
  return `${n < 0 ? '−' : ''}${Math.abs(n)}×`
}

export function fundStructureFacts(f: StructureInput): FundStructureFact[] {
  const facts: FundStructureFact[] = []
  const strategy = fundStrategy(f)

  if (strategy === 'leveraged' || strategy === 'inverse') {
    const multiple = dailyMultiple(f.indexTracked)
    const aim = multiple != null
      ? `aims for ${formatMultiple(multiple)} its index's return`
      : strategy === 'inverse'
        ? "aims for the opposite of its index's return"
        : "aims for a multiple of its index's return"
    facts.push({
      label: 'Daily reset',
      text: `Uses derivatives and ${aim} over a single day, then resets. Held for longer, its return can differ a lot from that, especially when prices swing.`,
    })
  }

  if (strategy === 'covered-call') {
    facts.push({
      label: 'Options income',
      text: 'Sells call options on what it holds. That brings in income, and in exchange it gives up part of any rise in those holdings.',
    })
  }

  switch (f.category) {
    case 'bond':
      facts.push({
        label: 'Holds bonds',
        text: 'Bond prices move the opposite way to interest rates, and longer-dated bonds move more.',
      })
      break
    case 'commodity':
      facts.push({
        label: 'Tracks commodities',
        text: 'Follows commodity prices, not company shares. The description above says whether it holds the commodity itself or futures contracts.',
      })
      break
    case 'currency':
      facts.push({
        label: 'Tracks currencies',
        text: 'Follows exchange rates against the US dollar, not company shares.',
      })
      break
    case 'crypto':
      facts.push({
        label: 'Tracks crypto',
        text: 'Its price follows crypto asset prices, which can swing sharply and can fall to a fraction of their value.',
      })
      break
  }

  return facts
}
