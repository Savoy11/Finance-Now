/**
 * Generate a re-verification worksheet for the staking provider catalog (T-394).
 *
 *   npm run staking-worksheet
 *
 * Writes two files to frontend/, both gitignored:
 *   staking-catalog-worksheet.csv  — one row per provider × asset, for a spreadsheet
 *   staking-catalog-worksheet.md   — per-provider summary, risk dimensions, progress
 *
 * Why this exists. `STAKING_DATA_LAST_VERIFIED` is 2026-06-28 and its 90-day window
 * closes on 2026-09-27. The owner chose (STALENESS-ACK, 2026-09-20) to let that notice
 * fire rather than rush 55 providers × 6 editorial risk dimensions to beat a date. That
 * was the right call, and it leaves the pass itself still to be done — 187 asset rows
 * and 330 risk judgments, which nobody can do well by reading TypeScript.
 *
 * The split this worksheet makes: everything a machine can check, it pre-fills — the
 * live APR the route is serving right now beside the catalog's static estimate; the
 * protocol's TVL on DefiLlama beside the catalog's `tvlBillions`; whether the recorded
 * website still answers. Everything editorial — the six risk dimensions, lock-ups,
 * minimums, audit counts — gets the current value beside a blank column, so the job
 * is comparing against a source, not transcribing.
 *
 * ⚠ RUN IT FROM THE OWNER MACHINE over verified clean egress (CLAUDE.md). The live
 * columns are reachability findings and a cloud run would fill them wrongly.
 *
 * IMPORTANT — this script only reads. It never edits stakingProviders.ts and never
 * moves STAKING_DATA_LAST_VERIFIED. That date asserts the WHOLE table was checked on
 * one day; only a human who finished every provider can move it.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  STAKING_PROVIDERS,
  STAKING_DATA_LAST_VERIFIED,
  stakingDataAgeDays,
  type StakingProvider,
  type StakingCoinId,
} from '../src/lib/data/stakingProviders'
import { resolveLiveAprKey } from '../src/lib/utils/aprDisplay'

const BASE = process.env.BASE_URL ?? process.env.FN_BASE_URL ?? 'http://localhost:3000'
const OUT_CSV = join(process.cwd(), 'staking-catalog-worksheet.csv')
const OUT_MD = join(process.cwd(), 'staking-catalog-worksheet.md')

/**
 * Catalog id → DefiLlama protocol slug, for the providers whose TVL DefiLlama tracks
 * as a staking protocol. OBSERVED on 2026-09-24 against api.llama.fi/protocols, not
 * guessed: a wrong slug lands another protocol's TVL beside a provider's name. CeFi
 * exchanges are deliberately absent — DefiLlama's "binance-cex" is the exchange's
 * whole balance sheet, not its staking book, and comparing it to `tvlBillions` would
 * be a category error. Providers not listed here get a name-match CANDIDATE printed
 * for a human to confirm, never a value.
 */
const LLAMA_SLUG: Readonly<Record<string, string>> = {
  lido: 'lido',
  rocketpool: 'rocket-pool',
  marinade: 'marinade-liquid-staking',
  jito: 'jito-liquid-staking',
  stride: 'stride',
  benqi: 'benqi-staked-avax',
  etherfi: 'ether.fi-stake',
  frax: 'frax-ether',
  stakewise: 'stakewise-v3',
  stader: 'stader',
  swell: 'swell-liquid-staking',
  renzo: 'renzo',
  'kelp-dao': 'kelp',
  puffer: 'puffer-stake',
  bedrock: 'bedrock-unibtc',
  sanctum: 'sanctum-validator-lsts',
  babylon: 'babylon-protocol',
  lombard: 'lombard-lbtc',
  ankr: 'ankr',
  metapool: 'meta-pool-near',
}

type LlamaProtocol = { slug: string; name: string; tvl: number; category: string }
type RatesResponse = { rates: Record<string, number>; sources: Record<string, string> }

