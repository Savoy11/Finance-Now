import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load as parseYaml } from 'js-yaml'

/**
 * Guard for `.github/workflows/archive-branch.yml`.
 *
 * The workflow tags every merged PR's head as `archive/<branch>` so retired work
 * has a NAMED reference. It runs only on merge, and it deliberately swallows its
 * own failures so a broken archive can never fail a merge that already happened.
 * Those two facts together mean a regression here is SILENT: merges keep working,
 * archiving just stops, and nobody finds out until they go looking for a tag that
 * was never written.
 *
 * So the script is extracted from the YAML and actually executed against a mocked
 * GitHub API, rather than eyeballed. Same reasoning as the probe mirrors in
 * stakingUpstreamProbe.test.ts — a mirror is only useful while it matches.
 */

const WORKFLOW = resolve(__dirname, '../../../../../.github/workflows/archive-branch.yml')

interface WorkflowShape {
  on: Record<string, unknown>
  permissions: Record<string, string>
  jobs: { archive: { if: string; steps: Array<{ uses?: string; with?: { script?: string } }> } }
}

function loadWorkflow(): WorkflowShape {
  // `on:` is YAML 1.1's boolean `true`, which js-yaml faithfully parses as the
  // key `true`. Normalise it so the assertions can read `.on` like a human does.
  const raw = parseYaml(readFileSync(WORKFLOW, 'utf8')) as Record<string, unknown>
  const on = (raw.on ?? raw[true as unknown as string]) as Record<string, unknown>
  return { ...raw, on } as unknown as WorkflowShape
}

type Created = string[]
interface Log { info: string[]; warn: string[]; fail: string[]; created: Created }
interface MockOpts {
  tags?: Record<string, string>       // tag name -> tag-object sha ("tagobj-<commit>")
  branches?: Record<string, string>   // branch name -> commit sha
  failCreate?: boolean
}

/** Builds the three objects github-script injects: github, context, core. */
function mockApi(opts: MockOpts = {}) {
  const { tags = {}, branches = {}, failCreate = false } = opts
  const log: Log = { info: [], warn: [], fail: [], created: [] }
  const core = {
    info: (m: string) => log.info.push(m),
    warning: (m: string) => log.warn.push(m),
    setFailed: (m: string) => log.fail.push(m),
    summary: {
      addHeading() { return this }, addRaw() { return this }, addCodeBlock() { return this },
      async write() { /* no-op */ },
    },
  }
  const github = {
    rest: {
      git: {
        async getRef({ ref }: { ref: string }) {
          if (ref.startsWith('tags/')) {
            const name = ref.slice(5)
            if (tags[name]) return { data: { object: { sha: tags[name], type: 'tag' } } }
            throw new Error('Not Found')
          }
          const name = ref.slice(6)
          if (branches[name]) return { data: { object: { sha: branches[name] } } }
          throw new Error('Not Found')
        },
        async getTag({ tag_sha }: { tag_sha: string }) {
          return { data: { object: { sha: tag_sha.replace('tagobj-', '') } } }
        },
        async createTag({ tag, object }: { tag: string; object: string }) {
          if (failCreate) throw new Error('Reference already exists')
          return { data: { sha: `tagobj-${object}`, tag } }
        },
        async createRef({ ref }: { ref: string }) { log.created.push(ref); return {} },
      },
    },
  }
  return { github, core, log }
}

/** Compiles the YAML's `script:` body the way github-script does — as an async fn. */
function compileScript(): (g: unknown, c: unknown, core: unknown) => Promise<void> {
  // Find the github-script step by shape, not by index — otherwise inserting any
  // step above it turns one precise failure into a dozen confusing ones.
  const script = loadWorkflow().jobs.archive.steps.find(s => s.with?.script)?.with?.script
  if (!script) throw new Error('archive job has no github-script step')
  return new Function(
    'github', 'context', 'core',
    `return (async () => {\n${script}\n})()`,
  ) as (g: unknown, c: unknown, core: unknown) => Promise<void>
}

function mergedPr(ref: string, sha: string, number = 178) {
  return {
    eventName: 'pull_request_target',
    repo: { owner: 'Savoy11', repo: 'Finance-Now' },
    payload: { pull_request: { merged: true, number, title: 'a title', head: { ref, sha } } },
  }
}

