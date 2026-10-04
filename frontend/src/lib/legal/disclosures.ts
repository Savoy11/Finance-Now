/**
 * Finance Now's public documents — the About page, the Terms of Use, the Privacy
 * Policy and the Not Investment Advice notice — and the footer that links them.
 *
 * WHERE THE WORDS COME FROM. Every sentence below was copied from the owner's
 * "FN & NC — Disclosure Set (Draft v1)", drafted in the business chat on
 * 2026-09-29/30 (T-291), on the date and at the tab revisions recorded in
 * DISCLOSURE_SOURCE. Nothing here is newly written legal text. The only additions
 * are links, wherever the text refers to another of these pages, and three short
 * pointers on the About page the draft did not word (marked "not from the draft"
 * below). Change the wording in the document first, then copy it here: a page
 * edited in two places stops being one document.
 *
 * WHERE THE DOCUMENTS LIVE NOW (D60, 2026-10-04). In the file libraries of the two
 * ledger pages, Finance Now's and News Charts'. A document both products share is the
 * same file in both. The next copy comes from the ledger upload, after comparing the
 * two, and DISCLOSURE_SOURCE then names that upload. Until something is uploaded, the
 * copy below stays the one taken from the Disclosure Set page on 2026-10-01.
 *
 * WHERE IT LIVES ON SCREEN (D50, 2026-09-30). One About page, reached from a
 * footer link on every page and from Settings, where "About & Legal" replaced
 * How We Make Money. The three long documents get their own pages under /about so
 * the footer can link straight to them. Privacy keeps its own footer link
 * (CalOPPA; CoinGecko API Terms §7(e)).
 *
 * ⚠ IT IS A DRAFT, AND THE PAGES SAY SO. DISCLOSURE_STATUS stays 'draft' until the
 * owner approves the set. The bracketed blanks ([COMPANY LLC NAME], [CONTACT
 * EMAIL]…) are left exactly as the draft has them and render highlighted, and
 * some statements describe the site as it should stand at launch rather than as
 * it is today (the draft's "Read me first" tab lists them). `disclosuresInForce()`
 * is what takes the draft notice off, and it needs BOTH an approval and zero
 * blanks — approving a page that still says "[CONTACT EMAIL]" is not possible.
 */

import { DATA_SOURCES, requiredAttributions } from '@/lib/data/dataSources'
import { blanksIn } from './inline'
import { FOOTER_LINKS, FOOTER_NOTICE, HOW_WE_MAKE_MONEY_HREF, LEGAL_PATHS } from './links'

export { FOOTER_LINKS, FOOTER_NOTICE, HOW_WE_MAKE_MONEY_HREF, LEGAL_PATHS }

// ─── Status and provenance ──────────────────────────────────────────────────

/** 'draft' until the owner approves the disclosure set; see the header. */
export const DISCLOSURE_STATUS: 'draft' | 'approved' = 'draft'

/** What was copied, from where, and when — so a re-copy can tell what moved. */
export const DISCLOSURE_SOURCE = {
  document: 'FN & NC — Disclosure Set (Draft v1)',
  copiedOn: '2026-10-01',
  /** Tab revisions as read on copiedOn. */
  revisions: {
    'About page': 5,
    'Terms of Use': 5,
    'Privacy Policy': 16,
    'Not Investment Advice': 5,
    'How We Make Money': 13,
    'Contact & Complaints': 3,
  },
} as const

/**
 * The blanks the draft defines ("Blanks to fill before publishing"). A blank
 * that is not on this list is a typo, and a test fails on it. [AD NETWORK] is
 * News Charts' and does not occur on these pages.
 */
export const KNOWN_BLANKS = [
  '[COMPANY LLC NAME]', '[MAILING ADDRESS]', '[CONTACT EMAIL]',
  '[FINANCE NOW URL]', '[NEWS CHARTS URL]', '[EFFECTIVE DATE]',
  '[HOSTING PROVIDER]', '[BACKUP PERIOD]', '[LOG PERIOD]', '[AD NETWORK]',
] as const

