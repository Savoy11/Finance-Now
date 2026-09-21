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
 * "Date" means a DAY — `YYYY-MM-DD` — and `toDay()` below is the only thing
 * that writes one. Until 2026-09-21 this module wrote a full `toISOString()`
 * into `updatedAt` on every click, which quietly made `updatedAt` a per-click
 * timestamp at millisecond precision: the exact moment of the most recent
 * click, refreshed by each new one. That is the correlation handle the whole
 * design exists to withhold — poll the counter and you recover a click
 * timeline that can be lined up against anything else that knows who was on
 * the site at that instant. A day is enough to read a rate off a total, which
 * is the only thing these two fields are for, and is too coarse to line up
 * against anything. Values read back from an older file are truncated on the
 * way in, so a file written before this change loses the precision too.
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
  /** `YYYY-MM-DD` — the day counting began, for reading a rate off a total. */
  since: string
  /** `YYYY-MM-DD` — the day of the most recent click. Never finer than a day. */
  updatedAt: string
}

/** The only writer of a date in this module. Day precision, never finer. */
function toDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Truncates a date read back from disk, so an older, finer value cannot survive. */
function asDay(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 10) : ''
}

const EMPTY: AffiliateClickFile = { counts: {}, since: '', updatedAt: '' }

function read(): AffiliateClickFile {
  try {
    if (!fs.existsSync(CLICKS_PATH)) return { ...EMPTY, counts: {} }
    const raw = JSON.parse(fs.readFileSync(CLICKS_PATH, 'utf8')) as Partial<AffiliateClickFile>
    return {
      counts: typeof raw.counts === 'object' && raw.counts ? raw.counts : {},
      since: asDay(raw.since),
      updatedAt: asDay(raw.updatedAt),
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
    const day = toDay(now)
    file.counts[providerId] = (file.counts[providerId] ?? 0) + 1
    if (!file.since) file.since = day
    file.updatedAt = day
    fs.writeFileSync(CLICKS_PATH, JSON.stringify(file, null, 2), { encoding: 'utf8', mode: 0o600 })
    return true
  } catch {
    return false
  }
}
