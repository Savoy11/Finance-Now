import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getProviderKey } from '@/lib/api/live/providers'
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/agents/prompts'

/**
 * News discovery — finding coverage from outlets the app does NOT already carry.
 *
 * WHY THIS EXISTS. The app reads a handful of large publishers per module, and that
 * roster only shrinks: Yahoo went on terms grounds (2026-08-06), Poloniex (2026-09-15),
 * MarketWatch (2026-09-20). Equity news is now a single feed. Smaller outlets cover
 * stories the wires skip, but adding one permanently costs a terms reading, so the
 * roster cannot grow at the speed the question is asked.
 *
 * ⚠ THE CONSTRAINT THAT SHAPES EVERYTHING HERE. `sourceTerms.test.ts` fails the build
 * when a route fetches a host with no dated verdict, and `assertSourceNotProhibited`
 * blocks prohibited hosts at the socket. An unbounded set of small publishers can never
 * satisfy that — nobody can pre-read a thousand terms documents.
 *
 * So THIS APP NEVER FETCHES A DISCOVERED OUTLET. Discovery runs through Anthropic's
 * server-side `web_search` tool: Anthropic performs the retrieval and returns titles,
 * URLs and snippets. What comes back is displayed as a headline, a source name and a
 * link OUT. That is a different posture from the RSS feeds, and it is why discovery
 * results must never be styled to look like the vetted feed — see `DiscoveredArticle.
 * registered`, which is always false today and exists so the UI cannot forget.
 *
 * The compliant route from "this outlet is good" to "this outlet is in the app" already
 * exists and is unchanged: Integrations → add a custom feed, which runs `probeSiteTerms`
 * and the 403/409 terms gate before anything is saved. Discovery hands that flow a
 * candidate; it does not bypass it.
 */

// ─── What counts as "already covered" ────────────────────────────────────────

/**
 * Hosts the app already serves as built-in feeds, per module.
 *
 * ⚠ MIRRORED FROM THE ROUTES, AND A MIRROR IS ONLY USEFUL WHILE IT MATCHES.
 * `__tests__/newsDiscovery.test.ts` fails if this drifts from the feed rosters in
 * news/, market-news/ and macro-news/ — the same guard `stakingUpstreamProbe.test.ts`
 * puts on its own copy of the staking upstream list. The rosters are literals inside
 * route files; importing them would mean exporting non-handler values from a route,
 * which Next rejects.
 *
 * Excluding these is not only tidiness. An outlet the app already reads in full is by
 * definition not an undercovered one, and surfacing it in discovery would suggest the
 * feature found something when it found the feed you already have.
 */
export const CARRIED_HOSTS: Record<DiscoveryModule, readonly string[]> = {
  crypto: ['coindesk.com', 'cointelegraph.com', 'decrypt.co', 'bitcoinmagazine.com'],
  equities: ['cnbc.com'],
  macro: ['investing.com', 'oilprice.com', 'fxstreet.com', 'cnbc.com'],
}

/**
 * Large outlets to exclude so results are actually lesser-known.
 *
 * ⚠ TYPED RATHER THAN DERIVED, deliberately, and CLAUDE.md's derive-don't-type rule
 * allows it: this is "a fact about an external system", not a count this tree can
 * compute. There is no property of the codebase that knows Reuters is a major wire.
 *
 * It is an editorial list and it will age. It is NOT a quality judgement — nothing here
 * says these outlets are better or worse, only that they are well covered elsewhere and
 * including them would defeat the feature's one purpose.
 */
export const MAJOR_OUTLETS: readonly string[] = [
  'reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'nytimes.com', 'washingtonpost.com',
  'cnbc.com', 'marketwatch.com', 'barrons.com', 'forbes.com', 'businessinsider.com',
  'apnews.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com', 'economist.com',
  'yahoo.com', 'finance.yahoo.com', 'fortune.com', 'axios.com', 'politico.com',
  'seekingalpha.com', 'benzinga.com', 'investopedia.com', 'morningstar.com',
  'coindesk.com', 'cointelegraph.com', 'theblock.co', 'decrypt.co',
]

