import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { TOKENIZED_SECURITIES_RE, isTokenizedSecuritiesStory, tokenUnderlyings, STOCK_TICKERS } from '../tokenizedNews'
import { detectSymbols, detectTokenizedSymbols } from '../marketNewsSymbols'
import { regulatoryImpact } from '../newsRegulatoryImpact'
import { NEWS_CATEGORIES } from '@/lib/data/newsCategories'

/**
 * TS-13 (docs/assessments/tokenized-securities-2026-09-21.md, finding F12): the
 * news taggers file stories about tokenized securities together, link them to
 * the company whose shares they are about, and carry the CLARITY Act to every
 * coin's feed rather than three stablecoins'.
 */

describe('which stories are about tokenized securities', () => {
  it.each([
    'Kraken expands xStocks to 100 tokenized equities',
    'Robinhood launches stock tokens for EU customers',
    'Coinbase debuts onchain shares on Base',
    'SEC grants an innovation exemption for trading tokenized NMS stock',
    'London Stock Exchange to roll out tokenised equities',
    'Exchange lists tokenized versions of Apple and Nvidia',
    'Kraken adds tokenized Apple, Tesla and Nvidia shares',
    'BlackRock’s tokenized money market fund passes $2 billion',
    'What the tokenization of U.S. stocks means for brokers',
    'Ondo Global Markets passes $1 billion in value locked',
    'Dinari dShares open to US investors',
    'Regulators weigh securities tokenization rules',
  ])('files %j under tokenized securities', (text) => {
    expect(isTokenizedSecuritiesStory(text)).toBe(true)
  })

  it.each([
    // Tokenized, but not a security
    'JPMorgan expands tokenized deposits to a second chain',
    'Tokenized gold volumes hit a record',
    'The case for tokenizing real-world assets',
    // Words that sit near the vocabulary without meaning it
    'Wallet lets users share tokens with friends',
    'Stockholder letter mentions bitcoin treasury',
    'A VC-backed finance startup raises a seed round',
    'Bitcoin rallies as ETF inflows return',
  ])('leaves %j alone', (text) => {
    expect(isTokenizedSecuritiesStory(text)).toBe(false)
  })

  it('counts a story that only names a token', () => {
    expect(TOKENIZED_SECURITIES_RE.test('NVDAx volume hits a record on Solana')).toBe(false)
    expect(isTokenizedSecuritiesStory('NVDAx volume hits a record on Solana')).toBe(true)
  })
})

describe('reading a token symbol as its company', () => {
  it('reads the xStocks and Ondo suffixes', () => {
    expect(tokenUnderlyings('TSLAx and NVDAon led volume')).toEqual(['TSLA', 'NVDA'])
    expect(tokenUnderlyings('GOOGLx, then $AAPLx')).toEqual(['GOOGL', 'AAPL'])
  })

  it('lists each company once, in order of first mention', () => {
    expect(tokenUnderlyings('TSLAon outpaced TSLAx; NVDAx lagged TSLAx')).toEqual(['TSLA', 'NVDA'])
  })

  it('never reads an all-capitals ticker ending in X, which is a mutual fund', () => {
    // VFIAX and FXAIX are real mutual-fund tickers; TSLAX is not an xStock spelling.
    expect(tokenUnderlyings('VFIAX, FXAIX and TSLAX')).toEqual([])
  })

  it('never reads a one-letter ticker, because the catalog holds C, T and V', () => {
    expect(['C', 'T', 'V'].every((t) => STOCK_TICKERS.has(t))).toBe(true)
    expect(tokenUnderlyings('Con Edison, the Ton network, a Tx fee and Vx')).toEqual([])
  })

  it('needs the prefix to be a catalog stock', () => {
    expect(tokenUnderlyings('ZZZZx and QQQx launched')).toEqual([])
  })

  it('does not read a token inside a longer word', () => {
    expect(tokenUnderlyings('TSLAxyz and xTSLAx')).toEqual([])
  })
})

describe('linking stories to stocks', () => {
  it('the market feed tags a token as its company', () => {
    expect(detectSymbols('TSLAx hits a record on Kraken')).toContain('TSLA')
    expect(detectSymbols('TSLAX hits a record')).not.toContain('TSLA')
  })

  it('the crypto feed links stocks only on a story about tokenized securities', () => {
    // A crypto story that mentions a company is not this feature's to tag.
    expect(detectTokenizedSymbols('Apple Pay adds USDC settlement')).toEqual([])
    expect(detectTokenizedSymbols('Kraken lists tokenized Tesla and Apple shares')).toEqual(
      expect.arrayContaining(['TSLA', 'AAPL']),
    )
    expect(detectTokenizedSymbols('NVDAx volume hits a record')).toEqual(['NVDA'])
  })

  it('does not read crypto vocabulary as a company name', () => {
    // xStocks are priced by Chainlink oracles; Oracle the company is ORCL.
    expect(detectTokenizedSymbols('Chainlink’s oracle network now prices tokenized stocks')).not.toContain('ORCL')
    expect(detectTokenizedSymbols('Arkham intel shows whales buying tokenized stocks')).not.toContain('INTC')
    // By ticker or token it still links.
    expect(detectTokenizedSymbols('ORCLx joins the tokenized stocks lineup')).toContain('ORCL')
  })

  it('caps the links at six per story', () => {
    const text = 'Tokenized stocks: AAPLx MSFTx NVDAx AMZNx GOOGLx TSLAx NFLXx AMDx'
    expect(detectTokenizedSymbols(text)).toHaveLength(6)
  })
})