describe('archive-branch workflow — structure', () => {
  it('runs on merged PRs and on manual dispatch', () => {
    const wf = loadWorkflow()
    expect(Object.keys(wf.on).sort()).toEqual(['pull_request_target', 'workflow_dispatch'])
  })

  it('can write tags', () => {
    expect(loadWorkflow().permissions.contents).toBe('write')
  })

  it('only archives PRs that actually merged', () => {
    // A PR closed without merging keeps its branch. Tagging it would put abandoned
    // work into an inventory whose entries are supposed to mean "this landed".
    expect(loadWorkflow().jobs.archive.if).toContain('merged == true')
  })

  it('never checks out PR code — the rule that makes pull_request_target safe', () => {
    // pull_request_target grants write permission in the base-repo context. That is
    // only safe while no untrusted code is checked out or executed. If someone adds
    // a checkout of the head ref, this test is the thing that should stop them.
    const steps = loadWorkflow().jobs.archive.steps
    const checkouts = steps.filter(s => (s.uses ?? '').startsWith('actions/checkout'))
    expect(checkouts).toEqual([])
  })
})

describe('archive-branch workflow — behaviour', () => {
  it('tags a merged branch as archive/<branch>', async () => {
    const run = compileScript()
    const { github, core, log } = mockApi()
    await run(github, mergedPr('claude/foo', 'a'.repeat(40)), core)
    expect(log.created).toEqual(['refs/tags/archive/claude/foo'])
  })

  it('is idempotent when the tag already points at the same commit', async () => {
    // PRs can be closed and reopened; the workflow must not thrash the ref.
    const sha = 'b'.repeat(40)
    const run = compileScript()
    const { github, core, log } = mockApi({ tags: { 'archive/claude/foo': `tagobj-${sha}` } })
    await run(github, mergedPr('claude/foo', sha), core)
    expect(log.created).toEqual([])
  })

  it('disambiguates rather than clobbering when a branch name is reused', async () => {
    // A deleted branch can be recreated and merged again. Overwriting the old tag
    // would destroy the only named record of the earlier work.
    const run = compileScript()
    const { github, core, log } = mockApi({ tags: { 'archive/claude/foo': `tagobj-${'c'.repeat(40)}` } })
    await run(github, mergedPr('claude/foo', 'd'.repeat(40)), core)
    expect(log.created).toEqual(['refs/tags/archive/claude/foo@ddddddd'])
  })

  it('skips archive/* branches', async () => {
    // These are the pre-reset history anchors CLAUDE.md says to keep as branches.
    const run = compileScript()
    const { github, core, log } = mockApi()
    await run(github, mergedPr('archive/pre-reset-main', 'e'.repeat(40)), core)
    expect(log.created).toEqual([])
  })

  it('warns instead of throwing when the tag cannot be created', async () => {
    // The merge has already happened by this point. Failing the job would report a
    // red X on landed work and fix nothing.
    const run = compileScript()
    const { github, core, log } = mockApi({ failCreate: true })
    await run(github, mergedPr('claude/bar', 'f'.repeat(40), 4), core)
    expect(log.warn).toHaveLength(1)
    expect(log.warn[0]).toContain('refs/pull/4/head')
    expect(log.fail).toEqual([])
  })

  it('archives a branch on manual dispatch', async () => {
    const run = compileScript()
    const { github, core, log } = mockApi({ branches: { 'docs/x': '1'.repeat(40) } })
    await run(github, {
      eventName: 'workflow_dispatch',
      repo: { owner: 'Savoy11', repo: 'Finance-Now' },
      payload: { inputs: { branch: 'docs/x' } },
    }, core)
    expect(log.created).toEqual(['refs/tags/archive/docs/x'])
  })

  it('fails cleanly when dispatched at a branch that does not exist', async () => {
    const run = compileScript()
    const { github, core, log } = mockApi()
    await run(github, {
      eventName: 'workflow_dispatch',
      repo: { owner: 'Savoy11', repo: 'Finance-Now' },
      payload: { inputs: { branch: 'no-such-branch' } },
    }, core)
    expect(log.fail).toHaveLength(1)
    expect(log.created).toEqual([])
  })

  it('says in the tag message that the branch was NOT deleted', async () => {
    // Owner decision 2026-09-12: archiving must not imply deletion. The tag is the
    // thing a future reader finds, so the promise has to be written there.
    let message = ''
    const run = compileScript()
    const { core, log } = mockApi()
    const github = {
      rest: {
        git: {
          async getRef() { throw new Error('Not Found') },
          async getTag() { return { data: { object: { sha: '' } } } },
          async createTag(args: { message: string; object: string }) {
            message = args.message
            return { data: { sha: `tagobj-${args.object}` } }
          },
          async createRef({ ref }: { ref: string }) { log.created.push(ref); return {} },
        },
      },
    }
    await run(github, mergedPr('claude/keep-me', '9'.repeat(40), 200), core)
    expect(message).toContain('was NOT deleted')
    expect(message).toContain('Restore: git checkout -b claude/keep-me')
    expect(message).toContain('refs/pull/200/head')
  })
})
