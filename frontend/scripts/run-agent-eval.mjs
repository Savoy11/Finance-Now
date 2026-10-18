#!/usr/bin/env node
//
// D20 — run all 11 agents once and collect their output for the owner to judge.
//
//   npm run agent-eval              # PLAN only. Prints what would run. Spends nothing.
//   npm run agent-eval -- --run     # actually runs them. This spends money.
//   npm run agent-eval -- --run --only equity-research
//   npm run agent-eval -- --run --only pump-report-investigator,pump-report-chat
//   npm run agent-eval -- --run --timeout 180
//
// Owner decision D20 (2026-09-14): "Run once now; owner judges. One-off, not
// scheduled (D6 stands)." So there is no cron here and there should not be one.
// It also closes T-001 and the result-quality half of T-129, and feeds T-130
// ("test and fine-tune all 11 agents against the REAL vs FALLBACK rule").
//
// ── Why the default does nothing ──
// Every run costs real money, and the failure mode for an eval harness is being
// invoked by accident — a stray `npm run agent-eval` in a terminal, a habit of
// re-running the last command. So the default is a plan: it resolves the eleven
// agents, prints the exact task each would receive, checks the preflight, and
// exits. `--run` is the only thing that reaches the API.
//
// ── It REPORTS, it does not tune ──
// Same split as build-fund-fees.mjs and apply-fee-updates.ts. This script never
// edits a prompt, a model or a temperature. It writes a worksheet with a blank
// verdict box per agent, the way `terms:report` does, because which answers are
// good is the owner's judgement and D20 says so in as many words.
//
// ⚠ READ THE RESULTS ALONGSIDE `npm run audit`. Agent tools read the same
// /live-data routes the UI does, so an agent giving a vague answer off a
// FALLBACK route is a DATA problem, not a prompt problem (CLAUDE.md). Tuning a
// prompt to compensate for a degraded feed is the trap this warning exists to
// prevent. The worksheet records which tools each agent actually called; an
// agent that called NONE answered from its own weights, which is the specific
// failure worth catching.

import fs from 'node:fs'
import path from 'node:path'
import { answerForWorksheet, wasCutOff } from './lib/agentEvalAnswer.mjs'

