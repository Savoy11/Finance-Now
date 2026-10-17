import { describe, it, expect } from 'vitest'
import { parseNportReport, parseNportFilingsAtom, parseNportRateRisk } from '../nport'

// The N-PORT primary_doc.xml and browse-edgar Atom parsers are regex-based:
// malformed input must degrade to fewer/empty rows, never an uncaught throw,
// because one bad filing would otherwise 503 a diff that other filings could
// still serve.

const sec = (inner: string) => `<invstOrSec>${inner}</invstOrSec>`

const APPLE = sec(`
  <name>Apple Inc</name>
  <cusip>037833100</cusip>
  <identifiers>
    <isin value="US0378331005"/>
    <ticker value="aapl"/>
  </identifiers>
  <balance>1200.5</balance>
  <valUSD>250000.75</valUSD>
  <pctVal>6.53</pctVal>
  <assetCat>EC</assetCat>
`)

describe('parseNportReport', () => {
  it('extracts as-of date, identifiers, balance, value, and weight', () => {
    const report = parseNportReport(`
      <edgarSubmission>
        <genInfo><repPdDate>2026-03-31</repPdDate></genInfo>
        ${APPLE}
      </edgarSubmission>
    `)
    expect(report.asOf).toBe('2026-03-31')
    expect(report.holdings).toHaveLength(1)
    expect(report.holdings[0]).toEqual({
      ticker: 'AAPL', // uppercased
      name: 'Apple Inc',
      cusip: '037833100',
      isin: 'US0378331005',
      balance: 1200.5,
      valueUsd: 250000.75,
      pctVal: 6.53,
      assetCat: 'EC',
    })
  })

  // NT9: assetCat is what the fund's stock/bond/cash mix is derived from.
  it('nulls assetCat when the filer omits it, and normalizes case', () => {
    const report = parseNportReport(`
      <edgarSubmission>
        <genInfo><repPdDate>2026-03-31</repPdDate></genInfo>
        ${sec('<name>No Category</name><pctVal>1</pctVal>')}
        ${sec('<name>Lowercase</name><pctVal>1</pctVal><assetCat> dbt </assetCat>')}
      </edgarSubmission>
    `)
    expect(report.holdings[0].assetCat).toBeNull()
    expect(report.holdings[1].assetCat).toBe('DBT')
  })

  it('nulls out EDGAR sentinel and invalid identifiers', () => {
    const report = parseNportReport([
      sec('<name>Bond A</name><cusip>N/A</cusip><pctVal>1</pctVal>'),
      sec('<name>Bond B</name><cusip>000000000</cusip><pctVal>1</pctVal>'),
      // Digits and over-long strings fail the ticker shape check
      sec('<name>Odd</name><identifiers><ticker value="123ABC"/></identifiers><pctVal>1</pctVal>'),
    ].join(''))
    expect(report.holdings.map((h) => h.cusip)).toEqual([null, null, null])
    expect(report.holdings[2].ticker).toBeNull()
  })

  it('falls back to title, then Unknown, for the name and null for missing numbers', () => {
    const report = parseNportReport(
      sec('<title>Repo Agreement</title>') + sec('<pctVal>not-a-number</pctVal>'),
    )
    expect(report.holdings[0].name).toBe('Repo Agreement')
    expect(report.holdings[1].name).toBe('Unknown')
    expect(report.holdings[1].pctVal).toBeNull()
    expect(report.holdings[1].balance).toBeNull()
  })

  it('does not throw on malformed or truncated XML', () => {
    expect(() => parseNportReport('')).not.toThrow()
    expect(() => parseNportReport('<<<not xml >>>')).not.toThrow()
    // A truncated tag never matches (the regex needs the closing tag), so the
    // row degrades to Unknown rather than throwing.
    const truncated = parseNportReport('<invstOrSec><name>Cut off')
    expect(truncated.asOf).toBeNull()
    expect(truncated.holdings).toHaveLength(1)
    expect(truncated.holdings[0].name).toBe('Unknown')
    expect(parseNportReport('no securities here').holdings).toEqual([])
  })
})

// Item B.3.a exactly as two real filings carry it, fetched 2026-10-17: iShares
// IEF (accession 0002071691-26-016715, positive figures) and Vanguard BND
// (0000794105-26-000276, negative figures). Copied, not composed, so the test
// holds the parser to what the SEC serves rather than to what the code expects.
const IEF_CUR_METRICS = `
      <curMetrics>
        <curMetric>
          <curCd>USD</curCd>
          <intrstRtRiskdv01 period10Yr="15343879.43000000" period1Yr="546253.35000000" period30Yr="0.00000000" period3Mon="44721.79000000" period5Yr="17838412.59000000"/>
          <intrstRtRiskdv100 period10Yr="1533672419.33000000" period1Yr="54517730.96000000" period30Yr="0.00000000" period3Mon="4289652.26000000" period5Yr="1786063591.63000000"/>
        </curMetric>
      </curMetrics>`
