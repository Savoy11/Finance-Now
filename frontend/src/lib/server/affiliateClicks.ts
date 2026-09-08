import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Per-provider affiliate click counts.
 *
 * ── What this deliberately does NOT record ────────────────────────────────
 *
 * No user id, no session id, no IP address, no cookie, no user agent, no
 * timestamp per click. The stored shape is a bare `{ [providerId]: number }`
 * plus a first/last-seen date for the file as a whole.
 *
 * The ROADMAP asks to "track click-through per provider so the value is
 * measurable, without shipping user-identifying analytics", and those two
 * halves pull against each other: every field that would make an analytics
 * product useful is a field that identifies someone. A counter answers the only
 * question actually being asked — is this link worth anything? — and answers
 * nothing else. It cannot be joined to a person later, because there is nothing
 * to join on. The release-gate no-tracking search stays clean by construction
 * rather than by policy.
 *
 * Stored in a gitignored JSON file at the frontend root, matching the existing
 * `.provider-config.json` / `.agent-prompts.json` idiom. Deliberately not a DB
 * table: no migration, no DATABASE_URL dependency, and the data is disposable —
 * losing it costs a statistic, not a user's work.
 */

const CLICKS_PATH = path.join(process.cwd(), '.affiliate-clicks.json')

export interface AffiliateClickFile {
  /** providerId → total clicks. Nothing else, on purpose. */
  counts: Record<string, number>
  /** When counting began, for reading a rate off a total. */
  since: string
  updatedAt: string
}

const EMPTY: AffiliateClickFile = { counts: {}, since: '', updatedAt: '' }

function read(): AffiliateClickFile {
  try {
    if (!fs.existsSync(CLICKS_PATH)) return { ...EMPTY, counts: {} }
    const raw = JSON.parse(fs.readFileSync(CLICKS_PATH, 'utf8')) as Partial<AffiliateClickFile>
    return {
      counts: typeof raw.counts === 'object' && raw.counts ? raw.counts : {},
      since: typeof raw.since === 'string' ? raw.since : '',
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    }
  } catch {
    // A corrupt counter must never break an outbound link.
    return { ...EMPTY, counts: {} }
  }
}

/** Read the counts. Never throws. */
export function readAffiliateClicks(): AffiliateClickFile {
  return read()
}

/**
 * Increment one provider's counter.
 *
 * Returns false when the write fails — the caller answers 200 regardless,
 * because a lost count must never stop the reader reaching the provider.
 */
export function recordAffiliateClick(providerId: string, now: Date = new Date()): boolean {
  try {
    const file = read()
    const iso = now.toISOString()
    file.counts[providerId] = (file.counts[providerId] ?? 0) + 1
    if (!file.since) file.since = iso
    file.updatedAt = iso
    fs.writeFileSync(CLICKS_PATH, JSON.stringify(file, null, 2), { encoding: 'utf8', mode: 0o600 })
    return true
  } catch {
    return false
  }
}
