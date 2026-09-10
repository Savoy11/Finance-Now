/**
 * Why a figure is not live — the registry behind every "not available" marker.
 *
 * Finance Now runs live-only, so a surface with no source shows an honest gap
 * rather than a fabricated number. That was already true; what was missing is
 * WHY. A dash, an `est` chip and a "not available" panel all told the reader
 * that something was absent and left them with no way to tell apart:
 *
 *   - nothing on earth publishes this figure          (chasing it is wasted work)
 *   - a source exists and this request did not reach it (a real bug)
 *   - a free API key would fix it today                (one click away)
 *   - it is derived or curated on purpose             (working as intended)
 *
 * Those have opposite responses, and collapsing them is how a permanent
 * limitation gets re-investigated every quarter while an actual regression sits
 * behind the same grey dash for months.
 *
 * `fixability` is therefore the field that matters, and the UI colours by it:
 * a gap worth fixing is meant to stand out, and one that is not is meant to stop
 * asking for attention.
 *
 * Pure and dependency-free on purpose — `__tests__/dataGaps.test.ts` covers it,
 * and route handlers import it to declare a reason per field.
 */

/** What would actually close a gap. Drives the marker's colour and urgency. */
export type GapFixability =
  /** A free API key closes it. Actionable by the owner today, on /settings. */
  | 'add-a-key'
  /** A source exists; reaching it is engineering work or a paid plan. A REAL gap. */
  | 'needs-work'
  /** Nothing publishes this at any price. Not worth chasing — say so and stop. */
  | 'no-source'
  /** Deliberately not a live reading: derived, curated, or withheld by decision. */
  | 'by-design'
  /**
   * Self-resolving: the source was reachable and simply declined this request.
   * The next refresh is expected to succeed, so there is nothing to fix and
   * nothing permanent to record. Its own category because the alternatives both
   * mislead — `needs-work` sends someone after a bug that is not there, and
   * `no-source` implies the figure is unobtainable when it arrived fine a minute
   * ago.
   */
  | 'transient'

export type GapReasonId =
  | 'no-upstream'
  | 'upstream-failed'
  | 'rate-limited'
  | 'derived-estimate'
  | 'curated-estimate'
  | 'needs-api-key'
  | 'paid-plan-only'
  | 'terms-prohibited'
  | 'robots-gated'
  | 'geo-blocked'
  | 'not-filed'

export interface GapReason {
  id: GapReasonId
  /** Two-to-four character chip text. Kept tiny — these sit inside table cells. */
  chip: string
  /** Heading for the popover. What kind of gap this is. */
  label: string
  /**
   * Why the figure is absent, in the reader's terms rather than ours. Written to
   * be true of every site that uses it, so a call site adds specifics via
   * `detail` instead of rewording this.
   */
  why: string
  fixability: GapFixability
  /** What would close it. Omitted only where nothing would. */
  fix?: string
}

/**
 * Every reason a value can be missing, and what to do about each.
 *
 * Each entry earned its place from a real surface in this app — see
 * DATA-AVAILABILITY.md. Add a reason when a genuinely new *cause* appears, not
 * when a new surface hits an existing one: the point of a closed set is that the
 * gaps can be counted and triaged.
 */
