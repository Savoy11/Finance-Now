/**
 * One collection of a check page's database, as the ArtifactData tool saves it with an
 * out_dir: <dir>/<collection>/<doc id>.json, one file per document.
 *
 * The tool percent-encodes characters a file name cannot hold, and Windows cannot hold ':'
 * in one, so the reading "BIL:yield" arrives as "BIL%3Ayield.json". The plans used to take the
 * file name as the id, and on the owner's machine every reading read as a figure the catalog
 * no longer has (found 2026-10-21, the first real export of the Fund Figures Check). The id is
 * decoded here, once, for all three plans (fee-check, staking-facts, fund-figures).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A file name back to its document id. A name that is not valid percent-encoding is kept as it is. */
export function docIdOf(fileName: string): string {
  const base = fileName.endsWith('.json') ? fileName.slice(0, -'.json'.length) : fileName
  try {
    return decodeURIComponent(base)
  } catch {
    return base
  }
}

/** Every document in one saved collection, keyed by its id. Unreadable files are reported, never guessed at. */
export function readSavedCollection(dir: string, name: string, warn: (msg: string) => void = console.warn): Record<string, unknown> {
  const d = join(dir, name)
  const out: Record<string, unknown> = {}
  if (!existsSync(d)) return out
  for (const f of readdirSync(d)) {
    if (!f.endsWith('.json')) continue
    try {
      const body = JSON.parse(readFileSync(join(d, f), 'utf8'))
      const id = docIdOf(f)
      if (Object.prototype.hasOwnProperty.call(out, id)) {
        warn(`  skipped ${name}/${f}: a second file for ${id}`)
        continue
      }
      // Tolerate a { data } wrapper as well as a bare document.
      out[id] = body && typeof body === 'object' && 'data' in body && typeof body.data === 'object' ? body.data : body
    } catch {
      warn(`  skipped ${name}/${f}: not readable JSON`)
    }
  }
  return out
}