const BND_CUR_METRICS = `
      <curMetrics>
        <curMetric>
          <curCd>USD</curCd>
          <intrstRtRiskdv01 period10Yr="-86242242.46706608" period1Yr="-26381609.88995072" period30Yr="-48588765.93585961" period3Mon="-374185.91679064" period5Yr="-64203513.91043710"/>
          <intrstRtRiskdv100 period10Yr="-8413012502.15894500" period1Yr="-2624961116.22410200" period30Yr="-4540781968.69735100" period3Mon="-37531035.75855026" period5Yr="-6376578164.95474000"/>
        </curMetric>
      </curMetrics>`

describe('parseNportRateRisk (Item B.3.a)', () => {
  it('sums all five maturity buckets per currency, keeping the filer’s sign', () => {
    const [ief] = parseNportRateRisk(IEF_CUR_METRICS)
    expect(ief.currency).toBe('USD')
    expect(ief.dv01).toBeCloseTo(15343879.43 + 546253.35 + 0 + 44721.79 + 17838412.59, 2)
    const [bnd] = parseNportRateRisk(BND_CUR_METRICS)
    expect(bnd.dv01).toBeLessThan(0)
    expect(bnd.dv01).toBeCloseTo(-225790318.12, 1)
  })

  it('reads DV01 only, never DV100, whose direction appears to differ by filer', () => {
    // A DV100 element on its own is not enough for an entry.
    const dv100Only = IEF_CUR_METRICS.replace(/<intrstRtRiskdv01[^>]*\/>/, '')
    expect(parseNportRateRisk(dv100Only)).toEqual([])
    expect(Object.keys(parseNportRateRisk(IEF_CUR_METRICS)[0]).sort()).toEqual(['currency', 'dv01'])
  })

  it('reads net assets and rate risk through parseNportReport', () => {
    const report = parseNportReport(`
      <edgarSubmission><formData><genInfo><repPdDate>2026-05-31</repPdDate></genInfo>
      <fundInfo><totAssets>48335873263.67</totAssets><netAssets>48329792760.21</netAssets>
      ${IEF_CUR_METRICS}</fundInfo></formData></edgarSubmission>`)
    expect(report.netAssets).toBeCloseTo(48329792760.21, 2)
    expect(report.rateRisk).toHaveLength(1)
  })

  it('returns one entry per currency', () => {
    const two = IEF_CUR_METRICS.replace('</curMetrics>',
      '<curMetric><curCd>EUR</curCd><intrstRtRiskdv01 period3Mon="1" period1Yr="1" period5Yr="1" period10Yr="1" period30Yr="1"/>'
      + '</curMetric></curMetrics>')
    expect(parseNportRateRisk(two).map((r) => [r.currency, r.dv01])).toEqual([['USD', expect.any(Number)], ['EUR', 5]])
  })

  it('drops a currency with a missing or unreadable bucket rather than total four of five', () => {
    const missing = IEF_CUR_METRICS.replace(' period30Yr="0.00000000"', '')
    expect(parseNportRateRisk(missing)).toEqual([])
    const garbled = IEF_CUR_METRICS.replace('period5Yr="17838412.59000000"', 'period5Yr="N/A"')
    expect(parseNportRateRisk(garbled)).toEqual([])
  })

  it('is empty for a filing without the section (stock funds), and never throws', () => {
    expect(parseNportRateRisk(`<fundInfo><netAssets>1</netAssets></fundInfo>`)).toEqual([])
    expect(parseNportReport(APPLE).rateRisk).toEqual([])
    expect(parseNportReport(APPLE).netAssets).toBeNull()
    expect(() => parseNportRateRisk('<curMetrics><curMetric><intrstRtRiskdv01')).not.toThrow()
  })
})

const entry = (accession: string, date: string, cik: string) => `
  <entry>
    <accession-number>${accession}</accession-number>
    <filing-date>${date}</filing-date>
    <link href="https://www.sec.gov/Archives/edgar/data/${cik}/000123456789/index.htm"/>
  </entry>`

describe('parseNportFilingsAtom', () => {
  it('extracts accession, filed date, and the trust CIK from the archive link', () => {
    const filings = parseNportFilingsAtom(`<feed>${entry('0001234567-26-000001', '2026-05-28', '884394')}</feed>`)
    expect(filings).toEqual([
      { accession: '0001234567-26-000001', cik: '884394', filedAt: '2026-05-28' },
    ])
  })

  it('dedupes repeated accessions and applies the limit', () => {
    const xml = `<feed>${entry('0001-26-000001', '2026-05-28', '1')}${entry('0001-26-000001', '2026-05-28', '1')}${entry('0001-26-000002', '2026-02-27', '1')}</feed>`
    expect(parseNportFilingsAtom(xml).map((f) => f.accession))
      .toEqual(['0001-26-000001', '0001-26-000002'])
    expect(parseNportFilingsAtom(xml, 1)).toHaveLength(1)
  })

  it('skips entries missing an accession or archive CIK, and survives garbage', () => {
    expect(parseNportFilingsAtom('<feed><entry><title>no ids</title></entry></feed>')).toEqual([])
    expect(() => parseNportFilingsAtom('')).not.toThrow()
    expect(parseNportFilingsAtom('total garbage')).toEqual([])
  })
})
