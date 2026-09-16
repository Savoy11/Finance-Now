import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load as parseYaml } from 'js-yaml'

/**
 * Guard for `.github/workflows/dependabot-triage.yml`.
 *
 * Two properties are worth a test, and neither is visible from reading the YAML:
 *
 *  1. IT COSTS MONEY. Every run that reaches the Anthropic call bills. The job is
 *     built to exit before that call whenever it would be pointless — no open
 *     dependabot PRs, nothing in scope, no key — and those early exits are exactly
 *     the kind of thing a later edit reorders without noticing. So the tests assert
 *     `fetch` was never called, not merely that the job returned.
 *
 *  2. IT SWALLOWS ITS OWN FAILURES, like archive-branch.yml, so a missing secret or
 *     a bad response warns instead of painting the repo red every Tuesday. That
 *     makes a regression SILENT: the workflow keeps going green and simply stops
 *     triaging.
 *
 * Same idiom as archiveBranchWorkflow.test.ts — the script is extracted from the
 * YAML and actually executed against mocks, because a mirror is only useful while
 * it matches.
 */

const WORKFLOW = resolve(__dirname, '../../../../../.github/workflows/dependabot-triage.yml')

interface WorkflowShape {
  on: Record<string, unknown>
  permissions: Record<string, string>
  jobs: { triage: { steps: Array<{ uses?: string; env?: Record<string, string>; with?: { script?: string } }> } }
}

function loadWorkflow(): WorkflowShape {
  // `on:` is YAML 1.1's boolean `true`; js-yaml parses it as the key `true`.
  const raw = parseYaml(readFileSync(WORKFLOW, 'utf8')) as Record<string, unknown>
  const on = (raw.on ?? raw[true as unknown as string]) as Record<string, unknown>
  return { ...raw, on } as unknown as WorkflowShape
}

function compileScript(): (g: unknown, c: unknown, core: unknown) => Promise<void> {
  const script = loadWorkflow().jobs.triage.steps.find((s) => s.with?.script)?.with?.script
  if (!script) throw new Error('triage job has no github-script step')
  return new Function(
    'github', 'context', 'core',
    `return (async () => {\n${script}\n})()`,
  ) as (g: unknown, c: unknown, core: unknown) => Promise<void>
}

interface Pr {
  number: number
  title: string
  body?: string
  user: { login: string }
  head: { ref: string; sha: string }
}

const dependabotPr = (number: number, title: string, ref: string, body = 'notes'): Pr => ({
  number, title, body, user: { login: 'dependabot[bot]' }, head: { ref, sha: `sha${number}` },
})

interface MockOpts {
  pulls?: Pr[]
  comments?: Array<{ id: number; body: string }>
  checkRuns?: Array<{ name: string; status: string; conclusion: string | null }>
}

function mockApi(opts: MockOpts = {}) {
  const { pulls = [], comments = [], checkRuns = [] } = opts
  const log = {
    info: [] as string[],
    warn: [] as string[],
    created: [] as Array<{ issue: number; body: string }>,
    updated: [] as Array<{ id: number; body: string }>,
    summary: [] as string[],
  }
  const core = {
    info: (m: string) => log.info.push(m),
    warning: (m: string) => log.warn.push(m),
    setFailed: (m: string) => log.warn.push(`FAILED: ${m}`),
    summary: {
      addHeading() { return this },
      addRaw(s: string) { log.summary.push(s); return this },
      async write() { /* no-op */ },
    },
  }
  const github = {
    // The script calls github.paginate(fn, params) — run the underlying fn once.
    async paginate(fn: (p: unknown) => Promise<{ data: unknown[] }>, params: unknown) {
      const res = await fn(params)
      return res.data
    },
    rest: {
      pulls: { async list() { return { data: pulls } } },
      checks: { async listForRef() { return { data: { check_runs: checkRuns } } } },
      issues: {
        async listComments() { return { data: comments } },
        async createComment({ issue_number, body }: { issue_number: number; body: string }) {
          log.created.push({ issue: issue_number, body }); return {}
        },
        async updateComment({ comment_id, body }: { comment_id: number; body: string }) {
          log.updated.push({ id: comment_id, body }); return {}
        },
      },
    },
  }
  const context = { repo: { owner: 'Savoy11', repo: 'Finance-Now' } }
  return { github, context, core, log }
}

