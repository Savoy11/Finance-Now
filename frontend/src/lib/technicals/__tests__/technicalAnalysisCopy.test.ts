import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'

// The crypto TA page must not offer what it does not show.
//
// Its Backtest tab has been hidden since 2026-08-20, and for 54 days the page's own
// description still promised "strategy backtests". The 2026-09-22 steward sweep saw it
// and left it for a queue item that was never filed; it came out on 2026-10-13. While
// 'backtest' is missing from the page's Tab union, no code on the page may mention
// backtests (comments may: they carry the restore instructions). Restoring the tab
// re-adds it to the union and lifts this.

const PAGE = join(__dirname, '..', '..', '..', 'app', '(dashboard)', 'technical-analysis', 'page.tsx')
const source = readFileSync(PAGE, 'utf8')
const code = stripComments(source) as string

describe('the crypto technical analysis page', () => {
  const union = code.match(/type Tab\s*=\s*([^\n]+)/)?.[1]

  it('declares its tabs in a union this test can read', () => {
    expect(union).toBeDefined()
    expect(union).toContain("'chart'")
  })

  it('mentions backtests nowhere in its code while the Backtest tab is hidden', () => {
    if (union!.includes("'backtest'")) return
    const lines = code.split('\n').filter((l) => /backtest/i.test(l)).map((l) => l.trim())
    expect(lines).toEqual([])
  })
})
