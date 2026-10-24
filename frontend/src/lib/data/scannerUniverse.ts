import { ASSET_CATALOG } from './assetCatalog'

/**
 * Which coins the Crypto Scanner sweeps (T-129 B, owner 2026-10-24).
 *
 * Stablecoins are left out. A coin held at its peg has no trend for a setup to
 * describe, yet on the 2026-10-24 walkthrough they took 3 of 11 setups and 5 of
 * 11 Buy signals: a fraction of a cent of drift reads to RSI as a move. Leaving
 * them out also spares one price request per stablecoin on every scan.
 *
 * The catalog's own `assetType` decides, as it does for the tokenized label, so
 * this costs no request. A coin the catalog does not list stays in: nothing says
 * it is pegged. The pegged coins are returned, not dropped, so the page can name
 * what it left out.
 */
export function splitScannerUniverse(
  ids: readonly string[],
  catalog: readonly { id: string; symbol: string; assetType: string }[] = ASSET_CATALOG,
): { scanned: string[]; pegged: { id: string; symbol: string }[] } {
  const stable = new Map(
    catalog.filter((a) => a.assetType === 'stablecoin').map((a) => [a.id, a.symbol] as const),
  )
  const scanned: string[] = []
  const pegged: { id: string; symbol: string }[] = []
  for (const id of ids) {
    const symbol = stable.get(id)
    if (symbol === undefined) scanned.push(id)
    else pegged.push({ id, symbol })
  }
  return { scanned, pegged }
}