/** Stubs global fetch with one Anthropic-shaped reply, and records calls. */
function stubAnthropic(verdicts: unknown, ok = true) {
  const calls: string[] = []
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    calls.push(init.body)
    if (!ok) return { ok: false, status: 500, async text() { return 'boom' } }
    return {
      ok: true,
      async json() {
        return { content: [{ type: 'text', text: JSON.stringify(verdicts) }], stop_reason: 'end_turn' }
      },
    }
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

afterEach(() => { vi.unstubAllGlobals(); delete process.env.ANTHROPIC_API_KEY })

// ─────────────────────────────────────────────────────────────────────────────

describe('dependabot-triage workflow — structure', () => {
  it('runs Tuesdays and on manual dispatch', () => {
    const wf = loadWorkflow()
    expect(Object.keys(wf.on).sort()).toEqual(['schedule', 'workflow_dispatch'])
    // Cron day-of-week 2 = Tuesday, per D6. dependabot opens its PRs Monday.
    const schedule = wf.on.schedule as Array<{ cron: string }>
    expect(schedule[0].cron.trim().split(/\s+/)[4]).toBe('2')
  })

  it('can comment but cannot write to the repo', () => {
    const wf = loadWorkflow()
    expect(wf.permissions['pull-requests']).toBe('write')
    expect(wf.permissions.contents).toBe('read')
  })

  it('never checks out the repo — this is how "never edits docs" is structural', () => {
    // D6 says the agent never edits docs. A workflow with no working tree cannot,
    // whatever the prompt says. If someone adds a checkout, this should stop them.
    const steps = loadWorkflow().jobs.triage.steps
    expect(steps.filter((s) => (s.uses ?? '').startsWith('actions/checkout'))).toEqual([])
  })

  it('reads the key from a secret, never a literal', () => {
    // The secret is FN_TESTING (owner's naming — it holds a testing-scoped key).
    // It is mapped onto the standard ANTHROPIC_API_KEY env var so the script and
    // the app read the same variable name. Assert both halves: a secrets
    // reference, and the standard env name on the receiving side.
    const step = loadWorkflow().jobs.triage.steps.find((s) => s.env)
    expect(step?.env?.ANTHROPIC_API_KEY).toBe('${{ secrets.FN_TESTING }}')
    expect(step?.env?.ANTHROPIC_API_KEY).toMatch(/^\$\{\{\s*secrets\./)
  })
})

describe('dependabot-triage workflow — spends nothing when there is nothing to do', () => {
  it('makes no model call when no dependabot PRs are open', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn } = stubAnthropic([])
    const { github, context, core, log } = mockApi({ pulls: [] })
    await compileScript()(github, context, core)
    expect(fn).not.toHaveBeenCalled()
    expect(log.info.join(' ')).toContain('Exiting before any API call')
  })

  it('ignores PRs from humans', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn } = stubAnthropic([])
    const human = { ...dependabotPr(1, 'Bump x from 1.0.0 to 1.0.1', 'feat/x'), user: { login: 'marcus' } }
    const { github, context, core } = mockApi({ pulls: [human] })
    await compileScript()(github, context, core)
    expect(fn).not.toHaveBeenCalled()
  })

  it('makes no model call when every open PR is a major bump', async () => {
    // D6 scopes this to patch/minor, and dependabot.yml un-groups majors precisely
    // because they are the ones a human should read. Summarising them would defeat
    // that — and paying to summarise them would be worse.
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn } = stubAnthropic([])
    const { github, context, core, log } = mockApi({
      pulls: [dependabotPr(10, 'Bump redis from 5.0.1 to 8.0.0', 'dependabot/pip/redis-8')],
    })
    await compileScript()(github, context, core)
    expect(fn).not.toHaveBeenCalled()
    expect(log.summary.join(' ')).toContain('#10')
  })

  it('warns rather than failing when the secret is missing', async () => {
    const { fn } = stubAnthropic([])
    const { github, context, core, log } = mockApi({
      pulls: [dependabotPr(11, 'Bump the frontend-patch-minor group', 'dependabot/npm_and_yarn/frontend/frontend-patch-minor-abc')],
    })
    await compileScript()(github, context, core)
    expect(fn).not.toHaveBeenCalled()
    expect(log.warn.join(' ')).toContain('ANTHROPIC_API_KEY is not set')
    expect(log.warn.join(' ')).not.toContain('FAILED')
  })
})