async function fetchJson<T>(url: string, ms: number): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function siteStatus(url: string): Promise<string> {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'Mozilla/5.0' } })
    // HEAD is not what a browser sends, and some sites answer it differently from GET —
    // crypto.com/staking returned 404 to HEAD and 200 to GET on the first run. Retry as
    // GET on anything but a plain 200 before recording a status.
    if (res.status !== 200) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'Mozilla/5.0' } })
    return String(res.status)
  } catch (e) {
    return `unreachable (${(e as Error).name})`
  }
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const pct = (a: number, b: number) => (a === 0 ? 'n/a' : `${(((b - a) / a) * 100).toFixed(0)}%`)

async function main() {
  const [rates, llama] = await Promise.all([
    fetchJson<RatesResponse>(`${BASE}/live-data/staking-rates`, 180_000),
    fetchJson<LlamaProtocol[]>('https://api.llama.fi/protocols', 30_000),
  ])
  const bySlug = new Map((llama ?? []).map((p) => [p.slug, p]))
  const inconclusive: string[] = []
  if (!rates) inconclusive.push(`live APR column empty — ${BASE}/live-data/staking-rates did not answer (is the dev server running?)`)
  if (!llama) inconclusive.push('DefiLlama TVL column empty — api.llama.fi/protocols did not answer')

  // ── per-asset rows ──────────────────────────────────────────────────────────
  const header = [
    'provider', 'category', 'defunct', 'coin', 'catalog_static_apr', 'live_apr_now', 'live_key', 'apr_drift',
    'catalog_min_stake', 'catalog_lockup_days', 'catalog_liquid', 'receipt_token',
    'OBSERVED_apr', 'OBSERVED_min_stake', 'OBSERVED_lockup_days', 'OBSERVED_liquid', 'source_url', 'checked_on', 'notes',
  ]
  const lines = [header.join(',')]
  let liveFilled = 0
  let assetRows = 0
  for (const p of STAKING_PROVIDERS) {
    for (const [coinId, asset] of Object.entries(p.assets) as [StakingCoinId, NonNullable<StakingProvider['assets'][StakingCoinId]>][]) {
      assetRows++
      const key = resolveLiveAprKey(p, coinId, asset)
      const live = key && rates?.sources?.[key] === 'live' ? rates.rates[key] : undefined
      if (live != null) liveFilled++
      lines.push([
        p.id, p.category, p.defunct ? 'DEFUNCT' : '', coinId, asset.staticApr, live ?? '', key ?? '', live != null ? pct(asset.staticApr, live) : '',
        asset.minStakeNative, asset.lockupDays, asset.liquid, asset.receiptToken ?? '',
        '', '', '', '', p.website ?? '', '', '',
      ].map(csvCell).join(','))
    }
  }
  writeFileSync(OUT_CSV, lines.join('\n') + '\n')

  // ── per-provider summary ────────────────────────────────────────────────────
  const md: string[] = []
  md.push('# Staking catalog re-verification worksheet (T-394)')
  md.push('')
  md.push(`Generated ${new Date().toISOString().slice(0, 10)} · catalog last fully verified **${STAKING_DATA_LAST_VERIFIED}** (${stakingDataAgeDays(new Date())} days ago) · ${STAKING_PROVIDERS.length} providers · ${assetRows} asset rows · live APR pre-filled on ${liveFilled}`)
  md.push('')
  if (inconclusive.length) {
    md.push('> ⚠ **Partially inconclusive run:**')
    for (const i of inconclusive) md.push(`> - ${i}`)
    md.push('')
  }
  md.push('The unit of work is ONE PROVIDER: open its docs once and check every row it owns. Fill the OBSERVED columns in the CSV; record your verdict on each risk dimension here. `STAKING_DATA_LAST_VERIFIED` moves only when every provider is ticked.')
  md.push('')
  md.push('| # | provider | cat | founded | website → status | catalog TVL ($B) | DefiLlama TVL ($B) | audits | custody | cpty | contract | slashing | liquidity | regulatory | ✓ |')
  md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  const candidates: string[] = []
  let n = 0
  for (const p of STAKING_PROVIDERS) {
    n++
    const status = p.website ? await siteStatus(p.website) : '—'
    const slug = LLAMA_SLUG[p.id]
    let llamaTvl = '—'
    if (slug) {
      const hit = bySlug.get(slug)
      llamaTvl = hit ? (hit.tvl / 1e9).toFixed(2) : `slug '${slug}' not found`
    } else if (p.category === 'liquid' && llama) {
      const guess = llama.filter((x) => x.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) && /stak/i.test(x.category)).slice(0, 2)
      if (guess.length) candidates.push(`${p.id}: ${guess.map((g) => `${g.slug} (${(g.tvl / 1e9).toFixed(2)}B, ${g.category})`).join(' | ')}`)
    } else if (p.category !== 'liquid') {
      llamaTvl = 'n/a (not a DeFi protocol)'
    }
    const r = p.risks
    md.push(`| ${n} | **${p.name}**${p.defunct ? ' (DEFUNCT)' : ''} | ${p.category} | ${p.founded ?? ''} | ${p.website ?? ''} → ${status} | ${p.tvlBillions ?? ''} | ${llamaTvl} | ${p.auditCount ?? ''} | ${r.custodyRisk} | ${r.counterpartyRisk} | ${r.contractRisk} | ${r.slashingRisk} | ${r.liquidityRisk} | ${r.regulatoryRisk} | ☐ |`)
  }
  md.push('')
  if (candidates.length) {
    md.push('## DefiLlama slug candidates — CONFIRM before recording a TVL')
    md.push('')
    md.push('These providers have no observed slug in the generator. A name match is printed so a human can confirm which entry, if any, is this provider — never copy a figure from here without doing that.')
    md.push('')
    for (const c of candidates) md.push(`- ${c}`)
    md.push('')
  }
  md.push('## Reading the table')
  md.push('')
  md.push('- **DefiLlama TVL** is the protocol\'s total value locked as DefiLlama measures it today; the catalog\'s `tvlBillions` was typed by hand. A gap of ±30% on a liquid-staking protocol is a normal market move; an order of magnitude is a stale or mis-scoped figure.')
  md.push('- **website → status** is one HEAD/GET from this machine now. A non-200 is a prompt to look, not a verdict — some sites 403 automated agents.')
  md.push('- **Risk dimensions** are the catalog\'s current 1–10 values. They are editorial and the owner\'s; nothing here proposes a change to them. Record the verdict per provider and change the file by hand, via PR.')
  md.push('- **Live APR** in the CSV is what `/live-data/staking-rates` served during this run; a large drift from `catalog_static_apr` means the static fallback is out of date, not that the provider changed its terms.')
  md.push('')
  md.push('## Progress')
  md.push('')
  md.push(`- [ ] 0 / ${STAKING_PROVIDERS.length} providers ticked`)
  md.push('- [ ] `STAKING_DATA_LAST_VERIFIED` moved (only after every provider)')
  writeFileSync(OUT_MD, md.join('\n') + '\n')

  console.log('staking-catalog worksheet written')
  console.log(`  ${STAKING_PROVIDERS.length} providers · ${assetRows} asset rows · live APR pre-filled on ${liveFilled}`)
  console.log(`  DefiLlama TVL resolved for ${Object.keys(LLAMA_SLUG).filter((id) => bySlug.has(LLAMA_SLUG[id])).length} of ${Object.keys(LLAMA_SLUG).length} mapped providers`)
  if (candidates.length) console.log(`  ${candidates.length} slug candidate(s) printed in the .md — confirm by hand`)
  console.log(`  catalog last fully verified ${STAKING_DATA_LAST_VERIFIED} (${stakingDataAgeDays(new Date())} days ago)`)
  console.log(`  → ${OUT_CSV}`)
  console.log(`  → ${OUT_MD}`)
  console.log('\nSTAKING_DATA_LAST_VERIFIED is NOT moved by this script.')
  if (inconclusive.length) {
    console.log('\n⚠ INCONCLUSIVE columns:')
    for (const i of inconclusive) console.log('  - ' + i)
    process.exit(2)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
