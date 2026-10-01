import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LEGAL_PATHS } from '@/lib/legal/links'
import { openSourceInventory, type Lockfile } from '@/lib/legal/openSource'

export const metadata: Metadata = { title: 'Open-source notices' }

// Built once, when the site is built: the lockfile is what `npm ci` installed,
// so the page lists exactly the packages that shipped (lib/legal/openSource.ts).
export const dynamic = 'force-static'

function readLockfile(): Lockfile | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf8')) as Lockfile
  } catch {
    return null
  }
}

export default function OpenSourcePage() {
  const lock = readLockfile()
  const inventory = lock ? openSourceInventory(lock) : null

  return (
    <article className="space-y-6">
      <div className="space-y-2">
        <Link href={LEGAL_PATHS.about} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent-blue">
          <ArrowLeft size={12} aria-hidden /> About &amp; Legal
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Open-source notices</h1>
      </div>

      {!inventory || inventory.packages.length === 0 ? (
        // Said plainly rather than rendering an empty table that reads as "none".
        <p className="text-sm text-text-secondary">
          The package list could not be generated for this build.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-text-secondary">
            Finance Now is built with the {inventory.packages.length} packages listed below, each with the
            licence it declares. The list is generated from the project&rsquo;s package lock file when the
            site is built. Packages marked optional are installed only where they apply — most are builds for
            one operating system or chip. Each name links to the package&rsquo;s page on npm, which links to its
            source code and licence.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary">Licences</h2>
            <ul className="flex flex-wrap gap-2 text-xs">
              {inventory.byLicense.map((l) => (
                <li key={String(l.license)} className="rounded border border-border bg-bg-card px-2 py-1 text-text-secondary">
                  {l.license ?? 'Not stated'} <span className="text-text-muted">· {l.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary">Packages</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-elevated text-text-primary">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Package</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Version</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Licence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-secondary">
                  {inventory.packages.map((p) => (
                    <tr key={`${p.name}@${p.version}`}>
                      <td className="px-3 py-1.5">
                        <a
                          href={`https://www.npmjs.com/package/${p.name}/v/${p.version}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-text-primary hover:text-accent-blue"
                        >
                          {p.name}
                        </a>
                        {p.optional && <span className="ml-2 text-[10px] uppercase tracking-wide text-text-muted">optional</span>}
                      </td>
                      <td className="px-3 py-1.5 font-mono">{p.version}</td>
                      <td className="px-3 py-1.5">{p.license ?? <span className="text-text-muted">Not stated</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </article>
  )
}
