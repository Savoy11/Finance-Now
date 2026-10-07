import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Owner decision D68 (2026-10-04, T-093): the MCP server is data-only.
 *
 * Its one exception, `run_audit`, was removed. It ran `npx tsc` on the machine
 * hosting the server — and where TypeScript is not installed, npx downloads a
 * package and runs it without asking, because a stdio server has no terminal to
 * ask in. It also called /live-data routes directly and read every code file
 * under frontend/src. Anything that could get an agent to call it could set that
 * off, including text in an article the agent had read.
 *
 * So this file holds the server to what is left: every tool reads Finance Now's
 * /api/v1, and nothing in it runs a program or touches the file system. A new
 * tool that needs either is a decision for the owner, not a quiet addition.
 *
 * Same discipline as the risk-removal guards: read the source as text, strip
 * whole-line and block comments so the tombstone naming what went cannot mask a
 * real return, and drive every check red on a mutated copy (guards the guard).
 */

const MCP_INDEX = path.resolve(process.cwd(), '..', 'mcp-server', 'src', 'index.ts')

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Modules that run programs or reach the file system, in any import form. */
const FORBIDDEN = /^(?:node:)?(?:child_process|fs|fs\/promises)$/

function forbiddenModules(src: string): string[] {
  const specifiers = [
    ...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
    ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...src.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
  ].map((m) => m[1])
  return specifiers.filter((s) => FORBIDDEN.test(s))
}

/** The first argument of every fetch() that does not start from the /api/v1 base. */
function offApiFetches(src: string): string[] {
  return Array.from(src.matchAll(/\bfetch\(\s*([^,)\n]+)/g))
    .map((m) => m[1].trim())
    .filter((arg) => !arg.startsWith('`${API}'))
}

describe('D68 — the MCP server is data-only', () => {
  const src = strip(fs.readFileSync(MCP_INDEX, 'utf8'))

  it('registers no run_audit tool', () => {
    expect(src).not.toContain("'run_audit'")
  })

  it('imports nothing that runs a program or touches the file system', () => {
    expect(forbiddenModules(src)).toEqual([])
  })

  it('calls nothing but the /api/v1 base', () => {
    // At least the get() and post() helpers fetch, so an empty list would mean
    // the pattern stopped matching rather than that the server is clean.
    expect(Array.from(src.matchAll(/\bfetch\(/g)).length).toBeGreaterThan(0)
    expect(src).toMatch(/const API = `\$\{BASE_URL\}\/api\/v1`/)
    expect(offApiFetches(src)).toEqual([])
  })

  it('catches what it claims to (guards the guard)', () => {
    // A clean stand-in, so this fails only when a detector is broken; the tests
    // above are the ones that speak for the real file.
    const clean = [
      "import { z } from 'zod'",
      'const API = `${BASE_URL}/api/v1`',
      'const res = await fetch(`${API}${path}`)',
    ].join('\n')
    expect(forbiddenModules(clean)).toEqual([])
    expect(offApiFetches(clean)).toEqual([])

    expect(forbiddenModules(`${clean}\nimport { execFile } from 'child_process'`)).toEqual(['child_process'])
    expect(forbiddenModules(`${clean}\nimport { readdir } from 'node:fs/promises'`)).toEqual(['node:fs/promises'])
    expect(forbiddenModules(`${clean}\nconst cp = await import('node:child_process')`)).toEqual(['node:child_process'])
    expect(forbiddenModules(`${clean}\nconst fs = require('fs')`)).toEqual(['fs'])
    expect(offApiFetches(`${clean}\nawait fetch(\`\${BASE_URL}/live-data/markets\`)`)).toEqual(['`${BASE_URL}/live-data/markets`'])

    // A tombstone may name what went; only code counts.
    expect(strip("// import { execFile } from 'child_process'\n")).not.toContain('child_process')
  })
})