describe('dependabot-triage workflow — scoping', () => {
  const cases: Array<[string, string, string, boolean]> = [
    ['grouped patch/minor', 'dependabot/npm_and_yarn/frontend/frontend-patch-minor-abc', 'Bump the group', true],
    ['grouped mcp',         'dependabot/npm_and_yarn/mcp-server/mcp-patch-minor-def',     'Bump the group', true],
    ['patch',               'dependabot/npm_and_yarn/mcp-server/fast-uri-3.1.8',          'bump fast-uri from 3.1.4 to 3.1.8', true],
    ['minor',               'dependabot/npm_and_yarn/mcp-server/qs-6.16.0',               'bump qs from 6.15.2 to 6.16.0', true],
    ['major',               'dependabot/npm_and_yarn/frontend/zustand-5.0.15',            'bump zustand from 4.5.7 to 5.0.15', false],
  ]
  it.each(cases)('treats a %s PR correctly', async (_label, ref, title, inScope) => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn } = stubAnthropic([{ number: 20, verdict: 'routine', summary: 'Routine.' }])
    const { github, context, core } = mockApi({ pulls: [dependabotPr(20, title, ref)] })
    await compileScript()(github, context, core)
    expect(fn.mock.calls.length > 0).toBe(inScope)
  })

  // ⚠ REGRESSION GUARD, from real data on 2026-09-16.
  //
  // The first version of classifyBump treated any `/actions-` head ref as a
  // patch/minor group, on the belief that dependabot.yml restricted the actions
  // group the way it restricts `frontend-patch-minor` and `mcp-patch-minor`. It
  // does not — `actions` is `patterns: ["*"]` with no `update-types`, so it
  // carries majors. PR "actions/github-script from 7 to 9" was being sent to the
  // model as routine.
  //
  // Two separate faults in one PR: the group assumption, and the fact that
  // action versions are not semver, so "from 7 to 9" never matched an X.Y.Z
  // pattern either.
  it('does not treat a MAJOR actions bump as an in-scope group', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn } = stubAnthropic([])
    const { github, context, core } = mockApi({
      pulls: [dependabotPr(
        21,
        'build(deps): bump actions/github-script from 7 to 9 in the actions group across 1 directory',
        'dependabot/github_actions/actions-4e2b1c'
      )],
    })
    await compileScript()(github, context, core)
    expect(fn).not.toHaveBeenCalled()
  })

  it('classifies a non-semver actions PATCH bump as in scope', async () => {
    // The fix must not over-correct into skipping every actions bump.
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn } = stubAnthropic([{ number: 22, verdict: 'routine', summary: 'Routine.' }])
    const { github, context, core } = mockApi({
      pulls: [dependabotPr(22, 'bump actions/checkout from 4 to 4', 'dependabot/github_actions/actions-99')],
    })
    await compileScript()(github, context, core)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('sends every in-scope PR in ONE request, not one each', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { fn, calls } = stubAnthropic([
      { number: 31, verdict: 'routine', summary: 'a' },
      { number: 32, verdict: 'routine', summary: 'b' },
    ])
    const { github, context, core } = mockApi({
      pulls: [
        dependabotPr(31, 'Bump a from 1.0.0 to 1.0.1', 'dependabot/npm_and_yarn/a-1'),
        dependabotPr(32, 'Bump b from 1.0.0 to 1.1.0', 'dependabot/npm_and_yarn/b-1'),
      ],
    })
    await compileScript()(github, context, core)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(calls[0]).toContain('#31')
    expect(calls[0]).toContain('#32')
  })

  it('never puts a major into the prompt, even alongside in-scope PRs', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { calls } = stubAnthropic([{ number: 41, verdict: 'routine', summary: 'a' }])
    const { github, context, core } = mockApi({
      pulls: [
        dependabotPr(41, 'Bump a from 1.0.0 to 1.0.1', 'dependabot/npm_and_yarn/a-1'),
        dependabotPr(42, 'Bump next from 14.0.0 to 15.0.0', 'dependabot/npm_and_yarn/next-15'),
      ],
    })
    await compileScript()(github, context, core)
    expect(calls[0]).toContain('#41')
    expect(calls[0]).not.toContain('#42')
  })

  it('uses low effort — the documented setting for routine classification', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { calls } = stubAnthropic([{ number: 50, verdict: 'routine', summary: 'a' }])
    const { github, context, core } = mockApi({
      pulls: [dependabotPr(50, 'Bump a from 1.0.0 to 1.0.1', 'dependabot/npm_and_yarn/a-1')],
    })
    await compileScript()(github, context, core)
    expect(JSON.parse(calls[0]).output_config.effort).toBe('low')
  })
})

