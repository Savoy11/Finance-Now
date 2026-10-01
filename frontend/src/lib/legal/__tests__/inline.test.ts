import { describe, it, expect } from 'vitest'
import { parseInline, blanksIn, plainText } from '../inline'

describe('parseInline', () => {
  it('reads bold, links and blanks in order, with the text between them', () => {
    expect(parseInline('**Email:** write to [CONTACT EMAIL] or see [Privacy](/about/privacy).')).toEqual([
      { kind: 'bold', text: 'Email:' },
      { kind: 'text', text: ' write to ' },
      { kind: 'blank', text: '[CONTACT EMAIL]' },
      { kind: 'text', text: ' or see ' },
      { kind: 'link', text: 'Privacy', href: '/about/privacy' },
      { kind: 'text', text: '.' },
    ])
  })

  it('leaves a bracketed sentence as text — only ALL-CAPS brackets are blanks', () => {
    // Terms §18 is "[Reserved. Before any paid plan launches, …]": a section
    // left for later, not a field to fill in.
    const s = '[Reserved. Before any paid plan launches, this section will set out pricing.]'
    expect(parseInline(s)).toEqual([{ kind: 'text', text: s }])
  })

  it('reads an all-caps label followed by an address as a link, not a blank', () => {
    expect(parseInline('[FAQ](/about)')).toEqual([{ kind: 'link', text: 'FAQ', href: '/about' }])
  })

  it('keeps anchors and external addresses as links', () => {
    expect(parseInline('[a](#questions-and-complaints) [b](https://example.com/x)').filter((t) => t.kind === 'link'))
      .toEqual([
        { kind: 'link', text: 'a', href: '#questions-and-complaints' },
        { kind: 'link', text: 'b', href: 'https://example.com/x' },
      ])
  })

  it('returns plain text untouched', () => {
    expect(parseInline('No marks here.')).toEqual([{ kind: 'text', text: 'No marks here.' }])
    expect(parseInline('')).toEqual([])
  })
})

describe('blanksIn and plainText', () => {
  it('lists every blank, repeats included', () => {
    expect(blanksIn('[COMPANY LLC NAME], [MAILING ADDRESS]. Email: [CONTACT EMAIL] [CONTACT EMAIL]'))
      .toEqual(['[COMPANY LLC NAME]', '[MAILING ADDRESS]', '[CONTACT EMAIL]', '[CONTACT EMAIL]'])
  })

  it('gives the words a reader sees, marks removed', () => {
    expect(plainText('**Mail:** see [the policy](/about/privacy) at [CONTACT EMAIL]'))
      .toBe('Mail: see the policy at [CONTACT EMAIL]')
  })
})