// Addresses and the footer's line and links are in ./links (see its header).
const CONTACT_HREF = `${LEGAL_PATHS.about}#questions-and-complaints`

// ─── Shapes ─────────────────────────────────────────────────────────────────

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  /** A pointer to the full text elsewhere ("Read the full notice"). */
  | { kind: 'more'; href: string; text: string }

export interface LegalSection {
  id: string
  heading: string
  blocks: LegalBlock[]
}

export interface LegalDocument {
  title: string
  path: string
  /** "Effective [EFFECTIVE DATE]" until the date exists. */
  effective?: string
  intro: LegalBlock[]
  sections: LegalSection[]
}

const p = (text: string): LegalBlock => ({ kind: 'p', text })
const list = (...items: string[]): LegalBlock => ({ kind: 'list', items })

/** "12. No warranties" → "no-warranties": the heading keeps its number, the anchor drops it. */
export function sectionId(heading: string): string {
  return heading
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const section = (heading: string, ...blocks: LegalBlock[]): LegalSection => ({ id: sectionId(heading), heading, blocks })

// ─── Terms of Use (draft tab rev 5) ─────────────────────────────────────────

export const TERMS_OF_USE: LegalDocument = {
  title: 'Terms of Use',
  path: LEGAL_PATHS.terms,
  effective: 'Effective [EFFECTIVE DATE]',
  intro: [
    p(`These terms are an agreement between you and [COMPANY LLC NAME] ("we", "us"), a North Carolina limited liability company doing business as Finance Now and News Charts. They cover Finance Now at [FINANCE NOW URL], News Charts at [NEWS CHARTS URL], and any app, API or feature we offer under those names (together, "the Services"). By using the Services you agree to these terms and to our [Privacy Policy](${LEGAL_PATHS.privacy}). If you don't agree, please don't use the Services.`),
  ],
  sections: [
    section('1. What the Services are',
      p("Finance Now is a research site for crypto assets, stocks, funds and macro markets: prices, charts, news, filings, and tools that work on figures you enter. News Charts places news, filings and historical events on a timeline beside an asset's price. Both are information services. We don't manage money, hold assets or execute trades, and we are not a broker, dealer or investment adviser."),
    ),
    section('2. Who may use them',
      p('You must be at least 18 and in the United States. The Services are built for US users; if you use them from elsewhere, following your local laws is your responsibility. You may not use the Services if US law, including US sanctions, bars you from receiving them.'),
    ),
    section('3. Not investment advice',
      p("Everything in the Services is general information, published the same way for everyone. Nothing in them recommends buying, selling or holding any security, crypto asset or other investment, or says that an investment suits you. We don't know your full financial situation. Where a tool asks about your goals or tolerance for risk, it applies fixed rules to your answers and knows nothing else about you."),
      p(`Tools that work on figures you enter, such as calculators, scorers and plan builders, apply fixed rules to your inputs. Their results are arithmetic, not advice. Talk to a licensed professional before making investment, tax or legal decisions. Our full notice is on the [Not Investment Advice](${LEGAL_PATHS.notAdvice}) page.`),
    ),
    section('4. Market data and its limits',
      p('Prices, rates, yields, fees, filings and news come from third parties. They can be delayed, incomplete, revised or wrong. Where no current figure is available, the Services say so, or show a reference value labelled as one.'),
      p("Crypto assets are especially volatile: prices can fall to zero, and markets can be manipulated or halted. Past performance, models and back-calculations don't predict future results. Check any figure before relying on it."),
      p('We alone are responsible for the disclosures, disclaimers and warnings in the Services about the nature, accuracy and limits of their data. Our data providers are not.'),
    ),
    section('5. Third-party data and providers',
      p('Much of the data in the Services comes from third parties named on our [Data Sources](/data-sources) page, and that data belongs to them. In particular, the CoinGecko API and the data it supplies are the property of CoinGecko.'),
      list(
        'You may view provider data in the Services for your own use. You may not copy it in bulk, scrape it, redistribute, resell or sublicense it, or use it to build a competing database or service.',
        "Each provider's own terms also apply to its data, and a provider may enforce these restrictions for its data.",
        'Our providers make no promises to you and have no liability to you for any use of their data through the Services, including any financial decision or outcome. CoinGecko excludes and disclaims all liability for any use of the CoinGecko API through the Services.',
        'As between you and our providers, including CoinGecko, we alone are responsible for offering their data to you as part of the Services.',
        'A provider can change or withdraw its data at any time. When it does, parts of the Services may change or stop working.',
      ),
    ),
    section('6. Accounts and saved data',
      p('**Finance Now.** Some features let you save portfolios, watchlists, plans and wallet addresses. Where a feature needs an account, give accurate sign-in details and keep your password safe; you are responsible for activity under your account. What you enter stays yours. You let us store and process it only to run the Services for you, as the [Privacy Policy](/about/privacy) describes. You can delete saved items at any time, and ask us to delete your account.'),
      p('**News Charts.** There are no accounts. Notes, followed pages and settings you create stay in your browser.'),
    ),
    section('7. Your own keys and AI features',
      p('Some News Charts features let you enter your own key for a news or AI provider. When you do, your use of that provider is under your agreement with it, not ours. Its charges, limits and terms are yours to manage. Your key stays in your browser and goes straight to that provider; it never reaches our servers.'),
      p('AI features produce machine-written answers. They can be wrong, out of date or incomplete while sounding confident, and section 3 applies to them. Check an AI answer before relying on it. What you type into an AI feature goes to the AI provider named in that feature, as the [Privacy Policy](/about/privacy) explains.'),
    ),
    section('8. Acceptable use',
      p('You agree not to:'),
      list(
        'scrape, crawl or bulk-download the Services or their data, or access them by automated means, except through an API we offer for that purpose and within any limits we publish for it;',
        'redistribute, resell or publish data taken from the Services;',
        'interfere with, overload or probe the security of the Services, or get around any limit or access control;',
        'reverse engineer the Services, except where the law allows it;',
        'use the Services to break any law, including securities laws, or to mislead anyone, for example by presenting our data or tools as your own advice service;',
        "use someone else's account or key without their permission.",
      ),
    ),
    section('9. Links and advertising',
      p(`No link on Finance Now or News Charts is a paid link: we earn nothing when you follow one. If that changes, we will update these terms and our [How We Make Money](${HOW_WE_MAKE_MONEY_HREF}) page first, and label each paid link beside it. News Charts may show advertising, marked as ads. We don't endorse any advertised or linked product, and your dealings with any third party are between you and them.`),
    ),
    section('10. Our content and names',
      p('The software, design, text and our own analysis in the Services belong to us or our licensors. You may use them for your own research. "Finance Now" and "News Charts" are our names; don\'t use them in a way that suggests we endorse you.'),
    ),
    section('11. Links to other sites',
      p("The Services link to other sites, including publishers and providers. We don't control those sites and aren't responsible for them."),
    ),
    section('12. No warranties',
      p('We provide the Services "as is" and "as available". To the fullest extent the law allows, we make no warranties of any kind, express or implied, including warranties of accuracy, merchantability, fitness for a particular purpose and non-infringement. We don\'t promise that the Services or any data will be accurate, complete, timely, uninterrupted or free of errors.'),
    ),
    section('13. Limits on our liability',
      p('To the fullest extent the law allows:'),
      list(
        'we are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, trading or investment losses, or lost data, arising from the Services or these terms;',
        'our total liability for all claims about the Services or these terms is limited to the greater of $100 or what you paid us in the 12 months before the claim.',
      ),
      p("Some states don't allow some of these limits, so they may not all apply to you."),
    ),
    section('14. Indemnity',
      p('If someone brings a claim against us because you misused the Services or broke these terms, you agree to cover our reasonable losses and costs from that claim.'),
    ),
    section('15. Suspending or ending access',
      p('You can stop using the Services at any time. We may suspend or end your access if you break these terms, if the law requires it, or if we stop offering a Service. Sections 3, 4, 5, 12, 13, 14 and 17 continue after access ends.'),
    ),
    section('16. Changes',
      p("We may change the Services at any time. We may also update these terms: we'll post the new version with a new effective date. For material changes, we'll give notice in the Services, and by email if you have an account, before they take effect. Using the Services after a change takes effect means you accept it."),
    ),
    section('17. Governing law and disputes',
      p('North Carolina law governs these terms, without regard to its conflict-of-law rules. Any dispute will be decided in the state or federal courts located in Guilford County, North Carolina, and you and we agree to their jurisdiction. Before filing a claim, please contact us so we can try to resolve it informally.'),
    ),
    section('18. Paid plans',
      p('[Reserved. Before any paid plan launches, this section will set out pricing, billing, renewal, cancellation and refunds. The desktop edition will have its own licence.]'),
    ),
    section('19. General',
      p("These terms and the documents they refer to are the whole agreement between you and us about the Services. If part of them can't be enforced, the rest still applies. If we don't enforce a term right away, we haven't given it up. You may not transfer these terms; we may transfer them to a business that takes over the Services."),
    ),
    section('20. Contact',
      p(`[COMPANY LLC NAME], [MAILING ADDRESS]. Email: [CONTACT EMAIL]. Questions and complaints are handled as described on our [Contact & Complaints](${CONTACT_HREF}) page.`),
    ),
  ],
}

// ─── Privacy Policy (draft tab rev 16) ──────────────────────────────────────

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  path: LEGAL_PATHS.privacy,
  effective: 'Effective [EFFECTIVE DATE]',
  intro: [
    p('We collect only what the Services need to work, we never sell it, and most of what you set up stays in your own browser. This policy explains what [COMPANY LLC NAME], doing business as Finance Now and News Charts, collects, why, who receives it, how long we keep it, and your choices. It covers [FINANCE NOW URL] and [NEWS CHARTS URL].'),
  ],
  sections: [
    section('1. At a glance', {
      kind: 'table',
      head: ['', 'Finance Now', 'News Charts'],
      rows: [
        ['Accounts', 'Optional email and password, to save portfolios, watchlists, plans and wallet addresses', 'None'],
        ['Kept on our servers', 'Your account and what you save', 'Search text, stored with nothing that identifies you (host logs: section 9)'],
        ['Kept in your browser', 'Settings, alerts, notes, layout', 'Settings, notes, followed pages, your own API keys'],
        ['Sold, or shared for ads', 'Never', 'Never'],
        ['Analytics or trackers', 'None', 'None'],
      ],
    }),
    section('2. What we collect on Finance Now',
      list(
        "**Account details:** your email, an optional name, and your password, which we store only in a scrambled form that can't be turned back into the password.",
        '**What you save:** portfolios (name, description, starting amount, holdings, target weights, cost basis), watchlists (names and the instruments on them), Portfolio Builder plans including your answers to its questions (such as risk tolerance, years to retirement and amount), and wallet addresses you add, with their labels and chains.',
        '**What you type into AI features:** your messages, the conversation so far, and research questions. The assistant also receives the page you are on and the tickers on your watchlist as context.',
        "**Request logs:** when you use our public API, we log the path, the query, your browser type and the referring page. We don't log your IP address ourselves; our hosting provider does, as part of serving pages (section 6).",
        '**Abuse limits:** to stop abuse, we keep a per-minute request count for each IP address in server memory only. It is never written to disk and is cleared when the server restarts.',
      ),
    ),
    section('3. What we collect on News Charts',
      list(
        '**No accounts,** names or email addresses.',
        '**Search text** you type, with what it matched and when. We store no IP address, browser details or other identifier with it. We use it to improve search.',
        "**Missing pages:** when you open a page for a company or topic we don't have yet, we record its name and when it was asked for, so we can add it. Nothing records who asked.",
      ),
    ),
    section('4. What stays in your browser',
      p("Both products keep settings and some of your data in your browser's local storage, not on our servers: layout, alerts, notes, followed pages, chart settings and chart notes, and on Finance Now your most recent Daily Brief. On News Charts this includes any API keys you enter. Finance Now also keeps an older local copy of data it moved into your account. All of it stays on your device until you clear your browser's data for the site."),
      p('**Cookies.** Neither site sets advertising or tracking cookies. Finance Now uses only the cookies that signing in needs. News Charts sets no cookies.'),
    ),
    section('5. How we use it',
      list(
        'to provide the Services, including saving and showing your data;',
        'to answer questions you put to AI features;',
        'to keep the Services secure and stop abuse;',
        'to improve search and coverage on News Charts;',
        'to meet legal obligations.',
      ),
      p("We don't build advertising profiles, and we don't make automated decisions about you that have legal or similar effects."),
    ),
    section('6. Who receives it',
      p('We share personal information only with the following, and each handles it under its own privacy policy:'),
      list(
        '**Hosting and database providers** that run the Services for us ([HOSTING PROVIDER]). They see IP addresses and requests in the normal course of serving pages.',
        "**AI providers, when you use an AI feature.** On Finance Now, our AI provider (currently Anthropic) receives what you type, the conversation so far, the page you are on and your watchlist tickers, and may run web searches based on your question. Pump Report scans send the wallet addresses, labels, coin names and website links you submit. Daily Brief sends ticker symbols from your portfolios and watchlists, never quantities or costs. Questions about a video go to Google (Gemini) with the video's link. On News Charts, AI that uses anything of yours works only with your own key: your instruction and the event titles on the page go straight from your browser to the provider you chose, and we never see them. News Charts also shows explanations we generate in advance with our own AI key; no visitor data goes into them.",
        "**Data providers, to fetch what you asked for:** the ticker, coin or topic you view; coin searches you type (to CoinGecko); video search terms; subreddits you add; and wallet addresses you check, which go to the blockchain service for that chain. On News Charts, the name of a page we don't have yet goes to sources such as Wikipedia and the SEC; your saved Federal Register terms go through our server to the Federal Register; and, with your own key, the topic you view goes from your browser to the New York Times or the Guardian.",
        '**Sites your browser loads images or fonts from.** Finance Now loads fonts from Google, coin images from CoinGecko and video thumbnails from YouTube. News Charts loads images hosted by the news publishers and archives it links to. Those sites receive your IP address and browser details.',
        '**Authorities or others** when the law requires it, or to protect rights and safety.',
        '**A buyer or successor** if the business is sold or reorganised, bound by this policy.',
      ),
    ),
    section("7. What we don't do",
      list(
        "We don't sell personal information, and we don't share it for cross-context behavioural advertising.",
        "We don't use analytics, advertising pixels, session recording or other trackers.",
        'Links to other sites carry no tracking codes from us. The site a link leads to may see that you came from our site, as with any link.',
        'News Charts shows no ads today. Before any ad appears, we will update this policy and set out your choices.',
      ),
    ),
    section('8. Do Not Track and Global Privacy Control',
      p("We don't track you across sites, so a Do Not Track or Global Privacy Control signal has nothing to switch off today. If we ever add advertising or tracking, we will treat these signals as a request to opt out."),
    ),
    section('9. How long we keep it',
      list(
        '**Finance Now account and saved items:** until you delete them or your account. Deleted data leaves our database at once and our backups within [BACKUP PERIOD].',
        '**Finance Now API request logs:** [LOG PERIOD].',
        '**News Charts search text:** 90 days, then deleted, backups included.',
        '**News Charts missing-page records:** kept as a record of what readers want covered. They identify no one.',
        "**Your browser's storage:** until you clear it.",
        "**Our host's access logs, both products:** your IP address, the page address (on News Charts this can include search text) and browser type, kept for [LOG PERIOD].",
      ),
    ),
    section('10. Security',
      p('We protect data with encrypted connections (HTTPS), scrambled passwords, access limited to the people who run the Services, and server-side keys that never reach browsers. No system is perfectly secure. If a breach affects your personal information, we will tell you as the law requires.'),
    ),
    section('11. Your choices and rights',
      p('Wherever you live in the US, you can ask us to:'),
      list(
        'tell you what personal information we hold about you and give you a copy;',
        'correct it;',
        'delete it, including your account.',
      ),
      p("Email [CONTACT EMAIL]. We'll check the request is yours (for an account, by replying from its email address) and answer within 30 days. Making a request won't change how we treat you. If we decline, we'll say why, and you can ask us to reconsider by replying. Where a state law gives you further rights, we will honour them. You can also delete saved items yourself at any time, and clear your browser's storage."),
    ),
    section('12. Children',
      p("The Services are for adults 18 and over and aren't aimed at children. We don't knowingly collect information from anyone under 18. If you think a child has given us information, contact us and we will delete it."),
    ),
    section('13. Where your data is handled',
      p('The Services are for users in the United States. Data we store is kept in the United States. AI and data providers that handle your requests may process them in other countries.'),
    ),
    section('14. Changes to this policy',
      p("We'll post any update with a new effective date. For material changes, we'll give notice in the Services, and by email if you have an account, before they take effect."),
    ),
    section('15. Contact',
      p('[COMPANY LLC NAME], [MAILING ADDRESS]. Email: [CONTACT EMAIL]. The "Privacy" link in every page footer leads here, including for California residents under the California Online Privacy Protection Act.'),
    ),
  ],
}

