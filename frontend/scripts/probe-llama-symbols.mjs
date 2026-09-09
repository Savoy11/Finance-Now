#!/usr/bin/env node
// Resolve the LLAMA_MAP symbols that /live-data/staking-rates can no longer match.
//
// WHY THIS EXISTS
// `staking-rates` reports `defillama-yields: partial (19/25 live)` and — since
// #160 — names the misses. Naming them is what made them fixable, but it stops
// one step short: knowing that `stkbnb` matched nothing does not say whether the
// token was renamed, the pool was delisted, or the chain label moved. Those have
// three different cures and the route cannot tell them apart, exactly as with the
// upstream probe (scripts/probe-staking-upstreams.mjs).
//
// So this fetches yields.llama.fi/pools ONCE and, for each unmatched key, prints
// the near misses it can see: same project, same underlying asset, similar
// symbol. One run should be enough to write the corrected symbol — or to
// conclude the pool is gone and the rung should follow the NEAR one out.
//
// It CHANGES NOTHING. Same split as the fee scripts: an automated symbol
// rewrite is how a rate from the wrong protocol lands on a coin.
//
// Run on the owner's machine — a sandboxed run cannot reach DeFiLlama, and this
// says so rather than reporting the API as gone (exit 2, the same
// inconclusive-vs-broken distinction the staking probe draws).
//
//   npm run llama-symbols
//   npm run llama-symbols -- --json

const JSON_ARG = process.argv.includes('--json')
const URL_POOLS = 'https://yields.llama.fi/pools'

// MIRRORS LLAMA_MAP in src/app/live-data/staking-rates/route.ts. A guard test
// fails if the two drift, because a stale mirror looks authoritative while
// pointing at symbols the route no longer asks for.
const LLAMA_MAP = [
  { key: 'frax_eth',         symbols: ['SFRXETH'],         chain: 'Ethereum' },
  { key: 'stakewise_eth',    symbols: ['OSETH'],           chain: 'Ethereum' },
  { key: 'stader_eth',       symbols: ['ETHX'],            chain: 'Ethereum' },
  { key: 'swell_eth',        symbols: ['RSWETH', 'SWETH'], chain: 'Ethereum' },
  { key: 'renzo_eth',        symbols: ['EZETH'],           chain: 'Ethereum' },
  { key: 'kelp_eth',         symbols: ['RSETH'],           chain: 'Ethereum' },
  { key: 'puffer_eth',       symbols: ['PUFETH'],          chain: 'Ethereum' },
  { key: 'origin_eth',       symbols: ['OETH'],            chain: 'Ethereum' },
  { key: 'bedrock_eth',      symbols: ['UNIETH'],          chain: 'Ethereum' },
  { key: 'etherfi_eth',      symbols: ['WEETH', 'EETH'],   chain: 'Ethereum' },
  { key: 'ankr_eth',         symbols: ['ANKRETH'],         chain: 'Ethereum' },
  { key: 'sanctum_sol',      symbols: ['INF'],             chain: 'Solana' },
  { key: 'ankr_sol',         symbols: ['ANKRSOL'],         chain: 'Solana' },
  { key: 'benqi_avax',       symbols: ['SAVAX'],           chain: 'Avalanche' },
  { key: 'ankr_avax',        symbols: ['ANKRAVAX'],        chain: 'Avalanche' },
  { key: 'stader_matic',     symbols: ['MATICX'],          chain: 'Polygon' },
  { key: 'stader_bnb',       symbols: ['BNBX'],            chain: 'BSC' },
  { key: 'pstake_bnb',       symbols: ['STKBNB'],          chain: 'BSC' },
  { key: 'ankr_bnb',         symbols: ['ANKRBNB'],         chain: 'BSC' },
  { key: 'quicksilver_atom', symbols: ['QATOM'] },
  { key: 'pstake_atom',      symbols: ['STKATOM'] },
  { key: 'bifrost_dot',      symbols: ['VDOT'] },
  { key: 'bifrost_ksm',      symbols: ['VKSM'] },
  { key: 'lombard_btc',      symbols: ['LBTC'],            chain: 'Ethereum' },
  { key: 'metapool_near',    symbols: ['STNEAR'],          chain: 'Near' },
]

/** The protocol a key names, and the asset it stakes — both drive the near-miss search. */
function parseKey(key) {
  const i = key.lastIndexOf('_')
  return { project: key.slice(0, i), asset: key.slice(i + 1).toUpperCase() }
}

/** The route's matcher, reproduced exactly — or "no match" here means nothing. */
function routeMatch(pools, m) {
  for (const sym of m.symbols) {
    let cands = pools.filter((p) => (p.symbol || '').toUpperCase() === sym)
    if (m.chain) {
      const byChain = cands.filter((p) => p.chain === m.chain)
      if (byChain.length) cands = byChain
    }
    if (cands.length) return cands
  }
  return []
}

