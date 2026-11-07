import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  alertTargetFor, askAiHrefFor, assetPageHref, compareHrefFor, describeWatchKey, parseAlertPrice, watchKeyFor, type AssetRef,
} from '../assetActions'
import { COMPARE_OPTIONS, compareOptionForLink } from '../compareUniverse'
import { EQUITY_CATALOG } from '../equityCatalog'
import { FUND_CATALOG } from '../fundCatalog'
import { ASSET_CATALOG } from '../assetCatalog'
import { INSTRUMENTS, INSTRUMENT_BY_KEY, securitySymbol } from '../instruments'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'

// T-454 (D209): one row of actions on every asset page. Which of the four
// actions an asset gets, and where each goes.

const coin = (id: string): AssetRef => {
  const a = ASSET_CATALOG.find((x) => x.id === id)!
  return { kind: 'coin', symbol: a.symbol, name: a.name, key: COINGECKO_IDS[id] ?? null, assetId: id }
}
const stock = (symbol: string, name = symbol): AssetRef => ({ kind: 'stock', symbol, name, key: `sec:${symbol}` })
const fund = (symbol: string, name = symbol): AssetRef => ({ kind: 'fund', symbol, name, key: `sec:${symbol}` })
const GOLD = INSTRUMENTS.find((i) => i.class === 'commodity' && securitySymbol(i.key) === 'GC=F')!
const macro: AssetRef = { kind: 'macro', symbol: 'GC=F', name: GOLD.name, key: GOLD.key }

describe('add to watchlist', () => {
  it('offers the catalog instruments the Watchlist page can name, and nothing else', () => {
    expect(watchKeyFor(coin('btc'))).toBe('bitcoin')
    expect(watchKeyFor(stock('AAPL'))).toBe('sec:AAPL')
    expect(watchKeyFor(fund('VOO'))).toBe('sec:VOO')
    expect(watchKeyFor(macro)).toBe('sec:GC=F')
    expect(watchKeyFor(stock('ZZZZ'))).toBeNull()
    expect(watchKeyFor({ ...coin('btc'), key: null })).toBeNull()
  })

  it('offers every registry coin with a price, naming it from the registry where the instrument list lacks it', () => {
    const outside = ASSET_CATALOG.filter((a) => COINGECKO_IDS[a.id] && !INSTRUMENT_BY_KEY[COINGECKO_IDS[a.id]])
    expect(outside.length).toBeGreaterThan(0)
    for (const a of outside) {
      expect(watchKeyFor(coin(a.id)), a.id).toBe(COINGECKO_IDS[a.id])
      expect(describeWatchKey(COINGECKO_IDS[a.id]), a.id).toEqual({ symbol: a.symbol, name: a.name, classLabel: 'Crypto' })
    }
    // Every coin page with a price can add its coin; one with no CoinGecko id has neither.
    for (const a of ASSET_CATALOG) expect(watchKeyFor(coin(a.id)) !== null, a.id).toBe(!!COINGECKO_IDS[a.id])
  })
})

describe('price alerts', () => {
  it('watch a coin by its CoinGecko id and a stock or fund by its ticker, as the monitor reads them', () => {
    expect(alertTargetFor(coin('btc'))).toEqual({ kind: 'crypto', target: 'bitcoin' })
    expect(alertTargetFor(stock('aapl'))).toEqual({ kind: 'security', target: 'AAPL' })
    expect(alertTargetFor(fund('VOO'))).toEqual({ kind: 'security', target: 'VOO' })
    // Outside the catalogs is fine: the monitor asks for a quote by ticker.
    expect(alertTargetFor(stock('ZZZZ'))).toEqual({ kind: 'security', target: 'ZZZZ' })
  })

  it('are not offered on macro instruments, or on a coin with no CoinGecko id', () => {
    expect(alertTargetFor(macro)).toBeNull()
    expect(alertTargetFor({ ...coin('btc'), key: null })).toBeNull()
  })

  it('take a dollar price above zero, and nothing else', () => {
    expect(parseAlertPrice('200')).toBe(200)
    expect(parseAlertPrice(' $1,234.50 ')).toBe(1234.5)
    expect(parseAlertPrice('.5')).toBe(0.5)
    expect(parseAlertPrice('0.000012')).toBe(0.000012)
    for (const bad of ['', '0', '-5', 'abc', '1e5', '1.2.3', 'Infinity']) expect(parseAlertPrice(bad), bad).toBeNull()
  })

  it('link back to the asset’s own page', () => {
    expect(assetPageHref(coin('btc'))).toBe('/assets/btc')
    expect(assetPageHref(stock('AAPL'))).toBe('/equities/aapl')
    expect(assetPageHref(fund('VOO'))).toBe('/funds/voo')
    expect(assetPageHref(macro)).toBe(GOLD.detailPath)
  })
})

