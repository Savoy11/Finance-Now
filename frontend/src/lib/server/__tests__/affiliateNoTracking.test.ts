import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The release-gate "no-tracking search" — defined, at last (T-121).
 *
 * The ROADMAP asked for affiliate click-through "without shipping user-identifying
 * analytics", and T-121's last clause was "verify the release-gate no-tracking search
 * still passes". No such search existed; it was a phrase. This is it: the three files
 * on the click path are read as source and must contain none of the identifiers that
 * would let a count be joined to a person. `affiliateClicks.ts` already says it
 * withholds all of these by construction — this makes "by construction" checkable.
 *
 * Anti-vacuity: every file must exist and be non-trivial, and the forbidden list is
 * proven to bite by injecting one token into a copy of the source.
 */

const FILES = [
  'src/lib/server/affiliateClicks.ts',
  'src/app/api/affiliate/clicks/route.ts',
  'src/components/ui/SponsoredLink.tsx',
]

// Anything that identifies a visitor, or that would carry a per-click timestamp.
const FORBIDDEN: Array<[RegExp, string]> = [
  [/x-forwarded-for|x-real-ip|req\.ip\b|\.ip\b/i, 'client IP'],
  [/\bcookies?\(|\.cookies\b|document\.cookie/i, 'cookies'],
  // Code-shaped on purpose: the route's own disclosure string says "No user, session,
  // IP, cookie … is recorded", and a bare-word match would fail the guard on the
  // sentence that states the property. A header name, a member access or a call
  // is what actually reads one.
  [/['"]user-agent['"]|\.userAgent\b/i, 'user agent'],
  [/\bsessionId\b|getServerSession|useSession|\.session\b|\bsession\s*\(/i, 'session'],
  [/\buserId\b|getCurrentUserId|requireUserId/i, 'user id'],
  [/fingerprint|localStorage|sessionStorage|navigator\./i, 'client fingerprint or storage'],
  [/\.toISOString\(\)(?!\.slice\(0, 10\))/, 'a full timestamp — only YYYY-MM-DD may be written'],
  [/Date\.now\(\)|performance\.now\(\)/, 'a millisecond clock'],
  [/gtag|analytics|posthog|mixpanel|segment\.|plausible|umami/i, 'a third-party analytics call'],
]

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('affiliate click path — the release-gate no-tracking search (T-121)', () => {
  const sources = FILES.map((rel) => ({ rel, src: fs.readFileSync(path.join(process.cwd(), rel), 'utf8') }))

  it('reads all three files on the click path, and each is real code', () => {
    for (const { rel, src } of sources) expect(strip(src).length, rel).toBeGreaterThan(300)
  })

  it('none of them touches anything that identifies a visitor', () => {
    for (const { rel, src } of sources) {
      const code = strip(src)
      for (const [re, what] of FORBIDDEN) expect(code, `${rel} references ${what}: ${re}`).not.toMatch(re)
    }
  })

  it('the POST body is the provider id and nothing else', () => {
    const link = strip(sources[2].src)
    expect(link).toMatch(/JSON\.stringify\(\{ providerId \}\)/)
  })

  it('the stored shape carries counts and two days only', () => {
    const mod = strip(sources[0].src)
    const iface = mod.match(/export interface AffiliateClickFile \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const fields = [...iface.matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
    expect(fields).toEqual(['counts', 'since', 'updatedAt'])
  })

  it('guards the guard: the forbidden list bites on an injected identifier', () => {
    const tainted = strip(sources[0].src) + "\nconst who = req.headers.get('x-forwarded-for')\n"
    const hit = FORBIDDEN.filter(([re]) => re.test(tainted))
    expect(hit.map(([, what]) => what)).toContain('client IP')
  })
})
