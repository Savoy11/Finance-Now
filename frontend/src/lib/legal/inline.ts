/**
 * The three inline marks the legal copy uses, and nothing else.
 *
 *   **bold**            a lead-in such as "**Account details:**"
 *   [label](/path)      a link to another page of the app
 *   [ALL CAPS BLANK]    an unfilled blank such as [COMPANY LLC NAME]
 *
 * Kept this small on purpose: the copy is legal text, written in a document and
 * pasted in, and every mark a renderer understands is one more way the page can
 * say something the document does not. Blanks are a token of their own so the
 * page can highlight them and the draft notice can list them — a blank that
 * renders as ordinary text reads as a finished sentence.
 */

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'blank'; text: string }

// One pass, three alternatives. A blank is capitals, digits and spaces only, so
// a bracketed sentence such as "[Reserved. Before any paid plan …]" stays text.
const MARKS = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\[([A-Z][A-Z0-9 ]*[A-Z0-9])\]/g

export function parseInline(source: string): InlineToken[] {
  const out: InlineToken[] = []
  let last = 0
  for (const m of source.matchAll(MARKS)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: source.slice(last, at) })
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] })
    else if (m[2] !== undefined) out.push({ kind: 'link', text: m[2], href: m[3] })
    else out.push({ kind: 'blank', text: `[${m[4]}]` })
    last = at + m[0].length
  }
  if (last < source.length) out.push({ kind: 'text', text: source.slice(last) })
  return out
}

/** The unfilled blanks in a string, in order, e.g. ["[CONTACT EMAIL]"]. */
export function blanksIn(source: string): string[] {
  return parseInline(source).filter((t) => t.kind === 'blank').map((t) => t.text)
}

/** The words a reader sees, with every mark removed. */
export function plainText(source: string): string {
  return parseInline(source).map((t) => t.text).join('')
}
