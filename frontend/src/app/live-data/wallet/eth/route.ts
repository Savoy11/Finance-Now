import { NextRequest, NextResponse } from 'next/server'
import {
  WALLET_FETCH_TIMEOUT_MS,
  WALLET_LADDER_BUDGET_MS,
  walletFetchErrorMessage,
  describeLadderFailure,
  type LadderAttempt,
} from '@/lib/server/walletFetch'

export const dynamic = 'force-dynamic'

// Public keyless JSON-RPC endpoints per EVM chain. Every chain the wallet
// watcher offers must be listed here — falling back to Ethereum would show
// the wrong chain's balance under a confident chain label.
//
// Each chain carries an ORDERED LADDER of endpoints, not a single URL. Public
// RPCs churn constantly (cloudflare-eth.com started returning -32603 "Internal
// error" and polygon-rpc.com now 403s with "tenant disabled"), and with a
// single endpoint that outage surfaced as a hard 502 on the two most-used
// chains. Endpoints are tried in order until one answers; only if every
// endpoint in the ladder fails does the route error.
// ⚠ Rungs reordered 2026-09-10 after Polygon hard-502'd. The FIX is sound; the
//   first explanation of it was WRONG, and the correction is the useful part.
//
//   What was claimed: ethereum-rpc.publicnode.com and polygon-bor-rpc.publicnode.com
//   are DEAD HOSTS, because both failed the TLS handshake outright while the other
//   five `-rpc` hostnames answered 200.
//
//   What is actually true: both answer 200 perfectly well. Re-tested from a
//   different egress the same day —
//
//     host                             residential IP   via VPN
//     ethereum-rpc.publicnode.com      TLS fails        200
//     polygon-bor-rpc.publicnode.com   TLS fails        200
//
//   They are not dead. They were refusing ONE IP, and they are publicnode's two
//   busiest endpoints — which is what a per-IP rate-limit ban looks like after
//   `npm run audit` has just hammered them. The five quieter `-rpc` hosts were
//   never near a limit, which is why the failure looked host-specific.
//
//   The ladder keeps the short hostnames anyway: they answer from BOTH egresses,
//   so they are strictly the safer first rung. Polygon also keeps 1rpc.io/matic,
//   added because its other two rungs (polygon.drpc.org, polygon-rpc.com) were
//   failing at the same time and it had nothing left to land on.
//
//   ⚠ THE LESSON, which is worth more than the endpoint list: a host that fails
//   from one IP is not a dead host, and "I tested it and it failed" is not
//   evidence about the host. This is the same mistake three times in one day —
//   mempool.space "down" (VPN-blocked), publicnode "dead" (IP-rate-limited), and
//   Polygon "missing a fallback" (it had three). Before deleting or replacing a
//   rung, re-test from a second egress; docs/runbooks/incident-response.md has the
//   loop.
const EVM_RPCS: Record<string, { rpcs: string[]; symbol: string }> = {
  ethereum:  { symbol: 'ETH',  rpcs: ['https://ethereum.publicnode.com', 'https://eth.drpc.org', 'https://cloudflare-eth.com'] },
  // 1rpc.io/matic added 2026-09-10: Polygon had zero working rungs without it.
  polygon:   { symbol: 'POL',  rpcs: ['https://polygon-bor.publicnode.com', 'https://1rpc.io/matic', 'https://polygon-rpc.com'] },
  bsc:       { symbol: 'BNB',  rpcs: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.binance.org'] },
  avalanche: { symbol: 'AVAX', rpcs: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://api.avax.network/ext/bc/C/rpc'] },
  arbitrum:  { symbol: 'ETH',  rpcs: ['https://arbitrum-one-rpc.publicnode.com', 'https://arb1.arbitrum.io/rpc'] },
  base:      { symbol: 'ETH',  rpcs: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'] },
  optimism:  { symbol: 'ETH',  rpcs: ['https://optimism-rpc.publicnode.com', 'https://mainnet.optimism.io'] },
}

/** Host (plus path where it disambiguates, e.g. 1rpc.io/matic) — enough to find the
 *  entry in EVM_RPCS without printing a full URL into an error string. */
function endpointLabel(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname && u.pathname !== '/' ? `${u.host}${u.pathname}` : u.host
  } catch {
    return url
  }
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(WALLET_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  // A JSON-RPC error body still arrives as HTTP 200, so it must be checked
  // explicitly or a dead endpoint reads as success with result === undefined.
  if (data.error) throw new Error(data.error.message || `rpc error ${data.error.code}`)
  if (data.result === undefined || data.result === null) throw new Error('empty rpc result')
  return data.result
}

// Runs both calls against one endpoint, so a healthy endpoint always serves a
// self-consistent pair (balance and txCount from the same node).
async function evmRpcPair(rpcs: string[], address: string): Promise<{ balanceHex: string; txCountHex: string; rpc: string }> {
  // Every rung's failure is kept, not just the last: the PRIMARY endpoint's reason
  // is the one worth reading, and the old message threw it away.
  const attempts: LadderAttempt[] = []
  let budgetExhausted = false
  // Per-request timeouts alone would let three dead endpoints cost three full
  // budgets, so the ladder also refuses to START a rung past the overall
  // deadline. A rung already in flight is allowed to finish on its own timeout.
  const deadline = Date.now() + WALLET_LADDER_BUDGET_MS
  for (const rpc of rpcs) {
    if (Date.now() >= deadline) {
      // Stop starting rungs, and record that the remainder were never asked —
      // which is a different claim from "they failed".
      budgetExhausted = true
      break
    }
    try {
      const [balanceHex, txCountHex] = await Promise.all([
        rpcCall(rpc, 'eth_getBalance', [address, 'latest']),
        rpcCall(rpc, 'eth_getTransactionCount', [address, 'latest']),
      ])
      return { balanceHex, txCountHex, rpc }
    } catch (err) {
      attempts.push({ endpoint: endpointLabel(rpc), error: walletFetchErrorMessage(err) })
      // try the next endpoint in the ladder
    }
  }
  throw new Error(describeLadderFailure(rpcs.length, attempts, { budgetExhausted }))
}

// GET /live-data/wallet/eth?address=0x...&chain=polygon
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim()
  const chain = req.nextUrl.searchParams.get('chain')?.trim() || 'ethereum'

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'Invalid EVM address' }, { status: 400 })
  }
  const chainConfig = EVM_RPCS[chain]
  if (!chainConfig) {
    return NextResponse.json(
      { ok: false, error: `Unsupported EVM chain: ${chain}. Supported: ${Object.keys(EVM_RPCS).join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const { balanceHex, txCountHex, rpc } = await evmRpcPair(chainConfig.rpcs, address)

    const balanceWei = BigInt(balanceHex)
    const balance    = Number(balanceWei) / 1e18
    const txCount    = parseInt(txCountHex, 16)

    return NextResponse.json({
      ok:       true,
      address,
      chain,
      balance,
      symbol:   chainConfig.symbol,
      decimals: 18,
      txCount,
      // Which endpoint actually served this, so a silently-degraded ladder is
      // visible rather than looking identical to the primary succeeding.
      rpc,
      updatedAt: Date.now(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: walletFetchErrorMessage(err) }, { status: 502 })
  }
}