const BASE = process.env.BASE_URL ?? process.env.FN_BASE_URL ?? process.env.CAEP_BASE_URL ?? 'http://localhost:3000'
const args = process.argv.slice(2)
const RUN = args.includes('--run')
const ONLY = args.includes('--only')
  ? String(args[args.indexOf('--only') + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  : null
const TIMEOUT_S = args.includes('--timeout') ? Number(args[args.indexOf('--timeout') + 1]) : 240
// A run of some agents writes its own file, so re-running one or two never
// replaces the worksheet of a full run the owner is still judging.
const OUT = path.resolve(process.cwd(), '..', ONLY ? 'agent-eval-worksheet-partial.md' : 'agent-eval-worksheet.md')

// The model the run will actually use, read out of the source rather than
// repeated here. A worksheet that names a model the routes stopped using is
// worse than one naming none: it dates the results wrongly, and comparing two
// runs is the only reason the tasks are fixed.
const PROMPTS_TS = path.resolve(process.cwd(), 'src', 'lib', 'agents', 'prompts.ts')
const AGENT_MODEL = (() => {
  try {
    const m = fs.readFileSync(PROMPTS_TS, 'utf8').match(/DEFAULT_ANTHROPIC_MODEL\s*=\s*'([^']+)'/)
    return m ? m[1] : null
  } catch {
    return null
  }
})()
const AGENT_MODEL_LABEL = AGENT_MODEL ?? 'UNKNOWN — could not read DEFAULT_ANTHROPIC_MODEL'

// ─────────────────────────────────────────────────────────────────────────────
// The eleven agents, and how each is actually reachable.
//
// Three different transports, which is why this cannot be a loop over one URL:
//   • research  — POST /api/agents/research { task, agentId }   (8 agents)
//   • chat      — POST /api/agents/chat     { messages }        (app-assistant)
//   • pump      — POST /live-data/pump-report/{investigate,chat} (2 agents,
//                 their own loop with their own web_search)
//
// Tasks are fixed, not generated. An eval whose inputs move cannot be compared
// across runs, and the whole point is to judge a change in the prompts later.
// ─────────────────────────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'app-assistant', transport: 'chat', market: 'shared',
    task: 'What does the Transfer Fee Calculator do, where does its data come from, and how fresh is it?',
    why: 'App knowledge plus a provenance question — it should reach for data rather than describe the feature from memory.',
  },
  {
    id: 'research-analyst', transport: 'research', market: 'crypto',
    task: 'Give me a current picture of Ethereum: price and 24h move, what the recent news sentiment looks like, and what staking options exist with their trade-offs.',
    why: 'The flagship crypto agent across three tool families (prices, news, staking).',
  },
  {
    id: 'data-scraper', transport: 'research', market: 'crypto',
    task: 'Collect the current Bitcoin price, its 24h change, and current network fee levels. Report the figures and where each came from.',
    why: 'Pure collection. Vagueness here is a data problem, not a prompt problem — check the audit.',
  },
  {
    id: 'pump-report-investigator', transport: 'pump-investigate', market: 'crypto',
    body: { target: 'bitcoin', targetType: 'coin' },
    task: 'target=bitcoin targetType=coin',
    why: 'Its own agent loop and its own web search. A well-known asset is used deliberately: the answer should be unremarkable, and an alarming one is the finding.',
  },
  {
    id: 'pump-report-chat', transport: 'pump-chat', market: 'crypto',
    task: 'What signals would suggest a coin is being promoted rather than adopted?',
    why: 'The conversational half of the pump-report loop.',
  },
  {
    id: 'equity-research', transport: 'research', market: 'equities',
    task: 'Assess NVDA: recent price action, the latest SEC filings, and the key financial ratios. Say which figures are live and which are reference values.',
    why: 'Asks the agent to distinguish live from reference data — the REAL vs FALLBACK rule, tested directly.',
  },
  {
    id: 'equity-data-scraper', transport: 'research', market: 'equities',
    task: 'Collect AAPL: latest quote, company profile, and the most recent 10-Q filing. Report each with its source.',
    why: 'Collection across the keyed quote ladder and keyless SEC EDGAR in one task.',
  },
  {
    id: 'equity-diligence', transport: 'research', market: 'equities',
    task: 'Run diligence on MSFT: filings, fundamentals, and any social signal. Flag anything a reader should verify themselves.',
    why: 'The longest-running equity agent; also tests whether it hedges appropriately.',
  },
  {
    id: 'equity-screener', transport: 'research', market: 'equities',
    task: 'Find sector-relative outliers in the stock universe and explain the three most interesting, with the numbers behind each.',
    why: 'Calls get_stock_outliers then drills in. Degrades without a paid FMP key — expect the curated fallback.',
  },
  {
    id: 'macro-research', transport: 'research', market: 'macro',
    task: 'Describe the current Treasury yield curve — its shape, the 2s10s spread — and what commodities have been doing.',
    why: 'Rides keyless treasury.gov, so it should work regardless of which provider keys are set.',
  },
  {
    id: 'macro-screener', transport: 'research', market: 'macro',
    // Until 2026-10-17 this asked for RSI readings. The agent ranks the day's moves and
    // has no RSI tool, so that run measured the task, not the agent (it said so).
    task: "Screen the macro instruments and report the three biggest moves on the day, judged against each market's normal volatility, with the readings.",
    why: 'Ranks the day’s moves; it has no RSI tool. Macro quotes have been unserved on every audit since 2026-09-09, so an answer naming unpriced instruments rather than estimating them is the right one.',
  },
]