export const GAP_REASONS: Record<GapReasonId, GapReason> = {
  'no-upstream': {
    id: 'no-upstream',
    chip: 'est',
    label: 'No source publishes this',
    why:
      'Nothing we can reach publishes this figure, at any price. The value shown is a ' +
      'dated reference estimate, not a reading.',
    fixability: 'no-source',
  },
  'upstream-failed': {
    id: 'upstream-failed',
    chip: 'est',
    label: 'Source did not answer',
    why:
      'A live source exists for this figure and it did not answer this request, so a ' +
      'reference estimate is shown instead. This is a fault, not a limitation.',
    fixability: 'needs-work',
    fix: 'Worth investigating — the source was reachable before.',
  },
  'rate-limited': {
    id: 'rate-limited',
    chip: 'wait',
    label: 'Source is rate-limiting us',
    why:
      'The provider’s free tier declined this request for arriving too soon after the ' +
      'last one. Nothing is broken and the figure is not missing — it is expected back ' +
      'on the next refresh.',
    fixability: 'transient',
    fix: 'Refreshes on its own. A paid provider key would raise the ceiling.',
  },
  'derived-estimate': {
    id: 'derived-estimate',
    chip: 'calc',
    label: 'Derived, not measured',
    why:
      'Calculated from a related live reading rather than measured directly, so it ' +
      'moves with that reading but is not itself a quote for this figure.',
    fixability: 'by-design',
  },
  'curated-estimate': {
    id: 'curated-estimate',
    chip: 'ref',
    label: 'Hand-maintained reference',
    why:
      'A reference value compiled by hand and dated, kept because no feed carries it. ' +
      'Accurate as of its verification date, not as of now.',
    fixability: 'by-design',
    fix: 'Confirm the current figure with the provider before acting on it.',
  },
  'needs-api-key': {
    id: 'needs-api-key',
    chip: 'key',
    label: 'Needs an API key',
    why:
      'A live source covers this, but it requires an API key and none is configured. ' +
      'Nothing is wrong — the source simply has not been connected.',
    fixability: 'add-a-key',
    fix: 'Add a free key on the Integrations page.',
  },
  'paid-plan-only': {
    id: 'paid-plan-only',
    chip: 'paid',
    label: 'Behind a paid plan',
    why:
      'The provider carries this figure but paywalls it on the free tier, so a narrower ' +
      'or curated substitute is shown. The substitute is labelled wherever it appears.',
    fixability: 'needs-work',
    fix: 'Closed by a paid plan, or by finding a free provider that carries it.',
  },
  'terms-prohibited': {
    id: 'terms-prohibited',
    chip: 'n/a',
    label: 'Not permitted by the source',
    why:
      'A source carries this, but its terms do not permit us to fetch or redistribute ' +
      'it. Withheld on that basis rather than on availability.',
    fixability: 'no-source',
  },
  'robots-gated': {
    id: 'robots-gated',
    chip: 'key',
    label: 'Blocked by robots.txt',
    why:
      "The source's robots.txt disallows this app's crawler, so it is only read through " +
      'the provider’s supported authenticated path.',
    fixability: 'add-a-key',
    fix: 'Add the provider’s credentials to read it through the supported path.',
  },
  'geo-blocked': {
    id: 'geo-blocked',
    chip: 'alt',
    label: 'Blocked in this region',
    why:
      'The intended venue refuses requests from this region, so a substitute venue is ' +
      'serving instead. Its prices and liquidity differ.',
    fixability: 'no-source',
  },
  'not-filed': {
    id: 'not-filed',
    chip: 'n/a',
    label: 'Not published by the issuer',
    why:
      'This issuer files no document carrying the figure, so there is nothing to read. ' +
      'A structural fact about how it reports, not a fetch failure.',
    fixability: 'no-source',
  },
}

/** Reasons in a stable order, for docs and for the gap inventory. */
export const GAP_REASON_IDS = Object.keys(GAP_REASONS) as GapReasonId[]

/**
 * A gap worth someone's time.
 *
 * `add-a-key` and `needs-work` are actionable. `no-source` and `by-design` are
 * not, and flagging them as work is how a limitation gets re-litigated forever.
 *
 * `transient` is deliberately NOT actionable: a rate-limited request resolves
 * itself, so drawing the eye to it would train the reader to ignore the marker
 * that matters. It still explains itself when asked — the reader who wonders why
 * a figure is blank gets an answer; nobody gets a task.
 *
 * The UI uses this to decide whether a marker draws attention.
 */
export function isActionable(reason: GapReason | GapReasonId): boolean {
  const r = typeof reason === 'string' ? GAP_REASONS[reason] : reason
  return r.fixability === 'add-a-key' || r.fixability === 'needs-work'
}

/** Look up a reason, or null for an unknown id — never a fabricated fallback. */
export function gapReason(id: string | null | undefined): GapReason | null {
  if (!id) return null
  return GAP_REASONS[id as GapReasonId] ?? null
}
