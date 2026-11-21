import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { COMMODITY_CATALOG, getCommodity } from '../commodityCatalog'
import { FUND_PRICE_NOTE, NO_FUND_PRICES_NOTE, commodityFunds } from '../commodityFunds'
import { isLiveSecurityQuote, liveQuotesFor } from '../liveQuotes'
import { CommodityFundsCard } from '@/components/markets/CommodityFundsCard'

// T-462: each commodity page shows the live price of the funds that hold the commodity, under the
// fund's own name, never a reference price, and never in the commodity's own price slot or chart.

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('the funds each commodity lists', () => {
  it('are every fund the catalog names for it, none dropped for want of a catalog entry', () => {
    for (const c of COMMODITY_CATALOG) {
      expect(commodityFunds(c).map((f) => f.symbol), c.slug).toEqual(c.etfProxies)
    }
  })

  it('leave six commodities with none, whose pages say so', () => {
    const none = COMMODITY_CATALOG.filter((c) => commodityFunds(c).length === 0).map((c) => c.slug)
    expect(none.sort()).toEqual(['cocoa', 'coffee', 'cotton', 'heating-oil', 'lean-hogs', 'live-cattle'])
  })
})

describe('which quotes are live', () => {
  it('leaves out a reference price, a response the reference prices answered, and a price of zero', () => {
    expect(isLiveSecurityQuote('fmp', { price: 245.1 })).toBe(true)
    expect(isLiveSecurityQuote('fmp', { price: 245.1, reference: true })).toBe(false)
    expect(isLiveSecurityQuote('reference', { price: 245.1 })).toBe(false)
    expect(isLiveSecurityQuote('fmp', { price: 0 })).toBe(false)
    expect(isLiveSecurityQuote('fmp', { price: Number.NaN })).toBe(false)
    expect(isLiveSecurityQuote('fmp', undefined)).toBe(false)
  })

  it('reads each symbol from the response, null where it has no live quote', () => {
    const res = {
      source: 'tiingo',
      quotes: {
        GLD: { price: 245.1, change: 1.02, changePercent: 0.42 },
        IAU: { price: 50, change: null, changePercent: null, reference: true },
      },
    }
    expect(liveQuotesFor(res, ['GLD', 'IAU', 'GLDM'])).toEqual({
      GLD: { price: 245.1, change: 1.02, changePercent: 0.42 },
      IAU: null,
      GLDM: null,
    })
    expect(liveQuotesFor(undefined, ['GLD'])).toEqual({ GLD: null })
  })

  it('is the same rule the price alerts apply', () => {
    // Mutation: put the old inline test back in the alert monitor and this fails.
    const monitor = read('src/hooks/usePriceAlertMonitor.ts')
    expect(monitor).toContain('isLiveSecurityQuote(d.source, q)')
    expect(monitor).not.toMatch(/d\.source !== 'reference' && !q\.reference/)
  })
})

describe('the funds card on a commodity page', () => {
  const gold = getCommodity('gold')!
  const symbols = commodityFunds(gold).map((f) => f.symbol)
  const render = (slug: string, response?: object) => {
    const client = new QueryClient()
    const entry = getCommodity(slug)!
    if (response) client.setQueryData(['commodity-fund-quotes', commodityFunds(entry).map((f) => f.symbol).join(',')], response)
    return renderToStaticMarkup(<QueryClientProvider client={client}><CommodityFundsCard entry={entry} /></QueryClientProvider>)
  }
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim()
  const cell = (html: string, symbol: string) => {
    const m = new RegExp(`data-testid="fund-price-${symbol}"[^>]*>(.*?)</span><svg`).exec(html)
    return m ? text(m[1]) : null
  }

  it('shows a live fund price and its change, and a dash for a reference price', () => {
    // Mutation: show the reference price (IAU's 50) and this fails.
    const html = render('gold', {
      ok: true, source: 'tiingo',
      quotes: {
        GLD: { symbol: 'GLD', price: 245.1, change: 1.02, changePercent: 0.42 },
        IAU: { symbol: 'IAU', price: 50, change: null, changePercent: null, reference: true },
        GLDM: { symbol: 'GLDM', price: 52.3, change: -0.1, changePercent: -0.19 },
      },
    })
    expect(cell(html, 'GLD')).toBe('$245.10 +0.42%')
    expect(cell(html, 'GLDM')).toBe('$52.30 −0.19%')
    expect(cell(html, 'IAU')).toBe('—')
    expect(html).not.toContain('$50.00')
    for (const s of symbols) expect(html, s).toContain(`href="/funds/${s.toLowerCase()}"`)
    expect(text(html)).toContain(FUND_PRICE_NOTE)
    expect(html).toContain('href="/data-sources"') // the quotes' source line
    expect(html).not.toContain('data-testid="no-fund-prices"')
  })

  it('shows no price at all when only reference prices came back, and says why', () => {
    const quotes = Object.fromEntries(symbols.map((s) => [s, { symbol: s, price: 40, change: null, changePercent: null, reference: true }]))
    const html = render('gold', { ok: true, source: 'reference', quotes })
    for (const s of symbols) expect(cell(html, s), s).toBe('—')
    expect(text(html)).toContain(NO_FUND_PRICES_NOTE)
    expect(html).not.toContain('href="/data-sources"')
  })

  it('names both reasons there may be no price, never only a missing key (code audit 2026-11-12, D226)', () => {
    expect(NO_FUND_PRICES_NOTE).toMatch(/no quote key is set/)
    expect(NO_FUND_PRICES_NOTE).toMatch(/providers did not answer/)
  })

  it('keeps a page with no fund as it was', () => {
    const html = render('heating-oil')
    expect(text(html)).toContain('No fund in the catalog tracks this contract directly.')
    expect(html).not.toContain('data-testid="fund-price-')
  })

  it('names facts only: no ranking of the funds', () => {
    const card = read('src/components/markets/CommodityFundsCard.tsx') + read('src/lib/data/commodityFunds.ts')
    const words = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(words).not.toMatch(/\bbest\b|cheapest|recommend|top pick|\bsort\(/i)
  })
})

describe('the commodity page', () => {
  const page = read('src/app/(dashboard)/macro/commodities/[slug]/CommodityDetailClient.tsx')

  it('shows the funds’ prices in their own card, its own price slot reading only the contract', () => {
    expect(page).toContain('<CommodityFundsCard entry={entry} />')
    // The page's own quote is the contract's, alone (mutation: add the funds to it).
    expect(page).toContain('/live-data/security-quotes?symbols=${encodeURIComponent(entry.symbol)}`')
    expect(page).not.toMatch(/etfProxies/)
  })

  it('charts only the contract, never a fund in its place (D225)', () => {
    expect(page.match(/<PriceChartCard /g)).toHaveLength(1)
    expect(page).toContain('<PriceChartCard symbol={entry.symbol}')
  })
})
