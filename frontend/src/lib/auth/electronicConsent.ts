import { SIGNUP_CONSENT, SIGNUP_CONSENT_WORDING } from '@/lib/legal/signupConsent'

/**
 * Consent to email notices at sign-up (T-436; owner decisions D124 and D127, 2026-10-17).
 *
 * Creating an account requires agreeing to get notices by email, breach notices included,
 * because North Carolina allows an emailed breach notice only to people who agreed to receive
 * communications electronically (G.S. 75-65(e)(2)), and the app has no other way to reach
 * anyone. The words are lib/legal/signupConsent.ts; this file is the rule.
 *
 * Pure: no database, no clock. The sign-up route and `npm run auth:consent` supply those.
 *
 * - The box must be ticked: `electronicConsent` is the boolean `true`, nothing that merely
 *   looks like it ("true", 1).
 * - It must be the current wording: `consentVersion` equals SIGNUP_CONSENT.version, so a page
 *   loaded before the words changed cannot store an agreement to words it never showed.
 * - What is stored is the wording itself, not a pointer to it, so the record stands on its own.
 * - A withdrawal is marked on the agreement, never removed (the no-deletion rule).
 */

export const CONSENT_REQUIRED_MESSAGE =
  'Creating an account needs your agreement to get notices by email (Terms of Use, section 6).'
export const CONSENT_STALE_MESSAGE =
  'The wording you agreed to has changed since the page loaded. Reload it, read the box again and tick it.'

export type ConsentCheck = { ok: true } | { ok: false; status: 400; message: string }

export function checkSignupConsent(electronicConsent: unknown, consentVersion: unknown): ConsentCheck {
  if (electronicConsent !== true) return { ok: false, status: 400, message: CONSENT_REQUIRED_MESSAGE }
  if (consentVersion !== SIGNUP_CONSENT.version) return { ok: false, status: 400, message: CONSENT_STALE_MESSAGE }
  return { ok: true }
}

/** Sent back with a refusal, so whoever is signing up can see what they are asked to agree to. */
export function consentPrompt() {
  return { label: SIGNUP_CONSENT.label, version: SIGNUP_CONSENT.version, terms: SIGNUP_CONSENT.termsHref }
}

/** The communication_consents row stored with a new account, in the same transaction. */
export function signupConsentRecord(userId: string, now: Date) {
  return {
    userId,
    wordingVersion: SIGNUP_CONSENT.version,
    wording: SIGNUP_CONSENT_WORDING,
    givenVia: 'sign-up',
    agreedAt: now,
  }
}

export interface ConsentRow {
  email: string
  agreedAt: Date | null
  withdrawnAt: Date | null
  wordingVersion: string | null
}

export type ConsentStanding =
  | { email: string; state: 'agreed'; since: Date; wordingVersion: string }
  | { email: string; state: 'withdrawn'; since: Date }
  | { email: string; state: 'none' }

/**
 * Each account's standing, from users left-joined to their agreements (one row per agreement,
 * or one row of nulls for an account with none). An account may be sent notices by email
 * while it holds an agreement that has not been withdrawn; the newest such one is reported.
 */
export function consentStandings(rows: ConsentRow[]): ConsentStanding[] {
  const byEmail = new Map<string, ConsentRow[]>()
  for (const r of rows) byEmail.set(r.email, [...(byEmail.get(r.email) ?? []), r])

  const standings: ConsentStanding[] = []
  for (const [email, list] of byEmail) {
    const given = list.filter((r): r is ConsentRow & { agreedAt: Date } => r.agreedAt !== null)
    const active = given.filter((r) => r.withdrawnAt === null).sort((a, b) => b.agreedAt.getTime() - a.agreedAt.getTime())
    if (active.length > 0) {
      standings.push({ email, state: 'agreed', since: active[0].agreedAt, wordingVersion: active[0].wordingVersion ?? '' })
      continue
    }
    const withdrawn = given
      .map((r) => r.withdrawnAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())
    standings.push(withdrawn.length > 0 ? { email, state: 'withdrawn', since: withdrawn[0] } : { email, state: 'none' })
  }
  return standings.sort((a, b) => a.email.localeCompare(b.email))
}

/** Whether a notice may go to this account by email. */
export function mayEmailNotices(standing: ConsentStanding): boolean {
  return standing.state === 'agreed'
}
