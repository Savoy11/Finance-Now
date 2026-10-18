import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { toolsForAgent, runToolWithCredits } from './tools'
import { type ProviderId } from './prompts'
import { loadAgentConfig } from './config'
import { anthropicSampling } from './sampling'
import { getProviderKey } from '@/lib/api/live/providers'
import type { RequiredCredit } from '@/lib/data/dataSources'

// Alias so existing call-sites below don't need renaming
const getAgentConfig = loadAgentConfig

// ─── Shared agent loop ────────────────────────────────────────────────────────

export interface AgentRunResult {
  text: string
  toolsUsed: { name: string; input: unknown }[]
  /**
   * Credits the data behind the answer requires wherever it is shown, gathered from
   * every tool the run called (D101): "Powered by CoinGecko" when it read a coin price.
   * The agent routes send them with the answer and the page shows them under it.
   */
  credits: RequiredCredit[]
  stopReason: string | null
}

/**
 * Added to an answer the model stopped because it reached its length limit, so a
 * reader knows the end is missing. Until 2026-10-17 a cut-off answer came back as
 * though it were whole: that day's agent evaluation found the Diligence report
 * ending in the middle of its findings, with nothing on the page to say so.
 */
export const CUT_OFF_NOTICE = '(This answer was cut off at its length limit before it finished.)'

/**
 * The answer's text from a final Anthropic response. Web search splits a sentence
 * into several text blocks, each quoted passage its own block with its citations,
 * so the blocks are joined as they stand. Joining them with line breaks, as this
 * did until 2026-10-17, broke every sentence that quoted a source across lines.
 */
export function anthropicAnswerText(blocks: ReadonlyArray<{ type: string; text?: string }>, stopReason: string | null): string {
  const text = blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim()
  return stopReason === 'max_tokens' ? withCutOffNotice(text) : text
}

function withCutOffNotice(text: string): string {
  return text ? `${text}\n\n${CUT_OFF_NOTICE}` : CUT_OFF_NOTICE
}

/** Run one tool and add its credits to the run's, once each. */
async function runToolInto(
  credits: RequiredCredit[],
  name: string,
  input: Record<string, unknown>,
  opts: RunAgentOptions,
): Promise<unknown> {
  const out = await runToolWithCredits(name, input, opts.origin, opts.watchlist?.terms)
  for (const c of out.credits) if (!credits.some((x) => x.text === c.text)) credits.push(c)
  return out.result
}

const PROVIDER_ENV_VARS: Record<ProviderId, string> = {
  anthropic:  'ANTHROPIC_API_KEY',
  openai:     'OPENAI_API_KEY',
  google:     'GOOGLE_API_KEY',
  mistral:    'MISTRAL_API_KEY',
  groq:       'GROQ_API_KEY',
  xai:        'XAI_API_KEY',
  deepseek:   'DEEPSEEK_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  together:   'TOGETHER_API_KEY',
  cohere:     'COHERE_API_KEY',
}

const PROVIDER_BASE_URLS: Partial<Record<ProviderId, string>> = {
  google:     'https://generativelanguage.googleapis.com/v1beta/openai/',
  mistral:    'https://api.mistral.ai/v1',
  groq:       'https://api.groq.com/openai/v1',
  xai:        'https://api.x.ai/v1',
  deepseek:   'https://api.deepseek.com/v1',
  perplexity: 'https://api.perplexity.ai',
  together:   'https://api.together.xyz/v1',
  cohere:     'https://api.cohere.com/compatibility/v1',
}

export class MissingApiKeyError extends Error {
  constructor(provider: ProviderId) {
    const envVar = PROVIDER_ENV_VARS[provider] ?? `${provider.toUpperCase()}_API_KEY`
    super(`No API key for ${provider}. Add it in Settings → Integrations → AI Providers, or set ${envVar}.`)
    this.name = 'MissingApiKeyError'
  }
}

export class AgentDisabledError extends Error {
  constructor(agentId: string) {
    super(`Agent "${agentId}" is disabled. Enable it in Settings → Integrations → AI Agents.`)
    this.name = 'AgentDisabledError'
  }
}

