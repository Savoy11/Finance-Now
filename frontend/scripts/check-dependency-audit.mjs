#!/usr/bin/env node
// The Security Scan's dependency audit for this package. It runs `npm audit --json` and fails
// on every high or critical advisory, except one that an owner decision allows for a dated
// window in audit-exceptions.json. The rules, and why they are this narrow, are in
// scripts/lib/auditGate.mjs.
//
//   npm run deps:check                          # audit this package now
//   npm run deps:check -- --now=2026-11-04      # what the gate will say on a later date
//   npm run deps:check -- --report=audit.json   # judge a saved `npm audit --json` report
//   npm run deps:check -- --report=-            # the same, read from standard input
//
// Exit 0: nothing blocks. Exit 1: an advisory blocks, or audit-exceptions.json is wrong.
// Exit 2: npm audit produced no report (offline, a registry error). That is inconclusive,
// and CI still shows it red: a gate that could not look has not passed.

import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateAudit, formatResult, isIsoDate } from './lib/auditGate.mjs'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(packageDir, '..')

/** The value after `--name=`, or null. */
function flag(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

/** Every decision id recorded as a `| Dnn |` row in docs/decisions/*.md. */
function recordedDecisions() {
  const dir = join(repoRoot, 'docs', 'decisions')
  const ids = new Set()
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue
    for (const m of readFileSync(join(dir, name), 'utf8').matchAll(/^\|\s*(D\d+)\s*\|/gm)) ids.add(m[1])
  }
  return ids
}

function readReport() {
  const source = flag('report')
  let text
  if (source === '-') text = readFileSync(0, 'utf8')
  else if (source) text = readFileSync(resolve(source), 'utf8')
  else {
    // npm exits non-zero whenever it finds anything, so the exit code says nothing here; the
    // JSON on stdout is the answer. On Windows npm is a .cmd file, which needs a shell.
    const run = spawnSync('npm', ['audit', '--json'], {
      cwd: packageDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32',
    })
    text = run.stdout ?? ''
    if (!text.trim()) return { error: { summary: (run.stderr || String(run.error ?? 'no output')).trim().split('\n')[0] } }
  }
  try {
    return JSON.parse(text)
  } catch {
    return { error: { summary: 'the output was not JSON' } }
  }
}

const today = flag('now') ?? new Date().toISOString().slice(0, 10)
if (!isIsoDate(today)) {
  console.error(`--now must be a date, YYYY-MM-DD (got ${today})`)
  process.exit(1)
}

let exceptionsFile
try {
  exceptionsFile = JSON.parse(readFileSync(join(packageDir, 'audit-exceptions.json'), 'utf8'))
} catch (err) {
  console.error(`audit-exceptions.json could not be read: ${err.message}`)
  process.exit(1)
}

const result = evaluateAudit(readReport(), exceptionsFile, { today, knownDecisions: recordedDecisions() })
const lines = formatResult(result)
if (lines.length) console.log(lines.join('\n'))

if (result.inconclusive) {
  console.error('\n✗ deps:check: inconclusive, because npm audit produced no report.')
  process.exit(2)
}
if (!result.ok) {
  console.error(`\n✗ deps:check: ${result.blocking.length} advisory(ies) block, ${result.problems.length} problem(s) in audit-exceptions.json (checked as of ${today}).`)
  process.exit(1)
}
console.log(`\n✓ deps:check: nothing at high or critical blocks (${result.allowed.length} allowed under a dated exception, checked as of ${today}).`)
