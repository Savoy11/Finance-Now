/**
 * Where the About & Legal pages live, and the footer's line and links.
 *
 * Kept apart from disclosures.ts on purpose: the footer, the paid-link tag and
 * the staking page run in the browser, and importing these few strings from the
 * file that holds the full Terms and Privacy Policy would ship that whole text
 * with every page that shows a footer.
 */

export const LEGAL_PATHS = {
  about: '/about',
  terms: '/about/terms',
  privacy: '/about/privacy',
  notAdvice: '/about/not-investment-advice',
  openSource: '/about/open-source',
} as const

/** /how-we-make-money redirects here (next.config.mjs). */
export const HOW_WE_MAKE_MONEY_HREF = `${LEGAL_PATHS.about}#how-we-make-money`

/** The disclosure draft's footer line ("Short versions for the pages"), every page. */
export const FOOTER_NOTICE = 'General information, not investment advice. Data may be delayed or wrong.'

export const FOOTER_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: LEGAL_PATHS.about, label: 'About' },
  { href: LEGAL_PATHS.terms, label: 'Terms' },
  { href: LEGAL_PATHS.privacy, label: 'Privacy' },
  { href: LEGAL_PATHS.notAdvice, label: 'Not investment advice' },
]