describe('dependabot-triage workflow — what it writes', () => {
  it('creates a comment when none exists, and says it approved nothing', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    stubAnthropic([{ number: 60, verdict: 'look', summary: 'Check the deprecation.' }])
    const { github, context, core, log } = mockApi({
      pulls: [dependabotPr(60, 'Bump a from 1.0.0 to 1.1.0', 'dependabot/npm_and_yarn/a-1')],
      checkRuns: [{ name: 'CI Success Gate', status: 'completed', conclusion: 'success' }],
    })
    await compileScript()(github, context, core)
    expect(log.created).toHaveLength(1)
    expect(log.created[0].issue).toBe(60)
    expect(log.created[0].body).toContain('Worth a look')
    expect(log.created[0].body).toContain('Check the deprecation.')
    expect(log.created[0].body).toContain('all 1 passing')
    // The comment must never read as an approval.
    expect(log.created[0].body).toContain('not an approval')
  })

  it('updates its own comment instead of adding one every week', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    stubAnthropic([{ number: 61, verdict: 'routine', summary: 'Routine.' }])
    const { github, context, core, log } = mockApi({
      pulls: [dependabotPr(61, 'Bump a from 1.0.0 to 1.0.1', 'dependabot/npm_and_yarn/a-1')],
      comments: [{ id: 999, body: '<!-- dependabot-triage -->\nlast week' }],
    })
    await compileScript()(github, context, core)
    expect(log.updated).toEqual([expect.objectContaining({ id: 999 })])
    expect(log.created).toEqual([])
  })

  it('reports failing checks in the comment', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    stubAnthropic([{ number: 62, verdict: 'look', summary: 'CI is red.' }])
    const { github, context, core, log } = mockApi({
      pulls: [dependabotPr(62, 'Bump a from 1.0.0 to 1.0.1', 'dependabot/npm_and_yarn/a-1')],
      checkRuns: [
        { name: 'unit', status: 'completed', conclusion: 'failure' },
        { name: 'lint', status: 'completed', conclusion: 'success' },
      ],
    })
    await compileScript()(github, context, core)
    expect(log.created[0].body).toContain('FAILING: unit')
  })

  it('warns and comments nothing when the API call fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    stubAnthropic([], false)
    const { github, context, core, log } = mockApi({
      pulls: [dependabotPr(63, 'Bump a from 1.0.0 to 1.0.1', 'dependabot/npm_and_yarn/a-1')],
    })
    await compileScript()(github, context, core)
    expect(log.created).toEqual([])
    expect(log.warn.join(' ')).toContain('Triage summary failed')
    expect(log.warn.join(' ')).not.toContain('FAILED')
  })
})
