/**
 * A generated document carries a "Last generated" date line. Rewriting that date when
 * nothing else in the document changed leaves the working tree dirty after a check that
 * found no drift: `npm run data-sources -- --verify` did exactly that, which the
 * 2026-11-05 code audit had to undo by hand. The date should move only when the
 * contents do.
 *
 * `contentToWrite(previous, next, dateLine)` returns the text to write, or `null` when
 * the only difference between `previous` and `next` is the date line, in which case
 * the file is left exactly as it is, old date and all.
 */

/** @param {string} text @param {RegExp} dateLine */
function withoutDate(text, dateLine) {
  return text.replace(dateLine, '')
}

/**
 * @param {string | null} previous the file as it is now, or null when there is none
 * @param {string} next the freshly rendered document
 * @param {RegExp} dateLine matches the date line, and only that line
 * @returns {string | null}
 */
export function contentToWrite(previous, next, dateLine) {
  if (previous === null) return next
  if (previous === next) return null
  return withoutDate(previous, dateLine) === withoutDate(next, dateLine) ? null : next
}
