/**
 * The sign-up box for email notices (T-436; owner decisions D124 and D127, 2026-10-17).
 *
 * North Carolina lets a breach notice go by email only to people "who have agreed to receive
 * communications electronically" (G.S. 75-65(e)(2)), and the app holds no postal address or
 * phone number to fall back on. So creating an account requires agreeing (D127), and the
 * agreement is stored with its date and the exact words agreed to (communication_consents,
 * migration 0009; lib/auth/electronicConsent.ts).
 *
 * WHERE THE WORDS COME FROM. The rule in ./disclosures.ts: the owner's document first, then
 * copied here. The clause is the Terms of Use's section 6 paragraph (EMAIL_NOTICES_CLAUSE, tab
 * rev 6). The box's label is the one written in the "Read me first" tab's row for it (rev 22).
 * Both are a draft for counsel (D4), under the same draft notice as the rest of the set.
 *
 * `version` names this exact wording: the first 16 hex characters of the SHA-256 of
 * SIGNUP_CONSENT_WORDING. Change either text and a test fails until the version moves with it,
 * so every stored agreement points at the words it was given to. Agreements already stored keep
 * their own wording; whether to ask again after a change is a decision for that day.
 *
 * Plain strings only, no crypto, so a sign-up page can import this in the browser.
 */

import { DISCLOSURE_SOURCE, EMAIL_NOTICES_CLAUSE, LEGAL_PATHS, sectionId } from './disclosures'

export const SIGNUP_CONSENT = {
  label: 'I agree to get notices from Finance Now by email, including any notice of a data breach, as section 6 of the Terms of Use describes.',
  clause: EMAIL_NOTICES_CLAUSE,
  /** Where the label points: section 6 of the Terms page. */
  termsHref: `${LEGAL_PATHS.terms}#${sectionId('6. Accounts and saved data')}`,
  version: '5323ad5e387cd238',
  source: {
    document: DISCLOSURE_SOURCE.document,
    copiedOn: '2026-10-17',
    label: { tab: 'Read me first', revision: 22 },
    clause: { tab: 'Terms of Use', revision: 6 },
  },
} as const

/** The words stored with each agreement: the box's label, then the clause it points to. */
export const SIGNUP_CONSENT_WORDING = `${SIGNUP_CONSENT.label}\n\n${SIGNUP_CONSENT.clause}`
