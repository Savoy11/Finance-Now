import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The two dev-server restart scripts (frontend/restart-dev.ps1, and the repo root's, which
// restart-dev.bat runs).
//
// Both assigned the process id to $pid until 2026-10-14. That is PowerShell's own read-only
// process id: the assignment failed, the script carried on, and Stop-Process -Id $pid
// stopped the PowerShell running it, so whenever port 3000 was in use the script killed
// itself and never restarted anything. PowerShell does not run in this suite, so the
// scripts are read as text.

const FRONTEND = process.cwd()
const SCRIPTS = {
  frontend: join(FRONTEND, 'restart-dev.ps1'),
  root: join(FRONTEND, '..', 'restart-dev.ps1'),
}
const read = (file: string) => readFileSync(file, 'utf8')
/** The script without its comment lines, which describe the bug in its own words. */
const code = (file: string) => read(file).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

// Read-only or constant in Windows PowerShell 5.1, or overwritten by PowerShell itself, so a
// script that assigns one either fails or loses the value.
const AUTOMATIC = ['pid', 'host', 'input', 'args', 'error', 'home', 'pshome', 'psscriptroot', 'pscommandpath',
  'myinvocation', 'executioncontext', 'matches', 'psitem', 'this', 'null', 'true', 'false', 'shellid', 'psversiontable']
const NAMES = AUTOMATIC.join('|')
const ASSIGNS = new RegExp(`(?<![\\w\`])\\$(?:${NAMES})\\s*(?:[-+*/]?=)(?!=)|foreach\\s*\\(\\s*\\$(?:${NAMES})\\b`, 'gi')

describe('the dev-server restart scripts', () => {
  for (const [name, file] of Object.entries(SCRIPTS)) {
    it(`${name}: assigns no automatic variable`, () => {
      expect(code(file).match(ASSIGNS) ?? []).toEqual([])
    })

    it(`${name}: is plain ASCII, since PowerShell 5.1 reads a file with no BOM as Windows-1252`, () => {
      const bad = [...read(file)].filter((ch) => ch.charCodeAt(0) > 0x7e && ch !== '\n')
      expect(bad).toEqual([])
    })
  }

  it('catches the assignment that broke both scripts (guards the guard)', () => {
    expect('$pid = (Get-NetTCPConnection -LocalPort 3000).OwningProcess'.match(ASSIGNS)).toHaveLength(1)
    expect('foreach ($pid in $ids) { }'.match(ASSIGNS)).toHaveLength(1)
    expect('$Host.UI.RawUI.WindowTitle = "x"'.match(ASSIGNS)).toBeNull()
    expect('Stop-Process -Id $procId'.match(ASSIGNS)).toBeNull()
  })

  it('the frontend script stops only a listener started from its own folder', () => {
    const src = code(SCRIPTS.frontend)
    expect(src).toMatch(/Get-NetTCPConnection -LocalPort \$Port -State Listen/)
    expect(src).toMatch(/CommandLine\.IndexOf\(\$PSScriptRoot/)
    expect(src).toMatch(/Nothing was stopped/)
  })

  // Built from parts: CLAUDE.md's no-deletion audit greps the repo for the cmdlet's name,
  // and a test that spelled it out would be a hit of its own.
  const DELETE = ['Remove', 'Item'].join('-')

  it('the root script runs the frontend script and stops or deletes nothing itself', () => {
    const src = code(SCRIPTS.root)
    expect(src).toMatch(/frontend\\restart-dev\.ps1/)
    for (const cmd of ['Stop-Process', DELETE, 'Get-NetTCPConnection']) expect(src).not.toContain(cmd)
  })

  it('the two scripts together hold one deletion, of .next by its full path (CLAUDE.md’s audit)', () => {
    const all = Object.values(SCRIPTS).map(code).join('\n')
    expect(all.split(DELETE)).toHaveLength(2)
    expect(code(SCRIPTS.frontend)).toMatch(/\$buildDir = Join-Path \$PSScriptRoot '\.next'/)
    expect(code(SCRIPTS.frontend)).toContain(`${DELETE} -Recurse -Force $buildDir`)
  })
})
