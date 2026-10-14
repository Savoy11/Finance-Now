import { NextRequest, NextResponse } from 'next/server'
import { WALLET_FETCH_TIMEOUT_MS, walletFetchErrorMessage } from '@/lib/server/walletFetch'
import { getProviderKey } from '@/lib/api/live/providers'

export const dynamic = 'force-dynamic'

// TRON balance via Tronscan's API, with a key only (owner, 2026-10-14, D105).
//
// Tronscan's terms say "You must create an account with Company to access the Services", its
// API docs put the key in the TRON-PRO-API-KEY header, and a request without one is
// rate-limited: every keyless call from the owner's IP on 2026-10-14 got HTTP 429. So without
// TRONSCAN_API_KEY this route calls nothing and says why, rather than fail on every request.
// The reading is in sourceTerms.ts.
const TRONSCAN_API = 'https://apilist.tronscanapi.com/api/account'

const NO_KEY =
  'TRON balances need a Tronscan API key (TRONSCAN_API_KEY). Tronscan’s terms require an account, and its API rate-limits requests without a key, so none is sent without one.'

/** TRX has 6 decimals; the API reports integer "sun". */
const SUN_PER_TRX = 1_000_000

// GET /live-data/wallet/tron?address=...
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim()
  if (!address) {
    return NextResponse.json({ ok: false, error: 'Missing address' }, { status: 400 })
  }

  // TRON base58 address: starts with 'T', 34 chars.
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'Invalid TRON address' }, { status: 400 })
  }

  const key = getProviderKey('tronscan')
  if (!key) return NextResponse.json({ ok: false, configured: false, error: NO_KEY })

  try {
    const res = await fetch(`${TRONSCAN_API}?address=${encodeURIComponent(address)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceNow/1.0)',
        'TRON-PRO-API-KEY': key,
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(WALLET_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Tronscan HTTP ${res.status}`)

    const data = await res.json()

    // An unused address returns 200 with no balance field rather than an error;
    // treat that as zero rather than surfacing a failure.
    const sun = Number(data?.balance ?? 0)
    if (!Number.isFinite(sun)) throw new Error('No balance returned')

    return NextResponse.json({
      ok: true,
      address,
      chain: 'tron',
      balance: sun / SUN_PER_TRX,
      symbol: 'TRX',
      decimals: 6,
      updatedAt: Date.now(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: walletFetchErrorMessage(err) }, { status: 502 })
  }
}
