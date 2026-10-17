import { describe, expect, it } from 'vitest'
import { chooseProspectus, parseFilingListAtom, primaryDocument, type FilingListEntry } from '../fundProspectus'

// One entry exactly as browse-edgar serves it (FXAIX's class C000100045, 497K,
// fetched 2026-10-17), so the parser is held to EDGAR's shape, not to ours.
const FXAIX_ENTRY = `<entry>
      <category label="form type" scheme="https://www.sec.gov/" term="497K" />
      <content type="text/xml">
        <accession-number>0000819118-26-000073</accession-number>
        <act>33</act>
        <file-number>033-15983</file-number>
        <file-number-href>https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&amp;filenum=033-15983&amp;owner=include&amp;count=10</file-number-href>
        <filing-date>2026-04-28</filing-date>
        <filing-href>https://www.sec.gov/Archives/edgar/data/819118/000081911826000073/0000819118-26-000073-index.htm</filing-href>
        <filing-type>497K</filing-type>
        <film-number>26904301</film-number>
        <form-name>Summary Prospectus for certain open-end management investment companies filed pursuant to Securities Act Rule 497(K)</form-name>
        <size>139 KB</size>
      </content>
      <id>urn:tag:sec.gov,2008:accession-number=0000819118-26-000073</id>
      <link href="https://www.sec.gov/Archives/edgar/data/819118/000081911826000073/0000819118-26-000073-index.htm" rel="alternate" type="text/html" />
    </entry>`

const f = (type: string, filedAt: string, n = filedAt): FilingListEntry =>
  ({ type, filedAt, indexUrl: `https://www.sec.gov/Archives/edgar/data/1/${n}/x-index.htm` })

describe('parseFilingListAtom', () => {
  it('reads type, date and index page from a real entry', () => {
    expect(parseFilingListAtom(`<feed>${FXAIX_ENTRY}</feed>`)).toEqual([{
      type: '497K',
      filedAt: '2026-04-28',
      indexUrl: 'https://www.sec.gov/Archives/edgar/data/819118/000081911826000073/0000819118-26-000073-index.htm',
    }])
  })

  it('lists a filing once though EDGAR repeats a 485BPOS per form it covers', () => {
    expect(parseFilingListAtom(`<feed>${FXAIX_ENTRY}${FXAIX_ENTRY}</feed>`)).toHaveLength(1)
  })

  it('skips an entry whose link is not an EDGAR archive index page, and survives garbage', () => {
    const offsite = FXAIX_ENTRY.replace(/<filing-href>[^<]+/, '<filing-href>https://example.com/x-index.htm')
    expect(parseFilingListAtom(offsite)).toEqual([])
    expect(parseFilingListAtom('<entry><filing-type>497K</filing-type></entry>')).toEqual([])
    expect(() => parseFilingListAtom('<<<')).not.toThrow()
    expect(parseFilingListAtom('')).toEqual([])
  })
})

describe('chooseProspectus', () => {
  it('takes the summary filed with the latest annual update, not a later supplement', () => {
    // FXAIX's shape: annual 485BPOS 04-24, its summary 04-28, then (in a later
    // year) a 4 KB supplement filed as 497K between updates.
    const summaries = [f('497K', '2026-04-28'), f('497K', '2026-11-10'), f('497K', '2025-04-28')]
    const regs = [f('485BPOS', '2026-04-24'), f('485BPOS', '2025-04-24')]
    expect(chooseProspectus(summaries, regs)).toMatchObject({ kind: 'summary', filedAt: '2026-04-28' })
  })

  it('accepts a summary filed the same day as the update (VOO, AGTHX)', () => {
    expect(chooseProspectus([f('497K', '2026-04-28')], [f('485BPOS', '2026-04-28')]))
      .toMatchObject({ kind: 'summary', filedAt: '2026-04-28' })
  })

  it('never reaches back to a summary from before the latest update', () => {
    const r = chooseProspectus([f('497K', '2025-06-27')], [f('485BPOS', '2026-06-18')])
    expect(r).toMatchObject({ kind: 'registration', filedAt: '2026-06-18' })
  })

  it('is indifferent to input order and ignores other form types', () => {
    const summaries = [f('497', '2026-07-01'), f('497K', '2026-06-29'), f('497K', '2026-07-15')]
    const regs = [f('485BPOS', '2025-06-20'), f('485APOS', '2026-08-01'), f('485BPOS', '2026-06-18')]
    expect(chooseProspectus(summaries, regs)).toMatchObject({ kind: 'summary', filedAt: '2026-06-29' })
    expect(chooseProspectus([...summaries].reverse(), [...regs].reverse())).toMatchObject({ filedAt: '2026-06-29' })
  })

  it('falls back to the newest summary with no update listed, and to null with nothing', () => {
    expect(chooseProspectus([f('497K', '2024-01-01'), f('497K', '2025-01-01')], []))
      .toMatchObject({ kind: 'summary', filedAt: '2025-01-01' })
    expect(chooseProspectus([], [])).toBeNull()
    expect(chooseProspectus([f('497', '2025-01-01')], [f('485APOS', '2025-01-01')])).toBeNull()
  })
})

describe('primaryDocument', () => {
  it('picks the largest .htm, never EDGAR’s index pages, the .txt bundle or images', () => {
    // FXAIX 0000819118-26-000073's index.json, 2026-10-17 (sizes as EDGAR sends them: strings, or empty).
    expect(primaryDocument([
      { name: '0000819118-26-000073-index-headers.html', size: '' },
      { name: '0000819118-26-000073-index.html', size: '' },
      { name: '0000819118-26-000073.txt', size: '' },
      { name: 'filing11574.htm', size: '86216' },
      { name: 'img126354_1.jpg', size: '30641' },
    ])).toBe('filing11574.htm')
  })

  it('chooses by size when a filing carries several documents', () => {
    expect(primaryDocument([{ name: 'cover.htm', size: '900' }, { name: 'd1234d497k.htm', size: '98708' }])).toBe('d1234d497k.htm')
  })

  it('is null when there is no document to link', () => {
    expect(primaryDocument([{ name: 'a-index.htm', size: '1' }, { name: 'x.txt', size: '9' }])).toBeNull()
    expect(primaryDocument([])).toBeNull()
  })
})
