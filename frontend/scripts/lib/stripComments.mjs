// Remove comments from JS/TS source WITHOUT touching string or template literals.
//
// Why this is not a regex. A checker that scans route source for fetched hosts has to
// read code and not prose: a tombstone comment recording a removed endpoint is not a
// fetch. But the obvious strippers both fail here:
//
//   · `src.replace(/\/\/.*$/gm, '')` eats the rest of any line containing a URL,
//     because `https://host` contains `//`. The line survives as `const u = 'https:`.
//   · `/(?<!:)\/\/.*$/gm` fixes that one case and still breaks on `'a//b'`, on a
//     regex literal containing `//`, and on `${x}//y` inside a template.
//
// So this walks the source once, tracking which of six states it is in. It is the
// same discipline as the D26 guard that had to forbid a FIELD rather than the word:
// a guard that reads prose reports a defect that does not exist, and the fix belongs
// in the guard.
//
// Comments are replaced by a single space rather than deleted, so byte offsets stay
// roughly aligned and two tokens either side of a comment cannot fuse into one.

/**
 * @param {string} src JS/TS source
 * @returns {string} the same source with line and block comments blanked
 */
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]

    // ── line comment ──
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      out += ' '
      continue
    }
    // ── block comment ──
    if (c === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      out += ' '
      continue
    }
    // ── string / template literal: copy verbatim, honouring escapes ──
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
        out += src[i]
        if (src[i] === quote) { i++; break }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}
