'use client'

import { AlertTriangle, Coins, Scale, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { STAKING_PROVIDERS } from '@/lib/data/stakingProviders'
import { affiliateCoverageByCategory, sponsoredProviders } from '@/lib/data/affiliates'

// ─── Why this page exists, and what is NOT finished about it ──────────────────
//
// The FTC requires an affiliate disclosure that is clear and conspicuous, and
// the per-link tags on /staking point here for the detail. This page is the
// standing explanation behind those tags.
//
// ⚠ THE PROSE MARKED "OWNER COPY REQUIRED" BELOW IS A PLACEHOLDER, NOT A
// DISCLOSURE. docs/BUSINESS-CHECKLIST.md §3 lists the disclosure set as the
// owner's to write, and inventing plausible-sounding legal text is worse than
// leaving a gap: a gap is visible, invented text reads as reviewed. The
// placeholders are deliberately written so they cannot be mistaken for finished
// copy — they say what belongs there rather than attempting it.
//
// Nothing here is reachable in a harmful state today: no provider has an
// affiliate URL set, so the page's live sections report zero and the
// placeholders describe an arrangement that does not yet exist.

function OwnerCopyRequired({ what, why }: { what: string; why: string }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
        <AlertTriangle size={12} aria-hidden /> Owner copy required — placeholder
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
        <strong className="text-text-primary">Needed here:</strong> {what}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{why}</p>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-bg-card p-5 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        {icon} {title}
      </h2>
      {children}
    </section>
  )
}

export default function HowWeMakeMoneyPage() {
  const active = STAKING_PROVIDERS.filter((p) => !p.defunct)
  const sponsored = sponsoredProviders(STAKING_PROVIDERS)
  const coverage = affiliateCoverageByCategory(STAKING_PROVIDERS)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="How we make money"
        subtitle="What is paid for, what is not, and what that can and cannot influence"
        icon={<Coins size={20} aria-hidden />}
        description="Finance Now rates providers it could be paid by. That is a real conflict of interest, so this page states the arrangement and the rules that constrain it."
      />

      {/* The live state — computed, so it cannot be out of date. */}
      <Section icon={<Scale size={15} className="text-accent-blue" aria-hidden />} title="Where things stand right now">
        {sponsored.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-emerald-300/90">
              <strong>No link in Finance Now is currently paid.</strong> All {active.length} active
              staking providers link to their own site, and no referral program is in place. The
              disclosure machinery described below is built and enforced, but nothing is earning
              anything — this figure is read from the catalog on each load, so it cannot go stale.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-text-secondary">
              <strong className="text-text-primary">{sponsored.length} of {active.length}</strong>{' '}
              active staking providers currently carry a paid link. Every one is tagged{' '}
              <span className="font-semibold uppercase text-amber-300">Paid link</span> at the point
              of the link itself.
            </p>
            <ul className="space-y-1 text-[11px] text-text-muted">
              {coverage.map((c) => (
                <li key={c.category}>
                  {c.sponsored} of {c.total} {c.category === 'cefi' ? 'CeFi exchanges' : c.category === 'wallet' ? 'wallets' : 'liquid-staking protocols'}
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-relaxed text-text-muted">
              That spread is uneven on purpose-of-fact rather than by choice: referral programs are
              common among exchanges and rare among liquid-staking protocols. Since exchanges also
              carry the highest counterparty risk in our own scoring, the providers we could be paid
              by are systematically <em>not</em> the ones that score best — stated here because the
              bias runs against you, not in your favour.
            </p>
          </div>
        )}
      </Section>

      {/* The rules. These describe enforced code, so they are safe to state plainly. */}
      <Section icon={<ShieldCheck size={15} className="text-emerald-400" aria-hidden />} title="What a paid link cannot do">
        <p className="text-xs leading-relaxed text-text-secondary">
          These are not promises about intent. Each one is enforced in code and pinned by a test
          that fails the build if it stops being true.
        </p>
        <ul className="space-y-2 text-xs leading-relaxed text-text-secondary">
          <li>
            <strong className="text-text-primary">It cannot change a risk score.</strong> The scoring
            functions take six risk numbers and never receive the provider object at all, so there is
            no affiliate field for them to read.
          </li>
          <li>
            <strong className="text-text-primary">It cannot change ordering or filtering.</strong>{' '}
            Ranking code takes a type with the affiliate fields removed — reading one inside a sort
            comparator is a compile error, not a review catch.
          </li>
          <li>
            <strong className="text-text-primary">It cannot soften a warning.</strong> A high risk
            score, a staleness notice and a defunct badge render identically whether or not we are
            paid. Defunct providers get no outbound link at all, paid or otherwise.
          </li>
          <li>
            <strong className="text-text-primary">It cannot replace the honest URL.</strong> A
            provider’s own address is kept alongside any referral link and is never overwritten, so
            an unmonetised route always exists and the links stay auditable.
          </li>
          <li>
            <strong className="text-text-primary">It cannot cost you anything.</strong> A referral
            pays out of the provider’s marketing budget; your rate and fees are the same either way.
          </li>
        </ul>
      </Section>

      <Section icon={<Coins size={15} className="text-amber-400" aria-hidden />} title="What we measure">
        <p className="text-xs leading-relaxed text-text-secondary">
          Clicks on a paid link are counted <strong className="text-text-primary">per provider, in
          aggregate only</strong>. No user id, session, IP address, cookie, user agent or per-click
          timestamp is recorded — the stored data is a provider name and a number. That answers the
          only question worth asking (is this link worth anything?) and cannot be joined to a person
          later, because there is nothing to join on.
        </p>
      </Section>

      <Section icon={<AlertTriangle size={15} className="text-amber-400" aria-hidden />} title="Still to be written">
        <p className="text-xs leading-relaxed text-text-secondary">
          The sections below need copy that only the owner can write. They are shown as gaps rather
          than filled with plausible text, because invented wording in a compliance document reads as
          reviewed when it is not.
        </p>
        <div className="space-y-3">
          <OwnerCopyRequired
            what="The formal affiliate/advertising disclosure statement, in the owner's own words, naming the entity that receives the commission."
            why="BUSINESS-CHECKLIST §3 lists this alongside the Terms of Service and Privacy Policy as an owner-decided document. FTC guidance also covers placement and wording, which is a legal judgement rather than a drafting exercise."
          />
          <OwnerCopyRequired
            what="Which referral programs have actually been joined, and any restrictions their terms place on where links may appear (web vs desktop app)."
            why="The ROADMAP notes several programs restrict desktop or in-app placement, and that cookie attribution usually fails in an embedded webview. That has to be confirmed per program before enabling links there."
          />
          <OwnerCopyRequired
            what="Jurisdiction-specific handling — UK FCA financial-promotion rules apply to crypto referrals, and several jurisdictions restrict crypto affiliate marketing outright."
            why="BUSINESS-CHECKLIST §2 flags this as a regulatory-research item. It may mean showing paid crypto links in some jurisdictions and not others."
          />
          <OwnerCopyRequired
            what="A contact route for questions or complaints about paid placement."
            why="BUSINESS-CHECKLIST §3 requires a contact/complaints channel as part of the public document set."
          />
        </div>
      </Section>

      <p className="text-[11px] leading-relaxed text-text-muted">
        Data-source attribution is a separate page:{' '}
        <a href="/data-sources" className="text-accent-blue hover:underline">Data Sources</a> lists
        every provider the app fetches from and the terms under which it does so.
      </p>
    </div>
  )
}
