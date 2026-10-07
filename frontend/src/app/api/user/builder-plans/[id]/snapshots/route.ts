import { NextResponse } from 'next/server'
import { and, count, desc, eq } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { isMissingTableError } from '@/lib/db/errors'
import { builderPlans, builderPlanSnapshots, type BuilderPlanSnapshotRow } from '@/lib/db/schema'
import { getCurrentUserId } from '@/lib/auth/session'
import {
  MAX_SAVED_CHECKS_PER_PLAN, parsePlanSnapshot, type PlanSnapshot, type SavedCheck,
} from '@/lib/data/planHistory'

// A plan's history (T-065, D56): the drift checks the user chose to save.
//   GET  /api/user/builder-plans/[id]/snapshots  → saved checks, newest first
//   POST /api/user/builder-plans/[id]/snapshots  → save one {snapshot}
//
// Every query is scoped to the plan AND the user, as in ../route.ts: a plan id
// that belongs to someone else is a 404, the same as one that does not exist.
// The stored snapshot is what parsePlanSnapshot returns, so a client can store
// only the fields it defines, and summaries that always agree with the rows.

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PlanHistoryResponse {
  ok: boolean
  checks?: SavedCheck[]
  check?: SavedCheck
  error?: string
}

function toCheck(row: BuilderPlanSnapshotRow): SavedCheck {
  return { id: row.id, capturedAt: row.capturedAt.toISOString(), snapshot: row.snapshot as PlanSnapshot }
}

function dbUnavailable() {
  return NextResponse.json(
    { ok: false, error: 'Database is not configured — run `npm run db:status` and set DATABASE_URL in frontend/.env.local.' },
    { status: 503 },
  )
}

/** The table arrives in migration 0004; until it is applied, say what to run rather than fail with a 500. */
function notMigrated() {
  return NextResponse.json(
    { ok: false, error: 'Saved checks need a database update that has not been applied yet. Run `npm run db:migrate` in frontend/, then reload.' },
    { status: 503 },
  )
}

/** The plan, if it exists and belongs to this user. */
async function ownedPlan(planId: string, userId: string) {
  const [plan] = await db.select({ id: builderPlans.id }).from(builderPlans)
    .where(and(eq(builderPlans.id, planId), eq(builderPlans.userId, userId)))
    .limit(1)
  return plan ?? null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: 'Invalid plan id' }, { status: 400 })
  if (!(await ownedPlan(id, userId))) return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 404 })

  try {
    const rows = await db.select().from(builderPlanSnapshots)
      .where(and(eq(builderPlanSnapshots.planId, id), eq(builderPlanSnapshots.userId, userId)))
      .orderBy(desc(builderPlanSnapshots.capturedAt))
      .limit(MAX_SAVED_CHECKS_PER_PLAN)
    return NextResponse.json<PlanHistoryResponse>({ ok: true, checks: rows.map(toCheck) })
  } catch (e) {
    if (isMissingTableError(e)) return notMigrated()
    throw e
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isDbConfigured) return dbUnavailable()
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: 'Invalid plan id' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
  }
  const snapshot = parsePlanSnapshot((body as { snapshot?: unknown } | null)?.snapshot)
  if (!snapshot) return NextResponse.json({ ok: false, error: 'Not a valid drift check' }, { status: 400 })

  if (!(await ownedPlan(id, userId))) return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 404 })

  try {
    const [{ n }] = await db.select({ n: count() }).from(builderPlanSnapshots)
      .where(and(eq(builderPlanSnapshots.planId, id), eq(builderPlanSnapshots.userId, userId)))
    if (n >= MAX_SAVED_CHECKS_PER_PLAN) {
      return NextResponse.json(
        { ok: false, error: `This plan already keeps ${MAX_SAVED_CHECKS_PER_PLAN} saved checks, the most one plan holds. Nothing was removed to make room.` },
        { status: 409 },
      )
    }

    const [row] = await db.insert(builderPlanSnapshots).values({ planId: id, userId, snapshot }).returning()
    return NextResponse.json<PlanHistoryResponse>({ ok: true, check: toCheck(row) }, { status: 201 })
  } catch (e) {
    if (isMissingTableError(e)) return notMigrated()
    throw e
  }
}
