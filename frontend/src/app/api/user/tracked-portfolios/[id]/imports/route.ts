import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getCurrentUserId } from '@/lib/auth/session'
import { MAX_TRADES_PER_PORTFOLIO, isUuid } from '@/lib/data/tradeLedger'
import { importIssues, parseImportRequest, type ImportLayout, type ImportRowStatus } from '@/lib/data/tradeImport'
import { dbUnavailable, ownedTrackedPortfolio } from '@/lib/server/trackedPortfolios'
import {
  checkImport, listImports, listLayouts, notMigratedForImports, saveImport, type ImportSummary,
} from '@/lib/server/tradeImports'

// Importing trades from a broker's file into a tracked portfolio (T-447, owner decision D200).
//   GET  /api/user/tracked-portfolios/[id]/imports
//        → this portfolio's imports, newest first, and the file layouts this person has saved
//   POST /api/user/tracked-portfolios/[id]/imports
//        {fileName, headerSignature, rows: [{line, trade}], include?, dryRun?, layout?}
//        → with dryRun: each row's status (new, already imported, looks already
//          recorded by hand) and what the lot engine would say, saving nothing;
//          without: saves the new rows (and any included) together, or none
// Every row is checked again with the trade route's own rules (parseTradeInput).
// The screen reads and matches the file (lib/data/tradeImport.ts); the file
// itself never reaches the server. A trade is never changed or removed: a whole
// import is cancelled at ./[importId]/cancel.

export const dynamic = 'force-dynamic'

export interface ImportsResponse {
  ok: boolean
  imports?: ImportSummary[]
  layouts?: Array<{ headerSignature: string; layout: ImportLayout; updatedAt: string }>
  error?: string
}

export interface ImportCheckResponse {
  ok: boolean
  dryRun?: boolean
  rows?: Array<{ line: number; status: ImportRowStatus }>
  issues?: Array<{ line: number; message: string }>
  toSave?: number
  capacity?: { existing: number; max: number }
  /** After saving. */
  importId?: string
  saved?: number
  skippedRepeats?: number
  heldBack?: number
  error?: string
}

async function guard(params: Promise<{ id: string }>) {
  const { id } = await params
  if (!isDbConfigured) return { response: dbUnavailable() }
  const userId = await getCurrentUserId()
  if (!userId) return { response: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isUuid(id)) return { response: NextResponse.json({ ok: false, error: 'Invalid portfolio id' }, { status: 400 }) }
  return { userId, id }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params)
  if ('response' in g) return g.response
  try {
    if (!(await ownedTrackedPortfolio(g.userId, g.id))) {
      return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    }
    const [imports, layouts] = await Promise.all([listImports(g.userId, g.id), listLayouts(g.userId)])
    return NextResponse.json<ImportsResponse>({ ok: true, imports, layouts })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigratedForImports()
    throw e
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params)
  if ('response' in g) return g.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
  }
  const parsed = parseImportRequest(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  const req = parsed.value

  try {
    if (!(await ownedTrackedPortfolio(g.userId, g.id))) {
      return NextResponse.json({ ok: false, error: 'Tracked portfolio not found' }, { status: 404 })
    }

    if (req.dryRun) {
      const { check, ledger, saveLines } = await checkImport(g.userId, g.id, req)
      const issues = importIssues(ledger, req.rows.filter((r) => saveLines.has(r.line)))
      return NextResponse.json<ImportCheckResponse>({ ok: true, dryRun: true, ...check, issues })
    }

    const result = await saveImport(g.userId, g.id, req)
    if (result.status === 'over-capacity') {
      return NextResponse.json(
        { ok: false, error: `This portfolio holds ${result.existing.toLocaleString('en-US')} trades; adding ${result.adding.toLocaleString('en-US')} would pass the ${MAX_TRADES_PER_PORTFOLIO.toLocaleString('en-US')} one portfolio keeps. Nothing was saved, and nothing was removed to make room.` },
        { status: 409 },
      )
    }
    if (result.status === 'nothing-to-save') {
      return NextResponse.json<ImportCheckResponse>({
        ok: true, saved: 0, skippedRepeats: result.skippedRepeats, heldBack: result.heldBack,
      })
    }
    return NextResponse.json<ImportCheckResponse>({
      ok: true, importId: result.importId, saved: result.saved,
      skippedRepeats: result.skippedRepeats, heldBack: result.heldBack,
    }, { status: 201 })
  } catch (e) {
    if (isSchemaBehindError(e)) return notMigratedForImports()
    throw e
  }
}