describe('the CLARITY Act reaches every coin', () => {
  it('tags market-structure legislation general', () => {
    for (const text of [
      'Senate cloture vote on the CLARITY Act fails, 49-50',
      'What the Senate market structure bill means for DeFi',
      'Lawmakers revive crypto market structure talks',
    ]) {
      expect(regulatoryImpact(text)).toContain('general')
    }
  })

  it('widened, never narrowed: the three stablecoins it reached before still get it', () => {
    expect(regulatoryImpact('the CLARITY Act stalls')).toEqual(expect.arrayContaining(['usdc', 'usdt', 'pyusd']))
  })

  it('leaves stablecoin law with the stablecoins', () => {
    const tags = regulatoryImpact('Treasury proposes GENIUS Act rules for issuers')
    expect(tags).toEqual(expect.arrayContaining(['usdc', 'usdt', 'pyusd']))
    expect(tags).not.toContain('general')
  })
})

// The category vocabulary is written in five places: the two routes' types, the
// two pages' filter lists, and the public API's spec and note. They drifted once
// already (the spec never listed 'market'), so the lists are read from source.
describe('every category a feed can file a story under is offered and documented', () => {
  const src = (p: string) => readFileSync(path.join(__dirname, '../../..', p), 'utf8')
  const quoted = (s: string) => [...s.matchAll(/'([a-z]+)'/g)].map((m) => m[1])

  const cryptoUnion = quoted(src('app/live-data/news/route.ts').match(/^\s*category: ('[a-z]+'(?: \| '[a-z]+')*)$/m)![1])
  const marketUnion = quoted(src('app/live-data/market-news/route.ts').match(/export type MarketNewsCategory =([^\n]*\n[^\n]*)/)![1])

  it('reads both unions, including the new category', () => {
    expect(cryptoUnion).toContain('tokenization')
    expect(marketUnion).toContain('tokenization')
  })

  it('the crypto news filter offers every crypto category but the catch-all', () => {
    const offered = NEWS_CATEGORIES.map((c) => c.value).filter((v) => v !== 'all')
    expect(offered.sort()).toEqual(cryptoUnion.filter((c) => c !== 'general').sort())
  })

  it('the market news filter offers every market category', () => {
    const block = src('app/(dashboard)/equities/news/page.tsx').match(/const CATEGORIES:[\s\S]*?\n\]/)![0]
    const offered = [...block.matchAll(/value: '([a-z]+)'/g)].map((m) => m[1]).filter((v) => v !== 'all')
    expect(offered.sort()).toEqual([...marketUnion].sort())
  })

  it('the public API spec and note list every crypto category', () => {
    const spec = src('app/api/v1/openapi.json/route.ts')
    const newsSchema = spec.slice(spec.indexOf('NewsResponse:'))
    const specEnum = quoted(newsSchema.match(/category:\s*\{ type: 'string', enum: \[([^\]]*)\]/)![1])
    expect(specEnum.sort()).toEqual([...cryptoUnion].sort())
    const note = src('app/api/v1/news/route.ts').match(/category: ([a-z/]+)\./)![1].split('/')
    expect(note.sort()).toEqual([...cryptoUnion].sort())
  })
})

// The routes keep their classifiers private, so their wiring is read from source.
describe('both feeds use the shared tokenization rules', () => {
  const src = (p: string) => readFileSync(path.join(__dirname, '../../..', p), 'utf8')
  const body = (file: string, fn: string) => {
    const s = src(file)
    const start = s.indexOf(`function ${fn}(`)
    return s.slice(start, s.indexOf('\n}\n', start))
  }

  it('the crypto feed files tokenized securities before it looks at geography', () => {
    const fn = body('app/live-data/news/route.ts', 'detectCategory')
    const tokenized = fn.indexOf("if (isTokenizedSecuritiesStory(text)) return 'tokenization'")
    expect(tokenized).toBeGreaterThan(-1)
    expect(tokenized).toBeLessThan(fn.indexOf('isGlobal'))
  })

  it('the market feed files tokenized securities before its other categories', () => {
    const fn = body('app/live-data/market-news/route.ts', 'classifyCategory')
    const tokenized = fn.indexOf("if (isTokenizedSecuritiesStory(text)) return 'tokenization'")
    expect(tokenized).toBeGreaterThan(-1)
    expect(tokenized).toBeLessThan(fn.indexOf('CATEGORY_PATTERNS'))
  })

  it('every crypto article builder links stocks the same way', () => {
    const s = src('app/live-data/news/route.ts')
    // Every line that sets relatedAssets on an article, not the interface's own field
    const builders = s.match(/^\s+relatedAssets: (?!string\[\])/gm)!.length
    expect(builders).toBeGreaterThan(0)
    expect(s.match(/^\s+relatedSymbols: detectTokenizedSymbols\((text|title)\),$/gm)?.length).toBe(builders)
  })
})