const unknown = ONLY ? ONLY.filter((id) => !AGENTS.some((a) => a.id === id)) : []
const selected = ONLY ? AGENTS.filter((a) => ONLY.includes(a.id)) : AGENTS
if (ONLY && (unknown.length > 0 || selected.length === 0)) {
  console.error(`Unknown agent "${unknown.join(', ') || ONLY.join(', ')}". Known: ${AGENTS.map((a) => a.id).join(', ')}`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Preflight. Exit 2, not 1, when the environment is wrong.
//
// Same convention as probe-staking-upstreams.mjs: a caller has to be able to
// tell "the agents are broken" from "you ran this in the wrong place". A dev
// server that is not running says nothing about agent quality.
// ─────────────────────────────────────────────────────────────────────────────
async function preflight() {
  const problems = []

  let serverUp = false
  try {
    const res = await fetch(`${BASE}/live-data/config`, { signal: AbortSignal.timeout(8000) })
    serverUp = res.ok || res.status === 403 // 403 = up, and guarding as designed
  } catch { /* stays false */ }
  if (!serverUp) problems.push(`Dev server is not answering at ${BASE}. Start it with \`npm run dev\`.`)

  // The key can come from .env.local (Next loads it) or the Integrations page,
  // so its absence from this process's env proves nothing. Ask the app instead.
  // The key can come from .env.local (Next loads it) or the Integrations page,
  // so its absence from this process's env proves nothing. Ask the app instead.
  //
  // ⚠ Asymmetric on purpose. /live-data/config computes hasKey as
  // `!!config.apiKey` — the Integrations store only, never the environment —
  // while the agent routes fall back to ANTHROPIC_API_KEY through
  // getProviderKey. So `true` means configured; anything else means "not in the
  // store, and .env.local may or may not carry it". That is never grounds to
  // refuse to run: the first agent settles it in one call, and a preflight that
  // blocks on it would stop every setup that uses the documented .env.local
  // path. (Before 2026-09-17 this read cfg.configs.anthropic, a shape the route
  // has never returned, so it reported "unknown" unconditionally.)
  let keyConfigured = null
  try {
    const res = await fetch(`${BASE}/live-data/config`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const cfg = await res.json()
      const anth = Array.isArray(cfg?.providers) ? cfg.providers.find((p) => p?.id === 'anthropic') : null
      if (anth) keyConfigured = anth.config?.hasKey === true
    }
  } catch { /* leave unknown */ }

  return { serverUp, keyConfigured, problems }
}

function fmtDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

async function callAgent(agent) {
  const started = Date.now()
  let url, body
  if (agent.transport === 'research') {
    url = `${BASE}/api/agents/research`
    body = { task: agent.task, agentId: agent.id }
  } else if (agent.transport === 'chat') {
    url = `${BASE}/api/agents/chat`
    body = { messages: [{ role: 'user', content: agent.task }] }
  } else if (agent.transport === 'pump-investigate') {
    url = `${BASE}/live-data/pump-report/investigate`
    body = agent.body
  } else {
    url = `${BASE}/live-data/pump-report/chat`
    body = { messages: [{ role: 'user', content: agent.task }], context: '' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_S * 1000),
    })
    // Timed after the body is read: the Pump Report routes stream, so the response
    // headers arrive with the first words and the 2026-10-17 run reported 3.3s for a
    // report that took far longer.
    const text = await res.text()
    const ms = Date.now() - started
    let data
    // The Pump Report routes stream plain text, not JSON. Keep all of it: this
    // cut it at 2,000 characters until 2026-10-17, so both Pump Report answers
    // in that day's worksheet ended mid-report. The worksheet caps its own copy.
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!res.ok) {
      return { ok: false, ms, status: res.status, error: data?.error ?? text.slice(0, 400) }
    }
    // Each transport names its payload differently.
    const output = data.report ?? data.reply ?? data.text ?? data.message ?? data.summary
      ?? (typeof data.raw === 'string' ? data.raw : JSON.stringify(data).slice(0, 4000))
    // The Pump Report routes stream their own error text with HTTP 200. On 2026-10-17
    // that text counted as two short "answers" while every other agent failed.
    const streamedError = /<ERROR>[\s\S]*?<\/ERROR>|\[Agent error[^\]]*\]/g
    if (streamedError.test(String(output)) && String(output).replace(streamedError, '').trim() === '') {
      return { ok: false, ms, status: res.status, error: `the route answered only with its own error message: ${String(output).trim().slice(0, 200)}` }
    }
    return {
      ok: true, ms, status: res.status,
      output: String(output ?? ''),
      toolsUsed: data.toolsUsed ?? data.tools ?? null,
    }
  } catch (err) {
    return {
      ok: false, ms: Date.now() - started, status: 0,
      error: err.name === 'TimeoutError' ? `No response within ${TIMEOUT_S}s` : err.message,
    }
  }
}

