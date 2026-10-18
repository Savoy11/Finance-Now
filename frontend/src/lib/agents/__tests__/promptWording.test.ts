import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DEFAULTS } from '../prompts'
import { EQUITY_OUTLIER_SCAN } from '@/components/markets/agentScans'
import { TRANSFER_FEES_LAST_VERIFIED, transferFeesAreStale } from '@/lib/data/transferFees'

/**
 * The three prompt changes the 2026-10-17 agent evaluation led to (D136,
 * docs/assessments/T6-agents-2026-10-17.md). Each agent said what its instructions
 * told it to, so the fault was the wording, and these keep it from coming back.
 */

const prompt = (id: string) => AGENT_DEFAULTS.find((a) => a.id === id)!.systemPrompt

describe('App Assistant on the transfer fee table', () => {
  // It called the fee data "real and actively maintained", repeating its instructions,
  // while the table was past its review date and being re-checked by hand.
  const line = prompt('app-assistant').split('\n').find((l) => l.startsWith('- Transfer Fees:'))!

  it('gives the date the table was last checked, from the table itself', () => {
    expect(line).toContain(TRANSFER_FEES_LAST_VERIFIED)
  })

  it('says it is past its review window exactly while it is', () => {
    expect(line.includes('past its')).toBe(transferFeesAreStale())
  })

  it('never calls the data maintained or current, except to forbid it', () => {
    // What it says about the table, from the page's hiding onwards ("the current release" is not about the data).
    const aboutTable = line.slice(line.indexOf('hidden rather than removed'))
    expect(aboutTable).toMatch(/table/)
    const rest = aboutTable.replace('Never describe the fee data as current, live or maintained', '')
    expect(rest).not.toMatch(/\bmaintained\b|\bcurrent\b|\blive\b|\breal\b/i)
  })
})

describe('Pump Report Investigator', () => {
  // It rated Bitcoin "suspicious" and marked ATM scams "critical": scams that use a coin
  // to pay are not manipulation of the coin.
  const text = prompt('pump-report-investigator')

  it('rates the target, not scams that only use it to pay', () => {
    expect(text).toMatch(/Rate the target itself, not what surrounds it/)
    expect(text).toMatch(/only use the coin as the means of payment/)
    expect(text).toMatch(/do not raise overallRisk or suspicionScore/)
  })

  it('names no fixed years in its search angles, which go out of date', () => {
    const angles = text.slice(text.indexOf('INVESTIGATION PROTOCOL'), text.indexOf('REPORTING RULES'))
    expect(angles).not.toMatch(/\b20\d\d\b/)
  })
})

describe('Equity Screener', () => {
  // Its answer called stocks a "bet", an "opportunity" or a "trap" and ended with a
  // "Watch List": the shape of a recommendation. Its instructions asked for all of it.
  const RULE = /^- Describe what the figures show, never what to do:.*$/m
  const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/agent-config/page.tsx'), 'utf-8')
  const agentTab = page.split('\n').find((l) => l.includes("activeTab === 'equity-screener'"))!
  const screener = AGENT_DEFAULTS.find((a) => a.id === 'equity-screener')!
  const texts: Record<string, string> = {
    'the prompt': screener.systemPrompt.replace(RULE, ''),
    'its description': screener.description,
    'the scan panel blurb': EQUITY_OUTLIER_SCAN.blurb,
    'the scan task': EQUITY_OUTLIER_SCAN.task,
    'the AI Agents tab': agentTab,
  }

  it('carries the rule against telling the reader what to do', () => {
    expect(screener.systemPrompt).toMatch(RULE)
  })

  for (const [where, text] of Object.entries(texts)) {
    it(`uses no recommendation words in ${where}`, () => {
      expect(text).not.toMatch(/opportunit|\btraps?\b|watch ?list|\bbets?\b|\bbuy\b|\bsell\b/i)
    })
  }
})
