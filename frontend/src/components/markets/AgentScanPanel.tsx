'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronDown, Loader2, Sparkles, Telescope, Wrench } from 'lucide-react'
import { runAgentScan, distinctToolNames, type AgentScan, type AgentScanTool } from './agentScans'
import { FeatureNotice } from '@/components/legal/FeatureNotice'

// One panel for every AI scan on a market page (agentScans.ts lists them): a
// collapsed header, a run button, and the agent's report with the tools it called.
// The tool chips matter: a thin report off a feed with no data is a data problem,
// and the chips are how a reader can tell.

interface ScanReport {
  report: string
  toolsUsed: AgentScanTool[]
}

export function AgentScanPanel({ scan }: { scan: AgentScan }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    const out = await runAgentScan(scan)
    if (out.ok) setResult({ report: out.report, toolsUsed: out.toolsUsed })
    else setError(out.error)
    setLoading(false)
  }

  const tools = result ? distinctToolNames(result.toolsUsed) : []

  return (
    <div className="rounded-card border border-violet-500/25 bg-violet-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="size-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <Telescope size={16} className="text-violet-400" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{scan.title}</p>
          <p className="text-[11px] text-text-muted">{scan.blurb}</p>
        </div>
        <ChevronDown size={16} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-violet-500/15 pt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] text-text-muted">
                Runs the <Link href="/agent-config" className="text-accent-blue hover:underline">{scan.agentName}</Link> agent · takes 20–60s
              </p>
              {scan.coverage && <p className="text-[11px] text-text-muted">{scan.coverage}</p>}
            </div>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-violet-600 text-xs font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Sparkles size={13} aria-hidden />}
              {loading ? 'Scanning…' : result ? 'Re-run scan' : 'Run scan'}
            </button>
          </div>

          {loading && (
            <div className="space-y-2 py-1">
              <p className="text-xs text-text-muted flex items-center gap-2"><Loader2 size={13} className="animate-spin text-violet-400" aria-hidden /> {scan.progress}</p>
              {[1, 2, 3].map((i) => <div key={i} className="h-3 rounded-sm bg-bg-elevated animate-pulse" style={{ width: `${88 - i * 10}%` }} />)}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-300 border border-red-500/20">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Scan failed</p>
                <p className="text-red-400/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-border bg-bg-card">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <Telescope size={13} className="text-violet-400" aria-hidden />
                <span className="text-xs font-semibold text-text-secondary">{scan.reportTitle}</span>
                {tools.length > 0 && (
                  <div className="ml-auto flex flex-wrap gap-1 justify-end">
                    {tools.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] bg-bg-elevated text-text-muted border border-border">
                        <Wrench size={9} aria-hidden /> {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <FeatureNotice feature="aiAnswers" className="px-4 pt-2.5" />
              <div className="px-4 py-3 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{result.report}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
