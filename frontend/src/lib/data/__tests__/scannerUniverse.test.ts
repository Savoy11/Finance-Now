import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitScannerUniverse } from '../scannerUniverse'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import { ASSET_CATALOG } from '../assetCatalog'

describe('splitScannerUniverse (T-129 B)', () => {
  const catalog = [
    { id: 'btc', symbol: 'BTC', assetType: 'layer1' },
    { id: 'usdc', symbol: 'USDC', assetType: 'stablecoin' },
    { id: 'usdy', symbol: 'USDY', assetType: 'tokenized' },
    { id: 'eurc', symbol: 'EURC', assetType: 'stablecoin' },
  ]

  it('leaves stablecoins out, in order, and names them', () => {
    const { scanned, pegged } = splitScannerUniverse(['btc', 'usdc', 'usdy', 'eurc'], catalog)
    expect(scanned).toEqual(['btc', 'usdy'])
    expect(pegged).toEqual([{ id: 'usdc', symbol: 'USDC' }, { id: 'eurc', symbol: 'EURC' }])
  })

  it('keeps a coin the catalog does not list: nothing says it is pegged', () => {
    expect(splitScannerUniverse(['atom'], catalog).scanned).toEqual(['atom'])
  })

  it('the Crypto Scanner sweeps the split universe and names what it left out', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/scanner/page.tsx'), 'utf8')
    expect(page).toContain('splitScannerUniverse(SUPPORTED_IDS)')
    // The sweep's starting rows and its filter both read SCAN_IDS, never the catalog.
    expect(page).toMatch(/applyScannerFilters\(\s*SCAN_IDS,/)
    expect(page).not.toMatch(/applyScannerFilters\(\s*SUPPORTED_IDS/)
    expect(page).toContain('PEGGED.map(p => p.symbol)')
  })

  it('on the real universe: every coin lands in exactly one list, and no stablecoin is scanned', () => {
    const ids = Object.keys(COINGECKO_IDS)
    const { scanned, pegged } = splitScannerUniverse(ids)
    expect(scanned.length + pegged.length).toBe(ids.length)
    const stable = new Set(ASSET_CATALOG.filter((a) => a.assetType === 'stablecoin').map((a) => a.id))
    expect(scanned.filter((id) => stable.has(id))).toEqual([])
    // USDY is a tokenized Treasury note, not a stablecoin (TS-1): it stays in.
    expect(scanned).toContain('usdy')
    expect(pegged.map((p) => p.id)).toContain('usdc')
  })
})