// ─── Not Investment Advice (draft tab rev 5) ────────────────────────────────
// The tab's "Short versions for the pages" table is working material, not part
// of the public notice: its footer line is FOOTER_NOTICE above, and its lines
// for individual features belong beside those features (D50), not here.

export const NOT_INVESTMENT_ADVICE: LegalDocument = {
  title: 'Not Investment Advice',
  path: LEGAL_PATHS.notAdvice,
  intro: [
    p('Everything on Finance Now and News Charts is general information, published the same way for every reader. None of it is investment, tax or legal advice.'),
  ],
  sections: [
    section('What that means',
      list(
        "We publish financial information and tools. We are not registered as an investment adviser, broker-dealer or financial planner, and we don't act as one.",
        'Nothing here recommends or offers to buy, sell or hold any security, crypto asset, fund or other investment, and nothing says an investment suits you.',
        "We don't know your full financial situation. Where a tool asks about your goals or tolerance for risk, it applies fixed rules to your answers and knows nothing else about you.",
      ),
    ),
    section('Tools that use your own figures',
      p('Calculators, scorers and planners apply fixed, published rules to the figures you enter. Anyone entering the same figures gets the same result. The result shows what the rules produce; it is not a recommendation.'),
    ),
    section('AI answers',
      p("AI answers are machine-written from the data we show and, on Finance Now, from web searches. They can be wrong or out of date. They describe; they don't advise."),
    ),
    section('Data and risk',
      p("Market data comes from third parties, is labelled with its source, and can be delayed, incomplete or wrong. Crypto assets are highly volatile and can lose all their value. Past performance doesn't predict future results. Scores, labels and screens describe data; they are not forecasts or recommendations."),
    ),
    section('How we are paid',
      p(`Issuers of the securities and crypto assets we cover never pay us to write about them, and no one can pay to change a figure, an order or what we say. Our [How We Make Money](${HOW_WE_MAKE_MONEY_HREF}) page has the details.`),
    ),
    section('Before you act',
      p('Check figures against the original source. For investment, tax or legal decisions, talk to a licensed professional who knows your situation.'),
    ),
  ],
}