export type DiscoveryModule = 'crypto' | 'equities' | 'macro'

export const DISCOVERY_MODULES: readonly DiscoveryModule[] = ['crypto', 'equities', 'macro']

/** Everything excluded from results for a module: what we already read, plus the majors. */
export function blockedDomainsFor(module: DiscoveryModule): string[] {
  return [...new Set([...CARRIED_HOSTS[module], ...MAJOR_OUTLETS])].sort()
}

// ─── Result shape ────────────────────────────────────────────────────────────

export interface DiscoveredArticle {
  title: string
  url: string
  /** Bare host, e.g. `thedefiant.io` — what the UI attributes the story to. */
  sourceHost: string
  /** The outlet's own name where the search reported one, else the host. */
  sourceName: string
  /** ISO date, or null when the search did not report one. NEVER invented. */
  publishedAt: string | null
  /** Search snippet. Short by design — this app does not reproduce article bodies. */
  snippet: string
  /**
   * Always false today, and present so the UI cannot quietly start implying otherwise.
   * A discovered outlet has NO terms verdict in `sourceTerms.ts`; the app has not
   * fetched it and has not read its terms. Promotion through Integrations is what
   * changes that, and it changes this flag with it.
   */
  registered: false
}

export interface DiscoveryResult {
  ok: boolean
  module: DiscoveryModule
  query: string
  articles: DiscoveredArticle[]
  /** Domains excluded from this run, so the UI can say what "lesser known" meant. */
  excluded: string[]
  searchesUsed: number
  error?: string
}

// ─── Parsing (pure — the half worth testing without spending money) ──────────

