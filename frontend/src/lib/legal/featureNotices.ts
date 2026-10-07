/**
 * The short not-advice lines that sit beside the features they qualify (T-293,
 * D50). They are the Finance Now rows of the "Short versions for the pages" table
 * at the end of the Not Investment Advice tab of the owner's "FN & NC — Disclosure
 * Set (Draft v1)", copied as written. The table's footer row is FOOTER_NOTICE
 * (./links), and its three News Charts rows belong to News Charts.
 *
 * Same rule as disclosures.ts: change a line in the owner's document first, then
 * copy it here. The Finance Now Ledger's file library held no copy of the set on
 * the copy date (D60), so these came from the Disclosure Set page itself.
 *
 * Where a page already carried a line of its own saying the same thing, this one
 * replaced it, and a line saying something more stayed beside it. The tab allows
 * both: "They replace or sit alongside the lines some pages already carry."
 *
 * Browser-safe on purpose, like ./links: these render inside client components,
 * and importing them from disclosures.ts would ship the full Terms and Privacy
 * Policy to every page that shows one. __tests__/featureNotices.test.ts pins
 * where each line is placed.
 */

/** Where the lines were copied from. A test holds the revision to DISCLOSURE_SOURCE's. */
export const FEATURE_NOTICES_SOURCE = {
  document: 'FN & NC — Disclosure Set (Draft v1)',
  tab: 'Not Investment Advice',
  revision: 5,
  copiedOn: '2026-10-07',
} as const

/** One line per row of the draft's table; the comment is the row's "Where" column. */
export const FEATURE_NOTICES = {
  /** "Finance Now: Portfolio Builder" */
  portfolioBuilder: 'A rules-based model built from the figures you entered, not a recommendation. The same inputs give anyone the same plan.',
  /** "Finance Now: Trade Risk Scorer and calculators" */
  calculators: "Arithmetic on the figures you entered. It describes this position; it doesn't recommend it.",
  /**
   * "Finance Now: assistant, Research and Daily Brief". Also on the AI scans of
   * the stock and macro scanners, which run research agents through the same route.
   */
  aiAnswers: 'Machine-written from the data shown and web searches. It can be wrong and is not advice.',
  /** "Finance Now: Pump Report" */
  pumpReport: 'Signals computed from public market data, plus AI summaries of web search results. Not a finding of fraud, and not advice.',
  /** "Crypto pages on both products". ModuleGate puts it under every crypto page (the registry's pageNotice). */
  crypto: 'Crypto assets are highly volatile and can lose all their value.',
  /** "Finance Now: questions about a video" */
  videoAnswers: 'Answered by an AI model from the video. It can be wrong and is not advice.',
} as const

export type FeatureNoticeId = keyof typeof FEATURE_NOTICES