describe('compare', () => {
  it('opens Compare with this asset chosen', () => {
    expect(compareHrefFor(coin('btc'))).toBe('/compare?symbols=BTC')
    expect(compareHrefFor(stock('AAPL'))).toBe('/compare?symbols=AAPL')
    expect(compareHrefFor(fund('VOO'))).toBe('/compare?symbols=VOO')
    expect(compareHrefFor(macro)).toBe('/compare?symbols=GC%3DF')
    // A stock outside the catalogs opens as a stock, which Compare prices by ticker.
    expect(compareHrefFor(stock('ZZZZ'))).toBe('/compare?symbols=ZZZZ')
  })

  it('offers no link where Compare would open something else', () => {
    // Compare reads a symbol it does not know as a stock, so a fund outside the catalog would be called one.
    expect(compareHrefFor(fund('ZZZZX'))).toBeNull()
    // A stock page whose ticker a catalog fund already uses.
    expect(compareHrefFor(stock('VOO'))).toBeNull()
    // A coin whose symbol is BTC's but which is not BTC.
    expect(compareHrefFor({ ...coin('btc'), assetId: 'not-btc' })).toBeNull()
  })

  it('reads back as the same asset for every catalog asset it links, and names why for every one it does not', () => {
    const refs: AssetRef[] = [
      ...EQUITY_CATALOG.map((e) => stock(e.symbol, e.name)),
      ...FUND_CATALOG.map((f) => fund(f.symbol, f.name)),
      ...ASSET_CATALOG.map((a) => coin(a.id)),
      ...INSTRUMENTS.filter((i) => ['commodity', 'currency', 'rate'].includes(i.class))
        .map((i): AssetRef => ({ kind: 'macro', symbol: securitySymbol(i.key), name: i.name, key: i.key })),
    ]
    const kindOf = { coin: 'crypto', stock: 'stock', fund: 'fund', macro: 'macro' } as const
    for (const ref of refs) {
      const href = compareHrefFor(ref)
      if (href) {
        const symbol = new URL(href, 'http://x').searchParams.get('symbols')!
        const opt = compareOptionForLink(symbol)
        expect(opt.kind, ref.symbol).toBe(kindOf[ref.kind])
        if (ref.kind === 'coin') expect(opt.id, ref.symbol).toBe(ref.assetId)
      } else {
        // Only a symbol an earlier catalog asset already uses loses its link.
        const first = COMPARE_OPTIONS.find((o) => o.symbol.toUpperCase() === ref.symbol.toUpperCase())!
        expect(first, ref.symbol).toBeDefined()
        expect(first.kind === kindOf[ref.kind] && (ref.kind !== 'coin' || first.id === ref.assetId), ref.symbol).toBe(false)
      }
    }
  })
})

describe('ask the AI', () => {
  const read = (href: string) => new URL(href, 'http://x').searchParams

  it('opens Research on the asset’s own module, with a question about it typed in', () => {
    expect(askAiHrefFor(stock('AAPL', 'Apple Inc.'))).toBe('/research?symbol=AAPL')
    const c = read(askAiHrefFor(coin('btc')))
    expect(c.get('market')).toBe('crypto')
    expect(c.get('task')).toContain('(BTC)')
    const f = read(askAiHrefFor(fund('VOO', 'Vanguard S&P 500 ETF')))
    expect(f.get('market')).toBe('equities')
    expect(f.get('task')).toContain('the fund Vanguard S&P 500 ETF (VOO)')
    const m = read(askAiHrefFor(macro))
    expect(m.get('market')).toBe('macro')
    expect(m.get('task')).toContain('(GC=F)')
  })

  it('asks what the asset is and how it has moved, never what to do with it', () => {
    for (const ref of [coin('btc'), fund('VOO'), macro]) {
      const task = read(askAiHrefFor(ref)).get('task')!
      expect(task).not.toMatch(/\b(buy|sell|should|recommend|invest in|worth buying)\b/i)
    }
  })

  it('lands on what Research reads from a link', () => {
    const research = readFileSync(join(process.cwd(), 'src/app/(dashboard)/research/page.tsx'), 'utf8')
    for (const param of ["params.get('market')", "params.get('task')", "params.get('symbol')"]) expect(research).toContain(param)
  })
})

describe('the row is on every asset page', () => {
  const PAGES: Array<[string, RegExp]> = [
    ['src/app/(dashboard)/assets/[id]/page.tsx', /<AssetActions[\s\S]*?kind: 'coin'/],
    ['src/app/(dashboard)/equities/[symbol]/page.tsx', /<AssetActions[\s\S]*?kind: 'stock'/],
    ['src/app/(dashboard)/funds/[symbol]/page.tsx', /<AssetActions[\s\S]*?kind: 'fund'/],
    ['src/app/(dashboard)/macro/commodities/[slug]/CommodityDetailClient.tsx', /<AssetActions[\s\S]*?kind: 'macro'/],
    ['src/app/(dashboard)/macro/currencies/[slug]/CurrencyDetailClient.tsx', /<AssetActions[\s\S]*?kind: 'macro'/],
    ['src/app/(dashboard)/macro/rates/[slug]/RatesDetailClient.tsx', /<AssetActions[\s\S]*?kind: 'macro'/],
  ]
  it.each(PAGES)('%s', (file, shape) => {
    expect(readFileSync(join(process.cwd(), file), 'utf8')).toMatch(shape)
  })

  it('carries the stock page’s AI link, which no longer stands on its own', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/equities/[symbol]/page.tsx'), 'utf8')
    expect(page).not.toContain('/research?symbol=')
  })

  it('gives the fund page’s alert only a live price, never a stored reference price', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/funds/[symbol]/page.tsx'), 'utf8')
    expect(page).toMatch(/<AssetActions[^\n]*livePrice=\{live \?/)
  })
})