const hostOf = (raw: string): string | null => {
  try {
    return new URL(raw).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** True when a host is the blocked domain itself or a subdomain of it. */
export function isBlocked(host: string, blocked: readonly string[]): boolean {
  const h = host.replace(/^www\./, '').toLowerCase()
  return blocked.some((b) => h === b || h.endsWith(`.${b}`))
}

/**
 * Turn the model's JSON into articles, dropping anything malformed.
 *
 * ⚠ DROPS RATHER THAN REPAIRS, and never fills a gap with a plausible value. A missing
 * date stays null; an unparseable URL removes the row. This project's whole posture is
 * that an honest absence beats an invented value, and a news list is exactly where a
 * fabricated date or a guessed outlet name would be believed.
 *
 * It also re-applies the block list. `blocked_domains` is enforced by the search tool,
 * but this is the app's own surface: if the tool ever returns a major outlet, showing it
 * would quietly make the feature a worse version of the feed it sits beside.
 */
export function parseDiscovered(raw: unknown, blocked: readonly string[]): DiscoveredArticle[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: DiscoveredArticle[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>

    const url = typeof e.url === 'string' ? e.url.trim() : ''
    const title = typeof e.title === 'string' ? e.title.trim() : ''
    if (!url || !title) continue

    const host = hostOf(url)
    if (!host) continue
    if (isBlocked(host, blocked)) continue
    if (seen.has(url)) continue
    seen.add(url)

    const rawDate = typeof e.publishedAt === 'string' ? e.publishedAt.trim() : ''
    const parsed = rawDate ? Date.parse(rawDate) : NaN
    const publishedAt = Number.isNaN(parsed) ? null : new Date(parsed).toISOString()

    out.push({
      title: title.slice(0, 300),
      url,
      sourceHost: host,
      sourceName: typeof e.sourceName === 'string' && e.sourceName.trim() ? e.sourceName.trim().slice(0, 80) : host,
      publishedAt,
      snippet: (typeof e.snippet === 'string' ? e.snippet.trim() : '').slice(0, 280),
      registered: false,
    })
  }
  return out
}

/** Pull the first JSON array out of a model reply, tolerating prose or a code fence. */
export function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

// ─── The search itself ───────────────────────────────────────────────────────

const MODULE_FOCUS: Record<DiscoveryModule, string> = {
  crypto: 'cryptocurrency, digital assets, blockchain protocols and crypto market structure',
  equities: 'public companies, equity markets, earnings and company-specific developments',
  macro: 'commodities, currencies, central banks, interest rates and government bonds',
}

export interface DiscoverOptions {
  module: DiscoveryModule
  /** Free-text topic or ticker. Empty means "what is notable right now". */
  query?: string
  /** Hard ceiling on billed searches. Kept low — this costs money per run. */
  maxUses?: number
  model?: string
}

/**
 * ⚠ THIS SPENDS MONEY. Every call bills Anthropic per web search, so it is
 * user-triggered only — never on page load, never on an interval. `maxUses` is a hard
 * ceiling rather than a target, and the route above it is rate-limited.
 */
export async function discoverArticles(opts: DiscoverOptions): Promise<DiscoveryResult> {
  const { module, query = '', maxUses = 4 } = opts
  const blocked = blockedDomainsFor(module)
  const base: Omit<DiscoveryResult, 'ok'> = {
    module,
    query,
    articles: [],
    excluded: blocked,
    searchesUsed: 0,
  }

  // getProviderKey already falls back to the env var, which is the resolution order
  // CLAUDE.md documents: UI-saved key (Integrations → AI Providers) first, then
  // ANTHROPIC_API_KEY.
  const apiKey = getProviderKey('anthropic')
  if (!apiKey) {
    return { ...base, ok: false, error: 'no_anthropic_key: add an Anthropic key on the Integrations page' }
  }

  const client = new Anthropic({ apiKey })

  // `web_search_20260209` rather than the `…20250305` the agent runner uses: only the
  // newer tool takes `blocked_domains`, which is what makes this feature possible at
  // all. Supported on the stable API (no beta header) for the Sonnet 5 / Opus 5 line,
  // which is what DEFAULT_ANTHROPIC_MODEL points at.
  const tools = [
    {
      type: 'web_search_20260209' as const,
      name: 'web_search' as const,
      max_uses: maxUses,
      blocked_domains: blocked,
    },
  ]

  const topic = query.trim() || `notable developments in ${MODULE_FOCUS[module]}`
  const system = [
    'You find recent news coverage from SMALLER, INDEPENDENT outlets — trade press,',
    'regional papers, specialist newsletters, research shops — that larger wires have',
    'not covered or have covered thinly.',
    '',
    'Rules that matter more than completeness:',
    '• Report ONLY articles you actually found via web_search. Never recall one from memory.',
    '• Never invent a URL, a date or an outlet name. Omit a field you did not see.',
    '• Prefer substantive reporting over aggregation and press releases.',
    '• If you find nothing that fits, return an empty array. An empty result is a valid',
    '  answer and is far better than padding it with major-wire coverage.',
    '',
    'Reply with ONLY a JSON array, no prose, each item:',
    '{"title":"…","url":"…","sourceName":"…","publishedAt":"ISO date or omit","snippet":"one or two sentences"}',
  ].join('\n')

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Find recent coverage of: ${topic}` },
  ]

  let searchesUsed = 0
  try {
    for (let i = 0; i < 6; i++) {
      const response = await client.messages.create({
        model: opts.model ?? DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 3000,
        system,
        tools,
        messages,
      })

      for (const b of response.content as Array<{ type: string; name?: string }>) {
        if (b.type === 'server_tool_use' && b.name === 'web_search') searchesUsed++
      }

      messages.push({ role: 'assistant', content: response.content })

      // Anthropic pauses long server-tool turns; resume by looping (same as runner.ts).
      if ((response.stop_reason as string) === 'pause_turn') continue

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      const articles = parseDiscovered(extractJsonArray(text), blocked)
      return { ...base, ok: true, articles, searchesUsed }
    }
    return { ...base, ok: false, searchesUsed, error: 'search did not converge within the iteration cap' }
  } catch (e) {
    return { ...base, ok: false, searchesUsed, error: e instanceof Error ? e.message : String(e) }
  }
}