/** Effective API key for an LLM provider: UI-saved (Integrations) key, else env var. */
function llmKey(provider: ProviderId): string | undefined {
  return getProviderKey(provider) ?? process.env[PROVIDER_ENV_VARS[provider]]
}

export interface RunAgentOptions {
  agentId: string
  messages: Anthropic.MessageParam[]
  origin: string
  systemSuffix?: string
  maxTokens?: number
  maxIterations?: number
  /** Max Anthropic web searches per run (default 5). Web search is Anthropic-only. */
  webSearchMaxUses?: number
  /**
   * The user's watchlist, forwarded from the client.
   *
   * Applied two ways, because neither alone is sufficient: passed to the news
   * tools so results are filtered deterministically, and stated in the system
   * prompt so the agent knows to weight these assets even when it reaches for a
   * tool that has no watchlist parameter (market news, web search).
   */
  watchlist?: { terms: string[]; labels: string[] }
}

// Anthropic server-side web search tool. Executed by Anthropic (not our runTool),
// so agents whose prompts rely on searching the web (research, scrapers,
// diligence) can actually do so. Only available on the Anthropic provider.
function webSearchTool(maxUses: number) {
  return { type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }
}

// ─── Anthropic runner ─────────────────────────────────────────────────────────

async function runAgentAnthropic(
  cfg: ReturnType<typeof getAgentConfig> & object,
  opts: RunAgentOptions,
): Promise<AgentRunResult> {
  const apiKey = llmKey('anthropic')
  if (!apiKey) throw new MissingApiKeyError('anthropic')

  const client = new Anthropic({ apiKey })
  const system = opts.systemSuffix ? `${cfg.systemPrompt}\n\n${opts.systemSuffix}` : cfg.systemPrompt
  const messages: Anthropic.MessageParam[] = [...opts.messages]
  // Our client-side data tools plus Anthropic's server-side web_search tool.

  const tools: any[] = [...toolsForAgent(cfg.toolset), webSearchTool(opts.webSearchMaxUses ?? 5)]
  const toolsUsed: { name: string; input: unknown }[] = []
  const credits: RequiredCredit[] = []
  const maxIterations = opts.maxIterations ?? 8
  let stopReason: string | null = null

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      // Only models that accept it: Claude Sonnet 5 and newer refuse a temperature (sampling.ts).
      ...anthropicSampling(cfg.model, cfg.temperature),
      system,
      tools,
      messages,
    })
    stopReason = response.stop_reason
    messages.push({ role: 'assistant', content: response.content })

    // Record web searches (server tool) for the tools-used display.
    for (const b of response.content as Array<{ type: string; name?: string; input?: unknown }>) {
      if (b.type === 'server_tool_use' && b.name) toolsUsed.push({ name: b.name, input: b.input })
    }

    // Anthropic pauses long server-tool (web search) turns — resume by looping.
    if ((response.stop_reason as string) === 'pause_turn') continue

    if (response.stop_reason !== 'tool_use') {
      return { text: anthropicAnswerText(response.content, stopReason), toolsUsed, credits, stopReason }
    }

    // Client-side tool_use blocks only — server_tool_use (web_search) is
    // resolved by Anthropic and must not be run through runTool.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        toolsUsed.push({ name: tu.name, input: tu.input })
        const result = await runToolInto(credits, tu.name, tu.input as Record<string, unknown>, opts)
        return { type: 'tool_result' as const, tool_use_id: tu.id, content: JSON.stringify(result) }
      })
    )
    messages.push({ role: 'user', content: toolResults })
  }

  return { text: 'I reached the maximum number of steps before finishing. Please narrow the question and try again.', toolsUsed, credits, stopReason }
}

// ─── OpenAI/Gemini runner ─────────────────────────────────────────────────────

/** Convert Anthropic-style tool definitions to OpenAI function-calling format. */
function toOpenAITools(tools: Anthropic.Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }))
}