const fmtPool = (p) => {
  const apy = typeof p.apyBase === 'number' && p.apyBase > 0 ? p.apyBase : p.apy
  const tvl = typeof p.tvlUsd === 'number' ? `$${(p.tvlUsd / 1e6).toFixed(1)}M` : '—'
  return `${(p.symbol || '?').padEnd(14)} ${String(p.project || '?').padEnd(22)} `
       + `${String(p.chain || '?').padEnd(12)} apy=${apy == null ? '—' : Number(apy).toFixed(2) + '%'}  tvl=${tvl}`
}

async function main() {
  let pools
  try {
    const res = await fetch(URL_POOLS, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.error(`yields.llama.fi answered HTTP ${res.status}.`)
      console.error(res.status === 403 || res.status === 407
        ? 'That looks like THIS network refusing the host, not DeFiLlama being down.\n'
          + 'Re-run on the owner\'s machine — this run proves nothing about the source.'
        : 'The endpoint itself is failing; nothing here can be concluded about the symbols.')
      process.exit(2)
    }
    const body = await res.json()
    pools = Array.isArray(body?.data) ? body.data : []
  } catch (err) {
    console.error(`Could not reach yields.llama.fi: ${err?.message ?? err}`)
    console.error('THIS RUN PROVES NOTHING ABOUT THE SYMBOLS — run it where DeFiLlama is reachable.')
    process.exit(2)
  }

  if (!pools.length) {
    console.error('DeFiLlama returned no pools at all — inconclusive, not a symbol problem.')
    process.exit(2)
  }

  const matched = []
  const missing = []
  for (const m of LLAMA_MAP) {
    const hits = routeMatch(pools, m)
    if (hits.length) {
      hits.sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
      matched.push({ key: m.key, pool: hits[0] })
    } else {
      const { project, asset } = parseKey(m.key)
      // Three independent lenses, because the cause decides which one lands:
      //  byProject  — the protocol renamed its token
      //  bySymbol   — the symbol survives on a chain the map does not name
      //  byAsset    — the protocol left this asset entirely (expect nothing)
      const byProject = pools.filter((p) =>
        String(p.project || '').toLowerCase().replace(/[^a-z]/g, '').includes(project.replace(/[^a-z]/g, '')))
      const bySymbol = pools.filter((p) => {
        const s = (p.symbol || '').toUpperCase()
        return m.symbols.some((sym) => s.includes(sym) || sym.includes(s)) && s.length > 2
      })
      const byAsset = byProject.filter((p) => (p.symbol || '').toUpperCase().includes(asset))
      missing.push({ key: m.key, want: m.symbols, chain: m.chain ?? null, byProject, bySymbol, byAsset })
    }
  }

  if (JSON_ARG) {
    const slim = (arr) => arr.slice(0, 8).map((p) => ({
      symbol: p.symbol, project: p.project, chain: p.chain,
      apy: p.apy, apyBase: p.apyBase, tvlUsd: p.tvlUsd, pool: p.pool,
    }))
    console.log(JSON.stringify({
      pools: pools.length,
      matched: matched.map((r) => ({ key: r.key, symbol: r.pool.symbol, chain: r.pool.chain })),
      missing: missing.map((r) => ({
        key: r.key, want: r.want, chain: r.chain,
        byProject: slim(r.byProject), bySymbol: slim(r.bySymbol), byAsset: slim(r.byAsset),
      })),
    }, null, 2))
    process.exit(missing.length ? 1 : 0)
  }

  console.log(`\n══ DeFiLlama symbol resolution — ${pools.length} pools, ${matched.length}/${LLAMA_MAP.length} keys matched ══\n`)

  if (!missing.length) {
    console.log('Every key in LLAMA_MAP matches a live pool. Nothing to fix.\n')
    process.exit(0)
  }

  console.log(`${missing.length} key(s) match nothing. For each, the candidates below are what\n`
            + 'DeFiLlama actually carries. Read them and pick the cure:\n'
            + '  \u2022 a same-project pool with a new symbol   -> update the key\'s `symbols`\n'
            + '  \u2022 the right symbol on a different chain   -> fix or drop its `chain`\n'
            + '  \u2022 nothing from that project at all        -> the rung is gone; remove it,\n'
            + '                                              on the same evidence standard\n'
            + '                                              as the NEAR removal\n')

  for (const r of missing) {
    console.log('─'.repeat(78))
    console.log(`✗ ${r.key}  — wants ${r.want.join(' or ')}${r.chain ? ` on ${r.chain}` : ' (any chain)'}`)
    const show = (label, arr, note) => {
      if (!arr.length) { console.log(`    ${label}: none${note ? ` — ${note}` : ''}`); return }
      console.log(`    ${label}:`)
      for (const p of arr.slice(0, 6)) console.log(`      ${fmtPool(p)}`)
      if (arr.length > 6) console.log(`      … ${arr.length - 6} more`)
    }
    show('same project, staking this asset', r.byAsset)
    show('same project, any asset', r.byProject, 'the protocol is not in the dataset at all')
    show('similar symbol, any project', r.bySymbol)
    console.log('')
  }

  console.log('─'.repeat(78))
  console.log('Nothing was written. Edit LLAMA_MAP by hand once you have read the above.\n')
  process.exit(1)
}

main()