export const LEGAL_DOCUMENTS: ReadonlyArray<LegalDocument> = [TERMS_OF_USE, PRIVACY_POLICY, NOT_INVESTMENT_ADVICE]

// ─── Provider credits (About, section 5) ────────────────────────────────────

/**
 * Every attribution a provider's terms require, from the data-source registry —
 * derived, so a provider added there is credited here without anyone
 * remembering to. Deduplicated by text, in registry order.
 */
export function providerCredits(): Array<{ text: string; href?: string }> {
  const seen = new Map<string, { text: string; href?: string }>()
  for (const entry of DATA_SOURCES) {
    for (const a of requiredAttributions(entry)) {
      if (!seen.has(a.text)) seen.set(a.text, { text: a.text, href: a.href })
    }
  }
  return [...seen.values()]
}

/** CoinGecko API Terms §7(a), in the draft's wording (Data Sources & Attribution tab). */
export const COINGECKO_PROPERTY_LINE = 'The CoinGecko API and its data are the property of CoinGecko.'

// ─── About & Legal (draft "About page" tab rev 5) ───────────────────────────
// Ten sections in the tab's order. Three pointers were not worded by the draft
// and are marked "not from the draft"; everything else is its text, including
// the launch version of How We Make Money (D49: no paid links at launch).

