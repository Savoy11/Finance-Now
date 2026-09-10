import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GAP_REASON_IDS } from '@/lib/data/dataGaps'

/**
 * Every "not available" notice must say WHICH KIND of gap it is.
 *
 * `LiveUnavailable`'s `reason` is optional in TypeScript, and deliberately so —
 * it postdates its call sites, and making it required would have been a
 * mechanical edit that invited mechanical (wrong) answers. That leaves nothing
 * in the type system stopping the next notice from shipping untagged, so the
 * enforcement lives here instead.
 *
 * Why it matters more than tidiness: the reason decides whether the panel offers
 * "Add a data source in Integrations". A gap that no key can fix would otherwise
 * inherit the historical default and tell the reader to go buy one — sending
 * them to spend money to discover the source does not exist.
 *
 * `DataGapNote` needs no equivalent check: its `reason` prop is required, so the
 * compiler already refuses an untagged marker.
 *
 * Line endings normalised on read — the repo is LF in git but a Windows checkout
 * is CRLF, and these matchers span lines. Same reason as
 * stakingUpstreamProbe.test.ts.
 */

const SRC = join(__dirname, '..', '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx$/.test(entry)) out.push(full)
  }
  return out
}

/** Each `<LiveUnavailable …>` element's opening tag, with the file it came from. */
function usages(): { file: string; tag: string }[] {
  const found: { file: string; tag: string }[] = []
  for (const file of walk(SRC)) {
    if (file.endsWith(join('ui', 'LiveUnavailable.tsx'))) continue // the definition
    const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    let from = 0
    for (;;) {
      const at = src.indexOf('<LiveUnavailable', from)
      if (at < 0) break
      // Opening tag runs to the first '>' — enough to see its props, and JSX
      // children are irrelevant here (this component is self-closing anyway).
      const end = src.indexOf('>', at)
      found.push({ file: file.slice(SRC.length + 1), tag: src.slice(at, end < 0 ? src.length : end + 1) })
      from = at + 1
    }
  }
  return found
}

describe('every LiveUnavailable declares what kind of gap it is', () => {
  const all = usages()

  it('finds the notices at all (guards a matcher that silently matches nothing)', () => {
    expect(all.length).toBeGreaterThan(0)
  })

  it('tags every usage with a reason', () => {
    const untagged = all.filter((u) => !u.tag.includes('reason=')).map((u) => u.file)
    expect(
      untagged,
      `LiveUnavailable without a reason=: ${untagged.join(', ')}. ` +
        'Pick one from GAP_REASONS — it decides whether this panel offers an Integrations ' +
        'link, and an unfixable gap must not offer one.',
    ).toEqual([])
  })

  it('uses only reasons that exist in the registry', () => {
    // A typo'd reason resolves to null, which silently falls back to the
    // historical default — the exact wrong-link failure this guards.
    for (const u of all) {
      const m = /reason="([a-z-]+)"/.exec(u.tag)
      if (!m) continue
      expect(GAP_REASON_IDS as string[], `${u.file} uses unknown reason "${m[1]}"`).toContain(m[1])
    }
  })

  it('still gives every notice a human message, not just a reason code', () => {
    // The registry `why` is generic by design; the site-specific sentence is what
    // tells the reader which source, which symbol, which key.
    const noMessage = all.filter((u) => !u.tag.includes('message=')).map((u) => u.file)
    expect(noMessage).toEqual([])
  })
})
