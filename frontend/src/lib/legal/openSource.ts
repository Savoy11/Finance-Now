/**
 * The open-source packages Finance Now ships with, and their licences — read from
 * package-lock.json when the site is built (About & Legal, section 10).
 *
 * Derived, never typed: a hand-kept list is correct the day it is written and
 * wrong after the next `npm install`. The lockfile is what `npm ci` installs, so
 * it is the record of what was actually built.
 *
 * What counts: every package the lockfile installs for production. Dev-only
 * packages (test runners, linters) are left out — they never reach a user.
 * Optional packages stay in and are marked: most are platform builds (one per
 * operating system and chip) of which a given install uses one, and listing a
 * notice that did not apply is cheaper than omitting one that did.
 */

export interface LockfilePackage {
  name?: string
  version?: string
  license?: unknown
  dev?: boolean
  devOptional?: boolean
  optional?: boolean
  link?: boolean
}

export interface Lockfile {
  packages?: Record<string, LockfilePackage>
}

export interface OpenSourcePackage {
  name: string
  version: string
  /** The SPDX expression the package declares, or null when it declares none. */
  license: string | null
  /** Installed only where it applies (most often a per-platform build). */
  optional: boolean
}

export interface OpenSourceInventory {
  packages: OpenSourcePackage[]
  /** Package count per declared licence, most common first; null = not stated. */
  byLicense: Array<{ license: string | null; count: number }>
}

/** "node_modules/a/node_modules/@scope/b" → "@scope/b". */
export function packageNameFromPath(lockPath: string): string {
  const i = lockPath.lastIndexOf('node_modules/')
  return i === -1 ? lockPath : lockPath.slice(i + 'node_modules/'.length)
}

/** Lockfiles carry a string; very old packages declared {type} or a list. */
function readLicense(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null
  if (Array.isArray(raw)) {
    const parts = raw.map(readLicense).filter((x): x is string => x !== null)
    return parts.length ? parts.join(' OR ') : null
  }
  if (raw && typeof raw === 'object' && 'type' in raw) return readLicense((raw as { type: unknown }).type)
  return null
}

export function openSourceInventory(lock: Lockfile): OpenSourceInventory {
  const byKey = new Map<string, OpenSourcePackage>()

  for (const [lockPath, entry] of Object.entries(lock.packages ?? {})) {
    if (lockPath === '') continue                 // the app itself
    if (entry.link) continue                      // a workspace link, not a package
    if (entry.dev || entry.devOptional) continue  // never reaches a user

    const name = entry.name ?? packageNameFromPath(lockPath)
    const version = entry.version ?? ''
    const key = `${name}@${version}`
    const pkg: OpenSourcePackage = { name, version, license: readLicense(entry.license), optional: entry.optional === true }
    const prior = byKey.get(key)
    // The same name@version nested in two places is one package. It is optional
    // only if every copy is.
    byKey.set(key, prior ? { ...prior, optional: prior.optional && pkg.optional } : pkg)
  }

  const packages = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))

  const counts = new Map<string | null, number>()
  for (const p of packages) counts.set(p.license, (counts.get(p.license) ?? 0) + 1)
  const byLicense = [...counts.entries()]
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count || String(a.license).localeCompare(String(b.license)))

  return { packages, byLicense }
}