export const ABOUT_PAGE: { title: string; sections: LegalSection[] } = {
  title: 'About & Legal',
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are',
      blocks: [
        p('Finance Now is a research tool for stocks, funds and crypto assets. It gathers market data from named sources, shows where each figure comes from, and runs published calculations on it. It is made by [COMPANY LLC NAME], a small North Carolina company that also makes News Charts.'),
      ],
    },
    {
      id: 'how-we-make-money',
      heading: 'How we make money',
      blocks: [
        p('Finance Now and News Charts are operated by [COMPANY LLC NAME]. No link on either site pays us: we earn nothing when you follow a link, open an account, deposit money or trade. No company can pay to change what we cover, the order we list things in, a figure we show, or what we say. If that ever changes, this page will say so first and every paid link will be labelled.'),
        p('Finance Now charges nothing today. When paid plans start, they will be described here and in the Terms of Use.'),
        p("If you have a question or concern about a link or an ad, email [CONTACT EMAIL] with the page and the link. We'll acknowledge it within 5 business days and answer within 30 days. Our [Contact & Complaints](#questions-and-complaints) page explains what happens next."),
      ],
    },
    {
      id: 'not-investment-advice',
      heading: 'Not investment advice',
      blocks: [
        ...NOT_INVESTMENT_ADVICE.intro,
        { kind: 'more', href: LEGAL_PATHS.notAdvice, text: 'Read the full notice' },
      ],
    },
    {
      id: 'regulatory-status',
      heading: 'Regulatory status',
      blocks: [
        list(
          'We publish general financial information, the same for every reader. We are not registered with the SEC or any state as an investment adviser, and we are not a broker-dealer.',
          "We don't hold money or crypto for anyone, and nothing on either site places a trade.",
          'No company we write about pays us, no link pays us, and no one can pay to change a figure, an order or what we say.',
          'AI-written text is labelled as AI-written, and it can be wrong.',
          'Both sites are for people in the United States who are 18 or older.',
        ),
      ],
    },
    {
      // The tab's row: "The credits providers require, then the full list
      // (Finance Now's existing Data Sources page)". The credits themselves are
      // rendered from providerCredits() by the page; the pointer is not from the draft.
      id: 'where-our-data-comes-from',
      heading: 'Where our data comes from',
      blocks: [
        p(COINGECKO_PROPERTY_LINE),
        { kind: 'more', href: '/data-sources', text: 'Every provider and the terms we use it under: Data Sources' },
      ],
    },
    {
      id: 'your-privacy',
      heading: 'Your privacy',
      blocks: [
        p('We collect only what the site needs to work and what you choose to save. We never sell your information or share it for advertising on other sites. You can ask for a copy of your data, or for it to be deleted, at [CONTACT EMAIL].'),
        { kind: 'more', href: LEGAL_PATHS.privacy, text: 'Read the Privacy Policy' },
      ],
    },
    {
      // The tab asks for "one line, then the full terms" and does not word the
      // line; this one is the Terms' own opening, shortened. Not from the draft.
      id: 'terms-of-use',
      heading: 'Terms of Use',
      blocks: [
        p('The Terms of Use are an agreement between you and [COMPANY LLC NAME]. By using Finance Now you agree to them and to our Privacy Policy.'),
        { kind: 'more', href: LEGAL_PATHS.terms, text: 'Read the Terms of Use' },
      ],
    },
    {
      id: 'questions-and-complaints',
      heading: 'Questions and complaints',
      blocks: [
        p('One address handles everything for both products: [CONTACT EMAIL]. We acknowledge messages within 5 business days and give a full answer within 30 days.'),
        list(
          '**Email:** [CONTACT EMAIL]',
          '**Mail:** [COMPANY LLC NAME], [MAILING ADDRESS]',
        ),
        p('Please say which product it concerns and, where it helps, the page address and what you saw.'),
        {
          kind: 'table',
          head: ['You tell us about', 'What we do'],
          rows: [
            ['A figure that looks wrong', "Check it against the source. If it's our error, we fix it; if the source is wrong or late, we label it"],
            ['A link or an ad', 'Check it against [How We Make Money](#how-we-make-money). We remove an ad that breaks the rules there, and fix a link that is broken or misleading'],
            ['Your personal information', 'Handle it as a privacy request under the [Privacy Policy](/about/privacy#your-choices-and-rights) (section 11): access, correction or deletion within 30 days'],
            ['A security problem', "Look into it at once. Please don't test beyond what you need to show the problem"],
            ['Anything else', 'Reply within the times above'],
          ],
        },
        p("If you aren't satisfied with our answer, you can contact the North Carolina Attorney General's Consumer Protection Division or the Federal Trade Commission."),
      ],
    },
    {
      id: 'policy-updates',
      heading: 'Policy updates',
      blocks: [
        p('Each document shows its effective date at the top. When we change one in a way that matters to you, we list the change here with its date, and if you have an account we tell you before it takes effect.'),
        {
          kind: 'table',
          head: ['Date', 'What changed'],
          rows: [['[EFFECTIVE DATE]', 'Terms of Use, Privacy Policy, Not Investment Advice and How We Make Money first published']],
        },
      ],
    },
    {
      // Not from the draft: the tab's row is "a link to the list of open-source
      // software the app is built with, and its licences", generated by the build.
      id: 'open-source-notices',
      heading: 'Open-source notices',
      blocks: [
        p('Finance Now is built with open-source software. The list of packages and their licences is generated from the project each time the site is built.'),
        { kind: 'more', href: LEGAL_PATHS.openSource, text: 'Open-source notices' },
      ],
    },
  ],
}

