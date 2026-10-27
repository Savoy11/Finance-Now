import { NextRequest, NextResponse } from 'next/server'
import { CORS, options } from '../../../_cors'
import { fetchEcbFxRates } from '@/lib/server/ecbFxRates'
import { guardApiV1 } from '@/lib/server/apiKeys'

// Public agent API — daily ECB reference FX rates (frankfurter.dev, keyless).
// Official tier only: the ECB's published set. The UI's extended tier
// (the community currency-api) is deliberately NOT exposed here —
// an agent consuming this endpoint gets central-bank reference data or an
// error, never a silently blended community source.

export const dynamic = 'force-dynamic'
export { options as OPTIONS }

export interface V1FxRatesResponse {
  /** Publication date of the reference rates (YYYY-MM-DD). */
  date: string
  base: 'USD'
  /** ISO code → units per 1 USD. USD itself is included at 1. */
  rates: Record<string, number>
  source: 'frankfurter-ecb'
  updatedAt: string
}

export async function GET(req: NextRequest) {
  const denied = guardApiV1(req)
  if (denied) return denied
  const filter = req.nextUrl.searchParams.get('symbols')?.trim()
  try {
    const { date, base, rates } = await fetchEcbFxRates()

    let out = rates
    if (filter) {
      const wanted = filter.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      const unknown = wanted.filter((c) => !(c in rates))
      if (unknown.length > 0) {
        return NextResponse.json(
          { error: `Not in the ECB reference set: ${unknown.join(', ')}. Available: ${Object.keys(rates).sort().join(', ')}` },
          { status: 400, headers: CORS },
        )
      }
      out = Object.fromEntries(wanted.map((c) => [c, rates[c]]))
    }

    return NextResponse.json({
      date,
      base,
      rates: out,
      source: 'frankfurter-ecb',
      updatedAt: new Date().toISOString(),
    } satisfies V1FxRatesResponse, { headers: CORS })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'fx reference rates unavailable' },
      { status: 502, headers: CORS },
    )
  }
}
