import { NextRequest, NextResponse } from 'next/server'
import {
  WALLET_FETCH_TIMEOUT_MS,
  WALLET_LADDER_BUDGET_MS,
  walletFetchErrorMessage,
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
// ⚠ Endpoints verified individually on 2026-09-10 (owner machine, no VPN). Two of
//   publicnode's hostnames were DEAD as first rungs and had to be replaced:
//
//     ethereum-rpc.publicnode.com     TLS handshake never completes -> ethereum.publicnode.com ✓
//     polygon-bor-rpc.publicnode.com  same                          -> polygon-bor.publicnode.com ✓
//
//   It is NOT a naming-convention change: bsc-rpc, avalanche-c-chain-rpc,
//   arbitrum-one-rpc, base-rpc and optimism-rpc all answer 200 and are left alone.
//   Only those two hosts are broken, and both happened to be first in their ladder.
//
//   Ethereum survived because the ladder fell through to eth.drpc.org — it just paid
//   a wasted request first. Polygon did NOT: its other two rungs (polygon.drpc.org,
//   polygon-rpc.com) were also failing, so all three were down and /wallets returned
//   a hard 502 for Polygon. A ladder is only as good as its rungs actually being
//   alive, and nothing was checking.
//
//   ⚠ Reachability is IP-dependent — see the VPN note in README. These were checked
//   from a residential IP; a failure here is not proof a host is down for everyone.
//   Re-verify with the loop in docs/runbooks/incident-response.md before deleting a
//   rung on the strength of one machine.
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
  let lastErr = 'no endpoints configured'
  // Per-request timeouts alone would let three dead endpoints cost three full
  // budgets, so the ladder also refuses to START a rung past the overall
  // deadline. A rung already in flight is allowed to finish on its own timeout.
  const deadline = Date.now() + WALLET_LADDER_BUDGET_MS
  for (const rpc of rpcs) {
    if (Date.now() >= deadline) {
      lastErr = `ladder budget of ${WALLET_LADDER_BUDGET_MS / 1000}s exhausted after ${lastErr}`
      break
    }
    try {
      const [balanceHex, txCountHex] = await Promise.all([
        rpcCall(rpc, 'eth_getBalance', [address, 'latest']),
        rpcCall(rpc, 'eth_getTransactionCount', [address, 'latest']),
      ])
      return { balanceHex, txCountHex, rpc }
    } catch (err) {
      lastErr = walletFetchErrorMessage(err)
      // try the next endpoint in the ladder
    }
  }
  throw new Error(`all RPC endpoints failed (last: ${lastErr})`)
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