// ─── Whole-set checks ───────────────────────────────────────────────────────

function blockText(b: LegalBlock): string[] {
  switch (b.kind) {
    case 'p': return [b.text]
    case 'list': return b.items
    case 'table': return [...b.head, ...b.rows.flat()]
    case 'more': return [b.text]
  }
}

function sectionText(s: LegalSection): string[] {
  return [s.heading, ...s.blocks.flatMap(blockText)]
}

/** Every string a reader can see on the About and legal pages, footer included. */
export function allPublishedText(): string[] {
  return [
    ABOUT_PAGE.title,
    ...ABOUT_PAGE.sections.flatMap(sectionText),
    ...LEGAL_DOCUMENTS.flatMap((d) => [d.title, d.effective ?? '', ...d.intro.flatMap(blockText), ...d.sections.flatMap(sectionText)]),
    FOOTER_NOTICE,
    ...FOOTER_LINKS.map((l) => l.label),
  ].filter(Boolean)
}

/** The blanks still unfilled anywhere in the set, each once, in reading order. */
export function unfilledBlanks(): string[] {
  return [...new Set(allPublishedText().flatMap(blanksIn))]
}

/**
 * True only when the owner has approved the set AND no blank is left. The draft
 * notice shows until then — on every page that carries this text.
 */
export function disclosuresInForce(
  status: typeof DISCLOSURE_STATUS = DISCLOSURE_STATUS,
  blanks: string[] = unfilledBlanks(),
): boolean {
  return status === 'approved' && blanks.length === 0
}
