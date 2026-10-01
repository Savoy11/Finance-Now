import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { openSourceInventory, packageNameFromPath, type Lockfile } from '../openSource'

const FIXTURE: Lockfile = {
  packages: {
    '': { name: 'finance-now-frontend', version: '1.0.0' },
    'node_modules/react': { version: '19.0.0', license: 'MIT' },
    'node_modules/clsx': { version: '2.1.1', license: 'MIT' },
    'node_modules/@scope/pkg': { version: '2.1.0', license: 'Apache-2.0' },
    'node_modules/a/node_modules/react': { version: '19.0.0', license: 'MIT' },          // same package, nested
    'node_modules/vitest': { version: '3.0.0', license: 'MIT', dev: true },
    'node_modules/dev-or-optional': { version: '1.0.0', license: 'MIT', devOptional: true },
    'node_modules/@img/libvips-linux-x64': { version: '1.0.0', license: 'LGPL-3.0-or-later', optional: true },
    'node_modules/old-style': { version: '0.1.0', license: { type: 'BSD-3-Clause' } },
    'node_modules/no-licence': { version: '0.0.1' },
    'node_modules/aliased': { name: 'real-name', version: '1.2.3', license: 'ISC' },
    'packages/workspace': { link: true },
  },
}

describe('openSourceInventory', () => {
  const inv = openSourceInventory(FIXTURE)
  const names = inv.packages.map((p) => p.name)

  it('lists production packages and leaves out the app itself, dev-only packages and workspace links', () => {
    expect(names).toEqual(['@img/libvips-linux-x64', '@scope/pkg', 'clsx', 'no-licence', 'old-style', 'react', 'real-name'])
  })

  it('counts a package nested in two places once', () => {
    expect(names.filter((n) => n === 'react')).toHaveLength(1)
  })

  it('marks optional packages, and reads the alias name a lockfile records', () => {
    expect(inv.packages.find((p) => p.name === '@img/libvips-linux-x64')?.optional).toBe(true)
    expect(inv.packages.find((p) => p.name === 'react')?.optional).toBe(false)
    expect(names).toContain('real-name')
    expect(names).not.toContain('aliased')
  })

  it('reads old {type} licences, and reports a missing one as null rather than guessing', () => {
    expect(inv.packages.find((p) => p.name === 'old-style')?.license).toBe('BSD-3-Clause')
    expect(inv.packages.find((p) => p.name === 'no-licence')?.license).toBeNull()
  })

  it('counts packages per licence, and the counts add up to the list', () => {
    expect(inv.byLicense[0]).toEqual({ license: 'MIT', count: 2 })
    expect(inv.byLicense.find((l) => l.license === null)?.count).toBe(1)
    expect(inv.byLicense.reduce((n, l) => n + l.count, 0)).toBe(inv.packages.length)
  })
})

describe('packageNameFromPath', () => {
  it('takes the last node_modules segment, scope included', () => {
    expect(packageNameFromPath('node_modules/a/node_modules/@scope/b')).toBe('@scope/b')
    expect(packageNameFromPath('node_modules/react')).toBe('react')
  })
})

describe('the real lockfile', () => {
  // The page reads this file at build time, so it must parse and must list what ships.
  const lock = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf8')) as Lockfile
  const inv = openSourceInventory(lock)
  const names = new Set(inv.packages.map((p) => p.name))

  it('lists the framework the app runs on and none of its test tooling', () => {
    expect(names.has('next')).toBe(true)
    expect(names.has('react')).toBe(true)
    expect(names.has('vitest')).toBe(false)
    expect(names.has('eslint')).toBe(false)
  })

  it('finds a licence for every package it lists (a missing one is shown as "Not stated")', () => {
    // Not a requirement on the dependencies — a package may genuinely declare
    // none — but a jump here means the lockfile format moved under the parser.
    const unstated = inv.packages.filter((p) => p.license === null)
    expect(unstated.length / inv.packages.length).toBeLessThan(0.05)
  })
})
