'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Loader2, RadarIcon, ExternalLink, AlertTriangle } from 'lucide-react'
import type { ScanFinding, ScanResponse, ScanTarget } from '@/app/live-data/pump-report/scan/route'
import { SCAN_TARGET_CAP } from '@/app/live-data/pump-report/scan/route'
import { riskBg, riskColor, riskLabel } from './riskStyles'

// ─── Why this panel exists ────────────────────────────────────────────────────
//
// /live-data/pump-report/scan is the BATCH counterpart of /investigate: one
// short web-search pass per target instead of one deep eight-angle
// investigation of a single target. The route was written, terms-registered and
// maintained, but nothing ever called it — only its `ScanTarget` type was
// imported. It went into the P3 review as an orphan (2026-09-08 owner decision:
// wire it up rather than delete it), and this panel is that wiring.
//
// The deep investigation still covers the FIRST address only. This sweeps them
// all shallowly, so a reader with six saved wallets is told which ones warrant
// the deep read instead of having to guess.

interface Props {
  targets: ScanTarget[]
}

type Phase = 'idle' | 'scanning' | 'done' | 'error'

export function ScanAllPanel({ targets }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Never automatic: every target costs a web search, so the reader asks for it.
  async function runScan() {
    setPhase('scanning')
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/live-data/pump-report/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        // Surface the server's own reason — a missing API key and a blocked
        // sensitive route are different problems with different fixes.
        setError(json?.error ?? `Scan failed (HTTP ${res.status})`)
        setPhase('error')
        return
      }
      setResult(json as ScanResponse)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan request failed')
      setPhase('error')
    }
  }

  const overCap = targets.length > SCAN_TARGET_CAP

  return (
    <div className="space-y-3 rounded-card border border-border bg-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
            <RadarIcon size={14} className="text-accent-blue" /> Scan all addresses
          </h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            One quick public-sources pass per address. The full investigation below still covers the
            first address only.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={phase === 'scanning' || targets.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary transition-colors hover:border-accent-blue/40 hover:text-accent-blue disabled:opacity-40"
        >
          {phase === 'scanning'
            ? <><Loader2 size={13} className="animate-spin" /> Scanning…</>
            : <><RadarIcon size={13} /> Scan {Math.min(targets.length, SCAN_TARGET_CAP)}</>}
        </button>
      </div>

      {/* Stated before the run, not discovered after it. */}
      {overCap && phase === 'idle' && (
        <p className="text-[11px] text-amber-400">
          {targets.length} addresses added; a scan covers {SCAN_TARGET_CAP} at a time, so the last{' '}
          {targets.length - SCAN_TARGET_CAP} will not be looked at.
        </p>
      )}

      {phase === 'error' && error && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {phase === 'done' && result && (
        <div className="space-y-2">
          {result.skipped.length > 0 && (
            <p className="text-[11px] text-amber-400">
              Not scanned ({result.skipped.length}):{' '}
              {result.skipped.map(s => (s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s)).join(', ')}
            </p>
          )}
          {result.findings.map(f => <FindingRow key={f.target.id} finding={f} />)}
          <p className="text-[10px] text-text-muted">
            Scanned {result.scanned} of {result.requested} · {new Date(result.completedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}

function FindingRow({ finding }: { finding: ScanFinding }) {
  const [open, setOpen] = useState(false)
  const hasDetail = finding.evidence.length > 0 || finding.sources.length > 0

  return (
    <div className={clsx('rounded-lg border p-3', riskBg(finding.riskLevel))}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={clsx('font-mono text-[10px] font-semibold tracking-wide', riskColor(finding.riskLevel))}>
          {riskLabel(finding.riskLevel)}
        </span>
        <span className="font-mono text-[11px] text-text-secondary">
          {finding.target.label.length > 24
            ? `${finding.target.label.slice(0, 12)}…${finding.target.label.slice(-8)}`
            : finding.target.label}
        </span>
        {hasDetail && (
          <button
            onClick={() => setOpen(o => !o)}
            className="ml-auto text-[10px] text-text-muted transition-colors hover:text-accent-blue"
          >
            {open ? 'Hide' : `Evidence (${finding.evidence.length})`}
          </button>
        )}
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{finding.summary}</p>

      {open && (
        <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
          {finding.evidence.map((e, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-text-muted">• {e}</p>
          ))}
          {finding.sources.map((s, i) => {
            const isUrl = /^https?:\/\//.test(s)
            return isUrl ? (
              <a
                key={i}
                href={s}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-accent-blue hover:underline"
              >
                <ExternalLink size={10} /> {s.length > 60 ? `${s.slice(0, 60)}…` : s}
              </a>
            ) : (
              <p key={i} className="text-[11px] text-text-muted">{s}</p>
            )
          })}
        </div>
      )}
    </div>
  )
}