/**
 * The tools a run called, by name, repeats counted: "get_stock_quote, get_stock_filings ×3".
 * The routes send each call as { name, input }, which printed as "[object Object]" until
 * 2026-10-17.
 */
function toolSummary(toolsUsed) {
  const counts = new Map()
  for (const t of toolsUsed) {
    const name = typeof t === 'string' ? t : (t && typeof t.name === 'string' ? t.name : 'unnamed')
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ')
}

function planTable() {
  const w = Math.max(...selected.map((a) => a.id.length))
  return selected.map((a) =>
    `  ${a.id.padEnd(w)}  ${a.market.padEnd(8)}  ${a.transport}`
  ).join('\n')
}

async function main() {
  const { serverUp, keyConfigured, problems } = await preflight()

  console.log(`\n═════════ D20 — AGENT EVALUATION ${RUN ? '(RUN)' : '(PLAN ONLY)'} → ${BASE} ═════════\n`)
  console.log(`Agents selected: ${selected.length} of ${AGENTS.length}`)
  console.log(planTable())
  console.log('')

  console.log('Preflight')
  console.log(`  dev server           ${serverUp ? 'up' : 'NOT ANSWERING'}`)
  console.log(`  anthropic key        ${keyConfigured === true ? 'configured in Integrations' : keyConfigured === false ? 'not in Integrations — .env.local may still supply it' : 'unknown (could not read config)'}`)
  console.log(`  agent model          ${AGENT_MODEL_LABEL} (the default in lib/agents/prompts.ts, for all 11)`)
  console.log('')

  if (!RUN) {
    console.log('PLAN ONLY — nothing was called and nothing was spent.')
    console.log('')
    console.log('Each agent gets one task, run sequentially. The tasks are fixed so two')
    console.log('runs are comparable; they are listed in the worksheet this writes.')
    console.log('')
    if (problems.length > 0) {
      console.log('Before running:')
      for (const p of problems) console.log(`  • ${p}`)
      if (keyConfigured === false) console.log('  • No Anthropic key is configured — every agent would fail at the first call.')
      console.log('')
    }
    console.log('When ready:  npm run agent-eval -- --run')
    console.log('')
    // exitCode rather than exit(): on Windows, exiting while the preflight's requests
    // are still closing printed a Node assertion (src\win\async.c) after the plan.
    process.exitCode = problems.length > 0 ? 2 : 0
    return
  }

  if (problems.length > 0) {
    console.error('Cannot run — the environment is not ready:\n')
    for (const p of problems) console.error(`  • ${p}`)
    console.error('\nThis says nothing about the agents. Exit 2 = inconclusive.\n')
    process.exitCode = 2
    return
  }
  if (keyConfigured === false) {
    console.error('No Anthropic key is configured. Set ANTHROPIC_API_KEY in frontend/.env.local')
    console.error('or add it on the Integrations page, then re-run. Exit 2 = inconclusive.\n')
    process.exitCode = 2
    return
  }

  const results = []
  for (const [i, agent] of selected.entries()) {
    process.stdout.write(`  [${i + 1}/${selected.length}] ${agent.id} … `)
    const r = await callAgent(agent)
    results.push({ agent, ...r })
    if (r.ok) {
      // A route that does not report its tools (the Pump Report pair, which run
      // their own web search) is not an agent that used none.
      const tools = Array.isArray(r.toolsUsed)
        ? `${r.toolsUsed.length} tool call(s)${r.toolsUsed.length === 0 ? '  ⚠ NO TOOLS' : ''}`
        : 'tools not reported by this route'
      console.log(`${fmtDuration(r.ms)}, ${r.output.length} chars, ${tools}${wasCutOff(r.output) ? '  ⚠ CUT OFF' : ''}`)
    } else {
      console.log(`FAILED (${r.status || 'no response'}) — ${r.error}`)
    }
  }

  // ── Worksheet ───────────────────────────────────────────────────────────
  const ok = results.filter((r) => r.ok)
  const noTools = ok.filter((r) => Array.isArray(r.toolsUsed) && r.toolsUsed.length === 0)
  const cutOff = ok.filter((r) => wasCutOff(r.output))
  const failed = results.filter((r) => !r.ok)
  const stamp = new Date().toISOString()

  const md = [
    `# Agent evaluation worksheet — ${stamp.slice(0, 10)}`,
    '',
    `D20: run the 11 agents once, owner judges. Generated by \`npm run agent-eval -- --run\`.`,
    `Base: ${BASE} · model: \`${AGENT_MODEL_LABEL}\` (default for all 11) · run at ${stamp}`,
    '',
    `**${ok.length} of ${results.length} answered.** ${failed.length} failed. ${noTools.length} answered with NO tool calls. ${cutOff.length} cut off at the length limit.`,
    '',
    '## Before you judge these',
    '',
    'Read them next to a fresh `npm run audit`. Agent tools read the same `/live-data`',
    'routes the UI does, so an agent giving a vague answer off a FALLBACK route is a',
    'DATA problem and tuning its prompt would be fixing the wrong layer.',
    '',
    'An agent that called **no tools** answered from its own weights. That is the',
    'specific failure worth catching: the text can read perfectly well and still be',
    'untethered from this app\'s data.',
    '',
    noTools.length > 0
      ? `⚠ No tools called by: ${noTools.map((r) => `\`${r.agent.id}\``).join(', ')}`
      : '✅ Every agent that answered called at least one tool.',
    ...(cutOff.length > 0 ? ['', `⚠ Cut off at the length limit: ${cutOff.map((r) => `\`${r.agent.id}\``).join(', ')}`] : []),
    '',
    '---',
    '',
  ]

  for (const r of results) {
    md.push(`## ${r.agent.id}`)
    md.push('')
    md.push(`*${r.agent.why}*`)
    md.push('')
    md.push(`| | |`)
    md.push(`|---|---|`)
    md.push(`| Market | ${r.agent.market} |`)
    md.push(`| Transport | \`${r.agent.transport}\` |`)
    md.push(`| Duration | ${fmtDuration(r.ms)} |`)
    md.push(`| Outcome | ${r.ok ? (wasCutOff(r.output) ? 'answered, but **cut off at its length limit**' : 'answered') : `**FAILED** — ${r.error}`} |`)
    if (r.ok) {
      const tools = Array.isArray(r.toolsUsed) ? (r.toolsUsed.length ? toolSummary(r.toolsUsed) : '**none**') : 'not reported'
      md.push(`| Tools called | ${tools} |`)
      md.push(`| Length | ${r.output.length} chars |`)
    }
    md.push('')
    md.push('**Task given**')
    md.push('')
    md.push('> ' + r.agent.task.replace(/\n/g, '\n> '))
    md.push('')
    if (r.ok) {
      md.push('**Response**')
      md.push('')
      md.push('```text')
      md.push(answerForWorksheet(r.output))
      md.push('```')
      md.push('')
    }
    md.push('**Owner verdict** — keep / tune / rewrite, and why:')
    md.push('')
    md.push('> ')
    md.push('')
    md.push('---')
    md.push('')
  }

  md.push('## What to do with this')
  md.push('')
  md.push('- Anything marked *tune* is a prompt change in `lib/agents/prompts.ts`.')
  md.push('- Anything vague **whose tools returned fallback data** is a data fix, not a prompt fix.')
  md.push('- Actual spend for this run is on the Anthropic Console — these routes do not return token counts.')
  md.push('')

  // With a byte-order mark, because Windows PowerShell's Get-Content reads a file
  // without one in the old Windows code page, and the 2026-10-17 copy came out with
  // every dash and arrow garbled ("â€”").
  fs.writeFileSync(OUT, '\ufeff' + md.join('\n'), 'utf8')

  console.log('')
  console.log(`Worksheet → ${OUT}`)
  console.log(`  ${ok.length} answered · ${failed.length} failed · ${noTools.length} used no tools`)
  if (noTools.length > 0) console.log(`  ⚠ no tools: ${noTools.map((r) => r.agent.id).join(', ')}`)
  if (cutOff.length > 0) console.log(`  ⚠ cut off: ${cutOff.map((r) => r.agent.id).join(', ')}`)
  console.log('')
  console.log('Check actual spend on the Anthropic Console — these routes report no token counts.')
  console.log('')

  process.exitCode = failed.length > 0 ? 1 : 0
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
