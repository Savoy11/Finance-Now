/**
 * Whether the app shows any risk rating at all. OFF since 2026-10-04 (D64).
 *
 * Owner, verbatim: "We will need to remove it until the risk engine is rebuilt.
 * We can add an item for a pre launch rebuild of the risk engine and to address
 * applying risk scores again later. This project will also require significant
 * compliance and regulatory research to determine if and how risk can be
 * assessed for each asset type."
 *
 * Switched off, not deleted: the engine (lib/risk/), the instrument tiers
 * (lib/data/instruments.ts), the fund risk level (lib/data/fundCatalog.ts) and
 * the options scorer's page and route all stay in place for the rebuild to
 * start from. What this switch governs:
 *
 *   - Portfolios: each holding's rating out of 10, the Weighted Risk figure and
 *     its label, and the two diversification warnings derived from it.
 *   - Fund pages: the "Risk Profile" line, and the riskLevel field on
 *     /live-data/fund-universe.
 *   - The options Trade Risk Scorer: POST/GET /api/v1/options/score answer 503
 *     and the score_options_trade agent tool is not offered. Its page is hidden
 *     by a redirect in next.config.mjs and by the missing nav entry in
 *     lib/modules/registry.ts, and the MCP tool is commented out in
 *     mcp-server/src/index.ts; those three do not read this constant.
 *
 * The Pump Report is not covered (D70, 2026-10-04). Its page rates scam signals
 * on wallet addresses, and its tab on each coin's page shows a 0-10 pump signal
 * and a "collapse risk" grade worked out from 24-hour price and volume. The
 * owner kept both as an alert that an asset is being targeted by pump and meme
 * traders, not a rating of how risky it is to own.
 *
 * D92 (2026-10-07) narrows what may come back, after the research in
 * docs/assessments/risk-ratings-by-asset-type-2026-10-07.md: a rating on crypto
 * coins' and stocks' own pages, once counsel confirms it, and nothing else.
 * Portfolios' ratings and Weighted Risk do not return, the fund label gives way
 * to facts and the options scorer to an ungraded calculator. So setting this
 * to true as it stands would bring back surfaces D92 rules out: the rebuild
 * (T-420) replaces it first.
 *
 * TO RESTORE, after the rebuild and the compliance research (see D64's items in
 * docs/audits/task-queue-2026-09-07.json): set this to true, re-add the nav
 * entry, delete the redirect, un-comment the MCP tool, and revisit
 * lib/risk/__tests__/riskRatingsHidden.test.ts, which fails until each of those
 * is decided again.
 */
export const RISK_RATINGS_SHOWN = false

/**
 * Whether the asset-page ratings (T-420; D92, D94, D95) are shown. OFF.
 *
 * Separate from RISK_RATINGS_SHOWN, which keeps governing the surfaces D92 ruled
 * out. This one governs only what D92 allows: the measured-risk rating on a crypto
 * coin's own page and a stock's own page (docs/architecture/risk-ratings-methodology.md).
 *
 * While it is false:
 *   - /live-data/coin-rating and /live-data/stock-rating answer only on the owner's
 *     own machine (a localhost request) or to a caller holding FN_ADMIN_TOKEN, through
 *     guardSensitiveRoute, the guard the AI routes use. Anyone else gets 403/401. That
 *     keeps a deployed build closed while the owner runs the methodology's §8
 *     validation locally.
 *   - No page renders a rating, and no /api/v1 route, MCP tool or agent tool reads one
 *     (lib/risk/__tests__/assetRatingsHidden.test.ts).
 *
 * TO TURN ON: counsel confirms the form (D4; the risk-ratings memo's §8, questions
 * 1, 2 and 6), the owner's holdings policy is written (methodology §11), and the owner
 * says so. Then revisit assetRatingsHidden.test.ts, which fails until each surface is
 * decided again.
 */
export const ASSET_PAGE_RATINGS_SHOWN = false