/** Convert incoming Anthropic-style messages to OpenAI chat messages. */
function toOpenAIMessages(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ]
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role as 'user' | 'assistant', content: m.content })
    } else if (Array.isArray(m.content)) {
      // Flatten content blocks to string for simplicity
      const text = m.content
        .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
      if (text) out.push({ role: m.role as 'user' | 'assistant', content: text })
    }
  }
  return out
}

async function runAgentOpenAI(
  cfg: ReturnType<typeof getAgentConfig> & object,
  opts: RunAgentOptions,
  provider: ProviderId,
): Promise<AgentRunResult> {
  const apiKey = llmKey(provider)
  if (!apiKey) throw new MissingApiKeyError(provider)

  const baseURL = PROVIDER_BASE_URLS[provider]
  const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) })

  const system = opts.systemSuffix ? `${cfg.systemPrompt}\n\n${opts.systemSuffix}` : cfg.systemPrompt
  // Data tools only — web search is Anthropic-only (server-side tool); agents
  // switched to a non-Anthropic provider lose web search but keep data tools.
  const openaiTools = toOpenAITools(toolsForAgent(cfg.toolset))
  const toolsUsed: { name: string; input: unknown }[] = []
  const credits: RequiredCredit[] = []
  const maxIterations = opts.maxIterations ?? 8
  let stopReason: string | null = null

  // Build the initial message list
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = toOpenAIMessages(system, opts.messages)

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: cfg.temperature,
      tools: openaiTools,
      messages: chatMessages,
    })

    const choice = response.choices[0]
    stopReason = choice.finish_reason ?? null
    const assistantMsg = choice.message
    chatMessages.push(assistantMsg)

    if (choice.finish_reason !== 'tool_calls' || !assistantMsg.tool_calls?.length) {
      const text = assistantMsg.content?.trim() ?? ''
      // 'length' is the OpenAI-compatible name for reaching the length limit.
      return { text: choice.finish_reason === 'length' ? withCutOffNotice(text) : text, toolsUsed, credits, stopReason }
    }

    // Execute all tool calls in parallel
    const toolResultMessages = await Promise.all(
      assistantMsg.tool_calls.map(async (tc) => {

        const fn = (tc as any).function as { name: string; arguments: string }
        const input = JSON.parse(fn.arguments || '{}')
        toolsUsed.push({ name: fn.name, input })
        const result = await runToolInto(credits, fn.name, input, opts)
        return {
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        }
      })
    )
    chatMessages.push(...toolResultMessages)
  }

  return { text: 'I reached the maximum number of steps before finishing. Please narrow the question and try again.', toolsUsed, credits, stopReason }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Describe the watchlist to the model.
 *
 * Deliberately framed as a weighting instruction, not a filter: the user asking
 * about an asset they don't hold must still get an answer. The tools apply hard
 * filtering where they can; this covers the tools that can't.
 */
function watchlistSuffix(watchlist: RunAgentOptions['watchlist']): string | null {
  if (!watchlist?.labels.length) return null
  return [
    `The user's watchlist contains: ${watchlist.labels.join(', ')}.`,
    'Weight news, analysis and examples toward these assets, and mention them first when relevant.',
    'Do not refuse or omit information about other assets — the watchlist is a preference, not a restriction.',
  ].join(' ')
}

export async function runAgent(opts: RunAgentOptions): Promise<AgentRunResult> {
  const cfg = getAgentConfig(opts.agentId)
  if (!cfg) throw new Error(`Unknown agent: ${opts.agentId}`)
  if (cfg.enabled === false) throw new AgentDisabledError(opts.agentId)

  // Fold the watchlist into the system suffix so it reaches both runners.
  const wl = watchlistSuffix(opts.watchlist)
  const effective: RunAgentOptions = wl
    ? { ...opts, systemSuffix: opts.systemSuffix ? `${opts.systemSuffix}\n\n${wl}` : wl }
    : opts

  if (cfg.provider === 'anthropic') return runAgentAnthropic(cfg, effective)
  return runAgentOpenAI(cfg, effective, cfg.provider)
}
