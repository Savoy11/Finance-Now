import { describe, it, expect } from 'vitest'
import { STAKING_PROVIDERS } from '../stakingProviders'

/**
 * The staking catalog states facts, not grades of risk (owner, 2026-10-18, D137; D26's
 * reasoning applied to the words it left behind). D26 removed the six 1-10 risk figures,
 * but 20 lines of text still graded providers: "DOJ-indicted founders — elevated
 * counterparty risk", "Higher counterparty risk than regulated US exchanges", "excellent
 * security". The 2026-10-18 agent run quoted them back as data. The facts stay (the
 * indictment, the ownership, the hack); the grade goes.
 *
 * Naming a kind of risk is a fact and stays ("restaking slashing applies", "impermanent
 * loss risk"). Celsius, defunct and kept as the cautionary example, is left out: its text
 * is the history of a collapse.
 */
const GRADED = [
  /\b(elevated|higher|lower|less|greater|reduced|meaningful|significant)\b[^.;—]{0,30}\brisks?\b/i,
  /\brisks?\b[^.;—]{0,15}\b(elevated|higher|lower|is real|the dominant)\b/i,
  /\brisk profile\b/i,
  /\bdominant (risk|concerns?)\b/i,
  /\b(excellent|strong) security\b/i,
  /\bsecurity track record\b/i,
]

function texts() {
  const out: Array<{ where: string; text: string }> = []
  for (const p of STAKING_PROVIDERS) {
    if (p.defunct) continue
    out.push({ where: `${p.id} tagline`, text: p.tagline ?? '' }, { where: `${p.id} description`, text: p.description ?? '' })
    for (const [coin, a] of Object.entries(p.assets)) {
      if (!a) continue
      for (const f of a.features ?? []) out.push({ where: `${p.id} ${coin} feature`, text: f })
      if (a.lockupNote) out.push({ where: `${p.id} ${coin} lock-up note`, text: a.lockupNote })
    }
  }
  return out
}

describe('the staking catalog’s wording', () => {
  it('grades no live provider’s risk, up or down', () => {
    const found = texts().filter((t) => GRADED.some((re) => re.test(t.text))).map((t) => `${t.where}: ${t.text}`)
    expect(found).toEqual([])
  })

  it('still reads the text it checks', () => {
    // A filter that matched nothing because it read nothing would pass the test above.
    const all = texts()
    expect(all.length).toBeGreaterThan(STAKING_PROVIDERS.length * 2)
    expect(all.some((t) => t.text.includes('Founders indicted by the US DOJ in 2023'))).toBe(true)
  })

  it('keeps naming kinds of risk, which are facts', () => {
    expect(texts().some((t) => /slashing/i.test(t.text))).toBe(true)
    expect(GRADED.some((re) => re.test('EigenLayer integration adds restaking slashing risk'))).toBe(false)
    expect(GRADED.some((re) => re.test('Impermanent loss risk — returns vary with price volatility'))).toBe(false)
  })
})
